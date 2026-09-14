import * as pdfjsLib from 'pdfjs-dist';

// Configuração local do worker do pdfjs para rodar em build de produção sem CDN externa
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).href;
  } catch {
    // Fallback em caso de restrição de import.meta.url
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.min.mjs';
  }
}

export interface RenderedPdfResult {
  dataUrl: string; // Base64 data:image/png;base64,...
  rawBase64: string;
  width: number;
  height: number;
  numPages: number;
  textContent: string;
}

/**
 * Lê e converte um arquivo PDF ou Imagem em imagem de visualização de alta resolução (PNG)
 * e extrai o texto contido em todas as páginas do PDF.
 */
export async function processDocumentFile(file: File): Promise<RenderedPdfResult> {
  if (!file) {
    throw new Error('Nenhum arquivo foi selecionado ou fornecido para processamento.');
  }

  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  try {
    if (isPdf) {
      return await renderPdfToImageAndText(file);
    } else {
      return await processImageFile(file);
    }
  } catch (err: any) {
    console.error('[pdfRenderer] Erro ao processar documento:', err);
    throw new Error(
      `Não foi possível abrir o arquivo "${file.name}": ${err?.message || 'Formato incompatível ou arquivo corrompido'}`
    );
  }
}

/**
 * Renderiza a primeira página do PDF para Canvas e exporta como PNG de alta resolução,
 * extraindo também todo o texto de todas as páginas do PDF.
 */
export async function renderPdfToImageAndText(file: File | ArrayBuffer): Promise<RenderedPdfResult> {
  const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useWorkerFetch: true,
    });

    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;

    // 1. Extrair todo o texto de todas as páginas
    const textPieces: string[] = [];
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str || '')
          .join(' ')
          .trim();
        if (pageText) {
          textPieces.push(`--- PÁGINA ${pageNum} ---\n${pageText}`);
        }
      } catch (err) {
        console.warn(`[pdfRenderer] Falha ao extrair texto da página ${pageNum}:`, err);
      }
    }
    const fullText = textPieces.join('\n\n');

    // 2. Renderizar a primeira página para imagem PNG de alta definição (scale 2.0)
    const firstPage = await pdfDoc.getPage(1);
    const viewport = firstPage.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    if (!context) {
      throw new Error('Não foi possível obter contexto 2D do Canvas.');
    }

    // Fundo branco sólido antes de desenhar a página
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvas.width, canvas.height);

    const renderContext: any = {
      canvasContext: context,
      viewport: viewport,
      canvas: canvas,
    };

    await firstPage.render(renderContext).promise;

    const dataUrl = canvas.toDataURL('image/png', 0.95);
    const rawBase64 = dataUrl.split(',')[1] || '';

    return {
      dataUrl,
      rawBase64,
      width: viewport.width,
      height: viewport.height,
      numPages,
      textContent: fullText,
    };
  } catch (err: any) {
    console.error('[pdfRenderer] Erro ao renderizar PDF:', err);
    throw new Error(`Falha na conversão do PDF (${file instanceof File ? file.name : 'documento'}): ${err?.message || 'Arquivo corrompido ou formato incompatível'}`);
  }
}

/**
 * Processa arquivos de imagem direta (PNG, JPEG, WEBP)
 */
export async function processImageFile(file: File): Promise<RenderedPdfResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const rawBase64 = dataUrl.split(',')[1] || '';

      const img = new Image();
      img.onload = () => {
        resolve({
          dataUrl,
          rawBase64,
          width: img.width,
          height: img.height,
          numPages: 1,
          textContent: '',
        });
      };
      img.onerror = () => {
        reject(new Error(`Imagem inválida ou corrompida: ${file.name}`));
      };
      img.src = dataUrl;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
