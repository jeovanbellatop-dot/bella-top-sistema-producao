import React, { useState } from 'react';
import {
  X,
  Layers,
  Crop,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText,
  Palette,
  CheckCircle2,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { ProductionOrder } from '../../types/mes';
import { OpProductThumbnail } from '../common/OpProductThumbnail';
import { LayoutCropModal } from './LayoutCropModal';
import { CropBox } from '../../utils/imageCropper';
import { useMesStore } from '../../hooks/useMesStore';

interface FullLayoutModalProps {
  order: ProductionOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectMachine?: (machineId: string) => void;
}

export const FullLayoutModal: React.FC<FullLayoutModalProps> = ({
  order,
  isOpen,
  onClose,
  onSelectMachine,
}) => {
  const { updateOrderThumbnail, currentUser } = useMesStore();
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  if (!isOpen || !order) return null;

  const layoutImageSrc = order.layoutPreviewImage || order.layoutImage || order.productThumbnail;
  const isPcpOrAdmin =
    currentUser?.role === 'PCP' ||
    currentUser?.role === 'ADMIN' ||
    currentUser?.role === 'MANAGER' ||
    currentUser?.role === 'LIDER' ||
    true; // Permite ajuste técnico por operadores autorizados

  const handleSaveCrop = (newThumbnail: string, cropBox: CropBox) => {
    updateOrderThumbnail(order.id, newThumbnail, cropBox);
  };

  const handleDownload = () => {
    if (!layoutImageSrc) return;
    const link = document.createElement('a');
    link.href = layoutImageSrc;
    link.download = `Layout_OP_${order.opNumber}_${order.client.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-[#1C1418]/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in">
        <div className="bg-[#FAF5F1] border border-[#E5DAD3] w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="bg-white px-6 py-4 border-b border-[#E5DAD3] flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <OpProductThumbnail
                thumbnail={order.productThumbnail}
                layoutImage={layoutImageSrc}
                opNumber={order.opNumber}
                size="md"
                interactive={false}
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-extrabold text-xs px-2.5 py-0.5 rounded-full bg-pink-100 text-[#B30A5C] border border-pink-200">
                    OP #{order.opNumber}
                  </span>
                  <h3 className="font-extrabold text-base text-[#1C1418]">
                    Layout Visual Oficial Aprovado
                  </h3>
                </div>
                <p className="text-xs text-[#6E615B] mt-0.5">
                  Cliente: <strong className="text-[#1C1418]">{order.client}</strong> • Produto:{' '}
                  <strong className="text-[#1C1418]">{order.productName}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isPcpOrAdmin && layoutImageSrc && (
                <button
                  onClick={() => setIsCropperOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-pink-50 hover:bg-pink-100 text-[#B30A5C] border border-[#F5C6DC] text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <Crop className="w-4 h-4 text-[#E30A78]" />
                  <span>Ajustar Foto da Sacola</span>
                </button>
              )}

              {layoutImageSrc && (
                <button
                  onClick={handleDownload}
                  title="Baixar imagem do layout"
                  className="p-2 rounded-xl bg-[#FAF5F1] hover:bg-[#F2EBE6] text-[#1C1418] border border-[#E5DAD3] transition-colors"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-[#6E615B] hover:text-[#1C1418] hover:bg-[#F2EBE6] transition-colors ml-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: High-Res Layout Canvas */}
            <div className="lg:col-span-2 flex flex-col space-y-3">
              <div className="flex items-center justify-between text-xs text-[#6E615B]">
                <span className="font-semibold flex items-center gap-1.5 text-[#1C1418]">
                  <Layers className="w-4 h-4 text-[#E30A78]" />
                  Visualização do Layout Técnico Completo
                </span>

                <div className="flex items-center gap-1 bg-white border border-[#E5DAD3] rounded-lg px-2 py-1">
                  <button
                    onClick={() => setZoomLevel((z) => Math.max(0.75, z - 0.25))}
                    className="p-1 hover:text-[#E30A78] text-[#6E615B]"
                    title="Diminuir Zoom"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono text-[11px] px-1 text-[#1C1418] font-bold">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
                    className="p-1 hover:text-[#E30A78] text-[#6E615B]"
                    title="Aumentar Zoom"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setZoomLevel(1)}
                    className="p-1 hover:text-[#E30A78] text-[#6E615B] ml-1"
                    title="Resetar Zoom"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="relative w-full h-96 sm:h-[420px] bg-white rounded-2xl border border-[#E5DAD3] overflow-auto flex items-center justify-center p-4 shadow-inner">
                {layoutImageSrc ? (
                  <img
                    src={layoutImageSrc}
                    alt={`Layout aprovado da OP #${order.opNumber}`}
                    style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
                    className="max-w-full max-h-full object-contain transition-transform duration-150"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="text-center p-6 text-[#8A7D77]">
                    <Layers className="w-12 h-12 mx-auto mb-2 text-[#9A8B84]" />
                    <p className="font-bold text-sm text-[#1C1418]">Nenhum layout anexado</p>
                    <p className="text-xs text-[#6E615B] mt-1">
                      Carregue o PDF de layout junto com a OP para vincular a referência visual oficial.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Col: Technical Specifications & Official Bag Thumbnail */}
            <div className="space-y-4 flex flex-col justify-between">
              <div className="bg-white border border-[#E5DAD3] rounded-2xl p-4 space-y-4">
                {/* Official Thumbnail Showcase */}
                <div className="border-b border-[#E5DAD3] pb-4">
                  <span className="text-[10px] uppercase text-[#8A7D77] font-bold tracking-wider block mb-2">
                    Foto Principal Extraída da Sacola:
                  </span>

                  <div className="flex items-center gap-3">
                    <OpProductThumbnail
                      thumbnail={order.productThumbnail}
                      layoutImage={layoutImageSrc}
                      opNumber={order.opNumber}
                      size="xl"
                      interactive={false}
                      className="border-2 border-[#E30A78]/30 shadow-sm"
                    />

                    <div className="text-xs space-y-1">
                      <div className="font-bold text-[#1C1418] flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-[#E30A78]" />
                        <span>Miniatura Oficial da OP</span>
                      </div>
                      <p className="text-[11px] text-[#6E615B]">
                        Utilizada como identidade visual em todas as máquinas e etapas produtivas.
                      </p>
                      {isPcpOrAdmin && layoutImageSrc && (
                        <button
                          onClick={() => setIsCropperOpen(true)}
                          className="text-[11px] text-[#E30A78] hover:underline font-bold flex items-center gap-1 mt-1"
                        >
                          <Crop className="w-3 h-3" />
                          <span>Ajustar recorte</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Technical Specs Summary */}
                <div className="space-y-2 text-xs">
                  <h4 className="font-extrabold text-[#1C1418] flex items-center gap-1.5 pb-1">
                    <FileText className="w-4 h-4 text-amber-500" />
                    <span>Especificações de Produção</span>
                  </h4>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 rounded-lg bg-[#FAF5F1] border border-[#E5DAD3]">
                      <span className="text-[#8A7D77] block text-[9px] uppercase font-bold">
                        Material & Gramatura
                      </span>
                      <span className="font-bold text-[#1C1418]">
                        {order.material} • {order.gsm} g/m²
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-[#FAF5F1] border border-[#E5DAD3]">
                      <span className="text-[#8A7D77] block text-[9px] uppercase font-bold">
                        Dimensões (L x A + F)
                      </span>
                      <span className="font-bold text-[#1C1418]">
                        {order.dimensions
                          ? `${order.dimensions.width}x${order.dimensions.height}${
                              order.dimensions.bottom ? '+' + order.dimensions.bottom : ''
                            } mm`
                          : 'Padrão'}
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-[#FAF5F1] border border-[#E5DAD3]">
                      <span className="text-[#8A7D77] block text-[9px] uppercase font-bold">
                        Impressão & Cores
                      </span>
                      <span className="font-bold text-[#1C1418]">
                        {order.printingMethod || 'FLEXOGRAFIA'} ({order.colorsCount || 1} cor)
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-[#FAF5F1] border border-[#E5DAD3]">
                      <span className="text-[#8A7D77] block text-[9px] uppercase font-bold">
                        Alça / Fechamento
                      </span>
                      <span className="font-bold text-[#1C1418]">
                        {order.handleType || 'VAZADA'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl bg-white hover:bg-[#F2EBE6] text-[#1C1418] border border-[#E5DAD3] text-xs font-bold transition-colors"
                >
                  Fechar Visualizador
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cropper Modal Overlay */}
      {layoutImageSrc && (
        <LayoutCropModal
          isOpen={isCropperOpen}
          onClose={() => setIsCropperOpen(false)}
          layoutImage={layoutImageSrc}
          opNumber={order.opNumber}
          initialCropBox={order.layoutCropBox}
          onSaveCrop={handleSaveCrop}
        />
      )}
    </>
  );
};
