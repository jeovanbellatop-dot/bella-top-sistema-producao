import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Search,
  KeyRound,
  Shield,
  CheckCircle2,
  XCircle,
  Edit2,
  Power,
  RotateCcw,
  Check,
  X,
  AlertTriangle,
  Layers,
  Scissors,
  Printer,
  Sparkles,
  Zap,
  Boxes,
  Package,
  Calendar,
  Eye,
  EyeOff
} from 'lucide-react';
import { useMesStore } from '../../hooks/useMesStore';
import { User, SystemSectorCode } from '../../types/mes';
import { SECTOR_DEFINITIONS } from '../../data/initialData';

export const UserManagementView: React.FC = () => {
  const {
    users,
    machines,
    authenticatedUser,
    createUser,
    updateUser,
    resetUserPassword,
    toggleUserStatus
  } = useMesStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterSector, setFilterSector] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modais de Criação / Edição / Reset de Senha
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [passwordResetUser, setPasswordResetUser] = useState<User | null>(null);
  const [newResetPassword, setNewResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Formulário de Criação / Edição
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    confirmPassword: '',
    sectors: [] as SystemSectorCode[],
    shift: 'TURNO_1' as 'TURNO_1' | 'TURNO_2' | 'TURNO_3' | 'GERAL',
    jobTitle: '',
    authorizedMachineIds: [] as string[],
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  const showSuccessBanner = (msg: string) => {
    setActionSuccessMessage(msg);
    setTimeout(() => setActionSuccessMessage(null), 4000);
  };

  const handleOpenCreate = () => {
    setFormData({
      name: '',
      username: '',
      password: '',
      confirmPassword: '',
      sectors: ['REFILE'],
      shift: 'TURNO_1',
      jobTitle: 'Operador de Refile',
      authorizedMachineIds: ['REFILADEIRA_01'],
    });
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      username: user.login,
      password: '',
      confirmPassword: '',
      sectors: user.sectors || (user.role === 'ADMIN' ? ['ADMIN'] : ['REFILE']),
      shift: user.shift || 'TURNO_1',
      jobTitle: user.jobTitle || '',
      authorizedMachineIds: user.authorizedMachineIds || ['*'],
    });
    setFormError(null);
  };

  const toggleSectorSelection = (code: SystemSectorCode) => {
    setFormData((prev) => {
      const exists = prev.sectors.includes(code);
      let updated: SystemSectorCode[];
      if (exists) {
        if (prev.sectors.length === 1) return prev; // Mantém ao menos 1 setor
        updated = prev.sectors.filter((s) => s !== code);
      } else {
        updated = [...prev.sectors, code];
      }
      return { ...prev, sectors: updated };
    });
  };

  const toggleMachineSelection = (machineId: string) => {
    setFormData((prev) => {
      const current = prev.authorizedMachineIds || ['*'];
      if (machineId === '*') {
        return { ...prev, authorizedMachineIds: ['*'] };
      }
      let updated: string[];
      if (current.includes('*')) {
        updated = [machineId];
      } else if (current.includes(machineId)) {
        updated = current.filter((id) => id !== machineId);
        if (updated.length === 0) updated = ['*'];
      } else {
        updated = [...current, machineId];
      }
      return { ...prev, authorizedMachineIds: updated };
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError('Informe o nome completo do usuário.');
      return;
    }
    if (!formData.username.trim()) {
      setFormError('Informe o nome de login de acesso.');
      return;
    }
    if (formData.password.length < 4) {
      setFormError('A senha inicial deve ter pelo menos 4 caracteres.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setFormError('As senhas digitadas não coincidem.');
      return;
    }
    if (formData.sectors.length === 0) {
      setFormError('Selecione ao menos uma função/setor autorizado.');
      return;
    }

    const res = createUser({
      name: formData.name,
      username: formData.username,
      password: formData.password,
      sectors: formData.sectors,
      shift: formData.shift,
      jobTitle: formData.jobTitle || `Operador de ${formData.sectors.join('/')}`,
      authorizedMachineIds: formData.authorizedMachineIds.length > 0 ? formData.authorizedMachineIds : ['*'],
    });

    if (!res.success) {
      setFormError(res.error || 'Erro ao cadastrar usuário.');
    } else {
      setIsCreateModalOpen(false);
      showSuccessBanner(`Usuário "${formData.name}" cadastrado com sucesso!`);
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError('O nome não pode ficar vazio.');
      return;
    }
    if (formData.sectors.length === 0) {
      setFormError('Selecione ao menos um setor autorizado.');
      return;
    }

    const res = updateUser(editingUser.id, {
      name: formData.name,
      sectors: formData.sectors,
      shift: formData.shift,
      jobTitle: formData.jobTitle,
      authorizedMachineIds: formData.authorizedMachineIds,
    });

    if (!res.success) {
      setFormError(res.error || 'Erro ao atualizar dados.');
    } else {
      setEditingUser(null);
      showSuccessBanner(`Acesso de "${formData.name}" atualizado com sucesso!`);
    }
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordResetUser) return;

    if (newResetPassword.length < 4) {
      setFormError('A nova senha deve ter no mínimo 4 caracteres.');
      return;
    }
    if (newResetPassword !== confirmResetPassword) {
      setFormError('As senhas não conferem.');
      return;
    }

    const res = resetUserPassword(passwordResetUser.id, newResetPassword);
    if (!res.success) {
      setFormError(res.error || 'Falha ao redefinir senha.');
    } else {
      setPasswordResetUser(null);
      setNewResetPassword('');
      setConfirmResetPassword('');
      showSuccessBanner(`Senha de "${passwordResetUser.name}" redefinida com sucesso!`);
    }
  };

  const handleToggleStatus = (user: User) => {
    const nextStatus = !user.isActive;
    const confirmMsg = nextStatus
      ? `Deseja reativar o acesso de ${user.name}?`
      : `Deseja desativar o acesso de ${user.name}? O histórico e registros de produção permanecerão preservados intactos.`;

    if (window.confirm(confirmMsg)) {
      toggleUserStatus(user.id, nextStatus);
      showSuccessBanner(
        `Usuário "${user.name}" ${nextStatus ? 'reativado' : 'desativado'} com sucesso.`
      );
    }
  };

  // Filtragem de Usuários
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.login.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.jobTitle && u.jobTitle.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesSector =
      filterSector === 'ALL' ||
      u.sectors?.includes(filterSector as SystemSectorCode) ||
      (filterSector === 'ADMIN' && u.role === 'ADMIN');

    const matchesStatus =
      filterStatus === 'ALL' ||
      (filterStatus === 'ACTIVE' && u.isActive !== false) ||
      (filterStatus === 'INACTIVE' && u.isActive === false);

    return matchesSearch && matchesSector && matchesStatus;
  });

  const getSectorBadge = (code: SystemSectorCode) => {
    switch (code) {
      case 'ADMIN':
        return <span key={code} className="px-2 py-0.5 bg-brand-soft/40 text-brand-dark border border-brand-soft rounded text-[11px] font-medium">Admin</span>;
      case 'PCP':
        return <span key={code} className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[11px] font-medium">PCP</span>;
      case 'REFILE':
        return <span key={code} className="px-2 py-0.5 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded text-[11px] font-medium">Refile</span>;
      case 'FLEXOGRAFIA':
        return <span key={code} className="px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded text-[11px] font-medium">Flexo</span>;
      case 'ESTAMPARIA':
        return <span key={code} className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[11px] font-medium">Estamparia</span>;
      case 'CORTE_SOLDA':
        return <span key={code} className="px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded text-[11px] font-medium">Corte & Solda</span>;
      case 'ALCA':
        return <span key={code} className="px-2 py-0.5 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded text-[11px] font-medium">Alça</span>;
      case 'EXPEDICAO':
        return <span key={code} className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[11px] font-medium">Expedição</span>;
      default:
        return <span key={code} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px]">{code}</span>;
    }
  };

  return (
    <div id="user_management_view" className="space-y-6">
      {/* Notificação de Sucesso */}
      {actionSuccessMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm flex items-center gap-2.5 animate-in fade-in duration-200 shadow-lg">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{actionSuccessMessage}</span>
        </div>
      )}

      {/* Cabeçalho da Área Administrativa */}
      <div className="bg-white border border-brand-soft/50 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-brand-soft/40 text-brand-dark border border-brand-soft rounded-full text-xs font-medium flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Controle de Acessos & RBAC
            </span>
            <span className="text-xs text-slate-500">Total: {users.length} usuários cadastrados</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
            Gestão de Usuários e Permissões
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Cadastre novos operadores, configure papéis multi-setor, redefina senhas com criptografia SHA-256 e ative/desative acessos mantendo a rastreabilidade total do histórico de OPs.
          </p>
        </div>

        <button
          id="btn_create_new_user"
          onClick={handleOpenCreate}
          className="px-4 py-2.5 bg-brand hover:bg-brand-dark text-white font-medium text-sm rounded-xl shadow-lg shadow-brand/20 flex items-center gap-2 transition-all self-start md:self-auto shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Novo Acesso</span>
        </button>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white border border-brand-soft/50 rounded-xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="input_search_users"
            type="text"
            placeholder="Buscar por nome, login ou função..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-ink placeholder-slate-400 focus:outline-none focus:border-brand"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <select
            id="select_filter_sector"
            value={filterSector}
            onChange={(e) => setFilterSector(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-ink focus:outline-none focus:border-brand"
          >
            <option value="ALL">Todos os Setores</option>
            {SECTOR_DEFINITIONS.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            id="select_filter_status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-ink focus:outline-none focus:border-brand"
          >
            <option value="ALL">Todos os Status</option>
            <option value="ACTIVE">Apenas Ativos</option>
            <option value="INACTIVE">Apenas Desativados</option>
          </select>
        </div>
      </div>

      {/* Tabela de Usuários */}
      <div className="bg-white border border-brand-soft/50 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-ink">
            <thead className="bg-brand-soft/20 border-b border-slate-200 text-[11px] uppercase tracking-wider text-brand-dark">
              <tr>
                <th className="py-3.5 px-4 font-semibold">USUÁRIO</th>
                <th className="py-3.5 px-4 font-semibold">MÁQUINA / FUNÇÃO</th>
                <th className="py-3.5 px-4 font-semibold">STATUS</th>
                <th className="py-3.5 px-4 font-semibold">ÚLTIMO ACESSO</th>
                <th className="py-3.5 px-4 font-semibold text-right">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 text-xs">
                    Nenhum usuário encontrado com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isActive = user.isActive !== false;
                  const isRootAdmin = user.login === 'admin';
                  const isCurrentAuthUser = authenticatedUser?.id === user.id;

                  // Formata a exibição amigável de Máquina e Função
                  const renderMachineFunction = () => {
                    if (user.sectors?.includes('ADMIN') || user.role === 'ADMIN') {
                      return (
                        <div>
                          <span className="font-bold text-brand">Administrador</span>
                          <span className="text-xs text-slate-500 block">Acesso Total ao Sistema</span>
                        </div>
                      );
                    }

                    const sectorNames = (user.sectors || [])
                      .map((s) => {
                        const def = SECTOR_DEFINITIONS.find((d) => d.code === s);
                        return def?.name || s;
                      })
                      .join(' + ');

                    const machineList = user.authorizedMachineIds?.includes('*')
                      ? 'Todas as máquinas do setor'
                      : user.authorizedMachineIds
                          ?.map((mId) => {
                            const found = machines.find((m) => m.id === mId || m.code === mId);
                            return found ? found.name : mId;
                          })
                          .join(', ');

                    return (
                      <div>
                        <span className="font-semibold text-ink">
                          {sectorNames || user.sector || 'Operacional'}
                        </span>
                        {machineList && (
                          <span className="text-xs text-slate-500 block mt-0.5 font-mono">
                            {machineList}
                          </span>
                        )}
                      </div>
                    );
                  };

                  return (
                    <tr
                      key={user.id}
                      className={`hover:bg-brand-soft/10 transition-colors ${
                        !isActive ? 'opacity-60 bg-slate-50' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs uppercase border shrink-0 ${
                              isActive
                                ? 'bg-brand-soft/40 border-brand-soft text-brand-dark'
                                : 'bg-slate-100 border-slate-200 text-slate-400'
                            }`}
                          >
                            {user.name.substring(0, 2)}
                          </div>
                          <div>
                            <div className="font-medium text-ink flex items-center gap-1.5">
                              <span>{user.name}</span>
                              {isCurrentAuthUser && (
                                <span className="px-1.5 py-0.2 bg-brand-soft/50 text-brand-dark rounded text-[10px]">
                                  Você
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-mono text-slate-500">@{user.login}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {renderMachineFunction()}
                      </td>

                      <td className="py-3.5 px-4">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            ATIVO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full text-xs font-medium">
                            <XCircle className="w-3.5 h-3.5" />
                            INATIVO
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-400 font-mono">
                        {user.lastLoginAt ? (
                          <span>{new Date(user.lastLoginAt).toLocaleString('pt-BR')}</span>
                        ) : (
                          <span className="text-slate-600 font-sans">Nunca acessou</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(user)}
                            className="p-1.5 hover:bg-brand-soft/20 text-slate-500 hover:text-brand rounded-lg transition-colors cursor-pointer"
                            title="Editar Funções e Máquinas"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => {
                              setPasswordResetUser(user);
                              setNewResetPassword('');
                              setConfirmResetPassword('');
                              setFormError(null);
                            }}
                            className="p-1.5 hover:bg-brand-soft/20 text-slate-500 hover:text-amber-500 rounded-lg transition-colors cursor-pointer"
                            title="Redefinir Senha"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          {!isRootAdmin && (
                            <button
                              onClick={() => handleToggleStatus(user)}
                              className={`p-1.5 hover:bg-brand-soft/20 rounded-lg transition-colors cursor-pointer ${
                                isActive
                                  ? 'text-slate-500 hover:text-rose-500'
                                  : 'text-slate-500 hover:text-emerald-500'
                              }`}
                              title={isActive ? 'Desativar Acesso' : 'Reativar Acesso'}
                            >
                              <Power className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Criação de Usuário */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white border border-brand-soft/50 rounded-2xl shadow-xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-brand" />
                <h3 className="text-lg font-bold text-ink">Cadastrar Novo Usuário</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-ink p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Elton Silva"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-ink text-sm focus:outline-none focus:border-brand"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Nome de Login (Acesso)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: elton"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-ink text-sm focus:outline-none focus:border-brand font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Turno Padrão
                  </label>
                  <select
                    value={formData.shift}
                    onChange={(e) => setFormData({ ...formData, shift: e.target.value as any })}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-ink text-sm focus:outline-none focus:border-brand"
                  >
                    <option value="TURNO_1">Turno 1 (Manhã)</option>
                    <option value="TURNO_2">Turno 2 (Tarde/Noite)</option>
                    <option value="TURNO_3">Turno 3 (Madrugada)</option>
                    <option value="GERAL">Geral (Comercial)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Senha Inicial
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-ink text-sm focus:outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Confirmar Senha
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-ink text-sm focus:outline-none focus:border-brand"
                  />
                </div>
              </div>

              {/* Seleção de Funções Autorizadas */}
              <div>
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>FUNÇÕES AUTORIZADAS</span>
                  <span className="text-[10px] text-brand font-normal">
                    {formData.sectors.length} selecionada(s)
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  {SECTOR_DEFINITIONS.map((sector) => {
                    const isSelected = formData.sectors.includes(sector.code);
                    return (
                      <button
                        type="button"
                        key={sector.code}
                        onClick={() => toggleSectorSelection(sector.code)}
                        className={`p-2.5 rounded-lg border text-left text-xs font-semibold transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-brand/15 border-brand text-brand-dark shadow-sm'
                            : 'bg-white border-slate-200 text-slate-500 hover:text-ink'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[10px] ${
                              isSelected
                                ? 'bg-brand border-brand text-white font-bold'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected ? '✓' : ''}
                          </span>
                          <span>{sector.name}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Seleção de Máquinas Autorizadas */}
              <div>
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>MÁQUINAS AUTORIZADAS</span>
                  <span className="text-[10px] text-amber-400 font-mono">
                    {formData.authorizedMachineIds?.includes('*')
                      ? 'Todas as máquinas'
                      : `${formData.authorizedMachineIds?.length || 0} máquina(s)`}
                  </span>
                </label>
                <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200 max-h-40 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => toggleMachineSelection('*')}
                    className={`w-full p-2 rounded-lg border text-left text-xs font-medium transition-all flex items-center justify-between ${
                      formData.authorizedMachineIds?.includes('*')
                        ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                        : 'bg-white border-slate-200 text-slate-500 hover:text-ink'
                    }`}
                  >
                    <span>✦ Todas as máquinas dos setores autorizados</span>
                    {formData.authorizedMachineIds?.includes('*') && (
                      <Check className="w-3.5 h-3.5 text-amber-400" />
                    )}
                  </button>
                  {machines.map((machine) => {
                    const isSelected =
                      !formData.authorizedMachineIds?.includes('*') &&
                      formData.authorizedMachineIds?.includes(machine.id);
                    return (
                      <button
                        type="button"
                        key={machine.id}
                        onClick={() => toggleMachineSelection(machine.id)}
                        className={`w-full p-2 rounded-lg border text-left text-xs transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-brand/15 border-brand text-brand-dark font-semibold'
                            : 'bg-white border-slate-200 text-slate-500 hover:text-ink'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-3 h-3 rounded border flex items-center justify-center text-[9px] ${
                              isSelected
                                ? 'bg-brand border-brand text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected ? '✓' : ''}
                          </span>
                          <span>{machine.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">({machine.code})</span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
                          {machine.sector}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Cargo / Descrição Operacional (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="ex: Operador de Refile e Flexografia"
                  value={formData.jobTitle}
                  onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-ink text-sm focus:outline-none focus:border-brand"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded-xl font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand hover:bg-brand-dark text-white text-xs rounded-xl font-medium shadow-lg shadow-brand/20"
                >
                  Salvar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Edição de Usuário */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white border border-brand-soft/50 rounded-2xl shadow-xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-brand" />
                <h3 className="text-lg font-bold text-ink">Editar Acesso de {editingUser.name}</h3>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-ink p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-ink text-sm focus:outline-none focus:border-brand"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Login de Acesso (Imutável)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={formData.username}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-sm font-mono cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Turno
                  </label>
                  <select
                    value={formData.shift}
                    onChange={(e) => setFormData({ ...formData, shift: e.target.value as any })}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-ink text-sm focus:outline-none focus:border-brand"
                  >
                    <option value="TURNO_1">Turno 1 (Manhã)</option>
                    <option value="TURNO_2">Turno 2 (Tarde/Noite)</option>
                    <option value="TURNO_3">Turno 3 (Madrugada)</option>
                    <option value="GERAL">Geral (Comercial)</option>
                  </select>
                </div>
              </div>

              {/* Múltiplos Setores / Funções Autorizadas */}
              <div>
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>FUNÇÕES AUTORIZADAS</span>
                  <span className="text-[10px] text-brand font-normal">
                    {formData.sectors.length} selecionada(s)
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  {SECTOR_DEFINITIONS.map((sector) => {
                    const isSelected = formData.sectors.includes(sector.code);
                    return (
                      <button
                        type="button"
                        key={sector.code}
                        onClick={() => toggleSectorSelection(sector.code)}
                        className={`p-2.5 rounded-lg border text-left text-xs font-semibold transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-brand/15 border-brand text-brand-dark shadow-sm'
                            : 'bg-white border-slate-200 text-slate-500 hover:text-ink'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[10px] ${
                              isSelected
                                ? 'bg-brand border-brand text-white font-bold'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected ? '✓' : ''}
                          </span>
                          <span>{sector.name}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Seleção de Máquinas Autorizadas */}
              <div>
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>MÁQUINAS AUTORIZADAS</span>
                  <span className="text-[10px] text-amber-400 font-mono">
                    {formData.authorizedMachineIds?.includes('*')
                      ? 'Todas as máquinas'
                      : `${formData.authorizedMachineIds?.length || 0} máquina(s)`}
                  </span>
                </label>
                <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200 max-h-40 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => toggleMachineSelection('*')}
                    className={`w-full p-2 rounded-lg border text-left text-xs font-medium transition-all flex items-center justify-between ${
                      formData.authorizedMachineIds?.includes('*')
                        ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                        : 'bg-white border-slate-200 text-slate-500 hover:text-ink'
                    }`}
                  >
                    <span>✦ Todas as máquinas dos setores autorizados</span>
                    {formData.authorizedMachineIds?.includes('*') && (
                      <Check className="w-3.5 h-3.5 text-amber-400" />
                    )}
                  </button>
                  {machines.map((machine) => {
                    const isSelected =
                      !formData.authorizedMachineIds?.includes('*') &&
                      formData.authorizedMachineIds?.includes(machine.id);
                    return (
                      <button
                        type="button"
                        key={machine.id}
                        onClick={() => toggleMachineSelection(machine.id)}
                        className={`w-full p-2 rounded-lg border text-left text-xs transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-brand/15 border-brand text-brand-dark font-semibold'
                            : 'bg-white border-slate-200 text-slate-500 hover:text-ink'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-3 h-3 rounded border flex items-center justify-center text-[9px] ${
                              isSelected
                                ? 'bg-brand border-brand text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected ? '✓' : ''}
                          </span>
                          <span>{machine.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">({machine.code})</span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
                          {machine.sector}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Cargo / Descrição Operacional
                </label>
                <input
                  type="text"
                  value={formData.jobTitle}
                  onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-ink text-sm focus:outline-none focus:border-brand"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded-xl font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand hover:bg-brand-dark text-white text-xs rounded-xl font-medium shadow-lg shadow-brand/20"
                >
                  Atualizar Acesso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Redefinição de Senha */}
      {passwordResetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white border border-brand-soft/50 rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-bold text-ink">Redefinir Senha</h3>
              </div>
              <button
                onClick={() => setPasswordResetUser(null)}
                className="text-slate-400 hover:text-ink p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Defina uma nova senha de acesso para o usuário{' '}
              <strong className="text-ink">{passwordResetUser.name}</strong> (@{passwordResetUser.login}).
            </p>

            {formError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Nova Senha
                </label>
                <div className="relative">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    placeholder="Mínimo 4 caracteres"
                    value={newResetPassword}
                    onChange={(e) => setNewResetPassword(e.target.value)}
                    className="w-full px-3.5 py-2 pr-10 bg-white border border-slate-200 rounded-xl text-ink text-sm focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-ink"
                  >
                    {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Confirmar Nova Senha
                </label>
                <input
                  type={showResetPassword ? 'text' : 'password'}
                  required
                  placeholder="Repita a nova senha"
                  value={confirmResetPassword}
                  onChange={(e) => setConfirmResetPassword(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-ink text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setPasswordResetUser(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded-xl font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs rounded-xl font-medium shadow-lg shadow-amber-600/20"
                >
                  Redefinir Senha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
