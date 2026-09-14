import React, { useState, useEffect } from 'react';
import { useMesStore } from './hooks/useMesStore';
import { LoginView } from './components/auth/LoginView';
import { SectorSelectorModal } from './components/auth/SectorSelectorModal';
import { AccessDeniedView } from './components/auth/AccessDeniedView';
import { UserManagementView } from './components/admin/UserManagementView';
import { FactoryOverview } from './components/dashboard/FactoryOverview';
import { PcpCentral } from './components/pcp/PcpCentral';
import { PcpUploadModal } from './components/pcp/PcpUploadModal';
import { OpDetailModal } from './components/pcp/OpDetailModal';
import { OperatorCockpit } from './components/operator/OperatorCockpit';
import { ProductionRouteView } from './components/routing/ProductionRouteView';
import { MachinesView } from './components/machines/MachinesView';
import { ProductsView } from './components/catalogs/ProductsView';
import { ReportsView } from './components/reports/ReportsView';
import { IotGatewayView } from './components/iot/IotGatewayView';
import { AuditLogsView } from './components/audit/AuditLogsView';
import { AlertsDrawer } from './components/alerts/AlertsDrawer';
import { MaintenanceView } from './components/maintenance/MaintenanceView';
import { getUserMachineSummary } from './utils/userMachines';
import { SECTOR_DEFINITIONS } from './data/initialData';
import { SystemSectorCode } from './types/mes';
import {
  LayoutDashboard,
  FileText,
  Upload,
  ListOrdered,
  Layers,
  Wrench,
  Cpu,
  Factory,
  Package,
  BarChart3,
  Radio,
  History,
  ChevronLeft,
  ChevronRight,
  Star,
  ClipboardCheck,
  Bell,
  Menu,
  X,
  Users,
  LogOut,
  Shield,
  Layers as LayersIcon
} from 'lucide-react';

const ALL_NAV_GROUPS = [
  {
    label: 'VISÃO GERAL',
    items: [
      { id: 'dashboard', label: 'Dashboard Geral', icon: LayoutDashboard },
    ],
  },
  {
    label: 'OPERAÇÃO',
    items: [
      { id: 'operator_cockpit', label: 'Cockpit Chão de Fábrica', icon: Factory },
      { id: 'pcp', label: 'Ordem de Produção', icon: FileText },
      { id: 'route_flow', label: 'Roteiro de Produção', icon: Layers },
      { id: 'upload', label: 'Carregar PDF / IA', icon: Upload },
      { id: 'queue', label: 'Fila de Produção', icon: ListOrdered },
      { id: 'maintenance', label: 'Chamado do Mecânico', icon: Wrench },
    ],
  },
  {
    label: 'RECURSOS',
    items: [
      { id: 'machines', label: 'Parque de Máquinas', icon: Cpu },
      { id: 'users', label: 'Operadores e Usuários', icon: Users },
    ],
  },
  {
    label: 'GESTÃO',
    items: [
      { id: 'catalogs', label: 'Produtos e Roteiros', icon: Package },
      { id: 'reports', label: 'Relatórios e KPIs', icon: BarChart3 },
      { id: 'iot', label: 'Gateway CLP / Sensores', icon: Radio },
      { id: 'audit', label: 'Rastreabilidade & Logs', icon: History },
      { id: 'evaluations', label: 'Avaliações', icon: ClipboardCheck },
    ],
  },
];

export default function App() {
  const {
    isAuthenticated,
    authenticatedUser,
    selectedSector,
    setSelectedSector,
    isAuthorizedForTab,
    getMachinesForUser,
    getOrdersForUser,
    orders,
    machines,
    users,
    alerts,
    logout,
    getMachineQueue,
    activeOperatorMachineId,
    validateOperatorMachineAccess,
  } = useMesStore();

  const [currentTab, setCurrentTab] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isSectorModalOpen, setIsSectorModalOpen] = useState(false);
  const [selectedOpId, setSelectedOpId] = useState<string | null>(null);
  const [selectedMachineForCockpit, setSelectedMachineForCockpit] = useState<string | undefined>();
  const [cockpitInitialTab, setCockpitInitialTab] = useState<'production' | 'queue'>('queue');
  const [evaluationType, setEvaluationType] = useState('operation');
  const [evaluationTarget, setEvaluationTarget] = useState('');
  const [evaluationRating, setEvaluationRating] = useState(5);
  const [evaluationComment, setEvaluationComment] = useState('');
  const [evaluations, setEvaluations] = useState<
    Array<{
      id: string;
      type: string;
      target: string;
      rating: number;
      comment: string;
      evaluator: string;
      date: string;
    }>
  >([]);

  const activeUser = authenticatedUser;
  const userSectors = activeUser?.sectors || [];
  const isAdmin = userSectors.includes('ADMIN') || activeUser?.role === 'ADMIN';
  const isPcp = userSectors.includes('PCP') || activeUser?.role === 'PCP';
  const effectiveSector = selectedSector || userSectors[0] || 'REFILE';

  const isOperatorBound = Boolean(activeOperatorMachineId && !isAdmin);
  const isOperatorProfile = isOperatorBound || activeUser?.role === 'OPERATOR' || !isAdmin;

  // Ajusta e trava a aba e máquina dependendo do papel e da sessão vinculada
  useEffect(() => {
    if (activeUser) {
      if (isOperatorProfile) {
        if (currentTab !== 'operator_cockpit' && currentTab !== 'maintenance') {
          setCurrentTab('operator_cockpit');
        }
        if (activeOperatorMachineId && selectedMachineForCockpit !== activeOperatorMachineId) {
          setSelectedMachineForCockpit(activeOperatorMachineId);
        }
      }
    }
  }, [activeUser, isOperatorProfile, activeOperatorMachineId, currentTab, selectedMachineForCockpit]);

  // Se o usuário não estiver autenticado, exibe a tela de login real
  if (!isAuthenticated || !activeUser) {
    return (
      <LoginView
        onLoginSuccess={(requiresSectorSelection) => {
          if (requiresSectorSelection) {
            setIsSectorModalOpen(true);
          }
        }}
      />
    );
  }

  // Itens específicos e simplificados estritamente para o perfil de Operador
  const OPERATOR_NAV_ITEMS = [
    { id: 'operator_cockpit', label: 'Ordens de Produção', icon: FileText },
    { id: 'maintenance', label: 'Chamado do Mecânico', icon: Wrench },
  ];

  // Filtra os menus e abas permitidos conforme a autorização do usuário (RBAC)
  const allowedGroups = isOperatorProfile
    ? []
    : ALL_NAV_GROUPS.map((group) => {
        const filteredItems = group.items.filter((item) => isAuthorizedForTab(item.id, activeUser));
        return {
          ...group,
          items: filteredItems,
        };
      }).filter((group) => group.items.length > 0);

  // Máquinas e ordens filtradas para o usuário ativo e setor ativo
  const userMachines = getMachinesForUser(activeUser, effectiveSector);
  const userOrders = getOrdersForUser(activeUser, effectiveSector);

  const unreadAlertsCount = alerts.filter((a) => !a.isRead).length;
  const urgent = userOrders.filter((o) => o.priority === 'VERMELHO' && o.status !== 'FINALIZADA').length;
  const activeMachinesCount = userMachines.filter((m) => m.status === 'PRODUZINDO').length;
  const maintenanceOpen = userMachines.filter(
    (mac) =>
      mac.status === 'MANUTENCAO' ||
      (mac.status === 'PAUSADA' && (mac.currentPauseReason || '').startsWith('Máquina'))
  ).length;
  const inProductionCount = userOrders.filter((o) => o.status === 'EM_PRODUCAO').length;

  const badge = (id: string) =>
    id === 'pcp'
      ? userOrders.length
      : id === 'route_flow'
      ? inProductionCount
      : id === 'queue'
      ? urgent
      : id === 'maintenance'
      ? maintenanceOpen
      : id === 'machines'
      ? activeMachinesCount
      : id === 'users'
      ? users.length
      : 0;

  const navigate = (id: string) => {
    if (isOperatorProfile) {
      if (id !== 'operator_cockpit' && id !== 'maintenance') {
        validateOperatorMachineAccess('tentativa_navegacao_' + id);
        setCurrentTab('operator_cockpit');
        return;
      }
    }
    if (id === 'upload') {
      if (!isAuthorizedForTab('upload', activeUser)) {
        setCurrentTab('operator_cockpit');
      } else {
        setIsUploadModalOpen(true);
      }
    } else {
      if (id === 'operator_cockpit') {
        setCockpitInitialTab('production');
      }
      setCurrentTab(id);
    }
    setMobileMenuOpen(false);
  };

  const handleSelectMachine = (id: string, initialTab: 'production' | 'queue' = 'queue') => {
    if (isOperatorBound && activeOperatorMachineId && id !== activeOperatorMachineId) {
      validateOperatorMachineAccess(id);
      setSelectedMachineForCockpit(activeOperatorMachineId);
      setCockpitInitialTab('production');
      setCurrentTab('operator_cockpit');
      return;
    }
    setSelectedMachineForCockpit(id);
    setCockpitInitialTab(initialTab);
    setCurrentTab('operator_cockpit');
  };

  const processOptions = Array.from(
    new Set(orders.flatMap((order) => order.steps.map((step) => step.processName)))
  );

  const evaluationOptions =
    evaluationType === 'operation'
      ? orders.map((order) => ({
          value: order.id,
          label: 'OP #' + order.opNumber + ' · ' + order.productName,
        }))
      : evaluationType === 'operator'
      ? users
          .filter((user) => user.role === 'OPERATOR' || user.role === 'LIDER')
          .map((user) => ({
            value: user.id,
            label: `${user.name} — Máquinas: ${getUserMachineSummary(user, machines)}`,
          }))
      : evaluationType === 'user'
      ? users.map((user) => ({
          value: user.id,
          label: `${user.name} (${user.role}) — ${getUserMachineSummary(user, machines)}`,
        }))
      : processOptions.map((process) => ({ value: process, label: process }));

  const saveEvaluation = () => {
    if (!evaluationTarget) return;
    const label =
      evaluationOptions.find((option) => option.value === evaluationTarget)?.label || evaluationTarget;
    setEvaluations((previous) => [
      {
        id: Date.now().toString(),
        type: evaluationType,
        target: label,
        rating: evaluationRating,
        comment: evaluationComment,
        evaluator: activeUser.name,
        date: new Date().toLocaleDateString('pt-BR'),
      },
      ...previous,
    ]);
    setEvaluationComment('');
    setEvaluationTarget('');
  };

  // Verificação estrita de rota (Bloqueio Real)
  const isCurrentTabAllowed = isAuthorizedForTab(currentTab, activeUser);

  const getTabLabel = (id: string) => {
    for (const group of ALL_NAV_GROUPS) {
      const match = group.items.find((i) => i.id === id);
      if (match) return match.label;
    }
    return id;
  };

  return (
    <div className="min-h-screen bg-[#FAF5F1] text-[#1C1418] font-sans flex flex-col md:flex-row">
      {/* Barra Superior Mobile */}
      <div className="md:hidden bg-[#1C1418] text-white p-3 flex items-center justify-between border-b border-[#2E2428] sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-amber-500 text-white font-black text-xs flex items-center justify-center">
            B
          </div>
          <div>
            <span className="font-bold text-xs tracking-wide text-[#F5C6DC]">BELLA TOP</span>
            <span className="text-[10px] text-amber-400 block -mt-1 font-mono">
              {effectiveSector}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAlertsOpen(true)}
            className="p-1.5 rounded-lg bg-[#2E2428] text-amber-400 relative"
            aria-label="Alertas"
          >
            <Bell size={16} />
            {unreadAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center">
                {unreadAlertsCount}
              </span>
            )}
          </button>
          <button
            onClick={logout}
            className="p-1.5 rounded-lg bg-[#2E2428] text-rose-400 hover:text-white"
            title="Sair do Sistema"
            aria-label="Sair"
          >
            <LogOut size={16} />
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg bg-[#2E2428] text-[#D8D0CC]"
            aria-label="Abrir Menu"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Barra Lateral / Sidebar Navigation */}
      <aside
        className={`${
          collapsed ? 'w-20' : 'w-72'
        } ${
          mobileMenuOpen ? 'fixed inset-0 z-40 flex' : 'hidden md:flex'
        } sticky top-0 h-screen shrink-0 border-r border-[#2E2428] bg-[#1C1418] transition-all duration-200 flex-col ${
          isOperatorProfile ? 'justify-start' : 'justify-between'
        } overflow-y-auto`}
      >
        <div>
          {/* Topo do Sidebar */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-[#2E2428]">
            {!collapsed ? (
              <div>
                <p className="text-[11px] tracking-[.22em] text-[#F5C6DC] font-bold">BELLA TOP</p>
                <p className="text-xs text-[#A99C97] mt-0.5 font-medium">Controle de Produção</p>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center mx-auto text-sm">
                BT
              </div>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-2 rounded-lg text-[#A99C97] hover:text-white hover:bg-[#2E2428] hidden md:block cursor-pointer"
              aria-label="Recolher menu"
            >
              {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
            {mobileMenuOpen && (
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg text-[#A99C97] hover:text-white hover:bg-[#2E2428] md:hidden cursor-pointer"
                aria-label="Fechar menu"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Seletor de Setor para Administrador Geral apenas */}
          {!collapsed && isAdmin && !isOperatorBound && (
            <div className="px-4 py-3 bg-[#160E12] border-b border-[#2E2428] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#A99C97] uppercase tracking-wider font-bold">
                  Modo de Visualização
                </span>
                <button
                  onClick={() => setIsSectorModalOpen(true)}
                  className="text-[10px] text-amber-400 hover:text-amber-300 font-medium cursor-pointer"
                >
                  Trocar Setor
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-0.5">
                <div className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-indigo-950/50 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Shield size={13} className="text-indigo-400" />
                    Acesso Total Admin
                  </span>
                  <span className="text-[10px] bg-indigo-500/20 px-1.5 py-0.5 rounded text-indigo-200 uppercase">
                    {effectiveSector}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Menus de Navegação */}
          <nav className="p-3">
            {isOperatorProfile ? (
              <div className="space-y-1.5">
                {OPERATOR_NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const count = item.id === 'maintenance' ? maintenanceOpen : 0;
                  const selected = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      id={`nav_tab_${item.id}`}
                      onClick={() => navigate(item.id)}
                      title={collapsed ? item.label : undefined}
                      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors cursor-pointer ${
                        selected
                          ? 'bg-amber-500 text-white font-bold shadow-lg shadow-amber-950/30'
                          : 'text-[#D8D0CC] hover:text-white hover:bg-[#2E2428]'
                      }`}
                    >
                      <Icon size={18} className="shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left">{item.label}</span>
                          {count > 0 && (
                            <span
                              className={`min-w-6 rounded-full px-1.5 py-0.5 text-[10px] text-center ${
                                selected
                                  ? 'bg-[#FAF5F1] text-[#1C1418] font-bold'
                                  : 'bg-[#2E2428] text-[#E6DEDA]'
                              }`}
                            >
                              {count}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-4">
                {allowedGroups.map((group) => (
                  <section key={group.label}>
                    {!collapsed && (
                      <h2 className="px-3 mb-2 text-[10px] font-bold tracking-[.18em] text-[#A99C97]">
                        {group.label}
                      </h2>
                    )}
                    <div className="space-y-1">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const count = badge(item.id);
                        const selected = currentTab === item.id;
                        return (
                          <button
                            key={item.id}
                            id={`nav_tab_${item.id}`}
                            onClick={() => navigate(item.id)}
                            title={collapsed ? item.label : undefined}
                            className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors cursor-pointer ${
                              selected
                                ? 'bg-amber-500 text-white font-bold shadow-lg shadow-amber-950/30'
                                : 'text-[#D8D0CC] hover:text-white hover:bg-[#2E2428]'
                            }`}
                          >
                            <Icon size={18} className="shrink-0" />
                            {!collapsed && (
                              <>
                                <span className="flex-1 text-left">{item.label}</span>
                                {count > 0 && (
                                  <span
                                    className={`min-w-6 rounded-full px-1.5 py-0.5 text-[10px] text-center ${
                                      selected
                                        ? 'bg-[#FAF5F1] text-[#1C1418] font-bold'
                                        : item.id === 'queue'
                                        ? 'bg-rose-950 text-rose-300'
                                        : 'bg-[#2E2428] text-[#E6DEDA]'
                                    }`}
                                  >
                                    {count}
                                  </span>
                                )}
                              </>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </nav>
        </div>

        {/* Rodapé do Sidebar com Perfil & Logout (apenas para perfis não-operador) */}
        {!isOperatorProfile && (
          <div className="p-3 border-t border-[#2E2428] bg-[#160E12]/90 space-y-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsAlertsOpen(true)}
                title="Alertas Operacionais"
                className="p-2 rounded-xl bg-[#2E2428] hover:bg-[#3D3035] text-[#D8D0CC] hover:text-white transition-colors relative flex items-center justify-center shrink-0 cursor-pointer"
              >
                <Bell size={17} />
                {unreadAlertsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center border border-[#160E12]">
                    {unreadAlertsCount}
                  </span>
                )}
              </button>

              {!collapsed ? (
                <>
                  <div className="flex-1 min-w-0 px-2 py-1 bg-[#251A20] rounded-xl border border-[#3E3036]">
                    <p className="text-xs font-bold text-white truncate leading-tight">
                      {activeUser.name}
                    </p>
                    <p className="text-[10px] text-amber-400/90 font-mono uppercase truncate mt-0.5">
                      {activeUser.role} · {effectiveSector}
                    </p>
                  </div>
                  <button
                    id="btn_sidebar_logout"
                    onClick={logout}
                    title="Sair / Desconectar"
                    className="p-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 text-rose-400 hover:text-rose-200 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    <LogOut size={16} />
                  </button>
                </>
              ) : (
                <button
                  id="btn_sidebar_logout_collapsed"
                  onClick={logout}
                  title="Sair / Desconectar"
                  className="p-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 text-rose-400 hover:text-rose-200 transition-colors flex items-center justify-center mx-auto cursor-pointer"
                >
                  <LogOut size={16} />
                </button>
              )}
            </div>
          </div>
        )}
      </aside>

      {/* Área Principal de Conteúdo */}
      <main className="min-w-0 flex-1 px-4 sm:px-6 lg:px-8 py-6">
        {/* Verificação de Rota / RBAC Real */}
        {!isCurrentTabAllowed ? (
          <AccessDeniedView
            requestedArea={getTabLabel(currentTab)}
            onReturnToAllowed={() => setCurrentTab(isAdmin ? 'dashboard' : 'operator_cockpit')}
          />
        ) : (
          <>
            {/* Telas Principais do Sistema MES */}
            {currentTab === 'dashboard' && (
              <FactoryOverview
                onSelectOp={setSelectedOpId}
                onSelectMachine={handleSelectMachine}
                onOpenUpload={() => setIsUploadModalOpen(true)}
              />
            )}

            {currentTab === 'users' && <UserManagementView />}

            {currentTab === 'pcp' && (
              <PcpCentral
                onOpenUpload={() => setIsUploadModalOpen(true)}
                onSelectOp={setSelectedOpId}
              />
            )}

            {currentTab === 'route_flow' && (
              <ProductionRouteView
                onOpenUpload={() => setIsUploadModalOpen(true)}
                onSelectOp={setSelectedOpId}
              />
            )}

            {currentTab === 'machines' && (
              <MachinesView
                onSelectMachineForCockpit={handleSelectMachine}
                onSelectOp={setSelectedOpId}
              />
            )}

            {currentTab === 'operator_cockpit' && (
              <OperatorCockpit
                key={`${selectedMachineForCockpit || 'cockpit'}_${cockpitInitialTab}`}
                initialMachineId={selectedMachineForCockpit}
                initialTab={cockpitInitialTab}
                onSelectOp={setSelectedOpId}
                onReturnToDashboard={() => setCurrentTab('dashboard')}
              />
            )}

            {currentTab === 'catalogs' && <ProductsView />}
            {currentTab === 'reports' && <ReportsView />}
            {currentTab === 'iot' && <IotGatewayView />}
            {currentTab === 'audit' && <AuditLogsView />}

            {currentTab === 'evaluations' && (
              <section className="max-w-6xl">
                <div>
                  <p className="text-xs font-bold tracking-widest text-amber-400">GESTÃO DE DESEMPENHO</p>
                  <h2 className="text-3xl font-black mt-1">Avaliações</h2>
                  <p className="text-[#6E615B] mt-1">
                    Avalie operações, operadores, usuários e processos com rastreabilidade.
                  </p>
                </div>
                <div className="mt-6 grid gap-6 xl:grid-cols-[420px_1fr]">
                  <div className="rounded-3xl border border-[#E5DAD3] bg-white p-6 space-y-5">
                    <div>
                      <label className="text-xs font-bold text-[#6E615B]">O QUE SERÁ AVALIADO</label>
                      <select
                        value={evaluationType}
                        onChange={(event) => {
                          setEvaluationType(event.target.value);
                          setEvaluationTarget('');
                        }}
                        className="mt-2 w-full rounded-xl border border-[#E5DAD3] bg-[#FAF5F1] p-3"
                      >
                        <option value="operation">Operação / OP</option>
                        <option value="operator">Operador</option>
                        <option value="user">Usuário</option>
                        <option value="process">Processo</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[#6E615B]">SELECIONE</label>
                      <select
                        value={evaluationTarget}
                        onChange={(event) => setEvaluationTarget(event.target.value)}
                        className="mt-2 w-full rounded-xl border border-[#E5DAD3] bg-[#FAF5F1] p-3"
                      >
                        <option value="">Escolha um item...</option>
                        {evaluationOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[#6E615B]">NOTA</label>
                      <div className="mt-2 flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => setEvaluationRating(star)}
                            className={`rounded-xl p-2 ${
                              star <= evaluationRating ? 'bg-amber-500 text-white' : 'bg-[#F2EBE6] text-[#8A7D77]'
                            }`}
                          >
                            <Star className="w-6 h-6" fill="currentColor" />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[#6E615B]">OBSERVAÇÃO</label>
                      <textarea
                        value={evaluationComment}
                        onChange={(event) => setEvaluationComment(event.target.value)}
                        rows={4}
                        placeholder="Pontos positivos, desvios e oportunidades de melhoria..."
                        className="mt-2 w-full rounded-xl border border-[#E5DAD3] bg-[#FAF5F1] p-3"
                      />
                    </div>
                    <button
                      onClick={saveEvaluation}
                      disabled={!evaluationTarget}
                      className="w-full rounded-xl bg-emerald-500 px-5 py-3 font-black text-white disabled:opacity-40 cursor-pointer"
                    >
                      SALVAR AVALIAÇÃO
                    </button>
                  </div>
                  <div className="rounded-3xl border border-[#E5DAD3] bg-white p-6">
                    <div className="flex justify-between">
                      <h3 className="font-black text-lg">Avaliações registradas</h3>
                      <span className="rounded-full bg-[#F2EBE6] px-3 py-1 text-xs">
                        {evaluations.length} registros
                      </span>
                    </div>
                    {evaluations.length === 0 ? (
                      <div className="py-16 text-center text-[#8A7D77]">
                        <ClipboardCheck className="w-12 h-12 mx-auto mb-3" />
                        <p>Nenhuma avaliação registrada.</p>
                      </div>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {evaluations.map((item) => (
                          <article key={item.id} className="rounded-2xl border border-[#E5DAD3] bg-[#FAF5F1] p-4">
                            <div className="flex justify-between gap-3">
                              <div>
                                <p className="text-xs font-bold text-amber-400 uppercase">{item.type}</p>
                                <h4 className="font-bold mt-1">{item.target}</h4>
                              </div>
                              <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    className={
                                      star <= item.rating
                                        ? 'w-4 h-4 text-amber-400'
                                        : 'w-4 h-4 text-[#4A403C]'
                                    }
                                    fill="currentColor"
                                  />
                                ))}
                              </div>
                            </div>
                            {item.comment && <p className="text-sm text-[#6E615B] mt-3">{item.comment}</p>}
                            <p className="text-[11px] text-[#9A8B84] mt-3">
                              {item.evaluator} · {item.date}
                            </p>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {currentTab === 'queue' && (
              <section>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">Fila de Produção</h2>
                    <p className="text-[#6E615B] mt-1">
                      {isAdmin || isPcp
                        ? 'Visão completa das filas de todas as máquinas da fábrica.'
                        : `Fila de produção exclusiva do setor ${effectiveSector} e máquinas autorizadas.`}
                    </p>
                  </div>
                  <span className="text-xs px-3 py-1 rounded-full bg-amber-100 text-amber-700 font-bold border border-amber-200">
                    {userMachines.length} Máquina(s) no Setor
                  </span>
                </div>
                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  {userMachines.map((mac) => {
                    const fila = getMachineQueue(mac.id);
                    return (
                      <article key={mac.id} className="rounded-2xl border border-[#E5DAD3] bg-white p-5 shadow-sm">
                        <div className="flex justify-between items-start gap-3">
                          <div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#FAF5F1] text-[#8A7D77] uppercase border border-[#E5DAD3]">
                              {mac.sector}
                            </span>
                            <h3 className="font-bold text-base mt-1 text-[#1C1418]">{mac.name}</h3>
                          </div>
                          <span className="text-xs rounded-full bg-[#FAF5F1] px-3 py-1 font-bold text-[#3A3034] border border-[#E5DAD3] whitespace-nowrap">
                            {fila.length} na fila
                          </span>
                        </div>
                        <div className="mt-4 space-y-2">
                          {fila.length === 0 && (
                            <p className="text-xs text-[#8A7D77] italic py-3 text-center bg-[#FAF5F1] rounded-xl">
                              Sem OP na fila desta máquina no momento.
                            </p>
                          )}
                          {fila.slice(0, 4).map((item: any) => {
                            const prio = item.order?.priority || 'VERDE';
                            const cor =
                              prio === 'VERMELHO'
                                ? 'text-rose-600 bg-rose-50 border-rose-200'
                                : prio === 'AMARELO'
                                ? 'text-amber-600 bg-amber-50 border-amber-200'
                                : 'text-emerald-600 bg-emerald-50 border-emerald-200';
                            const rotulo =
                              prio === 'VERMELHO'
                                ? 'URGENTE'
                                : prio === 'AMARELO'
                                ? 'ALERTA DE PRAZO'
                                : 'DENTRO DO PRAZO';
                            return (
                              <div
                                key={item.step.id}
                                className="rounded-xl border border-[#E5DAD3] bg-[#FAF5F1] p-3.5 hover:border-amber-400 transition-all"
                              >
                                <div className="flex items-center justify-between">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${cor}`}>
                                    {rotulo}
                                  </span>
                                  <span className="text-xs font-bold text-[#1C1418]">
                                    OP #{item.order?.opNumber}
                                  </span>
                                </div>
                                <p className="font-semibold text-sm mt-1.5 text-[#1C1418]">
                                  {item.step.processName} · {item.order?.productName}
                                </p>
                                <p className="text-xs text-[#6E615B] mt-1">
                                  {item.step.receivedQuantity?.toLocaleString('pt-BR')} {item.step.unit} — Prazo:{' '}
                                  {item.order?.deadline
                                    ? new Date(item.order.deadline).toLocaleDateString('pt-BR')
                                    : '-'}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {currentTab === 'maintenance' && (
              <MaintenanceView onSelectMachine={handleSelectMachine} />
            )}
          </>
        )}
      </main>

      {/* Modais Globais de Sistema */}
      <PcpUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onOpCreated={setSelectedOpId}
      />

      <OpDetailModal
        opId={selectedOpId}
        onClose={() => setSelectedOpId(null)}
        onSelectMachine={handleSelectMachine}
      />

      <AlertsDrawer
        isOpen={isAlertsOpen}
        onClose={() => setIsAlertsOpen(false)}
        onSelectOp={setSelectedOpId}
        onSelectMachine={handleSelectMachine}
      />

      <SectorSelectorModal
        isOpen={isSectorModalOpen}
        onClose={() => setIsSectorModalOpen(false)}
        canClose={true}
        onSectorSelected={(sec: SystemSectorCode) => {
          setSelectedSector(sec);
          setIsSectorModalOpen(false);
        }}
      />
    </div>
  );
}
