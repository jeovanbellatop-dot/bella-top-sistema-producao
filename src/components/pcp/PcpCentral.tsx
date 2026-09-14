import React, { useState } from 'react';
import { useMesStore } from '../../hooks/useMesStore';
import {
  FileText,
  Upload,
  Search,
  Filter,
  Layers,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Eye
} from 'lucide-react';
import { PriorityBadge } from '../dashboard/FactoryOverview';
import { PriorityLevel, ProductionOrder } from '../../types/mes';
import { OpProductThumbnail } from '../common/OpProductThumbnail';
import { FullLayoutModal } from './FullLayoutModal';

interface PcpCentralProps {
  onOpenUpload: () => void;
  onSelectOp: (opId: string) => void;
}

export const PcpCentral: React.FC<PcpCentralProps> = ({ onOpenUpload, onSelectOp }) => {
  const { orders } = useMesStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedLayoutOp, setSelectedLayoutOp] = useState<ProductionOrder | null>(null);

  const filteredOrders = orders.filter((op) => {
    const matchesSearch =
      op.opNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      op.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
      op.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      op.orderNumber.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPriority = selectedPriority === 'ALL' || op.priority === selectedPriority;
    const matchesStatus = selectedStatus === 'ALL' || op.status === selectedStatus;

    return matchesSearch && matchesPriority && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-[#E5DAD3] p-5 rounded-2xl">
        <div>
          <h2 className="text-xl font-extrabold text-[#1C1418] flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#E30A78]" />
            <span>PCP • Central de Planejamento e Controle da Produção</span>
          </h2>
          <p className="text-xs text-[#6E615B] mt-0.5">
            Gestão de Ordens de Produção com vínculo visual do layout oficial, fotos extraídas e programação.
          </p>
        </div>

        <button
          onClick={onOpenUpload}
          className="px-5 py-2.5 bg-gradient-to-r from-[#E30A78] to-[#B30A5C] hover:from-[#d1096e] hover:to-[#a00952] text-white font-extrabold text-xs rounded-xl shadow-lg shadow-pink-500/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95 shrink-0"
        >
          <Upload className="w-4 h-4 stroke-[2.5]" />
          <span>CARREGAR OP & LAYOUT</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-[#E5DAD3] p-4 rounded-xl text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-[#6E615B] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por OP, Cliente, Produto, Pedido..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#FAF5F1] border border-[#E5DAD3] text-[#1C1418] rounded-lg pl-9 pr-3 py-2 text-xs placeholder-[#9A8B84] focus:outline-none focus:border-[#E30A78]"
          />
        </div>

        {/* Priority Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-[#6E615B] text-[11px] font-semibold">Prioridade:</span>
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="bg-[#FAF5F1] border border-[#E5DAD3] text-[#1C1418] rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-[#E30A78]"
          >
            <option value="ALL">Todas as Prioridades</option>
            <option value="VERMELHO">🔴 Vermelho (Urgente)</option>
            <option value="AMARELO">🟡 Amarelo (Atenção)</option>
            <option value="VERDE">🟢 Verde (No Prazo)</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-[#6E615B] text-[11px] font-semibold">Status:</span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-[#FAF5F1] border border-[#E5DAD3] text-[#1C1418] rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-[#E30A78]"
          >
            <option value="ALL">Todos os Status</option>
            <option value="EM_PRODUCAO">Em Produção</option>
            <option value="PROGRAMADA">Programada</option>
            <option value="REVISAO_PCP">Revisão PCP</option>
            <option value="EXPEDICAO">Expedição</option>
            <option value="FINALIZADA">Finalizada</option>
          </select>
        </div>
      </div>

      {/* Main OPs List */}
      <div className="bg-white border border-[#E5DAD3] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF5F1] text-[#6E615B] uppercase text-[10px] tracking-wider border-b border-[#E5DAD3] font-semibold">
              <tr>
                <th className="py-3.5 px-4">Identidade da OP</th>
                <th className="py-3.5 px-4">Cliente</th>
                <th className="py-3.5 px-4">Produto & Especificações</th>
                <th className="py-3.5 px-4">Qtd Planejada</th>
                <th className="py-3.5 px-4">Roteiro / Etapas</th>
                <th className="py-3.5 px-4">Prioridade</th>
                <th className="py-3.5 px-4">Prazo de Entrega</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DAD3] font-medium text-[#3A3034]">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#8A7D77] text-xs">
                    <p className="font-semibold text-[#6E615B] text-sm">Nenhuma Ordem de Produção localizada.</p>
                    <p className="mt-1 text-[#8A7D77]">Utilize o botão "CARREGAR OP & LAYOUT" acima para importar e gerar o roteiro produtivo.</p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((op) => {
                const completedSteps = op.steps.filter((s) => s.status === 'FINALIZADA').length;
                const totalSteps = op.steps.length;
                const progressPct = Math.round((completedSteps / totalSteps) * 100);
                const currentStep = op.steps[op.currentStepIndex] || op.steps[0];

                return (
                  <tr
                    key={op.id}
                    onClick={() => onSelectOp(op.id)}
                    className="hover:bg-[#FAF5F1] transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <OpProductThumbnail
                          thumbnail={op.productThumbnail}
                          layoutImage={op.layoutPreviewImage || op.layoutImage}
                          opNumber={op.opNumber}
                          size="sm"
                          onClick={() => setSelectedLayoutOp(op)}
                        />
                        <div>
                          <div className="font-extrabold text-[#1C1418] font-mono text-sm flex items-center gap-1.5">
                            <span>#{op.opNumber}</span>
                          </div>
                          <div className="text-[10px] text-[#6E615B] font-mono">{op.orderNumber}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-bold text-[#1C1418]">{op.client}</td>

                    <td className="py-3.5 px-4">
                      <div className="text-[#1C1418] font-semibold">{op.productName}</div>
                      <div className="text-[11px] text-[#6E615B]">
                        {op.material} {op.grammage}g • {op.printing?.type || 'Liso'} ({op.printing?.colorsCount || 0} cores)
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono">
                      <div className="font-black text-[#1C1418]">
                        {op.targetQuantity.toLocaleString('pt-BR')} {op.unit}
                      </div>
                      <div className="text-[10px] text-emerald-700 font-bold">
                        Bom: {(op.currentGoodQuantity || op.targetQuantity).toLocaleString('pt-BR')}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-[#F2EBE6] rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-[#E30A78] h-full rounded-full"
                            style={{ width: `${progressPct}%` }}
                          ></div>
                        </div>
                        <span className="text-[10px] font-mono text-[#3A3034]">
                          {completedSteps}/{totalSteps}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#B30A5C] font-semibold mt-0.5 truncate max-w-[150px]">
                        Atual: {currentStep?.processName}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <PriorityBadge priority={op.priority} />
                    </td>

                    <td className="py-3.5 px-4 font-mono text-xs">
                      <div className="text-[#1C1418]">
                        {new Date(op.deadline).toLocaleDateString('pt-BR')}
                      </div>
                      <div
                        className={`text-[10px] font-bold ${
                          op.safetyMarginHours >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {op.safetyMarginHours >= 0
                          ? `+${op.safetyMarginHours}h margem`
                          : `${op.safetyMarginHours}h crítico`}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono uppercase ${
                          op.status === 'EM_PRODUCAO'
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            : op.status === 'PROGRAMADA'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-[#F2EBE6] text-[#3A3034] border border-[#E5DAD3]'
                        }`}
                      >
                        {op.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLayoutOp(op);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-pink-50 hover:bg-pink-100 text-[#B30A5C] border border-[#F5C6DC] text-[11px] font-bold transition-colors inline-flex items-center gap-1"
                        title="Ver Layout Completo"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#E30A78]" />
                        <span>Layout</span>
                      </button>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full Layout Interactive Modal */}
      {selectedLayoutOp && (
        <FullLayoutModal
          order={selectedLayoutOp}
          isOpen={!!selectedLayoutOp}
          onClose={() => setSelectedLayoutOp(null)}
        />
      )}
    </div>
  );
};
