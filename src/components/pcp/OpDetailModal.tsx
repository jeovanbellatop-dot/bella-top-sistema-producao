import React, { useState } from 'react';
import { useMesStore } from '../../hooks/useMesStore';
import {
  X,
  FileText,
  Calendar,
  Layers,
  Package,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ZoomIn,
  ShieldCheck,
  Maximize2,
  Info,
  ExternalLink,
  ChevronLeft,
  Tag,
  ArrowRight
} from 'lucide-react';
import { OpProductThumbnail } from '../common/OpProductThumbnail';
import { FullLayoutModal } from './FullLayoutModal';

interface OpDetailModalProps {
  opId: string | null;
  onClose: () => void;
  onSelectMachine?: (machineId: string) => void;
}

export const OpDetailModal: React.FC<OpDetailModalProps> = ({
  opId,
  onClose,
  onSelectMachine,
}) => {
  const { orders } = useMesStore();
  const [isPdfMissingModalOpen, setIsPdfMissingModalOpen] = useState(false);
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);

  if (!opId) return null;

  const order = orders.find((o) => o.id === opId);
  if (!order) return null;

  const handleOpenPdf = () => {
    // Verifica se existe PDF real anexado (URL, base64 dataUrl ou arquivo registrado)
    const pdfCandidate = order.op_file || order.sourcePdfName;
    const hasRealPdfUrl = pdfCandidate && (pdfCandidate.startsWith('blob:') || pdfCandidate.startsWith('data:application/pdf') || pdfCandidate.startsWith('http'));

    if (hasRealPdfUrl) {
      window.open(pdfCandidate, '_blank', 'noopener,noreferrer');
    } else if (order.layoutPreviewImage || order.layoutImage) {
      // Se houver imagem/preview de layout oficial
      setIsLayoutModalOpen(true);
    } else {
      // Exibe mensagem amigável sem quebrar a tela
      setIsPdfMissingModalOpen(true);
    }
  };

  const priorityBadgeColor =
    order.priority === 'VERMELHO'
      ? 'bg-rose-100 text-rose-700 border-rose-300'
      : order.priority === 'AMARELO'
      ? 'bg-amber-100 text-amber-700 border-amber-300'
      : 'bg-emerald-100 text-emerald-700 border-emerald-300';

  const priorityLabel =
    order.priority === 'VERMELHO'
      ? 'URGENTE'
      : order.priority === 'AMARELO'
      ? 'ALERTA DE PRAZO'
      : 'DENTRO DO PRAZO';

  const statusLabel =
    order.status === 'EM_PRODUCAO'
      ? 'EM PRODUÇÃO'
      : order.status === 'PROGRAMADA'
      ? 'PROGRAMADA'
      : order.status === 'PAUSADA'
      ? 'PAUSADA'
      : order.status === 'FINALIZADA'
      ? 'CONCLUÍDA'
      : order.status === 'EXPEDICAO'
      ? 'EXPEDIÇÃO'
      : order.status === 'REVISAO_PCP'
      ? 'REVISÃO PCP'
      : order.status;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-[#1C1418]/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in">
        <div className="bg-[#FAF5F1] border border-[#E5DAD3] w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
          
          {/* Header da Consulta da OP */}
          <div className="bg-white px-6 py-4 border-b border-[#E5DAD3] flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3.5">
              <OpProductThumbnail
                thumbnail={order.productThumbnail}
                layoutImage={order.layoutPreviewImage || order.layoutImage}
                opNumber={order.opNumber}
                size="md"
                interactive={false}
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-black text-sm px-2.5 py-0.5 rounded-lg bg-pink-100 text-[#B30A5C] border border-pink-200">
                    OP #{order.opNumber}
                  </span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${priorityBadgeColor}`}>
                    {priorityLabel}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#FAF5F1] text-[#3A3034] border border-[#E5DAD3]">
                    STATUS: {statusLabel}
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-black text-[#1C1418] mt-0.5">
                  {order.productName || 'Não informado na OP'}
                </h2>
                <p className="text-xs text-[#6E615B]">
                  Cliente: <strong className="text-[#1C1418]">{order.client || 'Não informado na OP'}</strong>
                </p>
              </div>
            </div>

            {/* Ações do Topo */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenPdf}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#FAF5F1] text-[#1C1418] border border-[#E5DAD3] text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Abrir arquivo original da Ordem de Produção"
              >
                <FileText className="w-4 h-4 text-[#E30A78]" />
                <span>Abrir PDF original</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#1C1418] hover:bg-[#3A3034] text-white text-xs font-black transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>
            </div>
          </div>

          {/* Conteúdo Principal Somente Leitura */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
            
            {/* Bloco 1: Grid de Ficha Técnica da OP */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              
              {/* Card 1: Identificação e Prazos */}
              <div className="rounded-2xl border border-[#E5DAD3] bg-white p-4.5 shadow-xs space-y-3">
                <div className="flex items-center gap-2 border-b border-[#F2EBE6] pb-2 text-[#E30A78]">
                  <FileText className="w-4 h-4" />
                  <h3 className="text-xs font-black text-[#1C1418] uppercase tracking-wider">
                    Identificação & Prazos
                  </h3>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-[#8A7D77] block text-[11px]">Número da OP:</span>
                    <strong className="text-[#1C1418] font-mono font-bold text-sm">
                      #{order.opNumber}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#8A7D77] block text-[11px]">Número do Pedido:</span>
                    <strong className="text-[#1C1418] font-mono">
                      {order.orderNumber || 'Não informado na OP'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#8A7D77] block text-[11px]">Cliente:</span>
                    <strong className="text-[#1C1418]">
                      {order.client || 'Não informado na OP'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#8A7D77] block text-[11px]">Prazo de Entrega:</span>
                    <strong className="text-[#1C1418]">
                      {order.deadline ? new Date(order.deadline).toLocaleDateString('pt-BR') : 'Não informado na OP'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Card 2: Quantidade e Produto */}
              <div className="rounded-2xl border border-[#E5DAD3] bg-white p-4.5 shadow-xs space-y-3">
                <div className="flex items-center gap-2 border-b border-[#F2EBE6] pb-2 text-[#E30A78]">
                  <Package className="w-4 h-4" />
                  <h3 className="text-xs font-black text-[#1C1418] uppercase tracking-wider">
                    Produto & Volume
                  </h3>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-[#8A7D77] block text-[11px]">Produto:</span>
                    <strong className="text-[#1C1418]">{order.productName || 'Não informado na OP'}</strong>
                  </div>
                  <div>
                    <span className="text-[#8A7D77] block text-[11px]">Código do Produto:</span>
                    <span className="text-[#3A3034] font-mono font-bold">
                      {order.productCode || 'Não informado na OP'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#8A7D77] block text-[11px]">Quantidade Programada:</span>
                    <strong className="text-emerald-700 font-mono font-bold text-sm">
                      {order.targetQuantity ? `${order.targetQuantity.toLocaleString('pt-BR')} ${order.unit || 'UNIDADES'}` : 'Não informado na OP'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#8A7D77] block text-[11px]">Produzido até o momento:</span>
                    <span className="text-[#3A3034] font-mono">
                      {order.currentGoodQuantity ? `${order.currentGoodQuantity.toLocaleString('pt-BR')} ${order.unit || 'UNIDADES'}` : '0 ' + (order.unit || 'UNIDADES')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: Material & Dimensões */}
              <div className="rounded-2xl border border-[#E5DAD3] bg-white p-4.5 shadow-xs space-y-3">
                <div className="flex items-center gap-2 border-b border-[#F2EBE6] pb-2 text-[#E30A78]">
                  <Layers className="w-4 h-4" />
                  <h3 className="text-xs font-black text-[#1C1418] uppercase tracking-wider">
                    Material & Medidas
                  </h3>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-[#8A7D77] block text-[11px]">Material:</span>
                    <strong className="text-[#1C1418]">{order.material || 'Não informado na OP'}</strong>
                  </div>
                  <div>
                    <span className="text-[#8A7D77] block text-[11px]">Cor do Material:</span>
                    <strong className="text-[#1C1418]">
                      {order.color || (order as any).materialColor || 'Não informado na OP'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#8A7D77] block text-[11px]">Gramatura:</span>
                    <strong className="text-[#1C1418]">
                      {order.grammage ? `${order.grammage} g/m²` : 'Não informado na OP'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#8A7D77] block text-[11px]">Dimensões (L x A + Fundo):</span>
                    <strong className="text-[#1C1418] font-mono">
                      {order.dimensions
                        ? `${order.dimensions.width} x ${order.dimensions.height}${order.dimensions.gusset ? ` + ${order.dimensions.gusset} mm fundo` : ' mm'}`
                        : 'Não informado na OP'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Card 4: Impressão & Personalização */}
              <div className="rounded-2xl border border-[#E5DAD3] bg-white p-4.5 shadow-xs space-y-3">
                <div className="flex items-center gap-2 border-b border-[#F2EBE6] pb-2 text-[#E30A78]">
                  <Tag className="w-4 h-4" />
                  <h3 className="text-xs font-black text-[#1C1418] uppercase tracking-wider">
                    Impressão & Cores
                  </h3>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-[#8A7D77] block text-[11px]">Tipo de Impressão:</span>
                    <strong className="text-[#1C1418]">
                      {order.printing?.type || 'Não informado na OP'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#8A7D77] block text-[11px]">Quantidade de Cores:</span>
                    <strong className="text-[#1C1418]">
                      {order.printing?.colorsCount !== undefined && order.printing?.colorsCount !== null
                        ? `${order.printing.colorsCount} cor(es)`
                        : 'Não informado na OP'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#8A7D77] block text-[11px]">Impressão Frente:</span>
                    <span className="text-[#3A3034]">
                      {order.printing?.front || 'Não informado na OP'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#8A7D77] block text-[11px]">Impressão Verso:</span>
                    <span className="text-[#3A3034]">
                      {order.printing?.back || 'Não informado na OP'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 5: Acessórios & Componentes */}
              <div className="rounded-2xl border border-[#E5DAD3] bg-white p-4.5 shadow-xs space-y-3">
                <div className="flex items-center gap-2 border-b border-[#F2EBE6] pb-2 text-[#E30A78]">
                  <ShieldCheck className="w-4 h-4" />
                  <h3 className="text-xs font-black text-[#1C1418] uppercase tracking-wider">
                    Alça & Acessórios
                  </h3>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-[#8A7D77] block text-[11px]">Tipo de Alça:</span>
                    <strong className="text-[#1C1418]">{order.handleType || 'Não informado na OP'}</strong>
                  </div>
                  <div>
                    <span className="text-[#8A7D77] block text-[11px]">Uso de Cordão:</span>
                    <strong className={order.hasDrawstring ? 'text-amber-700' : 'text-[#3A3034]'}>
                      {order.hasDrawstring ? 'Sim (Possui cordão duplo)' : 'Não'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#8A7D77] block text-[11px]">Uso de Visor Cristal:</span>
                    <strong className={order.hasVisor ? 'text-blue-700' : 'text-[#3A3034]'}>
                      {order.hasVisor ? 'Sim (Visor transparente)' : 'Não'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Card 6: Foto / Layout do Produto */}
              <div className="rounded-2xl border border-[#E5DAD3] bg-white p-4.5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-[#F2EBE6] pb-2 text-[#E30A78] mb-3">
                    <div className="flex items-center gap-2">
                      <ZoomIn className="w-4 h-4" />
                      <h3 className="text-xs font-black text-[#1C1418] uppercase tracking-wider">
                        Layout Oficial
                      </h3>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-center p-2 bg-[#FAF5F1] rounded-xl border border-[#E5DAD3]">
                    <OpProductThumbnail
                      thumbnail={order.productThumbnail}
                      layoutImage={order.layoutPreviewImage || order.layoutImage}
                      opNumber={order.opNumber}
                      size="xl"
                      interactive={true}
                      onClick={() => setIsLayoutModalOpen(true)}
                      className="shadow-sm"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsLayoutModalOpen(true)}
                  className="mt-3 w-full py-2 bg-pink-50 hover:bg-pink-100 text-[#B30A5C] text-xs font-bold rounded-xl border border-pink-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Ver Layout em Tela Cheia</span>
                </button>
              </div>

            </div>

            {/* Bloco 2: Observações Técnicas */}
            <div className="rounded-2xl border border-[#E5DAD3] bg-white p-5 shadow-xs space-y-2">
              <h3 className="text-xs font-black text-[#1C1418] uppercase tracking-wider flex items-center gap-2 text-[#E30A78]">
                <Info className="w-4 h-4" />
                Observações Técnicas da OP
              </h3>
              <div className="p-3.5 bg-[#FAF5F1] rounded-xl border border-[#E5DAD3] text-xs text-[#3A3034] font-medium whitespace-pre-wrap leading-relaxed">
                {order.technicalNotes || 'Não informado na OP.'}
              </div>
            </div>

            {/* Bloco 3: Roteiro de Produção da OP (Somente Leitura) */}
            <div className="rounded-2xl border border-[#E5DAD3] bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-[#1C1418] uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#E30A78]" />
                    Roteiro e Etapas de Produção
                  </h3>
                  <p className="text-xs text-[#6E615B] mt-0.5">
                    Sequência das etapas fabris programadas para esta ordem.
                  </p>
                </div>
                <span className="text-xs font-bold text-[#8A7D77]">
                  Total: {order.steps.length} etapa(s)
                </span>
              </div>

              <div className="space-y-3">
                {order.steps.map((step, idx) => {
                  const isDone = step.status === 'FINALIZADA';
                  const isProducing = step.status === 'PRODUZINDO';
                  const isPaused = step.status === 'PAUSADA';
                  const isReady = step.status === 'PRONTA';

                  const stepStatusColor = isDone
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : isProducing
                    ? 'bg-[#E30A78] text-white border-[#B30A5C]'
                    : isPaused
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : isReady
                    ? 'bg-blue-100 text-blue-800 border-blue-300'
                    : 'bg-[#FAF5F1] text-[#8A7D77] border-[#E5DAD3]';

                  const stepStatusLabel = isDone
                    ? 'FINALIZADA'
                    : isProducing
                    ? 'PRODUZINDO'
                    : isPaused
                    ? 'PAUSADA'
                    : isReady
                    ? 'LIBERADA / NA FILA'
                    : 'AGUARDANDO ETAPA ANTERIOR';

                  return (
                    <div
                      key={step.id || idx}
                      className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors ${
                        isProducing
                          ? 'border-[#E30A78] bg-pink-50/40 shadow-xs'
                          : isDone
                          ? 'border-emerald-200 bg-emerald-50/20'
                          : 'border-[#E5DAD3] bg-[#FAF5F1]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-white border border-[#E5DAD3] flex items-center justify-center font-black text-xs text-[#1C1418] shrink-0 font-mono shadow-2xs">
                          {idx + 1}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-[#1C1418]">
                            {step.processName}
                          </h4>
                          <p className="text-xs text-[#6E615B] flex items-center gap-1.5 mt-0.5">
                            Posto/Máquina: <strong className="text-[#1C1418]">{step.assignedMachineName || 'Posto Fabril'}</strong>
                            {step.hasCord && (
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 font-bold">
                                Cordão: SIM
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-auto">
                        <div className="text-right text-xs">
                          <span className="text-[#8A7D77] block text-[11px]">Qtd. Planejada</span>
                          <strong className="text-[#1C1418] font-mono">
                            {step.plannedQuantity.toLocaleString('pt-BR')} {step.unit}
                          </strong>
                        </div>

                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border ${stepStatusColor}`}>
                          {stepStatusLabel}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Footer da Modal */}
          <div className="bg-white px-6 py-3.5 border-t border-[#E5DAD3] flex items-center justify-between shrink-0">
            <div className="text-[11px] text-[#8A7D77]">
              Criada por {order.createdBy} em {new Date(order.createdAt).toLocaleString('pt-BR')}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-[#1C1418] hover:bg-[#3A3034] text-white text-xs font-black transition-colors shadow-xs cursor-pointer"
            >
              Voltar à Tela Anterior
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Aviso quando PDF original não estiver disponível */}
      {isPdfMissingModalOpen && (
        <div className="fixed inset-0 z-60 bg-[#1C1418]/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border border-[#E5DAD3] w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-500">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="font-black text-base text-[#1C1418]">Arquivo PDF</h3>
                <p className="text-xs text-[#6E615B]">Consulta de Documento</p>
              </div>
            </div>

            <p className="text-xs text-[#3A3034] leading-relaxed bg-[#FAF5F1] p-3.5 rounded-xl border border-[#E5DAD3]">
              PDF original não disponível para esta OP.
            </p>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsPdfMissingModalOpen(false)}
                className="px-5 py-2.5 bg-[#1C1418] hover:bg-[#3A3034] text-white text-xs font-black rounded-xl cursor-pointer transition-colors"
              >
                OK, Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Layout em Tela Cheia */}
      {isLayoutModalOpen && (
        <FullLayoutModal
          isOpen={isLayoutModalOpen}
          order={order}
          onClose={() => setIsLayoutModalOpen(false)}
        />
      )}
    </>
  );
};
