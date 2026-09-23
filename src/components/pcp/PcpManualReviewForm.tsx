import React, { useState } from 'react';
import { ExtractedOpData } from '../../types/mes';
import { PRODUCT_KEY_OPTIONS, getProductKeyLabel } from '../../data/initialData';
import {
  Save,
  X,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Layers,
  Sparkles,
  Ruler,
  Printer,
  Calendar,
  Info,
  Sliders,
} from 'lucide-react';

interface PcpManualReviewFormProps {
  initialData: ExtractedOpData;
  onSave: (updatedData: ExtractedOpData, diffs: string[], justification: string) => void;
  onCancel: () => void;
}

export const PcpManualReviewForm: React.FC<PcpManualReviewFormProps> = ({
  initialData,
  onSave,
  onCancel,
}) => {
  const [formData, setFormData] = useState({
    numeroOp: initialData.numeroOp === 'Não identificado' ? '' : initialData.numeroOp,
    numeroPedido: initialData.numeroPedido || '',
    cliente: initialData.cliente === 'Não identificado' ? '' : initialData.cliente,
    produtoNome: initialData.produtoNome === 'Não identificado' ? '' : initialData.produtoNome,
    codigoProduto: initialData.codigoProduto || 'BT-01',
    modelo: initialData.modelo || 'Conforme Layout',
    quantidade: initialData.quantidade || 1000,
    unidade: initialData.unidade || 'UNIDADES',
    material: initialData.material || 'TNT 100% Polipropileno',
    gramatura: initialData.gramatura || 60,
    corMaterial: initialData.corMaterial || 'Conforme Layout',
    larguraMm: initialData.larguraMm || 400,
    alturaMm: initialData.alturaMm || 450,
    fundoMm: initialData.fundoMm || 0,
    tipoImpressao: (initialData.tipoImpressao || 'FLEXOGRAFIA') as
      | 'FLEXOGRAFIA'
      | 'SERIGRAFIA'
      | 'ESTAMPARIA'
      | 'SEM_IMPRESSAO',
    numeroCores: initialData.numeroCores ?? 1,
    impressaoFrente: initialData.impressaoFrente || 'Conforme Layout',
    impressaoVerso: initialData.impressaoVerso || 'Sem impressão',
    produtoConfirmadoPcp:
      initialData.produtoConfirmadoPcp || initialData.produtoSugeridoIa || 'NAO_IDENTIFICADO',
    tipoAlca: (initialData.tipoAlca || 'VAZADA') as 'VAZADA' | 'FITA' | 'CORDAO' | 'NENHUMA',
    usoCordao: Boolean(initialData.usoCordao),
    usoVisor: Boolean(initialData.usoVisor),
    prazoEntrega: initialData.prazoEntrega
      ? new Date(initialData.prazoEntrega).toISOString().substring(0, 10)
      : new Date(Date.now() + 72 * 3600 * 1000).toISOString().substring(0, 10),
    observacoesTecnicas: initialData.observacoesTecnicas || '',
    justificativa: 'Revisão e validação dos dados técnicos pelo PCP',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showRawText, setShowRawText] = useState(false);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.numeroOp.trim()) {
      errors.numeroOp = 'Número da OP é obrigatório.';
    }
    if (!formData.cliente.trim()) {
      errors.cliente = 'Nome do cliente é obrigatório.';
    }
    if (!formData.produtoNome.trim()) {
      errors.produtoNome = 'Nome do produto é obrigatório.';
    }
    if (!formData.quantidade || formData.quantidade <= 0) {
      errors.quantidade = 'Informe uma quantidade válida superior a zero.';
    }
    if (!formData.gramatura || formData.gramatura <= 0) {
      errors.gramatura = 'Informe a gramatura do material (g/m²).';
    }
    if (!formData.larguraMm || formData.larguraMm <= 0) {
      errors.larguraMm = 'Informe a largura em milímetros (ex: 400 para 40cm).';
    }
    if (!formData.alturaMm || formData.alturaMm <= 0) {
      errors.alturaMm = 'Informe a altura em milímetros (ex: 450 para 45cm).';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Calcular diferenças para a auditoria
    const diffs: string[] = [];
    if (initialData.numeroOp !== formData.numeroOp) {
      diffs.push(`OP: "${initialData.numeroOp}" -> "${formData.numeroOp}"`);
    }
    if (initialData.cliente !== formData.cliente) {
      diffs.push(`Cliente: "${initialData.cliente}" -> "${formData.cliente}"`);
    }
    if (initialData.produtoNome !== formData.produtoNome) {
      diffs.push(`Produto: "${initialData.produtoNome}" -> "${formData.produtoNome}"`);
    }
    if (initialData.quantidade !== formData.quantidade) {
      diffs.push(`Quantidade: ${initialData.quantidade} -> ${formData.quantidade}`);
    }
    if (initialData.material !== formData.material) {
      diffs.push(`Material: "${initialData.material}" -> "${formData.material}"`);
    }
    if (initialData.gramatura !== formData.gramatura) {
      diffs.push(`Gramatura: ${initialData.gramatura}g -> ${formData.gramatura}g`);
    }
    if (
      initialData.larguraMm !== formData.larguraMm ||
      initialData.alturaMm !== formData.alturaMm ||
      initialData.fundoMm !== formData.fundoMm
    ) {
      diffs.push(
        `Medidas: ${initialData.larguraMm}x${initialData.alturaMm}+${initialData.fundoMm}mm -> ${formData.larguraMm}x${formData.alturaMm}+${formData.fundoMm}mm`
      );
    }
    if (initialData.tipoImpressao !== formData.tipoImpressao) {
      diffs.push(`Impressão: "${initialData.tipoImpressao}" -> "${formData.tipoImpressao}"`);
    }
    const produtoAnterior = initialData.produtoConfirmadoPcp || initialData.produtoSugeridoIa || 'NAO_IDENTIFICADO';
    if (produtoAnterior !== formData.produtoConfirmadoPcp) {
      diffs.push(
        `Produto do roteiro: "${getProductKeyLabel(produtoAnterior)}" -> "${getProductKeyLabel(formData.produtoConfirmadoPcp)}"`
      );
    }
    if (initialData.tipoAlca !== formData.tipoAlca) {
      diffs.push(`Alça: "${initialData.tipoAlca}" -> "${formData.tipoAlca}"`);
    }
    if (initialData.usoCordao !== formData.usoCordao) {
      diffs.push(`Cordão: ${initialData.usoCordao ? 'Sim' : 'Não'} -> ${formData.usoCordao ? 'Sim' : 'Não'}`);
    }
    if (initialData.usoVisor !== formData.usoVisor) {
      diffs.push(`Visor: ${initialData.usoVisor ? 'Sim' : 'Não'} -> ${formData.usoVisor ? 'Sim' : 'Não'}`);
    }

    const formatMedidas = `${formData.larguraMm / 10} x ${formData.alturaMm / 10}${
      formData.fundoMm ? ' + ' + formData.fundoMm / 10 : ''
    } cm`;

    const updatedData: ExtractedOpData = {
      ...initialData,
      numeroOp: formData.numeroOp.trim(),
      numeroPedido: formData.numeroPedido.trim() || `PED-${formData.numeroOp.trim()}`,
      cliente: formData.cliente.trim(),
      produtoNome: formData.produtoNome.trim(),
      codigoProduto: formData.codigoProduto.trim(),
      modelo: formData.modelo.trim(),
      quantidade: Number(formData.quantidade),
      unidade: formData.unidade as any,
      material: formData.material.trim(),
      gramatura: Number(formData.gramatura),
      corMaterial: formData.corMaterial.trim(),
      larguraMm: Number(formData.larguraMm),
      alturaMm: Number(formData.alturaMm),
      fundoMm: Number(formData.fundoMm),
      medidasFormatadas: formatMedidas,
      tipoImpressao: formData.tipoImpressao,
      numeroCores: Number(formData.numeroCores),
      impressaoFrente: formData.impressaoFrente.trim(),
      impressaoVerso: formData.impressaoVerso.trim(),
      produtoConfirmadoPcp: formData.produtoConfirmadoPcp,
      tipoAlca: formData.tipoAlca,
      usoCordao: formData.usoCordao,
      usoVisor: formData.usoVisor,
      prazoEntrega: new Date(formData.prazoEntrega).toISOString(),
      observacoesTecnicas: formData.observacoesTecnicas.trim(),
      precisaRevisaoPcp: false, // Bloqueio superado!
      confiancaLeitura: {
        geral: 100,
        numeroOp: 100,
        cliente: 100,
        produto: 100,
        quantidade: 100,
        gramatura: 100,
        medidas: 100,
        tipoImpressao: 100,
        prazo: 100,
      },
      inconsistencias: [],
    };

    onSave(updatedData, diffs, formData.justificativa.trim());
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 animate-in fade-in duration-200">
      {/* Banner de Modo de Edição */}
      <div className="bg-[#FAF5F1] border-2 border-[#E30A78] rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5DAD3] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-pink-100 text-[#E30A78] flex items-center justify-center font-bold">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-black text-sm text-[#1C1418] flex items-center gap-2">
                <span>Modo de Revisão e Correção Manual pelo PCP</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
                  EDIÇÃO ATIVA
                </span>
              </h4>
              <p className="text-[11px] text-[#6E615B]">
                Preencha ou corrija os campos com dados incertos. Ao salvar, a trava de revisão será liberada.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowRawText(!showRawText)}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#F2EBE6] text-[#B30A5C] border border-[#F5C6DC] font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <FileText className="w-3.5 h-3.5 text-[#E30A78]" />
            <span>{showRawText ? 'Ocultar Texto da OP' : 'Ver Texto Lido da OP'}</span>
          </button>
        </div>

        {/* Drawer com texto bruto extraído da OP para consulta rápida */}
        {showRawText && (
          <div className="mt-3 p-3 rounded-xl bg-white border border-[#E5DAD3] space-y-1.5 animate-in slide-in-from-top-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-[#8A7D77]">
              <span>TEXTO EXTRAÍDO DO PDF ORIGINAL (CONSULTA)</span>
              <span className="font-mono text-[10px]">
                {initialData.rawText ? `${initialData.rawText.length} caracteres` : 'Sem texto disponível'}
              </span>
            </div>
            <pre className="text-[11px] font-mono text-[#3A3034] bg-[#FAF5F1] p-3 rounded-lg max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed border border-[#E5DAD3]">
              {initialData.rawText || 'Nenhum texto bruto foi retornado pelo leitor de documentos.'}
            </pre>
          </div>
        )}
      </div>

      {/* Grid de Campos Técnicos da OP */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* GRUPO 1: Identificação & Cliente */}
        <div className="bg-[#FAF5F1] border border-[#E5DAD3] rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xs">
          <h5 className="font-black text-xs uppercase tracking-widest text-[#B30A5C] flex items-center gap-2 border-b border-[#E5DAD3] pb-2">
            <FileText className="w-4 h-4 text-[#E30A78]" />
            <span>1. Identificação da OP & Cliente</span>
          </h5>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#1C1418] mb-1">
                Número da OP <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.numeroOp}
                onChange={(e) => setFormData({ ...formData, numeroOp: e.target.value })}
                placeholder="Ex: 21582"
                className={`w-full bg-white border rounded-xl px-3 py-2 text-xs font-bold text-[#1C1418] focus:outline-none focus:ring-2 focus:ring-[#E30A78] ${
                  formErrors.numeroOp ? 'border-rose-400 bg-rose-50/30' : 'border-[#E5DAD3]'
                }`}
              />
              {formErrors.numeroOp && <span className="text-[10px] text-rose-600 font-bold block mt-1">{formErrors.numeroOp}</span>}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#1C1418] mb-1">
                Número do Pedido
              </label>
              <input
                type="text"
                value={formData.numeroPedido}
                onChange={(e) => setFormData({ ...formData, numeroPedido: e.target.value })}
                placeholder="Ex: PED-1049"
                className="w-full bg-white border border-[#E5DAD3] rounded-xl px-3 py-2 text-xs font-mono text-[#1C1418] focus:outline-none focus:ring-2 focus:ring-[#E30A78]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#1C1418] mb-1">
              Razão Social / Cliente <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.cliente}
              onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
              placeholder="Ex: Sacaria & Cia Ltda"
              className={`w-full bg-white border rounded-xl px-3 py-2 text-xs font-bold text-[#1C1418] focus:outline-none focus:ring-2 focus:ring-[#E30A78] ${
                formErrors.cliente ? 'border-rose-400 bg-rose-50/30' : 'border-[#E5DAD3]'
              }`}
            />
            {formErrors.cliente && <span className="text-[10px] text-rose-600 font-bold block mt-1">{formErrors.cliente}</span>}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#1C1418] mb-1">
              Nome do Produto <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.produtoNome}
              onChange={(e) => setFormData({ ...formData, produtoNome: e.target.value })}
              placeholder="Ex: Sacola Alça Vazada Personalizada"
              className={`w-full bg-white border rounded-xl px-3 py-2 text-xs font-bold text-[#1C1418] focus:outline-none focus:ring-2 focus:ring-[#E30A78] ${
                formErrors.produtoNome ? 'border-rose-400 bg-rose-50/30' : 'border-[#E5DAD3]'
              }`}
            />
            {formErrors.produtoNome && <span className="text-[10px] text-rose-600 font-bold block mt-1">{formErrors.produtoNome}</span>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#1C1418] mb-1">
                Modelo da Sacola
              </label>
              <input
                type="text"
                value={formData.modelo}
                onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                placeholder="Ex: Alça Vazada Sem Visor"
                className="w-full bg-white border border-[#E5DAD3] rounded-xl px-3 py-2 text-xs text-[#1C1418] focus:outline-none focus:ring-2 focus:ring-[#E30A78]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#1C1418] mb-1">
                Código do Produto
              </label>
              <input
                type="text"
                value={formData.codigoProduto}
                onChange={(e) => setFormData({ ...formData, codigoProduto: e.target.value })}
                placeholder="Ex: BT-SAC-01"
                className="w-full bg-white border border-[#E5DAD3] rounded-xl px-3 py-2 text-xs font-mono text-[#1C1418] focus:outline-none focus:ring-2 focus:ring-[#E30A78]"
              />
            </div>
          </div>
        </div>

        {/* GRUPO 2: Lote, Materiais & Dimensões */}
        <div className="bg-[#FAF5F1] border border-[#E5DAD3] rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xs">
          <h5 className="font-black text-xs uppercase tracking-widest text-[#B30A5C] flex items-center gap-2 border-b border-[#E5DAD3] pb-2">
            <Ruler className="w-4 h-4 text-[#E30A78]" />
            <span>2. Lote, Material & Medidas</span>
          </h5>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#1C1418] mb-1">
                Quantidade do Lote <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={formData.quantidade}
                onChange={(e) => setFormData({ ...formData, quantidade: parseInt(e.target.value, 10) || 0 })}
                className={`w-full bg-white border rounded-xl px-3 py-2 text-xs font-bold text-[#1C1418] focus:outline-none focus:ring-2 focus:ring-[#E30A78] ${
                  formErrors.quantidade ? 'border-rose-400 bg-rose-50/30' : 'border-[#E5DAD3]'
                }`}
              />
              {formErrors.quantidade && <span className="text-[10px] text-rose-600 font-bold block mt-1">{formErrors.quantidade}</span>}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#1C1418] mb-1">
                Unidade de Medida
              </label>
              <select
                value={formData.unidade}
                onChange={(e) => setFormData({ ...formData, unidade: e.target.value })}
                className="w-full bg-white border border-[#E5DAD3] rounded-xl px-3 py-2 text-xs font-bold text-[#1C1418] focus:outline-none focus:ring-2 focus:ring-[#E30A78]"
              >
                <option value="UNIDADES">UNIDADES</option>
                <option value="METROS">METROS</option>
                <option value="PECAS">PEÇAS</option>
                <option value="QUILOS">QUILOS</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-[#1C1418] mb-1">
                Material Base <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.material}
                onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                placeholder="Ex: TNT 100% Polipropileno"
                className="w-full bg-white border border-[#E5DAD3] rounded-xl px-3 py-2 text-xs text-[#1C1418] focus:outline-none focus:ring-2 focus:ring-[#E30A78]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#1C1418] mb-1">
                Gramatura (g/m²) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="10"
                max="250"
                value={formData.gramatura}
                onChange={(e) => setFormData({ ...formData, gramatura: parseInt(e.target.value, 10) || 0 })}
                className={`w-full bg-white border rounded-xl px-3 py-2 text-xs font-bold text-[#1C1418] focus:outline-none focus:ring-2 focus:ring-[#E30A78] ${
                  formErrors.gramatura ? 'border-rose-400 bg-rose-50/30' : 'border-[#E5DAD3]'
                }`}
              />
              {formErrors.gramatura && <span className="text-[10px] text-rose-600 font-bold block mt-1">{formErrors.gramatura}</span>}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#1C1418] mb-1">
              Cor do Tecido / Material
            </label>
            <input
              type="text"
              value={formData.corMaterial}
              onChange={(e) => setFormData({ ...formData, corMaterial: e.target.value })}
              placeholder="Ex: Branco, Preto, Rosa Pink..."
              className="w-full bg-white border border-[#E5DAD3] rounded-xl px-3 py-2 text-xs text-[#1C1418] focus:outline-none focus:ring-2 focus:ring-[#E30A78]"
            />
          </div>

          {/* Dimensões em mm */}
          <div className="pt-2 border-t border-[#E5DAD3]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-[#1C1418]">Dimensões do Produto (em milímetros)</span>
              <span className="text-[10px] text-[#6E615B] font-mono">
                {formData.larguraMm / 10} x {formData.alturaMm / 10}
                {formData.fundoMm ? ` + ${formData.fundoMm / 10}` : ''} cm
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] text-[#8A7D77] font-semibold mb-0.5">Largura (mm)</label>
                <input
                  type="number"
                  min="50"
                  step="1"
                  value={formData.larguraMm}
                  onChange={(e) => setFormData({ ...formData, larguraMm: parseInt(e.target.value, 10) || 0 })}
                  className={`w-full bg-white border rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#1C1418] focus:outline-none focus:ring-2 focus:ring-[#E30A78] ${
                    formErrors.larguraMm ? 'border-rose-400' : 'border-[#E5DAD3]'
                  }`}
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#8A7D77] font-semibold mb-0.5">Altura (mm)</label>
                <input
                  type="number"
                  min="50"
                  step="1"
                  value={formData.alturaMm}
                  onChange={(e) => setFormData({ ...formData, alturaMm: parseInt(e.target.value, 10) || 0 })}
                  className={`w-full bg-white border rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#1C1418] focus:outline-none focus:ring-2 focus:ring-[#E30A78] ${
                    formErrors.alturaMm ? 'border-rose-400' : 'border-[#E5DAD3]'
                  }`}
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#8A7D77] font-semibold mb-0.5">Fundo / Sanfona (mm)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formData.fundoMm}
                  onChange={(e) => setFormData({ ...formData, fundoMm: parseInt(e.target.value, 10) || 0 })}
                  className="w-full bg-white border border-[#E5DAD3] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#1C1418] focus:outline-none focus:ring-2 focus:ring-[#E30A78]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* GRUPO 3: Impressão & Personalização */}
        <div className="bg-[#FAF5F1] border border-[#E5DAD3] rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xs">
          <h5 className="font-black text-xs uppercase tracking-widest text-[#B30A5C] flex items-center gap-2 border-b border-[#E5DAD3] pb-2">
            <Printer className="w-4 h-4 text-[#E30A78]" />
            <span>3. Impressão & Estamparia</span>
          </h5>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#1C1418] mb-1">
                Tipo de Impressão
              </label>
              <select
                value={formData.tipoImpressao}
                onChange={(e) => setFormData({ ...formData, tipoImpressao: e.target.value as any })}
                className="w-full bg-white border border-[#E5DAD3] rounded-xl px-3 py-2 text-xs font-bold text-[#1C1418] focus:outline-none focus:ring-2 focus:ring-[#E30A78]"
              >
                <option value="FLEXOGRAFIA">FLEXOGRAFIA (Bobina)</option>
                <option value="SERIGRAFIA">SERIGRAFIA (Carrossel / Silk)</option>
                <option value="ESTAMPARIA">ESTAMPARIA (Transfer)</option>
                <option value="SEM_IMPRESSAO">SEM IMPRESSÃO (Liso)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#1C1418] mb-1">
                Número de Cores
              </label>
              <input
                type="number"
                min="0"
                max="8"
                value={formData.numeroCores}
                onChange={(e) => setFormData({ ...formData, numeroCores: parseInt(e.target.value, 10) || 0 })}
                className="w-full bg-white border border-[#E5DAD3] rounded-xl px-3 py-2 text-xs font-bold text-[#1C1418] focus:outline-none focus:ring-2 focus:ring-[#E30A78]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#1C1418] mb-1">
                Impressão Frente
              </label>
              <input
                type="text"
                value={formData.impressaoFrente}
                onChange={(e) => setFormData({ ...formData, impressaoFrente: e.target.value })}
                placeholder="Ex: 1 Cor Rosa Pink"
                className="w-full bg-white border border-[#E5DAD3] rounded-xl px-3 py-2 text-xs text-[#1C1418] focus:outline-none focus:ring-2 focus:ring-[#E30A78]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#1C1418] mb-1">
                Impressão Verso
              </label>
              <input
                type="text"
                value={formData.impressaoVerso}
                onChange={(e) => setFormData({ ...formData, impressaoVerso: e.target.value })}
                placeholder="Ex: Sem impressão"
                className="w-full bg-white border border-[#E5DAD3] rounded-xl px-3 py-2 text-xs text-[#1C1418] focus:outline-none focus:ring-2 focus:ring-[#E30A78]"
              />
            </div>
          </div>
        </div>

        {/* GRUPO 4: Alça, Visor & Cordão */}
        <div className="bg-[#FAF5F1] border border-[#E5DAD3] rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xs">
          <h5 className="font-black text-xs uppercase tracking-widest text-[#B30A5C] flex items-center gap-2 border-b border-[#E5DAD3] pb-2">
            <Sparkles className="w-4 h-4 text-[#E30A78]" />
            <span>4. Alça, Acessórios & Acabamento</span>
          </h5>

          <div>
            <label className="block text-[11px] font-bold text-[#1C1418] mb-1">
              Produto do Roteiro (confirmação do PCP)
            </label>
            <select
              value={formData.produtoConfirmadoPcp}
              onChange={(e) => setFormData({ ...formData, produtoConfirmadoPcp: e.target.value })}
              className="w-full bg-white border border-[#E5DAD3] rounded-xl px-3 py-2 text-xs font-bold text-[#1C1418] focus:outline-none focus:ring-2 focus:ring-[#E30A78]"
            >
              {PRODUCT_KEY_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-[#6E615B] mt-1 leading-relaxed">
              Sugestão da IA:{' '}
              <span className="font-bold text-[#3A3034]">
                {getProductKeyLabel(initialData.produtoSugeridoIa)}
              </span>
              . O produto define as etapas obrigatórias do roteiro (costura, alça, cordão).
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#1C1418] mb-1">
              Tipo de Alça
            </label>
            <select
              value={formData.tipoAlca}
              onChange={(e) => setFormData({ ...formData, tipoAlca: e.target.value as any })}
              className="w-full bg-white border border-[#E5DAD3] rounded-xl px-3 py-2 text-xs font-bold text-[#1C1418] focus:outline-none focus:ring-2 focus:ring-[#E30A78]"
            >
              <option value="VAZADA">Alça Vazada (Boca de Palhaço)</option>
              <option value="FITA">Alça Fita (Soldada / Fixada)</option>
              <option value="CORDAO">Cordão / Mochilinha</option>
              <option value="NENHUMA">Sem Alça (Saco Simples)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-[#E5DAD3] cursor-pointer hover:border-[#E30A78] transition-colors">
              <input
                type="checkbox"
                checked={formData.usoCordao}
                onChange={(e) => setFormData({ ...formData, usoCordao: e.target.checked })}
                className="rounded text-[#E30A78] focus:ring-[#E30A78] w-4 h-4"
              />
              <span className="text-xs font-bold text-[#1C1418]">Uso de Cordão / Fio</span>
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-[#E5DAD3] cursor-pointer hover:border-[#E30A78] transition-colors">
              <input
                type="checkbox"
                checked={formData.usoVisor}
                onChange={(e) => setFormData({ ...formData, usoVisor: e.target.checked })}
                className="rounded text-[#E30A78] focus:ring-[#E30A78] w-4 h-4"
              />
              <span className="text-xs font-bold text-[#1C1418]">Visor Transparente</span>
            </label>
          </div>
        </div>
      </div>

      {/* GRUPO 5: Prazo, Observações Técnicas & Justificativa do PCP */}
      <div className="bg-[#FAF5F1] border border-[#E5DAD3] rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
        <h5 className="font-black text-xs uppercase tracking-widest text-[#B30A5C] flex items-center gap-2 border-b border-[#E5DAD3] pb-2">
          <Calendar className="w-4 h-4 text-[#E30A78]" />
          <span>5. Planejamento, Observações & Justificativa da Revisão</span>
        </h5>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-[#1C1418] mb-1">
              Prazo de Entrega Programado
            </label>
            <input
              type="date"
              value={formData.prazoEntrega}
              onChange={(e) => setFormData({ ...formData, prazoEntrega: e.target.value })}
              className="w-full bg-white border border-[#E5DAD3] rounded-xl px-3 py-2 text-xs font-bold text-[#1C1418] focus:outline-none focus:ring-2 focus:ring-[#E30A78]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#1C1418] mb-1">
              Justificativa / Motivo da Revisão (Registro de Auditoria)
            </label>
            <input
              type="text"
              value={formData.justificativa}
              onChange={(e) => setFormData({ ...formData, justificativa: e.target.value })}
              placeholder="Ex: Conferência técnica e preenchimento de campos manuais"
              className="w-full bg-white border border-[#E5DAD3] rounded-xl px-3 py-2 text-xs text-[#1C1418] focus:outline-none focus:ring-2 focus:ring-[#E30A78]"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-[#1C1418] mb-1">
            Observações Técnicas para o Chão de Fábrica
          </label>
          <textarea
            rows={2}
            value={formData.observacoesTecnicas}
            onChange={(e) => setFormData({ ...formData, observacoesTecnicas: e.target.value })}
            placeholder="Ex: Cuidados com a solda lateral, conferir tonalidade do pigmento na flexografia..."
            className="w-full bg-white border border-[#E5DAD3] rounded-xl p-3 text-xs text-[#1C1418] focus:outline-none focus:ring-2 focus:ring-[#E30A78]"
          />
        </div>
      </div>

      {/* Botões de Ação do Formulário */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white hover:bg-[#F2EBE6] text-[#1C1418] border border-[#E5DAD3] text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <X className="w-4 h-4 text-[#8A7D77]" />
          <span>Cancelar Edição</span>
        </button>

        <button
          type="submit"
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#E30A78] to-[#B30A5C] hover:from-[#c20866] hover:to-[#96084c] text-white text-xs font-black shadow-lg shadow-pink-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
        >
          <Save className="w-4 h-4 stroke-[2.5]" />
          <span>SALVAR E VALIDAR FICHA TÉCNICA</span>
        </button>
      </div>
    </form>
  );
};
