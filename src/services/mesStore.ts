import {
  ProductionOrder,
  Machine,
  ProductTechnicalSpec,
  ProcessType,
  RoutingRule,
  User,
  AuditLogEntry,
  FactoryAlert,
  ExtractedOpData,
  OperationStep,
  PriorityLevel,
  PauseLog,
  LossClassification,
  LossDestination,
  SystemSectorCode,
  MachineSession,
  MachineOpRecommendation,
} from '../types/mes';
import {
  INITIAL_MACHINES,
  INITIAL_PRODUCTS,
  INITIAL_PROCESS_TYPES,
  INITIAL_ROUTING_RULES,
  INITIAL_USERS,
  INITIAL_ORDERS,
  INITIAL_AUDIT_LOGS,
  INITIAL_ALERTS,
  buildRouteBlueprint
} from '../data/initialData';
import type { RouteBlueprint } from '../data/initialData';
import { hashPassword, generateSalt, verifyPassword, normalizeUsername } from '../utils/authCrypto';
import { isUserAuthorizedForMachine, getActiveAdministrators } from '../utils/userMachines';

const STORAGE_KEYS = {
  MACHINES: 'bellatop_machines_v2',
  PRODUCTS: 'bellatop_products_v2',
  PROCESSES: 'bellatop_processes_v2',
  RULES: 'bellatop_rules_v2',
  USERS: 'bellatop_users_v4',
  ORDERS: 'bellatop_orders_v2',
  AUDIT: 'bellatop_audit_v2',
  ALERTS: 'bellatop_alerts_v2',
  PAUSES: 'bellatop_pauses_v2',
  CURRENT_USER: 'bellatop_current_user_v2',
  AUTH_SESSION: 'bellatop_auth_session_v3',
  SELECTED_SECTOR: 'bellatop_selected_sector_v3',
  MACHINE_SESSIONS: 'bellatop_machine_sessions_v1',
  ACTIVE_OPERATOR_MACHINE_ID: 'bellatop_active_op_machine_id_v2',
};

type Listener = () => void;

class MesStore {
  private machines: Machine[] = [];
  private products: ProductTechnicalSpec[] = [];
  private processTypes: ProcessType[] = [];
  private routingRules: RoutingRule[] = [];
  private users: User[] = [];
  private orders: ProductionOrder[] = [];
  private auditLogs: AuditLogEntry[] = [];
  private alerts: FactoryAlert[] = [];
  private pauseLogs: PauseLog[] = [];
  private machineSessions: Record<string, MachineSession> = {};
  private currentUser: User;
  private authenticatedUser: User | null = null;
  private selectedSector: SystemSectorCode | null = null;
  private authSessionToken: string | null = null;
  private activeOperatorMachineId: string | null = null;
  private failedAttempts: Record<string, { count: number; lastAttempt: number; blockedUntil?: number }> = {};
  private listeners: Set<Listener> = new Set();
  private sharedDataSyncTimer: ReturnType<typeof setInterval> | null = null;
  /**
   * Último erro real de gravação de OP no Firestore.
   * ANTES este erro era engolido por um .catch(() => {}) silencioso: o Firestore
   * recusava a OP (documento acima de 1 MiB) e a tela continuava dizendo que
   * tinha salvado, porque o localStorage aceitava. Agora o erro fica visível.
   */
  private lastOrdersSyncError: string | null = null;
  /**
   * Sombra da última versão conhecida de cada OP, usada para carimbar updatedAt
   * apenas nas OPs que realmente mudaram. Sem esse carimbo, a mesclagem entre
   * dispositivos era "quem grava por último vence", e o tablet do PCP apagava o
   * apontamento que o operador tinha acabado de fazer.
   */
  private orderShadow: Map<string, string> = new Map();
  private sharedDataSyncInFlight = false;
  private applyingRemoteSharedData = false;
  private ordersSyncDebounceTimer: ReturnType<typeof setTimeout> | null = null
  private ordersSyncInFlight = false
  /** OPs alteradas neste aparelho e ainda nao confirmadas no servidor. */
  private pendingOrderPushIds: Set<string> = new Set()
  /** Aviso visivel quando outro aparelho gravou a mesma OP ao mesmo tempo. */
  private lastOrdersConflict: string | null = null
  /** Registros de historico (auditoria, paradas, alertas) ja confirmados no servidor. */
  private syncedHistoryIds: Set<string> = new Set()
  private historyPushInFlight = false
  private historyPullInFlight = false
  /** Ultima versao de cada maquina/usuario ja enviada ao servidor por este aparelho. */
  private machineShadow: Map<string, string> = new Map()
  private userShadow: Map<string, string> = new Map()
  private dualWriteDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.currentUser = INITIAL_USERS[0];
    this.loadFromStorage();
    this.recalculateAllPriorities();
    this.releaseMachinesWithFinishedSteps();
    this.startSharedDataSync();
  }

  private loadFromStorage() {
    try {
      if (typeof localStorage === 'undefined') {
        this.machines = [...INITIAL_MACHINES];
        this.products = [...INITIAL_PRODUCTS];
        this.processTypes = [...INITIAL_PROCESS_TYPES];
        this.routingRules = [...INITIAL_ROUTING_RULES];
        this.users = [...INITIAL_USERS];
        this.orders = [...INITIAL_ORDERS];
        return;
      }

      const storedMachines = localStorage.getItem(STORAGE_KEYS.MACHINES);
      const parsedMachines: Machine[] = storedMachines
        ? JSON.parse(storedMachines)
        : [];

      // Cadastro oficial é sempre reposto, mesmo quando o armazenamento contém [].
      // Registros equivalentes são reutilizados por ID, código ou nome+setor.
      // Itens antigos permanecem preservados como LEGADO e não aparecem nas telas ativas.
      const normalize = (value?: string) =>
        (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

      const isEquivalent = (stored: Machine, official: Machine) =>
        stored.id === official.id ||
        stored.code === official.code ||
        (normalize(stored.name) === normalize(official.name) &&
          normalize(stored.sector) === normalize(official.sector));

      const officialMachines = INITIAL_MACHINES.map((official) => {
        const existing = parsedMachines.find((stored) => isEquivalent(stored, official));
        if (!existing) return { ...official };

        // Preserva o estado real salvo pelo operador/sistema (status, pausas, OP atual)
        return {
          ...official,
          ...existing,
          id: official.id, // Garante id canônico estável
          name: existing.name || official.name,
          code: existing.code || official.code,
          sector: existing.sector || official.sector,
          status: existing.status || official.status,
          isActive: typeof existing.isActive === 'boolean' ? existing.isActive : official.isActive,
          currentOpId: existing.currentOpId,
          currentOperationId: existing.currentOperationId,
          currentPauseReason: existing.currentPauseReason,
          pauseStartedAt: existing.pauseStartedAt,
          activeOperatorId: existing.activeOperatorId,
          activeOperatorName: existing.activeOperatorName,
          authorizedOperatorIds: existing.authorizedOperatorIds || official.authorizedOperatorIds,
        };
      });

      const customMachines = parsedMachines
        .filter((stored) => !INITIAL_MACHINES.some((official) => isEquivalent(stored, official)));

      this.machines = [...officialMachines, ...customMachines];

      const storedProducts = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      this.products = storedProducts ? JSON.parse(storedProducts) : INITIAL_PRODUCTS;

      const storedProcesses = localStorage.getItem(STORAGE_KEYS.PROCESSES);
      this.processTypes = storedProcesses ? JSON.parse(storedProcesses) : INITIAL_PROCESS_TYPES;

      const storedRules = localStorage.getItem(STORAGE_KEYS.RULES);
      this.routingRules = storedRules ? JSON.parse(storedRules) : INITIAL_ROUTING_RULES;

      const storedUsers = localStorage.getItem(STORAGE_KEYS.USERS);
      if (storedUsers) {
        const parsedUsers: User[] = JSON.parse(storedUsers);
        // Sincroniza e garante a lista canônica de usuários com histórico preservado
        this.users = INITIAL_USERS.map((init) => {
          // Busca correspondência por login normalizado, username ou id
          const stored = parsedUsers.find(
            (u) =>
              normalizeUsername(u.login) === normalizeUsername(init.login) ||
              normalizeUsername(u.username || '') === normalizeUsername(init.login) ||
              u.id === init.id
          );

          if (stored) {
            // Se o admin redefiniu a senha no painel
            const isPasswordChanged =
              stored.passwordHash &&
              stored.passwordHash !== init.passwordHash &&
              stored.passwordSalt &&
              stored.updatedAt &&
              new Date(stored.updatedAt).getTime() > new Date(init.updatedAt).getTime();

            return {
              ...init,
              // Preserva nome canônico e id canônico para evitar contaminação de dados legados
              id: init.id,
              login: init.login,
              username: init.username || init.login,
              name: stored.name && stored.name !== 'Welton' && stored.name !== 'Gabriel' ? stored.name : init.name,
              passwordHash: isPasswordChanged ? stored.passwordHash : init.passwordHash,
              passwordSalt: isPasswordChanged && stored.passwordSalt ? stored.passwordSalt : init.passwordSalt,
              sectors: stored.sectors && stored.sectors.length > 0 ? stored.sectors : init.sectors,
              authorizedMachineIds:
                stored.authorizedMachineIds && stored.authorizedMachineIds.length > 0
                  ? stored.authorizedMachineIds
                  : init.authorizedMachineIds,
              assignedMachineNames: init.assignedMachineNames,
              role: init.role,
              jobTitle: init.jobTitle,
              shift: stored.shift || init.shift,
              isActive: typeof stored.isActive === 'boolean' ? stored.isActive : init.isActive,
              lastLoginAt: stored.lastLoginAt || init.lastLoginAt,
            };
          }
          return { ...init };
        });

        // Adiciona usuários customizados criados pelo admin que não façam parte do seed inicial
        parsedUsers.forEach((customUser) => {
          if (
            !this.users.some(
              (u) =>
                u.id === customUser.id ||
                normalizeUsername(u.login) === normalizeUsername(customUser.login)
            )
          ) {
            this.users.push(customUser);
          }
        });
      } else {
        this.users = INITIAL_USERS;
      }

      const storedOrders = localStorage.getItem(STORAGE_KEYS.ORDERS);
      this.orders = storedOrders ? JSON.parse(storedOrders) : INITIAL_ORDERS;

      const storedAudit = localStorage.getItem(STORAGE_KEYS.AUDIT);
      this.auditLogs = storedAudit ? JSON.parse(storedAudit) : INITIAL_AUDIT_LOGS;

      const storedAlerts = localStorage.getItem(STORAGE_KEYS.ALERTS);
      this.alerts = storedAlerts ? JSON.parse(storedAlerts) : INITIAL_ALERTS;

      const storedPauses = localStorage.getItem(STORAGE_KEYS.PAUSES);
      this.pauseLogs = storedPauses ? JSON.parse(storedPauses) : [];

      const storedMachineSessions = localStorage.getItem(STORAGE_KEYS.MACHINE_SESSIONS);
      this.machineSessions = storedMachineSessions ? JSON.parse(storedMachineSessions) : {};

      const storedActiveMachineId = localStorage.getItem(STORAGE_KEYS.ACTIVE_OPERATOR_MACHINE_ID);

      // Sessão de autenticação real
      const storedSession = localStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
      if (storedSession) {
        try {
          const sessionData = JSON.parse(storedSession);
          if (sessionData && sessionData.userId) {
            const validUser = this.users.find((u) => u.id === sessionData.userId && u.isActive);
            if (validUser) {
              this.authenticatedUser = validUser;
              this.currentUser = validUser;
              this.authSessionToken = sessionData.token || null;

              const targetMachineId = sessionData.machineId || storedActiveMachineId;
              if (targetMachineId) {
                const mac = this.machines.find(
                  (m) => m.id === targetMachineId && m.isActive && m.status !== 'INATIVA' && m.id !== 'm1-corte-solda'
                );
                if (mac && isUserAuthorizedForMachine(validUser, mac, this.machines)) {
                  this.activeOperatorMachineId = targetMachineId;
                  if (!this.machineSessions[targetMachineId]) {
                    this.machineSessions[targetMachineId] = {
                      machineId: mac.id,
                      machineName: mac.name,
                      machineCode: mac.code,
                      machineSector: mac.sector,
                      operatorId: validUser.id,
                      operatorName: validUser.name,
                      operatorLogin: validUser.login,
                      role: validUser.role,
                      authorizedMachineIds: validUser.authorizedMachineIds,
                      loginTime: sessionData.loginTime || new Date().toISOString(),
                    };
                  }
                } else {
                  this.activeOperatorMachineId = null;
                  localStorage.removeItem(STORAGE_KEYS.ACTIVE_OPERATOR_MACHINE_ID);
                }
              }

              const storedSector = localStorage.getItem(STORAGE_KEYS.SELECTED_SECTOR) as SystemSectorCode | null;
              if (storedSector && (validUser.sectors?.includes(storedSector) || validUser.sectors?.includes('ADMIN'))) {
                this.selectedSector = storedSector;
              } else if (validUser.sectors && validUser.sectors.length === 1) {
                this.selectedSector = validUser.sectors[0];
              }
            } else {
              localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
              localStorage.removeItem(STORAGE_KEYS.SELECTED_SECTOR);
              localStorage.removeItem(STORAGE_KEYS.ACTIVE_OPERATOR_MACHINE_ID);
            }
          }
        } catch {
          // Sessão corrompida
          localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
          localStorage.removeItem(STORAGE_KEYS.ACTIVE_OPERATOR_MACHINE_ID);
        }
      }
    } catch {
      this.machines = INITIAL_MACHINES;
      this.products = INITIAL_PRODUCTS;
      this.processTypes = INITIAL_PROCESS_TYPES;
      this.routingRules = INITIAL_ROUTING_RULES;
      this.users = INITIAL_USERS;
      this.orders = INITIAL_ORDERS;
      this.auditLogs = INITIAL_AUDIT_LOGS;
      this.alerts = INITIAL_ALERTS;
      this.pauseLogs = [];
      this.currentUser = INITIAL_USERS[0];
      this.authenticatedUser = null;
      this.activeOperatorMachineId = null;
    }

    // Sombra inicial: o que veio do disco não é alteração, não carimba updatedAt.
    this.resetOrderShadow();
    // Primeira carga do aparelho: tudo que existe aqui entra na fila de envio.
    // O servidor rejeita (409) qualquer copia mais antiga que a dele.
    for (const order of this.orders) this.pendingOrderPushIds.add(order.id);
  }

  private saveToStorage() {
    try {
      if (typeof localStorage === 'undefined') return;

      // Carimba updatedAt nas OPs alteradas ANTES de persistir e de enviar ao backend.
      // Dados vindos do Firestore já trazem o próprio carimbo e não são recarimbados.
      if (!this.applyingRemoteSharedData) {
        this.stampUpdatedAtOnChangedOrders();
      }
      localStorage.setItem(STORAGE_KEYS.MACHINES, JSON.stringify(this.machines));
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(this.products));
      localStorage.setItem(STORAGE_KEYS.PROCESSES, JSON.stringify(this.processTypes));
      localStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify(this.routingRules));
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(this.users));
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(this.orders));
      localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(this.auditLogs));
      localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(this.alerts));
      localStorage.setItem(STORAGE_KEYS.PAUSES, JSON.stringify(this.pauseLogs));
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(this.currentUser));
      localStorage.setItem(STORAGE_KEYS.MACHINE_SESSIONS, JSON.stringify(this.machineSessions));
      if (this.activeOperatorMachineId) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_OPERATOR_MACHINE_ID, this.activeOperatorMachineId);
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_OPERATOR_MACHINE_ID);
      }
      if (this.authenticatedUser) {
        localStorage.setItem(
          STORAGE_KEYS.AUTH_SESSION,
          JSON.stringify({
            userId: this.authenticatedUser.id,
            machineId: this.activeOperatorMachineId || undefined,
            token: this.authSessionToken,
            loginTime: new Date().toISOString(),
          })
        );
      } else {
        localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
      }
      if (this.selectedSector) {
        localStorage.setItem(STORAGE_KEYS.SELECTED_SECTOR, this.selectedSector);
      } else {
        localStorage.removeItem(STORAGE_KEYS.SELECTED_SECTOR);
      }

      if (!this.applyingRemoteSharedData) {
        // Dual-write assíncrono e best-effort (fire-and-forget) para o Firestore no backend (/api/db)
        // Escopo estrito: SOMENTE máquinas e usuários. Não bloqueia a UI nem lança erro.
        this.syncMachinesAndUsersToBackend();
      this.syncHistoryToBackend();
        this.syncOrdersToBackend()
      }
    } catch {
      // ignore storage quota errors in sandbox
    }
    this.notify();
  }

  /**
   * Dual-write assíncrono (fire-and-forget) de máquinas e usuários para o Firestore via /api/db.
   * Não lança exceções para quem chama saveToStorage, não bloqueia o fluxo síncrono da UI
   * e mantém o localStorage / memória como fonte primária única de leitura no frontend.
   * Possui debounce de 2000ms para evitar requisições repetitivas a cada alteração da UI.
   */
  private syncMachinesAndUsersToBackend(): void {
    if (typeof fetch === 'undefined') return;

    if (this.dualWriteDebounceTimer) {
      clearTimeout(this.dualWriteDebounceTimer);
      this.dualWriteDebounceTimer = null;
    }

    this.dualWriteDebounceTimer = setTimeout(() => {
      this.dualWriteDebounceTimer = null;
      try {
        const machinesPayload = this.machines.filter(
          (mac) => this.machineShadow.get(mac.id) !== JSON.stringify(mac)
        );
        const usersPayload = this.users.filter(
          (usr) => this.userShadow.get(usr.id) !== JSON.stringify(usr)
        );

        // Nada mudou neste aparelho: nao reenvia a fabrica inteira a cada acao.
        if (machinesPayload.length === 0 && usersPayload.length === 0) return;

        machinesPayload.forEach((mac) => this.machineShadow.set(mac.id, JSON.stringify(mac)));
        usersPayload.forEach((usr) => this.userShadow.set(usr.id, JSON.stringify(usr)));

        // Executa de forma completamente desacoplada sem await bloqueante
        Promise.allSettled([
          // Sincronização de máquinas
          ...machinesPayload.map((m) =>
            fetch(`/api/db/maquinas/${encodeURIComponent(m.id)}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(m),
            }).catch(() => {
              // fallback silencioso se a máquina ainda não existir no Firestore
              return fetch('/api/db/maquinas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(m),
              });
            })
          ),
          // Sincronização de usuários
          ...usersPayload.map((u) =>
            fetch(`/api/db/usuarios/${encodeURIComponent(u.id)}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(u),
            }).catch(() => {
              // fallback silencioso se o usuário ainda não existir no Firestore
              return fetch('/api/db/usuarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(u),
              });
            })
          ),
        ]).catch(() => {
          // Silêncio total em caso de offline, quota ou erro transitório
        });
      } catch {
        // Garantia absoluta de não lançamento de erros
      }
    }, 2000);
  }

  /**
   * Dual write assíncrono (fire-and-forget) de Ordens de Produção para o Firestore via /api/db.
   * Não lança exceções para quem chama saveToStorage, não bloqueia o fluxo síncrono da UI
   * e mantém o localStorage como fonte primária. Debounce próprio, independente do debounce
   * de máquinas/usuários, para não atrasar aquela sincronização.
   */
  private syncOrdersToBackend(): void {
    if (typeof fetch === 'undefined') return

    if (this.ordersSyncDebounceTimer) {
      clearTimeout(this.ordersSyncDebounceTimer)
      this.ordersSyncDebounceTimer = null
    }

    this.ordersSyncDebounceTimer = setTimeout(() => {
      this.ordersSyncDebounceTimer = null
      try {
        const idsToPush = new Set(this.pendingOrderPushIds)
        const ordersPayload = this.orders.filter(o => idsToPush.has(o.id))
        if (ordersPayload.length === 0) return
        idsToPush.forEach(id => this.pendingOrderPushIds.delete(id))

        // POST /api/db/ops faz upsert idempotente (set()) tanto para OPs novas quanto existentes,
        // incluindo o array de steps. Fire-and-forget, sem await bloqueante.
        Promise.allSettled(
          ordersPayload.map(async order => {
            const response = await fetch(`/api/db/ops`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(order),
            })

            if (response.status === 409) {
              // Outro aparelho gravou uma versao mais nova desta OP ao mesmo tempo.
              // O proximo ciclo de leitura traz o estado do servidor, entao o
              // operador precisa saber que o apontamento dele foi substituido.
              this.lastOrdersConflict = `A OP ${order.opNumber || order.id} foi alterada por outro dispositivo ao mesmo tempo. O sistema carregou a versao do servidor - confira o apontamento desta OP.`
              this.notify()
              // Outro dispositivo ja gravou uma versao mais nova desta OP.
              // Nao e erro: o proximo ciclo de leitura traz o estado correto.
              return
            }

            if (!response.ok) {
              let detail = `HTTP ${response.status}`
              try {
                const body = await response.json()
                if (body?.error) detail = String(body.error)
              } catch {
                // corpo não-JSON: mantém o código HTTP
              }
              throw new Error(`OP ${order.opNumber || order.id}: ${detail}`)
            }
          })
        )
          .then(results => {
            const failures = results
              .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
              .map(r => (r.reason instanceof Error ? r.reason.message : String(r.reason)))

            if (failures.length > 0) idsToPush.forEach(id => this.pendingOrderPushIds.add(id))

            const previous = this.lastOrdersSyncError
            if (failures.length > 0) {
              const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false
              this.lastOrdersSyncError = isOffline
                ? 'Sem conexão: as Ordens de Produção ainda não foram gravadas no servidor.'
                : `${failures.length} Ordem(ns) de Produção não foram gravadas no servidor. ${failures[0]}`
              console.error('[Firestore Sync] Falha ao gravar OPs:', failures)
            } else {
              this.lastOrdersSyncError = this.lastOrdersConflict
            }

            if (previous !== this.lastOrdersSyncError) this.notify()
          })
          .catch(() => {
            // Promise.allSettled não rejeita; guarda defensiva apenas.
          })
      } catch {
        // Garantia absoluta de não lançamento de erros
      }
    }, 2000)
  }

  /**
   * Busca Ordens de Produção do backend (Firestore) e mescla com o estado local.
   * Roda no mesmo ciclo de startSharedDataSync (a cada 5s), com guard próprio
   * (ordersSyncInFlight) isolado do guard de máquinas/usuários.
   */
  private syncOrdersFromBackend(): void {
    if (this.ordersSyncInFlight || typeof fetch === 'undefined') return

    this.ordersSyncInFlight = true
    fetch(`/api/db/ops`, { cache: 'no-store' })
      .then(async (listResponse) => {
        if (!listResponse.ok) {
          throw new Error('Falha ao listar OPs do backend')
        }
        const listJson: any = await listResponse.json()
        const opsList: any[] = Array.isArray(listJson)
          ? listJson
          : Array.isArray(listJson?.data)
          ? listJson.data
          : []

        const localStamps = new Map(this.orders.map(o => [o.id, String(o.updatedAt || '')]))
        const opIds: string[] = opsList
          .filter((o: any) => {
            if (!o || typeof o.id !== 'string') return false
            const localStamp = localStamps.get(o.id)
            // Carrega o detalhe apenas de OPs novas ou realmente alteradas no servidor.
            if (localStamp === undefined) return true
            return String(o.updatedAt || '') !== localStamp
          })
          .map((o: any) => o.id as string)

        if (opIds.length === 0) return

        const detailResults = await Promise.allSettled(
          opIds.map(id => fetch(`/api/db/ops/${encodeURIComponent(id)}`, { cache: 'no-store' }))
        )

        const remoteOrders: ProductionOrder[] = []
        for (const result of detailResults) {
          if (result.status !== 'fulfilled' || !result.value.ok) continue
          try {
            const json: any = await result.value.json()
            const order = json && typeof json === 'object' && 'data' in json ? json.data : json
            if (order && order.id) remoteOrders.push(order as ProductionOrder)
          } catch {
            // ignora item malformado
          }
        }

        const changed = this.applyRemoteOrders(remoteOrders)
        const machinesFreed = this.releaseMachinesWithFinishedSteps()
        if (machinesFreed) {
          // Gravacao normal (sem flag de remoto) para que a liberacao da maquina
          // tambem suba para o servidor e valha para os outros aparelhos.
          this.saveToStorage()
        }
        if (changed) {
          this.applyingRemoteSharedData = true
          try {
            this.saveToStorage()
          } finally {
            this.applyingRemoteSharedData = false
          }
        }
      })
      .catch(() => {
        // Silêncio total em caso de offline, quota ou erro transitório
      })
      .finally(() => {
        this.ordersSyncInFlight = false
      })
  }

  /**
   * Mescla OPs remotas (Firestore) com o estado local. Mesmo princípio de
   * applyRemoteSharedData: Firestore é fonte da verdade para quem já existe remotamente;
   * mantém a versão local se ainda não sincronizada; adiciona OPs que só existem no remoto.
   */
  private applyRemoteOrders(remoteOrders: ProductionOrder[]): boolean {
    let changed = false
    if (!Array.isArray(remoteOrders) || remoteOrders.length === 0) return changed

    const remoteOrdersMap = new Map<string, ProductionOrder>()
    for (const o of remoteOrders) {
      if (o && o.id) remoteOrdersMap.set(o.id, o)
    }

    const mergedOrders: ProductionOrder[] = []
    const visitedOrderIds = new Set<string>()

    for (const localOrder of this.orders) {
      visitedOrderIds.add(localOrder.id)
      const remote = remoteOrdersMap.get(localOrder.id)

      if (!remote) {
        // Ainda não propagada para o Firestore: preserva a versão local.
        mergedOrders.push(localOrder)
        continue
      }

      // Resolução de conflito por carimbo de hora. ANTES o remoto sempre vencia,
      // o que fazia o dispositivo do PCP sobrescrever o apontamento recém-feito
      // pelo operador — a OP "voltava" ao estado anterior ao trocar de tela.
      const localStamp = localOrder.updatedAt || ''
      const remoteStamp = remote.updatedAt || ''

      if (localStamp && remoteStamp && localStamp > remoteStamp) {
        mergedOrders.push(localOrder)
      } else if (localStamp && !remoteStamp) {
        mergedOrders.push(localOrder)
      } else {
        mergedOrders.push(remote)
      }
    }

    for (const [remoteId, remoteOrder] of remoteOrdersMap.entries()) {
      if (!visitedOrderIds.has(remoteId)) {
        mergedOrders.push(remoteOrder)
        visitedOrderIds.add(remoteId)
      }
    }

    if (JSON.stringify(this.orders) !== JSON.stringify(mergedOrders)) {
      this.orders = mergedOrders
      this.recalculateAllPriorities()
      // A mesclagem não é edição do usuário: realinha a sombra sem recarimbar.
      this.resetOrderShadow()
      changed = true
    }

    return changed
  }

  private startSharedDataSync(): void {
    if (typeof fetch === 'undefined' || this.sharedDataSyncTimer) return;

    this.syncSharedDataFromBackend();
    this.syncOrdersFromBackend()
    this.sharedDataSyncTimer = setInterval(() => {
      this.syncSharedDataFromBackend();
      this.syncOrdersFromBackend()
      this.syncHistoryFromBackend()
      this.syncHistoryToBackend()
      // Varredura de seguranca a cada ciclo: nenhum posto pode continuar preso
      // a uma etapa ja finalizada. E o que fazia a OP voltar para o operador.
      if (this.releaseMachinesWithFinishedSteps()) {
        this.saveToStorage()
      }
    }, 5000);
  }

  private syncSharedDataFromBackend(): void {
    if (this.sharedDataSyncInFlight || typeof fetch === 'undefined') return;

    this.sharedDataSyncInFlight = true;
    Promise.all([
      fetch('/api/db/maquinas', { cache: 'no-store' }),
      fetch('/api/db/usuarios', { cache: 'no-store' }),
    ])
      .then(async ([machinesResponse, usersResponse]) => {
        if (!machinesResponse.ok || !usersResponse.ok) {
          throw new Error('Falha ao ler dados compartilhados do Firestore.');
        }

        const [remoteMachines, remoteUsers] = await Promise.all([
          machinesResponse.json() as Promise<Machine[]>,
          usersResponse.json() as Promise<User[]>,
        ]);

        const changed = this.applyRemoteSharedData(remoteMachines, remoteUsers);
        if (changed) {
          this.applyingRemoteSharedData = true;
          try {
            this.saveToStorage();
          } finally {
            this.applyingRemoteSharedData = false;
          }
        }
      })
      .catch((error) => {
        console.warn('[Firestore Sync] Não foi possível sincronizar usuários/máquinas.', error);
      })
      .finally(() => {
        this.sharedDataSyncInFlight = false;
      });
  }

  private applyRemoteSharedData(remoteMachines: Machine[], remoteUsers: User[]): boolean {
    let changed = false;

    const machinesList: Machine[] = Array.isArray(remoteMachines)
      ? remoteMachines
      : Array.isArray((remoteMachines as any)?.data)
      ? (remoteMachines as any).data
      : [];

    if (machinesList.length > 0) {
      const remoteMachinesMap = new Map<string, Machine>();
      for (const m of machinesList) {
        if (m && m.id) {
          remoteMachinesMap.set(m.id, m);
        }
      }

      const mergedMachines: Machine[] = [];
      const visitedMachineIds = new Set<string>();

      // Mantém versão remota se existir (Firestore fonte da verdade); senão mantém versão local
      for (const localMachine of this.machines) {
        visitedMachineIds.add(localMachine.id);
        const remote = remoteMachinesMap.get(localMachine.id);
        if (remote) {
          mergedMachines.push(remote);
        } else {
          mergedMachines.push(localMachine);
        }
      }

      // Adiciona máquinas que existam apenas no remoto
      for (const [remoteId, remoteMachine] of remoteMachinesMap.entries()) {
        if (!visitedMachineIds.has(remoteId)) {
          mergedMachines.push(remoteMachine);
          visitedMachineIds.add(remoteId);
        }
      }

      if (JSON.stringify(this.machines) !== JSON.stringify(mergedMachines)) {
        this.machines = mergedMachines;
        changed = true;
      }
    }

    const usersList: User[] = Array.isArray(remoteUsers)
      ? remoteUsers
      : Array.isArray((remoteUsers as any)?.data)
      ? (remoteUsers as any).data
      : [];

    if (usersList.length > 0) {
      const remoteUsersMap = new Map<string, User>();
      for (const u of usersList) {
        if (u && u.id) {
          remoteUsersMap.set(u.id, u);
        }
      }

      const mergedUsers: User[] = [];
      const visitedUserIds = new Set<string>();

      // Mantém versão remota se existir (Firestore fonte da verdade); senão mantém versão local
      for (const localUser of this.users) {
        visitedUserIds.add(localUser.id);
        const remote = remoteUsersMap.get(localUser.id);
        if (remote) {
          mergedUsers.push(remote);
        } else {
          mergedUsers.push(localUser);
        }
      }

      // Adiciona usuários que existam apenas no remoto
      for (const [remoteId, remoteUser] of remoteUsersMap.entries()) {
        if (!visitedUserIds.has(remoteId)) {
          mergedUsers.push(remoteUser);
          visitedUserIds.add(remoteId);
        }
      }

      if (JSON.stringify(this.users) !== JSON.stringify(mergedUsers)) {
        this.users = mergedUsers;
        changed = true;
      }

      if (this.authenticatedUser) {
        const refreshedUser = this.users.find((u) => u.id === this.authenticatedUser?.id);
        if (refreshedUser) {
          this.authenticatedUser = refreshedUser;
          this.currentUser = refreshedUser;
        } else {
          console.warn('[Firestore Sync] Usuário autenticado não encontrado no snapshot remoto; mantendo sessão local.');
        }
      }
    }

    // O que veio do servidor nao e alteracao deste aparelho: nao deve voltar como escrita.
    // Importante: so vale para quem JA existe no servidor. Maquina ou usuario que so
    // existe neste aparelho precisa continuar na fila de envio, senao nunca e criado la.
    for (const mac of this.machines) {
      if (machinesList.some((rm: any) => rm?.id === mac.id)) {
        this.machineShadow.set(mac.id, JSON.stringify(mac));
      }
    }
    for (const usr of this.users) {
      if (usersList.some((ru: any) => ru?.id === usr.id)) {
        this.userShadow.set(usr.id, JSON.stringify(usr));
      }
    }

    return changed;
  }

  /** Serializa a OP ignorando o próprio carimbo, para detectar mudança real de conteúdo. */
  private serializeOrderForShadow(order: ProductionOrder): string {
    const { updatedAt: _ignored, ...rest } = order as any;
    return JSON.stringify(rest);
  }

  /**
   * Libera a maquina que ficou apontando para uma etapa ja FINALIZADA (ou que nem
   * existe mais na OP). Sem isso, o posto continuava mostrando a OP concluida como
   * "em producao nesta maquina" e o operador recebia de volta um trabalho que ja
   * deveria ter seguido para a proxima maquina do roteiro.
   * Só age quando a OP existe neste aparelho - se a OP ainda nao sincronizou,
   * nao ha informacao suficiente para liberar a maquina de outro posto.
   */
  private releaseMachinesWithFinishedSteps(): boolean {
    let changed = false;

    for (const machine of this.machines) {
      if (!machine.currentOpId && !machine.currentOperationId) continue;

      const order = this.orders.find((o) => o.id === machine.currentOpId);
      if (!order) continue;

      const step = order.steps.find((s) => s.id === machine.currentOperationId);
      if (step && step.status !== 'FINALIZADA') continue;

      machine.currentOpId = undefined;
      machine.currentOperationId = undefined;
      machine.currentPauseReason = undefined;
      machine.pauseStartedAt = undefined;
      if (machine.status === 'PRODUZINDO' || machine.status === 'PAUSADA') {
        machine.status = 'DISPONIVEL';
      }
      changed = true;
    }

    return changed;
  }

  /**
   * Envia para o Firestore os registros de historico que ainda nao subiram:
   * auditoria, paradas de maquina e alertas. Antes isso ficava so no aparelho -
   * com varios postos, cada celular guardava um pedaco do historico e o que
   * acontecia em um nao aparecia para os outros nem para a gestao.
   */
  private syncHistoryToBackend(): void {
    if (typeof fetch === 'undefined' || this.historyPushInFlight) return

    const pendentes: Array<{ url: string; body: any }> = []
    for (const log of this.auditLogs) {
      if (log?.id && !this.syncedHistoryIds.has(log.id)) pendentes.push({ url: '/api/db/auditoria', body: log })
    }
    for (const pause of this.pauseLogs) {
      if (pause?.id && !this.syncedHistoryIds.has(pause.id)) pendentes.push({ url: '/api/db/paradas', body: pause })
    }
    for (const alert of this.alerts) {
      if (alert?.id && !this.syncedHistoryIds.has(alert.id)) pendentes.push({ url: '/api/db/alertas', body: alert })
    }

    if (pendentes.length === 0) return

    // Lotes pequenos: o resto sobe nos ciclos seguintes, sem rajada de escrita.
    const lote = pendentes.slice(0, 40)
    this.historyPushInFlight = true

    Promise.allSettled(
      lote.map(async (item) => {
        const response = await fetch(item.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.body),
        })
        if (!response.ok) throw new Error('HTTP ' + response.status)
        this.syncedHistoryIds.add(item.body.id)
      })
    ).finally(() => {
      this.historyPushInFlight = false
    })
  }

  /** Baixa o historico gravado pelos outros aparelhos e junta ao deste posto. */
  private syncHistoryFromBackend(): void {
    if (typeof fetch === 'undefined' || this.historyPullInFlight) return

    this.historyPullInFlight = true
    Promise.all([
      fetch('/api/db/auditoria?limit=300', { cache: 'no-store' }),
      fetch('/api/db/paradas', { cache: 'no-store' }),
      fetch('/api/db/alertas', { cache: 'no-store' }),
    ])
      .then(async ([auditResponse, pauseResponse, alertResponse]) => {
        if (!auditResponse.ok || !pauseResponse.ok || !alertResponse.ok) {
          throw new Error('Falha ao ler o historico compartilhado.')
        }

        const [auditJson, pauseJson, alertJson] = await Promise.all([
          auditResponse.json(),
          pauseResponse.json(),
          alertResponse.json(),
        ])

        let changed = false
        changed = this.mergeHistoryList(this.auditLogs, auditJson?.data, 500) || changed
        changed = this.mergeHistoryList(this.pauseLogs, pauseJson?.data, 500) || changed
        changed = this.mergeHistoryList(this.alerts, alertJson?.data, 200) || changed

        if (changed) {
          this.applyingRemoteSharedData = true
          try {
            this.saveToStorage()
          } finally {
            this.applyingRemoteSharedData = false
          }
        }
      })
      .catch(() => {
        // offline ou erro transitorio: tenta de novo no proximo ciclo
      })
      .finally(() => {
        this.historyPullInFlight = false
      })
  }

  /** Junta registros do servidor sem duplicar, mantendo os mais recentes no topo. */
  private mergeHistoryList(local: any[], remotos: any, limite: number): boolean {
    if (!Array.isArray(remotos) || remotos.length === 0) return false

    const existentes = new Set(local.map((item) => item?.id).filter(Boolean))
    let changed = false

    for (const item of remotos) {
      if (!item?.id) continue
      this.syncedHistoryIds.add(item.id)
      if (existentes.has(item.id)) continue
      local.push(item)
      existentes.add(item.id)
      changed = true
    }

    if (!changed) return false

    local.sort((a, b) =>
      String(b?.timestamp || b?.startedAt || '').localeCompare(String(a?.timestamp || a?.startedAt || ''))
    )
    if (local.length > limite) local.splice(limite)
    return true
  }

  /** Reconstrói a sombra sem carimbar nada (usado ao carregar e ao aplicar dados remotos). */
  private resetOrderShadow(): void {
    this.orderShadow = new Map();
    for (const order of this.orders) {
      this.orderShadow.set(order.id, this.serializeOrderForShadow(order));
    }
  }

  /** Carimba updatedAt apenas nas OPs cujo conteúdo mudou desde a última gravação. */
  private stampUpdatedAtOnChangedOrders(): void {
    const now = new Date().toISOString();
    for (const order of this.orders) {
      const serialized = this.serializeOrderForShadow(order);
      const previous = this.orderShadow.get(order.id);
      if (previous !== undefined && previous === serialized) continue;
      this.pendingOrderPushIds.add(order.id);

      if (previous !== undefined || !order.updatedAt) {
        order.updatedAt = now;
      }
      this.orderShadow.set(order.id, this.serializeOrderForShadow(order));
    }
  }

  /** Erro visível de sincronização de OPs com o Firestore (null quando tudo certo). */
  public getOrdersSyncError(): string | null {
    return this.lastOrdersSyncError;
  }

  public clearOrdersSyncError(): void {
    if (this.lastOrdersSyncError !== null) {
      this.lastOrdersSyncError = null;
      this.lastOrdersConflict = null;
      this.notify();
    }
  }

  public subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  // Getters
  public getMachines(): Machine[] {
    return this.machines.filter(m => m.status !== 'LEGADO' && m.status !== 'INATIVA');
  }

  public getAllFactoryMachines(): Machine[] {
    return this.machines.filter(m => m.status !== 'LEGADO');
  }

  public getActiveAdministrators(): User[] {
    return getActiveAdministrators(this.users);
  }

  public getMachineSession(machineId: string): MachineSession | null {
    return this.machineSessions[machineId] || null;
  }

  public getAllMachineSessions(): Record<string, MachineSession> {
    return { ...this.machineSessions };
  }

  // ==========================================
  // SESSÃO DE MÁQUINA / IDENTIFICAÇÃO DO OPERADOR
  // ==========================================
  public loginMachineOperator(
    machineId: string,
    operatorNameOrLogin: string,
    plainPassword: string
  ): { success: boolean; error?: string; session?: MachineSession; user?: User } {
    const raw = (operatorNameOrLogin || '').trim();
    if (!raw) {
      return { success: false, error: 'Selecione seu nome de operador na lista.' };
    }
    if (!plainPassword) {
      return { success: false, error: 'Informe sua senha de acesso.' };
    }

    const machine = this.machines.find((m) => m.id === machineId);
    if (!machine) {
      return { success: false, error: 'Máquina não encontrada no sistema.' };
    }

    // 1. Confirma se a máquina está ativa
    if (machine.status === 'INATIVA' || machine.id === 'm1-corte-solda' || !machine.isActive) {
      return {
        success: false,
        error: 'Esta máquina está indisponível para acesso.',
      };
    }

    const norm = normalizeUsername(raw);
    const user = this.users.find(
      (u) =>
        normalizeUsername(u.login) === norm ||
        normalizeUsername(u.username || '') === norm ||
        normalizeUsername(u.name) === norm ||
        u.id === raw
    );

    if (!user) {
      return { success: false, error: 'Usuário ou senha incorretos.' };
    }

    // 2. Confirma se o usuário está ativo
    if (user.isActive === false) {
      return { success: false, error: 'Esta conta de usuário está desativada no sistema.' };
    }

    // 3. Confirma se o usuário possui autorização para a máquina selecionada
    if (!isUserAuthorizedForMachine(user, machine, this.machines)) {
      return {
        success: false,
        error: 'Você não possui autorização para acessar esta máquina.',
      };
    }

    // 4. Confirma se a senha está correta
    const salt = user.passwordSalt || 'bellatop_seed_salt_2026';
    const hash =
      user.passwordHash ||
      (user.role === 'ADMIN' ? hashPassword('admin123', salt) : hashPassword('123456', salt));

    const isMatch = verifyPassword(plainPassword, hash, salt);
    if (!isMatch) {
      return { success: false, error: 'Usuário ou senha incorretos.' };
    }

    // Identifica o setor da máquina para ancorar a sessão do operador
    let targetSector: SystemSectorCode = 'CORTE_SOLDA';
    const macSector = (machine.sector || '').toUpperCase();
    if (macSector.includes('REFIL')) targetSector = 'REFILE';
    else if (macSector.includes('FLEXO')) targetSector = 'FLEXOGRAFIA';
    else if (macSector.includes('ESTAMP') || macSector.includes('SERIGR') || macSector.includes('CARROSS')) targetSector = 'ESTAMPARIA';
    else if (macSector.includes('CORTE') || macSector.includes('SOLDA')) targetSector = 'CORTE_SOLDA';
    else if (macSector.includes('EXPED')) targetSector = 'EXPEDICAO';

    const session: MachineSession = {
      machineId: machine.id,
      machineName: machine.name,
      machineCode: machine.code,
      machineSector: machine.sector,
      operatorId: user.id,
      operatorName: user.name,
      operatorLogin: user.login,
      role: user.role,
      authorizedMachineIds: user.authorizedMachineIds,
      loginTime: new Date().toISOString(),
    };

    // Vincula a sessão estritamente à máquina selecionada
    this.activeOperatorMachineId = machine.id;
    this.machineSessions[machine.id] = session;
    this.authenticatedUser = user;
    this.currentUser = user;
    this.selectedSector = targetSector;
    this.authSessionToken = 'bt_op_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    this.saveToStorage();

    this.logAudit(
      'LOGIN_OPERADOR_MAQUINA',
      'MACHINE',
      machine.id,
      `Operador ${user.name} (@${user.login}) identificado e autenticado exclusivamente na ${machine.name} (${machine.code}) em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}.`
    );

    return { success: true, session, user };
  }

  public getActiveOperatorMachineId(): string | null {
    return this.activeOperatorMachineId;
  }

  public validateOperatorMachineAccess(targetMachineId: string): boolean {
    if (!targetMachineId) return true;

    // Se o usuário logado for ADMIN no painel geral (sem estar preso a um posto de operador)
    if (
      this.authenticatedUser &&
      (this.authenticatedUser.role === 'ADMIN' || this.authenticatedUser.sectors?.includes('ADMIN')) &&
      !this.activeOperatorMachineId
    ) {
      return true;
    }

    // Se houver uma sessão de máquina ativa, só pode operar ESSA máquina
    if (this.activeOperatorMachineId && this.activeOperatorMachineId !== targetMachineId) {
      this.logAudit(
        'TENTATIVA_ACESSO_NAO_AUTORIZADO_MAQUINA',
        'MACHINE',
        targetMachineId,
        `Tentativa de acesso/operação bloqueada: Operador ${this.authenticatedUser?.name || 'desconhecido'} autenticado na máquina "${this.activeOperatorMachineId}" tentou operar a máquina "${targetMachineId}".`
      );
      return false;
    }

    return true;
  }

  public logoutMachineOperator(machineId?: string): void {
    const targetId = machineId || this.activeOperatorMachineId;
    const session = targetId ? this.machineSessions[targetId] : null;
    const user = this.authenticatedUser;

    if (session) {
      this.logAudit(
        'LOGOUT_OPERADOR_MAQUINA',
        'MACHINE',
        targetId!,
        `Operador ${session.operatorName} (@${session.operatorLogin}) encerrou a sessão na ${session.machineName} às ${new Date().toLocaleTimeString('pt-BR')}.`
      );
      delete this.machineSessions[targetId!];
    } else if (user) {
      this.logAudit(
        'LOGOUT',
        'CONFIG',
        user.id,
        `Usuário ${user.name} (@${user.login}) encerrou a sessão às ${new Date().toLocaleTimeString('pt-BR')}.`
      );
    }

    if (this.activeOperatorMachineId && this.machineSessions[this.activeOperatorMachineId]) {
      delete this.machineSessions[this.activeOperatorMachineId];
    }

    // 1. Invalida sessão e zera estados de usuário e máquina vinculada
    this.authenticatedUser = null;
    this.authSessionToken = null;
    this.activeOperatorMachineId = null;
    this.selectedSector = null;

    // 2. Limpa tokens e chaves de sessão no armazenamento
    localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_OPERATOR_MACHINE_ID);
    localStorage.removeItem(STORAGE_KEYS.SELECTED_SECTOR);
    try {
      sessionStorage.clear();
    } catch {
      // Ignora erro em ambientes restritos
    }

    // 3. Persiste dados do MES (preservando todas as OPs, perdas e cronômetros) e notifica ouvintes
    this.saveToStorage();
    this.notify();
  }

  public logout(): void {
    this.logoutMachineOperator();
  }

  // ==========================================
  // RECOMENDAÇÃO E BLOQUEIO TÉCNICO DE CORTE E SOLDA
  // ==========================================
  public calculateCorteSoldaRecommendation(
    order: ProductionOrder,
    step: OperationStep,
    targetMachineId: string
  ): MachineOpRecommendation {
    const machine = this.machines.find((m) => m.id === targetMachineId);
    const targetName = machine ? machine.name : targetMachineId;

    // 1. Máquina 1 (Parada / Indisponível)
    if (!machine || machine.status === 'INATIVA' || targetMachineId === 'm1-corte-solda') {
      return {
        isRecommended: false,
        recommendedMachineId: 'm3-corte-solda',
        recommendedMachineName: 'Máquina 3',
        isBlocked: true,
        blockReason: 'Máquina 1 está parada / indisponível para produção.',
        isCompatible: false,
      };
    }

    const dimensionsStr = `${order.dimensions?.width || 0}x${order.dimensions?.height || 0}`.toLowerCase();
    const productNameLower = (order.productName || '').toLowerCase();
    const notesLower = (order.technicalNotes || '').toLowerCase();
    const modelLower = (order.handleType || '').toLowerCase();

    const hasVisor = Boolean(
      order.hasVisor ||
      productNameLower.includes('visor') ||
      notesLower.includes('visor')
    );

    const is8x12 =
      dimensionsStr.includes('8x12') ||
      dimensionsStr.includes('80x120') ||
      productNameLower.includes('8x12') ||
      order.productCode?.toLowerCase().includes('8x12') ||
      (order.dimensions?.width === 80 && order.dimensions?.height === 120) ||
      (order.dimensions?.width === 8 && order.dimensions?.height === 12) ||
      (order.dimensions?.width === 120 && order.dimensions?.height === 80) ||
      (order.dimensions?.width === 12 && order.dimensions?.height === 8);

    // Só o cordão AUTOMÁTICO exige a Máquina 3 (aplicador na própria máquina).
    // Cordão manual virou etapa própria e libera M2, M3 e M4 normalmente.
    const hasCord = order.cordMode
      ? order.cordMode === 'AUTOMATICO'
      : Boolean(
      order.hasDrawstring ||
      step.hasCord ||
      modelLower.includes('mochil') ||
      modelLower.includes('cord') ||
      notesLower.includes('cordão') ||
      notesLower.includes('cordao')
    );

    const width = order.dimensions?.width || 0;
    const height = order.dimensions?.height || 0;
    const isLargeFormat =
      width > 350 ||
      height > 450 ||
      productNameLower.includes(' g ') ||
      productNameLower.includes(' gg ') ||
      productNameLower.endsWith(' g') ||
      productNameLower.endsWith(' gg') ||
      productNameLower.includes('grande');

    // REGRA 1: Medida 8x12 -> EXCLUSIVA DA MÁQUINA 3
    if (is8x12) {
      if (targetMachineId === 'm3-corte-solda') {
        return {
          isRecommended: true,
          recommendedMachineId: 'm3-corte-solda',
          recommendedMachineName: 'Máquina 3',
          isBlocked: false,
          isCompatible: true,
        };
      } else {
        return {
          isRecommended: false,
          recommendedMachineId: 'm3-corte-solda',
          recommendedMachineName: 'Máquina 3',
          isBlocked: true,
          blockReason: 'Esta OP somente pode ser executada na Máquina 3 (tamanho 8x12 exclusivo).',
          isCompatible: false,
        };
      }
    }

    // REGRA 1.1: Cordão / Mochilinha -> EXCLUSIVA DA MÁQUINA 3
    if (hasCord) {
      if (targetMachineId === 'm3-corte-solda') {
        return {
          isRecommended: true,
          recommendedMachineId: 'm3-corte-solda',
          recommendedMachineName: 'Máquina 3',
          isBlocked: false,
          isCompatible: true,
        };
      } else {
        return {
          isRecommended: false,
          recommendedMachineId: 'm3-corte-solda',
          recommendedMachineName: 'Máquina 3',
          isBlocked: true,
          blockReason: 'Esta OP possui cordão/mochilinha e deve ser executada exclusivamente na Máquina 3 (dispositivo aplicador de cordão).',
          isCompatible: false,
        };
      }
    }

    // REGRA 2: Máquina 2 - Não produz acima de tamanho M (Grande formato G/GG)
    if (targetMachineId === 'm2-corte-solda' && isLargeFormat) {
      return {
        isRecommended: false,
        recommendedMachineId: hasVisor ? 'm3-corte-solda' : 'm4-corte-solda',
        recommendedMachineName: hasVisor ? 'Máquina 3' : 'Máquina 4',
        isBlocked: true,
        blockReason: 'Máquina 2 não executa tamanho acima de M (formato grande).',
        isCompatible: false,
      };
    }

    // REGRA 3: Máquina 4 - Não produz produtos com Visor Cristal
    if (targetMachineId === 'm4-corte-solda' && hasVisor) {
      return {
        isRecommended: false,
        recommendedMachineId: isLargeFormat ? 'm3-corte-solda' : 'm2-corte-solda',
        recommendedMachineName: isLargeFormat ? 'Máquina 3' : 'Máquina 2',
        isBlocked: true,
        blockReason: 'Máquina 4 não suporta produtos com Visor.',
        isCompatible: false,
      };
    }

    // REGRA 4: Cálculo da Máquina Mais Recomendada (entre as ativas M2, M3, M4)
    let bestMachineId = 'm4-corte-solda';
    let bestMachineName = 'Máquina 4';

    if (hasVisor) {
      if (isLargeFormat) {
        bestMachineId = 'm3-corte-solda';
        bestMachineName = 'Máquina 3';
      } else {
        bestMachineId = 'm2-corte-solda';
        bestMachineName = 'Máquina 2';
      }
    } else if (order.handleType === 'VAZADA' || modelLower.includes('vazada')) {
      bestMachineId = 'm4-corte-solda';
      bestMachineName = 'Máquina 4';
    } else if (order.hasDrawstring || step.hasCord || modelLower.includes('mochil') || modelLower.includes('cord')) {
      bestMachineId = 'm3-corte-solda';
      bestMachineName = 'Máquina 3';
    } else if (!isLargeFormat) {
      bestMachineId = 'm2-corte-solda';
      bestMachineName = 'Máquina 2';
    } else {
      bestMachineId = 'm4-corte-solda';
      bestMachineName = 'Máquina 4';
    }

    return {
      isRecommended: targetMachineId === bestMachineId,
      recommendedMachineId: bestMachineId,
      recommendedMachineName: bestMachineName,
      isBlocked: false,
      isCompatible: true,
    };
  }

  // ==========================================
  // FILA DE CORTE E SOLDA (COMPARTILHADA NAS 3 MÁQUINAS ATIVAS)
  // ==========================================
  public getAvailableCorteSoldaOps(machineId: string): Array<{
    order: ProductionOrder;
    step: OperationStep;
    recommendation: MachineOpRecommendation;
  }> {
    if (
      this.activeOperatorMachineId &&
      this.activeOperatorMachineId !== machineId &&
      this.authenticatedUser?.role !== 'ADMIN'
    ) {
      this.validateOperatorMachineAccess(machineId);
      return [];
    }

    const result: Array<{
      order: ProductionOrder;
      step: OperationStep;
      recommendation: MachineOpRecommendation;
    }> = [];

    this.orders.forEach((order) => {
      if (order.status === 'FINALIZADA' || order.status === 'EXPEDICAO') return;

      order.steps.forEach((step) => {
        if (step.processTypeId !== 'proc_solda') return;
        if (step.status === 'FINALIZADA') return;

        // Se já foi reivindicada por OUTRA máquina, desaparece imediatamente desta máquina
        if (step.claimedByMachineId && step.claimedByMachineId !== machineId) {
          return;
        }

        const recommendation = this.calculateCorteSoldaRecommendation(order, step, machineId);

        // Regra do usuário: "Não mostrar: OPs bloqueadas para aquela máquina."
        if (recommendation.isBlocked) {
          return;
        }

        result.push({ order, step, recommendation });
      });
    });

    const priorityWeight: Record<PriorityLevel, number> = {
      VERMELHO: 3,
      AMARELO: 2,
      VERDE: 1,
    };

    result.sort((a, b) => {
      // Reivindicadas por esta máquina primeiro
      const aClaimed = a.step.claimedByMachineId === machineId;
      const bClaimed = b.step.claimedByMachineId === machineId;
      if (aClaimed && !bClaimed) return -1;
      if (bClaimed && !aClaimed) return 1;

      // Recomendadas primeiro
      if (a.recommendation.isRecommended && !b.recommendation.isRecommended) return -1;
      if (!a.recommendation.isRecommended && b.recommendation.isRecommended) return 1;

      // Prioridade mais alta
      const pDiff = priorityWeight[b.order.priority] - priorityWeight[a.order.priority];
      if (pDiff !== 0) return pDiff;

      // Prazo mais próximo primeiro
      return new Date(a.order.deadline).getTime() - new Date(b.order.deadline).getTime();
    });

    return result;
  }

  // ==========================================
  // SELEÇÃO MANUAL / REIVINDICAÇÃO ATÔMICA DA OP
  // ==========================================
  public claimOperation(
    stepId: string,
    machineId: string,
    operatorId?: string,
    operatorName?: string
  ): { success: boolean; error?: string; order?: ProductionOrder; step?: OperationStep } {
    if (!this.validateOperatorMachineAccess(machineId)) {
      return {
        success: false,
        error: `Operação negada: você está autenticado na máquina "${this.activeOperatorMachineId}" e não pode operar a máquina "${machineId}".`,
      };
    }

    const order = this.orders.find((o) => o.steps.some((s) => s.id === stepId));
    if (!order) return { success: false, error: 'Ordem de Produção não encontrada.' };

    const step = order.steps.find((s) => s.id === stepId);
    if (!step) return { success: false, error: 'Etapa de produção não encontrada.' };

    const machine = this.machines.find((m) => m.id === machineId);
    if (!machine || machine.status === 'INATIVA' || !machine.isActive) {
      return { success: false, error: 'Esta máquina está parada/indisponível e não pode receber OPs.' };
    }

    // Regra atômica de concorrência: se outra máquina já pegou
    if (step.claimedByMachineId && step.claimedByMachineId !== machineId) {
      return { success: false, error: 'Esta OP acabou de ser selecionada por outra máquina.' };
    }

    // Regra de bloqueio técnico
    const rec = this.calculateCorteSoldaRecommendation(order, step, machineId);
    if (rec.isBlocked) {
      return {
        success: false,
        error: rec.blockReason || 'Esta OP possui restrições técnicas incompatíveis com esta máquina.',
      };
    }

    const opUser =
      this.users.find((u) => u.id === operatorId) ||
      this.users.find((u) => u.login === operatorId) ||
      (this.authenticatedUser && this.authenticatedUser.id === operatorId ? this.authenticatedUser : null) ||
      this.authenticatedUser ||
      this.currentUser;

    const opName = operatorName || opUser.name;
    const actorRoleTitle = opUser.role === 'ADMIN' ? 'Administrador' : 'Operador';

    step.claimedByMachineId = machineId;
    step.claimedByMachineName = machine.name;
    step.claimedByOperatorId = opUser.id;
    step.claimedByOperatorName = opName;
    step.claimedAt = new Date().toISOString();
    step.assignedMachineId = machineId;
    step.assignedMachineName = machine.name;
    step.activeOperatorId = opUser.id;
    step.activeOperatorName = opName;

    if (step.status === 'AGUARDANDO_ANTERIOR' && step.receivedQuantity > 0) {
      step.status = 'PRONTA';
    }

    this.logAudit(
      'OP_SELECIONADA_MAQUINA',
      'OPERATION',
      step.id,
      `${actorRoleTitle} ${opName} selecionou a OP #${order.opNumber} para a máquina ${machine.name} às ${new Date().toLocaleTimeString('pt-BR')}.`
    );

    this.saveToStorage();
    return { success: true, order, step };
  }

  public getProducts(): ProductTechnicalSpec[] {
    return this.products;
  }

  public getProcessTypes(): ProcessType[] {
    return this.processTypes;
  }

  public getRoutingRules(): RoutingRule[] {
    return this.routingRules;
  }

  public getUsers(): User[] {
    return this.users;
  }

  public getOrders(): ProductionOrder[] {
    return this.orders;
  }

  public getAuditLogs(): AuditLogEntry[] {
    return this.auditLogs;
  }

  public getAlerts(): FactoryAlert[] {
    return this.alerts;
  }

  public getPauseLogs(): PauseLog[] {
    return this.pauseLogs;
  }

  public getCurrentUser(): User {
    return this.authenticatedUser || this.currentUser || this.users[0] || INITIAL_USERS[0];
  }

  // ==========================================
  // AUTENTICAÇÃO E CONTROLE DE ACESSO REAL (RBAC)
  // ==========================================

  public isAuthenticated(): boolean {
    return !!this.authenticatedUser;
  }

  public getAuthenticatedUser(): User | null {
    return this.authenticatedUser;
  }

  public getSelectedSector(): SystemSectorCode | null {
    if (this.selectedSector) return this.selectedSector;
    if (this.authenticatedUser?.sectors && this.authenticatedUser.sectors.length > 0) {
      return this.authenticatedUser.sectors[0];
    }
    return null;
  }

  public setSelectedSector(sector: SystemSectorCode) {
    if (this.authenticatedUser) {
      const userSectors = this.authenticatedUser.sectors || [];
      const isAdmin = userSectors.includes('ADMIN') || this.authenticatedUser.role === 'ADMIN';

      // Operador preso a uma máquina de produção não pode alterar o setor ativo durante a sessão
      if (this.activeOperatorMachineId && !isAdmin) {
        this.logAudit(
          'TENTATIVA_TROCA_SETOR_BLOQUEADA',
          'CONFIG',
          this.authenticatedUser.id,
          `Tentativa de troca de setor para "${sector}" bloqueada. Operador ${this.authenticatedUser.name} está vinculado exclusivamente à máquina "${this.activeOperatorMachineId}".`
        );
        return;
      }

      if (!isAdmin && !userSectors.includes(sector)) {
        console.warn(
          `[RBAC Security] Tentativa não autorizada de troca para setor "${sector}" pelo usuário ${this.authenticatedUser.login}`
        );
        return;
      }
    }
    this.selectedSector = sector;
    this.saveToStorage();
  }

  public isAuthorizedForSector(sector: SystemSectorCode, user?: User | null): boolean {
    const targetUser = user || this.authenticatedUser;
    if (!targetUser) return false;
    const sectors = targetUser.sectors || [];
    if (sectors.includes('ADMIN') || targetUser.role === 'ADMIN') return true;
    return sectors.includes(sector);
  }

  public isAuthorizedForTab(tabId: string, user?: User | null): boolean {
    const targetUser = user || this.authenticatedUser;
    if (!targetUser) return false;
    const sectors = targetUser.sectors || [];
    const isAdmin = sectors.includes('ADMIN') || targetUser.role === 'ADMIN';

    // Se o usuário estiver autenticado como operador de uma máquina ou perfil operador, restringe rigorosamente
    if ((this.activeOperatorMachineId && !isAdmin) || targetUser.role === 'OPERATOR') {
      return tabId === 'operator_cockpit' || tabId === 'maintenance';
    }

    if (isAdmin) return true;

    const isPcp = sectors.includes('PCP') || targetUser.role === 'PCP';
    if (isPcp) {
      const pcpTabs = ['dashboard', 'pcp', 'route_flow', 'upload', 'queue', 'machines', 'operator_cockpit', 'catalogs', 'reports', 'audit', 'maintenance'];
      return pcpTabs.includes(tabId);
    }

    const isExpedicao = sectors.includes('EXPEDICAO');
    if (isExpedicao) {
      const expTabs = ['operator_cockpit', 'pcp', 'queue', 'reports', 'maintenance'];
      return expTabs.includes(tabId);
    }

    // Operadores em geral (Refile, Flexografia, Estamparia, Corte e Solda, Alça)
    const operatorTabs = ['operator_cockpit', 'maintenance'];
    return operatorTabs.includes(tabId);
  }

  public openMachineMaintenanceCall(
    machineId: string,
    reason: string,
    description?: string,
    operatorName?: string
  ): { success: boolean; error?: string } {
    const user = this.authenticatedUser || this.currentUser;
    const isAdmin = user?.role === 'ADMIN' || (user?.sectors || []).includes('ADMIN');
    const isPcp = user?.role === 'PCP' || (user?.sectors || []).includes('PCP');

    if (!user) {
      return { success: false, error: 'Usuário não autenticado.' };
    }

    // Se o usuário for operador ou estiver com sessão de máquina, força exclusivamente a máquina da sessão
    let targetMachineId = machineId;
    if (!isAdmin && !isPcp) {
      if (!this.activeOperatorMachineId) {
        return {
          success: false,
          error: 'Não foi possível identificar a máquina desta sessão. Saia e entre novamente pela máquina correta.',
        };
      }

      // Se o cliente tentou enviar um machineId diferente da sessão, bloqueia e registra em auditoria
      if (machineId && machineId !== this.activeOperatorMachineId) {
        this.logAudit(
          'TENTATIVA_MANIPULACAO_MAQUINA_BLOQUEADA',
          'MACHINE',
          machineId,
          `Tentativa de manipulação de máquina bloqueada. Usuário ${user.name} tentou enviar machineId "${machineId}", mas foi forçado para a máquina da sessão "${this.activeOperatorMachineId}".`
        );
      }
      targetMachineId = this.activeOperatorMachineId;
    }

    const machine = this.machines.find((m) => m.id === targetMachineId);
    if (!machine) {
      return {
        success: false,
        error: 'Não foi possível identificar a máquina desta sessão. Saia e entre novamente pela máquina correta.',
      };
    }

    if (machine.status === 'INATIVA' || machine.isActive === false || machine.id === 'm1-corte-solda') {
      return {
        success: false,
        error: 'Esta máquina está inativa ou indisponível.',
      };
    }

    if (!isAdmin && !isUserAuthorizedForMachine(user, machine, this.machines)) {
      return {
        success: false,
        error: 'Você não possui autorização para abrir chamados nesta máquina.',
      };
    }

    const opName = operatorName || user.name || 'Operador';
    machine.status = 'MANUTENCAO';
    machine.currentPauseReason = `Manutenção: ${reason}${description ? ` - ${description}` : ''}`;
    machine.pauseStartedAt = new Date().toISOString();

    const pauseLog: PauseLog = {
      id: 'maint_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      operationId: `maint_call_${machine.id}`,
      opId: '',
      machineId: machine.id,
      operatorId: user.id || 'op_anon',
      operatorName: opName,
      reason: `Manutenção: ${reason}${description ? ` - ${description}` : ''}`,
      startedAt: machine.pauseStartedAt,
    };
    this.pauseLogs.unshift(pauseLog);

    this.addAlert(
      'MAINTENANCE_REQUIRED',
      'CRITICAL',
      `Chamado do Mecânico: ${machine.name}`,
      `Operador ${opName} abriu chamado de manutenção na ${machine.name}. Motivo: ${reason}`,
      machine.id
    );

    this.logAudit(
      'CHAMADO_MANUTENCAO_ABERTO',
      'MACHINE',
      machine.id,
      `Chamado do mecânico aberto na máquina ${machine.name} (${machine.code}) por ${opName}. Motivo: ${reason}. Observação: ${description || 'Nenhuma'}`
    );

    this.saveToStorage();
    return { success: true };
  }

  public closeMachineMaintenanceCall(
    machineId: string,
    resolutionNotes?: string,
    technicianName?: string
  ): { success: boolean; error?: string } {
    const user = this.authenticatedUser || this.currentUser;
    const isAdmin = user?.role === 'ADMIN' || (user?.sectors || []).includes('ADMIN');
    const isPcp = user?.role === 'PCP' || (user?.sectors || []).includes('PCP');

    if (!user) {
      return { success: false, error: 'Usuário não autenticado.' };
    }

    let targetMachineId = machineId;
    if (!isAdmin && !isPcp) {
      if (!this.activeOperatorMachineId) {
        return {
          success: false,
          error: 'Não foi possível identificar a máquina desta sessão. Saia e entre novamente pela máquina correta.',
        };
      }

      if (machineId && machineId !== this.activeOperatorMachineId) {
        this.logAudit(
          'TENTATIVA_MANIPULACAO_MAQUINA_BLOQUEADA',
          'MACHINE',
          machineId,
          `Tentativa de encerramento em outra máquina bloqueada. Forçado para a máquina da sessão "${this.activeOperatorMachineId}".`
        );
      }
      targetMachineId = this.activeOperatorMachineId;
    }

    const machine = this.machines.find((m) => m.id === targetMachineId);
    if (!machine) return { success: false, error: 'Máquina não encontrada.' };

    const tech = technicianName || user.name || 'Mecânico / Manutenção';
    machine.status = 'DISPONIVEL';
    machine.currentPauseReason = undefined;
    machine.pauseStartedAt = undefined;

    const activeMaint = this.pauseLogs.find(
      (p) => p.machineId === machine.id && !p.endedAt
    );
    if (activeMaint) {
      activeMaint.endedAt = new Date().toISOString();
      const diffMin = Math.round(
        (new Date(activeMaint.endedAt).getTime() - new Date(activeMaint.startedAt).getTime()) /
          (1000 * 60)
      );
      activeMaint.durationMinutes = diffMin;
    }

    this.addAlert(
      'MAINTENANCE_REQUIRED',
      'INFO',
      `Manutenção Concluída: ${machine.name}`,
      `Máquina ${machine.name} liberada pela equipe técnica. ${resolutionNotes || ''}`,
      machine.id
    );

    this.logAudit(
      'CHAMADO_MANUTENCAO_ENCERRADO',
      'MACHINE',
      machine.id,
      `Chamado do mecânico encerrado na máquina ${machine.name}. Liberada para produção por ${tech}. ${resolutionNotes || ''}`
    );

    this.saveToStorage();
    return { success: true };
  }

  public getMachinesForUser(user?: User | null, targetSector?: SystemSectorCode | null): Machine[] {
    const activeUser = user || this.authenticatedUser;
    const allActive = this.getMachines();
    if (!activeUser) return allActive;

    const isAdmin = activeUser.role === 'ADMIN' || activeUser.sectors?.includes('ADMIN');
    if (isAdmin && !targetSector) return allActive;

    const userSectors = activeUser.sectors || [];
    const sectorToCheck = targetSector || this.selectedSector || userSectors[0];
    const authorizedIds = activeUser.authorizedMachineIds || ['*'];

    return allActive.filter((mac) => {
      const macSectorNorm = (mac.sector || '').toUpperCase();

      // Checa se corresponde ao setor requisitado/autorizado
      let matchesSector = false;
      if (isAdmin && sectorToCheck) {
        if (sectorToCheck === 'ADMIN') matchesSector = true;
        else if (sectorToCheck === 'REFILE') matchesSector = macSectorNorm.includes('REFIL');
        else if (sectorToCheck === 'FLEXOGRAFIA') matchesSector = macSectorNorm.includes('FLEXO');
        else if (sectorToCheck === 'ESTAMPARIA') matchesSector = macSectorNorm.includes('ESTAMP') || macSectorNorm.includes('SERIGR') || macSectorNorm.includes('CARROSS');
        else if (sectorToCheck === 'CORTE_SOLDA') matchesSector = macSectorNorm.includes('CORTE') || macSectorNorm.includes('SOLDA');
        else if (sectorToCheck === 'ALCA') matchesSector = macSectorNorm.includes('ALÇA') || macSectorNorm.includes('ALCA') || macSectorNorm.includes('ACABAM');
        else if (sectorToCheck === 'EXPEDICAO') matchesSector = macSectorNorm.includes('EXPED');
        else if (sectorToCheck === 'PCP') matchesSector = true;
      } else {
        matchesSector = userSectors.some((s) => {
          if (sectorToCheck && s !== sectorToCheck) return false;
          if (s === 'REFILE' && macSectorNorm.includes('REFIL')) return true;
          if (s === 'FLEXOGRAFIA' && macSectorNorm.includes('FLEXO')) return true;
          if (s === 'ESTAMPARIA' && (macSectorNorm.includes('ESTAMP') || macSectorNorm.includes('SERIGR') || macSectorNorm.includes('CARROSS'))) return true;
          if (s === 'CORTE_SOLDA' && (macSectorNorm.includes('CORTE') || macSectorNorm.includes('SOLDA'))) return true;
          if (s === 'ALCA' && (macSectorNorm.includes('ALÇA') || macSectorNorm.includes('ALCA') || macSectorNorm.includes('ACABAM'))) return true;
          if (s === 'EXPEDICAO' && macSectorNorm.includes('EXPED')) return true;
          if (s === 'PCP') return true;
          return false;
        });
      }

      if (!matchesSector) return false;

      // Checa restrição de máquinas específicas (se não for '*' todas)
      if (!isAdmin && !authorizedIds.includes('*') && !authorizedIds.includes(mac.id) && !authorizedIds.includes(mac.code)) {
        return false;
      }

      return true;
    });
  }

  public getOrdersForUser(user?: User | null, targetSector?: SystemSectorCode | null): ProductionOrder[] {
    const activeUser = user || this.authenticatedUser;
    if (!activeUser) return this.orders;

    const isAdmin = activeUser.role === 'ADMIN' || activeUser.sectors?.includes('ADMIN');
    const isPcp = activeUser.role === 'PCP' || activeUser.sectors?.includes('PCP');
    if (isAdmin || isPcp) return this.orders;

    const userSectors = activeUser.sectors || [];
    const sectorToCheck = targetSector || this.selectedSector || userSectors[0];
    const userMachines = this.getMachinesForUser(activeUser, sectorToCheck).map((m) => m.id);

    return this.orders.filter((order) => {
      return order.steps.some((step) => {
        const stepProcess = (step.processName || '').toUpperCase();
        const isSectorMatch = userSectors.some((s) => {
          if (sectorToCheck && s !== sectorToCheck) return false;
          if (s === 'REFILE' && stepProcess.includes('REFIL')) return true;
          if (s === 'FLEXOGRAFIA' && stepProcess.includes('FLEXO')) return true;
          if (s === 'ESTAMPARIA' && (stepProcess.includes('SERIGR') || stepProcess.includes('CARROSS') || stepProcess.includes('ESTAMP'))) return true;
          if (s === 'CORTE_SOLDA' && (stepProcess.includes('CORTE') || stepProcess.includes('SOLDA'))) return true;
          if (s === 'ALCA' && (stepProcess.includes('ALÇA') || stepProcess.includes('ALCA') || stepProcess.includes('ACABAM'))) return true;
          if (s === 'EXPEDICAO' && (stepProcess.includes('EXPED') || step.processTypeId === 'proc_expedicao')) return true;
          return false;
        });

        const isMachineMatch = step.assignedMachineId ? userMachines.includes(step.assignedMachineId) : false;
        return isSectorMatch || isMachineMatch;
      });
    });
  }

  public login(
    rawUsername: string,
    plainPassword: string
  ): {
    success: boolean;
    error?: string;
    blockedRemainingSeconds?: number;
    user?: User;
    requiresSectorSelection?: boolean;
  } {
    try {
      const norm = normalizeUsername(rawUsername);
      const now = Date.now();

      if (!rawUsername || !plainPassword) {
        return { success: false, error: 'Usuário ou senha inválidos.' };
      }

      // Verificação de Rate Limit / Bloqueio por 5 tentativas consecutivas
      const attempt = this.failedAttempts[norm];
      if (attempt?.blockedUntil && attempt.blockedUntil > now) {
        const remaining = Math.ceil((attempt.blockedUntil - now) / 1000);
        return {
          success: false,
          error: `Conta bloqueada temporariamente. Aguarde ${remaining}s antes de tentar novamente.`,
          blockedRemainingSeconds: remaining,
        };
      }

      const user = this.users.find(
        (u) =>
          normalizeUsername(u.login) === norm ||
          normalizeUsername(u.username || '') === norm ||
          normalizeUsername(u.name) === norm
      );

      if (!user) {
        this.recordFailedAttempt(norm);
        this.logAudit(
          'LOGIN_FALHOU',
          'CONFIG',
          norm,
          `Tentativa de login com usuário inexistente: "${rawUsername}"`
        );
        return { success: false, error: 'Usuário ou senha inválidos.' };
      }

      if (user.isActive === false) {
        this.logAudit(
          'LOGIN_BLOQUEADO',
          'CONFIG',
          user.id,
          `Tentativa de acesso com usuário desativado: ${user.name} (@${user.login})`
        );
        return {
          success: false,
          error: 'Esta conta de usuário está desativada no sistema. Contate o Administrador.',
        };
      }

      // Se o usuário ainda não tiver hash e salt configurados, usa hash seguro do seed
      const salt = user.passwordSalt || 'bellatop_seed_salt_2026';
      const hash =
        user.passwordHash ||
        (user.role === 'ADMIN' ? hashPassword('admin123', salt) : hashPassword('123456', salt));

      const isMatch = verifyPassword(plainPassword, hash, salt);

      if (!isMatch) {
        this.recordFailedAttempt(norm);
        this.logAudit(
          'LOGIN_FALHOU',
          'CONFIG',
          user.id,
          `Senha incorreta digitada para o usuário ${user.name} (@${user.login})`
        );
        return { success: false, error: 'Usuário ou senha inválidos.' };
      }

      // Sucesso! Limpa histórico de falhas
      delete this.failedAttempts[norm];
      user.lastLoginAt = new Date().toISOString();
      user.updatedAt = new Date().toISOString();

      this.authenticatedUser = user;
      this.currentUser = user;
      this.authSessionToken = 'bt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);

      // Lógica de Redirecionamento por Papel:
      // Se o usuário possui apenas 1 setor autorizado, seleciona direto
      const userSectors = user.sectors || [];
      let requiresSectorSelection = false;

      if (userSectors.includes('ADMIN')) {
        this.selectedSector = 'ADMIN';
      } else if (userSectors.length === 1) {
        this.selectedSector = userSectors[0];
      } else if (userSectors.length > 1) {
        // Múltiplos setores (ex: Elton com Refile + Flexografia)
        this.selectedSector = userSectors[0];
        requiresSectorSelection = true;
      } else {
        // Fallback
        this.selectedSector = user.role === 'PCP' ? 'PCP' : 'REFILE';
      }

      this.logAudit(
        'LOGIN_SUCESSO',
        'CONFIG',
        user.id,
        `Usuário ${user.name} (@${user.login}) autenticado com sucesso. Setores: [${userSectors.join(', ')}]`
      );

      this.saveToStorage();
      return {
        success: true,
        user,
        requiresSectorSelection,
      };
    } catch (err) {
      console.error('[MES Auth] Erro inesperado durante autenticação:', err);
      return {
        success: false,
        error: 'Não foi possível realizar o login. Tente novamente.',
      };
    }
  }

  public loginAdministrator(
    adminId: string,
    plainPassword: string
  ): {
    success: boolean;
    error?: string;
    blockedRemainingSeconds?: number;
    user?: User;
    requiresSectorSelection?: boolean;
  } {
    try {
      if (!adminId || !adminId.trim()) {
        return { success: false, error: 'Selecione o administrador.' };
      }
      if (!plainPassword || !plainPassword.trim()) {
        return { success: false, error: 'Administrador ou senha inválidos.' };
      }

      const norm = normalizeUsername(adminId);
      const now = Date.now();

      // Verificação de Rate Limit / Bloqueio
      const attempt = this.failedAttempts[norm];
      if (attempt?.blockedUntil && attempt.blockedUntil > now) {
        const remaining = Math.ceil((attempt.blockedUntil - now) / 1000);
        return {
          success: false,
          error: `Conta bloqueada temporariamente. Aguarde ${remaining}s antes de tentar novamente.`,
          blockedRemainingSeconds: remaining,
        };
      }

      // Busca estrita: deve ser usuário real e com perfil de Administrador / Master
      const user = this.users.find(
        (u) =>
          u.id === adminId ||
          normalizeUsername(u.login) === norm ||
          normalizeUsername(u.username || '') === norm ||
          normalizeUsername(u.name) === norm
      );

      const isAdministrator =
        user &&
        user.isActive !== false &&
        (user.role === 'ADMIN' || (Array.isArray(user.sectors) && user.sectors.includes('ADMIN')));

      if (!user || !isAdministrator) {
        this.recordFailedAttempt(norm);
        this.logAudit(
          'LOGIN_FALHOU',
          'CONFIG',
          norm,
          `Tentativa de acesso administrativo não autorizado ou usuário sem privilégio ADM: "${adminId}"`
        );
        return { success: false, error: 'Administrador ou senha inválidos.' };
      }

      const salt = user.passwordSalt || 'bellatop_seed_salt_2026';
      const hash =
        user.passwordHash ||
        (user.role === 'ADMIN' ? hashPassword('admin123', salt) : hashPassword('123456', salt));

      const isMatch = verifyPassword(plainPassword, hash, salt);

      if (!isMatch) {
        this.recordFailedAttempt(norm);
        this.logAudit(
          'LOGIN_FALHOU',
          'CONFIG',
          user.id,
          `Senha incorreta digitada para o administrador ${user.name} (@${user.login})`
        );
        return { success: false, error: 'Administrador ou senha inválidos.' };
      }

      // Sucesso! Limpa histórico de falhas
      delete this.failedAttempts[norm];
      user.lastLoginAt = new Date().toISOString();
      user.updatedAt = new Date().toISOString();

      this.authenticatedUser = user;
      this.currentUser = user;
      this.selectedSector = 'ADMIN';
      this.activeOperatorMachineId = null; // Administrador nunca fica vinculado a máquina
      this.authSessionToken = 'bt_adm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);

      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(
            'AUTH_SESSION',
            JSON.stringify({
              user: {
                id: user.id,
                name: user.name,
                login: user.login,
                role: user.role,
                sectors: user.sectors,
                jobTitle: user.jobTitle,
                sector: user.sector,
              },
              token: this.authSessionToken,
              loginTimestamp: new Date().toISOString(),
            })
          );
          localStorage.removeItem('ACTIVE_OPERATOR_MACHINE_ID');
        } catch {
          // ignore storage error in sandbox
        }
      }

      this.logAudit(
        'LOGIN_SUCESSO',
        'CONFIG',
        user.id,
        `Administrador ${user.name} (@${user.login}) autenticado no Painel Master com acesso total.`
      );

      this.saveToStorage();
      return {
        success: true,
        user,
        requiresSectorSelection: false,
      };
    } catch (err) {
      console.error('[MES Auth] Erro inesperado durante autenticação de Administrador:', err);
      return {
        success: false,
        error: 'Administrador ou senha inválidos.',
      };
    }
  }

  private recordFailedAttempt(norm: string) {
    const now = Date.now();
    const current = this.failedAttempts[norm] || { count: 0, lastAttempt: now };
    current.count += 1;
    current.lastAttempt = now;

    if (current.count >= 5) {
      current.blockedUntil = now + 60 * 1000;
      current.count = 0;
    }

    this.failedAttempts[norm] = current;
  }

  public setCurrentUser(userId: string) {
    const user = this.users.find((u) => u.id === userId);
    if (user) {
      this.currentUser = user;
      this.authenticatedUser = user;
      this.selectedSector = (user.sectors && user.sectors[0]) || (user.role === 'PCP' ? 'PCP' : 'REFILE');
      this.saveToStorage();
    }
  }

  // ==========================================
  // GESTÃO DE USUÁRIOS (ADMINISTRAÇÃO)
  // ==========================================

  public createUser(params: {
    name: string;
    username: string;
    password: string;
    sectors: SystemSectorCode[];
    jobTitle?: string;
    sector?: string;
    authorizedMachineIds?: string[];
    shift?: 'TURNO_1' | 'TURNO_2' | 'TURNO_3' | 'GERAL';
  }): { success: boolean; user?: User; error?: string } {
    const norm = normalizeUsername(params.username);
    if (!norm) return { success: false, error: 'O nome de login é obrigatório.' };

    const exists = this.users.some(
      (u) => normalizeUsername(u.login) === norm || normalizeUsername(u.username || '') === norm
    );
    if (exists) {
      return { success: false, error: `O nome de login "${params.username}" já está cadastrado.` };
    }

    if (!params.password || params.password.length < 4) {
      return { success: false, error: 'A senha inicial deve ter no mínimo 4 caracteres.' };
    }

    if (!params.sectors || params.sectors.length === 0) {
      return { success: false, error: 'Selecione ao menos um setor/função autorizada.' };
    }

    const salt = generateSalt();
    const pHash = hashPassword(params.password, salt);
    const id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const newUser: User = {
      id,
      name: params.name.trim(),
      login: norm,
      username: norm,
      passwordHash: pHash,
      passwordSalt: salt,
      sectors: params.sectors,
      role: params.sectors.includes('ADMIN') ? 'ADMIN' : params.sectors.includes('PCP') ? 'PCP' : 'OPERATOR',
      jobTitle: params.jobTitle || `Operador de ${params.sectors.join('/')}`,
      sector: params.sector || params.sectors.join(', '),
      authorizedMachineIds: params.authorizedMachineIds || ['*'],
      shift: params.shift || 'TURNO_1',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    this.users.push(newUser);

    this.logAudit(
      'USUARIO_CRIADO',
      'CONFIG',
      id,
      `Novo usuário criado: ${newUser.name} (@${newUser.login}) com setores [${newUser.sectors?.join(', ')}]`
    );

    this.saveToStorage();
    return { success: true, user: newUser };
  }

  public updateUser(
    userId: string,
    params: {
      name?: string;
      sectors?: SystemSectorCode[];
      authorizedMachineIds?: string[];
      jobTitle?: string;
      sector?: string;
      shift?: 'TURNO_1' | 'TURNO_2' | 'TURNO_3' | 'GERAL';
      isActive?: boolean;
    }
  ): { success: boolean; user?: User; error?: string } {
    const user = this.users.find((u) => u.id === userId);
    if (!user) return { success: false, error: 'Usuário não encontrado.' };

    if (params.name) user.name = params.name.trim();
    if (params.sectors && params.sectors.length > 0) {
      user.sectors = params.sectors;
      user.role = params.sectors.includes('ADMIN') ? 'ADMIN' : params.sectors.includes('PCP') ? 'PCP' : 'OPERATOR';
    }
    if (params.authorizedMachineIds) user.authorizedMachineIds = params.authorizedMachineIds;
    if (params.jobTitle) user.jobTitle = params.jobTitle;
    if (params.sector) user.sector = params.sector;
    if (params.shift) user.shift = params.shift;
    if (typeof params.isActive === 'boolean') user.isActive = params.isActive;

    user.updatedAt = new Date().toISOString();

    if (this.authenticatedUser?.id === user.id) {
      this.authenticatedUser = { ...user };
    }

    this.logAudit(
      'USUARIO_ATUALIZADO',
      'CONFIG',
      userId,
      `Dados atualizados para ${user.name} (@${user.login}) - Status: ${user.isActive ? 'ATIVO' : 'INATIVO'}, Setores: [${user.sectors?.join(', ')}]`
    );

    this.saveToStorage();
    return { success: true, user };
  }

  public resetUserPassword(
    userId: string,
    newPlainPassword: string
  ): { success: boolean; error?: string } {
    const user = this.users.find((u) => u.id === userId);
    if (!user) return { success: false, error: 'Usuário não encontrado.' };

    if (!newPlainPassword || newPlainPassword.length < 4) {
      return { success: false, error: 'A nova senha deve ter no mínimo 4 caracteres.' };
    }

    const salt = generateSalt();
    user.passwordSalt = salt;
    user.passwordHash = hashPassword(newPlainPassword, salt);
    user.updatedAt = new Date().toISOString();

    // Limpa eventuais tentativas de bloqueio anteriores
    delete this.failedAttempts[normalizeUsername(user.login)];

    this.logAudit(
      'SENHA_REDEFINIDA',
      'CONFIG',
      userId,
      `Senha redefinida para o usuário ${user.name} (@${user.login}) pelo Administrador.`
    );

    this.saveToStorage();
    return { success: true };
  }

  public changePassword(
    currentPassword: string,
    newPassword: string
  ): { success: boolean; error?: string } {
    if (!this.authenticatedUser) {
      return { success: false, error: 'Nenhum usuário autenticado.' };
    }

    const salt = this.authenticatedUser.passwordSalt || 'bellatop_seed_salt_2026';
    const currentHash = this.authenticatedUser.passwordHash || hashPassword('123456', salt);

    if (!verifyPassword(currentPassword, currentHash, salt)) {
      return { success: false, error: 'A senha atual está incorreta.' };
    }

    if (!newPassword || newPassword.length < 4) {
      return { success: false, error: 'A nova senha deve ter pelo menos 4 caracteres.' };
    }

    const newSalt = generateSalt();
    this.authenticatedUser.passwordSalt = newSalt;
    this.authenticatedUser.passwordHash = hashPassword(newPassword, newSalt);
    this.authenticatedUser.updatedAt = new Date().toISOString();

    // Atualiza na lista geral
    const userInList = this.users.find((u) => u.id === this.authenticatedUser!.id);
    if (userInList) {
      userInList.passwordSalt = newSalt;
      userInList.passwordHash = this.authenticatedUser.passwordHash;
      userInList.updatedAt = this.authenticatedUser.updatedAt;
    }

    this.logAudit(
      'SENHA_ALTERADA',
      'CONFIG',
      this.authenticatedUser.id,
      `O usuário ${this.authenticatedUser.name} alterou sua própria senha com sucesso.`
    );

    this.saveToStorage();
    return { success: true };
  }

  public toggleUserStatus(
    userId: string,
    isActive: boolean
  ): { success: boolean; error?: string } {
    const user = this.users.find((u) => u.id === userId);
    if (!user) return { success: false, error: 'Usuário não encontrado.' };

    user.isActive = isActive;
    user.updatedAt = new Date().toISOString();

    if (!isActive && this.authenticatedUser?.id === userId) {
      this.logout();
      return { success: true };
    }

    this.logAudit(
      'STATUS_USUARIO_ALTERADO',
      'CONFIG',
      userId,
      `Status do usuário ${user.name} (@${user.login}) alterado para ${isActive ? 'ATIVO' : 'DESATIVADO'}.`
    );

    this.saveToStorage();
    return { success: true };
  }

  // Reset system to 100% clean state ready for real production
  public clearAllData() {
    this.machines = JSON.parse(JSON.stringify(INITIAL_MACHINES));
    this.products = JSON.parse(JSON.stringify(INITIAL_PRODUCTS));
    this.processTypes = JSON.parse(JSON.stringify(INITIAL_PROCESS_TYPES));
    this.routingRules = JSON.parse(JSON.stringify(INITIAL_ROUTING_RULES));
    this.users = JSON.parse(JSON.stringify(INITIAL_USERS));
    this.orders = [];
    this.auditLogs = [];
    this.alerts = [];
    this.pauseLogs = [];
    this.machineSessions = {};
    this.currentUser = INITIAL_USERS[0];
    this.saveToStorage();
  }

  public resetToDemoData() {
    this.clearAllData();
  }

  // Audit Helper
  public logAudit(
    action: string,
    entityType: 'OP' | 'OPERATION' | 'MACHINE' | 'ROUTING' | 'CONFIG',
    entityId: string,
    details: string,
    previousValue?: string,
    newValue?: string
  ) {
    const entry: AuditLogEntry = {
      id: 'audit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      userId: this.currentUser.id,
      userName: this.currentUser.name,
      userRole: this.currentUser.role,
      action,
      entityType,
      entityId,
      details,
      previousValue,
      newValue,
      ipOrDevice: navigator.userAgent.substring(0, 50),
    };
    this.auditLogs.unshift(entry);
    if (this.auditLogs.length > 500) {
      this.auditLogs = this.auditLogs.slice(0, 500);
    }
    this.saveToStorage();
  }

  // Alert Helper
  public addAlert(
    type: FactoryAlert['type'],
    severity: FactoryAlert['severity'],
    title: string,
    message: string,
    targetMachineId?: string,
    targetOpId?: string
  ) {
    const alert: FactoryAlert = {
      id: 'alt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      timestamp: new Date().toISOString(),
      type,
      severity,
      title,
      message,
      targetMachineId,
      targetOpId,
      isRead: false,
    };
    this.alerts.unshift(alert);
    this.saveToStorage();
  }

  public markAlertRead(alertId: string) {
    const a = this.alerts.find((item) => item.id === alertId);
    if (a) {
      a.isRead = true;
      // Forca o reenvio deste alerta: o servidor grava por id, entao o "lido"
      // passa a valer para todos os aparelhos.
      this.syncedHistoryIds.delete(a.id);
      this.saveToStorage();
    }
  }

  public markAllAlertsRead() {
    this.alerts.forEach((a) => {
      a.isRead = true;
      this.syncedHistoryIds.delete(a.id);
    });
    this.saveToStorage();
  }

  // -------------------------------------------------------------
  // DYNAMIC ROUTING ENGINE (Motor de Roteamento de Produção)
  // -------------------------------------------------------------
  public generateRouteForOpData(opData: ExtractedOpData): {
    steps: Array<{
      processTypeId: string;
      processName: string;
      machineId: string;
      machineName: string;
      estimatedMinutes: number;
      /** true quando nenhuma máquina compatível foi encontrada para o processo. */
      needsMachineAllocation?: boolean;
    }>;
    identifiedProductId: string;
    productName: string;
    productCode: string;
    /** Decisoes de roteiro: produto, caminho de impressao, cordao e pendencias do PCP. */
    blueprint: RouteBlueprint;
  } {
    // 1. Identify product from catalog or closest match
    let product = this.products.find(
      (p) =>
        p.code.toLowerCase() === opData.codigoProduto.toLowerCase() ||
        p.name.toLowerCase().includes(opData.produtoNome.toLowerCase()) ||
        opData.produtoNome.toLowerCase().includes(p.name.toLowerCase())
    );

    if (!product) {
      // Fallback matching by model or default to Sacola Alça Fita
      if (opData.modelo.toLowerCase().includes('mochila')) {
        product = this.products.find((p) => p.id === 'prod_mochilinha');
      } else if (opData.modelo.toLowerCase().includes('visor') || opData.usoVisor) {
        product = this.products.find((p) => p.id === 'prod_saco_com_visor');
      } else if (opData.modelo.toLowerCase().includes('vazada') || opData.tipoAlca === 'VAZADA') {
        product = this.products.find((p) => p.id === 'prod_sacola_alca_vazada');
      } else if (opData.modelo.toLowerCase().includes('box')) {
        product = this.products.find((p) => p.id === 'prod_sacola_box');
      } else {
        product = this.products[0];
      }
    }

    // 2. Roteiro oficial montado pelas regras de produto (fonte unica em initialData)
    //    REFILE XOR FLEXOGRAFIA; Carrossel imprime depois do Corte e Solda.
    const routeBlueprint = buildRouteBlueprint({
      productName: opData.produtoNome,
      productCode: opData.codigoProduto,
      model: opData.modelo,
      client: opData.cliente,
      printingMethod: opData.tipoImpressao,
      handleType: opData.tipoAlca,
      hasCord: opData.usoCordao,
      cordMode: opData.tipoCordao,
      hasWindow: opData.usoVisor,
      productKeyOverride: opData.produtoConfirmadoPcp || opData.produtoSugeridoIa,
    });

    const sequenceProcessIds: string[] = [...routeBlueprint.processIds];

    // Cordao AUTOMATICO e aplicado pela propria maquina de corte e solda (Maquina 3).
    // Cordao MANUAL virou etapa propria e por isso nao prende mais a OP na Maquina 3.
    const hasCord = routeBlueprint.cordMode === 'AUTOMATICO';

    // A regra de produto vence a busca por nome no catalogo.
    if (routeBlueprint.productCatalogId) {
      const ruleProduct = this.products.find((p) => p.id === routeBlueprint.productCatalogId);
      if (ruleProduct) product = ruleProduct;
    }

    // 3. Auto-allocate best compatible machine for each process step
    const steps = sequenceProcessIds.map((procId) => {
      const procType = this.processTypes.find((p) => p.id === procId) || {
        id: procId,
        name:
          procId === 'proc_solda'
            ? 'Corte e Solda'
            : procId === 'proc_refile'
            ? 'Refile'
            : procId === 'proc_flexografia'
            ? 'Flexografia'
            : procId === 'proc_passar_fio'
            ? 'Passar Fio / Cordão'
            : procId === 'proc_colocar_alca'
            ? 'Colocar Alça / Acabamento'
            : procId === 'proc_expedicao'
            ? 'Expedição & Embalagem'
            : procId,
        code: procId,
        description: '',
        defaultUnit: 'UNIDADES' as const,
        standardSetupMinutes: 15,
      };

      const compatibleMachines = this.machines.filter((m) => {
        if (!m.isActive || m.processTypeId !== procId) return false;
        
        // Verifica as regras de compatibilidade técnica
        if (m.capabilities) {
          const cap = m.capabilities;
          const isAlcaVazada = opData.tipoAlca === 'VAZADA' || opData.modelo.toLowerCase().includes('vazada');
          const isComVisor = opData.usoVisor || opData.modelo.toLowerCase().includes('visor');
          
          if (isComVisor && cap.permiteVisor === false) return false;
          if (!isComVisor && cap.permiteSemVisor === false) return false;
          if (isAlcaVazada && cap.permiteAlcaVazada === false) return false;
          
          // Validação de Tamanho (PP, P, M, G, GG)
          const tamanho = (opData.tamanho || '').toUpperCase();
          const tamanhos = ['PP', 'P', 'M', 'G', 'GG'];
          const idxTamanho = tamanhos.indexOf(tamanho);
          
          if (idxTamanho !== -1) {
            if (cap.tamanhoMinimo && tamanhos.indexOf(cap.tamanhoMinimo) > idxTamanho) {
              return false;
            }
            if (cap.tamanhoMaximo && tamanhos.indexOf(cap.tamanhoMaximo) < idxTamanho) {
              return false;
            }
          }
          // 8x12 é exclusivo da Máquina 3
          const medidaNormalizada = (opData.medidasFormatadas || '').replace(/\s/g, '').toLowerCase();
          if (medidaNormalizada === '8x12' && !cap.medidasExclusivas?.includes('8x12')) {
            return false;
          }
        }
        
        return true;
      });

      // Select machine with lowest current queue load and high historical efficiency
      let selectedMachine = compatibleMachines[0];
      if (compatibleMachines.length > 1) {
        selectedMachine = compatibleMachines.reduce((best, cur) => {
          const curQueueCount = this.getMachineQueue(cur.id).length;
          const bestQueueCount = this.getMachineQueue(best.id).length;
          if (cur.status === 'DISPONIVEL' && best.status !== 'DISPONIVEL') return cur;
          if (curQueueCount < bestQueueCount) return cur;
          if (curQueueCount > bestQueueCount) return best;

          const preferAlcaVazadaSemVisor =
            opData.tipoAlca === 'VAZADA' && !opData.usoVisor;
          const curPreferred = preferAlcaVazadaSemVisor &&
            cur.capabilities?.preferencias?.includes('ALCA_VAZADA_SEM_VISOR');
          const bestPreferred = preferAlcaVazadaSemVisor &&
            best.capabilities?.preferencias?.includes('ALCA_VAZADA_SEM_VISOR');
          if (curPreferred && !bestPreferred) return cur;
          return best;
        }, compatibleMachines[0]);
      }

      // Default fallback name for manual/non-machine steps
      let fallbackMachineName = 'AGUARDANDO MÁQUINA COMPATÍVEL';
      if (procId === 'proc_passar_fio') fallbackMachineName = 'Posto de Passar Fio / Cordão';
      else if (procId === 'proc_colocar_alca') fallbackMachineName = 'Posto de Alça & Acabamento';
      else if (procId === 'proc_expedicao') fallbackMachineName = 'Expedição Manual (Carlos)';

      // Calculate estimated time based on machine speed
      let estMinutes = 45;
      if (procId === 'proc_expedicao') {
        estMinutes = 20;
        return {
          processTypeId: procId,
          processName: procType.name,
          machineId: '',
          machineName: 'Expedição Manual (Carlos)',
          estimatedMinutes: 20,
          isManual: true,
          responsibleUser: 'Carlos',
          responsibleSector: 'EXPEDICAO',
        };
      }

      if (selectedMachine && selectedMachine.nominalSpeed > 0) {
        const speedPerHour =
          selectedMachine.productionUnit === 'METROS'
            ? selectedMachine.nominalSpeed * 60
            : selectedMachine.nominalSpeed;
        const netSpeed = speedPerHour * (selectedMachine.historicalEfficiencyFactor || 0.9);
        estMinutes = Math.round(
          (opData.quantidade / (netSpeed || 1000)) * 60 + (procType.standardSetupMinutes || 20)
        );
      }

      return {
        processTypeId: procId,
        processName: procType.name,
        // NUNCA inventar um identificador de máquina. Antes era `workstation_${procId}`,
        // que não corresponde a nenhuma máquina real: a etapa entrava na fila de uma
        // máquina inexistente e ficava invisível para todos os operadores, para sempre.
        // Sem máquina compatível, a etapa fica sem alocação e a OP vai para revisão do PCP.
        machineId: selectedMachine ? selectedMachine.id : '',
        machineName: selectedMachine ? selectedMachine.name : fallbackMachineName,
        needsMachineAllocation: !selectedMachine,
        estimatedMinutes: Math.max(20, estMinutes),
        hasCord: procId === 'proc_solda' ? Boolean(hasCord) : undefined,
      };
    });

    return {
      steps,
      blueprint: routeBlueprint,
      identifiedProductId: product ? product.id : 'prod_sacola_alca_fita',
      productName: product ? product.name : opData.produtoNome || 'Produto Personalizado Bella Top',
      productCode: product ? product.code : opData.codigoProduto || 'BT-GEN-01',
    };
  }

  // -------------------------------------------------------------
  // CREATE PRODUCTION ORDER FROM EXTRACTED OP
  // -------------------------------------------------------------
  public createOrderFromExtracted(
    opData: ExtractedOpData,
    customSteps?: Array<{
      processTypeId: string;
      processName: string;
      machineId: string;
      machineName: string;
      estimatedMinutes: number;
      needsMachineAllocation?: boolean;
    }>
  ): ProductionOrder {
    if (!opData.numeroOp || !opData.numeroOp.trim()) {
      throw new Error('O número da Ordem de Produção é obrigatório.');
    }
    if (!opData.cliente || !opData.cliente.trim()) {
      throw new Error('O nome do cliente é obrigatório.');
    }
    if (!opData.quantidade || opData.quantidade <= 0) {
      throw new Error('A quantidade da OP deve ser um número positivo maior que zero.');
    }

    // Regra 4: Bloquear criação de OP com número duplicado
    const cleanNum = opData.numeroOp.trim().toLowerCase();
    const duplicate = this.orders.find((o) => o.opNumber.trim().toLowerCase() === cleanNum);
    if (duplicate) {
      throw new Error(
        `Operação bloqueada: já existe uma Ordem de Produção cadastrada com o número ${opData.numeroOp}. Não são permitidas OPs duplicadas.`
      );
    }

    const route = customSteps
      ? {
          steps: customSteps,
          identifiedProductId: opData.codigoProduto || 'prod_sacola_alca_fita',
          productName: opData.produtoNome,
          productCode: opData.codigoProduto || 'BT-01',
        }
      : this.generateRouteForOpData(opData);

    const newOpId = 'op_' + opData.numeroOp.replace(/[^a-zA-Z0-9]/g, '');

    const opHasCord = Boolean(
      opData.usoCordao ||
      opData.tipoAlca === 'CORDAO' ||
      opData.modelo?.toLowerCase().includes('mochil') ||
      opData.modelo?.toLowerCase().includes('cordao') ||
      opData.acabamentos?.some((a) => a.toLowerCase().includes('cordão') || a.toLowerCase().includes('fio'))
    );

    // Etapas sem máquina compatível (fora Expedição, que é manual por natureza).
    // A OP não pode seguir para o chão de fábrica com etapa órfã: vai para revisão do PCP.
    const stepsMissingMachine = route.steps.filter(
      (s) => s.processTypeId !== 'proc_expedicao' && (!s.machineId || (s as any).needsMachineAllocation)
    );
    // As regras de roteiro tambem podem exigir o PCP: produto, impressao ou cordao ambiguos.
    const requiresPcpReview =
      Boolean(opData.precisaRevisaoPcp) ||
      stepsMissingMachine.length > 0 ||
      route.blueprint.needsPcpValidation;

    // Build operation steps with initial physical quantities
    const steps: OperationStep[] = route.steps.map((s, idx) => {
      const isFirst = idx === 0;
      const isExpedicao = s.processTypeId === 'proc_expedicao';
      const isSolda = s.processTypeId === 'proc_solda';
      const missingMachine = !isExpedicao && (!s.machineId || Boolean((s as any).needsMachineAllocation));
      return {
        id: `step_${opData.numeroOp}_${idx + 1}`,
        opId: newOpId,
        sequenceIndex: idx,
        processTypeId: s.processTypeId,
        processName: s.processName,
        assignedMachineId: isExpedicao || missingMachine ? null : s.machineId,
        assignedMachineName: isExpedicao ? 'Expedição Manual' : s.machineName,
        needsMachineAllocation: missingMachine || undefined,
        status: isFirst ? (requiresPcpReview ? 'AGUARDANDO_ANTERIOR' : 'PRONTA') : 'AGUARDANDO_ANTERIOR',
        isManual: isExpedicao,
        responsibleUser: isExpedicao ? 'Carlos' : undefined,
        responsibleSector: isExpedicao ? 'EXPEDICAO' : undefined,
        hasCord: isSolda ? Boolean((s as any).hasCord ?? opHasCord) : undefined,
        plannedQuantity: opData.quantidade,
        receivedQuantity: isFirst ? opData.quantidade : 0, // First step receives full batch
        producedQuantity: 0,
        lossQuantity: 0,
        goodQuantity: 0,
        unit: opData.unidade,
        estimatedDurationMinutes: s.estimatedMinutes,
        totalPauseMinutes: 0,
      };
    });

    const deadlineDate = opData.prazoEntrega
      ? new Date(opData.prazoEntrega).toISOString()
      : new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    const hasLayoutDoc = Boolean(
      opData.layout_file ||
      opData.layoutFileName ||
      opData.layoutPreviewImage ||
      opData.layoutImage ||
      opData.images?.some((img) => img.isPrimaryLayout || img.type === 'layout_aprovado')
    );
    const resolvedLayoutStatus: 'COMPLETO' | 'LAYOUT_PENDENTE' | 'ORDEM_DE_PRODUCAO_PENDENTE' = hasLayoutDoc ? 'COMPLETO' : 'LAYOUT_PENDENTE';

    const newOrder: ProductionOrder = {
      id: newOpId,
      opNumber: opData.numeroOp,
      orderNumber: opData.numeroPedido || `PED-${opData.numeroOp}`,
      client: opData.cliente,
      productId: route.identifiedProductId,
      productName: route.productName,
      productCode: route.productCode,
      targetQuantity: opData.quantidade,
      currentGoodQuantity: 0,
      totalLosses: 0,
      unit: opData.unidade,
      material: opData.material,
      grammage: opData.gramatura,
      color: opData.corMaterial,
      dimensions: {
        width: opData.larguraMm,
        height: opData.alturaMm,
        gusset: opData.fundoMm,
      },
      printing: {
        type: opData.tipoImpressao,
        colorsCount: opData.numeroCores,
        front: opData.impressaoFrente,
        back: opData.impressaoVerso,
      },
      handleType: opData.tipoAlca,
      hasDrawstring: opData.usoCordao || route.blueprint.cordMode === 'MANUAL' || route.blueprint.cordMode === 'AUTOMATICO',
      cordMode: route.blueprint.cordMode,
      productKey: route.blueprint.productKey,
      hasVisor: opData.usoVisor,
      // O tipo de cordao fica visivel na ficha da OP, inclusive quando foi definido
      // automaticamente pela regra de cliente (Arezzo, Anacapri, Sonho dos Pes).
      technicalNotes: [
        route.blueprint.cordMode === 'MANUAL' ? 'Cordão: Manual' : '',
        route.blueprint.cordMode === 'AUTOMATICO' ? 'Cordão: Automático (na máquina)' : '',
        route.blueprint.cordForcedByClient ? 'Regra fixa do cliente ' + (opData.cliente || '') : '',
        opData.observacoesTecnicas || '',
      ]
        .filter(Boolean)
        .join(' · '),
      deadline: deadlineDate,
      estimatedCompletionDate: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(),
      safetyMarginHours: 36,
      priority: 'VERDE',
      status: requiresPcpReview ? 'REVISAO_PCP' : 'PROGRAMADA',
      currentStepIndex: 0,
      steps,
      createdAt: new Date().toISOString(),
      createdBy: this.currentUser.name,
      sourcePdfName: opData.opFileName || opData.op_file || `OP_${opData.numeroOp}.pdf`,
      opFileName: opData.opFileName || opData.op_file || `OP_${opData.numeroOp}.pdf`,
      op_file: opData.op_file || opData.opFileName || `OP_${opData.numeroOp}.pdf`,
      layoutFileName: opData.layoutFileName || opData.layout_file || (hasLayoutDoc ? 'Layout_Aprovado.pdf' : undefined),
      layout_file: opData.layout_file || opData.layoutFileName || (hasLayoutDoc ? 'Layout_Aprovado.pdf' : undefined),
      layoutStatus: resolvedLayoutStatus,
      layout_status: resolvedLayoutStatus,
      extractedConfidence: opData.confiancaLeitura?.geral ?? 100,
      layoutImage: opData.layoutPreviewImage || opData.images?.find((img) => img.isPrimaryLayout || img.type === 'layout_aprovado')?.urlOrBase64 || opData.images?.[0]?.urlOrBase64,
      layoutImages: opData.images,
      layoutPreviewImage: opData.layoutPreviewImage || opData.layoutImage || opData.images?.find((img) => img.isPrimaryLayout || img.type === 'layout_aprovado')?.urlOrBase64 || opData.images?.[0]?.urlOrBase64,
      productThumbnail: opData.productThumbnail || opData.layoutPreviewImage || opData.layoutImage || opData.images?.[0]?.urlOrBase64,
      productThumbnailStatus: opData.productThumbnailStatus || (opData.productThumbnail ? 'available' : (hasLayoutDoc ? 'available' : 'needs_validation')),
      layoutCropBox: opData.layoutCropBox,
      aiAnalysis: opData.structured?.ai_engine_info
        ? {
            model: opData.structured.ai_engine_info.model,
            provider: opData.structured.ai_engine_info.provider,
            confidence: opData.confiancaLeitura?.geral ?? 100,
            warnings: opData.inconsistencias,
            explanation: opData.routingExplanation,
          }
        : undefined,
      revisionNotes: stepsMissingMachine.length > 0
        ? `Revisão do PCP necessária: nenhuma máquina compatível foi encontrada para ${stepsMissingMachine
            .map((s) => s.processName)
            .join(', ')}. Defina a máquina antes de liberar a OP para a fábrica.`
        : opData.precisaRevisaoPcp
        ? 'Revisão do PCP necessária: dados com baixa confiança ou inconsistência detectada na OP.'
        : undefined,
    };

    // Remove any existing order with same ID to avoid duplicates
    this.orders = this.orders.filter((o) => o.id !== newOpId);
    this.orders.unshift(newOrder);

    this.calculateOpPriority(newOrder);

    this.logAudit(
      'CRIAR_OP',
      'OP',
      newOrder.id,
      `Ordem de Produção OP ${newOrder.opNumber} criada com ${steps.length} etapas para o cliente ${newOrder.client}. Status: ${newOrder.status}`
    );

    this.saveToStorage();
    return newOrder;
  }

  // -------------------------------------------------------------
  // UPDATE OP PRODUCT THUMBNAIL (VISUAL IDENTITY OF OP)
  // -------------------------------------------------------------
  public updateOrderThumbnail(
    opId: string,
    thumbnailBase64: string,
    cropBox?: { x: number; y: number; width: number; height: number }
  ) {
    const order = this.orders.find((o) => o.id === opId);
    if (order) {
      order.productThumbnail = thumbnailBase64;
      if (cropBox) {
        order.layoutCropBox = cropBox;
      }
      order.productThumbnailStatus = 'available';
      this.saveToStorage();
      this.logAudit(
        'ATUALIZAR_MINIATURA_OP',
        'OP',
        opId,
        `Foto principal da sacola/saco atualizada pelo PCP para a OP #${order.opNumber}`
      );
    }
  }

  // -------------------------------------------------------------
  // PRIORITY CALCULATION ENGINE
  // Margem de segurança = Tempo até prazo - Tempo restante operações - Tempo de fila
  // -------------------------------------------------------------
  public calculateOpPriority(order: ProductionOrder): PriorityLevel {
    if (order.manualPriorityOverride) {
      return order.priority;
    }

    const now = Date.now();
    const deadlineMs = new Date(order.deadline).getTime();
    const availableHours = (deadlineMs - now) / (1000 * 60 * 60);

    // Sum estimated remaining minutes for unfinished steps
    let remainingWorkMinutes = 0;
    order.steps.forEach((step) => {
      if (step.status !== 'FINALIZADA') {
        const remainingFraction =
          step.receivedQuantity > 0 && step.producedQuantity > 0
            ? Math.max(0, 1 - step.producedQuantity / step.receivedQuantity)
            : 1;
        remainingWorkMinutes += step.estimatedDurationMinutes * remainingFraction;
      }
    });

    const remainingWorkHours = remainingWorkMinutes / 60;
    // Add buffer for queue waits (1 hour per remaining machine transition)
    const pendingStepsCount = order.steps.filter((s) => s.status !== 'FINALIZADA').length;
    const queueBufferHours = pendingStepsCount * 1.5;

    const safetyMarginHours = availableHours - (remainingWorkHours + queueBufferHours);
    order.safetyMarginHours = Math.round(safetyMarginHours * 10) / 10;

    let newPriority: PriorityLevel = 'VERDE';
    if (safetyMarginHours < 0 || availableHours <= 12) {
      newPriority = 'VERMELHO';
    } else if (safetyMarginHours < 16 || availableHours <= 36) {
      newPriority = 'AMARELO';
    } else {
      newPriority = 'VERDE';
    }

    // Check if priority escalated to generate alert
    if (order.priority !== newPriority) {
      if (newPriority === 'VERMELHO' && order.priority !== 'VERMELHO') {
        this.addAlert(
          'PRIORITY_ESCALATED',
          'CRITICAL',
          `OP ${order.opNumber} entrou em Prioridade VERMELHA`,
          `Margem de segurança calculada em ${order.safetyMarginHours}h até o prazo (${new Date(
            order.deadline
          ).toLocaleDateString('pt-BR')}). Ação necessária no PCP.`,
          undefined,
          order.id
        );
      } else if (newPriority === 'AMARELO' && order.priority === 'VERDE') {
        this.addAlert(
          'PRIORITY_ESCALATED',
          'WARNING',
          `OP ${order.opNumber} em Atenção (AMARELO)`,
          `Margem de segurança reduzida para ${order.safetyMarginHours}h.`,
          undefined,
          order.id
        );
      }
      order.priority = newPriority;
    }

    // Update estimated completion date
    const totalRemainingHours = remainingWorkHours + queueBufferHours;
    order.estimatedCompletionDate = new Date(now + totalRemainingHours * 3600 * 1000).toISOString();

    return newPriority;
  }

  public recalculateAllPriorities() {
    this.orders.forEach((o) => {
      if (o.status !== 'FINALIZADA' && o.status !== 'EXPEDICAO') {
        this.calculateOpPriority(o);
      }
    });
  }

  // -------------------------------------------------------------
  // OPERATOR CHÃO DE FÁBRICA ACTIONS & LOSS PROPAGATION
  // -------------------------------------------------------------
  public startOperation(stepId: string, machineId?: string, operatorId?: string): boolean {
    const order = this.orders.find((o) => o.steps.some((s) => s.id === stepId));
    if (!order) return false;

    const step = order.steps.find((s) => s.id === stepId);
    if (!step) return false;

    // Regra: Bloquear avanço se a OP estiver em status inválido
    if (order.status === 'REVISAO_PCP') {
      throw new Error(
        `Operação bloqueada: a OP ${order.opNumber} está sob revisão do PCP e aguarda aprovação técnica do roteiro.`
      );
    }
    if ((order.status as string) === 'CANCELADA' || (order.status as string) === 'BLOQUEADA') {
      throw new Error(
        `Operação bloqueada: a OP ${order.opNumber} está com status "${order.status}" e não pode ser iniciada.`
      );
    }

    const targetMachineId = machineId || step.assignedMachineId;
    if (targetMachineId && !this.validateOperatorMachineAccess(targetMachineId)) {
      throw new Error(
        `Operação negada: você está autenticado na máquina "${this.activeOperatorMachineId}" e não pode operar a máquina "${targetMachineId}".`
      );
    }

    // Regra: Bloquear início de operação em máquina com status INATIVA ou MANUTENCAO
    const machine = this.machines.find((m) => m.id === (targetMachineId || step.assignedMachineId));
    if (machine) {
      if (machine.status === 'INATIVA' || machine.isActive === false) {
        throw new Error(
          `Operação bloqueada: a máquina ${machine.name} (${machine.code}) está INATIVA e não pode iniciar produção.`
        );
      }
      if (machine.status === 'MANUTENCAO') {
        throw new Error(
          `Operação bloqueada: a máquina ${machine.name} (${machine.code}) está em MANUTENÇÃO. Resolva o chamado técnico primeiro.`
        );
      }
    }

    // Regra do dossie (cap. 1.2): nenhuma etapa inicia fora da sequencia sem liberacao registrada
    const previousPending = order.steps
      .filter((s) => s.sequenceIndex < step.sequenceIndex)
      .find((s) => s.status !== 'FINALIZADA');
    if (previousPending) {
      throw new Error(
        `Operação bloqueada: a etapa ${previousPending.processName} ainda não foi concluída e liberada.`
      );
    }

    // Rule: Must have received quantity released from previous step!
    if (step.receivedQuantity <= 0 && step.sequenceIndex > 0) {
      throw new Error(
        `Operação bloqueada: A etapa anterior ainda não liberou peças para a máquina ${step.assignedMachineName}.`
      );
    }

    const opUser =
      this.users.find((u) => u.id === operatorId) ||
      this.users.find((u) => u.login === operatorId) ||
      (this.authenticatedUser && this.authenticatedUser.id === operatorId ? this.authenticatedUser : null) ||
      this.authenticatedUser ||
      this.currentUser;

    const actorRoleTitle = opUser.role === 'ADMIN' ? 'Administrador' : 'Operador';

    step.status = 'PRODUZINDO';
    step.actualStartTime = step.actualStartTime || new Date().toISOString();
    step.activeOperatorId = opUser.id;
    step.activeOperatorName = opUser.name;

    order.status = 'EM_PRODUCAO';
    order.currentStepIndex = step.sequenceIndex;

    // Update machine status to PRODUZINDO
    if (machine) {
      machine.status = 'PRODUZINDO';
      machine.currentOpId = order.id;
      machine.currentOperationId = step.id;
      machine.currentPauseReason = undefined;
      machine.pauseStartedAt = undefined;
    }

    this.logAudit(
      'START_OPERACAO',
      'OPERATION',
      step.id,
      `${actorRoleTitle} ${opUser.name} iniciou produção na máquina ${step.assignedMachineName} para a OP ${order.opNumber}. Qtd disponível: ${step.receivedQuantity} ${step.unit}.`
    );

    this.saveToStorage();
    return true;
  }

  public pauseOperation(stepId: string, reason: string, machineId?: string, operatorId?: string): boolean {
    if (!reason || !reason.trim()) {
      throw new Error('É obrigatório informar o motivo da pausa da operação.');
    }

    const order = this.orders.find((o) => o.steps.some((s) => s.id === stepId));
    if (!order) return false;

    const step = order.steps.find((s) => s.id === stepId);
    if (!step) return false;

    const targetMachineId = machineId || step.assignedMachineId;
    if (targetMachineId && !this.validateOperatorMachineAccess(targetMachineId)) {
      throw new Error(
        `Operação negada: você está autenticado na máquina "${this.activeOperatorMachineId}" e não pode operar a máquina "${targetMachineId}".`
      );
    }

    const opUser =
      this.users.find((u) => u.id === operatorId) ||
      this.users.find((u) => u.login === operatorId) ||
      (this.authenticatedUser && this.authenticatedUser.id === operatorId ? this.authenticatedUser : null) ||
      this.authenticatedUser ||
      this.currentUser;

    const actorRoleTitle = opUser.role === 'ADMIN' ? 'Administrador' : 'Operador';

    step.status = 'PAUSADA';
    const nowIso = new Date().toISOString();

    const machine = this.machines.find((m) => m.id === step.assignedMachineId);
    if (machine) {
      if (machine.status !== 'MANUTENCAO') {
        machine.status = 'PAUSADA';
      }
      machine.currentPauseReason = reason.trim();
      machine.pauseStartedAt = nowIso;
    }

    // Record pause log
    const pauseLog: PauseLog = {
      id: 'pause_' + Date.now(),
      operationId: step.id,
      opId: order.id,
      machineId: step.assignedMachineId,
      operatorId: opUser.id,
      operatorName: opUser.name,
      reason: reason.trim(),
      startedAt: nowIso,
    };
    this.pauseLogs.unshift(pauseLog);

    const hasOtherRunningStep = order.steps.some((s) => s.id !== step.id && s.status === 'PRODUZINDO');
    if (!hasOtherRunningStep) {
      order.status = 'PAUSADA';
    }

    this.addAlert(
      'MACHINE_STOPPED',
      'WARNING',
      `Máquina ${step.assignedMachineName} Pausada`,
      `OP ${order.opNumber} pausada por ${actorRoleTitle} ${opUser.name}. Motivo: ${reason}`,
      step.assignedMachineId,
      order.id
    );

    this.logAudit(
      'PAUSA_OPERACAO',
      'OPERATION',
      step.id,
      `Pausa registrada na máquina ${step.assignedMachineName} (OP ${order.opNumber}). Motivo: ${reason} por ${actorRoleTitle} ${opUser.name}`
    );

    this.recalculateAllPriorities();
    this.saveToStorage();
    return true;
  }

  public resumeOperation(stepId: string, machineId?: string, operatorId?: string): boolean {
    const order = this.orders.find((o) => o.steps.some((s) => s.id === stepId));
    if (!order) return false;

    // Regra: Bloquear retomada se a OP estiver em status inválido
    if (order.status === 'REVISAO_PCP' || (order.status as string) === 'CANCELADA' || (order.status as string) === 'BLOQUEADA') {
      throw new Error(
        `Operação bloqueada: a OP ${order.opNumber} está com status "${order.status}" e não pode ser retomada.`
      );
    }

    const step = order.steps.find((s) => s.id === stepId);
    if (!step) return false;

    const targetMachineId = machineId || step.assignedMachineId;
    if (targetMachineId && !this.validateOperatorMachineAccess(targetMachineId)) {
      throw new Error(
        `Operação negada: você está autenticado na máquina "${this.activeOperatorMachineId}" e não pode operar a máquina "${targetMachineId}".`
      );
    }

    // Regra: Bloquear retomada em máquina inativa ou em manutenção
    const machine = this.machines.find((m) => m.id === (targetMachineId || step.assignedMachineId));
    if (machine) {
      if (machine.status === 'INATIVA' || machine.isActive === false) {
        throw new Error(
          `Operação bloqueada: a máquina ${machine.name} (${machine.code}) está INATIVA e não pode retomar a produção.`
        );
      }
      if (machine.status === 'MANUTENCAO') {
        throw new Error(
          `Operação bloqueada: a máquina ${machine.name} (${machine.code}) está em MANUTENÇÃO. Finalize o chamado do mecânico primeiro.`
        );
      }
    }

    const opUser =
      this.users.find((u) => u.id === operatorId) ||
      this.users.find((u) => u.login === operatorId) ||
      (this.authenticatedUser && this.authenticatedUser.id === operatorId ? this.authenticatedUser : null) ||
      this.authenticatedUser ||
      this.currentUser;

    const actorRoleTitle = opUser.role === 'ADMIN' ? 'Administrador' : 'Operador';

    step.status = 'PRODUZINDO';
    order.status = 'EM_PRODUCAO';

    // Close active pause log
    const activePause = this.pauseLogs.find(
      (p) => p.operationId === step.id && !p.endedAt
    );
    if (activePause) {
      activePause.endedAt = new Date().toISOString();
      const diffMin = Math.round(
        (new Date(activePause.endedAt).getTime() - new Date(activePause.startedAt).getTime()) /
          (1000 * 60)
      );
      activePause.durationMinutes = diffMin;
      step.totalPauseMinutes = (step.totalPauseMinutes || 0) + diffMin;
    }

    if (machine) {
      machine.status = 'PRODUZINDO';
      machine.currentOpId = order.id;
      machine.currentOperationId = step.id;
      machine.currentPauseReason = undefined;
      machine.pauseStartedAt = undefined;
    }

    this.logAudit(
      'RETOMAR_OPERACAO',
      'OPERATION',
      step.id,
      `Operador ${opUser.name} retomou produção na máquina ${step.assignedMachineName} (OP ${order.opNumber}).`
    );

    this.recalculateAllPriorities();
    this.saveToStorage();
    return true;
  }

  // -------------------------------------------------------------
  // REGRA CRÍTICA DAS PERDAS E PROPAGAÇÃO AUTOMÁTICA
  // QUANTIDADE BOA = QUANTIDADE PRODUZIDA - PERDAS
  // Próxima etapa recebe estritamente QUANTIDADE BOA!
  // -------------------------------------------------------------
  public finishOperation(
    stepId: string,
    data: {
      producedQuantity: number;
      lossQuantity: number;
      lossReason?: string;
      observation?: string;
      lossClassification?: LossClassification;
      lossDestination?: LossDestination;
      reworkQuantity?: number;
      heldQuantity?: number;
    },
    machineId?: string,
    operatorId?: string
  ): boolean {
    const producedQuantity = Number(data?.producedQuantity) || 0;
    const lossQuantity = Number(data?.lossQuantity) || 0;
    const lossReason = data?.lossReason;
    const observation = data?.observation;
    const order = this.orders.find((o) => o.steps.some((s) => s.id === stepId));
    if (!order) return false;

    const stepIndex = order.steps.findIndex((s) => s.id === stepId);
    if (stepIndex === -1) return false;

    const step = order.steps[stepIndex];

    const targetMachineId = machineId || step.assignedMachineId;
    if (targetMachineId && !this.validateOperatorMachineAccess(targetMachineId)) {
      throw new Error(
        `Operação negada: você está autenticado na máquina "${this.activeOperatorMachineId}" e não pode operar a máquina "${targetMachineId}".`
      );
    }

    // Regra 5: Validações de quantidades e perdas
    if (producedQuantity <= 0) {
      throw new Error('A quantidade produzida deve ser maior que zero.');
    }
    if (lossQuantity < 0) {
      throw new Error('A quantidade de perda não pode ser negativa.');
    }
    if (lossQuantity > producedQuantity) {
      throw new Error('A quantidade de perda não pode ser maior do que a quantidade produzida.');
    }
    if (lossQuantity > 0 && (!lossReason || !lossReason.trim())) {
      throw new Error('É obrigatório informar o motivo da perda quando houver refugo apontado.');
    }
    if (step.sequenceIndex > 0 && step.receivedQuantity > 0 && producedQuantity > step.receivedQuantity) {
      throw new Error(
        `A quantidade apontada (${producedQuantity} ${step.unit}) não pode exceder o lote recebido da etapa anterior (${step.receivedQuantity} ${step.unit}).`
      );
    }

    const opUser =
      this.users.find((u) => u.id === operatorId) ||
      this.users.find((u) => u.login === operatorId) ||
      (this.authenticatedUser && this.authenticatedUser.id === operatorId ? this.authenticatedUser : null) ||
      this.authenticatedUser ||
      this.currentUser;

    const actorRoleTitle = opUser.role === 'ADMIN' ? 'Administrador' : 'Operador';

    const validProduced = Math.max(0, producedQuantity);
    const validLoss = Math.max(0, lossQuantity);
    const goodQuantity = Math.max(0, validProduced - validLoss);

    step.producedQuantity = validProduced;
    step.lossQuantity = validLoss;
    step.goodQuantity = goodQuantity;
    step.lossReason = lossReason;
    step.lossObservation = observation;
    step.lossClassification = validLoss > 0 ? data?.lossClassification : undefined;
    step.lossDestination = validLoss > 0 ? data?.lossDestination : undefined;
    step.reworkQuantity = data?.reworkQuantity;
    step.heldQuantity = data?.heldQuantity;

    // Trilha de auditoria da perda - Dossie cap. 8.1 e 11.1 (motivo, quantidade, unidade e destino)
    if (validLoss > 0) {
      this.logAudit(
        'REGISTRO_PERDA',
        'OPERATION',
        step.id,
        `Perda de ${validLoss} ${step.unit} na etapa ${step.processName} (máquina ${step.assignedMachineName}). ` +
          `Classificação: ${data?.lossClassification || 'NAO_INFORMADA'}. Destino: ${data?.lossDestination || 'NAO_INFORMADO'}. ` +
          `Motivo: ${lossReason || 'não informado'}.`
      );
    }
    step.status = 'FINALIZADA';
    step.actualEndTime = new Date().toISOString();

    // Cálculo do tempo real decorrido e tempo líquido
    if (step.actualStartTime) {
      const startMs = new Date(step.actualStartTime).getTime();
      const endMs = new Date(step.actualEndTime).getTime();
      const grossMinutes = Math.max(1, Math.round((endMs - startMs) / (1000 * 60)));
      const pauseMinutes = step.totalPauseMinutes || 0;
      step.actualMinutes = Math.max(1, grossMinutes - pauseMinutes);
    }

    // Free machine
    const machine = this.machines.find((m) => m.id === step.assignedMachineId);
    if (machine) {
      machine.status = 'DISPONIVEL';
      machine.currentOpId = undefined;
      machine.currentOperationId = undefined;
      machine.currentPauseReason = undefined;
      machine.pauseStartedAt = undefined;
    }

    // Propagate to Next Step
    const nextStepIndex = stepIndex + 1;
    if (nextStepIndex < order.steps.length) {
      const nextStep = order.steps[nextStepIndex];
      // CRITICAL: Next step receives ONLY the good quantity!
      nextStep.receivedQuantity = goodQuantity;
      nextStep.plannedQuantity = goodQuantity;
      nextStep.status = 'PRONTA';
      order.currentStepIndex = nextStepIndex;

      this.logAudit(
        'PROPAGACAO_LOTE',
        'OPERATION',
        nextStep.id,
        `Etapa ${step.processName} finalizada com ${goodQuantity} boas (perda de ${validLoss}). Liberado lote de ${goodQuantity} ${order.unit} para ${nextStep.processName} na máquina ${nextStep.assignedMachineName}.`
      );
    } else {
      // Finished all operations! Move to EXPEDICAO
      order.status = 'EXPEDICAO';
      order.currentGoodQuantity = goodQuantity;
      this.logAudit(
        'CONCLUSAO_ROTEIRO',
        'OP',
        order.id,
        `Todas as etapas de fabricação da OP ${order.opNumber} foram concluídas. Lote final liberado para expedição: ${goodQuantity} ${order.unit}. Perdas totais: ${order.totalLosses} un.`
      );
    }

    // Recalculate total OP losses
    order.totalLosses = order.steps.reduce((sum, s) => sum + (s.lossQuantity || 0), 0);
    order.currentGoodQuantity = goodQuantity;

    // Check if loss is abnormally high (> 5% of target)
    if (validLoss > order.targetQuantity * 0.05) {
      this.addAlert(
        'HIGH_LOSS',
        'WARNING',
        `Perda Elevada na Etapa ${step.processName} (OP ${order.opNumber})`,
        `Perda de ${validLoss} ${order.unit} registrada por ${opUser.name}. Motivo: ${lossReason || 'Não informado'}`,
        step.assignedMachineId,
        order.id
      );
    }

    this.recalculateAllPriorities();
    this.saveToStorage();
    return true;
  }

  // -------------------------------------------------------------
  // PCP CENTRAL CONTROLS & MANUAL REVIEWS
  // -------------------------------------------------------------
  public updateStepMachine(stepId: string, newMachineId: string) {
    const order = this.orders.find((o) => o.steps.some((s) => s.id === stepId));
    if (!order) throw new Error('Ordem de Produção não encontrada.');

    const step = order.steps.find((s) => s.id === stepId);
    if (!step) throw new Error('Etapa de produção não encontrada.');

    // Regra 6: Bloquear troca de máquina durante operação em andamento
    if (step.status === 'PRODUZINDO') {
      throw new Error(
        `Bloqueio de reatribuição: a etapa "${step.processName}" está em andamento (PRODUZINDO). Pause a operação antes de reatribuir para outra máquina.`
      );
    }

    const newMachine = this.machines.find((m) => m.id === newMachineId);
    if (!newMachine) throw new Error('Máquina de destino não encontrada.');

    if (newMachine.status === 'INATIVA' || newMachine.isActive === false) {
      throw new Error(`A máquina ${newMachine.name} está inativa e não pode receber operações.`);
    }

    // Validação de compatibilidade técnica de Corte e Solda
    if (step.processTypeId === 'proc_solda') {
      const rec = this.calculateCorteSoldaRecommendation(order, step, newMachine.id);
      if (rec.isBlocked) {
        throw new Error(rec.blockReason || `A máquina ${newMachine.name} não é compatível com esta OP.`);
      }
    } else if (newMachine.processTypeId !== step.processTypeId) {
      throw new Error(
        `A máquina ${newMachine.name} não realiza o processo "${step.processName}".`
      );
    }

    const oldMachineName = step.assignedMachineName;
    step.assignedMachineId = newMachine.id;
    step.assignedMachineName = newMachine.name;

    this.logAudit(
      'ALTERACAO_MAQUINA',
      'OPERATION',
      step.id,
      `PCP alterou a máquina da etapa ${step.processName} (OP ${order.opNumber}) de "${oldMachineName}" para "${newMachine.name}".`,
      oldMachineName,
      newMachine.name
    );

    this.recalculateAllPriorities();
    this.saveToStorage();
    return { success: true };
  }

  public setManualPriority(opId: string, priority: PriorityLevel) {
    const order = this.orders.find((o) => o.id === opId);
    if (!order) return;

    const oldPriority = order.priority;
    order.priority = priority;
    order.manualPriorityOverride = true;

    this.logAudit(
      'ALTERACAO_PRIORIDADE',
      'OP',
      order.id,
      `PCP alterou manualmente a prioridade da OP ${order.opNumber} de ${oldPriority} para ${priority}.`,
      oldPriority,
      priority
    );

    this.saveToStorage();
  }

  public approveOpRoute(opId: string) {
    const order = this.orders.find((o) => o.id === opId);
    if (!order) return;

    order.status = 'PROGRAMADA';
    if (order.steps.length > 0 && order.steps[0].status === 'AGUARDANDO_ANTERIOR') {
      order.steps[0].status = 'PRONTA';
    }

    this.logAudit(
      'APROVACAO_ROTEIRO',
      'OP',
      order.id,
      `PCP aprovou o roteiro técnico e liberou a OP ${order.opNumber} para programação de fábrica.`
    );

    this.saveToStorage();
  }

  public dispatchOp(opId: string, trackingInfo?: string) {
    const order = this.orders.find((o) => o.id === opId);
    if (!order) {
      throw new Error('Ordem de Produção não encontrada para despacho.');
    }

    // Regra: Bloquear despacho se a OP não estiver 100% finalizada
    const unfinishedStep = order.steps.find((s) => s.status !== 'FINALIZADA');
    if (unfinishedStep) {
      throw new Error(
        `Bloqueio de despacho: a OP ${order.opNumber} ainda possui etapas pendentes de finalização (${unfinishedStep.processName} - status: ${unfinishedStep.status}).`
      );
    }

    // Regra: Bloquear se não houver saldo bom finalizado
    if (!order.currentGoodQuantity || order.currentGoodQuantity <= 0) {
      throw new Error(
        `Bloqueio de despacho: a OP ${order.opNumber} não possui saldo bom finalizado para expedição.`
      );
    }

    // Regra: Bloquear saldo pendente sem justificativa
    if (order.currentGoodQuantity < order.targetQuantity && (!trackingInfo || !trackingInfo.trim())) {
      throw new Error(
        `Bloqueio de despacho: o saldo produzido (${order.currentGoodQuantity} ${order.unit}) é inferior à meta planejada (${order.targetQuantity} ${order.unit}). É obrigatório informar a justificativa técnica para o envio parcial.`
      );
    }

    order.status = 'FINALIZADA';
    order.completedAt = order.completedAt || new Date().toISOString();

    this.logAudit(
      'EXPEDICAO_FINALIZADA',
      'OP',
      order.id,
      `OP ${order.opNumber} expedida com sucesso. Quantidade despachada: ${order.currentGoodQuantity} ${order.unit}. Detalhes: ${trackingInfo || 'Despacho regular'}`
    );

    this.saveToStorage();
    return { success: true };
  }

  // Machine Queue helper
  public getMachineQueue(machineId: string): Array<{
    order: ProductionOrder;
    step: OperationStep;
  }> {
    if (
      this.activeOperatorMachineId &&
      this.activeOperatorMachineId !== machineId &&
      this.authenticatedUser?.role !== 'ADMIN'
    ) {
      this.validateOperatorMachineAccess(machineId);
      return [];
    }

    const queue: Array<{ order: ProductionOrder; step: OperationStep }> = [];
    this.orders.forEach((o) => {
      o.steps.forEach((step) => {
        if (
          step.assignedMachineId === machineId &&
          (step.status === 'PRODUZINDO' ||
            step.status === 'PAUSADA' ||
            step.status === 'PRONTA' ||
            step.status === 'NA_FILA' ||
            step.status === 'AGUARDANDO_ANTERIOR')
        ) {
          queue.push({ order: o, step });
        }
      });
    });

    // Sort queue by priority (VERMELHO -> AMARELO -> VERDE) and status
    const priorityWeight: Record<PriorityLevel, number> = {
      VERMELHO: 3,
      AMARELO: 2,
      VERDE: 1,
    };

    queue.sort((a, b) => {
      // Producing first
      if (a.step.status === 'PRODUZINDO' && b.step.status !== 'PRODUZINDO') return -1;
      if (b.step.status === 'PRODUZINDO' && a.step.status !== 'PRODUZINDO') return 1;

      // Higher priority first
      const pDiff = priorityWeight[b.order.priority] - priorityWeight[a.order.priority];
      if (pDiff !== 0) return pDiff;

      // Deadline earlier first
      return new Date(a.order.deadline).getTime() - new Date(b.order.deadline).getTime();
    });

    return queue;
  }
}

export const mesStore = new MesStore();
