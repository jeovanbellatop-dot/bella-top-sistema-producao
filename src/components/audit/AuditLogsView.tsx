import React, { useState } from 'react';
import { useMesStore } from '../../hooks/useMesStore';
import { getUserMachineSummary } from '../../utils/userMachines';
import { History, Search, ShieldCheck, Clock, User, Filter } from 'lucide-react';

export const AuditLogsView: React.FC = () => {
  const { auditLogs, users, machines } = useMesStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [entityFilter, setEntityFilter] = useState('ALL');

  const filteredLogs = auditLogs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.entityId && log.entityId.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesEntity = entityFilter === 'ALL' || log.entityType === entityFilter;

    return matchesSearch && matchesEntity;
  });

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white border border-[#E5DAD3] p-5 rounded-2xl">
        <h2 className="text-xl font-extrabold text-[#1C1418] flex items-center gap-2">
          <History className="w-5 h-5 text-amber-400" />
          <span>Rastreabilidade & Trilha de Auditoria (Audit Trail)</span>
        </h2>
        <p className="text-xs text-[#6E615B] mt-0.5">
          Registro imutável de todas as ações de chão de fábrica, apontamentos de operadores, pausas e alterações de roteiro pelo PCP.
        </p>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-[#E5DAD3] p-4 rounded-xl text-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-[#6E615B] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por Ação, Operador, Detalhes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#FAF5F1] border border-[#E5DAD3] text-[#1C1418] rounded-lg pl-9 pr-3 py-2 text-xs placeholder-[#9A8B84] focus:outline-none focus:border-amber-400"
          />
        </div>

        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="bg-[#FAF5F1] border border-[#E5DAD3] text-[#1C1418] rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-amber-400"
        >
          <option value="ALL">Todas as Entidades</option>
          <option value="OP">Ordens de Produção (OP)</option>
          <option value="OPERATION">Operações & Apontamentos</option>
          <option value="MACHINE">Máquinas & Equipamentos</option>
          <option value="ROUTING">Roteiros Dinâmicos</option>
          <option value="CONFIG">Configurações do Sistema</option>
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-[#E5DAD3] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF5F1] text-[#6E615B] uppercase text-[10px] tracking-wider border-b border-[#E5DAD3] font-semibold">
              <tr>
                <th className="py-3 px-4">Data / Hora</th>
                <th className="py-3 px-4">Usuário</th>
                <th className="py-3 px-4">Ação Realizada</th>
                <th className="py-3 px-4">Entidade</th>
                <th className="py-3 px-4">Detalhes Técnicos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DAD3] font-medium text-[#3A3034]">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#F2EBE6] transition-colors">
                  <td className="py-3 px-4 font-mono text-[11px] text-[#6E615B] whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString('pt-BR')}
                  </td>

                  <td className="py-3 px-4">
                    <div className="font-bold text-[#1C1418] text-xs">{log.userName}</div>
                    <div className="text-[10px] text-amber-400/80 font-mono">{log.userRole}</div>
                    {(() => {
                      const userObj = users.find((u) => u.name === log.userName || u.id === log.userId);
                      if (!userObj) return null;
                      return (
                        <div className="text-[9px] text-[#6E615B] mt-0.5">
                          ⚙️ {getUserMachineSummary(userObj, machines)}
                        </div>
                      );
                    })()}
                  </td>

                  <td className="py-3 px-4 font-semibold text-[#1C1418]">{log.action}</td>

                  <td className="py-3 px-4">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#F2EBE6] text-[#3A3034] border border-[#E5DAD3]">
                      {log.entityType}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-[#3A3034] text-xs">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
