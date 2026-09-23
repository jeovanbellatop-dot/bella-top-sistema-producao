import React, { useState, useEffect } from 'react';
import { X, PauseCircle, AlertTriangle } from 'lucide-react';

interface PauseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  machineName: string;
  opNumber: string;
}

// Grupos e motivos de parada - Dossie de Funcionamento cap. 10
export const PAUSE_GROUPS: { group: string; reasons: string[] }[] = [
  {
    group: 'Planejada',
    reasons: ['Setup', 'Limpeza', 'Troca de cor', 'Troca de ferramenta', 'Refeição / intervalo'],
  },
  {
    group: 'Máquina',
    reasons: ['Falha elétrica', 'Falha mecânica', 'Sensor / CLP', 'Ajuste', 'Manutenção preventiva', 'Manutenção corretiva'],
  },
  {
    group: 'Material',
    reasons: ['Falta de material', 'Divergência de material', 'Bobina defeituosa', 'Tinta indisponível', 'Cordão indisponível', 'Alça indisponível', 'Visor indisponível'],
  },
  {
    group: 'Qualidade',
    reasons: ['Aguardando amostra', 'Ajuste de cor', 'Ajuste de registro', 'Material bloqueado', 'Produto bloqueado'],
  },
  {
    group: 'PCP / Informação',
    reasons: ['OP incompleta', 'Arte / layout pendente', 'Dúvida técnica', 'Prioridade alterada'],
  },
  {
    group: 'Pessoas / Operação',
    reasons: ['Ausência', 'Troca de operador', 'Treinamento', 'Apoio necessario'],
  },
  {
    group: 'Logistica interna',
    reasons: ['Aguardando transporte', 'Aguardando separação', 'Aguardando palete', 'Aguardando caixa', 'Aguardando retirada'],
  },
];

const OTHER_REASON = 'Outro motivo (descrever)';

export const PauseModal: React.FC<PauseModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  machineName,
  opNumber,
}) => {
  const [selectedGroup, setSelectedGroup] = useState(PAUSE_GROUPS[0].group);
  const [selectedReason, setSelectedReason] = useState(PAUSE_GROUPS[0].reasons[0]);
  const [customReason, setCustomReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedGroup(PAUSE_GROUPS[0].group);
      setSelectedReason(PAUSE_GROUPS[0].reasons[0]);
      setCustomReason('');
      setErrorMsg(null);
    }
  }, [isOpen]);

  const currentGroupReasons =
    PAUSE_GROUPS.find((g) => g.group === selectedGroup)?.reasons ?? [];

  if (!isOpen) return null;

  const handleClose = () => {
    setErrorMsg(null);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const detail =
      selectedReason === OTHER_REASON
        ? customReason.trim()
        : selectedReason;

    if (!detail) {
      setErrorMsg('Por favor, especifique o motivo detalhado da pausa.');
      return;
    }

    const finalReason = selectedGroup + ' · ' + detail;
    try {
      onConfirm(finalReason);
      handleClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao registrar pausa.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#FAF5F1] backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
      <div className="bg-white border border-[#E5DAD3] w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="bg-[#FAF5F1] px-4 sm:px-6 py-4 border-b border-[#E5DAD3] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <PauseCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#1C1418]">
                Registrar Pausa de Produção
              </h3>
              <p className="text-xs text-[#6E615B]">
                Máquina: <span className="text-amber-400 font-semibold">{machineName}</span> • OP #{opNumber}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-[#6E615B] hover:text-[#1C1418] hover:bg-[#F2EBE6]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
              <span className="font-semibold text-xs">{errorMsg}</span>
            </div>
          )}

          <p className="text-[#3A3034] font-medium">
            Selecione o motivo da interrupção para fins de auditoria e cálculo de disponibilidade OEE:
          </p>

          <div className="flex flex-wrap gap-2">
            {PAUSE_GROUPS.map((g) => (
              <button
                key={g.group}
                type="button"
                onClick={() => {
                  setSelectedGroup(g.group);
                  setSelectedReason(g.reasons[0]);
                }}
                className={
                  'px-3 py-1.5 rounded-full border text-[11px] font-semibold transition-all ' +
                  (selectedGroup === g.group
                    ? 'bg-amber-500 border-amber-500 text-white'
                    : 'bg-[#FAF5F1] border-[#E5DAD3] text-[#3A3034] hover:bg-[#F2EBE6]')
                }
              >
                {g.group}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:max-h-52 sm:overflow-y-auto sm:pr-1">
            {[...currentGroupReasons, OTHER_REASON].map((reason) => (
              <label
                key={reason}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedReason === reason
                    ? 'bg-amber-500/10 border-amber-500/50 text-[#1C1418] font-bold ring-1 ring-amber-400/20'
                    : 'bg-[#FAF5F1] border-[#E5DAD3] text-[#3A3034] hover:bg-[#F2EBE6]'
                }`}
              >
                <input
                  type="radio"
                  name="pauseReason"
                  value={reason}
                  checked={selectedReason === reason}
                  onChange={() => setSelectedReason(reason)}
                  className="text-amber-500 focus:ring-amber-400"
                />
                <span>{reason}</span>
              </label>
            ))}
          </div>

          {selectedReason === OTHER_REASON && (
            <div className="space-y-1 pt-2">
              <label className="text-[#6E615B] text-xs font-medium">
                Descreva o motivo detalhado:
              </label>
              <textarea
                required
                rows={2}
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Ex: Falha no sensor óptico do cabeçote de solda..."
                className="w-full bg-[#FAF5F1] border border-[#E5DAD3] rounded-lg p-2.5 text-[#1C1418] placeholder-[#9A8B84] focus:outline-none focus:border-amber-400"
              />
            </div>
          )}

          <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-white border-t border-[#E5DAD3] grid grid-cols-2 gap-3 items-center">
            <button
              type="button"
              onClick={onClose}
              className="min-h-12 w-full px-4 rounded-xl bg-[#F2EBE6] hover:bg-[#E8DED8] text-[#3A3034] font-bold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="min-h-12 w-full px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-extrabold text-xs shadow-lg"
            >
              CONFIRMAR PAUSA
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
