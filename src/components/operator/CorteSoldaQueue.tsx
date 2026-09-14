import React, { useState, useMemo } from 'react';
import { useMesStore } from '../../hooks/useMesStore';
import { Machine, MachineSession, ProductionOrder } from '../../types/mes';
import { OpProductThumbnail } from '../common/OpProductThumbnail';
import { FullLayoutModal } from '../pcp/FullLayoutModal';
import {
  Play,
  Filter,
  CheckCircle,
  AlertTriangle,
  Lock,
  Search,
  Sparkles,
  Info,
  Layers,
  X,
  Eye,
  Check,
  Cpu
} from 'lucide-react';

interface CorteSoldaQueueProps {
  machine: Machine;
  session?: MachineSession | null;
  onSelectOp: (opId: string) => void;
  onStartOp: (stepId: string) => void;
}

interface ParsedDimension {
  widthCm: number;
  heightCm: number;
  widthMm: number;
  heightMm: number;
}

function parseDimensionInput(input: string): ParsedDimension | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Aceita formatos como "40 × 55", "40x55", "40 x 55", "26 × 36", "26x36", "26.5 x 36"
  const match = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*(?:[xX×*])\s*(\d+(?:[.,]\d+)?)$/);
  if (!match) return null;

  const wStr = match[1].replace(',', '.');
  const hStr = match[2].replace(',', '.');
  const widthCm = parseFloat(wStr);
  const heightCm = parseFloat(hStr);

  if (isNaN(widthCm) || isNaN(heightCm) || widthCm <= 0 || heightCm <= 0) {
    return null;
  }

  // Conversão de centímetros para milímetros (multiplica por 10)
  const widthMm = Math.round(widthCm * 10 * 100) / 100;
  const heightMm = Math.round(heightCm * 10 * 100) / 100;

  return {
    widthCm,
    heightCm,
    widthMm,
    heightMm,
  };
}

export const CorteSoldaQueue: React.FC<CorteSoldaQueueProps> = ({
  machine,
  session,
  onSelectOp,
  onStartOp,
}) => {
  const { getAvailableCorteSoldaOps, claimOperation, authenticatedUser } = useMesStore();

  const [dimensionInput, setDimensionInput] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('TODAS');
  const [selectedModel, setSelectedModel] = useState<string>('TODOS');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [selectedLayoutOp, setSelectedLayoutOp] = useState<ProductionOrder | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  // Obtém todas as OPs disponíveis para a etapa de Corte e Solda
  const availableOps = getAvailableCorteSoldaOps(machine.id);

  // Parser automático da medida digitada
  const parsedDimension = useMemo(() => {
    return parseDimensionInput(dimensionInput);
  }, [dimensionInput]);

  const isDimensionFilterActive = Boolean(parsedDimension);
  const isDimensionInvalid = dimensionInput.trim() !== '' && !parsedDimension;

  // Coleta lista dinâmica de Cores e Modelos presentes nas OPs
  const filterOptions = useMemo(() => {
    const colors = new Set<string>();
    const models = new Set<string>();

    availableOps.forEach(({ order }) => {
      // Cor
      if (order.materialColor) colors.add(order.materialColor.trim());

      // Modelo
      if (order.handleType) {
        if (order.handleType === 'VAZADA') models.add('Alça Vazada');
        else if (order.handleType === 'FITA') models.add('Alça Fita');
        else if (order.handleType === 'CORDÃO') models.add('Mochilinha (Cordão)');
        else models.add(order.handleType);
      } else if (order.productName) {
        models.add(order.productName);
      }
    });

    return {
      colors: ['TODAS', ...Array.from(colors)],
      models: ['TODOS', ...Array.from(models)],
    };
  }, [availableOps]);

  // Aplicação dos filtros rápidos (Medida, Cor, Modelo, Busca)
  const filteredOps = useMemo(() => {
    return availableOps.filter(({ order, step }) => {
      // Filtro de Busca Geral
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesOp = order.opNumber.toLowerCase().includes(q);
        const matchesClient = order.client.toLowerCase().includes(q);
        const matchesProd = order.productName.toLowerCase().includes(q);
        if (!matchesOp && !matchesClient && !matchesProd) return false;
      }

      // Filtro por Medida Manual (Largura × Altura em cm convertido para mm)
      if (parsedDimension) {
        const opW = order.dimensions?.width || 0;
        const opH = order.dimensions?.height || 0;

        // Compara com a medida em mm (ex: 260x360) ou cm (ex: 26x36), respeitando estritamente a ordem largura x altura
        const matchesMm = Math.abs(opW - parsedDimension.widthMm) < 0.5 && Math.abs(opH - parsedDimension.heightMm) < 0.5;
        const matchesCm = Math.abs(opW - parsedDimension.widthCm) < 0.1 && Math.abs(opH - parsedDimension.heightCm) < 0.1;

        if (!matchesMm && !matchesCm) return false;
      }

      // Filtro por Cor
      if (selectedColor !== 'TODAS') {
        if (order.materialColor?.trim() !== selectedColor) return false;
      }

      // Filtro por Modelo
      if (selectedModel !== 'TODOS') {
        const modelName = order.handleType === 'VAZADA' ? 'Alça Vazada'
          : order.handleType === 'FITA' ? 'Alça Fita'
          : order.handleType === 'CORDÃO' ? 'Mochilinha (Cordão)'
          : order.productName;
        if (!modelName.toLowerCase().includes(selectedModel.toLowerCase())) return false;
      }

      return true;
    });
  }, [availableOps, parsedDimension, selectedColor, selectedModel, searchQuery]);

  const handleClaimOp = (stepId: string, opNumber: string) => {
    setFeedbackError(null);
    setFeedbackSuccess(null);

    const isAdmin = authenticatedUser?.role === 'ADMIN' || authenticatedUser?.sectors?.includes('ADMIN');
    const operatorId = session?.operatorId || (isAdmin ? authenticatedUser?.id : undefined);
    const operatorName = session?.operatorName || (isAdmin ? authenticatedUser?.name : undefined);

    const result = claimOperation(stepId, machine.id, operatorId, operatorName);

    if (result.success) {
      setFeedbackSuccess(`OP #${opNumber} selecionada com sucesso para a ${machine.name}!`);
      setTimeout(() => {
        onStartOp(stepId);
      }, 350);
    } else {
      setFeedbackError(result.error || 'Esta OP já foi selecionada por outra máquina.');
    }
  };

  const clearFilters = () => {
    setDimensionInput('');
    setSelectedColor('TODAS');
    setSelectedModel('TODOS');
    setSearchQuery('');
  };

  const hasActiveFilters = Boolean(dimensionInput.trim()) || selectedColor !== 'TODAS' || selectedModel !== 'TODOS' || searchQuery !== '';

  return (
    <div className="space-y-5">
      {/* Feedback Alerts */}
      {feedbackError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-sm font-bold flex items-center justify-between shadow-sm animate-shake">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{feedbackError}</span>
          </div>
          <button onClick={() => setFeedbackError(null)} className="p-1 hover:bg-rose-100 rounded-lg">
            <X size={16} />
          </button>
        </div>
      )}

      {feedbackSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-sm font-bold flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{feedbackSuccess}</span>
          </div>
        </div>
      )}

      {/* Header Info */}
      <div className="rounded-2xl border border-[#E5DAD3] bg-white p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-pink-100 text-[#B30A5C] border border-pink-200">
              FILA COMPARTILHADA (M2, M3 e M4)
            </span>
            <span className="text-xs font-bold text-[#8A7D77]">
              Posto Ativo: <strong className="text-[#1C1418]">{machine.name}</strong>
            </span>
          </div>
          <h2 className="text-xl font-black text-[#1C1418] mt-1">Ordens de Produção Disponíveis</h2>
          <p className="text-xs text-[#6E615B] mt-0.5">
            Todas as OPs de Corte e Solda são listadas aqui. Ao clicar em <strong>SELECIONAR OP</strong>, ela é vinculada a este posto e removida das outras máquinas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs text-[#8A7D77] block font-medium">Disponíveis no Setor</span>
            <span className="text-2xl font-black text-[#E30A78]">{availableOps.length} OPs</span>
          </div>
        </div>
      </div>

      {/* FILTROS POR TAMANHO, COR E MODELO (Item 10) */}
      <div className="rounded-2xl border border-[#E5DAD3] bg-white p-4.5 space-y-3.5 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-[#E5DAD3]">
          <span className="text-xs font-black uppercase tracking-wider text-[#3A3034] flex items-center gap-1.5">
            <Filter size={14} className="text-[#E30A78]" />
            Filtros Rápidos de Busca:
          </span>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-[#E30A78] hover:text-[#B30A5C] font-bold flex items-center gap-1 cursor-pointer"
            >
              <X size={13} />
              Limpar Filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Busca por Texto */}
          <div className="relative">
            <label className="block text-[11px] font-bold text-[#8A7D77] uppercase mb-1">
              Buscar OP / Cliente:
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ex: 2502, Bella, Box..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#E5DAD3] bg-[#FAF5F1] text-xs font-bold text-[#1C1418] placeholder-[#9A8B84] focus:border-[#E30A78] focus:outline-none"
              />
              <Search className="w-3.5 h-3.5 text-[#8A7D77] absolute left-2.5 top-3" />
            </div>
          </div>

          {/* Filtro por MEDIDA MANUAL (cm) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold text-[#8A7D77] uppercase">
                Medida:
              </label>
              <span className="text-[10px] font-mono font-bold text-[#B30A5C] bg-pink-50 px-1.5 py-0.5 rounded border border-pink-200">
                cm
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={dimensionInput}
                onChange={(e) => setDimensionInput(e.target.value)}
                placeholder="Ex.: 40 × 55"
                className={`w-full px-3 py-2 rounded-xl border bg-[#FAF5F1] text-xs font-bold text-[#1C1418] placeholder-[#9A8B84] focus:outline-none transition-colors ${
                  isDimensionInvalid
                    ? 'border-amber-400 focus:border-amber-500'
                    : isDimensionFilterActive
                    ? 'border-emerald-500 focus:border-emerald-600 ring-1 ring-emerald-500/20'
                    : 'border-[#E5DAD3] focus:border-[#E30A78]'
                }`}
              />
            </div>
            {isDimensionInvalid && (
              <p className="text-[10px] text-amber-700 mt-1 font-medium leading-tight">
                Informe a medida no formato largura × altura. Exemplo: 40 × 55.
              </p>
            )}
          </div>

          {/* Filtro por COR */}
          <div>
            <label className="block text-[11px] font-bold text-[#8A7D77] uppercase mb-1">
              Cor do Material:
            </label>
            <select
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#E5DAD3] bg-[#FAF5F1] text-xs font-bold text-[#1C1418] focus:border-[#E30A78] focus:outline-none cursor-pointer"
            >
              {filterOptions.colors.map((c) => (
                <option key={c} value={c}>
                  {c === 'TODAS' ? 'Todas as Cores' : c}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por MODELO */}
          <div>
            <label className="block text-[11px] font-bold text-[#8A7D77] uppercase mb-1">
              Modelo do Produto:
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#E5DAD3] bg-[#FAF5F1] text-xs font-bold text-[#1C1418] focus:border-[#E30A78] focus:outline-none cursor-pointer"
            >
              {filterOptions.models.map((m) => (
                <option key={m} value={m}>
                  {m === 'TODOS' ? 'Todos os Modelos' : m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* LISTA DE CARDS DE OPS (Item 11) */}
      <div className="space-y-3.5">
        {filteredOps.length === 0 ? (
          <div className="rounded-2xl border border-[#E5DAD3] bg-white p-12 text-center space-y-3">
            <Layers className="w-12 h-12 text-[#9A8B84] mx-auto opacity-50" />
            <h3 className="text-base font-bold text-[#1C1418]">
              {isDimensionFilterActive
                ? 'Nenhuma Ordem de Produção encontrada com esta medida.'
                : 'Nenhuma OP encontrada'}
            </h3>
            <p className="text-xs text-[#6E615B] max-w-sm mx-auto">
              {isDimensionFilterActive
                ? 'Verifique se as dimensões informadas correspondem à largura e altura da OP.'
                : hasActiveFilters
                ? 'Nenhuma ordem corresponde aos filtros selecionados. Tente limpar os filtros para ver todas as OPs.'
                : 'Não há ordens de produção aguardando corte e solda no momento.'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-2 px-4 py-2 bg-[#FAF5F1] hover:bg-[#F2EBE6] text-xs font-bold text-[#1C1418] rounded-xl border border-[#E5DAD3] cursor-pointer"
              >
                Limpar Filtros
              </button>
            )}
          </div>
        ) : (
          filteredOps.map(({ order, step, recommendation }) => {
            const isBlocked = recommendation.isBlocked;
            const isRecommendedForThisMachine = recommendation.isRecommended;
            const isClaimedByThisMachine = step.claimedByMachineId === machine.id;

            // Formatação amigável das dimensões e modelo
            const sizeLabel = order.dimensionsFormatted || `${order.dimensions?.width || 0}x${order.dimensions?.height || 0} mm`;
            const modelLabel = order.handleType === 'VAZADA' ? 'Alça Vazada'
              : order.handleType === 'FITA' ? 'Alça Fita'
              : order.handleType === 'CORDÃO' ? 'Mochilinha com Cordão'
              : order.productName;

            return (
              <div
                key={step.id}
                className={`rounded-2xl border transition-all p-4.5 sm:p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-xs ${
                  isClaimedByThisMachine
                    ? 'border-[#E30A78] bg-pink-50/40 ring-2 ring-[#E30A78]/20'
                    : isBlocked
                    ? 'border-[#E5DAD3] bg-[#FAF5F1]/80 opacity-75'
                    : isRecommendedForThisMachine
                    ? 'border-emerald-300 bg-emerald-50/30'
                    : 'border-[#E5DAD3] bg-white hover:border-[#E30A78]/40'
                }`}
              >
                {/* [ FOTO DO PRODUTO ] + Detalhes Principais */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="relative shrink-0">
                    <OpProductThumbnail
                      thumbnail={order.productThumbnail}
                      layoutImage={order.layoutPreviewImage || order.layoutImage}
                      opNumber={order.opNumber}
                      size="lg"
                      onClick={() => onSelectOp(order.id)}
                      className="shadow-sm border border-[#E5DAD3] hover:border-[#E30A78] transition-colors cursor-pointer"
                    />
                    <button
                      onClick={() => setSelectedLayoutOp(order)}
                      className="absolute -bottom-1 -right-1 bg-white p-1 rounded-full border border-[#E5DAD3] text-[#8A7D77] hover:text-[#E30A78] shadow-xs cursor-pointer"
                      title="Ampliar Layout Técnico"
                    >
                      <Eye size={12} />
                    </button>
                  </div>

                  <div
                    onClick={() => onSelectOp(order.id)}
                    className="space-y-1 min-w-0 flex-1 cursor-pointer hover:opacity-95 transition-opacity"
                    title="Clique para ver todos os detalhes desta OP"
                  >
                    {/* Tags de Recomendação e Status */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Tag de Recomendação (Item 7) */}
                      {isRecommendedForThisMachine ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 text-[10px] font-black tracking-wide flex items-center gap-1 shadow-2xs">
                          <Sparkles size={11} className="text-emerald-600" />
                          RECOMENDADA: {machine.name.toUpperCase()}
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300 text-[10px] font-bold flex items-center gap-1">
                          <Info size={11} className="text-slate-500" />
                          RECOMENDADA: {recommendation.recommendedMachineName.toUpperCase()}
                        </span>
                      )}

                      {/* Status: Disponível ou Bloqueada (Item 11) */}
                      {isBlocked ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-300 text-[10px] font-black flex items-center gap-1">
                          <Lock size={11} className="text-rose-600" />
                          BLOQUEADA
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold flex items-center gap-1">
                          ● DISPONÍVEL
                        </span>
                      )}

                      {/* Tag Cordão se houver */}
                      {(step.hasCord || order.hasDrawstring) && (
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300 text-[10px] font-extrabold font-mono">
                          Cordão: SIM
                        </span>
                      )}
                    </div>

                    {/* Número da OP e Cliente */}
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-lg font-black text-[#1C1418] tracking-tight hover:text-[#E30A78] transition-colors">
                        OP #{order.opNumber}
                      </h3>
                      <span className="text-xs text-[#8A7D77] font-medium truncate">
                        · {order.client}
                      </span>
                    </div>

                    {/* Especificações do Card: Modelo, Tamanho, Cor, Quantidade (Item 11) */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#3A3034] pt-0.5">
                      <span className="font-semibold text-[#B30A5C]">
                        Modelo: <strong>{modelLabel}</strong>
                      </span>
                      <span className="text-[#8A7D77]">|</span>
                      <span>
                        Tamanho: <strong>{sizeLabel}</strong>
                      </span>
                      <span className="text-[#8A7D77]">|</span>
                      <span>
                        Cor: <strong>{order.materialColor || 'TNT'}</strong>
                      </span>
                      <span className="text-[#8A7D77]">|</span>
                      <span className="font-mono font-bold text-emerald-700">
                        Qtd: {step.receivedQuantity.toLocaleString('pt-BR')} {step.unit}
                      </span>
                    </div>

                    {/* Explicação de Bloqueio Técnico (Item 8 e 9) */}
                    {isBlocked && recommendation.blockReason && (
                      <p className="text-[11px] font-semibold text-rose-700 bg-rose-50/80 px-2.5 py-1 rounded-lg border border-rose-200 inline-block mt-1">
                        ⚠️ Motivo: {recommendation.blockReason}
                      </p>
                    )}
                  </div>
                </div>

                {/* Botão: SELECIONAR OP (Item 11) */}
                <div className="flex items-center gap-2 self-stretch lg:self-center justify-end w-full lg:w-auto pt-2 lg:pt-0 border-t lg:border-t-0 border-[#E5DAD3]">
                  <button
                    onClick={() => handleClaimOp(step.id, order.opNumber)}
                    disabled={isBlocked}
                    className={`px-5 py-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                      isBlocked
                        ? 'bg-[#FAF5F1] text-[#9A8B84] border border-[#E5DAD3] cursor-not-allowed opacity-60'
                        : isClaimedByThisMachine
                        ? 'bg-[#E30A78] hover:bg-[#B30A5C] text-white ring-2 ring-pink-300'
                        : isRecommendedForThisMachine
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-200'
                        : 'bg-[#E30A78] hover:bg-[#B30A5C] text-white'
                    }`}
                  >
                    {isBlocked ? (
                      <>
                        <Lock size={14} />
                        <span>SELEÇÃO BLOQUEADA</span>
                      </>
                    ) : isClaimedByThisMachine ? (
                      <>
                        <Play size={14} className="fill-white" />
                        <span>PRODUZIR AGORA</span>
                      </>
                    ) : (
                      <>
                        <Check size={14} />
                        <span>SELECIONAR OP</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Visualizador Completo do Layout */}
      {selectedLayoutOp && (
        <FullLayoutModal
          order={selectedLayoutOp}
          onClose={() => setSelectedLayoutOp(null)}
        />
      )}
    </div>
  );
};
