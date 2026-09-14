import React, { useState } from 'react';
import { useMesStore } from '../../hooks/useMesStore';
import { Machine, MachineSession } from '../../types/mes';
import { Cpu, Lock, UserCheck, AlertTriangle, ArrowRight, ShieldCheck, HelpCircle } from 'lucide-react';
import { getActiveOperatorsForMachine } from '../../utils/userMachines';

interface MachineStationLoginProps {
  machine: Machine;
  onLoginSuccess: (session: MachineSession) => void;
  onSelectAnotherMachine?: () => void;
}

export const MachineStationLogin: React.FC<MachineStationLoginProps> = ({
  machine,
  onLoginSuccess,
  onSelectAnotherMachine,
}) => {
  const { users, machines, allFactoryMachines, loginMachineOperator } = useMesStore();

  const [operatorInput, setOperatorInput] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const factoryMachines = allFactoryMachines.length > 0 ? allFactoryMachines : machines;

  // Filtra apenas operadores REAIS, ATIVOS e autorizados especificamente para esta máquina
  const activeOperators = getActiveOperatorsForMachine(users, machine, factoryMachines);

  const isMachineUnavailable = machine.status === 'INATIVA' || machine.id === 'm1-corte-solda' || !machine.isActive;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (isMachineUnavailable) {
      setErrorMessage(`${machine.name} está parada/indisponível para manutenção preventiva.`);
      return;
    }

    if (!operatorInput.trim()) {
      setErrorMessage('Por favor, informe seu nome ou login de operador.');
      return;
    }

    if (!password) {
      setErrorMessage('Por favor, digite sua senha de acesso.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = loginMachineOperator(machine.id, operatorInput, password);
      if (result.success && result.session) {
        onLoginSuccess(result.session);
      } else {
        setErrorMessage(result.error || 'Credenciais inválidas. Verifique nome e senha.');
      }
    } catch {
      setErrorMessage('Erro ao autenticar operador no posto de trabalho.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickSelect = (userNameOrLogin: string) => {
    setOperatorInput(userNameOrLogin);
    setPassword('123456'); // Preenche senha padrão para testes ágeis
    setErrorMessage(null);
  };

  return (
    <div className="max-w-xl mx-auto my-6 space-y-6">
      {/* Station Banner */}
      <div className="rounded-3xl border border-[#E5DAD3] bg-white p-6 sm:p-8 shadow-sm text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-100 to-rose-50 border border-pink-200 text-[#E30A78] flex items-center justify-center mx-auto mb-4 shadow-inner">
          <Cpu className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <span className="text-[11px] font-black uppercase tracking-widest text-[#B30A5C] bg-pink-50 px-3 py-1 rounded-full border border-pink-200 inline-block">
            POSTO DE TRABALHO INDIVIDUAL
          </span>
          <h1 className="text-3xl font-black text-[#1C1418] tracking-tight">{machine.name.toUpperCase()}</h1>
          <p className="text-xs font-semibold text-[#6E615B]">
            Código: <span className="font-mono font-bold text-[#1C1418]">{machine.code}</span> · Setor: <strong>{machine.sector}</strong>
          </p>
        </div>

        {/* Machine Status indicator */}
        <div className="mt-4 flex items-center justify-center gap-2">
          {isMachineUnavailable ? (
            <span className="px-3.5 py-1 rounded-xl bg-rose-100 border border-rose-300 text-rose-700 text-xs font-black flex items-center gap-1.5">
              ● PARADA / INDISPONÍVEL (Manutenção)
            </span>
          ) : (
            <span className="px-3.5 py-1 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-700 text-xs font-black flex items-center gap-1.5">
              ● MÁQUINA ATIVA (Aguardando Identificação)
            </span>
          )}
        </div>

        {/* Machine 1 Unavailable Warning */}
        {isMachineUnavailable ? (
          <div className="mt-6 p-5 rounded-2xl bg-amber-50 border border-amber-300 text-left space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-amber-700">Esta máquina está indisponível</h3>
                <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                  A <strong>{machine.name}</strong> encontra-se parada para manutenção preventiva e não permite login operacional ou seleção de OPs.
                </p>
                <p className="text-xs text-amber-700 font-bold mt-2">
                  Utilize as máquinas ativas de Corte e Solda: Máquina 2, Máquina 3 ou Máquina 4.
                </p>
              </div>
            </div>

            {onSelectAnotherMachine && (
              <button
                type="button"
                onClick={onSelectAnotherMachine}
                className="w-full mt-3 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <span>Escolher Máquina Ativa (M2, M3 ou M4)</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        ) : (
          /* Identification Form */
          <form onSubmit={handleSubmit} className="mt-6 text-left space-y-4 pt-4 border-t border-[#E5DAD3]">
            <div className="text-center pb-2">
              <h2 className="text-base font-bold text-[#1C1418]">Identificação do Operador</h2>
              <p className="text-xs text-[#6E615B]">
                Informe seu nome ou login e senha para iniciar suas atividades neste posto.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#3A3034] uppercase tracking-wider mb-1">
                Nome ou Login do Operador:
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={operatorInput}
                  onChange={(e) => setOperatorInput(e.target.value)}
                  placeholder="Ex: Alisson, Marcos, Roberto..."
                  className="w-full px-4 py-3 rounded-xl border border-[#E5DAD3] bg-[#FAF5F1] text-sm font-bold text-[#1C1418] placeholder-[#9A8B84] focus:border-[#E30A78] focus:bg-white focus:outline-none transition-all shadow-inner"
                  autoFocus
                />
                <UserCheck className="w-4 h-4 text-[#8A7D77] absolute right-3.5 top-3.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#3A3034] uppercase tracking-wider mb-1">
                Senha de Acesso:
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full px-4 py-3 rounded-xl border border-[#E5DAD3] bg-[#FAF5F1] text-sm font-bold text-[#1C1418] placeholder-[#9A8B84] focus:border-[#E30A78] focus:bg-white focus:outline-none transition-all shadow-inner"
                />
                <Lock className="w-4 h-4 text-[#8A7D77] absolute right-3.5 top-3.5" />
              </div>
            </div>

            {/* Quick Access Pills for operators */}
            {activeOperators.length > 0 && (
              <div className="pt-2">
                <p className="text-[11px] font-bold text-[#8A7D77] mb-1.5 flex items-center justify-between">
                  <span>Operadores Rápidos:</span>
                  <span className="text-[10px] text-[#9A8B84] font-normal">Clique para preencher</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {activeOperators.map((op) => (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => handleQuickSelect(op.name)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition border cursor-pointer ${
                        operatorInput.toLowerCase() === op.name.toLowerCase() || operatorInput.toLowerCase() === op.login.toLowerCase()
                          ? 'bg-[#E30A78] text-white border-[#E30A78]'
                          : 'bg-[#FAF5F1] text-[#3A3034] hover:bg-pink-50 border-[#E5DAD3]'
                      }`}
                    >
                      {op.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-4 py-3.5 px-4 bg-[#E30A78] hover:bg-[#B30A5C] text-white font-black text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-[0.99] disabled:opacity-50"
            >
              <ShieldCheck className="w-5 h-5" />
              <span>{isSubmitting ? 'IDENTIFICANDO...' : 'ENTRAR NA MÁQUINA'}</span>
            </button>

            <div className="p-3 rounded-xl bg-[#FAF5F1] border border-[#E5DAD3] flex items-center justify-between text-[11px] text-[#6E615B]">
              <span className="flex items-center gap-1">
                <HelpCircle size={13} />
                Apenas operadores autorizados pelo Administrador têm acesso a este posto.
              </span>
              <span className="font-mono text-[#8A7D77]">Acesso seguro por senha</span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
