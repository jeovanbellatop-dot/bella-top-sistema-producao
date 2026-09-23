import React from 'react';
import { useMesStore } from '../../hooks/useMesStore';
import {
  Cpu,
  PlayCircle,
  PauseCircle,
  AlertOctagon,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Layers,
  ArrowRight,
  Clock,
  Gauge,
  Percent,
  Flame
} from 'lucide-react';
import { PriorityLevel } from '../../types/mes';
import { OpProductThumbnail } from '../common/OpProductThumbnail';

interface FactoryOverviewProps {
  onSelectOp: (opId: string) => void;
  onSelectMachine: (machineId: string) => void;
  onOpenUpload: () => void;
}

export const FactoryOverview: React.FC<FactoryOverviewProps> = ({
  onSelectOp,
  onSelectMachine,
  onOpenUpload,
}) => {
  const { machines, orders, processTypes } = useMesStore();

  const totalMachines = machines.length;
  const producingMachines = machines.filter((m) => m.status === 'PRODUZINDO');
  const pausedMachines = machines.filter((m) => m.status === 'PAUSADA');
  const availableMachines = machines.filter((m) => m.status === 'DISPONIVEL');

  const activeOrders = orders.filter(
    (o) => o.status === 'EM_PRODUCAO' || o.status === 'PROGRAMADA' || o.status === 'REVISAO_PCP'
  );
  const greenOrders = activeOrders.filter((o) => o.priority === 'VERDE');
  const yellowOrders = activeOrders.filter((o) => o.priority === 'AMARELO');
  const redOrders = activeOrders.filter((o) => o.priority === 'VERMELHO');

  // Daily Totals calculation
  let totalUnitsProduced = 0;
  let totalLosses = 0;
  orders.forEach((o) => {
    o.steps.forEach((s) => {
      totalUnitsProduced += s.producedQuantity || 0;
      totalLosses += s.lossQuantity || 0;
    });
  });

  const totalAttempted = totalUnitsProduced + totalLosses;
  const scrapRatePct = totalAttempted > 0 ? ((totalLosses / totalAttempted) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Quick Stats */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white border border-[#E5DAD3] p-5 rounded-2xl shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-[#1C1418] flex items-center gap-2">
            <span>Visão Geral do Chão de Fábrica</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-normal border border-emerald-500/30">
              Operação em Tempo Real
            </span>
          </h2>
          <p className="text-xs text-[#6E615B] mt-0.5">
            Monitoramento centralizado de velocidade, filas de máquinas, apontamentos e controle de perdas.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenUpload}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <TrendingUp className="w-4 h-4" />
            <span>Processar Nova OP (PDF)</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Ribbon (Section 31) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        
        {/* Total Machines */}
        <div className="bg-white border border-[#E5DAD3] p-4 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#6E615B]">
            <span className="text-xs font-medium uppercase tracking-wider">Máquinas Cadastradas</span>
            <Cpu className="w-4 h-4 text-[#6E615B]" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-[#1C1418]">{totalMachines}</div>
            <div className="text-[11px] text-emerald-500 font-medium mt-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              {machines.filter(m => m.status !== 'MANUTENCAO').length} Operacionais
            </div>
          </div>
        </div>

        {/* Unavailable Machines */}
        <div className="bg-white border border-[#E5DAD3] p-4 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#6E615B]">
            <span className="text-xs font-medium uppercase tracking-wider">Indisponíveis</span>
            <PauseCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-rose-500">{machines.filter(m => m.status === 'MANUTENCAO').length}</div>
            <div className="text-[11px] text-[#6E615B] mt-0.5">
              Em Manutenção
            </div>
          </div>
        </div>

        {/* OPs in Production */}
        <div className="bg-white border border-[#E5DAD3] p-4 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#6E615B]">
            <span className="text-xs font-medium uppercase tracking-wider">OPs em Rota</span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-[#1C1418]">{activeOrders.length}</div>
            <div className="text-[11px] text-[#6E615B] mt-0.5">
              {orders.filter((o) => o.status === 'FINALIZADA').length} já concluídas
            </div>
          </div>
        </div>

        {/* Priority Green */}
        <div className="bg-white border border-emerald-900/40 p-4 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#6E615B]">
            <span className="text-xs font-medium uppercase tracking-wider text-emerald-400">No Prazo</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30"></span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-emerald-400">{greenOrders.length}</div>
            <div className="text-[11px] text-[#6E615B] mt-0.5">Margem segura</div>
          </div>
        </div>

        {/* Priority Yellow / Red */}
        <div className="bg-white border border-amber-900/40 p-4 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#6E615B]">
            <span className="text-xs font-medium uppercase tracking-wider text-amber-400">Atenção / Risco</span>
            <div className="flex gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-amber-300">
              {yellowOrders.length}{' '}
              <span className="text-rose-400 text-lg">/ {redOrders.length}</span>
            </div>
            <div className="text-[11px] text-rose-400 font-medium mt-0.5">
              {redOrders.length > 0 ? `${redOrders.length} críticas urgentes` : '0 atrasos iminentes'}
            </div>
          </div>
        </div>

        {/* Losses / Scrap rate */}
        <div className="bg-white border border-[#E5DAD3] p-4 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#6E615B]">
            <span className="text-xs font-medium uppercase tracking-wider">Taxa de Perdas</span>
            <Flame className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-rose-300">{scrapRatePct}%</div>
            <div className="text-[11px] text-[#6E615B] mt-0.5">
              {totalLosses.toLocaleString('pt-BR')} unidades perdidas
            </div>
          </div>
        </div>
      </div>

      {/* Active Machine Cards Fleet (Section 32) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[#1C1418] flex items-center gap-2">
            <Cpu className="w-4 h-4 text-amber-400" />
            <span>Painel Operacional das Máquinas</span>
          </h3>
          <span className="text-xs text-[#6E615B]">
            Clique em uma máquina para acessar a fila e terminal de apontamento
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {machines.map((machine) => {
            const currentOp = orders.find((o) => o.id === machine.currentOpId);
            // Etapa ja finalizada nao e mais "producao em andamento" nesta maquina:
            // o painel deve mostrar a maquina livre e a OP seguindo para a proxima etapa.
            const currentStepCandidate = currentOp?.steps.find((s) => s.id === machine.currentOperationId);
            const currentStep =
              currentStepCandidate && currentStepCandidate.status !== 'FINALIZADA'
                ? currentStepCandidate
                : undefined;
            const progress =
              currentStep && currentStep.receivedQuantity > 0
                ? Math.min(100, Math.round((currentStep.producedQuantity / currentStep.receivedQuantity) * 100))
                : 0;

            const isProducing = machine.status === 'PRODUZINDO';
            const isPaused = machine.status === 'PAUSADA';

            return (
              <div
                key={machine.id}
                onClick={() => onSelectMachine(machine.id)}
                className={`bg-white border rounded-xl p-4 transition-all hover:border-amber-400/60 hover:shadow-lg cursor-pointer flex flex-col justify-between ${
                  isProducing
                    ? 'border-emerald-700/50 ring-1 ring-emerald-500/20'
                    : isPaused
                    ? 'border-amber-700/50 bg-amber-950/10'
                    : 'border-[#E5DAD3]'
                }`}
              >
                {/* Machine Header */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-[#F2EBE6] text-[#3A3034] font-bold border border-[#E5DAD3]">
                          {machine.code}
                        </span>
                        <h4 className="font-bold text-sm text-[#1C1418]">{machine.name}</h4>
                      </div>
                      <p className="text-[11px] text-[#6E615B] mt-0.5">{machine.sector}</p>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 font-mono ${
                        isProducing
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : isPaused
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                          : 'bg-[#F2EBE6] text-[#6E615B] border border-[#E5DAD3]'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isProducing ? 'bg-emerald-400 animate-pulse' : isPaused ? 'bg-amber-400' : 'bg-[#9A8B84]'
                        }`}
                      ></span>
                      {machine.status}
                    </span>
                  </div>

                  {/* Current Active Job Content */}
                  {currentOp && currentStep ? (
                    <div className="mt-3.5 pt-3 border-t border-[#E5DAD3] space-y-2">
                      <div className="flex items-center gap-2.5">
                        <OpProductThumbnail
                          thumbnail={currentOp.productThumbnail}
                          layoutImage={currentOp.layoutPreviewImage || currentOp.layoutImage}
                          opNumber={currentOp.opNumber}
                          size="md"
                          className="shrink-0 shadow-xs"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-mono font-bold text-[#1C1418] flex items-center gap-1">
                              OP #{currentOp.opNumber}
                              <PriorityBadge priority={currentOp.priority} />
                            </span>
                            <span className="text-[#6E615B] text-[11px] truncate max-w-[120px]">
                              {currentOp.client}
                            </span>
                          </div>
                          <div className="text-xs text-[#3A3034] font-medium truncate mt-0.5">
                            {currentOp.productName}
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-[#3A3034] font-medium flex items-center justify-between">
                        <span className="text-[11px] text-[#6E615B]">Produção da Etapa:</span>
                        <span className="text-[11px] text-[#6E615B] font-mono font-bold">
                          {currentStep.producedQuantity.toLocaleString('pt-BR')} /{' '}
                          {currentStep.receivedQuantity.toLocaleString('pt-BR')} {currentStep.unit}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-[#F2EBE6] rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isPaused ? 'bg-amber-400' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[#6E615B] pt-1 font-mono">
                        <span>
                          {progress}% • Vel: {machine.nominalSpeed}{' '}
                          {machine.productionUnit === 'METROS' ? 'm/min' : 'un/h'}
                        </span>
                        <span className="flex items-center gap-1 text-[#3A3034]">
                          <Clock className="w-3 h-3 text-[#8A7D77]" />
                          Prev:{' '}
                          {new Date(currentOp.estimatedCompletionDate).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {isPaused && machine.currentPauseReason && (
                        <div className="p-2 rounded bg-amber-950/40 border border-amber-900/60 text-[11px] text-amber-300 font-medium mt-1">
                          ⚠️ Pausa: {machine.currentPauseReason}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 pt-3 border-t border-[#E5DAD3] text-center py-3 text-[#8A7D77] text-xs">
                      Nenhuma OP em execução no momento (Disponível)
                    </div>
                  )}
                </div>

                {/* Footer specs */}
                <div className="mt-3 pt-2.5 border-t border-[#E5DAD3] flex items-center justify-between text-[11px] text-[#6E615B]">
                  <span>
                    Eficiência Histórica: {(machine.historicalEfficiencyFactor * 100).toFixed(0)}%
                  </span>
                  <button
                    id={`btn_abrir_fila_${machine.id}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectMachine(machine.id);
                    }}
                    className="text-amber-500 hover:text-amber-600 font-bold hover:underline flex items-center gap-1 text-xs cursor-pointer py-1 px-2 rounded-lg hover:bg-amber-50 transition"
                  >
                    <span>Abrir Fila</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Production Orders Fleet Matrix (Section 30, 33, 54) */}
      <div className="bg-white border border-[#E5DAD3] rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-base text-[#1C1418] flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              <span>Acompanhamento Geral das Ordens de Produção (OPs)</span>
            </h3>
            <p className="text-xs text-[#6E615B]">
              Rastreamento em tempo real do avanço físico, roteiro e perdas registradas em cada etapa
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF5F1] text-[#6E615B] uppercase text-[10px] tracking-wider border-b border-[#E5DAD3] font-semibold">
              <tr>
                <th className="py-3 px-3">OP / Pedido</th>
                <th className="py-3 px-3">Cliente</th>
                <th className="py-3 px-3">Produto & Material</th>
                <th className="py-3 px-3">Qtd / Saldo Bom</th>
                <th className="py-3 px-3">Perdas Acumuladas</th>
                <th className="py-3 px-3">Etapa Atual / Máquina</th>
                <th className="py-3 px-3">Prioridade / Risco</th>
                <th className="py-3 px-3">Prazo</th>
                <th className="py-3 px-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DAD3] font-medium text-[#3A3034]">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#8A7D77] text-xs">
                    <p className="font-semibold text-[#6E615B] text-sm">Nenhuma Ordem de Produção ativa no momento.</p>
                    <p className="mt-1 text-[#8A7D77]">Faça o upload do documento PDF da OP para iniciar o fluxo industrial de fábrica.</p>
                  </td>
                </tr>
              ) : (
                orders.map((op) => {
                const currentStep = op.steps[op.currentStepIndex] || op.steps[0];
                return (
                  <tr
                    key={op.id}
                    className="hover:bg-[#F2EBE6] transition-colors cursor-pointer"
                    onClick={() => onSelectOp(op.id)}
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <OpProductThumbnail
                          thumbnail={op.productThumbnail}
                          layoutImage={op.layoutPreviewImage || op.layoutImage}
                          opNumber={op.opNumber}
                          size="sm"
                          className="shrink-0 shadow-2xs"
                        />
                        <div>
                          <div className="font-bold text-[#1C1418] font-mono flex items-center gap-1.5">
                            #{op.opNumber}
                          </div>
                          <div className="text-[10px] text-[#6E615B] font-mono">{op.orderNumber}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 font-semibold text-[#1C1418]">{op.client}</td>

                    <td className="py-3 px-3">
                      <div className="text-[#1C1418]">{op.productName}</div>
                      <div className="text-[10px] text-[#6E615B]">
                        {op.material} {op.grammage}g • {op.dimensions.width}x{op.dimensions.height}
                        {op.dimensions.gusset ? `+${op.dimensions.gusset}` : ''}mm
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono">
                      <div className="text-[#1C1418] font-bold">
                        {op.targetQuantity.toLocaleString('pt-BR')} {op.unit}
                      </div>
                      <div className="text-[10px] text-emerald-400">
                        Saldo: {(op.currentGoodQuantity || op.targetQuantity).toLocaleString('pt-BR')} un
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono">
                      {op.totalLosses > 0 ? (
                        <span className="text-rose-400 font-bold px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-800/40 text-[11px]">
                          -{op.totalLosses.toLocaleString('pt-BR')} un (
                          {((op.totalLosses / op.targetQuantity) * 100).toFixed(1)}%)
                        </span>
                      ) : (
                        <span className="text-[#8A7D77]">0 un</span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-semibold text-amber-300 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                        {currentStep?.processName || 'Roteiro'}
                      </div>
                      <div className="text-[10px] text-[#6E615B] font-mono">
                        {currentStep?.assignedMachineName}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <PriorityBadge priority={op.priority} />
                        <span className="text-[10px] text-[#6E615B] font-mono">
                          {op.safetyMarginHours > 0
                            ? `+${op.safetyMarginHours}h margem`
                            : `${op.safetyMarginHours}h crítico`}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px]">
                      {new Date(op.deadline).toLocaleDateString('pt-BR')}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectOp(op.id);
                        }}
                        className="px-2.5 py-1 rounded bg-[#F2EBE6] hover:bg-[#E8DED8] text-amber-400 font-semibold text-xs border border-[#E5DAD3]"
                      >
                        Ver Roteiro
                      </button>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const PriorityBadge: React.FC<{ priority: PriorityLevel }> = ({ priority }) => {
  if (priority === 'VERDE') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
        VERDE
      </span>
    );
  }
  if (priority === 'AMARELO') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
        AMARELO
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
      <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
      VERMELHO
    </span>
  );
};
