/**
 * imageCropper.ts
 * Utilitários para extração, recorte inteligente e manipulação da foto principal do produto
 * a partir do layout oficial da Ordem de Produção (OP) Bella Top.
 */

export interface CropBox {
  x: number; // Porcentagem horizontal (0 a 100)
  y: number; // Porcentagem vertical (0 a 100)
  width: number; // Largura em porcentagem (0 a 100)
  height: number; // Altura em porcentagem (0 a 100)
}

/**
 * Recorta uma região específica de uma imagem (base64 ou URL) usando um canvas HTML5.
 * Retorna uma string base64 WebP/PNG otimizada e leve.
 */
export async function cropImageFromCoords(
  imageSrc: string,
  crop: CropBox,
  targetMaxWidth = 400,
  targetMaxHeight = 400
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!imageSrc) {
      return reject(new Error('Fonte de imagem vazia'));
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const naturalWidth = img.naturalWidth || img.width;
        const naturalHeight = img.naturalHeight || img.height;

        // Converter porcentagens (0-100) em coordenadas de pixel reais
        const sourceX = Math.max(0, Math.floor((crop.x / 100) * naturalWidth));
        const sourceY = Math.max(0, Math.floor((crop.y / 100) * naturalHeight));
        const sourceWidth = Math.min(
          naturalWidth - sourceX,
          Math.floor((crop.width / 100) * naturalWidth)
        );
        const sourceHeight = Math.min(
          naturalHeight - sourceY,
          Math.floor((crop.height / 100) * naturalHeight)
        );

        if (sourceWidth <= 0 || sourceHeight <= 0) {
          return resolve(imageSrc); // Fallback para a imagem inteira se o recorte for inválido
        }

        // Determinar dimensões do canvas preservando proporção
        let outWidth = sourceWidth;
        let outHeight = sourceHeight;

        if (outWidth > targetMaxWidth || outHeight > targetMaxHeight) {
          const ratio = Math.min(targetMaxWidth / outWidth, targetMaxHeight / outHeight);
          outWidth = Math.round(outWidth * ratio);
          outHeight = Math.round(outHeight * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, outWidth);
        canvas.height = Math.max(1, outHeight);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(imageSrc);
        }

        // Fundo neutro limpo
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Desenhar recorte
        ctx.drawImage(
          img,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight,
          0,
          0,
          canvas.width,
          canvas.height
        );

        // Exportar em PNG/JPEG otimizado
        const resultBase64 = canvas.toDataURL('image/jpeg', 0.9);
        resolve(resultBase64);
      } catch (err) {
        console.error('Erro ao recortar imagem:', err);
        resolve(imageSrc);
      }
    };

    img.onerror = (err) => {
      console.error('Erro ao carregar imagem para recorte:', err);
      resolve(imageSrc);
    };

    img.src = imageSrc;
  });
}

/**
 * Heurística para estimar a área do produto central no layout Bella Top padrão
 * (geralmente centrado ou levemente à esquerda com margens técnicas).
 */
export function getDefaultLayoutCropBox(): CropBox {
  return {
    x: 18,
    y: 18,
    width: 64,
    height: 60,
  };
}

/**
 * Cria uma representação SVG oficial para sacolas / sacos caso o layout original seja gerado em lote
 */
export function createBellaTopBagSvg(params: {
  productName: string;
  client: string;
  colorName?: string;
  handleType?: string;
  hasVisor?: boolean;
}): string {
  const isVazada = params.handleType === 'VAZADA' || (params.productName || '').toLowerCase().includes('vazada');
  const isVisor = params.hasVisor || (params.productName || '').toLowerCase().includes('visor');
  const isCordao = (params.productName || '').toLowerCase().includes('cord') || (params.productName || '').toLowerCase().includes('mochil');
  
  const clientName = (params.client || 'BELLA TOP').toUpperCase();
  const prodName = params.productName || 'SACOLA TNT';

  // Gerar SVG da sacola
  const svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 380" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FAF5F1" />
      <stop offset="100%" stop-color="#F2EBE6" />
    </linearGradient>
    <linearGradient id="bagGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#24191F" />
      <stop offset="100%" stop-color="#140E12" />
    </linearGradient>
    <linearGradient id="pinkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#E30A78" />
      <stop offset="100%" stop-color="#B30A5C" />
    </linearGradient>
    <filter id="shadow" x="-8%" y="-8%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000000" flood-opacity="0.15" />
    </filter>
  </defs>

  <!-- Fundo Neutro do Quadro -->
  <rect width="320" height="380" fill="url(#bgGrad)" rx="16" />

  <!-- Corpo Principal da Sacola / Saco -->
  <g filter="url(#shadow)">
    <!-- Corpo da Sacola TNT -->
    <rect x="55" y="75" width="210" height="250" rx="10" fill="url(#bagGrad)" stroke="#E30A78" stroke-width="2.5" />
    
    <!-- Sanfona lateral sutil -->
    <path d="M 55 75 L 70 85 L 70 315 L 55 325 Z" fill="#000000" opacity="0.35" />
    <path d="M 265 75 L 250 85 L 250 315 L 265 325 Z" fill="#000000" opacity="0.35" />
    
    <!-- Textura TNT sutil (pontilhado) -->
    <line x1="55" y1="80" x2="265" y2="80" stroke="#E30A78" stroke-width="1" stroke-dasharray="3 3" opacity="0.6" />
    <line x1="55" y1="320" x2="265" y2="320" stroke="#E30A78" stroke-width="1" stroke-dasharray="3 3" opacity="0.6" />

    ${
      isVazada
        ? `
        <!-- Alça Vazada (Boca de Palhaço) -->
        <rect x="120" y="100" width="80" height="24" rx="12" fill="#FAF5F1" stroke="#3A3034" stroke-width="2" />
        `
        : isCordao
        ? `
        <!-- Cordão Superior -->
        <path d="M 90 75 C 90 35, 230 35, 230 75" fill="none" stroke="#FAF5F1" stroke-width="6" stroke-linecap="round" />
        <path d="M 90 75 C 90 40, 230 40, 230 75" fill="none" stroke="#E30A78" stroke-width="2" stroke-dasharray="4 2" />
        `
        : `
        <!-- Alça Fita 40 Superior -->
        <path d="M 105 75 C 105 25, 215 25, 215 75" fill="none" stroke="#E30A78" stroke-width="12" stroke-linecap="round" />
        <path d="M 105 75 C 105 25, 215 25, 215 75" fill="none" stroke="#B30A5C" stroke-width="8" stroke-linecap="round" />
        `
    }

    ${
      isVisor
        ? `
        <!-- Visor Cristal Transparente -->
        <rect x="90" y="150" width="140" height="110" rx="8" fill="#FFFFFF" fill-opacity="0.18" stroke="#FFFFFF" stroke-width="1.5" stroke-dasharray="4 2" />
        <text x="160" y="210" fill="#FFFFFF" font-size="11" font-family="sans-serif" font-weight="bold" text-anchor="middle" letter-spacing="1">VISOR CRISTAL</text>
        `
        : `
        <!-- Estampa / Logotipo Centralizado na Sacola -->
        <rect x="90" y="155" width="140" height="95" rx="8" fill="#FAF5F1" fill-opacity="0.08" stroke="#E30A78" stroke-width="1" stroke-dasharray="2 2" />
        <circle cx="160" cy="188" r="18" fill="url(#pinkGrad)" />
        <text x="160" y="193" fill="#FFFFFF" font-size="14" font-family="sans-serif" font-weight="900" text-anchor="middle">BT</text>
        <text x="160" y="222" fill="#FAF5F1" font-size="12" font-family="sans-serif" font-weight="800" text-anchor="middle" letter-spacing="1.5">${clientName.slice(0, 16)}</text>
        <text x="160" y="238" fill="#F5C6DC" font-size="9" font-family="sans-serif" font-weight="600" text-anchor="middle">${prodName.slice(0, 20)}</text>
        `
    }

    <!-- Tag de Acabamento Ultrassônico -->
    <rect x="70" y="295" width="180" height="18" rx="4" fill="#1C1418" />
    <text x="160" y="307" fill="#F5C6DC" font-size="8.5" font-family="sans-serif" font-weight="bold" text-anchor="middle" letter-spacing="0.8">BELLA TOP • EMBALAGEM OFICIAL</text>
  </g>
</svg>
`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
}
