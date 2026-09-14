import React, { useState, useRef, useEffect } from 'react';
import {
  Crop,
  Check,
  X,
  RotateCcw,
  Sparkles,
  Maximize2,
  Sliders,
  Layers,
  Info
} from 'lucide-react';
import { CropBox, cropImageFromCoords, getDefaultLayoutCropBox } from '../../utils/imageCropper';

interface LayoutCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  layoutImage: string;
  opNumber: string;
  initialCropBox?: CropBox;
  onSaveCrop: (croppedBase64: string, cropBox: CropBox) => void;
}

export const LayoutCropModal: React.FC<LayoutCropModalProps> = ({
  isOpen,
  onClose,
  layoutImage,
  opNumber,
  initialCropBox,
  onSaveCrop,
}) => {
  const [cropBox, setCropBox] = useState<CropBox>(
    initialCropBox || getDefaultLayoutCropBox()
  );
  const [previewThumbnail, setPreviewThumbnail] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [startCrop, setStartCrop] = useState<CropBox>(cropBox);

  const containerRef = useRef<HTMLDivElement>(null);

  // Atualiza preview ao modificar cropBox
  useEffect(() => {
    let isMounted = true;
    if (layoutImage && isOpen) {
      cropImageFromCoords(layoutImage, cropBox, 300, 300).then((res) => {
        if (isMounted) setPreviewThumbnail(res);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [layoutImage, cropBox, isOpen]);

  if (!isOpen || !layoutImage) return null;

  const handleMouseDownOnBox = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setStartCrop({ ...cropBox });
  };

  const handleMouseDownOnResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setStartCrop({ ...cropBox });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    if (isDragging) {
      const deltaXPercent = ((e.clientX - dragStart.x) / rect.width) * 100;
      const deltaYPercent = ((e.clientY - dragStart.y) / rect.height) * 100;

      let newX = Math.max(0, Math.min(100 - startCrop.width, startCrop.x + deltaXPercent));
      let newY = Math.max(0, Math.min(100 - startCrop.height, startCrop.y + deltaYPercent));

      setCropBox((prev) => ({ ...prev, x: newX, y: newY }));
    } else if (isResizing) {
      const deltaXPercent = ((e.clientX - dragStart.x) / rect.width) * 100;
      const deltaYPercent = ((e.clientY - dragStart.y) / rect.height) * 100;

      let newWidth = Math.max(10, Math.min(100 - startCrop.x, startCrop.width + deltaXPercent));
      let newHeight = Math.max(10, Math.min(100 - startCrop.y, startCrop.height + deltaYPercent));

      setCropBox((prev) => ({ ...prev, width: newWidth, height: newHeight }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  const handleReset = () => {
    setCropBox(getDefaultLayoutCropBox());
  };

  const handleConfirm = async () => {
    const cropped = await cropImageFromCoords(layoutImage, cropBox, 400, 400);
    onSaveCrop(cropped, cropBox);
    onClose();
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className="fixed inset-0 z-50 bg-[#1C1418]/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in select-none"
    >
      <div className="bg-white border border-[#E5DAD3] w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#FAF5F1] px-6 py-4 border-b border-[#E5DAD3] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#E30A78]/15 border border-[#E30A78]/30 text-[#E30A78] flex items-center justify-center font-bold">
              <Crop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#1C1418] flex items-center gap-2">
                <span>Recortar Foto Principal da OP #{opNumber}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-100 text-[#B30A5C] font-mono border border-pink-200">
                  Referência Visual Oficial
                </span>
              </h3>
              <p className="text-xs text-[#6E615B]">
                Arraste e redimensione o quadro para enquadrar exclusivamente a foto da sacola/saco no layout.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#6E615B] hover:text-[#1C1418] hover:bg-[#F2EBE6] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Interactive Layout Image Viewer with Crop Frame */}
          <div className="lg:col-span-2 flex flex-col space-y-3">
            <div className="flex items-center justify-between text-xs text-[#6E615B]">
              <span className="font-semibold flex items-center gap-1.5 text-[#1C1418]">
                <Layers className="w-4 h-4 text-[#E30A78]" />
                Layout Original Aprovado
              </span>
              <button
                onClick={handleReset}
                className="flex items-center gap-1 text-[#E30A78] hover:underline font-bold text-[11px]"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Centralizar Padrão</span>
              </button>
            </div>

            <div
              ref={containerRef}
              className="relative w-full h-80 sm:h-96 bg-[#FAF5F1] rounded-2xl border border-[#E5DAD3] overflow-hidden flex items-center justify-center cursor-crosshair shadow-inner"
            >
              <img
                src={layoutImage}
                alt="Layout para recorte"
                className="w-full h-full object-contain pointer-events-none"
                referrerPolicy="no-referrer"
              />

              {/* Crop Box Overlay */}
              <div
                style={{
                  left: `${cropBox.x}%`,
                  top: `${cropBox.y}%`,
                  width: `${cropBox.width}%`,
                  height: `${cropBox.height}%`,
                }}
                onMouseDown={handleMouseDownOnBox}
                className="absolute border-2 border-[#E30A78] bg-[#E30A78]/10 shadow-[0_0_0_9999px_rgba(28,20,24,0.45)] cursor-move transition-shadow rounded-lg"
              >
                {/* Center Badge */}
                <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-[#1C1418]/80 text-[#F5C6DC] text-[9px] font-mono font-bold flex items-center gap-1 pointer-events-none">
                  <Sparkles className="w-2.5 h-2.5 text-[#E30A78]" />
                  <span>Foto da Sacola</span>
                </div>

                {/* Resize Handle at bottom right */}
                <div
                  onMouseDown={handleMouseDownOnResize}
                  className="absolute -bottom-2.5 -right-2.5 w-6 h-6 rounded-full bg-[#E30A78] border-2 border-white shadow-md flex items-center justify-center cursor-se-resize hover:scale-110 active:scale-95 transition-transform"
                >
                  <Sliders className="w-3 h-3 text-white" />
                </div>
              </div>
            </div>

            <p className="text-[11px] text-[#8A7D77] flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-[#E30A78] shrink-0" />
              <span>
                Dica: Evite incluir os textos da ficha técnica, réguas ou fundo rosa na miniatura para manter a clareza visual.
              </span>
            </p>
          </div>

          {/* Result Preview Column */}
          <div className="flex flex-col justify-between space-y-4 bg-[#FAF5F1] border border-[#E5DAD3] p-5 rounded-2xl">
            <div className="space-y-4">
              <h4 className="font-extrabold text-sm text-[#1C1418] border-b border-[#E5DAD3] pb-2 flex items-center gap-2">
                <span>Resultado da Miniatura</span>
              </h4>

              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="w-40 h-40 rounded-2xl bg-white border-2 border-[#E5DAD3] p-1.5 shadow-sm overflow-hidden flex items-center justify-center">
                  {previewThumbnail ? (
                    <img
                      src={previewThumbnail}
                      alt="Preview do produto recortado"
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="text-xs text-[#8A7D77]">Gerando preview...</div>
                  )}
                </div>

                <span className="text-[11px] text-[#6E615B] font-mono font-medium text-center">
                  Esta imagem acompanhará a OP em todas as filas, painéis de máquina e apontamentos.
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-[#E5DAD3] space-y-2">
              <button
                onClick={handleConfirm}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#E30A78] to-[#B30A5C] hover:from-[#d1096e] hover:to-[#a00952] text-white font-extrabold text-xs shadow-lg shadow-pink-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>SALVAR FOTO PRINCIPAL</span>
              </button>

              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-white hover:bg-[#F2EBE6] text-[#1C1418] border border-[#E5DAD3] text-xs font-bold transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
