import React, { useState } from 'react';
import { KeyRound, X, AlertTriangle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useMesStore } from '../../hooks/useMesStore';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { authenticatedUser, changePassword } = useMesStore();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen || !authenticatedUser) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentPassword) {
      setError('Informe a senha atual.');
      return;
    }
    if (newPassword.length < 4) {
      setError('A nova senha deve ter pelo menos 4 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As novas senhas não coincidem.');
      return;
    }

    const res = changePassword(currentPassword, newPassword);
    if (!res.success) {
      setError(res.error || 'Erro ao alterar senha.');
    } else {
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        onClose();
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1418]/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white border border-[#E5DAD3] rounded-3xl shadow-2xl p-6 sm:p-7">
        <div className="flex items-center justify-between pb-4 border-b border-[#E5DAD3] mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FFF5FA] border border-[#F5C6DC] flex items-center justify-center text-[#E30A78]">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1C1418]">Alterar Minha Senha</h3>
              <p className="text-[11px] text-[#6E615B]">Atualize sua credencial de acesso</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#8A7D77] hover:text-[#1C1418] p-1 rounded-lg hover:bg-[#FAF5F1] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Senha alterada com sucesso!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#1C1418] uppercase tracking-wider mb-1.5">
              Senha Atual
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 pr-10 bg-[#FAF5F1] border border-[#E5DAD3] rounded-xl text-[#1C1418] text-sm focus:outline-none focus:ring-2 focus:ring-[#E30A78] focus:border-[#E30A78] focus:bg-white transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#8A7D77] hover:text-[#1C1418]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#1C1418] uppercase tracking-wider mb-1.5">
              Nova Senha
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="Mínimo 4 caracteres"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#FAF5F1] border border-[#E5DAD3] rounded-xl text-[#1C1418] text-sm placeholder-[#8A7D77] focus:outline-none focus:ring-2 focus:ring-[#E30A78] focus:border-[#E30A78] focus:bg-white transition-all font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#1C1418] uppercase tracking-wider mb-1.5">
              Confirmar Nova Senha
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#FAF5F1] border border-[#E5DAD3] rounded-xl text-[#1C1418] text-sm focus:outline-none focus:ring-2 focus:ring-[#E30A78] focus:border-[#E30A78] focus:bg-white transition-all font-mono"
            />
          </div>

          <div className="pt-4 border-t border-[#E5DAD3] flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#FAF5F1] hover:bg-[#E5DAD3] text-[#1C1418] text-xs rounded-xl font-bold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#E30A78] hover:bg-[#B30A5C] text-white text-xs rounded-xl font-bold shadow-md shadow-[#E30A78]/20 transition-all cursor-pointer"
            >
              Salvar Nova Senha
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
