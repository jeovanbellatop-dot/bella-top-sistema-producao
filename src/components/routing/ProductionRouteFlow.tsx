import React, { useState, useEffect } from 'react';
import { useMesStore } from '../../hooks/useMesStore';
import {
  Layers,
  CheckCircle2,
  PlayCircle,
  PauseCircle,
  Clock,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Cpu,
  UserCheck,
  Send,
  Sparkles,
  Flame,
  ShieldCheck,
  Package,
  Calendar,
  ChevronRight,
  Info,
  History,
  FileText,
  Eye
} from 'lucide-react';
import { ProductionOrder, OperationStep, PriorityLevel, LOSS_CLASSIFICATION_LABELS, LOSS_DESTINATION_LABELS } from '../../types/mes';
import { FinishStepModal } from '../operator/FinishStepModal';
import { PauseModal } from '../operator/PauseModal';
import { OpProductThumbnail } from '../common/OpProductThumbnail';
import { FullLayoutModal } from '../pcp/FullLayoutModal';

interface ProductionRouteFlowProps {
  order: ProductionOrder;
  onSelectMachine?: (machineId: string) => void;
  compact?: boolean;
}

export const ProductionRouteFlow: React.FC<ProductionRouteFlowProps> = ({
  order,
  onSelectMachine,
  compact = false,
}) => {
  const {
    machines,
    users,
    currentUser,
    startOperation,
    pauseOperation,
    resumeOperation,
    finishOperation,
    updateStepMachine,
    setManualPriority,
    dispatchOp,
    auditLogs
  } = useMesStore();

  const [activePauseStepId, setActivePauseStepId] = useState<string | null>(null);
  const [activeFinishStepId, setActiveFinishStepId] = useState<string | null>(null);
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Real-time ticker for active producing steps
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isPcpOrAdmin =
    currentUser.role === 'PCP' ||
    currentUser.role === 'ADMIN' ||
    currentUser.role === 'MANAGER' ||
    currentUser.role === 'LIDER';

  const opLogs = auditLogs
    .filter((log) => log.entityId === order.id || order.steps.some((s) => s.id === log.entityId))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const formatSeconds = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) {
      return `${h}h ${m}m ${s}s`;
    }
    return `${m}m ${s}s`;
  };

  const getStepElapsedTime = (step: OperationStep) => {
    if (step.status === 'FINALIZADA' && step.actualStartTime && step.actualEndTime) {
      const ms = new Date(step.actualEndTime).getTime() - new Date(step.actualStartTime).getTime();
      const sec = Math.max(0, Math.floor(ms / 1000));
      return formatSeconds(sec);
    }
    if ((step.status === 'PRODUZINDO' || step.status === 'PAUSADA') && step.actualStartTime) {
      const ms = now - new Date(step.actualStartTime).getTime();
      const sec = Math.max(0, Math.floor(ms / 1000));
      return formatSeconds(sec);
    }
    return null;
  };

  const currentStep = order.steps.find(
    (s) => s.status === 'PRODUZINDO' || s.status === 'PAUSADA' || s.status === 'PRONTA'
  ) || order.steps[order.steps.length - 1];

  const activeFinishStep = order.steps.find((s) => s.id === activeFinishStepId);
  const activePauseStep = order.steps.find((s) => s.id === activePauseStepId);

  return (
    <div className="space-y-6">
      {/* 1. Header Card: Onde a OP Está & Métricas Gerais */}
      <div className="rounded-2xl border border-[#E5DAD3] bg-white p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <OpProductThumbnail
              thumbnail={order.productThumbnail}
              layoutImage={order.layoutPreviewImage || order.layoutImage}
              opNumber={order.opNumber}
              size="xl"
              onClick={() => setIsLayoutModalOpen(true)}
              className="shadow-sm border-2 border-[#E30A78]/20 shrink-0"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black tracking-widest text-[#B30A5C] font-mono">
                  ROTEIRO OPERACIONAL DA OP
                </span>
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-pink-50 text-[#B30A5C] border border-pink-200">
                  OP #{order.opNumber}
                </span>
                <span
                  className={`text-xs font-mono font-extrabold px-2.5 py-0.5 rounded-full ${
                    order.status === 'PRODUCAO_CONCLUIDA' || order.status === 'FINALIZADA'
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                      : order.status === 'EM_PRODUCAO'
                      ? 'bg-pink-100 text-[#B30A5C] border border-pink-300 animate-pulse'
                      : order.status === 'EXPEDICAO'
                      ? 'bg-blue-100 text-blue-700 border border-blue-300'
                      : 'bg-[#F2EBE6] text-[#3A3034] border border-[#E5DAD3]'
                  }`}
                >
                  {order.status === 'PRODUCAO_CONCLUIDA' ? 'PRODUÇÃO CONCLUÍDA' : order.status}
                </span>
              </div>

              <h2 className="text-2xl font-black text-[#1C1418] mt-1.5 flex items-center gap-2">
                <span>{order.productName}</span>
                <span className="text-sm font-normal text-[#6E615B] font-mono">({order.client})</span>
              </h2>

              <div className="flex flex-wrap items-center gap-3 text-xs text-[#6E615B] mt-1">
                <span>
                  Pedido: <strong className="text-[#1C1418] font-mono">{order.orderNumber}</strong>
                </span>
                <span>•</span>
                <span>
                  Prazo: <strong className="text-[#1C1418]">{new Date(order.deadline).toLocaleDateString('pt-BR')}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setIsLayoutModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pink-50 hover:bg-pink-100 text-[#B30A5C] font-bold text-xs border border-pink-200 transition-colors cursor-pointer ml-1 shadow-2xs"
                >
                  <Eye className="w-3.5 h-3.5 text-[#E30A78]" />
                  <span>Ver Layout Técnico Completo</span>
                </button>
              </div>
            </div>
          </div>

          {/* Location Badge (ONDE A OP ESTÁ) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="bg-[#FAF5F1] p-3 rounded-xl border border-[#E5DAD3] flex items-center gap-3">
              <div
                className={`w-3.5 h-3.5 rounded-full shrink-0 ${
                  order.status === 'FINALIZADA' || order.status === 'PRODUCAO_CONCLUIDA'
                    ? 'bg-emerald-500'
                    : currentStep?.status === 'PRODUZINDO'
                    ? 'bg-emerald-500 animate-ping'
                    : currentStep?.status === 'PAUSADA'
                    ? 'bg-amber-500'
                    : 'bg-blue-500'
                }`}
              />
              <div>
                <span className="text-[10px] font-bold text-[#8A7D77] uppercase block">
                  Localização Atual da OP
                </span>
                <span className="text-sm font-extrabold text-[#1C1418] flex items-center gap-1.5">
                  {order.status === 'FINALIZADA' || order.status === 'PRODUCAO_CONCLUIDA' ? (
                    '✅ Expedição Finalizada'
                  ) : (
                    <>
                      <span>{currentStep?.processName || 'Em Espera'}</span>
                      <span className="text-xs font-mono text-amber-600 font-semibold">
                        ({currentStep?.assignedMachineName || 'Aguardando'})
                      </span>
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* PCP Priority Controls */}
            {isPcpOrAdmin && (
              <div className="flex items-center gap-1 bg-[#FAF5F1] p-1.5 rounded-xl border border-[#E5DAD3]">
                {(['VERDE', 'AMARELO', 'VERMELHO'] as PriorityLevel[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setManualPriority(order.id, p)}
                    title={`Prioridade ${p}`}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-black font-mono transition-all ${
                      order.priority === p
                        ? p === 'VERDE'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : p === 'AMARELO'
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'bg-rose-600 text-white shadow-sm'
                        : 'text-[#6E615B] hover:text-[#1C1418] hover:bg-[#F2EBE6]'
                    }`}
                  >
                    {p === 'VERMELHO' ? 'URGENTE' : p === 'AMARELO' ? 'ALERTA' : 'NORMAL'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Balance & Loss KPI Bar (Regra dos Saldos entre Etapas) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-[#E5DAD3]">
          <div className="bg-[#FAF5F1] p-3 rounded-xl border border-[#E5DAD3]">
            <span className="text-[10px] font-bold text-[#8A7D77] uppercase block">
              1. Quantidade Original (OP)
            </span>
            <span className="text-lg font-black font-mono text-[#1C1418] block mt-0.5">
              {order.targetQuantity.toLocaleString('pt-BR')}{' '}
              <span className="text-xs font-medium text-[#6E615B]">{order.unit}</span>
            </span>
          </div>

          <div className="bg-[#FAF5F1] p-3 rounded-xl border border-[#E5DAD3]">
            <span className="text-[10px] font-bold text-[#8A7D77] uppercase block">
              2. Saldo Atual Liberado
            </span>
            <span className="text-lg font-black font-mono text-emerald-600 block mt-0.5">
              {(order.currentGoodQuantity || (order.steps[0]?.status === 'PRONTA' ? order.targetQuantity : 0)).toLocaleString('pt-BR')}{' '}
              <span className="text-xs font-medium text-[#6E615B]">{order.unit}</span>
            </span>
          </div>

          <div className="bg-[#FAF5F1] p-3 rounded-xl border border-[#E5DAD3]">
            <span className="text-[10px] font-bold text-[#8A7D77] uppercase block">
              3. Perdas Acumuladas
            </span>
            <span
              className={`text-lg font-black font-mono block mt-0.5 ${
                order.totalLosses > 0 ? 'text-rose-600' : 'text-[#8A7D77]'
              }`}
            >
              {order.totalLosses > 0 ? `-${order.totalLosses.toLocaleString('pt-BR')}` : '0'}{' '}
              <span className="text-xs font-medium text-[#6E615B]">{order.unit}</span>
            </span>
          </div>

          <div className="bg-[#FAF5F1] p-3 rounded-xl border border-[#E5DAD3]">
            <span className="text-[10px] font-bold text-[#8A7D77] uppercase block">
              4. Rendimento do Lote
            </span>
            <span className="text-lg font-black font-mono text-[#1C1418] block mt-0.5">
              {order.targetQuantity > 0
                ? `${(((order.targetQuantity - order.totalLosses) / order.targetQuantity) * 100).toFixed(1)}%`
                : '100%'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Technical Summary & Visual Layout reference */}
      {order.layoutImage && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-amber-700 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-amber-600" />
              <span>LAYOUT APROVADO & DESENHO TÉCNICO VINCULADO</span>
            </span>
            <span className="text-[11px] font-mono font-bold text-amber-700 bg-white px-2.5 py-0.5 rounded-full border border-amber-200">
              Acompanha todas as máquinas
            </span>
          </div>
          <div className="rounded-xl overflow-hidden border border-amber-200/80 bg-white max-h-72 flex items-center justify-center p-2">
            <img
              src={order.layoutImage}
              alt={`Layout da OP ${order.opNumber}`}
              className="max-h-64 object-contain rounded-lg"
            />
          </div>
        </div>
      )}

      {order.aiAnalysis && (
        <div className="rounded-2xl border border-[#E5DAD3] bg-white p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-[#1C1418]">
                Motor de Inteligência OpenAI ({order.aiAnalysis.model || 'GPT-4o'})
              </span>
              <p className="text-[11px] text-[#6E615B]">
                Leitura multimodal com {order.aiAnalysis.confidence || 98}% de confiança e roteirização validada pelo Motor Bella Top.
              </p>
            </div>
          </div>
          {order.aiAnalysis.warnings && order.aiAnalysis.warnings.length > 0 && (
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
              {order.aiAnalysis.warnings.length} alerta(s) de PCP
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Visual Spec Card */}
        <div className="rounded-2xl border border-[#E5DAD3] bg-white p-4 space-y-3">
          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">
            FICHA TÉCNICA DO PRODUTO
          </span>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between border-b border-[#FAF5F1] pb-1.5">
              <span className="text-[#6E615B]">Material / Gramatura:</span>
              <span className="font-bold text-[#1C1418]">
                {order.material} {order.grammage}g ({order.color})
              </span>
            </div>
            <div className="flex justify-between border-b border-[#FAF5F1] pb-1.5">
              <span className="text-[#6E615B]">Dimensões:</span>
              <span className="font-bold text-[#1C1418] font-mono">
                {order.dimensions?.width || 0} × {order.dimensions?.height || 0}
                {order.dimensions?.gusset ? ` + ${order.dimensions.gusset}mm fundo` : ' mm'}
              </span>
            </div>
            <div className="flex justify-between border-b border-[#FAF5F1] pb-1.5">
              <span className="text-[#6E615B]">Tipo de Alça:</span>
              <span className="font-bold text-[#1C1418]">{order.handleType || 'NÃO APLICÁVEL'}</span>
            </div>
            <div className="flex justify-between border-b border-[#FAF5F1] pb-1.5">
              <span className="text-[#6E615B]">Visor Transparente:</span>
              <span className={`font-bold ${order.hasVisor ? 'text-blue-600' : 'text-[#6E615B]'}`}>
                {order.hasVisor ? 'SIM (Com Visor)' : 'NÃO (Sem Visor)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6E615B]">Cordão / Fio:</span>
              <span className={`font-bold ${order.hasDrawstring ? 'text-amber-600' : 'text-[#6E615B]'}`}>
                {order.hasDrawstring ? 'SIM (Com Cordão)' : 'NÃO'}
              </span>
            </div>
          </div>
        </div>

        {/* Impression Specs */}
        <div className="rounded-2xl border border-[#E5DAD3] bg-white p-4 space-y-3">
          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">
            ESPECIFICAÇÕES DE IMPRESSÃO & ARTE
          </span>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between border-b border-[#FAF5F1] pb-1.5">
              <span className="text-[#6E615B]">Processo de Impressão:</span>
              <span className="font-bold text-[#1C1418] uppercase">
                {order.printing?.type || 'SEM IMPRESSÃO'}
              </span>
            </div>
            <div className="flex justify-between border-b border-[#FAF5F1] pb-1.5">
              <span className="text-[#6E615B]">Nº de Cores:</span>
              <span className="font-bold text-[#1C1418] font-mono">
                {order.printing?.colorsCount || 0} Cor(es)
              </span>
            </div>
            <div className="flex justify-between border-b border-[#FAF5F1] pb-1.5">
              <span className="text-[#6E615B]">Impressão Frente:</span>
              <span className="font-medium text-[#1C1418] truncate max-w-[180px]" title={order.printing?.front}>
                {order.printing?.front || '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6E615B]">Impressão Verso:</span>
              <span className="font-medium text-[#1C1418] truncate max-w-[180px]" title={order.printing?.back}>
                {order.printing?.back || '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Technical Notes & Safety Margin */}
        <div className="rounded-2xl border border-[#E5DAD3] bg-white p-4 space-y-3">
          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">
            OBSERVAÇÕES TÉCNICAS & CRONOGRAMA
          </span>
          <p className="text-xs text-[#3A3034] bg-[#FAF5F1] p-2.5 rounded-xl border border-[#E5DAD3] min-h-[60px] italic">
            {order.technicalNotes || 'Nenhuma observação técnica adicional informada na OP.'}
          </p>
          <div className="flex items-center justify-between text-xs text-[#6E615B] pt-1">
            <span>Criada em {new Date(order.createdAt).toLocaleDateString('pt-BR')}</span>
            <span className="font-bold text-emerald-600 font-mono">
              {order.steps.filter((s) => s.status === 'FINALIZADA').length} de {order.steps.length} etapas concluídas
            </span>
          </div>
        </div>
      </div>

      {/* 3. FLUXO SEQUENCIAL DO ROTEIRO (Cards Dinâmicos com Saldo Repassado) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-[#1C1418] flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-500" />
              <span>Etapas Sequenciais do Roteiro de Fabricação</span>
            </h3>
            <p className="text-xs text-[#6E615B] mt-0.5">
              A saída boa de cada etapa é rigorosamente a entrada da próxima etapa (sem reinvenção de saldos).
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-[#8A7D77] bg-white px-3 py-1.5 rounded-xl border border-[#E5DAD3]">
            {order.steps.length} Etapas Definidas
          </span>
        </div>

        {/* Step List Container */}
        <div className="space-y-3">
          {order.steps.map((step, idx) => {
            const isDone = step.status === 'FINALIZADA';
            const isProducing = step.status === 'PRODUZINDO';
            const isPaused = step.status === 'PAUSADA';
            const isReady = step.status === 'PRONTA';
            const isWaiting = step.status === 'AGUARDANDO_ANTERIOR' || step.status === 'BLOQUEADA';
            const isLast = idx === order.steps.length - 1;

            const elapsedTime = getStepElapsedTime(step);

            return (
              <div key={step.id} className="space-y-3">
                {/* Step Card */}
                <div
                  className={`rounded-2xl border p-4 sm:p-5 transition-all relative overflow-hidden ${
                    isDone
                      ? 'bg-white border-[#E5DAD3]'
                      : isProducing
                      ? 'bg-emerald-50/50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
                      : isPaused
                      ? 'bg-amber-50/50 border-amber-500 ring-2 ring-amber-500/20'
                      : isReady
                      ? 'bg-blue-50/40 border-blue-400'
                      : 'bg-[#FAF5F1]/80 border-[#E5DAD3] opacity-75'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Sequence Number, Process Name & Machine */}
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm font-mono shrink-0 shadow-sm ${
                          isDone
                            ? 'bg-emerald-500 text-white'
                            : isProducing
                            ? 'bg-emerald-600 text-white animate-pulse'
                            : isPaused
                            ? 'bg-amber-500 text-white'
                            : isReady
                            ? 'bg-blue-600 text-white'
                            : 'bg-[#E5DAD3] text-[#6E615B]'
                        }`}
                      >
                        {isDone ? '✓' : idx + 1}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-black text-[#1C1418]">
                            {step.processName.toUpperCase()}
                          </span>

                          {(step.hasCord || (step.processTypeId === 'proc_solda' && order.hasDrawstring)) && (
                            <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
                              Cordão: SIM (Corte + Solda + Cordão)
                            </span>
                          )}

                          <span
                            className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              isDone
                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                                : isProducing
                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-400 animate-pulse'
                                : isPaused
                                ? 'bg-amber-100 text-amber-700 border border-amber-300'
                                : isReady
                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                : 'bg-[#F2EBE6] text-[#6E615B]'
                            }`}
                          >
                            {isDone
                              ? 'CONCLUÍDO'
                              : isProducing
                              ? 'EM PRODUÇÃO'
                              : isPaused
                              ? 'PAUSADO'
                              : isReady
                              ? 'LIBERADA'
                              : 'BLOQUEADA'}
                          </span>
                        </div>

                        {/* Machine & Assigned Operator */}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-[#6E615B] mt-1.5">
                          {step.processTypeId === 'proc_expedicao' || step.isManual ? (
                            <span className="flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                              Processo Manual • Expedição
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                              <Cpu className="w-3.5 h-3.5" />
                              {step.assignedMachineName}
                            </span>
                          )}

                          {step.activeOperatorName ? (
                            <span className="flex items-center gap-1 font-medium text-[#1C1418]">
                              <UserCheck className="w-3.5 h-3.5 text-[#8A7D77]" />
                              Resp: {step.activeOperatorName}
                            </span>
                          ) : step.processTypeId === 'proc_expedicao' || step.isManual ? (
                            <span className="flex items-center gap-1 font-medium text-[#1C1418]">
                              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                              Resp: Carlos
                            </span>
                          ) : (
                            <span className="text-[#8A7D77]">
                              Resp: {step.assignedMachineName.includes('Refiladeira') ? 'Welton' : step.assignedMachineName.includes('Flexografia') ? 'Gabriel' : step.assignedMachineName.includes('Carrossel') ? 'Viola / Toninho' : 'Toninho / Operador'}
                            </span>
                          )}

                          {elapsedTime && (
                            <span className="flex items-center gap-1 font-mono font-bold text-amber-700 bg-white px-2 py-0.5 rounded border border-[#E5DAD3]">
                              <Clock className="w-3 h-3 text-amber-500" />
                              {elapsedTime}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Middle: Physical Loss & Propagation Balance */}
                    <div className="flex items-center gap-3 bg-[#FAF5F1] p-3 rounded-xl border border-[#E5DAD3] text-xs font-mono self-stretch lg:self-auto justify-between sm:justify-start">
                      {/* Received / Entrada */}
                      <div>
                        <span className="text-[10px] font-bold text-[#8A7D77] uppercase block font-sans">
                          Entrada Recebida
                        </span>
                        <span className="text-[#1C1418] font-bold text-sm">
                          {step.receivedQuantity.toLocaleString('pt-BR')}{' '}
                          <span className="text-[10px] text-[#6E615B]">{step.unit}</span>
                        </span>
                      </div>

                      <ArrowRight className="w-4 h-4 text-[#8A7D77] shrink-0" />

                      {/* Loss / Perdas */}
                      <div>
                        <span className="text-[10px] font-bold text-[#8A7D77] uppercase block font-sans">
                          Perda
                        </span>
                        {step.lossQuantity > 0 ? (
                          <span className="text-rose-600 font-extrabold text-sm">
                            -{step.lossQuantity.toLocaleString('pt-BR')}{' '}
                            <span className="text-[10px] text-rose-500">{step.unit}</span>
                          </span>
                        ) : (
                          <span className="text-[#8A7D77] font-bold text-sm">0 {step.unit}</span>
                        )}
                      </div>

                      <ArrowRight className="w-4 h-4 text-[#8A7D77] shrink-0" />

                      {/* Good Output / Saída Boa */}
                      <div>
                        <span className="text-[10px] font-bold text-[#8A7D77] uppercase block font-sans">
                          Saída Boa
                        </span>
                        <span
                          className={`font-black text-sm ${
                            isDone ? 'text-emerald-700' : 'text-[#8A7D77]'
                          }`}
                        >
                          {isDone
                            ? `${step.goodQuantity.toLocaleString('pt-BR')} ${step.unit}`
                            : isReady || isProducing || isPaused
                            ? `Meta: ${step.receivedQuantity.toLocaleString('pt-BR')} ${step.unit}`
                            : `Previsto: ${order.targetQuantity.toLocaleString('pt-BR')} ${step.unit}`}
                        </span>
                      </div>
                    </div>

                    {/* Right: Operational Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isReady && (
                        <button
                          onClick={() => startOperation(step.id, step.assignedMachineId)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all shadow flex items-center gap-1.5"
                        >
                          <PlayCircle className="w-4 h-4" />
                          <span>INICIAR ETAPA</span>
                        </button>
                      )}

                      {isProducing && (
                        <>
                          <button
                            onClick={() => setActivePauseStepId(step.id)}
                            className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-black text-xs transition-all shadow flex items-center gap-1.5"
                          >
                            <PauseCircle className="w-4 h-4" />
                            <span>PAUSAR</span>
                          </button>
                          <button
                            onClick={() => setActiveFinishStepId(step.id)}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all shadow flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>FINALIZAR ETAPA</span>
                          </button>
                        </>
                      )}

                      {isPaused && (
                        <>
                          <button
                            onClick={() => resumeOperation(step.id, step.assignedMachineId)}
                            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all shadow flex items-center gap-1.5"
                          >
                            <PlayCircle className="w-4 h-4" />
                            <span>RETOMAR</span>
                          </button>
                          <button
                            onClick={() => setActiveFinishStepId(step.id)}
                            className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-black text-xs transition-all shadow flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>FINALIZAR ETAPA</span>
                          </button>
                        </>
                      )}

                      {/* PCP machine switcher if not finished and not manual */}
                      {isPcpOrAdmin && !isDone && step.processTypeId !== 'proc_expedicao' && !step.isManual && (
                        <select
                          value={step.assignedMachineId || ''}
                          onChange={(e) => updateStepMachine(step.id, e.target.value)}
                          className="bg-white border border-[#E5DAD3] text-xs text-[#1C1418] rounded-xl px-2.5 py-2 font-medium focus:border-amber-400"
                        >
                          {machines
                            .filter((m) => m.processTypeId === step.processTypeId)
                            .map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Pause Warning if paused */}
                  {isPaused && (
                    <div className="mt-3 p-2.5 rounded-xl bg-amber-100 border border-amber-300 text-amber-700 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        <strong>Etapa Pausada:</strong> {step.lossReason || 'Pausa operacional em andamento.'}
                      </span>
                    </div>
                  )}

                  {/* Registered Loss Details if finalized with loss */}
                  {isDone && step.lossQuantity > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-[#FAF5F1] text-[11px] text-[#6E615B] flex flex-wrap items-center gap-3">
                      <span className="text-rose-600 font-bold">
                        ⚠️ Perda registrada: {step.lossQuantity} {step.unit}
                      </span>
                      {step.lossClassification && (
                        <span>• Classificação: {LOSS_CLASSIFICATION_LABELS[step.lossClassification]}</span>
                      )}
                      {step.lossDestination && (
                        <span>• Destino: {LOSS_DESTINATION_LABELS[step.lossDestination]}</span>
                      )}
                      {step.lossReason && <span>• Motivo: {step.lossReason}</span>}
                    </div>
                  )}
                </div>

                {/* Arrow connector between steps with propagated balance */}
                {!isLast && (
                  <div className="flex items-center justify-center gap-2 py-1 text-xs text-[#8A7D77] font-mono font-bold">
                    <ArrowDown className="w-4 h-4 text-amber-500" />
                    <span>
                      {isDone ? (
                        <span className="text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          ↓ Libera exatamente {step.goodQuantity.toLocaleString('pt-BR')} {step.unit} para{' '}
                          {order.steps[idx + 1]?.processName}
                        </span>
                      ) : (
                        <span className="text-[#8A7D77]">
                          ↓ Aguardando término para liberar saldo
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Final Expedition Card / Conclusão */}
      {order.status === 'EXPEDICAO' && (
        <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-300 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
              <h4 className="text-base font-black text-emerald-950">
                Lote de Produção Finalizado & Pronto para Expedição!
              </h4>
            </div>
            <p className="text-xs text-emerald-900 mt-1">
              Todas as etapas operacionais foram concluídas com sucesso. Saldo final liberado:{' '}
              <strong className="font-mono text-sm">{order.currentGoodQuantity.toLocaleString('pt-BR')} {order.unit}</strong>{' '}
              (Perdas totais do processo: {order.totalLosses} {order.unit}).
            </p>
          </div>

          <button
            onClick={() => {
              dispatchOp(order.id, 'Produção 100% concluída e liberada para envio.');
            }}
            className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-2 shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>CONFERIR & FINALIZAR PRODUÇÃO</span>
          </button>
        </div>
      )}

      {/* 5. Production Completed Confirmation Banner */}
      {(order.status === 'PRODUCAO_CONCLUIDA' || order.status === 'FINALIZADA') && (
        <div className="p-5 rounded-2xl bg-emerald-100/70 border border-emerald-400 text-emerald-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
              ✓
            </div>
            <div>
              <h4 className="font-black text-sm text-emerald-900">PRODUÇÃO CONCLUÍDA</h4>
              <p className="text-xs text-emerald-700">
                Ordem de Produção concluída em todas as etapas. Total fabricado:{' '}
                <strong>{order.currentGoodQuantity.toLocaleString('pt-BR')} {order.unit}</strong>.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold bg-white px-3 py-1 rounded-lg border border-emerald-300 text-emerald-700">
            {order.totalLosses} perdas acumuladas
          </span>
        </div>
      )}

      {/* 6. Chronological Audit History for this OP */}
      <div className="rounded-2xl border border-[#E5DAD3] bg-white p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-black text-sm text-[#1C1418] flex items-center gap-2">
            <History className="w-4 h-4 text-amber-500" />
            <span>Histórico Cronológico da OP (Rastreabilidade em Tempo Real)</span>
          </h4>
          <span className="text-[11px] text-[#8A7D77] font-mono">
            {opLogs.length} Registros Auditados
          </span>
        </div>

        {opLogs.length === 0 ? (
          <p className="text-xs text-[#8A7D77] py-3 italic">
            Nenhuma movimentação registrada até o momento.
          </p>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {opLogs.map((log) => (
              <div
                key={log.id}
                className="text-xs p-2.5 rounded-xl bg-[#FAF5F1] border border-[#E5DAD3] flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
              >
                <div>
                  <span className="font-bold text-[#1C1418]">{log.userName}: </span>
                  <span className="text-[#3A3034]">{log.details}</span>
                </div>
                <span className="text-[10px] font-mono text-[#8A7D77] shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modais de Operação */}
      {activePauseStep && (
        <PauseModal
          isOpen={!!activePauseStepId}
          onClose={() => setActivePauseStepId(null)}
          onConfirm={(reason) => {
            pauseOperation(activePauseStep.id, reason);
            setActivePauseStepId(null);
          }}
          machineName={activePauseStep.assignedMachineName}
          opNumber={order.opNumber}
        />
      )}

      {activeFinishStep && (
        <FinishStepModal
          isOpen={!!activeFinishStepId}
          onClose={() => setActiveFinishStepId(null)}
          onConfirm={(data) => {
            finishOperation(activeFinishStep.id, data);
            setActiveFinishStepId(null);
          }}
          machineName={activeFinishStep.assignedMachineName}
          processName={activeFinishStep.processName}
          opNumber={order.opNumber}
          receivedQuantity={activeFinishStep.receivedQuantity}
          unit={activeFinishStep.unit}
        />
      )}

      {/* Full Layout Modal */}
      <FullLayoutModal
        order={order}
        isOpen={isLayoutModalOpen}
        onClose={() => setIsLayoutModalOpen(false)}
      />
    </div>
  );
};
