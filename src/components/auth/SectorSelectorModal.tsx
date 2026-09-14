import React from 'react';
import {
  Layers,
  Scissors,
  Printer,
  Sparkles,
  Zap,
  Package,
  Boxes,
  ShieldCheck,
  Check,
  LogOut
} from 'lucide-react';
import { useMesStore } from '../../hooks/useMesStore';
import { SystemSectorCode } from '../../types/mes';
import { SECTOR_DEFINITIONS } from '../../data/initialData';

interface SectorSelectorModalProps {
  onSectorSelected: (sector: SystemSectorCode) => void;
  isOpen: boolean;
  canClose?: boolean;
  onClose?: () => void;
}

export const SectorSelectorModal: React.FC<SectorSelectorModalProps> = ({
  onSectorSelected,
  isOpen,
  canClose = false,
  onClose,
}) => {
  const { authenticatedUser, selectedSector, logout } = useMesStore();

  if (!isOpen || !authenticatedUser) return null;

  const userSectors = authenticatedUser.sectors || [];
  const isAdmin = userSectors.includes('ADMIN');

  // Se for admin, pode escolher qualquer setor da fábrica ou o Painel Geral Admin
  const availableSectors = isAdmin
    ? SECTOR_DEFINITIONS
    : SECTOR_DEFINITIONS.filter((s) => userSectors.includes(s.code));

  const getSectorIcon = (code: SystemSectorCode) => {
    switch (code) {
      case 'ADMIN':
        return <ShieldCheck className="w-5 h-5 text-[#E30A78]" />;
      case 'PCP':
        return <Layers className="w-5 h-5 text-[#E30A78]" />;
      case 'REFILE':
        return <Scissors className="w-5 h-5 text-[#E30A78]" />;
      case 'FLEXOGRAFIA':
        return <Printer className="w-5 h-5 text-[#E30A78]" />;
      case 'ESTAMPARIA':
        return <Sparkles className="w-5 h-5 text-[#E30A78]" />;
      case 'CORTE_SOLDA':
        return <Zap className="w-5 h-5 text-[#E30A78]" />;
      case 'ALCA':
        return <Boxes className="w-5 h-5 text-[#E30A78]" />;
      case 'EXPEDICAO':
        return <Package className="w-5 h-5 text-[#E30A78]" />;
      default:
        return <Layers className="w-5 h-5 text-[#6E615B]" />;
    }
  };

  return (
    <div
      id="sector_selector_overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1418]/70 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        id="sector_selector_modal"
        className="w-full max-w-xl bg-white border border-[#E5DAD3] rounded-3xl shadow-2xl p-6 sm:p-8"
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between pb-4 border-b border-[#E5DAD3] mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-[#FFF5FA] text-[#E30A78] border border-[#F5C6DC] rounded-full text-xs font-bold">
                Olá, {authenticatedUser.name}
              </span>
              <span className="text-xs text-[#8A7D77]">(@{authenticatedUser.login})</span>
            </div>
            <h2 className="text-xl font-black text-[#1C1418] mt-1.5">Selecione o Posto de Trabalho</h2>
            <p className="text-xs text-[#6E615B] mt-0.5">
              Escolha a função operacional que você irá operar nesta sessão
            </p>
          </div>

          <button
            onClick={() => logout()}
            className="px-3 py-1.5 bg-[#FAF5F1] hover:bg-[#F2EBE6] text-[#6E615B] hover:text-[#1C1418] text-xs font-semibold rounded-xl border border-[#E5DAD3] transition-all flex items-center gap-1.5 cursor-pointer"
            title="Encerrar Sessão"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair</span>
          </button>
        </div>

        {/* Grade de Setores Autorizados */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
          {availableSectors.map((sector) => {
            const isCurrent = selectedSector === sector.code;
            return (
              <button
                key={sector.code}
                id={`btn_sector_select_${sector.code.toLowerCase()}`}
                onClick={() => onSectorSelected(sector.code)}
                className={`p-4 rounded-2xl border text-left transition-all duration-150 relative flex flex-col justify-between group cursor-pointer ${
                  isCurrent
                    ? 'bg-[#FFF5FA] border-2 border-[#E30A78] text-[#1C1418] shadow-md shadow-[#E30A78]/10'
                    : 'bg-[#FAF5F1] border-[#E5DAD3] hover:border-[#F5C6DC] hover:bg-[#FFF5FA] text-[#1C1418]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 bg-white rounded-xl border border-[#E5DAD3]">
                      {getSectorIcon(sector.code)}
                    </div>
                    {isCurrent && (
                      <span className="px-2 py-0.5 bg-[#E30A78] text-white text-[10px] font-bold rounded-full flex items-center gap-1">
                        <Check className="w-2.5 h-2.5" />
                        ATIVO
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-sm text-[#1C1418] group-hover:text-[#E30A78] transition-colors">
                    {sector.name}
                  </h3>
                  <p className="text-xs text-[#6E615B] mt-1 line-clamp-2">
                    {sector.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {canClose && onClose && (
          <div className="mt-6 pt-4 border-t border-[#E5DAD3] flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#FAF5F1] hover:bg-[#F2EBE6] text-[#1C1418] text-xs font-bold rounded-xl border border-[#E5DAD3] transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
