import * as pdfjsLib from 'pdfjs-dist';
// O worker é resolvido pelo Vite em tempo de build (?url). Isso funciona tanto no
// servidor de desenvolvimento quanto no app publicado.
// ANTES: o caminho '/node_modules/pdfjs-dist/...' só existe em desenvolvimento e
// resultava em 404 no app publicado, derrubando toda a leitura de PDF.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { LoadedFile } from './loadedFile';

if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

/** Entrada aceita pelo renderizador: arquivo já lido em memória ou buffer bruto. */
export type DocumentInput = LoadedFile | ArrayBuffer;

function inputName(input: DocumentInput): string {
  return input instanceof ArrayBuffer ? 'documento' : input.name;
}

function inputBuffer(input: DocumentInput): ArrayBuffer {
  return input instanceof ArrayBuffer ? input : input.buffer;
}

function inputIsPdf(input: DocumentInput): boolean {
  if (input instanceof ArrayBuffer) return true;
  return input.type === 'application/pdf' || input.name.toLowerCase().endsWith('.pdf');
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
export async function processDocumentFile(input: DocumentInput): Promise<RenderedPdfResult> {
  if (!input) {
    throw new Error('Nenhum arquivo foi selecionado ou fornecido para processamento.');
  }

  try {
    if (inputIsPdf(input)) {
      return await renderPdfToImageAndText(input);
    }
    return await processImageFile(input as LoadedFile);
  } catch (err: any) {
    console.error('[pdfRenderer] Erro ao processar documento:', err);
    throw new Error(
      `Não foi possível abrir o arquivo "${inputName(input)}": ${err?.message || 'Formato incompatível ou arquivo corrompido'}`
    );
  }
}

/**
 * Renderiza a primeira página do PDF para Canvas e exporta como PNG de alta resolução,
 * extraindo também todo o texto de todas as páginas do PDF.
 */
export async function renderPdfToImageAndText(input: DocumentInput): Promise<RenderedPdfResult> {
  // O buffer já foi lido uma única vez na seleção do arquivo (ver loadFileOnce).
  // Copiamos o buffer porque o pdf.js assume a posse do Uint8Array que recebe,
  // e o mesmo LoadedFile ainda será usado para upload e envio ao backend.
  const arrayBuffer = inputBuffer(input).slice(0);

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useWorkerFetch: false,
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

    // PNG não usa parâmetro de qualidade; mantido sem o segundo argumento para não iludir.
    const dataUrl = canvas.toDataURL('image/png');
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
    throw new Error(`Falha na conversão do PDF (${inputName(input)}): ${err?.message || 'Arquivo corrompido ou formato incompatível'}`);
  }
}

/**
 * Processa arquivos de imagem direta (PNG, JPEG, WEBP)
 */
export async function processImageFile(loaded: LoadedFile): Promise<RenderedPdfResult> {
  // Nenhuma releitura do arquivo aqui: o dataUrl já veio pronto de loadFileOnce().
  const dataUrl = loaded.dataUrl;
  const rawBase64 = loaded.base64;

  return new Promise((resolve, reject) => {
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
      reject(new Error(`Imagem inválida ou corrompida: ${loaded.name}`));
    };
    img.src = dataUrl;
  });
}
