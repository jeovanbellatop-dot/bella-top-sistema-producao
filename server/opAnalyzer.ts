import { getGeminiClient } from "./geminiClient";
import { getOpenAIClient, getOpenAIModel } from "./openaiClient";
import { BELLA_TOP_PRODUCTION_MEMORY } from "./memory";
import { RoutingEngine, SuggestedStep } from "./routingEngine";
import { ImageService, ProcessedImage } from "./imageService";
import { ServerAuditService } from "./auditService";

export interface ExtractedField<T = any> {
  value: T;
  confidence: number; // 0.0 to 1.0
  reason?: string;
}

export interface StructuredOpOutput {
  op: {
    op_number: string;
    customer: string;
    product: string;
    model: string;
    material: string;
    gsm: number;
    material_color: string;
    width: number;
    height: number;
    bottom: number;
    size: string;
    quantity: number;
    handle_type: 'VAZADA' | 'FITA' | 'CORDAO' | 'NENHUMA' | 'NAO_IDENTIFICADO';
    has_window: boolean;
    has_cord: boolean;
  /** Cordao aplicado pela maquina (AUTOMATICO) ou em posto manual (MANUAL). */
  cord_mode: 'AUTOMATICO' | 'MANUAL' | 'NENHUM' | 'NAO_IDENTIFICADO';
  /** Tipo de produto identificado na OP, para escolha do roteiro. */
  product_type: string;
  /** true quando a OP exige costura (Sacola Box). */
  requires_sewing: boolean;
  /** true quando a fabricacao inicial e terceirizada (Saquinho de Algodao). */
  outsourced: boolean;
    printing_method: 'FLEXOGRAFIA' | 'SERIGRAFIA' | 'ESTAMPARIA' | 'SEM_IMPRESSAO' | 'NAO_IDENTIFICADO';
    printing_colors: number;
    print_front: string;
    print_back: string;
    finishing: string[];
    deadline: string;
    priority: 'VERDE' | 'AMARELO' | 'VERMELHO';
    notes: string;
    approved_layout?: string;
    product_images?: string[];
    reference_images?: string[];
    crop_box?: {
      ymin: number;
      xmin: number;
      ymax: number;
      xmax: number;
    };
  };
  extracted_data: {
    op_number: ExtractedField<string>;
    customer: ExtractedField<string>;
    product: ExtractedField<string>;
    model: ExtractedField<string>;
    material: ExtractedField<string>;
    gsm: ExtractedField<number>;
    material_color: ExtractedField<string>;
    width: ExtractedField<number>;
    height: ExtractedField<number>;
    bottom: ExtractedField<number>;
    size: ExtractedField<string>;
    quantity: ExtractedField<number>;
    handle_type: ExtractedField<string>;
    has_window: ExtractedField<boolean>;
    has_cord: ExtractedField<boolean>;
  cord_mode: ExtractedField<string>;
  product_type: ExtractedField<string>;
    printing_method: ExtractedField<string>;
    printing_colors: ExtractedField<number>;
    deadline: ExtractedField<string>;
  };
  images: ProcessedImage[];
  missing_information: string[];
  warnings: string[];
  needs_pcp_validation: boolean;
  suggested_route: SuggestedStep[];
  machine_candidates: any[];
  routing_explanation: string[];
  ai_engine_info: {
    model: string;
    provider: 'gemini' | 'openai' | 'deterministic_engine';
    timestamp: string;
  };
}

export class OpAnalyzer {
  public static async analyzeDocument(params: {
    textContent?: string;
    fileName?: string;
    opDocument?: { base64: string; mimeType: string; fileName: string; textContent?: string };
    layoutDocument?: { base64: string; mimeType: string; fileName: string; previewImage?: string };
    documents?: Array<{ base64: string; mimeType: string; fileName: string; type?: string }>;
  }): Promise<StructuredOpOutput> {
    const docs = params.documents || [];
    const opDoc = params.opDocument || docs.find((d) => d.type === 'op_document') || docs[0];
    const layoutDoc = params.layoutDocument || docs.find((d) => d.type === 'layout_document') || docs[1];

    const rawTextCombined = [
      params.textContent || '',
      opDoc && (opDoc as any).textContent ? (opDoc as any).textContent : '',
      params.fileName || '',
    ]
      .filter(Boolean)
      .join('\n\n');

    // 1. Tentar processamento via Google Gemini API (@google/genai)
    const gemini = getGeminiClient();
    if (gemini) {
      try {
        console.log('[OpAnalyzer] Iniciando análise multimodal via Google Gemini API...');
        const contents: any[] = [];

        // Adicionar documento da OP
        if (opDoc?.base64) {
          contents.push({
            inlineData: {
              data: opDoc.base64,
              mimeType: opDoc.mimeType || 'application/pdf',
            },
          });
        }

        // Adicionar documento do Layout (preferir imagem rasterizada se disponível)
        if (layoutDoc) {
          const layoutBase64 = (layoutDoc as any).previewImage
            ? (layoutDoc as any).previewImage.includes(',')
              ? (layoutDoc as any).previewImage.split(',')[1]
              : (layoutDoc as any).previewImage
            : layoutDoc.base64;
          const layoutMime = (layoutDoc as any).previewImage ? 'image/png' : layoutDoc.mimeType || 'application/pdf';

          if (layoutBase64) {
            contents.push({
              inlineData: {
                data: layoutBase64,
                mimeType: layoutMime,
              },
            });
          }
        }

        const promptText = `
${BELLA_TOP_PRODUCTION_MEMORY}

Você é o analisador oficial de Ordens de Produção da Bella Top Embalagens Personalizadas.
Analise com extrema precisão os documentos anexados:
1) ORDEM DE PRODUÇÃO: ${opDoc?.fileName || 'OP em PDF'}
2) LAYOUT APROVADO: ${layoutDoc?.fileName || 'Layout Técnico'}

${rawTextCombined ? `TEXTO EXTRAÍDO DA OP:\n${rawTextCombined}\n` : ''}

REGRAS OBRIGATÓRIAS:
- Extraia os dados reais contidos nos documentos.
- NUNCA invente números, clientes, dimensões ou processos que não estejam nos documentos.
- Se algum campo não puder ser lido com certeza absoluta, retorne valor null ou "Não identificado", com confiança < 0.60 e marque "needs_pcp_validation": true.
- Identifique no Layout a área onde está localizada a foto principal da sacola ou saco (sem textos, cotas ou anotações técnicas ao redor). Retorne as coordenadas normalizadas em "crop_box": { "ymin": 0-1000, "xmin": 0-1000, "ymax": 0-1000, "xmax": 0-1000 }.

Retorne ESTRITAMENTE em formato JSON com o seguinte schema:
{
  "op": {
    "op_number": "string (ex: 21582)",
    "customer": "string (nome real do cliente)",
    "product": "string (nome real do produto)",
    "model": "string (ex: Alça Vazada Sem Visor, Sacola Alça Fita, Saco com Visor, Mochilinha)",
    "material": "string (ex: TNT 100% Polipropileno)",
    "gsm": 60,
    "material_color": "string (ex: Preto, Branco, etc)",
    "width": 400,
    "height": 450,
    "bottom": 0,
    "size": "P" | "M" | "G" | "GG" | "8x12" | "Personalizado",
    "product_type": "SACOLA_ALCA_FITA" | "SACOLA_ALCA_VAZADA" | "SACO_TNT" | "MOCHILINHA" | "SACOLA_PRESENTE" | "SACO_PRESENTE" | "SACOLA_BOX" | "ECOBAG_ALGODAO" | "LIXO_CAR" | "SAQUINHO_ALGODAO" | "NAO_IDENTIFICADO",
    "cord_mode": "AUTOMATICO" | "MANUAL" | "NENHUM" | "NAO_IDENTIFICADO",
    "requires_sewing": false,
    "outsourced": false,
    "quantity": 10000,
    "handle_type": "VAZADA" | "FITA" | "CORDAO" | "NENHUMA",
    "has_window": false,
    "has_cord": false,
    "printing_method": "FLEXOGRAFIA" | "SERIGRAFIA" | "ESTAMPARIA" | "SEM_IMPRESSAO" | "NAO_IDENTIFICADO",
    "printing_colors": 1,
    "print_front": "string",
    "print_back": "string",
    "finishing": ["string"],
    "deadline": "ISO date string",
    "priority": "VERDE" | "AMARELO" | "VERMELHO",
    "notes": "string",
    "crop_box": {
      "ymin": 150,
      "xmin": 150,
      "ymax": 850,
      "xmax": 850
    }
  },
  "extracted_data": {
    "op_number": { "value": "21582", "confidence": 0.98 },
    "customer": { "value": "Cliente", "confidence": 0.95 },
    "product": { "value": "Sacola...", "confidence": 0.95 },
    "model": { "value": "...", "confidence": 0.90 },
    "material": { "value": "...", "confidence": 0.95 },
    "gsm": { "value": 60, "confidence": 0.95 },
    "material_color": { "value": "...", "confidence": 0.90 },
    "width": { "value": 400, "confidence": 0.95 },
    "height": { "value": 450, "confidence": 0.95 },
    "bottom": { "value": 0, "confidence": 0.90 },
    "size": { "value": "G", "confidence": 0.90 },
    "product_type": { "value": "SACOLA_ALCA_FITA", "confidence": 0.90 },
    "cord_mode": { "value": "NENHUM", "confidence": 0.90 },
    "quantity": { "value": 10000, "confidence": 0.98 },
    "handle_type": { "value": "VAZADA", "confidence": 0.95 },
    "has_window": { "value": false, "confidence": 0.98 },
    "has_cord": { "value": false, "confidence": 0.98 },
    "printing_method": { "value": "FLEXOGRAFIA", "confidence": 0.95 },
    "printing_colors": { "value": 1, "confidence": 0.90 },
    "deadline": { "value": "...", "confidence": 0.85 }
  },
  "missing_information": [],
  "warnings": [],
  "needs_pcp_validation": false
}
`;
        contents.push({ text: promptText });

        const response = await gemini.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: { parts: contents },
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        });

        const rawJson = response.text;
        if (rawJson) {
          const parsed = JSON.parse(rawJson);
          return OpAnalyzer.buildStructuredOutput(parsed, docs, 'gemini', 'gemini-3.6-flash');
        }
      } catch (err: any) {
        console.warn('[OpAnalyzer] Erro no Gemini API:', err?.message || err);
      }
    }

    // 2. Tentar OpenAI se configurada
    const openai = getOpenAIClient();
    if (openai) {
      try {
        console.log('[OpAnalyzer] Executando análise via OpenAI...');
        const model = getOpenAIModel();
        const contentParts: any[] = [];
        contentParts.push({
          type: 'text',
          text: `Analise a OP e Layout da Bella Top. Retorne JSON estruturado.\n${rawTextCombined}`,
        });

        for (const doc of docs) {
          if (doc.base64 && doc.mimeType?.startsWith('image/')) {
            contentParts.push({
              type: 'image_url',
              image_url: { url: `data:${doc.mimeType};base64,${doc.base64}`, detail: 'high' },
            });
          }
        }

        const response = await openai.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: BELLA_TOP_PRODUCTION_MEMORY },
            { role: 'user', content: contentParts },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        });

        const rawJson = response.choices[0]?.message?.content;
        if (rawJson) {
          const parsed = JSON.parse(rawJson);
          return OpAnalyzer.buildStructuredOutput(parsed, docs, 'openai', model);
        }
      } catch (err: any) {
        console.warn('[OpAnalyzer] Erro na OpenAI:', err?.message || err);
      }
    }

    // 3. Parser determinístico com base estrita no texto real extraído do documento
    console.log('[OpAnalyzer] Executando parser determinístico sobre o texto real do documento...');
    return OpAnalyzer.runDeterministicFallback(rawTextCombined, docs);
  }

  private static buildStructuredOutput(
    parsed: any,
    docs: Array<{ base64: string; mimeType: string; fileName: string; type?: string }>,
    provider: 'gemini' | 'openai',
    modelName: string
  ): StructuredOpOutput {
    const op = parsed.op || {};

    const opNumber = op.op_number ? String(op.op_number).trim() : 'Não identificado';
    const customer = op.customer ? String(op.customer).trim() : 'Não identificado';
    const product = op.product ? String(op.product).trim() : 'Não identificado';
    const model = op.model ? String(op.model).trim() : 'Não identificado';
    const material = op.material ? String(op.material).trim() : 'Não identificado';
    const gsm = Number(op.gsm) || 0;
    const width = Number(op.width) || 0;
    const height = Number(op.height) || 0;
    const bottom = Number(op.bottom) || 0;
    const quantity = Number(op.quantity) || 0;
    const handleType = (op.handle_type || 'NAO_IDENTIFICADO') as any;
    const hasWindow = Boolean(op.has_window);
    const hasCord = Boolean(op.has_cord);
    const printingMethod = (op.printing_method || 'NAO_IDENTIFICADO') as any;
    const printingColors = Number(op.printing_colors) || (printingMethod === 'SEM_IMPRESSAO' ? 0 : 1);

    const isMissingCrucialData =
      opNumber === 'Não identificado' ||
      customer === 'Não identificado' ||
      product === 'Não identificado' ||
      quantity <= 0 ||
      width <= 0 ||
      height <= 0 ||
      material === 'Não identificado' ||
      gsm <= 0;

    const routeResult = RoutingEngine.computeRoute({
      opNumber: opNumber !== 'Não identificado' ? opNumber : 'PENDENTE',
      product: product !== 'Não identificado' ? product : 'Produto em Conferência',
      model,
      material,
      gsm,
      size: op.size,
      width: width > 0 ? width : 400,
      height: height > 0 ? height : 450,
      bottom,
      quantity: quantity > 0 ? quantity : 1000,
      handleType: handleType !== 'NAO_IDENTIFICADO' ? handleType : 'VAZADA',
      hasWindow,
      hasCord,
      printingMethod: printingMethod !== 'NAO_IDENTIFICADO' ? printingMethod : 'FLEXOGRAFIA',
      printingColors,
      finishing: op.finishing || [],
    });

    const images = ImageService.mapImagesToStages(
      docs.map((d, i) => ({
        id: `img_${i}`,
        type: d.type === 'layout_document' ? 'layout_aprovado' : (d.type === 'op_document' ? 'foto_produto' : (i === 0 ? 'layout_aprovado' : 'foto_produto')),
        label: d.fileName,
        base64: d.base64,
        mimeType: d.mimeType,
        fileName: d.fileName,
      })),
      { hasWindow, hasCord, handleType, printingMethod }
    );

    const warnings = [...(parsed.warnings || []), ...routeResult.warnings];
    if (isMissingCrucialData) {
      warnings.push('Campos essenciais da OP não foram identificados com certeza. É obrigatória a conferência humana pelo PCP.');
    }

    const structuredResult: StructuredOpOutput = {
      op: {
        op_number: opNumber,
        customer,
        product,
        model,
        material,
        gsm,
        material_color: op.material_color || 'Conforme Layout',
        width,
        height,
        bottom,
        size: op.size || (width > 0 ? `${width / 10}x${height / 10}` : 'Não identificado'),
        quantity,
        handle_type: handleType,
        has_window: hasWindow,
        has_cord: hasCord,
        cord_mode: (String((op as any).cord_mode || '').toUpperCase() || 'NAO_IDENTIFICADO') as any,
        product_type: String((op as any).product_type || 'NAO_IDENTIFICADO').toUpperCase(),
        requires_sewing: Boolean((op as any).requires_sewing),
        outsourced: Boolean((op as any).outsourced),
        printing_method: printingMethod,
        printing_colors: printingColors,
        print_front: op.print_front || 'Conforme Layout Aprovado',
        print_back: op.print_back || 'Sem impressão',
        finishing: Array.isArray(op.finishing) ? op.finishing : ['Solda Ultrassônica'],
        deadline: op.deadline || new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        priority: (op.priority || 'VERDE') as any,
        notes: op.notes || 'Produzir estritamente conforme layout aprovado.',
        crop_box: op.crop_box,
      },
      extracted_data: parsed.extracted_data || {},
      images,
      missing_information: parsed.missing_information || [],
      warnings,
      needs_pcp_validation: Boolean(parsed.needs_pcp_validation || isMissingCrucialData || routeResult.needsPcpValidation),
      suggested_route: routeResult.steps,
      machine_candidates: routeResult.steps.map((s) => ({ step: s.processName, eligible: s.eligibleMachines })),
      routing_explanation: routeResult.explanation,
      ai_engine_info: {
        model: modelName,
        provider,
        timestamp: new Date().toISOString(),
      },
    };

    ServerAuditService.log({
      action: 'AI_ANALYSIS_CREATED',
      entityType: 'OP',
      entityId: structuredResult.op.op_number,
      details: `Análise concluída via ${provider} (${modelName}) para a OP ${structuredResult.op.op_number}. Roteiro com ${routeResult.steps.length} etapas gerado.`,
      metadata: {
        provider,
        model: modelName,
        needsPcpValidation: structuredResult.needs_pcp_validation,
      },
    });

    return structuredResult;
  }

  public static runDeterministicFallback(
    rawText: string,
    docs: Array<{ base64: string; mimeType: string; fileName: string; type?: string }>
  ): StructuredOpOutput {
    const clean = rawText || '';

    // Regex abrangentes para formatos de OP da Bella Top
    const opMatch =
      clean.match(/(?:OP|Ordem\s+de\s+Produ[cç][aã]o|OP\s*N[º°]?|OP\s*#|N[º°]?\s*da\s*OP|N[º°]?\s*OP|OP\/Lote)\s*[:#.]?\s*([A-Za-z0-9\-_/]{3,15})/i) ||
      clean.match(/\bOP\s*[-–:]?\s*(\d{4,8})\b/i);

    const pedMatch =
      clean.match(/(?:Pedido|PED|PEDIDO|Ped\s*N[º°]?|PV|Ped\.)\s*[:#.]?\s*([A-Za-z0-9\-_/]{3,15})/i) ||
      clean.match(/\bPED[-_]?(\d{3,8})\b/i);

    const clienteMatch =
      clean.match(/(?:Cliente|CLIENTE|Raz[aã]o\s+Social|Sacaria|Comprador|Destinat[aá]rio)\s*[:#.]?\s*([^\n\r,;|]{3,60})/i) ||
      clean.match(/(?:Empresa|Nome\s+Fantasia)\s*[:#.]?\s*([^\n\r,;|]{3,60})/i);

    const produtoMatch =
      clean.match(/(?:Produto|PRODUTO|Item|Descri[cç][aã]o|Especifica[cç][aã]o)\s*[:#.]?\s*([^\n\r;|]{3,70})/i) ||
      clean.match(/\b(Sacola\s+[^\n\r;,|]{3,50}|Saco\s+[^\n\r;,|]{3,50}|Mochilinha\s+[^\n\r;,|]{3,50})\b/i);

    const qtdMatch =
      clean.match(/(?:Quantidade|QTD|QUANTIDADE|Quant\.?|Lote|Tiragem|Total\s+de\s+Pe[cç]as)\s*[:#.]?\s*([\d.,]+)\s*(unidades|unidade|un|mil|m|p[cç]s)?/i) ||
      clean.match(/([\d.,]+)\s*(?:mil\s+unidades|mil\s+un|unidades|pe[cç]as)/i);

    const gramaturaMatch =
      clean.match(/(?:Gramatura|GRAMATURA|GSM|Gramas|Gr)\s*[:#.]?\s*(\d{2,3})\s*(?:g|gr|g\/m²)?/i) ||
      clean.match(/\bTNT\s*(\d{2,3})\s*(?:g|gr|g\/m²)?\b/i) ||
      clean.match(/(\d{2,3})\s*(?:g\/m²|gr\/m²|g|gr)\b/i);

    const corMatch =
      clean.match(/(?:Cor|COR|Cor\s+do\s+TNT|Cor\s+do\s+Tecido|Cor\s+Material|Cor\s+do\s+Material)\s*[:#.]?\s*([^\n\r,;|]{3,30})/i);

    const dimMatch =
      clean.match(/(?:Dimens[oõ]es|Medidas|Medida|Formato|Tamanho)\s*[:#.]?\s*(\d{2,4})\s*(?:x|X|\*)\s*(\d{2,4})(?:\s*(?:\+|\/)\s*(\d{1,4}))?/i) ||
      clean.match(/\b(\d{2,4})\s*(?:x|X|\*)\s*(\d{2,4})(?:\s*(?:\+|\/)\s*(\d{1,4}))?\s*(?:mm|cm)?\b/i);

    const is8x12Match = /\b8\s*[xX*]\s*12\b/i.test(clean);

    let qtd = 0;
    if (qtdMatch && qtdMatch[1]) {
      const raw = qtdMatch[1].replace(/\./g, '').replace(',', '.');
      qtd = parseFloat(raw) || 0;
    }

    const hasCordao = /cord[aã]o|cordinha|fio|mochilinha|barbante/i.test(clean);
    const hasVisor = /visor|janela|transparente|cristal/i.test(clean);
    const isAlcaVazada = /vazada|boca\s+de\s+palha[cç]o/i.test(clean);
    const isAlcaFita = /al[cç]a\s+fita|fita\s+40|fita\s+30|fita\s+tnt/i.test(clean);

    let handleType: 'VAZADA' | 'FITA' | 'CORDAO' | 'NENHUMA' | 'NAO_IDENTIFICADO' = 'NAO_IDENTIFICADO';
    if (isAlcaVazada) handleType = 'VAZADA';
    else if (isAlcaFita) handleType = 'FITA';
    else if (hasCordao) handleType = 'CORDAO';
    else if (/sem\s+al[cç]a|saco\s+sem\s+al[cç]a/i.test(clean)) handleType = 'NENHUMA';

    let printMethod: 'FLEXOGRAFIA' | 'SERIGRAFIA' | 'ESTAMPARIA' | 'SEM_IMPRESSAO' | 'NAO_IDENTIFICADO' = 'NAO_IDENTIFICADO';
    if (/flexo|flexografia/i.test(clean)) printMethod = 'FLEXOGRAFIA';
    else if (/serig|silk|carrossel/i.test(clean)) printMethod = 'SERIGRAFIA';
    else if (/estamp|transfer/i.test(clean)) printMethod = 'ESTAMPARIA';
    else if (/sem\s+impress[aã]o|liso|sem\s+personaliza[cç][aã]o/i.test(clean)) printMethod = 'SEM_IMPRESSAO';

    const colorsMatch = clean.match(/(\d+)\s*(?:cores|cor|x\s*\d+)/i);
    const printingColors = colorsMatch ? parseInt(colorsMatch[1], 10) : (printMethod === 'SEM_IMPRESSAO' ? 0 : 1);

    const deadlineMatch = clean.match(/(?:Prazo|Entrega|Data\s+de\s+Entrega|Data\s+Entrega|Vencimento)\s*[:#.]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i);

    const opNumber = opMatch ? opMatch[1].trim() : 'Não identificado';
    const customer = clienteMatch ? clienteMatch[1].trim() : 'Não identificado';
    const productName = produtoMatch ? produtoMatch[1].trim() : (is8x12Match ? 'Saco TNT 8x12' : 'Não identificado');
    const gsm = gramaturaMatch ? parseInt(gramaturaMatch[1], 10) : 0;
    const width = is8x12Match ? 80 : (dimMatch ? parseInt(dimMatch[1], 10) : 0);
    const height = is8x12Match ? 120 : (dimMatch ? parseInt(dimMatch[2], 10) : 0);
    const bottom = dimMatch && dimMatch[3] ? parseInt(dimMatch[3], 10) : 0;
    const size = is8x12Match ? '8x12' : (width >= 400 ? 'G' : (width >= 300 ? 'M' : (width > 0 ? 'P' : 'Não identificado')));

    const missingInfo: string[] = [];
    if (opNumber === 'Não identificado') missingInfo.push('Número da OP');
    if (customer === 'Não identificado') missingInfo.push('Nome do Cliente');
    if (productName === 'Não identificado') missingInfo.push('Nome do Produto');
    if (qtd <= 0) missingInfo.push('Quantidade do Lote');
    if (gsm <= 0) missingInfo.push('Gramatura do Material (g/m²)');
    if (width <= 0 || height <= 0) missingInfo.push('Dimensões / Medidas');
    if (handleType === 'NAO_IDENTIFICADO') missingInfo.push('Tipo de Alça');
    if (printMethod === 'NAO_IDENTIFICADO') missingInfo.push('Tipo de Impressão');

    const isMissingCrucialData = missingInfo.length > 0;

    const routeResult = RoutingEngine.computeRoute({
      opNumber: opNumber !== 'Não identificado' ? opNumber : 'PENDENTE',
      product: productName !== 'Não identificado' ? productName : 'Produto em Conferência',
      model: isAlcaVazada ? 'Alça Vazada Sem Visor' : (hasCordao ? 'Mochilinha com Cordão' : (isAlcaFita ? 'Sacola Alça Fita' : 'Padrão')),
      material: 'TNT 100% Polipropileno',
      gsm: gsm > 0 ? gsm : 60,
      size,
      width: width > 0 ? width : 400,
      height: height > 0 ? height : 450,
      bottom,
      quantity: qtd > 0 ? qtd : 1000,
      handleType: handleType !== 'NAO_IDENTIFICADO' ? handleType : 'VAZADA',
      hasWindow: hasVisor,
      hasCord: hasCordao,
      printingMethod: printMethod !== 'NAO_IDENTIFICADO' ? printMethod : 'FLEXOGRAFIA',
      printingColors,
      finishing: ['Solda Ultrassônica'],
    });

    const images = ImageService.mapImagesToStages(
      docs.map((d, i) => ({
        id: `img_${i}`,
        type: d.type === 'layout_document' ? 'layout_aprovado' : (d.type === 'op_document' ? 'foto_produto' : (i === 0 ? 'layout_aprovado' : 'foto_produto')),
        label: d.fileName,
        base64: d.base64,
        mimeType: d.mimeType,
        fileName: d.fileName,
      })),
      { hasWindow: hasVisor, hasCord: hasCordao, handleType: handleType !== 'NAO_IDENTIFICADO' ? handleType : 'VAZADA', printingMethod: printMethod !== 'NAO_IDENTIFICADO' ? printMethod : 'FLEXOGRAFIA' }
    );

    const warnings = [...routeResult.warnings];
    if (isMissingCrucialData) {
      warnings.unshift(`Campos pendentes de conferência: ${missingInfo.join(', ')}. Utilize a opção "Revisar e corrigir dados" para validar antes de liberar.`);
    }

    return {
      op: {
        op_number: opNumber,
        customer,
        product: productName,
        model: isAlcaVazada ? 'Alça Vazada Sem Visor' : (isAlcaFita ? 'Sacola Alça Fita' : (hasCordao ? 'Mochilinha com Cordão' : 'Conforme Layout')),
        material: 'TNT 100% Polipropileno',
        gsm: gsm > 0 ? gsm : 60,
        material_color: corMatch ? corMatch[1].trim() : 'Conforme Layout',
        width,
        height,
        bottom,
        size,
        quantity: qtd,
        handle_type: handleType,
        has_window: hasVisor,
        has_cord: hasCordao,
        cord_mode: 'NAO_IDENTIFICADO' as any,
        product_type: 'NAO_IDENTIFICADO',
        requires_sewing: false,
        outsourced: false,
        printing_method: printMethod,
        printing_colors: printingColors,
        print_front: 'Conforme Layout',
        print_back: 'Sem impressão',
        finishing: ['Solda Ultrassônica'],
        deadline: deadlineMatch ? new Date(deadlineMatch[1].split(/[\/.-]/).reverse().join('-')).toISOString() : new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        priority: 'VERDE',
        notes: 'Conferir dados com os documentos originais em anexo.',
      },
      extracted_data: {
        op_number: { value: opNumber, confidence: opMatch ? 0.98 : 0.0 },
        customer: { value: customer, confidence: clienteMatch ? 0.95 : 0.0 },
        product: { value: productName, confidence: produtoMatch ? 0.92 : 0.0 },
        model: { value: isAlcaVazada ? 'Alça Vazada' : (isAlcaFita ? 'Alça Fita' : 'Padrão'), confidence: 0.80 },
        material: { value: 'TNT 100% Polipropileno', confidence: 0.90 },
        gsm: { value: gsm, confidence: gramaturaMatch ? 0.98 : 0.0 },
        material_color: { value: corMatch ? corMatch[1].trim() : 'Conforme Layout', confidence: corMatch ? 0.90 : 0.0 },
        width: { value: width, confidence: dimMatch ? 0.90 : 0.0 },
        height: { value: height, confidence: dimMatch ? 0.90 : 0.0 },
        bottom: { value: bottom, confidence: dimMatch && dimMatch[3] ? 0.85 : 0.0 },
        size: { value: size, confidence: 0.80 },
        quantity: { value: qtd, confidence: qtdMatch ? 0.98 : 0.0 },
        handle_type: { value: handleType, confidence: handleType !== 'NAO_IDENTIFICADO' ? 0.95 : 0.0 },
        has_window: { value: hasVisor, confidence: 0.95 },
        has_cord: { value: hasCordao, confidence: 0.95 },
        printing_method: { value: printMethod, confidence: printMethod !== 'NAO_IDENTIFICADO' ? 0.92 : 0.0 },
        printing_colors: { value: printingColors, confidence: colorsMatch ? 0.90 : 0.70 },
        deadline: { value: deadlineMatch ? new Date().toISOString() : new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(), confidence: deadlineMatch ? 0.90 : 0.70 },
      },
      images,
      missing_information: missingInfo,
      warnings,
      needs_pcp_validation: isMissingCrucialData,
      suggested_route: routeResult.steps,
      machine_candidates: routeResult.steps.map((s) => ({ step: s.processName, eligible: s.eligibleMachines })),
      routing_explanation: routeResult.explanation,
      ai_engine_info: {
        model: 'deterministic-rules-engine',
        provider: 'deterministic_engine',
        timestamp: new Date().toISOString(),
      },
    };
  }
}
