import React from 'react';
import { useMesStore } from '../../hooks/useMesStore';
import { Radio, Cpu, Activity, Zap, CheckCircle2 } from 'lucide-react';

export const IotGatewayView: React.FC = () => {
  const { machines, orders } = useMesStore();

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white border border-[#E5DAD3] p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#1C1418] flex items-center gap-2">
            <Radio className="w-5 h-5 text-cyan-400" />
            <span>Gateway IoT Industrial & Conectividade CLP / Sensores</span>
          </h2>
          <p className="text-xs text-[#6E615B] mt-0.5">
            Interface para integração via protocolo MQTT / OPC-UA com contadores ópticos e sensores de metragem.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-emerald-400 bg-[#FAF5F1] px-3 py-1.5 rounded-xl border border-emerald-900/60">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>Broker MQTT: Operacional (Port 1883)</span>
        </div>
      </div>

      {/* Sensor Stream Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {machines.map((m) => {
          const isProducing = m.status === 'PRODUZINDO';
          const isPaused = m.status === 'PAUSADA';
          const currentOp = orders.find((o) => o.id === m.currentOpId);

          return (
            <div
              key={m.id}
              className="bg-white border border-[#E5DAD3] rounded-2xl p-4 space-y-3 font-mono text-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-[#F2EBE6] text-amber-300 font-bold text-[11px]">
                    {m.code}
                  </span>
                  <span className="font-sans font-bold text-[#1C1418] text-xs">{m.name}</span>
                </div>
                <span
                  className={`w-2 h-2 rounded-full ${
                    isProducing ? 'bg-emerald-400' : isPaused ? 'bg-amber-400' : 'bg-[#C4B7AF]'
                  }`}
                ></span>
              </div>

              <div className="p-3 bg-[#FAF5F1] rounded-xl border border-[#E5DAD3] space-y-2">
                <div className="flex items-center justify-between text-[#6E615B] text-[11px]">
                  <span>Status Operacional:</span>
                  <span className={`font-bold ${isProducing ? 'text-emerald-400' : isPaused ? 'text-amber-400' : 'text-[#6E615B]'}`}>
                    {m.status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[#6E615B] text-[11px]">
                  <span>Velocidade Nominal:</span>
                  <span className="text-cyan-300 font-bold">
                    {m.nominalSpeed} {m.productionUnit === 'METROS' ? 'm/min' : 'un/h'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[#6E615B] text-[11px]">
                  <span>OP Vinculada:</span>
                  <span className="text-[#3A3034]">
                    {currentOp ? `OP #${currentOp.opNumber}` : 'Nenhuma'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[#6E615B] text-[11px]">
                  <span>Protocolo / Interface:</span>
                  <span className="text-[#6E615B]">OPC-UA / Modbus TCP</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
