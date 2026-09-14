import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  User,
  AlertCircle,
  Clock,
  KeyRound,
  Eye,
  EyeOff,
  Layers,
  ShieldCheck,
  Cpu,
  Scissors,
  Printer,
  ChevronLeft,
  ChevronDown,
  CheckCircle2,
  Factory
} from 'lucide-react';
import { useMesStore } from '../../hooks/useMesStore';
import { Machine } from '../../types/mes';
import { getActiveOperatorsForMachine, getActiveAdministrators } from '../../utils/userMachines';

interface LoginViewProps {
  onLoginSuccess: (requiresSectorSelection: boolean, targetMachineId?: string) => void;
}

interface TargetStation {
  id: string;
  name: string;
  sector: string;
  code: string;
  icon: React.ComponentType<{ className?: string }>;
  type: 'ADMIN' | 'MACHINE';
}

const STATIONS: TargetStation[] = [
  {
    id: 'ADMIN_ACCESS',
    name: 'Administrador',
    sector: 'Acesso Total ao Sistema',
    code: 'ADMIN',
    icon: ShieldCheck,
    type: 'ADMIN',
  },
  {
    id: 'REFILADEIRA_01',
    name: 'Refiladeira',
    sector: 'Refile',
    code: 'REF-01',
    icon: Scissors,
    type: 'MACHINE',
  },
  {
    id: 'FLEXOGRAFIA_01',
    name: 'Flexografia',
    sector: 'Flexo 4 Cores',
    code: 'FLX-01',
    icon: Printer,
    type: 'MACHINE',
  },
  {
    id: 'CARROSSEL_01',
    name: 'Carrossel',
    sector: 'Estamparia',
    code: 'CRS-01',
    icon: Layers,
    type: 'MACHINE',
  },
  {
    id: 'CARROSSEL_PEQUENA_01',
    name: 'Carrossel Pequena',
    sector: 'Estamparia',
    code: 'CRS-02',
    icon: Layers,
    type: 'MACHINE',
  },
  {
    id: 'm2-corte-solda',
    name: 'Máquina 2',
    sector: 'Corte e Solda',
    code: 'CS-02',
    icon: Cpu,
    type: 'MACHINE',
  },
  {
    id: 'm3-corte-solda',
    name: 'Máquina 3',
    sector: 'Corte e Solda',
    code: 'CS-03',
    icon: Cpu,
    type: 'MACHINE',
  },
  {
    id: 'm4-corte-solda',
    name: 'Máquina 4',
    sector: 'Corte e Solda',
    code: 'CS-04',
    icon: Cpu,
    type: 'MACHINE',
  },
];

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const { loginAdministrator, loginMachineOperator, users, machines, allFactoryMachines } = useMesStore();

  // Estados de navegação in-place na mesma página
  const [viewStep, setViewStep] = useState<'CARDS' | 'MACHINE_LOGIN' | 'ADMIN_LOGIN'>('CARDS');
  const [selectedStation, setSelectedStation] = useState<TargetStation | null>(null);

  // Estados de formulário do Operador
  const [selectedOperatorId, setSelectedOperatorId] = useState('');
  const [operatorPassword, setOperatorPassword] = useState('');

  // Estados de formulário do Administrador
  const [selectedAdminId, setSelectedAdminId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Estados gerais
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [blockedCountdown, setBlockedCountdown] = useState<number | null>(null);

  const passwordInputRef = useRef<HTMLInputElement>(null);

  const factoryMachines = allFactoryMachines.length > 0 ? allFactoryMachines : machines;

  // Filtra apenas administradores REAIS, ATIVOS com perfil ADMIN/Master
  const activeAdmins = getActiveAdministrators(users);

  // Filtra apenas operadores REAIS, ATIVOS e autorizados especificamente para a máquina selecionada
  const activeOperators =
    selectedStation && selectedStation.type === 'MACHINE'
      ? getActiveOperatorsForMachine(users, selectedStation.id, factoryMachines)
      : [];

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (blockedCountdown !== null && blockedCountdown > 0) {
      timer = setInterval(() => {
        setBlockedCountdown((prev) => (prev && prev > 1 ? prev - 1 : null));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [blockedCountdown]);

  // Ao clicar em um cartão
  const handleSelectStation = (station: TargetStation) => {
    setErrorMessage(null);
    setShowPassword(false);
    setSelectedStation(station);

    if (station.type === 'ADMIN') {
      setSelectedAdminId('');
      setAdminPassword('');
      setViewStep('ADMIN_LOGIN');
    } else {
      // Verifica se a máquina está inativa no sistema
      const foundMachine = (allFactoryMachines.length > 0 ? allFactoryMachines : machines).find(
        (m) => m.id === station.id || m.code === station.code
      );
      if (foundMachine && (foundMachine.status === 'INATIVA' || !foundMachine.isActive || foundMachine.id === 'm1-corte-solda')) {
        setErrorMessage('Esta máquina está indisponível para acesso.');
        return;
      }
      setSelectedOperatorId('');
      setOperatorPassword('');
      setViewStep('MACHINE_LOGIN');
    }
  };

  // Botão Voltar para a tela de cartões
  const handleBackToCards = () => {
    setViewStep('CARDS');
    setSelectedStation(null);
    setErrorMessage(null);
    setSelectedOperatorId('');
    setOperatorPassword('');
    setSelectedAdminId('');
    setAdminPassword('');
    setShowPassword(false);
  };

  // Submissão do login do Operador na Máquina
  const handleSubmitOperatorLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStation || selectedStation.type !== 'MACHINE') return;

    if (!selectedOperatorId) {
      setErrorMessage('Selecione seu nome de operador na lista.');
      return;
    }

    if (!operatorPassword.trim()) {
      setErrorMessage('Informe sua senha de acesso.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    setTimeout(() => {
      try {
        const res = loginMachineOperator(selectedStation.id, selectedOperatorId, operatorPassword);
        setIsSubmitting(false);

        if (res.success) {
          onLoginSuccess(false, selectedStation.id);
        } else {
          setErrorMessage(res.error || 'Usuário ou senha incorretos.');
        }
      } catch {
        setIsSubmitting(false);
        setErrorMessage('Não foi possível realizar o login. Tente novamente.');
      }
    }, 150);
  };

  // Submissão do login do Administrador
  const handleSubmitAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAdminId) {
      setErrorMessage('Selecione o administrador.');
      return;
    }

    if (!adminPassword.trim()) {
      setErrorMessage('Administrador ou senha inválidos.');
      return;
    }

    if (blockedCountdown !== null && blockedCountdown > 0) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    setTimeout(() => {
      try {
        const res = loginAdministrator(selectedAdminId, adminPassword);
        setIsSubmitting(false);

        if (res.success) {
          onLoginSuccess(!!res.requiresSectorSelection, undefined);
        } else {
          setErrorMessage(res.error || 'Administrador ou senha inválidos.');
          if (res.blockedRemainingSeconds) {
            setBlockedCountdown(res.blockedRemainingSeconds);
          }
        }
      } catch {
        setIsSubmitting(false);
        setErrorMessage('Não foi possível realizar o login. Tente novamente.');
      }
    }, 150);
  };

  return (
    <div
      id="login_screen_container"
      className="min-h-screen bg-[#FAF5F1] text-[#1C1418] flex flex-col justify-center items-center px-4 py-8 sm:py-12 relative"
    >
      {/* Detalhes de iluminação e identidade visual suave */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-72 bg-gradient-to-b from-[#F5C6DC]/40 to-transparent blur-3xl pointer-events-none" />

      <div className="w-full max-w-2xl relative z-10">
        {/* LOGO OFICIAL & CABEÇALHO BELLA TOP */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center gap-2 mb-2">
            <div className="w-11 h-11 rounded-2xl bg-[#E30A78] text-white font-black text-xl flex items-center justify-center shadow-md shadow-[#E30A78]/20 border border-[#B30A5C]/20">
              BT
            </div>
            <div className="text-left">
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-[#1C1418] block leading-none">
                BELLA <span className="text-[#E30A78]">TOP</span>
              </span>
              <span className="text-[10px] font-bold tracking-[0.25em] text-[#8A7D77] uppercase block mt-1">
                SISTEMA DE PRODUÇÃO • MES
              </span>
            </div>
          </div>
          <p className="text-xs text-[#6E615B] font-medium max-w-md mx-auto">
            Chão de fábrica, rastreabilidade de OPs e apontamento em tempo real
          </p>
        </div>

        {/* ========================================================================= */}
        {/* CASO 1: TELA INICIAL COM OS CARTÕES DE POSTO E ADMINISTRADOR             */}
        {/* ========================================================================= */}
        {viewStep === 'CARDS' && (
          <div
            id="login_card"
            className="bg-white border border-[#E5DAD3] rounded-3xl p-6 sm:p-8 shadow-xl shadow-[#1C1418]/5 transition-all animate-in fade-in duration-200"
          >
            <div className="border-b border-[#E5DAD3] pb-4 mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#1C1418]">Acesso ao Sistema</h2>
                <p className="text-xs text-[#6E615B] mt-0.5">Selecione o seu posto de trabalho ou o painel administrativo</p>
              </div>
              <span className="px-2.5 py-1 bg-[#FFF5FA] text-[#E30A78] border border-[#F5C6DC] rounded-full text-[11px] font-mono font-bold">
                RBAC v2.6
              </span>
            </div>

            {/* Banner de Erro caso uma máquina inativa tenha sido clicada */}
            {errorMessage && (
              <div
                id="login_error_alert"
                className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-700 text-xs animate-in fade-in duration-200"
              >
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed">
                  <span className="font-bold text-rose-900 block mb-0.5">Aviso de Acesso</span>
                  {errorMessage}
                </div>
              </div>
            )}

            {/* GRADE COM OS CARTÕES PERMITIDOS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {STATIONS.map((station) => {
                const Icon = station.icon;
                const isAdmin = station.type === 'ADMIN';

                return (
                  <button
                    key={station.id}
                    id={`btn_station_card_${station.id}`}
                    type="button"
                    onClick={() => handleSelectStation(station)}
                    className={`p-4 rounded-2xl text-left transition-all cursor-pointer border flex items-center justify-between gap-3 group ${
                      isAdmin
                        ? 'bg-gradient-to-r from-[#FFF5FA] to-[#FAF5F1] border-[#F5C6DC] hover:border-[#E30A78] hover:shadow-md hover:shadow-[#E30A78]/10'
                        : 'bg-[#FAF5F1] hover:bg-[#FFF5FA] border-[#E5DAD3] hover:border-[#F5C6DC] hover:shadow-md hover:shadow-[#1C1418]/5'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                          isAdmin
                            ? 'bg-[#E30A78] text-white shadow-sm shadow-[#E30A78]/25'
                            : 'bg-white text-[#E30A78] border border-[#E5DAD3] group-hover:bg-[#E30A78] group-hover:text-white'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-[#1C1418] truncate group-hover:text-[#E30A78] transition-colors">
                          {station.name}
                        </div>
                        <div className="text-[11px] text-[#6E615B] truncate mt-0.5">
                          {station.sector}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase ${
                          isAdmin
                            ? 'bg-[#E30A78]/10 text-[#E30A78] border border-[#E30A78]/20'
                            : 'bg-white text-[#8A7D77] border border-[#E5DAD3]'
                        }`}
                      >
                        {station.code}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* CASO 2: TELA DE IDENTIFICAÇÃO DO OPERADOR NA MÁQUINA ESCOLHIDA          */}
        {/* ========================================================================= */}
        {viewStep === 'MACHINE_LOGIN' && selectedStation && (
          <div
            id="operator_machine_login_card"
            className="bg-white border border-[#E5DAD3] rounded-3xl p-6 sm:p-8 shadow-xl shadow-[#1C1418]/5 transition-all animate-in fade-in duration-200"
          >
            {/* Cabeçalho com identificação do Posto de Trabalho */}
            <div className="border-b border-[#E5DAD3] pb-4 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E30A78] text-white flex items-center justify-center shadow-sm">
                  {React.createElement(selectedStation.icon, { className: 'w-5 h-5' })}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#1C1418]">{selectedStation.name}</h2>
                  <p className="text-xs text-[#6E615B] mt-0.5">
                    {selectedStation.sector} • Posto {selectedStation.code}
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-bold">
                DISPONÍVEL
              </span>
            </div>

            {/* Banner de Erro */}
            {errorMessage && (
              <div
                id="machine_login_error_alert"
                className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-700 text-xs animate-in fade-in duration-200"
              >
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed">
                  <span className="font-bold text-rose-900 block mb-0.5">Falha na Identificação</span>
                  {errorMessage}
                </div>
              </div>
            )}

            {/* FORMULÁRIO DO OPERADOR */}
            <form onSubmit={handleSubmitOperatorLogin} className="space-y-4">
              {/* Campo Seleção de Operador Real e Ativo */}
              <div>
                <label
                  htmlFor="select_operator_name"
                  className="block text-xs font-bold text-[#1C1418] uppercase tracking-wider mb-1.5"
                >
                  Nome do Operador
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8A7D77]">
                    <User className="w-4 h-4" />
                  </div>
                  <select
                    id="select_operator_name"
                    value={selectedOperatorId}
                    onChange={(e) => {
                      setSelectedOperatorId(e.target.value);
                      setErrorMessage(null);
                      if (passwordInputRef.current) {
                        passwordInputRef.current.focus();
                      }
                    }}
                    disabled={isSubmitting || activeOperators.length === 0}
                    className="w-full pl-10 pr-8 py-3 bg-[#FAF5F1] border border-[#E5DAD3] rounded-2xl text-[#1C1418] text-sm focus:outline-none focus:ring-2 focus:ring-[#E30A78] focus:border-[#E30A78] focus:bg-white transition-all cursor-pointer font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {activeOperators.length === 0
                        ? '-- Nenhum operador vinculado a esta máquina --'
                        : '-- Selecione seu nome na lista --'}
                    </option>
                    {activeOperators.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.name} {op.jobTitle ? `(${op.jobTitle})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {activeOperators.length === 0 ? (
                  <p className="text-[11px] text-amber-700 mt-1.5 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Nenhum operador com acesso liberado para este posto. O Administrador pode vincular operadores no painel.
                  </p>
                ) : (
                  <p className="text-[11px] text-[#8A7D77] mt-1.5">
                    {activeOperators.length === 1
                      ? '1 operador autorizado para esta máquina.'
                      : `${activeOperators.length} operadores autorizados para esta máquina.`}
                  </p>
                )}
              </div>

              {/* Campo Senha */}
              <div>
                <label
                  htmlFor="input_operator_password"
                  className="block text-xs font-bold text-[#1C1418] uppercase tracking-wider mb-1.5"
                >
                  Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8A7D77]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    ref={passwordInputRef}
                    id="input_operator_password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={operatorPassword}
                    onChange={(e) => setOperatorPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={isSubmitting}
                    className="w-full pl-10 pr-11 py-3 bg-[#FAF5F1] border border-[#E5DAD3] rounded-2xl text-[#1C1418] text-sm placeholder-[#8A7D77] focus:outline-none focus:ring-2 focus:ring-[#E30A78] focus:border-[#E30A78] focus:bg-white transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#8A7D77] hover:text-[#1C1418] cursor-pointer transition-colors"
                    aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* BOTÕES DE AÇÃO: ENTRAR E VOLTAR */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  id="btn_back_to_cards_operator"
                  type="button"
                  onClick={handleBackToCards}
                  disabled={isSubmitting}
                  className="py-3.5 px-5 bg-[#FAF5F1] hover:bg-[#F2EBE6] text-[#6E615B] hover:text-[#1C1418] border border-[#E5DAD3] font-bold text-sm rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>

                <button
                  id="btn_submit_operator_login"
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3.5 px-5 bg-[#E30A78] hover:bg-[#B30A5C] text-white font-bold text-sm rounded-2xl shadow-lg shadow-[#E30A78]/25 hover:shadow-[#B30A5C]/35 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      <span>Validando...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Entrar</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* CASO 3: TELA DE LOGIN EXCLUSIVO DO ADMINISTRADOR                          */}
        {/* ========================================================================= */}
        {viewStep === 'ADMIN_LOGIN' && (
          <div
            id="admin_login_card"
            className="bg-white border border-[#E5DAD3] rounded-3xl p-6 sm:p-8 shadow-xl shadow-[#1C1418]/5 transition-all animate-in fade-in duration-200"
          >
            {/* Cabeçalho do Administrador */}
            <div className="border-b border-[#E5DAD3] pb-4 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E30A78] text-white flex items-center justify-center shadow-sm shadow-[#E30A78]/20">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#1C1418]">Acesso Administrativo</h2>
                  <p className="text-xs text-[#6E615B] mt-0.5">Painel de Controle e Gestão MES</p>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-[#FFF5FA] text-[#E30A78] border border-[#F5C6DC] rounded-full text-[11px] font-mono font-bold">
                ADMIN
              </span>
            </div>

            {/* Banner de Erro ou Bloqueio */}
            {errorMessage && (
              <div
                id="admin_login_error_alert"
                className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-700 text-xs animate-in fade-in duration-200"
              >
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed">
                  <span className="font-bold text-rose-900 block mb-0.5">Acesso Negado</span>
                  {errorMessage}
                </div>
              </div>
            )}

            {blockedCountdown !== null && blockedCountdown > 0 && (
              <div
                id="admin_login_blocked_alert"
                className="mb-5 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-700 text-xs"
              >
                <Clock className="w-5 h-5 text-amber-600 shrink-0 animate-spin" />
                <div>
                  <span className="font-bold text-amber-700 block">Tentativas Excedidas</span>
                  Aguarde <strong className="text-amber-700">{blockedCountdown} segundos</strong> para tentar novamente.
                </div>
              </div>
            )}

            {/* FORMULÁRIO DO ADMINISTRADOR */}
            <form onSubmit={handleSubmitAdminLogin} className="space-y-4">
              {/* Campo Nome do Administrador (Seleção de Administradores Reais) */}
              <div>
                <label
                  htmlFor="select_admin_user"
                  className="block text-xs font-bold text-[#1C1418] uppercase tracking-wider mb-1.5"
                >
                  Nome do Administrador
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8A7D77]">
                    <User className="w-4 h-4" />
                  </div>
                  <select
                    id="select_admin_user"
                    value={selectedAdminId}
                    onChange={(e) => {
                      setSelectedAdminId(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    disabled={isSubmitting || (blockedCountdown !== null && blockedCountdown > 0)}
                    className="w-full pl-10 pr-10 py-3 bg-[#FAF5F1] border border-[#E5DAD3] rounded-2xl text-[#1C1418] text-sm focus:outline-none focus:ring-2 focus:ring-[#E30A78] focus:border-[#E30A78] focus:bg-white transition-all disabled:opacity-50 appearance-none font-medium cursor-pointer"
                  >
                    <option value="">Selecione o administrador</option>
                    {activeAdmins.map((admin) => (
                      <option key={admin.id} value={admin.id}>
                        {admin.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-[#8A7D77]">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
                {activeAdmins.length === 0 && (
                  <p className="text-[11px] text-amber-700 mt-1.5 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Não foi possível carregar os administradores.
                  </p>
                )}
              </div>

              {/* Campo Senha do Administrador */}
              <div>
                <label
                  htmlFor="input_admin_password"
                  className="block text-xs font-bold text-[#1C1418] uppercase tracking-wider mb-1.5"
                >
                  Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8A7D77]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    ref={passwordInputRef}
                    id="input_admin_password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={isSubmitting || (blockedCountdown !== null && blockedCountdown > 0)}
                    className="w-full pl-10 pr-11 py-3 bg-[#FAF5F1] border border-[#E5DAD3] rounded-2xl text-[#1C1418] text-sm placeholder-[#8A7D77] focus:outline-none focus:ring-2 focus:ring-[#E30A78] focus:border-[#E30A78] focus:bg-white transition-all disabled:opacity-50 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#8A7D77] hover:text-[#1C1418] cursor-pointer transition-colors"
                    aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* BOTÕES DE AÇÃO: ENTRAR E VOLTAR */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  id="btn_back_to_cards_admin"
                  type="button"
                  onClick={handleBackToCards}
                  disabled={isSubmitting}
                  className="py-3.5 px-5 bg-[#FAF5F1] hover:bg-[#F2EBE6] text-[#6E615B] hover:text-[#1C1418] border border-[#E5DAD3] font-bold text-sm rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>

                <button
                  id="btn_submit_admin_login"
                  type="submit"
                  disabled={isSubmitting || (blockedCountdown !== null && blockedCountdown > 0)}
                  className="flex-1 py-3.5 px-5 bg-[#E30A78] hover:bg-[#B30A5C] text-white font-bold text-sm rounded-2xl shadow-lg shadow-[#E30A78]/25 hover:shadow-[#B30A5C]/35 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      <span>Validando...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Entrar</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* RODAPÉ DE IDENTIDADE E AUDITORIA */}
        <div className="text-center mt-6 text-[#8A7D77] text-xs">
          <p className="flex items-center justify-center gap-1.5 font-medium">
            <ShieldCheck className="w-4 h-4 text-[#E30A78]" />
            Bella Top • Sistema MES de Chão de Fábrica • Acesso Restrito e Auditado
          </p>
        </div>
      </div>
    </div>
  );
};
