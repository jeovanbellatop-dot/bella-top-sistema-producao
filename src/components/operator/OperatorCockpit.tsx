import React, { useEffect, useState } from 'react';
import { useMesStore } from '../../hooks/useMesStore';
import { getUserOperatedMachineNames } from '../../utils/userMachines';
import {
  Play,
  Pause,
  CheckCircle,
  Clock,
  Inbox,
  ListOrdered,
  ChevronRight,
  AlertTriangle,
  UserCheck,
  Cpu,
  Eye,
  LogOut,
  Sparkles,
  ShieldCheck,
  Shield,
  RefreshCw
} from 'lucide-react';
import { PauseModal } from './PauseModal';
import { FinishStepModal } from './FinishStepModal';
import { OpProductThumbnail } from '../common/OpProductThumbnail';
import { FullLayoutModal } from '../pcp/FullLayoutModal';
import { ExpeditionCockpit } from './ExpeditionCockpit';
import { MachineStationLogin } from './MachineStationLogin';
import { CorteSoldaQueue } from './CorteSoldaQueue';
import { ProductionOrder, MachineSession } from '../../types/mes';

interface OperatorCockpitProps {
  initialMachineId?: string;
  initialTab?: 'production' | 'queue';
  onSelectOp: (opId: string) => void;
  onReturnToDashboard?: () => void;
}

export const OperatorCockpit: React.FC<OperatorCockpitProps> = ({
  initialMachineId,
  initialTab,
  onSelectOp,
  onReturnToDashboard,
}) => {
  const {
    machines,
    allFactoryMachines,
    orders,
    currentUser,
    authenticatedUser,
    selectedSector,
    activeOperatorMachineId,
    getMachinesForUser,
    getMachineSession,
    logoutMachineOperator,
    logout,
    startOperation,
    pauseOperation,
    resumeOperation,
    finishOperation,
    getMachineQueue,
  } = useMesStore();

  const activeUser = authenticatedUser || currentUser;
  const effectiveSector = selectedSector || activeUser?.sectors?.[0] || 'CORTE_SOLDA';

  // Obtém lista de máquinas do parque fabril disponíveis para visualização/operação
  const userMachines = getMachinesForUser(activeUser, effectiveSector);
  const factoryMachines = allFactoryMachines.length > 0 ? allFactoryMachines : machines;
  const displayMachines = userMachines.length > 0 ? userMachines : factoryMachines;

  const isOperatorBound = Boolean(activeOperatorMachineId && activeUser?.role !== 'ADMIN');
  const isAdminSession = Boolean(
    authenticatedUser &&
    (authenticatedUser.role === 'ADMIN' || authenticatedUser.sectors?.includes('ADMIN'))
  );

  const [selectedMachineId, setSelectedMachineId] = useState(
    isOperatorBound && activeOperatorMachineId
      ? activeOperatorMachineId
      : initialMachineId && factoryMachines.some((m) => m.id === initialMachineId)
      ? initialMachineId
      : displayMachines[0]?.id || 'm3-corte-solda'
  );

  useEffect(() => {
    if (isOperatorBound && activeOperatorMachineId) {
      setSelectedMachineId(activeOperatorMachineId);
    } else if (initialMachineId && factoryMachines.some((m) => m.id === initialMachineId)) {
      setSelectedMachineId(initialMachineId);
    } else if (!displayMachines.some((m) => m.id === selectedMachineId)) {
      setSelectedMachineId(displayMachines[0]?.id || factoryMachines[0]?.id || '');
    }
  }, [displayMachines, factoryMachines, initialMachineId, isOperatorBound, activeOperatorMachineId]);

  const activeMachine = factoryMachines.find((m) => m.id === selectedMachineId) || displayMachines[0];
  const machineSession = activeMachine ? getMachineSession(activeMachine.id) : null;

  const [activeTab, setActiveTab] = useState<'production' | 'queue'>(initialTab || 'production');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [selectedQueueStepId, setSelectedQueueStepId] = useState<string | null>(null);
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  const [secondsRunning, setSecondsRunning] = useState(0);
  const [selectedLayoutOp, setSelectedLayoutOp] = useState<ProductionOrder | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [operationSuccess, setOperationSuccess] = useState<string | null>(null);
  // Detalhes secundarios ficam recolhidos no celular (tela limpa para o operador).
  const [showDetails, setShowDetails] = useState(false);

  const machineQueue = activeMachine ? getMachineQueue(activeMachine.id) : [];
  const selectedQueueItem = machineQueue.find((item) => item.step.id === selectedQueueStepId);
  const currentOp = orders.find((order) => order.id === activeMachine?.currentOpId);
  // A etapa so conta como "em producao nesta maquina" enquanto nao estiver finalizada.
  // Sem esta checagem, um cadastro de maquina desatualizado (currentOpId antigo) fazia a
  // OP finalizada VOLTAR para o operador, em vez de seguir para a proxima maquina do roteiro.
  const currentStepCandidate = currentOp?.steps.find((step) => step.id === activeMachine?.currentOperationId);
  const currentStep =
    currentStepCandidate && currentStepCandidate.status !== 'FINALIZADA'
      ? currentStepCandidate
      : undefined;
  const isProducing = activeMachine?.status === 'PRODUZINDO';
  const isPaused = activeMachine?.status === 'PAUSADA';

  const isCorteSoldaSector =
    activeMachine?.sector === 'Corte e Solda' ||
    activeMachine?.sector === 'CORTE_SOLDA' ||
    (activeMachine?.code && activeMachine.code.startsWith('CS'));

  const calculatedEstimatedMinutes = currentStep
    ? currentStep.estimatedMinutes ||
      (activeMachine.productionUnit === 'METROS'
        ? currentStep.receivedQuantity / Math.max(1, activeMachine.nominalSpeed)
        : (currentStep.receivedQuantity / Math.max(1, activeMachine.nominalSpeed)) * 60)
    : 0;
  const estimatedSeconds = Math.max(60, Math.round(calculatedEstimatedMinutes * 60));
  const productionProgress = currentStep ? Math.min(100, Math.round((secondsRunning / estimatedSeconds) * 100)) : 0;

  useEffect(() => {
    if (!isProducing || !currentStep?.actualStartTime) {
      setSecondsRunning(0);
      return;
    }
    const start = new Date(currentStep.actualStartTime).getTime();
    const update = () => setSecondsRunning(Math.floor((Date.now() - start) / 1000));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [isProducing, currentStep?.actualStartTime]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map((value) => String(value).padStart(2, '0')).join(':');
  };

  const priorityStyle = (priority: string) =>
    priority === 'VERMELHO'
      ? { label: 'URGENTE', dot: 'bg-rose-500', card: 'border-rose-500/60 bg-rose-50', badge: 'bg-rose-600 text-white' }
      : priority === 'AMARELO'
      ? { label: 'ALERTA', dot: 'bg-amber-500', card: 'border-amber-500/50 bg-amber-50', badge: 'bg-amber-500 text-white' }
      : { label: 'NO PRAZO', dot: 'bg-emerald-500', card: 'border-emerald-500/40 bg-emerald-50', badge: 'bg-emerald-600 text-white' };

  const isExpedicaoSector = effectiveSector === 'EXPEDICAO' || (!displayMachines.length && activeUser?.sectors?.includes('EXPEDICAO'));

  if (isExpedicaoSector) {
    return <ExpeditionCockpit onSelectOp={onSelectOp} />;
  }

  if (!activeMachine) {
    return (
      <div className="max-w-xl mx-auto mt-16 rounded-3xl border border-[#E5DAD3] bg-white p-10 text-center">
        <Inbox className="w-12 h-12 text-[#9A8B84] mx-auto mb-4" />
        <h2 className="text-xl font-bold">Nenhuma máquina disponível</h2>
        <p className="text-sm text-[#6E615B] mt-2">Procure o responsável pelo painel para liberar uma máquina ao seu usuário.</p>
      </div>
    );
  }

  const handleLogoutMachine = () => {
    logoutMachineOperator(activeMachine.id);
  };

  const currentActorId = machineSession?.operatorId || (isAdminSession ? authenticatedUser?.id : undefined);

  const startSelectedOp = (stepIdToStart?: string) => {
    setOperationError(null);
    const targetStepId = stepIdToStart || selectedQueueItem?.step.id;
    if (!targetStepId) return;
    try {
      startOperation(targetStepId, activeMachine.id, currentActorId);
      setOperationSuccess('Operação iniciada com sucesso!');
      setActiveTab('production');
      setTimeout(() => setOperationSuccess(null), 4000);
    } catch (err: any) {
      setOperationError(err?.message || 'Erro ao iniciar operação');
    }
  };

  const handleResumeOp = () => {
    if (!currentStep) return;
    setOperationError(null);
    try {
      resumeOperation(currentStep.id, activeMachine.id, currentActorId);
      setOperationSuccess('Operação retomada com sucesso!');
      setTimeout(() => setOperationSuccess(null), 4000);
    } catch (err: any) {
      setOperationError(err?.message || 'Erro ao retomar operação');
    }
  };

  const handlePauseOp = (reason: string) => {
    if (!currentStep) return;
    setOperationError(null);
    try {
      pauseOperation(currentStep.id, reason, activeMachine.id, currentActorId);
      setOperationSuccess('Pausa registrada com sucesso!');
      setTimeout(() => setOperationSuccess(null), 4000);
    } catch (err: any) {
      setOperationError(err?.message || 'Erro ao registrar pausa');
    }
  };

  const handleFinishOp = (data: any) => {
    if (!currentStep) return;
    setOperationError(null);
    try {
      finishOperation(currentStep.id, data, activeMachine.id, currentActorId);
      setOperationSuccess('Etapa finalizada e saldo liberado com sucesso!');
      setTimeout(() => setOperationSuccess(null), 4000);
    } catch (err: any) {
      setOperationError(err?.message || 'Erro ao finalizar etapa');
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-16 space-y-4 sm:space-y-5 px-3 sm:px-0">
      {/* TELA DE IDENTIFICAÇÃO - Exibida apenas para operadores comuns quando a máquina não tiver sessão ativa */}
      {!isAdminSession && !machineSession ? (
        <MachineStationLogin
          machine={activeMachine}
          onLoginSuccess={() => {
            // Sessão iniciada com sucesso
          }}
          onSelectAnotherMachine={() => {
            // Seleciona a primeira máquina ativa de corte e solda (M2, M3 ou M4)
            const activeCs = factoryMachines.find(
              (m) => m.sector === 'Corte e Solda' && m.status !== 'INATIVA' && m.id !== 'm1-corte-solda'
            );
            if (activeCs) setSelectedMachineId(activeCs.id);
          }}
        />
      ) : (
        /* ÁREA OPERACIONAL IDENTIFICADA OU ACESSO ADMINISTRATIVO */
        <div className="space-y-5">
          {/* Barra de alternância rápida de máquinas para ADM */}
          {isAdminSession && factoryMachines.length > 1 && (
            <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 p-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-amber-900 tracking-wider flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-600" />
                  MÁQUINAS DO PARQUE FABRIL:
                </span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto sm:flex-wrap -mx-1 px-1 pb-1">
                {factoryMachines.map((m) => {
                  const isSelected = m.id === activeMachine.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMachineId(m.id)}
                      className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'bg-white text-[#6E615B] hover:text-[#1C1418] hover:bg-amber-100/50 border border-amber-200'
                      }`}
                    >
                      <span className="font-mono">{m.code}</span>
                      <span>{m.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Header com Operador Identificado ou Identificação Administrativa */}
          <header className="rounded-2xl border border-[#E5DAD3] bg-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                {isAdminSession ? (
                  <>
                    <span className="text-xs font-bold tracking-[.22em] text-amber-600 uppercase flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" /> ACESSO ADMINISTRATIVO (ADM)
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black border border-amber-300">
                      ● SESSÃO ADM ATIVA
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-xs font-bold tracking-[.22em] text-[#B30A5C] uppercase">
                      POSTO DE TRABALHO IDENTIFICADO
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black border border-emerald-300">
                      ● CONECTADO
                    </span>
                  </>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black mt-1 tracking-tight text-[#1C1418]">
                {activeMachine.name.toUpperCase()}
              </h1>

                    {/* Linha curta de identificacao para o celular */}
                    <p className="sm:hidden text-xs text-[#6E615B] mt-1">
                      <span className="font-mono font-bold text-[#1C1418]">{activeMachine.code}</span>
                      {machineSession?.operatorName ? " - " + machineSession.operatorName : ""}
                    </p>
              <p className="hidden sm:block text-sm text-[#6E615B] mt-1">
                <span className="font-mono font-bold text-[#1C1418]">{activeMachine.code}</span> · {activeMachine.sector} ·{' '}
                {isAdminSession ? (
                  <>
                    Administrador:{' '}
                    <strong className="text-[#1C1418] bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                      {authenticatedUser?.name || 'Administrador'}
                    </strong>{' '}
                    <span className="text-[11px] text-[#8A7D77]">
                      (@{authenticatedUser?.login || 'admin'})
                    </span>
                    {machineSession ? (
                      <span className="ml-2 text-xs text-[#6E615B]">
                        · Operador no posto: <strong className="text-[#1C1418]">{machineSession.operatorName}</strong>
                      </span>
                    ) : (
                      <span className="ml-2 text-xs text-[#8A7D77]">
                        · Supervisão e Acesso Direto ADM
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    Operador:{' '}
                    <strong className="text-[#1C1418] bg-pink-50 px-2 py-0.5 rounded-md border border-pink-200">
                      {machineSession?.operatorName || 'Operador'}
                    </strong>{' '}
                    {machineSession?.loginTime && (
                      <span className="text-[11px] text-[#8A7D77]">
                        (Entrada: {new Date(machineSession.loginTime).toLocaleTimeString('pt-BR')})
                      </span>
                    )}
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold ${
                  isProducing
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                    : isPaused
                    ? 'bg-amber-100 text-amber-700 border border-amber-300'
                    : 'bg-[#F2EBE6] text-[#6E615B] border border-[#E5DAD3]'
                }`}
              >
                ● {activeMachine.status}
              </span>

              {isAdminSession ? (
                onReturnToDashboard && (
                  <button
                    onClick={onReturnToDashboard}
                    className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
                    title="Voltar ao Dashboard Geral"
                  >
                    <span>VOLTAR AO DASHBOARD</span>
                  </button>
                )
              ) : (
                <button
                  id="btn_logout_machine_operator"
                  onClick={handleLogoutMachine}
                  className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
                  title="Desconectar operador e liberar máquina"
                >
                  <LogOut size={14} />
                  <span>SAIR / TROCAR OPERADOR</span>
                </button>
              )}
            </div>
          </header>

          {/* Feedback Banners */}
          {operationError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-sm font-bold flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{operationError}</span>
              </div>
              <button
                onClick={() => setOperationError(null)}
                className="p-1 rounded-lg hover:bg-rose-100 text-rose-600"
              >
                ✕
              </button>
            </div>
          )}

          {operationSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-sm font-bold flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{operationSuccess}</span>
              </div>
              <button
                onClick={() => setOperationSuccess(null)}
                className="p-1 rounded-lg hover:bg-emerald-100 text-emerald-600"
              >
                ✕
              </button>
            </div>
          )}

          {/* Abas de Navegação: Produção vs Fila de OPs */}
          <div className="grid grid-cols-2 rounded-2xl border border-[#E5DAD3] bg-white p-1.5 shadow-2xs">
            <button
              onClick={() => setActiveTab('production')}
              className={
                'rounded-xl px-4 py-3 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ' +
                (activeTab === 'production' ? 'bg-[#E30A78] text-white shadow-sm' : 'text-[#6E615B] hover:text-[#1C1418]')
              }
            >
              <Play className="w-4 h-4" />
              <span className="hidden sm:inline">Produção em Andamento</span>
              <span className="sm:hidden">Produção</span>
            </button>
            <button
              onClick={() => setActiveTab('queue')}
              className={
                'rounded-xl px-4 py-3 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ' +
                (activeTab === 'queue' ? 'bg-[#E30A78] text-white shadow-sm' : 'text-[#6E615B] hover:text-[#1C1418]')
              }
            >
              <ListOrdered className="w-4 h-4" />{' '}
              <span className="hidden sm:inline">
                {isCorteSoldaSector ? 'Fila Compartilhada (Corte e Solda)' : 'Fila de OPs'}
              </span>
              <span className="sm:hidden">Fila</span>
              {machineQueue.length > 0 && (
                <span
                  className={
                    'rounded-full px-2 py-0.5 text-xs ' +
                    (activeTab === 'queue' ? 'bg-white text-[#B30A5C]' : 'bg-[#F2EBE6] text-[#1C1418]')
                  }
                >
                  {machineQueue.length}
                </span>
              )}
            </button>
          </div>

          {/* ABA DE PRODUÇÃO (Cronômetro, Perdas, Saldo, Roteiro, etc. - 100% PRESERVADOS) */}
          {activeTab === 'production' &&
            (currentOp && currentStep ? (
              <section className="rounded-3xl border border-[#E5DAD3] bg-white p-4 sm:p-8 space-y-4 sm:space-y-6 shadow-xs">
                {/* Header with Bag Photo and OP Details */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-pink-50/60 to-white border border-[#F5C6DC]">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    <OpProductThumbnail
                      thumbnail={currentOp.productThumbnail}
                      layoutImage={currentOp.layoutPreviewImage || currentOp.layoutImage}
                      opNumber={currentOp.opNumber}
                      size="hero"
                      onClick={() => onSelectOp(currentOp.id)}
                      className="shadow-md border-2 border-[#E30A78]/30 cursor-pointer"
                    />
                    <div
                      onClick={() => onSelectOp(currentOp.id)}
                      className="cursor-pointer hover:opacity-95 transition-opacity"
                      title="Clique para ver os detalhes completos da OP"
                    >
                      <p className="text-[10px] uppercase font-bold text-[#8A7D77] tracking-wider">
                        ORDEM EM PRODUÇÃO NESTA MÁQUINA
                      </p>
                      <h2 className="text-2xl sm:text-3xl font-black text-[#1C1418] flex items-center gap-2 hover:text-[#E30A78] transition-colors">
                        <span>OP #{currentOp.opNumber}</span>
                      </h2>
                      <p className="text-sm font-semibold text-[#B30A5C] mt-0.5">{currentOp.productName}</p>
                      <p className="text-xs text-[#6E615B]">
                        Cliente: <strong>{currentOp.client}</strong> · Operador:{' '}
                        <strong>{currentStep.activeOperatorName || machineSession.operatorName}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedLayoutOp(currentOp)}
                      className="flex-1 min-h-11 px-3.5 py-2 rounded-xl bg-white border border-[#E5DAD3] hover:border-[#B30A5C] text-xs font-bold text-[#1C1418] hover:text-[#B30A5C] flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <Eye className="w-4 h-4 text-[#B30A5C]" />
                      <span>Ver Layout Completo</span>
                    </button>
                    <button
                      onClick={() => onSelectOp(currentOp.id)}
                      className="flex-1 min-h-11 px-3 py-2 rounded-xl border border-[#E5DAD3] bg-white text-xs font-bold text-[#1C1418] hover:bg-[#FAF5F1] transition cursor-pointer"
                    >
                      Detalhes da OP
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-2xl bg-[#FAF5F1] p-4">
                    <p className="text-xs text-[#8A7D77]">ETAPA</p>
                    <p className="font-bold mt-1 text-[#1C1418]">{currentStep.processName}</p>
                    {(currentStep.hasCord ||
                      (currentStep.processTypeId === 'proc_solda' && currentOp.hasDrawstring)) && (
                      <span className="inline-block mt-1 text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 border border-amber-300 font-extrabold">
                        Cordão: SIM (Corte + Solda + Cordão)
                      </span>
                    )}
                  </div>
                  <div className="rounded-2xl bg-[#FAF5F1] p-4">
                    <p className="text-xs text-[#8A7D77]">QUANTIDADE</p>
                    <p className="font-bold mt-1 text-[#1C1418]">
                      {currentStep.receivedQuantity.toLocaleString('pt-BR')} {currentStep.unit}
                    </p>
                  </div>
                  <div className={"rounded-2xl bg-[#FAF5F1] p-4 sm:block " + (showDetails ? "" : "hidden")}>
                    <p className="text-xs text-[#8A7D77] flex items-center gap-1">
                      <Clock className="w-3 h-3" /> TEMPO DECORRIDO
                    </p>
                    <p className="font-mono font-bold text-[#E30A78] mt-1">
                      {isPaused ? 'PAUSADO' : formatTime(secondsRunning)}
                    </p>
                    <p className="text-[10px] text-[#9A8B84] mt-1">Contagem crescente</p>
                  </div>
                  <div className={"rounded-2xl bg-[#FAF5F1] p-4 sm:block " + (showDetails ? "" : "hidden")}>
                    <p className="text-xs text-[#8A7D77]">ESTIMATIVA TOTAL</p>
                    <p className="font-mono font-bold text-cyan-700 mt-1">{formatTime(estimatedSeconds)}</p>
                    <p className="text-[10px] text-[#9A8B84] mt-1">{productionProgress}% estimado</p>
                  </div>
                </div>

                {/* No celular, os dados secundarios ficam recolhidos ate o operador pedir */}
                <button
                  type="button"
                  onClick={() => setShowDetails((prev) => !prev)}
                  className="sm:hidden w-full min-h-11 rounded-2xl border border-[#E5DAD3] bg-white text-xs font-bold text-[#6E615B] flex items-center justify-center gap-2 cursor-pointer"
                >
                  {showDetails ? "Ocultar detalhes" : "Ver detalhes"}
                </button>

                {isPaused && (
                  <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-700 flex gap-2">
                    <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
                    <span>{activeMachine.currentPauseReason || 'Produção pausada'}</span>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-3">
                  {isProducing && (
                    <button
                      onClick={() => setIsPauseModalOpen(true)}
                      className="min-h-16 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <Pause className="w-6 h-6" /> PAUSAR
                    </button>
                  )}
                  {isPaused && (
                    <button
                      onClick={() => handleResumeOp()}
                      className="min-h-16 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <Play className="w-6 h-6" /> RETOMAR
                    </button>
                  )}
                  <button
                    onClick={() => setIsFinishModalOpen(true)}
                    className="min-h-16 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base flex items-center justify-center gap-2 cursor-pointer border border-emerald-700/20 shadow-sm transition-colors"
                  >
                    <CheckCircle className="w-6 h-6 text-white" /> FINALIZAR ETAPA
                  </button>
                </div>
              </section>
            ) : (
              /* NENHUMA OP EM PRODUÇÃO */
              <section className="rounded-3xl border border-[#E5DAD3] bg-white px-6 py-12 text-center space-y-4 shadow-xs">
                <Inbox className="w-14 h-14 text-[#9A8B84] mx-auto" />
                <h2 className="text-xl font-bold">Nenhuma OP em produção neste posto</h2>
                <p className="text-xs text-[#6E615B] max-w-md mx-auto">
                  {isCorteSoldaSector
                    ? 'Consulte a lista compartilhada de Corte e Solda abaixo para escolher a próxima OP.'
                    : 'Abra a fila de OPs para selecionar o próximo trabalho.'}
                </p>

                {isCorteSoldaSector ? (
                  <div className="pt-4 border-t border-[#E5DAD3] text-left">
                    <CorteSoldaQueue
                      machine={activeMachine}
                      session={machineSession}
                      onSelectOp={onSelectOp}
                      onStartOp={(stepId) => startSelectedOp(stepId)}
                    />
                  </div>
                ) : (
                  machineQueue.length > 0 && (
                    <button
                      onClick={() => setActiveTab('queue')}
                      className="mt-4 rounded-xl bg-[#E30A78] hover:bg-[#B30A5C] px-5 py-3 text-sm font-black text-white cursor-pointer transition-colors"
                    >
                      VER FILA ({machineQueue.length})
                    </button>
                  )
                )}
              </section>
            ))}

          {/* ABA DE FILA (FILA COMPARTILHADA PARA CORTE E SOLDA OU FILA PADRÃO PARA OUTROS SETORES) */}
          {activeTab === 'queue' && (
            isCorteSoldaSector ? (
              <CorteSoldaQueue
                machine={activeMachine}
                session={machineSession}
                onSelectOp={onSelectOp}
                onStartOp={(stepId) => startSelectedOp(stepId)}
              />
            ) : (
              <section className="rounded-3xl border border-[#E5DAD3] bg-white p-4 sm:p-6 shadow-xs">
                <div>
                  <h2 className="text-xl font-black text-[#1C1418]">Fila de OPs • {activeMachine.name}</h2>
                  <p className="text-sm text-[#6E615B] mt-1">Selecione uma OP para iniciar nesta máquina.</p>
                </div>
                {selectedQueueItem ? (
                  <div className="mt-5 rounded-3xl border border-pink-300 bg-pink-50/50 p-4 sm:p-8">
                    <p className="text-xs font-black tracking-widest text-[#B30A5C]">OP SELECIONADA PARA INICIAR</p>
                    <div className="mt-4 flex flex-col sm:flex-row items-start justify-between gap-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                        <OpProductThumbnail
                          thumbnail={selectedQueueItem.order.productThumbnail}
                          layoutImage={selectedQueueItem.order.layoutPreviewImage || selectedQueueItem.order.layoutImage}
                          opNumber={selectedQueueItem.order.opNumber}
                          size="hero"
                          onClick={() => setSelectedLayoutOp(selectedQueueItem.order)}
                        />
                        <div>
                          <h3 className="text-2xl font-black text-[#1C1418]">OP #{selectedQueueItem.order.opNumber}</h3>
                          <p className="text-[#3A3034] font-semibold mt-1">{selectedQueueItem.order.productName}</p>
                          <p className="text-sm text-[#8A7D77] mt-1">
                            {selectedQueueItem.step.receivedQuantity.toLocaleString('pt-BR')}{' '}
                            {selectedQueueItem.step.unit} · Prazo{' '}
                            {new Date(selectedQueueItem.order.deadline).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <span
                        className={
                          'rounded-full px-3 py-1 text-xs font-black ' +
                          priorityStyle(selectedQueueItem.order.priority).badge
                        }
                      >
                        {priorityStyle(selectedQueueItem.order.priority).label}
                      </span>
                    </div>
                    <div className="mt-7 grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setSelectedQueueStepId(null)}
                        className="min-h-14 rounded-2xl border border-[#E5DAD3] bg-white font-black text-[#1C1418] hover:bg-[#F2EBE6] cursor-pointer"
                      >
                        VOLTAR
                      </button>
                      <button
                        onClick={() => startSelectedOp()}
                        className="min-h-14 rounded-2xl bg-emerald-600 font-black text-white hover:bg-emerald-500 flex items-center justify-center gap-2 cursor-pointer shadow-md"
                      >
                        <Play className="w-5 h-5" /> COMEÇAR PRODUÇÃO
                      </button>
                    </div>
                  </div>
                ) : machineQueue.length === 0 ? (
                  <div className="py-14 text-center">
                    <Inbox className="w-12 h-12 text-[#9A8B84] mx-auto" />
                    <p className="font-bold mt-4 text-[#1C1418]">Nenhuma OP na fila</p>
                    <p className="text-sm text-[#8A7D77] mt-1">Quando uma ordem for liberada, ela aparecerá aqui.</p>
                  </div>
                ) : (
                  <div className="mt-5 space-y-3">
                    {machineQueue.map((item, index) => {
                      const style = priorityStyle(item.order.priority);
                      return (
                        <article
                          key={item.step.id}
                          className={'rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ' + style.card}
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <OpProductThumbnail
                              thumbnail={item.order.productThumbnail}
                              layoutImage={item.order.layoutPreviewImage || item.order.layoutImage}
                              opNumber={item.order.opNumber}
                              size="md"
                              onClick={() => onSelectOp(item.order.id)}
                            />
                            <button onClick={() => onSelectOp(item.order.id)} className="text-left flex-1 cursor-pointer">
                              <div className="flex items-center gap-2">
                                <span className={'w-2.5 h-2.5 rounded-full ' + style.dot} />
                                <span className="text-xs font-black">{style.label}</span>
                                <span className="text-xs text-[#8A7D77]">#{index + 1} na fila</span>
                              </div>
                              <h3 className="text-lg font-black mt-1 text-[#1C1418]">OP #{item.order.opNumber}</h3>
                              <p className="text-sm text-[#3A3034] font-medium">{item.order.productName}</p>
                              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                <span className="text-xs text-[#8A7D77]">
                                  {item.step.receivedQuantity.toLocaleString('pt-BR')} {item.step.unit} · Prazo{' '}
                                  {new Date(item.order.deadline).toLocaleDateString('pt-BR')}
                                </span>
                                {(item.step.hasCord ||
                                  (item.step.processTypeId === 'proc_solda' && item.order.hasDrawstring)) && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300 font-extrabold">
                                    Cordão: SIM
                                  </span>
                                )}
                              </div>
                            </button>
                          </div>
                          <button
                            onClick={() => setSelectedQueueStepId(item.step.id)}
                            className="w-full sm:w-auto min-h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-3 text-sm font-black text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                          >
                            SELECIONAR <ChevronRight className="w-4 h-4" />
                          </button>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            )
          )}
        </div>
      )}

      <PauseModal
        isOpen={isPauseModalOpen}
        onClose={() => setIsPauseModalOpen(false)}
        onConfirm={(reason) => handlePauseOp(reason)}
        machineName={activeMachine.name}
        opNumber={currentOp?.opNumber || ''}
      />
      {currentStep && (
        <FinishStepModal
          isOpen={isFinishModalOpen}
          onClose={() => setIsFinishModalOpen(false)}
          onConfirm={(data) => handleFinishOp(data)}
          machineName={activeMachine.name}
          processName={currentStep.processName}
          opNumber={currentOp?.opNumber || ''}
          receivedQuantity={currentStep.receivedQuantity}
          unit={currentStep.unit}
        />
      )}

      {/* Full Layout Interactive Modal */}
      {selectedLayoutOp && (
        <FullLayoutModal order={selectedLayoutOp} onClose={() => setSelectedLayoutOp(null)} />
      )}
    </div>
  );
};

