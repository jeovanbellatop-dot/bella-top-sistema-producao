import React from 'react';
import { useMesStore } from '../../hooks/useMesStore';
import {
  BarChart3,
  TrendingUp,
  Flame,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Cpu
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

export const ReportsView: React.FC = () => {
  const { machines, orders, processTypes } = useMesStore();

  // Aggregate losses per process
  const processLossData: { [key: string]: { name: string; loss: number; produced: number } } = {};

  processTypes.forEach((pt) => {
    processLossData[pt.id] = { name: pt.name, loss: 0, produced: 0 };
  });

  orders.forEach((o) => {
    o.steps.forEach((s) => {
      if (processLossData[s.processTypeId]) {
        processLossData[s.processTypeId].loss += s.lossQuantity || 0;
        processLossData[s.processTypeId].produced += s.producedQuantity || 0;
      }
    });
  });

  const chartData = Object.values(processLossData);

  // Machine OEE data
  const oeeData = machines.map((m) => ({
    name: m.code,
    oee: Math.round(m.historicalEfficiencyFactor * 100),
    status: m.status,
  }));

  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1', '#06b6d4', '#ec4899'];

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white border border-[#E5DAD3] p-5 rounded-2xl">
        <h2 className="text-xl font-extrabold text-[#1C1418] flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-amber-400" />
          <span>Relatórios Gerenciais, OEE & Análise de Perdas</span>
        </h2>
        <p className="text-xs text-[#6E615B] mt-0.5">
          Indicadores de desempenho de chão de fábrica, taxa de refugo por estação e cumprimento de prazos.
        </p>
      </div>

      {/* 2 Charts Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Chart 1: Perdas vs Produção por Estação */}
        <div className="bg-white border border-[#E5DAD3] rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-[#1C1418] flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-rose-400" />
              <span>Volume de Produção e Perdas por Estação</span>
            </h3>
            <span className="text-[11px] text-[#6E615B]">Total Unidades</span>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" textAnchor="end" interval={0} angle={-25} style={{ fontSize: '10px' }} />
                <YAxis stroke="#64748b" style={{ fontSize: '10px' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar dataKey="produced" name="Produzido (Bom)" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="loss" name="Perdas (Refugo)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Eficiência OEE por Máquina */}
        <div className="bg-white border border-[#E5DAD3] rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-[#1C1418] flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-amber-400" />
              <span>Eficiência Operacional OEE por Máquina (%)</span>
            </h3>
            <span className="text-[11px] text-[#6E615B]">Meta: &gt; 85%</span>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={oeeData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" style={{ fontSize: '10px' }} />
                <YAxis domain={[0, 100]} stroke="#64748b" style={{ fontSize: '10px' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar dataKey="oee" name="OEE (%)" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
