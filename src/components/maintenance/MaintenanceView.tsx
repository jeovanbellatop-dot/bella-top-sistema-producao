import React, { useState } from 'react';
import { useMesStore } from '../../hooks/useMesStore';
import {
  Wrench,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Cpu,
  PlusCircle,
  X,
  History,
  ShieldAlert,
  Filter,
  Activity,
  Calendar,
  User,
  Hash
} from 'lucide-react';

interface MaintenanceViewProps {
  onSelectMachine?: (machineId: string) => void;
}

export const MaintenanceView: React.FC<MaintenanceViewProps> = () => {
  const {
    machines,
    authenticatedUser,
    activeOperatorMachineId,
    openMachineMaintenanceCall,
    closeMachineMaintenanceCall,
    pauseLogs
  } = useMesStore();

  const userSectors = authenticatedUser?.sectors || [];
  const isAdmin = userSectors.includes('ADMIN') || authenticatedUser?.role === 'ADMIN';
  const isOperatorSession = Boolean(activeOperatorMachineId) || authenticatedUser?.role === 'OPERATOR' || !isAdmin;

  // Máquina vinculada estritamente à sessão do operador
  const linkedMachine = machines.find((m) => m.id === activeOperatorMachineId);
  
  // Estado de seleção apenas para visualização administrativa pura (sem sessão de máquina)
  const [adminSelectedMachineId, setAdminSelectedMachineId] = useState<string>(
    machines[0]?.id || ''
  );

  const [isNewCallModalOpen, setIsNewCallModalOpen] = useState(false);
  const [callReason, setCallReason] = useState('Falha Mecânica no Cabeçote / Facas');
  const [callDescription, setCallDescription] = useState('');
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [resolveNotes, setResolveNotes] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Determina a máquina ativa:
  // Para operadores (qualquer sessão de máquina), usa EXCLUSIVAMENTE a máquina vinculada à sessão.
  // Para administradores no painel geral sem sessão de máquina, usa a máquina selecionada na consulta administrativa.
  const currentMachine = isOperatorSession
    ? linkedMachine
    : (machines.find((m) => m.id === adminSelectedMachineId) || machines[0]);

  // Se o operador não possui máquina vinculada à sessão, bloqueia totalmente
  if (isOperatorSession && !currentMachine) {
    return (
      <div className="space-y-6 animate-in fade-in">
        <div className="bg-white p-5 rounded-3xl border border-[#E5DAD3] shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-600">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#1C1418] tracking-tight">
              Chamado do Mecânico
            </h1>
            <p className="text-xs text-[#6E615B] mt-0.5">
              Registro e acompanhamento de ocorrências técnicas de manutenção.
            </p>
          </div>
        </div>

        <div className="bg-white p-10 rounded-3xl border border-rose-200 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h2 className="text-base font-black text-[#1C1418]">
              Identificação de Máquina Não Encontrada
            </h2>
            <p className="text-sm font-bold text-rose-700 bg-rose-50 p-4 rounded-2xl border border-rose-200">
              Não foi possível identificar a máquina desta sessão. Saia e entre novamente pela máquina correta.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleOpenCall = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMachine) return;

    const res = openMachineMaintenanceCall(
      currentMachine.id,
      callReason,
      callDescription.trim(),
      authenticatedUser?.name
    );

    if (res.success) {
      setFeedback({ type: 'success', message: `Chamado do mecânico registrado com sucesso para a máquina ${currentMachine.name}!` });
      setIsNewCallModalOpen(false);
      setCallDescription('');
    } else {
      setFeedback({ type: 'error', message: res.error || 'Erro ao registrar chamado.' });
    }
  };

  const handleCloseCall = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMachine) return;

    const res = closeMachineMaintenanceCall(
      currentMachine.id,
      resolveNotes.trim(),
      authenticatedUser?.name
    );

    if (res.success) {
      setFeedback({ type: 'success', message: `Manutenção concluída e máquina ${currentMachine.name} liberada para produção!` });
      setIsResolveModalOpen(false);
      setResolveNotes('');
    } else {
      setFeedback({ type: 'error', message: res.error || 'Erro ao concluir manutenção.' });
    }
  };

  // Histórico de chamados estritamente da máquina da sessão
  const machinePauseHistory = pauseLogs
    .filter((p) => p.machineId === currentMachine?.id)
    .slice(0, 20);

  const isMachineInMaintenance = currentMachine?.status === 'MANUTENCAO';

  return (
    <div className="space-y-6 animate-in fade-in">
      
      {/* Header da Tela */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-[#E5DAD3] shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-600">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-[#1C1418] tracking-tight">
                Chamado do Mecânico
              </h1>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                {currentMachine?.name}
              </span>
            </div>
            <p className="text-xs text-[#6E615B] mt-0.5">
              Registro e acompanhamento de ocorrências técnicas de manutenção no posto de trabalho.
            </p>
          </div>
        </div>

        {/* Botão de Abertura / Encerramento de Chamado */}
        {currentMachine && (
          <div className="flex items-center gap-2">
            {isMachineInMaintenance ? (
              <button
                type="button"
                onClick={() => setIsResolveModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Concluir Manutenção / Liberar Máquina</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsNewCallModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-[#E30A78] hover:bg-[#B30A5C] text-white text-xs font-black transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Abrir Chamado do Mecânico</span>
              </button>
            )}
          </div>
        )}
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-bold ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-rose-50 text-rose-800 border-rose-300'
          }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-[#8A7D77] hover:text-[#1C1418] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Somente exibe filtro de máquinas para perfil Administrador sem sessão de máquina */}
      {!isOperatorSession && (
        <div className="bg-white p-4 rounded-2xl border border-[#E5DAD3] shadow-xs flex items-center gap-3">
          <Filter className="w-4 h-4 text-[#8A7D77]" />
          <span className="text-xs font-bold text-[#1C1418]">Filtrar Máquina (Administrativo):</span>
          <select
            value={adminSelectedMachineId}
            onChange={(e) => setAdminSelectedMachineId(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-[#E5DAD3] bg-[#FAF5F1] text-xs font-bold text-[#1C1418] cursor-pointer focus:border-[#E30A78] focus:outline-none"
          >
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.code}) - {m.sector} [{m.status}]
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Card da Máquina da Sessão */}
      {currentMachine && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Status & Identificação Automática da Máquina da Sessão */}
          <div className="lg:col-span-1 rounded-3xl border border-[#E5DAD3] bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#F2EBE6] pb-3">
              <div className="flex items-center gap-2 text-[#E30A78]">
                <Cpu className="w-5 h-5" />
                <h2 className="text-sm font-black text-[#1C1418]">Máquina da Sessão</h2>
              </div>
              <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-pink-50 text-[#B30A5C] border border-pink-200">
                {currentMachine.code}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[#8A7D77] block text-[11px]">Máquina Vinculada:</span>
                <strong className="text-base text-[#1C1418] font-black">{currentMachine.name}</strong>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[#8A7D77] block text-[11px]">Setor:</span>
                  <strong className="text-[#1C1418]">{currentMachine.sector}</strong>
                </div>
                <div>
                  <span className="text-[#8A7D77] block text-[11px]">Código:</span>
                  <strong className="text-[#1C1418] font-mono">{currentMachine.code}</strong>
                </div>
              </div>
              <div>
                <span className="text-[#8A7D77] block text-[11px]">Operador da Sessão:</span>
                <strong className="text-[#1C1418]">{authenticatedUser?.name || 'Operador'}</strong>
              </div>
              <div>
                <span className="text-[#8A7D77] block text-[11px]">Status Operacional:</span>
                <div className="mt-1">
                  {isMachineInMaintenance ? (
                    <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-300 font-black text-xs inline-flex items-center gap-1.5 animate-pulse">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                      EM MANUTENÇÃO / CHAMADO ABERTO
                    </span>
                  ) : currentMachine.status === 'PRODUZINDO' ? (
                    <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs inline-flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-emerald-600" />
                      EM PRODUÇÃO NORMAL
                    </span>
                  ) : currentMachine.status === 'PAUSADA' ? (
                    <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-bold text-xs inline-flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      MÁQUINA PAUSADA
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-300 font-bold text-xs inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                      DISPONÍVEL / AGUARDANDO OP
                    </span>
                  )}
                </div>
              </div>

              {currentMachine.currentPauseReason && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 mt-2">
                  <span className="text-[10px] font-bold uppercase block text-amber-700 mb-0.5">
                    Motivo Registrado:
                  </span>
                  <p className="font-semibold text-xs">{currentMachine.currentPauseReason}</p>
                  {currentMachine.pauseStartedAt && (
                    <span className="text-[10px] text-amber-600 block mt-1">
                      Iniciado em: {new Date(currentMachine.pauseStartedAt).toLocaleTimeString('pt-BR')}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Histórico e Ocorrências estritamente da máquina da sessão */}
          <div className="lg:col-span-2 rounded-3xl border border-[#E5DAD3] bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#F2EBE6] pb-3">
              <div className="flex items-center gap-2 text-[#E30A78]">
                <History className="w-5 h-5" />
                <h2 className="text-sm font-black text-[#1C1418]">Histórico de Ocorrências da {currentMachine.name}</h2>
              </div>
              <span className="text-xs text-[#8A7D77] font-bold">
                {machinePauseHistory.length} registro(s)
              </span>
            </div>

            {machinePauseHistory.length === 0 ? (
              <div className="p-8 text-center text-[#8A7D77] text-xs font-medium bg-[#FAF5F1] rounded-2xl border border-[#E5DAD3]">
                Nenhum chamado de manutenção registrado para a máquina {currentMachine.name}.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[420px] overflow-y-auto">
                {machinePauseHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 bg-[#FAF5F1] rounded-xl border border-[#E5DAD3] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-[#1C1418] font-bold">{item.reason}</strong>
                        {item.endedAt ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            CONCLUÍDO ({item.durationMinutes || 0} min)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold animate-pulse">
                            EM ANDAMENTO
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#6E615B] mt-0.5">
                        Operador: <strong className="text-[#1C1418]">{item.operatorName}</strong> • Início:{' '}
                        {new Date(item.startedAt).toLocaleString('pt-BR')}
                      </p>
                    </div>

                    {item.endedAt && (
                      <span className="text-[11px] text-[#8A7D77] font-mono self-end sm:self-auto">
                        Fim: {new Date(item.endedAt).toLocaleTimeString('pt-BR')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* Modal: Abrir Chamado do Mecânico com Dados da Sessão Pré-preenchidos e Bloqueados */}
      {isNewCallModalOpen && currentMachine && (
        <div className="fixed inset-0 z-50 bg-[#1C1418]/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border border-[#E5DAD3] w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#F2EBE6] pb-3">
              <div className="flex items-center gap-2 text-[#E30A78]">
                <Wrench className="w-5 h-5" />
                <h3 className="font-black text-base text-[#1C1418]">
                  Abrir Chamado do Mecânico
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewCallModalOpen(false)}
                className="text-[#8A7D77] hover:text-[#1C1418] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOpenCall} className="space-y-4">
              {/* Painel de Identificação Automática da Sessão (Somente Leitura) */}
              <div className="p-3.5 bg-[#FAF5F1] rounded-2xl border border-[#E5DAD3] space-y-2.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#8A7D77] block">
                  Identificação da Máquina da Sessão
                </span>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[#8A7D77] text-[10px] block">Máquina:</span>
                    <strong className="text-[#1C1418] font-bold flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-[#E30A78]" />
                      {currentMachine.name}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#8A7D77] text-[10px] block">Código & ID:</span>
                    <strong className="text-[#1C1418] font-mono text-[11px] flex items-center gap-1">
                      <Hash className="w-3 h-3 text-[#8A7D77]" />
                      {currentMachine.code} ({currentMachine.id})
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#8A7D77] text-[10px] block">Setor:</span>
                    <strong className="text-[#1C1418]">{currentMachine.sector}</strong>
                  </div>
                  <div>
                    <span className="text-[#8A7D77] text-[10px] block">Operador Autenticado:</span>
                    <strong className="text-[#1C1418] flex items-center gap-1">
                      <User className="w-3 h-3 text-[#8A7D77]" />
                      {authenticatedUser?.name || 'Operador'}
                    </strong>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[#8A7D77] text-[10px] block">Data e Horário do Registro:</span>
                    <strong className="text-[#1C1418] flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-[#8A7D77]" />
                      {new Date().toLocaleString('pt-BR')}
                    </strong>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1C1418] mb-1">
                  Motivo Principal da Ocorrência:
                </label>
                <select
                  value={callReason}
                  onChange={(e) => setCallReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5DAD3] bg-white text-xs font-bold text-[#1C1418] focus:border-[#E30A78] focus:outline-none cursor-pointer"
                >
                  <option value="Falha Mecânica no Cabeçote / Facas">Falha Mecânica no Cabeçote / Facas</option>
                  <option value="Problema Elétrico / Resistência Queimada">Problema Elétrico / Resistência Queimada</option>
                  <option value="Fotocélula / Sensor Descalibrado">Fotocélula / Sensor Descalibrado</option>
                  <option value="Ajuste de Temperatura / Selagem">Ajuste de Temperatura / Selagem</option>
                  <option value="Problema no Puxador / Tracionador">Problema no Puxador / Tracionador</option>
                  <option value="Falta de Lubrificação / Ruído Anormal">Falta de Lubrificação / Ruído Anormal</option>
                  <option value="Manutenção Corretiva Geral">Manutenção Corretiva Geral</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1C1418] mb-1">
                  Detalhes / Sintomas Observados (Opcional):
                </label>
                <textarea
                  rows={3}
                  value={callDescription}
                  onChange={(e) => setCallDescription(e.target.value)}
                  placeholder="Descreva o que aconteceu para orientar a equipe de manutenção..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5DAD3] bg-white text-xs text-[#1C1418] focus:border-[#E30A78] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#F2EBE6]">
                <button
                  type="button"
                  onClick={() => setIsNewCallModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#E5DAD3] bg-[#FAF5F1] hover:bg-[#F2EBE6] text-xs font-bold text-[#1C1418] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#E30A78] hover:bg-[#B30A5C] text-white text-xs font-black transition-colors cursor-pointer shadow-sm"
                >
                  Confirmar Abertura de Chamado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Concluir Manutenção */}
      {isResolveModalOpen && currentMachine && (
        <div className="fixed inset-0 z-50 bg-[#1C1418]/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border border-[#E5DAD3] w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#F2EBE6] pb-3">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
                <h3 className="font-black text-base text-[#1C1418]">
                  Concluir Manutenção & Liberar Máquina
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsResolveModalOpen(false)}
                className="text-[#8A7D77] hover:text-[#1C1418] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCloseCall} className="space-y-4">
              <p className="text-xs text-[#6E615B]">
                A máquina <strong className="text-[#1C1418]">{currentMachine?.name}</strong> ({currentMachine?.code}) será liberada com status <strong>DISPONÍVEL</strong> para retorno imediato à produção.
              </p>

              <div>
                <label className="block text-xs font-bold text-[#1C1418] mb-1">
                  Notas de Resolução / Reparo Realizado:
                </label>
                <textarea
                  rows={3}
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  placeholder="Ex: Trocada resistência da solda de fundo e calibrado sensor de fotocélula."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5DAD3] bg-white text-xs text-[#1C1418] focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#F2EBE6]">
                <button
                  type="button"
                  onClick={() => setIsResolveModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#E5DAD3] bg-[#FAF5F1] hover:bg-[#F2EBE6] text-xs font-bold text-[#1C1418] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-colors cursor-pointer shadow-sm"
                >
                  Liberar Máquina Agora
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
