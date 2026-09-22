import { getStorageBucket } from '../firebaseAdmin';

/**
 * Saneamento de mídia da Ordem de Produção antes da gravação no Firestore.
 *
 * MOTIVO (correção de bug real):
 * A OP carregava a imagem do layout embutida em base64 nos campos layoutImage,
 * layoutPreviewImage, productThumbnail e layoutImages[]. Uma página A4 renderizada
 * em scale 2.0 gera um PNG de vários megabytes. O Firestore recusa qualquer
 * documento acima de 1 MiB, então a gravação da OP falhava — e o erro era engolido
 * pelo cliente, dando a impressão de que a OP tinha sido salva.
 *
 * Aqui cada imagem embutida é enviada ao Firebase Storage e substituída pela URL.
 * O documento cai de megabytes para poucos kilobytes.
 */

/** Limite real do Firestore é 1 MiB; usamos margem de segurança. */
const FIRESTORE_DOC_SAFE_LIMIT_BYTES = 900 * 1024;

const IMAGE_FIELDS = ['layoutImage', 'layoutPreviewImage', 'productThumbnail'] as const;

function isDataUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:');
}

function parseDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], buffer: Buffer.from(match[2], 'base64') };
}

function extensionFor(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('svg')) return 'svg';
  if (mimeType.includes('pdf')) return 'pdf';
  return 'jpg';
}

/**
 * Envia uma imagem embutida ao Storage e devolve a URL pública.
 * Devolve null se o Storage não estiver disponível — nesse caso o chamador decide.
 */
async function uploadDataUrl(dataUrl: string, opId: string, field: string): Promise<string | null> {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;

  try {
    const bucket = await getStorageBucket();
    const objectPath = `op-media/${opId}/${field}-${Date.now()}.${extensionFor(parsed.mimeType)}`;
    const file = bucket.file(objectPath);

    await file.save(parsed.buffer, {
      contentType: parsed.mimeType,
      resumable: false,
      metadata: { cacheControl: 'public, max-age=31536000' },
    });
    await file.makePublic();

    return `https://storage.googleapis.com/${bucket.name}/${objectPath}`;
  } catch (err: any) {
    console.error(`[opMedia] Falha ao enviar ${field} da OP ${opId} para o Storage:`, err?.message);
    return null;
  }
}

export interface SanitizeResult<T> {
  order: T;
  /** Campos que tiveram a imagem movida para o Storage. */
  movedFields: string[];
  /** Campos que precisaram ser descartados por não caberem no documento. */
  droppedFields: string[];
}

/**
 * Move toda imagem embutida (data:) da OP para o Firebase Storage,
 * substituindo o conteúdo pela URL pública.
 */
export async function sanitizeOrderMedia<T extends Record<string, any>>(
  order: T
): Promise<SanitizeResult<T>> {
  const opId = String(order?.id || 'sem-id');
  const sanitized: Record<string, any> = { ...order };
  const movedFields: string[] = [];
  const droppedFields: string[] = [];

  for (const field of IMAGE_FIELDS) {
    const value = sanitized[field];
    if (!isDataUrl(value)) continue;

    const url = await uploadDataUrl(value, opId, field);
    if (url) {
      sanitized[field] = url;
      movedFields.push(field);
    } else {
      delete sanitized[field];
      droppedFields.push(field);
    }
  }

  if (Array.isArray(sanitized.layoutImages)) {
    const images = [];
    for (let i = 0; i < sanitized.layoutImages.length; i++) {
      const img = sanitized.layoutImages[i];
      if (img && isDataUrl(img.urlOrBase64)) {
        const url = await uploadDataUrl(img.urlOrBase64, opId, `layoutImages-${i}`);
        if (url) {
          images.push({ ...img, urlOrBase64: url });
          movedFields.push(`layoutImages[${i}]`);
        } else {
          droppedFields.push(`layoutImages[${i}]`);
        }
      } else if (img) {
        images.push(img);
      }
    }
    sanitized.layoutImages = images;
  }

  return { order: sanitized as T, movedFields, droppedFields };
}

/**
 * Verifica se o documento cabe no Firestore. Lança erro EXPLÍCITO em vez de
 * deixar o SDK falhar com uma mensagem genérica.
 */
export function assertFitsFirestoreDocument(doc: unknown, label: string): void {
  const size = Buffer.byteLength(JSON.stringify(doc ?? {}), 'utf-8');
  if (size > FIRESTORE_DOC_SAFE_LIMIT_BYTES) {
    const kb = Math.round(size / 1024);
    throw new Error(
      `${label} tem ${kb} KB e excede o limite de 900 KB por documento do Firestore. ` +
        'Isso quase sempre significa que uma imagem ficou embutida na OP em vez de ser enviada ao Storage. ' +
        'Verifique se o Firebase Storage está ativo neste projeto.'
    );
  }
}
