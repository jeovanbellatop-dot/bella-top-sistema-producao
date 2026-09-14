import React from 'react';
import { Eye, ImageOff, ZoomIn, Sparkles, Layers } from 'lucide-react';

export interface OpProductThumbnailProps {
  thumbnail?: string;
  layoutImage?: string;
  opNumber: string;
  productName?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  interactive?: boolean;
  showFullLayoutBadge?: boolean;
  status?: 'available' | 'missing' | 'needs_validation';
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}

const sizeConfig = {
  xs: {
    container: 'w-7 h-7 rounded-md',
    icon: 'w-3.5 h-3.5',
    textSize: 'text-[8px]',
  },
  sm: {
    container: 'w-10 h-10 rounded-lg',
    icon: 'w-4 h-4',
    textSize: 'text-[9px]',
  },
  md: {
    container: 'w-14 h-14 rounded-xl',
    icon: 'w-5 h-5',
    textSize: 'text-[10px]',
  },
  lg: {
    container: 'w-20 h-20 rounded-2xl',
    icon: 'w-6 h-6',
    textSize: 'text-xs',
  },
  xl: {
    container: 'w-28 h-28 rounded-2xl',
    icon: 'w-8 h-8',
    textSize: 'text-xs',
  },
  '2xl': {
    container: 'w-36 h-36 rounded-3xl',
    icon: 'w-10 h-10',
    textSize: 'text-sm',
  },
};

export const OpProductThumbnail: React.FC<OpProductThumbnailProps> = ({
  thumbnail,
  layoutImage,
  opNumber,
  productName,
  size = 'md',
  interactive = true,
  showFullLayoutBadge = false,
  status = 'available',
  onClick,
  className = '',
}) => {
  const imgSrc = thumbnail || layoutImage;
  const cfg = sizeConfig[size] || sizeConfig.md;
  const isClickable = interactive && !!onClick;

  const handleClick = (e: React.MouseEvent) => {
    if (isClickable && onClick) {
      e.stopPropagation();
      onClick(e);
    }
  };

  return (
    <div
      onClick={handleClick}
      title={isClickable ? `Clique para ver o layout oficial da OP #${opNumber}` : `Foto do produto da OP #${opNumber}`}
      className={`relative group shrink-0 overflow-hidden bg-white border border-[#E5DAD3] flex items-center justify-center transition-all ${
        cfg.container
      } ${
        isClickable
          ? 'cursor-pointer hover:border-[#E30A78] hover:shadow-md hover:ring-2 hover:ring-[#E30A78]/20 active:scale-95'
          : ''
      } ${className}`}
    >
      {imgSrc ? (
        <>
          <img
            src={imgSrc}
            alt={`Foto da sacola da OP #${opNumber}`}
            loading="lazy"
            className="w-full h-full object-contain p-0.5 transition-transform duration-200 group-hover:scale-105"
            referrerPolicy="no-referrer"
          />

          {/* Interactive Hover Overlay */}
          {isClickable && (
            <div className="absolute inset-0 bg-[#1C1418]/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white backdrop-blur-[1px] gap-0.5">
              <ZoomIn className={`${cfg.icon} text-white drop-shadow`} />
              {(size === 'lg' || size === 'xl' || size === '2xl') && (
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#F5C6DC]">
                  Ver Layout
                </span>
              )}
            </div>
          )}

          {/* Badge para tamanhos maiores */}
          {showFullLayoutBadge && (size === 'xl' || size === '2xl') && (
            <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-[#1C1418]/80 text-[#F5C6DC] text-[8px] font-mono font-bold flex items-center gap-1 backdrop-blur-sm pointer-events-none">
              <Layers className="w-2.5 h-2.5" />
              <span>Layout</span>
            </div>
          )}
        </>
      ) : (
        /* Fallback quando não há imagem identificada */
        <div className="w-full h-full bg-[#FAF5F1] text-[#9A8B84] flex flex-col items-center justify-center p-1 text-center select-none">
          <ImageOff className={`${cfg.icon} text-[#9A8B84] opacity-70`} />
          {(size === 'md' || size === 'lg' || size === 'xl' || size === '2xl') && (
            <span className={`${cfg.textSize} text-[#6E615B] font-mono mt-0.5 line-clamp-1`}>
              Sem foto
            </span>
          )}
        </div>
      )}
    </div>
  );
};
