/**
 * LoadedFile — leitura única e imediata de um arquivo escolhido pelo usuário.
 *
 * MOTIVO (correção de bug real):
 * O objeto `File` do navegador é apenas um ponteiro para um arquivo do disco/SO.
 * Se o arquivo for lido tempos depois da seleção (ou várias vezes), o ponteiro pode
 * já ter sido invalidado pelo sistema operacional — principalmente em celulares e em
 * arquivos vindos de provedores de nuvem. O navegador responde com:
 *
 *   NotFoundError: A requested file or directory could not be found
 *                  at the time an operation was processed.
 *
 * A solução é ler o arquivo UMA ÚNICA VEZ, no instante da seleção, e trabalhar
 * apenas com a cópia em memória daí em diante.
 */

export interface LoadedFile {
  name: string;
  type: string;
  size: number;
  /** Conteúdo bruto, lido uma única vez. */
  buffer: ArrayBuffer;
  /** data:<mime>;base64,<conteudo> — derivado do buffer, sem reler o arquivo. */
  dataUrl: string;
  /** Apenas a parte base64, sem o prefixo data:. */
  base64: string;
}

/** Converte um ArrayBuffer em base64 sem estourar a pilha em arquivos grandes. */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + CHUNK)) as unknown as number[]
    );
  }
  return btoa(binary);
}

function inferMimeType(file: File): string {
  if (file.type) return file.type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

/**
 * Lê o arquivo uma única vez e devolve todas as representações necessárias
 * (buffer, dataUrl e base64) já materializadas em memória.
 *
 * Deve ser chamada IMEDIATAMENTE após a seleção do arquivo pelo usuário.
 */
export async function loadFileOnce(file: File): Promise<LoadedFile> {
  if (!file) {
    throw new Error('Nenhum arquivo foi selecionado.');
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch (err: any) {
    const isNotFound =
      err?.name === 'NotFoundError' || /not be found/i.test(err?.message || '');
    throw new Error(
      isNotFound
        ? `O arquivo "${file.name}" não está mais acessível. Isso acontece quando o aparelho libera o arquivo antes da leitura. Selecione o arquivo novamente.`
        : `Não foi possível ler o arquivo "${file.name}": ${err?.message || 'erro desconhecido'}`
    );
  }

  if (!buffer || buffer.byteLength === 0) {
    throw new Error(`O arquivo "${file.name}" está vazio ou não pôde ser lido.`);
  }

  const mimeType = inferMimeType(file);
  const base64 = arrayBufferToBase64(buffer);

  return {
    name: file.name,
    type: mimeType,
    size: buffer.byteLength,
    buffer,
    base64,
    dataUrl: `data:${mimeType};base64,${base64}`,
  };
}

/** True quando o valor é uma imagem embutida (data:...) em vez de uma URL. */
export function isDataUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:');
}
