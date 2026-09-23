import { User, Machine, SystemSectorCode } from '../types/mes';

/**
 * Normaliza strings para comparações seguras sem acentos ou caixas
 */
function normalizeStr(val?: string): string {
  return (val || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Verifica se um setor de máquina bate com o código de setor do sistema
 */
export function matchSectorCode(machineSector?: string, sectorCode?: SystemSectorCode): boolean {
  if (!machineSector || !sectorCode) return false;
  const sec = normalizeStr(machineSector);
  switch (sectorCode) {
    case 'REFILE':
      return sec.includes('refil');
    case 'FLEXOGRAFIA':
      return sec.includes('flexo');
    case 'ESTAMPARIA':
      return sec.includes('estamp') || sec.includes('serigr') || sec.includes('carross');
    case 'CORTE_SOLDA':
      return sec.includes('corte') || sec.includes('solda') || sec.includes('cs');
    case 'ALCA':
      return sec.includes('alca') || sec.includes('acabam');
    case 'CORDAO_MANUAL':
      return sec.includes('cordao') || sec.includes('fio');
    case 'COSTURA':
      return sec.includes('costur');
    case 'TERCEIRIZADO':
      return sec.includes('terceir');
    case 'EXPEDICAO':
      return sec.includes('exped');
    case 'PCP':
    case 'ADMIN':
      return true;
    default:
      return false;
  }
}

/**
 * Verifica se o usuário está ativo e autorizado a operar uma máquina específica
 */
export function isUserAuthorizedForMachine(
  user: User,
  machineOrId: Machine | string,
  allMachines: Machine[] = []
): boolean {
  if (!user || user.isActive === false) return false;

  // Regra 2: Administrador pode acessar tudo
  if (user.role === 'ADMIN' || (Array.isArray(user.sectors) && user.sectors.includes('ADMIN'))) {
    return true;
  }

  // Regra 2: PCP não deve ser tratado como operador comum de máquina
  if (user.role === 'PCP' || (user.sectors?.length === 1 && user.sectors[0] === 'PCP')) {
    return false;
  }

  // Identifica a máquina alvo
  let machineId: string;
  let machineCode: string = '';
  let machineSector: string = '';

  if (typeof machineOrId === 'string') {
    machineId = machineOrId;
    const found = allMachines.find((m) => m.id === machineId || m.code === machineId);
    if (found) {
      machineCode = found.code || '';
      machineSector = found.sector || '';
    }
  } else {
    machineId = machineOrId.id;
    machineCode = machineOrId.code || '';
    machineSector = machineOrId.sector || '';
  }

  const authIds = user.authorizedMachineIds || [];

  // 1. Autorização direta por ID da máquina (ex: 'REFILADEIRA_01', 'm2-corte-solda')
  if (authIds.includes(machineId)) return true;

  // 2. Autorização direta por código da máquina (ex: 'REF-01', 'CS-02')
  if (machineCode && authIds.includes(machineCode)) return true;

  // 3. Autorização coringa '*' (Todas as máquinas dos setores do usuário)
  if (authIds.includes('*')) {
    // Se o usuário não tem restrição de setores
    if (!user.sectors || user.sectors.length === 0) return true;

    // Se o usuário tem setores definidos, verifica se algum bate com o setor da máquina
    if (machineSector) {
      return user.sectors.some((secCode) => matchSectorCode(machineSector, secCode));
    }
    return true;
  }

  return false;
}

/**
 * Retorna todos os operadores ativos e autorizados para uma máquina específica.
 * PCP e Administradores não são listados como operadores comuns de chão de fábrica
 * a menos que haja autorização explícita individual.
 */
export function getActiveOperatorsForMachine(
  users: User[],
  machineOrId: Machine | string,
  allMachines: Machine[] = []
): User[] {
  return users
    .filter((u) => {
      if (!u || u.isActive === false) return false;
      // PCP não deve ser tratado como operador comum
      if (u.role === 'PCP' || (u.sectors?.length === 1 && u.sectors[0] === 'PCP')) {
        return false;
      }
      // Administrador não aparece na lista de operadores de máquina a menos que explicitamente autorizado para esta máquina
      if (u.role === 'ADMIN' || (Array.isArray(u.sectors) && u.sectors.includes('ADMIN'))) {
        const mId = typeof machineOrId === 'string' ? machineOrId : machineOrId.id;
        const mCode = typeof machineOrId === 'string' ? '' : machineOrId.code;
        const authIds = u.authorizedMachineIds || [];
        return authIds.includes(mId) || (!!mCode && authIds.includes(mCode));
      }
      return isUserAuthorizedForMachine(u, machineOrId, allMachines);
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

/**
 * Retorna a lista de nomes de máquinas que o usuário opera ou supervisiona
 */
export function getUserOperatedMachineNames(user: User, machines: Machine[]): string[] {
  if (!user) return [];

  // Se já tiver uma lista explícita definida no usuário
  if (user.assignedMachineNames && user.assignedMachineNames.length > 0) {
    return user.assignedMachineNames;
  }

  // Se tem acesso total (PCP, Direção, Admin, Gestor)
  if (user.authorizedMachineIds?.includes('*') || user.role === 'ADMIN' || user.role === 'PCP' || user.role === 'MANAGER') {
    return machines.map((m) => m.name);
  }

  // Mapeia os IDs autorizados para os nomes reais cadastrados no sistema
  const authIds = user.authorizedMachineIds || [];
  const foundNames = machines
    .filter((m) => authIds.includes(m.id) || authIds.includes(m.code))
    .map((m) => m.name);

  if (foundNames.length > 0) {
    return foundNames;
  }

  return ['Nenhuma máquina vinculada'];
}

/**
 * Retorna um texto resumido e amigável das máquinas do usuário
 */
export function getUserMachineSummary(user: User, machines: Machine[]): string {
  if (!user) return '';

  if (user.authorizedMachineIds?.includes('*') || user.role === 'ADMIN' || user.role === 'PCP' || user.role === 'MANAGER') {
    if (user.role === 'PCP') return 'Supervisão: Todas as Máquinas';
    if (user.role === 'MANAGER') return 'Gestão: Todas as Máquinas';
    if (user.role === 'ADMIN') return 'Acesso Total ao Sistema';
    return 'Todas as Máquinas dos Setores';
  }

  const names = getUserOperatedMachineNames(user, machines);

  if (names.length === 0 || names[0] === 'Nenhuma máquina vinculada') return 'Sem máquinas atribuídas';
  if (names.length === 1) return `Máquina: ${names[0]}`;
  if (names.length <= 2) return `Máquinas: ${names.join(' • ')}`;
  
  return `${names.length} Máquinas: ${names.slice(0, 2).join(', ')} +${names.length - 2}`;
}

/**
 * Retorna apenas usuários reais, ativos com perfil de Administrador / Master
 */
export function getActiveAdministrators(users: User[]): User[] {
  if (!Array.isArray(users)) return [];
  return users.filter(
    (u) =>
      u.isActive !== false &&
      (u.role === 'ADMIN' || (Array.isArray(u.sectors) && u.sectors.includes('ADMIN')))
  );
}

