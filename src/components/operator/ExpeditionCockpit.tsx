import React, { useState } from 'react';
import { useMesStore } from '../../hooks/useMesStore';
import {
  PackageCheck,
  CheckCircle2,
  Clock,
  Play,
  Pause,
  AlertTriangle,
  UserCheck,
  Eye,
  Layers,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Search,
  Filter,
} from 'lucide-react';
import { OpProductThumbnail } from '../common/OpProductThumbnail';
import { FullLayoutModal } from '../pcp/FullLayoutModal';
import { FinishStepModal } from './FinishStepModal';
import { PauseModal } from './PauseModal';
import { ProductionOrder, OperationStep } from '../../types/mes';

interface ExpeditionCockpitProps {
  onSelectOp?: (opId: string) => void;
}

export const ExpeditionCockpit: React.FC<ExpeditionCockpitProps> = ({ onSelectOp }) => {
  const {
    orders,
    authenticatedUser,
    currentUser,
    startOperation,
    pauseOperation,
    resumeOperation,
    finishOperation,
  } = useMesStore();

  const activeUser = authenticatedUser || currentUser;

  const [filterStatus, setFilterStatus] = useState<'ALL' | 'READY' | 'PRODUCING' | 'WAITING' | 'DONE'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLayoutOp, setSelectedLayoutOp] = useState<ProductionOrder | null>(null);
  const [activeFinishStep, setActiveFinishStep] = useState<{ step: OperationStep; order: ProductionOrder } | null>(null);
  const [activePauseStepId, setActivePauseStepId] = useState<string | null>(null);

  // Filter all orders that contain an expedition step (proc_expedicao)
  const expeditionItems: Array<{
    order: ProductionOrder;
    step: OperationStep;
    state: 'WAITING' | 'READY' | 'PRODUCING' | 'PAUSED' | 'DONE';
    pendingStepName?: string;
  }> = [];

  orders.forEach((order) => {
    const expStep = order.steps.find((s) => s.processTypeId === 'proc_expedicao');
    if (!expStep) return;

    // Check if previous steps are finished
    const previousPending = order.steps
      .filter((s) => s.sequenceIndex < expStep.sequenceIndex)
      .find((s) => s.status !== 'FINALIZADA');

    let state: 'WAITING' | 'READY' | 'PRODUCING' | 'PAUSED' | 'DONE' = 'WAITING';

    if (expStep.status === 'FINALIZADA') {
      state = 'DONE';
    } else if (expStep.status === 'PRODUZINDO') {
      state = 'PRODUCING';
    } else if (expStep.status === 'PAUSADA') {
      state = 'PAUSED';
    } else if (!previousPending && expStep.receivedQuantity > 0) {
      state = 'READY';
    } else {
      state = 'WAITING';
    }

    expeditionItems.push({
      order,
      step: expStep,
      state,
      pendingStepName: previousPending?.processName,
    });
  });

  // Filter items
  const filteredItems = expeditionItems.filter((item) => {
    // Status filter
    if (filterStatus === 'READY' && item.state !== 'READY') return false;
    if (filterStatus === 'PRODUCING' && item.state !== 'PRODUCING' && item.state !== 'PAUSED') return false;
    if (filterStatus === 'WAITING' && item.state !== 'WAITING') return false;
    if (filterStatus === 'DONE' && item.state !== 'DONE') return false;

    // Search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchOp = item.order.opNumber.toLowerCase().includes(term);
      const matchClient = item.order.client.toLowerCase().includes(term);
      const matchProduct = item.order.productName.toLowerCase().includes(term);
      if (!matchOp && !matchClient && !matchProduct) return false;
    }

    return true;
  });

  const countReady = expeditionItems.filter((i) => i.state === 'READY').length;
  const countProducing = expeditionItems.filter((i) => i.state === 'PRODUCING' || i.state === 'PAUSED').length;
  const countWaiting = expeditionItems.filter((i) => i.state === 'WAITING').length;
  const countDone = expeditionItems.filter((i) => i.state === 'DONE').length;

  return (
    <div className="max-w-5xl mx-auto pb-16 space-y-6">
      {/* 1. Header do Responsável e da Estação Manual */}
      <div className="rounded-3xl border border-[#E5DAD3] bg-white p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5DAD3] pb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-lg shadow-md shrink-0">
              <PackageCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-black text-[#1C1418] tracking-tight">
                  Expedição & Embalagem
                </h1>
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 font-extrabold uppercase">
                  Processo Manual
                </span>
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-pink-100 text-[#B30A5C] border border-pink-200 font-extrabold uppercase">
                  Sem Máquina
                </span>
              </div>
              <p className="text-xs text-[#6E615B] mt-0.5">
                Responsável:{' '}
                <strong className="text-[#1C1418] font-bold">
                  {activeUser.name || 'Carlos'}
                </strong>{' '}
                · Setor de Expedição & Liberação Final
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl border border-emerald-200 text-xs font-bold shrink-0">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <span>Carlos (Responsável Humano)</span>
          </div>
        </div>

        {/* Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <button
            onClick={() => setFilterStatus('READY')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              filterStatus === 'READY'
                ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20'
                : 'bg-[#FAF5F1] border-[#E5DAD3] hover:bg-[#F2EBE6]'
            }`}
          >
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 block">
              Prontas p/ Embalar
            </span>
            <span className="text-2xl font-black text-emerald-700 font-mono">
              {countReady}
            </span>
          </button>

          <button
            onClick={() => setFilterStatus('PRODUCING')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              filterStatus === 'PRODUCING'
                ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20'
                : 'bg-[#FAF5F1] border-[#E5DAD3] hover:bg-[#F2EBE6]'
            }`}
          >
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 block">
              Em Embalagem
            </span>
            <span className="text-2xl font-black text-blue-800 font-mono">
              {countProducing}
            </span>
          </button>

          <button
            onClick={() => setFilterStatus('WAITING')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              filterStatus === 'WAITING'
                ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20'
                : 'bg-[#FAF5F1] border-[#E5DAD3] hover:bg-[#F2EBE6]'
            }`}
          >
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 block">
              Aguardando Produção
            </span>
            <span className="text-2xl font-black text-amber-700 font-mono">
              {countWaiting}
            </span>
          </button>

          <button
            onClick={() => setFilterStatus('DONE')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              filterStatus === 'DONE'
                ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-500/20'
                : 'bg-[#FAF5F1] border-[#E5DAD3] hover:bg-[#F2EBE6]'
            }`}
          >
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700 block">
              Concluídas / Expedidas
            </span>
            <span className="text-2xl font-black text-purple-800 font-mono">
              {countDone}
            </span>
          </button>
        </div>
      </div>

      {/* 2. Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-[#8A7D77] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por OP, cliente ou produto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-[#E5DAD3] text-xs text-[#1C1418] rounded-xl pl-9 pr-3 py-2 font-medium focus:border-[#E30A78] focus:outline-none shadow-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFilterStatus('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterStatus === 'ALL'
                ? 'bg-[#1C1418] text-white shadow-sm'
                : 'bg-white text-[#6E615B] hover:bg-[#FAF5F1] border border-[#E5DAD3]'
            }`}
          >
            Todas ({expeditionItems.length})
          </button>
          <button
            onClick={() => setFilterStatus('READY')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterStatus === 'READY'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
            }`}
          >
            Liberadas ({countReady})
          </button>
          <button
            onClick={() => setFilterStatus('PRODUCING')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterStatus === 'PRODUCING'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-blue-700 hover:bg-blue-50 border border-blue-200'
            }`}
          >
            Em Embalagem ({countProducing})
          </button>
          <button
            onClick={() => setFilterStatus('WAITING')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterStatus === 'WAITING'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-white text-amber-700 hover:bg-amber-50 border border-amber-200'
            }`}
          >
            Aguardando ({countWaiting})
          </button>
          <button
            onClick={() => setFilterStatus('DONE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterStatus === 'DONE'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-white text-purple-700 hover:bg-purple-50 border border-purple-200'
            }`}
          >
            Concluídas ({countDone})
          </button>
        </div>
      </div>

      {/* 3. Lista de OPs na Fila de Expedição */}
      {filteredItems.length === 0 ? (
        <div className="rounded-3xl border border-[#E5DAD3] bg-white p-12 text-center space-y-3">
          <PackageCheck className="w-12 h-12 text-[#9A8B84] mx-auto" />
          <h3 className="text-base font-bold text-[#1C1418]">
            Nenhuma ordem encontrada nesta categoria
          </h3>
          <p className="text-xs text-[#6E615B] max-w-md mx-auto">
            Assim que as etapas anteriores liberarem as peças, as ordens surgirão aqui para conferência e embalagem pelo Carlos.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map(({ order, step, state, pendingStepName }) => {
            const isReady = state === 'READY';
            const isProducing = state === 'PRODUCING';
            const isPaused = state === 'PAUSED';
            const isDone = state === 'DONE';
            const isWaiting = state === 'WAITING';

            return (
              <div
                key={order.id}
                className={`rounded-3xl border p-5 transition-all relative overflow-hidden ${
                  isProducing
                    ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/20 shadow-lg'
                    : isReady
                    ? 'bg-white border-emerald-300 shadow-md'
                    : isPaused
                    ? 'bg-white border-amber-400 ring-2 ring-amber-500/20 shadow-md'
                    : isDone
                    ? 'bg-[#FAF5F1]/80 border-[#E5DAD3] opacity-80'
                    : 'bg-[#FAF5F1]/70 border-[#E5DAD3]'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  {/* Left: Thumbnail, OP Details, Client, Specs */}
                  <div className="flex items-start gap-4">
                    {/* Visual Bag Thumbnail with Layout Zoom */}
                    <div className="relative group shrink-0">
                      <OpProductThumbnail
                        order={order}
                        size="md"
                        showZoom={true}
                        onZoomClick={() => setSelectedLayoutOp(order)}
                        className="rounded-2xl shadow-sm border border-[#E5DAD3]"
                      />
                      <button
                        onClick={() => setSelectedLayoutOp(order)}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center text-white text-[10px] font-bold gap-1 cursor-pointer"
                        title="Ampliar Layout Aprovado"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver Layout</span>
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-black text-base text-[#1C1418]">
                          OP #{order.opNumber}
                        </span>
                        <span className="text-xs text-[#6E615B] font-medium">
                          {order.client}
                        </span>

                        {/* Status Tag */}
                        <span
                          className={`text-[10px] font-mono font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                            isDone
                              ? 'bg-purple-100 text-purple-800 border border-purple-300'
                              : isProducing
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-400 animate-pulse'
                              : isPaused
                              ? 'bg-amber-100 text-amber-700 border border-amber-300'
                              : isReady
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-300 font-black'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {isDone
                            ? 'CONCLUÍDA / EXPEDIDA'
                            : isProducing
                            ? 'EM EMBALAGEM'
                            : isPaused
                            ? 'PAUSADA'
                            : isReady
                            ? 'LIBERADA PARA EXPEDIÇÃO'
                            : 'AGUARDANDO PRODUÇÃO'}
                        </span>
                      </div>

                      <h4 className="font-extrabold text-sm text-[#1C1418]">
                        {order.productName}
                      </h4>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#6E615B]">
                        <span>
                          Medidas:{' '}
                          <strong className="text-[#1C1418]">
                            {order.dimensions.width}x{order.dimensions.height} cm
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          Material:{' '}
                          <strong className="text-[#1C1418]">
                            {order.material} {order.grammage}g ({order.color})
                          </strong>
                        </span>
                        {order.handleType && (
                          <>
                            <span>•</span>
                            <span>
                              Alça:{' '}
                              <strong className="text-[#1C1418]">
                                {order.handleType}
                              </strong>
                            </span>
                          </>
                        )}
                      </div>

                      {/* Technical Notes / Packaging Guidelines */}
                      {order.technicalNotes && (
                        <p className="text-[11px] text-[#8A7D77] italic bg-[#FAF5F1] px-2.5 py-1 rounded-lg border border-[#E5DAD3] inline-block mt-1">
                          Instruções: {order.technicalNotes}
                        </p>
                      )}

                      {/* Waiting Notice */}
                      {isWaiting && pendingStepName && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-700 font-bold bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200 mt-1">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>
                            Aguardando conclusão da etapa anterior: {pendingStepName}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Middle: Quantities & Inherited Balance */}
                  <div className="flex items-center gap-3 bg-[#FAF5F1] p-3.5 rounded-2xl border border-[#E5DAD3] text-xs font-mono shrink-0">
                    <div>
                      <span className="text-[10px] font-bold text-[#8A7D77] uppercase block font-sans">
                        Recebido Anterior
                      </span>
                      <span className="text-[#1C1418] font-bold text-sm">
                        {step.receivedQuantity > 0
                          ? `${step.receivedQuantity.toLocaleString('pt-BR')} ${step.unit}`
                          : `Previsto: ${order.targetQuantity.toLocaleString('pt-BR')} ${step.unit}`}
                      </span>
                    </div>

                    <ArrowRight className="w-4 h-4 text-[#8A7D77]" />

                    <div>
                      <span className="text-[10px] font-bold text-[#8A7D77] uppercase block font-sans">
                        Perdas
                      </span>
                      <span
                        className={`text-sm font-bold ${
                          step.lossQuantity > 0 ? 'text-rose-600' : 'text-[#8A7D77]'
                        }`}
                      >
                        {step.lossQuantity} {step.unit}
                      </span>
                    </div>

                    <ArrowRight className="w-4 h-4 text-[#8A7D77]" />

                    <div>
                      <span className="text-[10px] font-bold text-emerald-700 uppercase block font-sans">
                        Saída Final
                      </span>
                      <span className="text-emerald-700 font-black text-sm">
                        {isDone
                          ? `${step.goodQuantity.toLocaleString('pt-BR')} ${step.unit}`
                          : `${step.receivedQuantity || order.targetQuantity} ${step.unit}`}
                      </span>
                    </div>
                  </div>

                  {/* Right: Operational Actions for Carlos */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setSelectedLayoutOp(order)}
                      className="p-2.5 rounded-xl bg-white hover:bg-[#F2EBE6] text-[#6E615B] hover:text-[#1C1418] border border-[#E5DAD3] text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                      title="Ver Layout & Dossiê Técnico"
                    >
                      <Eye className="w-4 h-4" />
                      <span className="hidden sm:inline">Layout</span>
                    </button>

                    {isReady && (
                      <button
                        onClick={() => startOperation(step.id, activeUser.id)}
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer"
                      >
                        <Play className="w-4 h-4 fill-white" />
                        <span>INICIAR EMBALAGEM</span>
                      </button>
                    )}

                    {isProducing && (
                      <>
                        <button
                          onClick={() => setActivePauseStepId(step.id)}
                          className="px-3 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-black text-xs transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                        >
                          <Pause className="w-4 h-4 fill-white" />
                          <span>PAUSAR</span>
                        </button>

                        <button
                          onClick={() => setActiveFinishStep({ step, order })}
                          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>FINALIZAR EXPEDIÇÃO</span>
                        </button>
                      </>
                    )}

                    {isPaused && (
                      <>
                        <button
                          onClick={() => resumeOperation(step.id, activeUser.id)}
                          className="px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                        >
                          <Play className="w-4 h-4 fill-white" />
                          <span>RETOMAR</span>
                        </button>

                        <button
                          onClick={() => setActiveFinishStep({ step, order })}
                          className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-black text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>FINALIZAR EXPEDIÇÃO</span>
                        </button>
                      </>
                    )}

                    {isDone && (
                      <span className="px-3 py-1.5 rounded-xl bg-purple-50 text-purple-800 border border-purple-200 text-xs font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-purple-600" />
                        <span>Expedida</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Finalização de Etapa / Apontamento de Perdas de Embalagem */}
      {activeFinishStep && (
        <FinishStepModal
          isOpen={true}
          onClose={() => setActiveFinishStep(null)}
          onConfirm={(data) => {
            finishOperation(activeFinishStep.step.id, data, activeUser.id);
            setActiveFinishStep(null);
          }}
          machineName="Expedição Manual"
          processName="Expedição & Embalagem"
          opNumber={activeFinishStep.order.opNumber}
          receivedQuantity={activeFinishStep.step.receivedQuantity}
          unit={activeFinishStep.step.unit}
        />
      )}

      {/* Modal de Pausa Operacional */}
      {activePauseStepId && (
        <PauseModal
          isOpen={true}
          onClose={() => setActivePauseStepId(null)}
          onConfirm={(reason) => {
            pauseOperation(activePauseStepId, reason, activeUser.id);
            setActivePauseStepId(null);
          }}
        />
      )}

      {/* Modal de Visualização do Layout Oficial */}
      {selectedLayoutOp && (
        <FullLayoutModal
          isOpen={true}
          onClose={() => setSelectedLayoutOp(null)}
          order={selectedLayoutOp}
        />
      )}
    </div>
  );
};
