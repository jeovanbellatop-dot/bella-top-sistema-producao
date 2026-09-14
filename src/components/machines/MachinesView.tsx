import React, { useState } from 'react';
import { useMesStore } from '../../hooks/useMesStore';
import {
  Cpu,
  PlayCircle,
  PauseCircle,
  Clock,
  Gauge,
  Layers,
  ArrowRight,
  Filter,
  CheckCircle2
} from 'lucide-react';
import { MachineStatus, MACHINE_STATUS_LABELS } from '../../types/mes';
import { OpProductThumbnail } from '../common/OpProductThumbnail';

interface MachinesViewProps {
  onSelectMachineForCockpit: (machineId: string) => void;
  onSelectOp: (opId: string) => void;
}

export const MachinesView: React.FC<MachinesViewProps> = ({
  onSelectMachineForCockpit,
  onSelectOp,
}) => {
  const { machines, orders, users, getMachineQueue } = useMesStore();
  const [sectorFilter, setSectorFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const sectors = Array.from(new Set(machines.map((m) => m.sector)));

  const filteredMachines = machines.filter((m) => {
    const matchesSector = sectorFilter === 'ALL' || m.sector === sectorFilter;
    const matchesStatus = statusFilter === 'ALL' || m.status === statusFilter;
    return matchesSector && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-[#E5DAD3] p-5 rounded-2xl">
        <div>
          <h2 className="text-xl font-extrabold text-[#1C1418] flex items-center gap-2">
            <Cpu className="w-5 h-5 text-amber-400" />
            <span>Parque Industrial de Máquinas • Bella Top</span>
          </h2>
          <p className="text-xs text-[#6E615B] mt-0.5">
            Monitoramento de velocidade real vs nominal, filas ativas, tempos de setup e eficiência operacional.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="bg-[#FAF5F1] border border-[#E5DAD3] text-[#1C1418] rounded-lg px-2.5 py-1.5 text-xs focus:border-amber-400 focus:outline-none"
          >
            <option value="ALL">Todos os Setores</option>
            {sectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#FAF5F1] border border-[#E5DAD3] text-[#1C1418] rounded-lg px-2.5 py-1.5 text-xs focus:border-amber-400 focus:outline-none"
          >
            <option value="ALL">Todos os Status</option>
            <option value="DISPONIVEL">Aguardando</option>
            <option value="SETUP">Setup</option>
            <option value="PRODUZINDO">Produzindo</option>
            <option value="PAUSADA">Pausada</option>
            <option value="MANUTENCAO">Manutenção</option>
            <option value="QUALIDADE">Qualidade</option>
            <option value="INATIVA">Inativa</option>
          </select>
        </div>
      </div>

      {/* Grid of Machines */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredMachines.map((machine) => {
          const currentOp = orders.find((o) => o.id === machine.currentOpId);
          const currentStep = currentOp?.steps.find((s) => s.id === machine.currentOperationId);
          const queue = getMachineQueue(machine.id);

          const isProducing = machine.status === 'PRODUZINDO';
          const isPaused = machine.status === 'PAUSADA';
          const isUnavailable =
            !machine.isActive ||
            machine.status === 'MANUTENCAO' ||
            machine.status === 'INATIVA';

          return (
            <div
              key={machine.id}
              className={`bg-white border rounded-2xl p-5 flex flex-col justify-between transition-all ${
                isProducing
                  ? 'border-emerald-700/50 ring-1 ring-emerald-500/20 shadow-lg'
                  : isPaused
                  ? 'border-amber-700/50 bg-amber-950/10'
                  : 'border-[#E5DAD3]'
              }`}
            >
              <div>
                {/* Top Info */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#F2EBE6] text-amber-300 font-bold border border-[#E5DAD3]">
                        {machine.code}
                      </span>
                      <h3 className="font-extrabold text-sm text-[#1C1418]">{machine.name}</h3>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[11px] text-[#6E615B]">Setor: {machine.sector}</p>
                      {(() => {
                        const operator = users.find(
                          (u) =>
                            u.authorizedMachineIds.includes(machine.id) &&
                            (u.role === 'OPERATOR' || u.role === 'LIDER')
                        );
                        return operator ? (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-semibold">
                            👤 Operador: {operator.name}
                          </span>
                        ) : null;
                      })()}
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase font-mono ${
                      isProducing
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : isPaused
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                        : 'bg-[#F2EBE6] text-[#6E615B] border border-[#E5DAD3]'
                    }`}
                  >
                    ● {MACHINE_STATUS_LABELS[machine.status] || machine.status}
                  </span>
                </div>

                {/* Technical Parameters */}
                <div className="grid grid-cols-2 gap-2 mt-4 p-3 rounded-xl bg-[#FAF5F1] border border-[#E5DAD3] text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-[#8A7D77] uppercase block">Velocidade</span>
                    <span className="text-[#1C1418] font-bold">
                      {machine.nominalSpeed > 0
                        ? machine.nominalSpeed + ' ' + (machine.productionUnit === 'METROS' ? 'm/min' : 'un/h')
                        : 'SEM DADO REAL'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-[#8A7D77] uppercase block">Eficiência OEE</span>
                    <span className="text-emerald-400 font-bold">
                      {(machine.historicalEfficiencyFactor * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Current Active Job */}
                {currentOp && currentStep ? (
                  <div className="mt-4 p-3 rounded-xl bg-[#FAF5F1] border border-[#E5DAD3] space-y-2">
                    <div className="flex items-center gap-2.5">
                      <OpProductThumbnail
                        thumbnail={currentOp.productThumbnail}
                        layoutImage={currentOp.layoutPreviewImage || currentOp.layoutImage}
                        opNumber={currentOp.opNumber}
                        size="md"
                        className="shrink-0 shadow-2xs"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-bold text-[#1C1418]">
                            OP #{currentOp.opNumber}
                          </span>
                          <span className="text-[#6E615B] text-[11px] truncate max-w-[110px]">
                            {currentOp.client}
                          </span>
                        </div>
                        <div className="text-xs text-[#1C1418] font-semibold truncate mt-0.5">
                          {currentOp.productName}
                        </div>
                      </div>
                    </div>

                    <div className="w-full bg-[#F2EBE6] rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (currentStep.producedQuantity / currentStep.receivedQuantity) * 100
                            )
                          )}%`,
                        }}
                      ></div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#6E615B] font-mono">
                      <span>
                        Produzido: {currentStep.producedQuantity.toLocaleString('pt-BR')} /{' '}
                        {currentStep.receivedQuantity.toLocaleString('pt-BR')} {currentStep.unit}
                      </span>
                    </div>

                    {isPaused && (
                      <div className="p-2 rounded bg-amber-950/40 border border-amber-900/60 text-[11px] text-amber-300">
                        ⚠️ Pausa: {machine.currentPauseReason}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 p-3 rounded-xl bg-[#FAF5F1] border border-[#E5DAD3] text-center py-4 text-[#8A7D77] text-xs">
                    {isUnavailable
                      ? 'INDISPONÍVEL — não recebe novas OPs'
                      : 'Disponível para receber nova OP'}
                  </div>
                )}

                {/* Next in Queue */}
                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#6E615B] font-semibold uppercase">Fila de Espera:</span>
                    <span className="font-mono text-[#E30A78] font-bold">{queue.length} OPs</span>
                  </div>

                  {queue.length > 0 ? (
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {queue.slice(0, 3).map((item, idx) => (
                        <div
                          key={item.step.id}
                          onClick={() => onSelectOp(item.order.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-white border border-[#E5DAD3] text-[11px] flex items-center justify-between hover:border-[#E30A78]/50 hover:bg-pink-50/30 cursor-pointer transition-colors shadow-2xs"
                        >
                          <div className="flex items-center gap-2">
                            <OpProductThumbnail
                              thumbnail={item.order.productThumbnail}
                              layoutImage={item.order.layoutPreviewImage || item.order.layoutImage}
                              opNumber={item.order.opNumber}
                              size="xs"
                              className="shrink-0"
                            />
                            <span className="font-mono text-[#1C1418] font-bold">
                              #{idx + 1} OP {item.order.opNumber}
                            </span>
                          </div>
                          <span className="text-emerald-600 font-mono font-bold text-[10px]">
                            {item.step.receivedQuantity.toLocaleString('pt-BR')} {item.step.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-[#8A7D77] italic">Fila vazia</div>
                  )}
                </div>
              </div>

              {/* Action */}
              <div className="mt-5 pt-3 border-t border-[#E5DAD3] flex items-center justify-between">
                <button
                  onClick={() => !isUnavailable && onSelectMachineForCockpit(machine.id)}
                  disabled={isUnavailable}
                  className="w-full py-2 bg-[#F2EBE6] hover:bg-[#E8DED8] text-amber-400 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Abrir Terminal do Operador</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
