export type UserRole =
  | 'ADMIN'
  | 'PCP'
  | 'MANAGER'
  | 'LIDER'
  | 'OPERATOR'
  | 'QUALIDADE'
  | 'MANUTENCAO'
  | 'EXPEDITION';

export type PriorityLevel = 'VERDE' | 'AMARELO' | 'VERMELHO';

// Estados obrigatorios da maquina - Dossie de Funcionamento cap. 9.1
export type MachineStatus =
  | 'DISPONIVEL'
  | 'SETUP'
  | 'PRODUZINDO'
  | 'PAUSADA'
  | 'MANUTENCAO'
  | 'LEGADO'
  | 'QUALIDADE'
  | 'INATIVA';

// Classificacao obrigatoria de perdas - Dossie cap. 8.1
export type LossClassification =
  | 'REFUGO'
  | 'RETRABALHO'
  | 'SOBRA_REAPROVEITAVEL'
  | 'TOCO'
  | 'QUARENTENA';

// Destino do material perdido/retido - Dossie cap. 8.1 e 11.1
export type LossDestination =
  | 'DESCARTE'
  | 'RETORNO_ETAPA'
  | 'ESTOQUE_SOBRA'
  | 'AGUARDANDO_DECISAO'
  | 'CONCESSAO';

export type OperationStatus = 
  | 'AGUARDANDO_ANTERIOR'
  | 'PRONTA'
  | 'NA_FILA'
  | 'EM_SETUP'
  | 'PRODUZINDO'
  | 'PAUSADA'
  | 'FINALIZADA'
  | 'BLOQUEADA'
  | 'COM_PROBLEMA';

export type OpStatus = 
  | 'PDF_RECEBIDO'
  | 'EM_LEITURA'
  | 'REVISAO_PCP'
  | 'ROTEIRO_CRIADO'
  | 'PROGRAMADA'
  | 'EM_PRODUCAO'
  | 'PAUSADA'
  | 'AGUARDANDO_PROCESSO'
  | 'PRODUCAO_CONCLUIDA'
  | 'EXPEDICAO'
  | 'FINALIZADA'
  | 'ATRASADA';

/** Como o cordao e aplicado: pela propria maquina de corte e solda ou em posto manual. */
export type CordMode = 'AUTOMATICO' | 'MANUAL' | 'NENHUM' | 'NAO_IDENTIFICADO';

export type ProductionUnit = 'UNIDADES' | 'METROS' | 'PECAS' | 'QUILOS';

export type SystemSectorCode =
  | 'ADMIN'
  | 'PCP'
  | 'REFILE'
  | 'FLEXOGRAFIA'
  | 'ESTAMPARIA'
  | 'CORTE_SOLDA'
  | 'ALCA'
  | 'CORDAO_MANUAL'
  | 'COSTURA'
  | 'TERCEIRIZADO'
  | 'EXPEDICAO';

export interface SectorDefinition {
  code: SystemSectorCode;
  name: string;
  description: string;
  iconName?: string;
  defaultProcessIds?: string[];
}

export interface User {
  id: string; // UUID imutavel preservado no historico
  name: string;
  login: string; // login/username de acesso
  username?: string; // alias para login
  passwordHash?: string; // hash SHA-256 com salt
  passwordSalt?: string; // salt unico
  sectors?: SystemSectorCode[]; // funcoes / setores autorizados (multi-setor)
  role: UserRole;
  jobTitle: string;
  sector: string;
  authorizedMachineIds: string[];
  assignedMachineNames?: string[];
  shift: 'TURNO_1' | 'TURNO_2' | 'TURNO_3' | 'GERAL';
  isActive: boolean; // ativo ou desativado
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
  avatar?: string;
}

export interface MachineSession {
  machineId: string;
  machineName: string;
  machineCode?: string;
  machineSector?: string;
  operatorId: string;
  operatorName: string;
  operatorLogin: string;
  role?: string;
  authorizedMachineIds?: string[];
  loginTime: string;
}

export interface MachineOpRecommendation {
  isRecommended: boolean;
  recommendedMachineId: string;
  recommendedMachineName: string;
  isBlocked: boolean;
  blockReason?: string;
  isCompatible: boolean;
}

export interface UserAuthSession {
  user: User;
  token: string;
  loginTimestamp: string;
  activeSector?: SystemSectorCode;
}

export interface LoginAttemptRecord {
  username: string;
  failedAttempts: number;
  lastAttemptTimestamp: number;
  blockedUntil?: number;
}

export interface ProcessType {
  id: string;
  name: string;
  code: string;
  description: string;
  defaultUnit: ProductionUnit;
  requiresColorSetup?: boolean;
  requiresWeldSetup?: boolean;
  standardSetupMinutes: number;
}

export interface Machine {
  id: string;
  name: string;
  code: string;
  sector: string;
  processTypeId: string;
  status: MachineStatus;
  isActive: boolean;
  nominalSpeed: number; // e.g. units/hour or meters/min
  productionUnit: ProductionUnit;
  compatibleProducts: string[]; // product IDs or '*'
  compatibleMaterials: string[];
  grammageRange: { min: number; max: number };
  widthRange: { min: number; max: number };
  limitations?: string;
  
  // Estrutura de Capacidades (Regras de Roteamento Dinamico)
  capabilities?: {
    permiteVisor?: boolean;
    permiteSemVisor?: boolean;
    permiteAlcaVazada?: boolean;
    tamanhoMinimo?: 'PP' | 'P' | 'M' | 'G' | 'GG';
    tamanhoMaximo?: 'PP' | 'P' | 'M' | 'G' | 'GG';
    medidasExclusivas?: string[]; // ex: ['8x12']
    preferencias?: string[]; // ex: ['ALCA_VAZADA_SEM_VISOR']
    observacoes?: string;
  };
  
  currentShift: string;
  authorizedOperatorIds: string[];
  historicalEfficiencyFactor: number; // 0.0 - 1.0 (e.g. 0.88)
  currentOpId?: string;
  currentOperationId?: string;
  currentPauseReason?: string;
  pauseStartedAt?: string;
  activeOperatorId?: string;
  activeOperatorName?: string;
}

export interface ProductTechnicalSpec {
  id: string;
  code: string;
  name: string;
  family: string;
  material: string;
  allowedGrammages: number[];
  standardWidths: number[];
  standardHeights: number[];
  hasGusset: boolean; // fundo / sanfona
  allowedPrintingTypes: ('FLEXOGRAFIA' | 'SERIGRAFIA' | 'ESTAMPARIA' | 'SEM_IMPRESSAO')[];
  defaultProcessSequence: string[]; // processTypeIds in typical order
  compatibleMachineIds: string[];
  unit: ProductionUnit;
  manufacturingRules: string[];
  requiresHandle: boolean;
  handleTypes?: ('FITA' | 'VAZADA' | 'CORDÃO' | 'NENHUMA')[];
  requiresDrawstring: boolean; // cordão
  requiresVisor: boolean;
  requiresWelding: boolean;
  requiresCutting: boolean;
}

export interface RoutingRule {
  id: string;
  name: string;
  description: string;
  conditionType: 'HAS_PRINTING' | 'PRINT_TYPE' | 'HAS_HANDLE' | 'HAS_DRAWSTRING' | 'HAS_VISOR' | 'MATERIAL_TYPE' | 'CUSTOM';
  conditionValue: string;
  action: 'INSERT_PROCESS' | 'SET_MACHINE_TYPE' | 'REQUIRE_STEP';
  targetProcessTypeId: string;
  insertPosition: 'BEFORE' | 'AFTER' | 'AT_INDEX';
  relativeToProcessTypeId?: string;
  isActive: boolean;
}

export interface OpAttachedImage {
  id: string;
  type: 'foto_produto' | 'layout_aprovado' | 'arte_frente' | 'arte_verso' | 'desenho_tecnico' | 'referencia' | 'documento_geral';
  label: string;
  urlOrBase64: string;
  mimeType?: string;
  assignedStages: string[];
  isPrimaryLayout?: boolean;
}

export interface ExtractedOpData {
  numeroOp: string;
  numeroPedido: string;
  cliente: string;
  produtoNome: string;
  codigoProduto: string;
  modelo: string;
  quantidade: number;
  unidade: ProductionUnit;
  material: string;
  gramatura: number;
  corMaterial: string;
  larguraMm: number;
  alturaMm: number;
  fundoMm: number;
  medidasFormatadas: string;
  tamanho?: string;
  tipoImpressao: 'FLEXOGRAFIA' | 'SERIGRAFIA' | 'ESTAMPARIA' | 'SEM_IMPRESSAO' | 'NAO_IDENTIFICADO';
  numeroCores: number;
  impressaoFrente: string;
  impressaoVerso: string;
  personalizacao: string;
  tipoAlca: 'FITA' | 'VAZADA' | 'CORDAO' | 'NENHUMA' | 'NAO_IDENTIFICADO';
  usoCordao: boolean;
  /** Cordao automatico (na maquina) ou manual (posto proprio). Ambiguo vai para o PCP. */
  tipoCordao?: CordMode;
  /** Produto confirmado pelo PCP na revisao; vence a identificacao automatica. */
  produtoConfirmadoPcp?: string;
  /** Produto sugerido pela IA na leitura do PDF. O PCP pode trocar antes de liberar. */
  produtoSugeridoIa?: string;
  /** Marcado quando a OP exige costura (Sacola Box). */
  necessitaCostura?: boolean;
  /** Marcado quando a fabricacao inicial e terceirizada (Saquinho de Algodao). */
  necessitaTerceirizacao?: boolean;
  usoVisor: boolean;
  acabamentos: string[];
  observacoesTecnicas: string;
  prazoEntrega: string; // ISO date string
  confiancaLeitura: {
    geral: number; // 0 - 100
    numeroOp: number;
    cliente: number;
    produto: number;
    quantidade: number;
    gramatura: number;
    medidas: number;
    tipoImpressao: number;
    prazo: number;
  };
  inconsistencias?: string[];
  precisaRevisaoPcp: boolean;
  rawText?: string;
  images?: OpAttachedImage[];
  // Referência Visual Oficial do Layout e Foto Principal
  opFileName?: string;
  op_file?: string;
  layout_file?: string;
  layoutStatus?: 'COMPLETO' | 'LAYOUT_PENDENTE' | 'ORDEM_DE_PRODUCAO_PENDENTE';
  layout_status?: 'COMPLETO' | 'LAYOUT_PENDENTE' | 'ORDEM_DE_PRODUCAO_PENDENTE';
  layoutImage?: string;
  layoutPreviewImage?: string;
  productThumbnail?: string;
  productThumbnailStatus?: 'available' | 'missing' | 'needs_validation';
  layoutCropBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  layoutFileName?: string;
  suggestedRoute?: any[];
  machineCandidates?: any[];
  routingExplanation?: string[];
  missingInformation?: string[];
  structured?: any;
}

export interface OperationStep {
  id: string;
  opId: string;
  sequenceIndex: number;
  processTypeId: string;
  processName: string;
  assignedMachineId?: string | null;
  /** true quando nenhuma máquina compatível foi encontrada: exige alocação manual do PCP. */
  needsMachineAllocation?: boolean;
  assignedMachineName: string;
  status: OperationStatus;
  isManual?: boolean;
  responsibleUser?: string;
  responsibleSector?: string;
  hasCord?: boolean;
  has_cord?: boolean;
  
  // Quantities & Loss Propagation Rule
  plannedQuantity: number;
  receivedQuantity: number; // Released by previous step
  producedQuantity: number;
  lossQuantity: number;
  goodQuantity: number; // produced - loss
  unit: ProductionUnit;
  
  lossReason?: string;
  lossObservation?: string;
  lossClassification?: LossClassification;
  lossDestination?: LossDestination;
  reworkQuantity?: number;
  heldQuantity?: number;
  
  // Timings
  estimatedDurationMinutes: number;
  estimatedMinutes?: number;
  plannedStartTime?: string;
  actualStartTime?: string;
  plannedEndTime?: string;
  actualEndTime?: string;
  totalPauseMinutes: number;
  actualMinutes?: number;
  
  activeOperatorId?: string;
  activeOperatorName?: string;
  
  // Reivindicação / Seleção Atômica de Máquina (Corte e Solda)
  claimedByMachineId?: string | null;
  claimedByMachineName?: string;
  claimedByOperatorId?: string;
  claimedByOperatorName?: string;
  claimedAt?: string;
  
  technicalSpecsNote?: string;
}

export interface ProductionOrder {
  id: string;
  opNumber: string;
  orderNumber: string;
  client: string;
  productId: string;
  productName: string;
  productCode: string;
  
  targetQuantity: number;
  currentGoodQuantity: number;
  totalLosses: number;
  unit: ProductionUnit;
  
  material: string;
  grammage: number;
  color: string;
  dimensions: {
    width: number;
    height: number;
    gusset: number;
  };
  
  printing: {
    type: string;
    colorsCount: number;
    front: string;
    back: string;
  };
  
  handleType: string;
  hasDrawstring: boolean;
  /** Como o cordao sera aplicado nesta OP. Aparece na ficha da OP. */
  cordMode?: CordMode;
  /** Tipo de produto resolvido pelas regras de roteiro (SACOLA_BOX, ECOBAG_ALGODAO, ...). */
  productKey?: string;
  hasVisor: boolean;
  technicalNotes: string;
  
  deadline: string; // ISO date string
  estimatedCompletionDate: string;
  safetyMarginHours: number;
  priority: PriorityLevel;
  manualPriorityOverride?: boolean;
  
  status: OpStatus;
  currentStepIndex: number;
  steps: OperationStep[];
  
  createdAt: string;
  completedAt?: string;
  createdBy: string;
  /** Carimbo da última alteração. Usado para resolver conflito entre dispositivos. */
  updatedAt?: string;
  sourcePdfName?: string;
  opFileName?: string;
  op_file?: string;
  layout_file?: string;
  layoutStatus?: 'COMPLETO' | 'LAYOUT_PENDENTE' | 'ORDEM_DE_PRODUCAO_PENDENTE';
  layout_status?: 'COMPLETO' | 'LAYOUT_PENDENTE' | 'ORDEM_DE_PRODUCAO_PENDENTE';
  extractedConfidence?: number;
  revisionNotes?: string;
  layoutImage?: string;
  layoutImages?: OpAttachedImage[];
  // Referência Visual Oficial do Layout e Foto Principal da Sacola/Saco
  layoutPreviewImage?: string;
  productThumbnail?: string;
  productThumbnailStatus?: 'available' | 'missing' | 'needs_validation';
  layoutCropBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  layoutFileName?: string;
  aiAnalysis?: {
    model: string;
    provider: string;
    confidence: number;
    warnings?: string[];
    explanation?: string[];
  };
}

export interface PauseLog {
  id: string;
  operationId: string;
  opId: string;
  machineId: string;
  operatorId: string;
  operatorName: string;
  reason: string;
  startedAt: string;
  endedAt?: string;
  durationMinutes?: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  entityType: 'OP' | 'OPERATION' | 'MACHINE' | 'ROUTING' | 'CONFIG';
  entityId: string;
  details: string;
  previousValue?: string;
  newValue?: string;
  ipOrDevice?: string;
}

export interface FactoryAlert {
  id: string;
  timestamp: string;
  type: 'PRIORITY_ESCALATED' | 'MACHINE_STOPPED' | 'HIGH_LOSS' | 'TIME_OVERDUE' | 'PCP_REVISION_REQUIRED' | 'BLOCKED_QUEUE' | 'MAINTENANCE_REQUIRED';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  targetMachineId?: string;
  targetOpId?: string;
  isRead: boolean;
}


// Rotulos operacionais dos estados da maquina - Dossie de Funcionamento cap. 9.1
export const MACHINE_STATUS_LABELS: Record<MachineStatus, string> = {
  DISPONIVEL: 'Aguardando',
  SETUP: 'Setup',
  PRODUZINDO: 'Produzindo',
  PAUSADA: 'Pausada',
  MANUTENCAO: 'Manutenção',
  LEGADO: 'Inativa / Legado',
  QUALIDADE: 'Qualidade',
  INATIVA: 'Inativa',
};

export const LOSS_CLASSIFICATION_LABELS: Record<LossClassification, string> = {
  REFUGO: 'Refugo',
  RETRABALHO: 'Retrabalho',
  SOBRA_REAPROVEITAVEL: 'Sobra reaproveitável',
  TOCO: 'Toco',
  QUARENTENA: 'Quarentena',
};

export const LOSS_DESTINATION_LABELS: Record<LossDestination, string> = {
  DESCARTE: 'Descarte',
  RETORNO_ETAPA: 'Retorno para etapa anterior',
  ESTOQUE_SOBRA: 'Estoque de sobra / toco',
  AGUARDANDO_DECISAO: 'Aguardando decisão',
  CONCESSAO: 'Liberado por concessão',
};
