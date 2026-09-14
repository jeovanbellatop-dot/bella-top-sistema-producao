export interface ProcessedImage {
  id: string;
  type:
    | 'foto_produto'
    | 'layout_aprovado'
    | 'arte_frente'
    | 'arte_verso'
    | 'desenho_tecnico'
    | 'referencia'
    | 'documento_geral';
  label: string;
  urlOrBase64: string;
  mimeType: string;
  assignedStages: string[]; // ['FLEXOGRAFIA', 'CORTE', 'ALCA', 'EXPEDICAO']
  isPrimaryLayout: boolean;
}

export class ImageService {
  /**
   * Classifica e associa as imagens extraídas da OP aos setores fabris pertinentes.
   */
  public static mapImagesToStages(
    images: Array<{
      id?: string;
      type?: string;
      label?: string;
      base64?: string;
      mimeType?: string;
      fileName?: string;
    }>,
    opData: {
      hasWindow?: boolean;
      hasCord?: boolean;
      handleType?: string;
      printingMethod?: string;
    }
  ): ProcessedImage[] {
    if (!images || images.length === 0) {
      return [];
    }

    return images.map((img, idx) => {
      const type = (img.type || 'layout_aprovado') as ProcessedImage['type'];
      const stages: string[] = [];

      switch (type) {
        case 'arte_frente':
        case 'arte_verso':
          stages.push('FLEXOGRAFIA', 'ESTAMPARIA');
          break;
        case 'desenho_tecnico':
          stages.push('REFILE', 'CORTE');
          break;
        case 'foto_produto':
          stages.push('CORTE', 'ALCA', 'EXPEDICAO');
          break;
        case 'layout_aprovado':
        default:
          stages.push('REFILE', 'FLEXOGRAFIA', 'ESTAMPARIA', 'CORTE', 'ALCA', 'EXPEDICAO');
          break;
      }

      return {
        id: img.id || `img_${idx}_${Date.now()}`,
        type,
        label: img.label || img.fileName || `Imagem de Produção #${idx + 1}`,
        urlOrBase64: img.base64 || '',
        mimeType: img.mimeType || 'image/png',
        assignedStages: stages,
        isPrimaryLayout: type === 'layout_aprovado',
      };
    });
  }
}
