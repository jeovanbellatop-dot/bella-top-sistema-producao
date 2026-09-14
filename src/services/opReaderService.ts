import { ExtractedOpData } from '../types/mes';
import { processDocumentFile } from '../utils/pdfRenderer';
import { cropImageFromCoords, getDefaultLayoutCropBox, CropBox } from '../utils/imageCropper';

export interface ParseOpResponse {
  success: boolean;
  source: string;
  data: ExtractedOpData;
  error?: string;
}

export interface ParseOpFilesParams {
  opFile: File;
  layoutFile: File;
}

/**
 * Realiza o processamento completo e real dos dois arquivos obrigatórios da OP:
 * 1) PDF da OP: extrai o texto de todas as páginas e renderiza a visualização.
 * 2) PDF/Imagem do Layout: renderiza em alta definição e recorta a foto oficial da sacola.
 */
export async function parseOpFiles({
  opFile,
  layoutFile,
}: ParseOpFilesParams): Promise<ExtractedOpData> {
  try {
    console.log('[opReaderService] Processando arquivos locais (OP e Layout)...');

    // 1. Processar e renderizar ambos os documentos para extração de texto e imagem real
    const [opProcessed, layoutProcessed] = await Promise.all([
      processDocumentFile(opFile),
      processDocumentFile(layoutFile),
    ]);

    // 2. Montar os payloads com o base64 original, imagem PNG renderizada e o texto extraído
    const opDoc = {
      base64: await fileToBase64(opFile),
      mimeType: opFile.type || 'application/pdf',
      fileName: opFile.name,
      textContent: opProcessed.textContent,
      previewImage: opProcessed.dataUrl,
      type: 'op_document',
    };

    const layoutDoc = {
      base64: await fileToBase64(layoutFile),
      mimeType: layoutFile.type || (layoutFile.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
      fileName: layoutFile.name,
      textContent: layoutProcessed.textContent,
      previewImage: layoutProcessed.dataUrl,
      type: 'layout_document',
    };

    const payload = {
      opDocument: opDoc,
      layoutDocument: layoutDoc,
      textContent: opProcessed.textContent,
      documents: [opDoc, layoutDoc],
      fileName: `${opFile.name} + ${layoutFile.name}`,
    };

    console.log('[opReaderService] Enviando documentos para análise estruturada no backend...');
    const response = await fetch('/api/op/parse-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Erro no servidor HTTP (${response.status}): Falha na leitura dos documentos.`);
    }

    const result: ParseOpResponse = await response.json();

    if (result.success && result.data) {
      const data = result.data;
      data.opFileName = opFile.name;
      data.op_file = opFile.name;
      data.layoutFileName = layoutFile.name;
      data.layout_file = layoutFile.name;
      data.layoutStatus = 'COMPLETO';
      data.layout_status = 'COMPLETO';

      // 3. Garantir que a prévia do layout completo utiliza a imagem real renderizada (PNG)
      data.layoutPreviewImage = layoutProcessed.dataUrl;
      data.layoutImage = layoutProcessed.dataUrl;

      // 4. Localizar e recortar a foto principal da sacola a partir do Layout aprovado
      let targetCrop: CropBox;
      if (data.layoutCropBox) {
        targetCrop = data.layoutCropBox;
      } else if (data.structured?.op?.crop_box) {
        const box = data.structured.op.crop_box;
        targetCrop = {
          x: Math.max(0, Math.min(100, box.xmin / 10)),
          y: Math.max(0, Math.min(100, box.ymin / 10)),
          width: Math.max(10, Math.min(100, (box.xmax - box.xmin) / 10)),
          height: Math.max(10, Math.min(100, (box.ymax - box.ymin) / 10)),
        };
        data.layoutCropBox = targetCrop;
      } else {
        targetCrop = getDefaultLayoutCropBox();
        data.layoutCropBox = targetCrop;
      }

      try {
        console.log('[opReaderService] Recortando foto principal da sacola do layout...');
        const croppedThumbnail = await cropImageFromCoords(layoutProcessed.dataUrl, targetCrop, 400, 400);
        data.productThumbnail = croppedThumbnail;
        data.productThumbnailStatus = 'available';
      } catch (cropErr) {
        console.warn('[opReaderService] Falha no recorte automático da sacola, usando layout completo:', cropErr);
        data.productThumbnail = layoutProcessed.dataUrl;
        data.productThumbnailStatus = 'available';
      }

      return data;
    }

    throw new Error(result.error || 'Não foi possível extrair os dados da OP dos arquivos enviados.');
  } catch (error: any) {
    console.error('[opReaderService] Falha crítica no processamento da OP e Layout:', error);
    throw error;
  }
}

export async function parseOpDocument(
  fileOrText: File | File[] | string,
  sampleName?: string
): Promise<ExtractedOpData> {
  try {
    let payload: any = {};
    if (typeof fileOrText === 'string') {
      payload = { textContent: fileOrText, fileName: sampleName || 'Documento_OP.txt' };
    } else {
      const files = Array.isArray(fileOrText) ? fileOrText : [fileOrText];
      const documents = await Promise.all(
        files.map(async (file) => {
          const processed = await processDocumentFile(file);
          return {
            base64: await fileToBase64(file),
            mimeType: file.type || 'application/pdf',
            fileName: file.name,
            textContent: processed.textContent,
            previewImage: processed.dataUrl,
          };
        })
      );
      payload = {
        documents,
        textContent: documents.map((d) => d.textContent).filter(Boolean).join('\n\n'),
        fileName: documents.map((document) => document.fileName).join(' + '),
      };
    }

    const response = await fetch('/api/op/parse-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Erro no servidor HTTP: ' + response.status);
    const result: ParseOpResponse = await response.json();
    if (result.success && result.data) return result.data;
    throw new Error(result.error || 'Não foi possível extrair os dados da OP');
  } catch (error: any) {
    console.error('Falha no leitor de OP:', error);
    throw error;
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
