import crypto from 'crypto';
import { ServerAuditService } from './auditService';

export type SystemSectorCode =
  | 'ADMIN'
  | 'PCP'
  | 'REFILE'
  | 'FLEXOGRAFIA'
  | 'ESTAMPARIA'
  | 'CORTE_SOLDA'
  | 'ALCA'
  | 'EXPEDICAO';

export interface ServerUser {
  id: string;
  name: string;
  login: string;
  username: string;
  passwordHash: string;
  passwordSalt: string;
  sectors: SystemSectorCode[];
  role: string;
  jobTitle: string;
  sector: string;
  authorizedMachineIds: string[];
  assignedMachineNames?: string[];
  shift: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginAttempt {
  count: number;
  lastAttempt: number;
  blockedUntil?: number;
}

// Utilitários de Hash server-side
function hashPassword(plainText: string, salt: string): string {
  const combined = `bellatop_salt_${salt}:${plainText.trim()}:secure_mes_2026`;
  return crypto.createHash('sha256').update(combined).digest('hex');
}

function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

function normalizeUsername(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .trim();
}

const DEFAULT_SALT = 'bellatop_seed_salt_2026';
const HASH_ADMIN = hashPassword('admin123', DEFAULT_SALT);
const HASH_123456 = hashPassword('123456', DEFAULT_SALT);

// Base inicial em memória sincronizada com as credenciais seguras da fábrica Bella Top
const INITIAL_USERS: ServerUser[] = [
  {
    id: 'user_admin_root',
    name: 'Administrador Bella Top',
    login: 'admin',
    username: 'admin',
    passwordHash: HASH_ADMIN,
    passwordSalt: DEFAULT_SALT,
    sectors: ['ADMIN', 'PCP', 'REFILE', 'FLEXOGRAFIA', 'ESTAMPARIA', 'CORTE_SOLDA', 'ALCA', 'EXPEDICAO'],
    role: 'ADMIN',
    jobTitle: 'Administrador do Sistema MES',
    sector: 'ADMIN',
    authorizedMachineIds: ['*'],
    shift: 'GERAL',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'user_elton',
    name: 'Elton Silva',
    login: 'elton',
    username: 'elton',
    passwordHash: HASH_123456,
    passwordSalt: DEFAULT_SALT,
    sectors: ['REFILE', 'FLEXOGRAFIA'],
    role: 'OPERATOR',
    jobTitle: 'Operador de Refile e Flexografia',
    sector: 'REFILE',
    authorizedMachineIds: ['REFILADEIRA_01', 'FLEXO_01', 'FLEXO_02'],
    shift: 'TURNO_1',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'user_viola',
    name: 'Viola Operador',
    login: 'viola',
    username: 'viola',
    passwordHash: HASH_123456,
    passwordSalt: DEFAULT_SALT,
    sectors: ['ESTAMPARIA', 'CORTE_SOLDA'],
    role: 'OPERATOR',
    jobTitle: 'Operador de Estamparia e Corte/Solda',
    sector: 'ESTAMPARIA',
    authorizedMachineIds: ['PRENSA_01', 'PRENSA_02', 'CORTE_SOLDA_01'],
    shift: 'TURNO_1',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'user_ramon',
    name: 'Ramon Planejamento',
    login: 'ramon',
    username: 'ramon',
    passwordHash: HASH_123456,
    passwordSalt: DEFAULT_SALT,
    sectors: ['PCP'],
    role: 'PCP',
    jobTitle: 'Analista de Planejamento e Controle',
    sector: 'PCP',
    authorizedMachineIds: ['*'],
    shift: 'GERAL',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'user_welton',
    name: 'Welton Santos',
    login: 'welton',
    username: 'welton',
    passwordHash: HASH_123456,
    passwordSalt: DEFAULT_SALT,
    sectors: ['CORTE_SOLDA'],
    role: 'OPERATOR',
    jobTitle: 'Operador de Corte e Solda',
    sector: 'CORTE_SOLDA',
    authorizedMachineIds: ['CORTE_SOLDA_01', 'CORTE_SOLDA_02'],
    shift: 'TURNO_2',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'user_carlos',
    name: 'Carlos',
    login: 'carlos',
    username: 'carlos',
    passwordHash: HASH_123456,
    passwordSalt: DEFAULT_SALT,
    sectors: ['EXPEDICAO'],
    role: 'OPERATOR',
    jobTitle: 'Responsável por Expedição & Embalagem',
    sector: 'EXPEDICAO',
    authorizedMachineIds: [],
    assignedMachineNames: ['Expedição & Embalagem (Manual)'],
    shift: 'TURNO_1',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'user_marcos',
    name: 'Marcos Vinicius',
    login: 'marcos',
    username: 'marcos',
    passwordHash: HASH_123456,
    passwordSalt: DEFAULT_SALT,
    sectors: ['EXPEDICAO'],
    role: 'OPERATOR',
    jobTitle: 'Operador de Embalagem e Expedição',
    sector: 'EXPEDICAO',
    authorizedMachineIds: ['MESA_EXPEDICAO_01'],
    shift: 'TURNO_1',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'user_robson',
    name: 'Robson Roberto',
    login: 'robson',
    username: 'robson',
    passwordHash: HASH_123456,
    passwordSalt: DEFAULT_SALT,
    sectors: ['ADMIN', 'PCP'],
    role: 'ADMIN',
    jobTitle: 'Diretor Industrial & PCP',
    sector: 'ADMIN',
    authorizedMachineIds: ['*'],
    shift: 'GERAL',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

export class ServerAuthService {
  private static users: Map<string, ServerUser> = new Map();
  private static sessions: Map<string, { userId: string; createdAt: number }> = new Map();
  private static attempts: Map<string, LoginAttempt> = new Map();

  static {
    // Inicializa os usuários em memória
    for (const u of INITIAL_USERS) {
      this.users.set(u.id, { ...u });
    }
  }

  public static getUsers(): Omit<ServerUser, 'passwordHash' | 'passwordSalt'>[] {
    return Array.from(this.users.values()).map(({ passwordHash, passwordSalt, ...safe }) => safe);
  }

  public static getUserById(id: string): ServerUser | undefined {
    return this.users.get(id);
  }

  public static getUserByUsername(rawUsername: string): ServerUser | undefined {
    const norm = normalizeUsername(rawUsername);
    for (const u of this.users.values()) {
      if (normalizeUsername(u.login) === norm || normalizeUsername(u.username) === norm) {
        return u;
      }
    }
    return undefined;
  }

  public static login(
    rawUsername: string,
    plainPassword: string
  ): {
    success: boolean;
    user?: Omit<ServerUser, 'passwordHash' | 'passwordSalt'>;
    token?: string;
    error?: string;
    blockedRemainingSeconds?: number;
  } {
    const norm = normalizeUsername(rawUsername);
    const now = Date.now();

    // 1. Verificação de Bloqueio por Força Bruta
    const attempt = this.attempts.get(norm);
    if (attempt && attempt.blockedUntil && attempt.blockedUntil > now) {
      const remainingSec = Math.ceil((attempt.blockedUntil - now) / 1000);
      ServerAuditService.log({
        action: 'AUTH_BLOCKED_ATTEMPTS',
        entityType: 'AUTH',
        entityId: norm,
        details: `Tentativa de login bloqueada temporariamente para o usuário "${rawUsername}". Restam ${remainingSec}s`,
      });
      return {
        success: false,
        error: `Muitas tentativas incorretas. Acesso bloqueado por segurança. Aguarde ${remainingSec} segundos.`,
        blockedRemainingSeconds: remainingSec,
      };
    }

    const user = this.getUserByUsername(norm);

    if (!user) {
      this.recordFailedAttempt(norm);
      ServerAuditService.log({
        action: 'AUTH_LOGIN_FAILED',
        entityType: 'AUTH',
        entityId: norm,
        details: `Tentativa de login com usuário inexistente: "${rawUsername}"`,
      });
      return { success: false, error: 'Nome de usuário ou senha incorretos.' };
    }

    if (!user.isActive) {
      ServerAuditService.log({
        action: 'AUTH_LOGIN_FAILED',
        entityType: 'AUTH',
        entityId: user.id,
        details: `Tentativa de login com conta inativa/desativada: ${user.name} (@${user.login})`,
      });
      return { success: false, error: 'Esta conta está inativa. Contate o Administrador.' };
    }

    const expectedHash = hashPassword(plainPassword, user.passwordSalt);
    if (expectedHash !== user.passwordHash) {
      this.recordFailedAttempt(norm);
      ServerAuditService.log({
        action: 'AUTH_LOGIN_FAILED',
        entityType: 'AUTH',
        entityId: user.id,
        details: `Senha incorreta para o usuário: ${user.name} (@${user.login})`,
      });
      return { success: false, error: 'Nome de usuário ou senha incorretos.' };
    }

    // Sucesso no login - limpa tentativas
    this.attempts.delete(norm);
    user.lastLoginAt = new Date().toISOString();
    user.updatedAt = new Date().toISOString();
    this.users.set(user.id, user);

    const token = `bt_sess_${crypto.randomBytes(24).toString('hex')}_${Date.now()}`;
    this.sessions.set(token, { userId: user.id, createdAt: now });

    ServerAuditService.log({
      action: 'AUTH_LOGIN_SUCCESS',
      entityType: 'AUTH',
      entityId: user.id,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      details: `Login bem-sucedido: ${user.name} (@${user.login}) - Setores: ${user.sectors.join(', ')}`,
    });

    const { passwordHash, passwordSalt, ...safeUser } = user;
    return {
      success: true,
      user: safeUser,
      token,
    };
  }

  /**
   * Valida se um token de sessão é autêntico, não expirado e pertence a um usuário ativo
   */
  public static validateSession(token: string): ServerUser | null {
    if (!token || typeof token !== 'string') return null;
    const cleanToken = token.trim();
    const session = this.sessions.get(cleanToken);
    if (!session) return null;

    // Sessão válida por 24 horas
    const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;
    if (Date.now() - session.createdAt > SESSION_EXPIRY_MS) {
      this.sessions.delete(cleanToken);
      return null;
    }

    const user = this.users.get(session.userId);
    if (!user || !user.isActive) {
      return null;
    }

    return user;
  }

  /**
   * Cria programaticamente uma sessão válida para um usuário (ex: testes ou autenticações validadas)
   */
  public static createSession(userId: string): string | null {
    const user = this.users.get(userId);
    if (!user || !user.isActive) return null;

    const token = `bt_sess_${crypto.randomBytes(24).toString('hex')}_${Date.now()}`;
    this.sessions.set(token, { userId: user.id, createdAt: Date.now() });
    return token;
  }

  /**
   * Encerra uma sessão ativa
   */
  public static logoutSession(token: string): boolean {
    if (!token) return false;
    return this.sessions.delete(token.trim());
  }

  private static recordFailedAttempt(normUsername: string) {
    const now = Date.now();
    const current = this.attempts.get(normUsername) || { count: 0, lastAttempt: now };
    current.count += 1;
    current.lastAttempt = now;

    // Se falhar 5 vezes seguidas -> bloqueio de 60 segundos
    if (current.count >= 5) {
      current.blockedUntil = now + 60 * 1000;
    }

    this.attempts.set(normUsername, current);
  }

  public static createUser(
    adminUserId: string,
    params: {
      name: string;
      username: string;
      password: string;
      sectors: SystemSectorCode[];
      authorizedMachineIds?: string[];
      jobTitle?: string;
      sector?: string;
      shift?: string;
    }
  ): { success: boolean; user?: Omit<ServerUser, 'passwordHash' | 'passwordSalt'>; error?: string } {
    const norm = normalizeUsername(params.username);
    if (!norm) {
      return { success: false, error: 'Nome de usuário inválido.' };
    }

    if (this.getUserByUsername(norm)) {
      return { success: false, error: 'Já existe um usuário cadastrado com este nome de acesso.' };
    }

    if (!params.password || params.password.length < 4) {
      return { success: false, error: 'A senha deve ter no mínimo 4 caracteres.' };
    }

    if (!params.sectors || params.sectors.length === 0) {
      return { success: false, error: 'Selecione ao menos um setor/função para o usuário.' };
    }

    const salt = generateSalt();
    const pHash = hashPassword(params.password, salt);
    const id = `user_${norm}_${Date.now()}`;
    const now = new Date().toISOString();

    const newUser: ServerUser = {
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

    this.users.set(id, newUser);

    ServerAuditService.log({
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: id,
      userId: adminUserId,
      details: `Novo acesso criado: ${newUser.name} (@${newUser.login}) com funções: [${newUser.sectors.join(', ')}] por Admin ID: ${adminUserId}`,
    });

    const { passwordHash, passwordSalt, ...safe } = newUser;
    return { success: true, user: safe };
  }

  public static updateUser(
    adminUserId: string,
    id: string,
    params: {
      name?: string;
      sectors?: SystemSectorCode[];
      authorizedMachineIds?: string[];
      jobTitle?: string;
      sector?: string;
      shift?: string;
      isActive?: boolean;
    }
  ): { success: boolean; user?: Omit<ServerUser, 'passwordHash' | 'passwordSalt'>; error?: string } {
    const user = this.users.get(id);
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
    this.users.set(id, user);

    ServerAuditService.log({
      action: 'USER_UPDATED',
      entityType: 'USER',
      entityId: id,
      userId: adminUserId,
      details: `Acesso atualizado para ${user.name} (@${user.login}) - Status: ${user.isActive ? 'ATIVO' : 'INATIVO'}, Funções: [${user.sectors.join(', ')}] por Admin ID: ${adminUserId}`,
    });

    const { passwordHash, passwordSalt, ...safe } = user;
    return { success: true, user: safe };
  }

  public static resetPassword(
    adminUserId: string,
    targetUserId: string,
    newPlainPassword: string
  ): { success: boolean; error?: string } {
    const user = this.users.get(targetUserId);
    if (!user) return { success: false, error: 'Usuário não encontrado.' };
    if (!newPlainPassword || newPlainPassword.length < 4) {
      return { success: false, error: 'A nova senha deve ter no mínimo 4 caracteres.' };
    }

    const salt = generateSalt();
    user.passwordSalt = salt;
    user.passwordHash = hashPassword(newPlainPassword, salt);
    user.updatedAt = new Date().toISOString();
    this.users.set(targetUserId, user);

    // Limpa tentativas de bloqueio anteriores
    this.attempts.delete(normalizeUsername(user.login));

    ServerAuditService.log({
      action: 'AUTH_PASSWORD_RESET',
      entityType: 'USER',
      entityId: targetUserId,
      userId: adminUserId,
      details: `Senha redefinida pelo Administrador ID ${adminUserId} para o usuário ${user.name} (@${user.login})`,
    });

    return { success: true };
  }

  public static changePasswordSelf(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): { success: boolean; error?: string } {
    const user = this.users.get(userId);
    if (!user) return { success: false, error: 'Usuário não encontrado.' };

    const expectedHash = hashPassword(currentPassword, user.passwordSalt);
    if (expectedHash !== user.passwordHash) {
      return { success: false, error: 'A senha atual está incorreta.' };
    }

    if (!newPassword || newPassword.length < 4) {
      return { success: false, error: 'A nova senha deve ter no mínimo 4 caracteres.' };
    }

    const salt = generateSalt();
    user.passwordSalt = salt;
    user.passwordHash = hashPassword(newPassword, salt);
    user.updatedAt = new Date().toISOString();
    this.users.set(userId, user);

    ServerAuditService.log({
      action: 'AUTH_PASSWORD_CHANGED',
      entityType: 'USER',
      entityId: userId,
      userId: userId,
      userName: user.name,
      details: `Usuário ${user.name} (@${user.login}) alterou sua própria senha com sucesso.`,
    });

    return { success: true };
  }

  public static toggleUserStatus(
    adminUserId: string,
    targetUserId: string,
    isActive: boolean
  ): { success: boolean; error?: string } {
    const user = this.users.get(targetUserId);
    if (!user) return { success: false, error: 'Usuário não encontrado.' };

    user.isActive = isActive;
    user.updatedAt = new Date().toISOString();
    this.users.set(targetUserId, user);

    ServerAuditService.log({
      action: 'USER_STATUS_TOGGLED',
      entityType: 'USER',
      entityId: targetUserId,
      userId: adminUserId,
      details: `Status do usuário ${user.name} (@${user.login}) alterado para ${isActive ? 'ATIVO' : 'INATIVO'} por Admin ID: ${adminUserId}`,
    });

    return { success: true };
  }
}
