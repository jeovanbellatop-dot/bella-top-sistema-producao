import React, { useState } from 'react';
import { useMesStore } from '../../hooks/useMesStore';
import {
  Layers,
  Search,
  Plus,
  PlayCircle,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Package,
  Cpu,
  Sparkles,
  Inbox
} from 'lucide-react';
import { ProductionRouteFlow } from './ProductionRouteFlow';
import { ExtractedOpData } from '../../types/mes';

interface ProductionRouteViewProps {
  onOpenUpload?: () => void;
  onSelectOp?: (opId: string) => void;
}

export const ProductionRouteView: React.FC<ProductionRouteViewProps> = ({
  onOpenUpload,
  onSelectOp,
}) => {
  const { orders, currentUser, createOrderFromExtracted } = useMesStore();

  const [search, setSearch] = useState('');
  const [selectedOpId, setSelectedOpId] = useState<string>(orders[0]?.id || '');
  const [filterProcess, setFilterProcess] = useState<string>('ALL');

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.opNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.client.toLowerCase().includes(search.toLowerCase()) ||
      o.productName.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (filterProcess === 'ALL') return true;
    if (filterProcess === 'FINISHED') return o.status === 'PRODUCAO_CONCLUIDA' || o.status === 'FINALIZADA';
    if (filterProcess === 'IN_PRODUCTION') return o.status === 'EM_PRODUCAO';
    
    // Filter by current active step process
    const activeStep = o.steps.find((s) => s.status === 'PRODUZINDO' || s.status === 'PRONTA' || s.status === 'PAUSADA');
    if (filterProcess === 'REFILE') return activeStep?.processTypeId === 'proc_refile';
    if (filterProcess === 'FLEXO') return activeStep?.processTypeId === 'proc_flexografia';
    if (filterProcess === 'CORTE') return activeStep?.processTypeId === 'proc_solda';
    if (filterProcess === 'ALCA') return activeStep?.processTypeId === 'proc_colocar_alca';
    if (filterProcess === 'EXPEDICAO') return o.status === 'EXPEDICAO' || activeStep?.processTypeId === 'proc_expedicao';

    return true;
  });

  const selectedOrder = orders.find((o) => o.id === selectedOpId) || filteredOrders[0];

  // Helper to create the official Bella Top 1.000 test OP
  const handleCreateTestOp = (type: 'STANDARD' | 'NO_PRINT' | 'DRAWSTRING' | 'VAZADA') => {
    let testData: ExtractedOpData;
    const opNum = `${Math.floor(1000 + Math.random() * 9000)}`;

    if (type === 'STANDARD') {
      testData = {
        numeroOp: opNum,
        numeroPedido: `PED-${opNum}`,
        cliente: 'Lojas Riachuelo S/A',
        produtoNome: 'Sacola TNT Alça Fita 35x40',
        codigoProduto: 'BT-SAF-01',
        modelo: 'Sacola Alça Fita',
        quantidade: 1000,
        unidade: 'UNIDADES',
        material: 'TNT',
        gramatura: 80,
        corMaterial: 'Branco Neve',
        larguraMm: 350,
        alturaMm: 400,
        fundoMm: 100,
        medidasFormatadas: '35x40+10',
        tamanho: 'M',
        tipoImpressao: 'FLEXOGRAFIA',
        numeroCores: 2,
        impressaoFrente: 'Logomarca Riachuelo em Azul e Vermelho',
        impressaoVerso: 'Sem Impressão',
        personalizacao: 'Impressão flexográfica contínua 2 cores',
        tipoAlca: 'FITA',
        usoCordao: false,
        usoVisor: false,
        acabamentos: ['Solda Ultrassônica Lateral', 'Alça Fita Termossoldada'],
        observacoesTecnicas: 'Roteiro Padrão: Refile -> Flexografia -> Corte e Solda -> Alça -> Expedição',
        prazoEntrega: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
        confiancaLeitura: { geral: 98, numeroOp: 100, cliente: 99, produto: 97, quantidade: 100, gramatura: 100, medidas: 98, tipoImpressao: 100, prazo: 99 },
        precisaRevisaoPcp: false,
      };
    } else if (type === 'NO_PRINT') {
      testData = {
        numeroOp: opNum,
        numeroPedido: `PED-${opNum}`,
        cliente: 'Supermercados Guanabara',
        produtoNome: 'Sacola TNT Lisa Sem Impressão 40x50',
        codigoProduto: 'BT-SAF-02',
        modelo: 'Sacola Alça Fita Lisa',
        quantidade: 1000,
        unidade: 'UNIDADES',
        material: 'TNT',
        gramatura: 70,
        corMaterial: 'Verde Bandeira',
        larguraMm: 400,
        alturaMm: 500,
        fundoMm: 120,
        medidasFormatadas: '40x50+12',
        tamanho: 'G',
        tipoImpressao: 'SEM_IMPRESSAO',
        numeroCores: 0,
        impressaoFrente: 'Sem Impressão',
        impressaoVerso: 'Sem Impressão',
        personalizacao: 'Material liso sem estampas',
        tipoAlca: 'FITA',
        usoCordao: false,
        usoVisor: false,
        acabamentos: ['Alça Fita 50cm'],
        observacoesTecnicas: 'Roteiro Direto (Sem Impressão): Refile -> Corte e Solda -> Alça -> Expedição',
        prazoEntrega: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        confiancaLeitura: { geral: 100, numeroOp: 100, cliente: 100, produto: 100, quantidade: 100, gramatura: 100, medidas: 100, tipoImpressao: 100, prazo: 100 },
        precisaRevisaoPcp: false,
      };
    } else if (type === 'DRAWSTRING') {
      testData = {
        numeroOp: opNum,
        numeroPedido: `PED-${opNum}`,
        cliente: 'Academia SmartFit',
        produtoNome: 'Mochilinha TNT com Cordão Duplo 30x40',
        codigoProduto: 'BT-MOC-01',
        modelo: 'Mochilinha Esportiva',
        quantidade: 1000,
        unidade: 'UNIDADES',
        material: 'TNT',
        gramatura: 80,
        corMaterial: 'Preto',
        larguraMm: 300,
        alturaMm: 400,
        fundoMm: 0,
        medidasFormatadas: '30x40',
        tamanho: 'P',
        tipoImpressao: 'SERIGRAFIA',
        numeroCores: 1,
        impressaoFrente: 'Logo SmartFit em Amarelo',
        impressaoVerso: 'Sem Impressão',
        personalizacao: 'Serigrafia / Estamparia Carrossel',
        tipoAlca: 'CORDAO',
        usoCordao: true,
        usoVisor: false,
        acabamentos: ['Passar Cordão de Poliéster 4mm', 'Ilhós de Reforço'],
        observacoesTecnicas: 'Roteiro com Cordão: Refile -> Carrossel -> Corte e Solda (com Cordão) -> Expedição',
        prazoEntrega: new Date(Date.now() + 36 * 3600 * 1000).toISOString(),
        confiancaLeitura: { geral: 99, numeroOp: 100, cliente: 100, produto: 99, quantidade: 100, gramatura: 100, medidas: 99, tipoImpressao: 100, prazo: 99 },
        precisaRevisaoPcp: false,
      };
    } else {
      testData = {
        numeroOp: opNum,
        numeroPedido: `PED-${opNum}`,
        cliente: 'Farmácias Pague Menos',
        produtoNome: 'Sacola Alça Vazada 25x35 Sem Visor',
        codigoProduto: 'BT-SAV-01',
        modelo: 'Sacola Boca de Palhaço Vazada',
        quantidade: 1000,
        unidade: 'UNIDADES',
        material: 'TNT',
        gramatura: 60,
        corMaterial: 'Azul Real',
        larguraMm: 250,
        alturaMm: 350,
        fundoMm: 0,
        medidasFormatadas: '25x35',
        tamanho: 'P',
        tipoImpressao: 'FLEXOGRAFIA',
        numeroCores: 1,
        impressaoFrente: 'Logo Pague Menos em Branco',
        impressaoVerso: 'Sem Impressão',
        personalizacao: 'Flexografia contínua',
        tipoAlca: 'VAZADA',
        usoCordao: false,
        usoVisor: false,
        acabamentos: ['Alça Vazada Boca de Palhaço Integrada'],
        observacoesTecnicas: 'Roteiro Alça Vazada: Refile -> Flexografia -> Corte e Solda (Máquina 4 preferencial) -> Expedição',
        prazoEntrega: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
        confiancaLeitura: { geral: 99, numeroOp: 100, cliente: 100, produto: 99, quantidade: 100, gramatura: 100, medidas: 99, tipoImpressao: 100, prazo: 99 },
        precisaRevisaoPcp: false,
      };
    }

    const created = createOrderFromExtracted(testData);
    setSelectedOpId(created.id);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-6 h-6 text-amber-500" />
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#1C1418]">
              Roteiro de Atividades da Produção
            </h1>
          </div>
          <p className="text-sm text-[#6E615B] mt-1">
            Acompanhamento do fluxo operacional sequencial da OP do Refile até a Expedição final.
          </p>
        </div>

        {/* Quick Test Creator Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleCreateTestOp('STANDARD')}
            className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-extrabold text-xs transition-all shadow flex items-center gap-1.5"
            title="Criar OP de Teste Padrão 1.000 un (Refile -> Flexo -> Corte -> Alça -> Expedição)"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ OP Padrão (1.000 un)</span>
          </button>

          <button
            onClick={() => handleCreateTestOp('NO_PRINT')}
            className="px-3 py-2 rounded-xl bg-white border border-[#E5DAD3] hover:bg-[#FAF5F1] text-[#1C1418] font-bold text-xs transition-all shadow-sm flex items-center gap-1.5"
            title="Criar OP Lisa (Refile -> Corte -> Alça -> Expedição)"
          >
            <span>+ OP Sem Impressão</span>
          </button>

          <button
            onClick={() => handleCreateTestOp('DRAWSTRING')}
            className="px-3 py-2 rounded-xl bg-white border border-[#E5DAD3] hover:bg-[#FAF5F1] text-[#1C1418] font-bold text-xs transition-all shadow-sm flex items-center gap-1.5"
            title="Criar OP Mochilinha com Cordão (Refile -> Carrossel -> Corte e Solda com Cordão -> Expedição)"
          >
            <span>+ OP com Cordão</span>
          </button>
        </div>
      </div>

      {/* Main Layout: Left OP Selector List & Right Full Interactive Workflow */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: OP List with Filters (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl border border-[#E5DAD3] bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black tracking-wider text-amber-500 uppercase">
                SELECIONAR ORDEM DE PRODUÇÃO
              </span>
              <span className="text-xs font-mono font-bold text-[#8A7D77]">
                {filteredOrders.length} OPs
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#8A7D77] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar OP, cliente ou produto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E5DAD3] bg-[#FAF5F1] text-xs font-medium text-[#1C1418] focus:border-amber-400 focus:outline-none"
              />
            </div>

            {/* Quick Process Filters */}
            <div className="flex flex-wrap gap-1 text-[11px] pt-1">
              {[
                { id: 'ALL', label: 'Todas' },
                { id: 'IN_PRODUCTION', label: 'Em Produção' },
                { id: 'REFILE', label: 'Refile' },
                { id: 'FLEXO', label: 'Flexo' },
                { id: 'CORTE', label: 'Corte/Solda' },
                { id: 'EXPEDICAO', label: 'Expedição' },
                { id: 'FINISHED', label: 'Concluídas' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilterProcess(f.id)}
                  className={`px-2 py-1 rounded-lg font-bold transition-all ${
                    filterProcess === f.id
                      ? 'bg-amber-500 text-white'
                      : 'bg-[#FAF5F1] text-[#6E615B] hover:bg-[#F2EBE6] hover:text-[#1C1418]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* OP Item List */}
            <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1 pt-1">
              {filteredOrders.length === 0 ? (
                <div className="py-12 text-center text-[#8A7D77] space-y-2">
                  <Inbox className="w-8 h-8 mx-auto text-[#8A7D77]" />
                  <p className="text-xs font-semibold">Nenhuma OP encontrada no filtro.</p>
                  <button
                    onClick={() => handleCreateTestOp('STANDARD')}
                    className="text-xs text-amber-600 font-bold underline"
                  >
                    Criar OP de teste de 1.000 un
                  </button>
                </div>
              ) : (
                filteredOrders.map((order) => {
                  const isSelected = order.id === selectedOrder?.id;
                  const activeStep =
                    order.steps.find(
                      (s) => s.status === 'PRODUZINDO' || s.status === 'PAUSADA' || s.status === 'PRONTA'
                    ) || order.steps[order.steps.length - 1];

                  const isDone = order.status === 'PRODUCAO_CONCLUIDA' || order.status === 'FINALIZADA';

                  return (
                    <button
                      key={order.id}
                      onClick={() => setSelectedOpId(order.id)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-50/80 border-amber-500 shadow-sm ring-1 ring-amber-400'
                          : 'bg-[#FAF5F1]/70 border-[#E5DAD3] hover:bg-[#FAF5F1] hover:border-[#D0C4BD]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-black text-xs text-[#1C1418]">
                          OP #{order.opNumber}
                        </span>
                        <span
                          className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full ${
                            isDone
                              ? 'bg-emerald-100 text-emerald-700'
                              : order.status === 'EM_PRODUCAO'
                              ? 'bg-amber-100 text-amber-700 animate-pulse'
                              : 'bg-[#F2EBE6] text-[#6E615B]'
                          }`}
                        >
                          {isDone ? 'CONCLUÍDA' : activeStep?.processName || order.status}
                        </span>
                      </div>

                      <p className="text-xs font-bold text-[#1C1418] truncate mt-1">
                        {order.productName}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-[#6E615B] mt-1.5 pt-1.5 border-t border-[#E5DAD3]/50">
                        <span>{order.client}</span>
                        <span className="font-mono font-bold text-[#1C1418]">
                          {order.targetQuantity.toLocaleString('pt-BR')} {order.unit}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Complete Detailed Interactive Routing Workflow (8 cols) */}
        <div className="lg:col-span-8">
          {selectedOrder ? (
            <ProductionRouteFlow order={selectedOrder} />
          ) : (
            <div className="rounded-3xl border border-[#E5DAD3] bg-white p-16 text-center space-y-4">
              <Layers className="w-12 h-12 text-[#9A8B84] mx-auto" />
              <h3 className="text-lg font-bold text-[#1C1418]">Nenhuma OP selecionada</h3>
              <p className="text-sm text-[#6E615B] max-w-md mx-auto">
                Selecione uma ordem de produção na lista ao lado ou crie uma nova OP com o roteiro operacional da fábrica.
              </p>
              <button
                onClick={() => handleCreateTestOp('STANDARD')}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-extrabold text-xs shadow transition-all inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>CRIAR OP DE TESTE (1.000 UNIDADES)</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
