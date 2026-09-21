import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { getStorageBucket } from '../firebaseAdmin';

export const storageRoutes = Router();

interface UploadBody {
  fileName?: string;
  mimeType?: string;
  dataUrl?: string;
  folder?: string;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
}

function parseDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new Error('Formato de dataUrl invalido. Esperado data:<mime>;base64,<conteudo>.');
  }
  const mimeType = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  return { mimeType, buffer };
}

// Upload de arquivo (PDF de OP, Layout, etc) para o Firebase Storage.
// Recebe { fileName, mimeType, dataUrl, folder } e retorna a URL publica do arquivo salvo.
storageRoutes.post('/upload', async (req: Request, res: Response) => {
  try {
    const body = req.body as UploadBody;
    if (!body || !body.dataUrl) {
      return res.status(400).json({ success: false, error: 'Campo dataUrl e obrigatorio.' });
    }

    const { mimeType: parsedMime, buffer } = parseDataUrl(body.dataUrl);
    const mimeType = body.mimeType || parsedMime || 'application/octet-stream';

    const maxBytes = 10 * 1024 * 1024; // 10MB de seguranca
    if (buffer.length > maxBytes) {
      return res.status(413).json({ success: false, error: 'Arquivo excede o limite de 10MB.' });
    }

    const folder = body.folder ? sanitizeFileName(body.folder) : 'uploads';
    const originalName = body.fileName ? sanitizeFileName(body.fileName) : 'arquivo';
    const objectPath = folder + '/' + Date.now() + '-' + randomUUID().slice(0, 8) + '-' + originalName;

    const bucket = await getStorageBucket();
    const file = bucket.file(objectPath);

    await file.save(buffer, {
      metadata: { contentType: mimeType },
      resumable: false,
    });

    await file.makePublic();

    const publicUrl = 'https://storage.googleapis.com/' + bucket.name + '/' + objectPath;

    return res.status(201).json({
      success: true,
      data: {
        url: publicUrl,
        path: objectPath,
        mimeType,
        size: buffer.length,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Falha ao enviar arquivo.' });
  }
});
