import {
  ProcessType,
  Machine,
  ProductTechnicalSpec,
  RoutingRule,
  User,
  ProductionOrder,
  AuditLogEntry,
  FactoryAlert,
  SystemSectorCode,
  CordMode
} from '../types/mes';
import { hashPassword } from '../utils/authCrypto';

export const SECTOR_DEFINITIONS = [
  { code: 'ADMIN' as SystemSectorCode, name: 'Administração Geral', description: 'Acesso total, gestão de usuários, relatórios e configurações' },
  { code: 'PCP' as SystemSectorCode, name: 'PCP (Planejamento & Controle)', description: 'Leitura de OPs, programação, filas de produção e roteamento' },
  { code: 'REFILE' as SystemSectorCode, name: 'Refile', description: 'Corte e refilamento longitudinal de bobinas de TNT' },
  { code: 'FLEXOGRAFIA' as SystemSectorCode, name: 'Flexografia', description: 'Impressão rotativa contínua em bobinas' },
  { code: 'ESTAMPARIA' as SystemSectorCode, name: 'Estamparia & Serigrafia', description: 'Impressão localizada, sublimação e Carrossel' },
  { code: 'CORTE_SOLDA' as SystemSectorCode, name: 'Corte e Solda', description: 'Solda ultrassônica, corte e acabamento lateral' },
  { code: 'ALCA' as SystemSectorCode, name: 'Alça & Acabamento', description: 'Colocação de alça fita, vazada e passagem de cordão' },
  { code: 'CORDAO_MANUAL' as SystemSectorCode, name: 'Cordão Manual', description: 'Aplicação manual de cordão em posto próprio, após o corte e solda' },
  { code: 'COSTURA' as SystemSectorCode, name: 'Costura', description: 'Costura estrutural da sacola box antes da alça' },
  { code: 'TERCEIRIZADO' as SystemSectorCode, name: 'Terceirizado', description: 'Recebimento e conferência de lote produzido fora da fábrica' },
  { code: 'EXPEDICAO' as SystemSectorCode, name: 'Expedição & Qualidade', description: 'Conferência técnica final, embalagem e expedição' },
];

const DEFAULT_SALT = 'bellatop_seed_salt_2026';
const HASH_ADMIN = hashPassword('admin123', DEFAULT_SALT);
const HASH_STANDARD = hashPassword('123456', DEFAULT_SALT);

export const INITIAL_PROCESS_TYPES: ProcessType[] = [
  {
    id: 'proc_bobina',
    code: 'BOB',
    name: 'Bobina / Matéria-Prima',
    description: 'Separação e conferência da matéria-prima (TNT, bobina, laminado)',
    defaultUnit: 'METROS',
    standardSetupMinutes: 10,
  },
  {
    id: 'proc_refile',
    code: 'REF',
    name: 'Refile',
    description: 'Ajuste de largura e corte longitudinal de bobinas',
    defaultUnit: 'METROS',
    standardSetupMinutes: 20,
  },
  {
    id: 'proc_flexografia',
    code: 'FLX',
    name: 'Flexografia',
    description: 'Impressão contínua em bobina (1 a 4 cores)',
    defaultUnit: 'METROS',
    requiresColorSetup: true,
    standardSetupMinutes: 45,
  },
  {
    id: 'proc_serigrafia',
    code: 'SRG',
    name: 'Serigrafia',
    description: 'Impressão manual/semiautomática em tela com cura UV ou estufa',
    defaultUnit: 'UNIDADES',
    requiresColorSetup: true,
    standardSetupMinutes: 35,
  },
  {
    id: 'proc_estamparia',
    code: 'EST',
    name: 'Estamparia',
    description: 'Gravação térmica ou sublimação localizada',
    defaultUnit: 'UNIDADES',
    standardSetupMinutes: 25,
  },
  {
    id: 'proc_gravura',
    code: 'GRV',
    name: 'Gravura / Clichê',
    description: 'Preparação e montagem de clichês para impressão',
    defaultUnit: 'UNIDADES',
    standardSetupMinutes: 30,
  },
  {
    id: 'proc_corte',
    code: 'CRT',
    name: 'Corte',
    description: 'Corte transversal das folhas na medida exata do produto',
    defaultUnit: 'UNIDADES',
    standardSetupMinutes: 15,
  },
  {
    id: 'proc_passar_fio',
    code: 'FIO',
    name: 'Cordão Manual',
    description: 'Aplicação manual do cordão, em posto próprio, depois do corte e solda',
    defaultUnit: 'UNIDADES',
    standardSetupMinutes: 10,
  },
  {
    id: 'proc_carrossel',
    code: 'CRS',
    name: 'Carrossel Automático',
    description: 'Montagem automática com solda ultrassônica, dobras e acabamento',
    defaultUnit: 'UNIDADES',
    requiresWeldSetup: true,
    standardSetupMinutes: 40,
  },
  {
    id: 'proc_solda',
    code: 'CS',
    name: 'Corte e Solda',
    description: 'Fechamento lateral, solda de fundo e corte simultâneos',
    defaultUnit: 'UNIDADES',
    requiresWeldSetup: true,
    standardSetupMinutes: 20,
  },
  {
    id: 'proc_colocar_alca',
    code: 'ALC',
    name: 'Colocar Alça',
    description: 'Fixação e solda de alça fita ou alça vazada reforçada',
    defaultUnit: 'UNIDADES',
    standardSetupMinutes: 20,
  },
  {
    id: 'proc_acabamento',
    code: 'ACB',
    name: 'Acabamento & Revisão',
    description: 'Inspeção de qualidade, dobra, remoção de rebarbas e contagem',
    defaultUnit: 'UNIDADES',
    standardSetupMinutes: 10,
  },
  {
    id: 'proc_costura',
    code: 'COS',
    name: 'Costura',
    description: 'Costura estrutural da sacola box antes da aplicação da alça',
    defaultUnit: 'UNIDADES',
    standardSetupMinutes: 15,
  },
  {
    id: 'proc_terceirizado',
    code: 'TER',
    name: 'Produção Terceirizada',
    description: 'Etapa executada fora da fábrica; o posto registra o recebimento do lote pronto',
    defaultUnit: 'UNIDADES',
    standardSetupMinutes: 0,
  },
  {
    id: 'proc_qualidade',
    code: 'QLD',
    name: 'Qualidade / Conferência',
    description: 'Conferência de especificação e quantidade antes da expedição - Dossiê cap. 6, etapa 8',
    defaultUnit: 'UNIDADES',
    standardSetupMinutes: 5,
  },
  {
    id: 'proc_expedicao',
    code: 'EXP',
    name: 'Expedição & Embalagem',
    description: 'Embalagem final em fardos/caixas, etiquetagem e liberação de envio',
    defaultUnit: 'UNIDADES',
    standardSetupMinutes: 15,
  },
];

export const INITIAL_MACHINES: Machine[] = [
  {
    id: 'REFILADEIRA_01',
    code: 'REF-01',
    name: 'Refiladeira',
    sector: 'Refile',
    processTypeId: 'proc_refile',
    status: 'DISPONIVEL',
    isActive: true,
    nominalSpeed: 0,
    productionUnit: 'METROS',
    compatibleProducts: ['*'],
    compatibleMaterials: ['TNT', 'Polietileno', 'TNT Laminado'],
    grammageRange: { min: 0, max: 9999 },
    widthRange: { min: 0, max: 9999 },
    currentShift: 'TURNO_1',
    authorizedOperatorIds: ['user_op_refile'],
    historicalEfficiencyFactor: 0.92,
    capabilities: { observacoes: 'A VALIDAR NA FÁBRICA' }
  },
  {
    id: 'FLEXOGRAFIA_01',
    code: 'FLX-01',
    name: 'Flexografia',
    sector: 'Flexografia',
    processTypeId: 'proc_flexografia',
    status: 'DISPONIVEL',
    isActive: true,
    nominalSpeed: 0,
    productionUnit: 'METROS',
    compatibleProducts: ['*'],
    compatibleMaterials: ['TNT', 'Polietileno', 'TNT Laminado'],
    grammageRange: { min: 0, max: 9999 },
    widthRange: { min: 0, max: 9999 },
    currentShift: 'TURNO_1',
    authorizedOperatorIds: ['user_op_flexo'],
    historicalEfficiencyFactor: 0.88,
    capabilities: { observacoes: 'A VALIDAR NA FÁBRICA' }
  },
  {
    id: 'm1-corte-solda',
    code: 'CS-01',
    name: 'Máquina 1',
    sector: 'Corte e Solda',
    processTypeId: 'proc_solda',
    status: 'INATIVA',
    isActive: false,
    nominalSpeed: 0,
    productionUnit: 'UNIDADES',
    compatibleProducts: ['*'],
    compatibleMaterials: ['TNT', 'Plástico'],
    grammageRange: { min: 0, max: 9999 },
    widthRange: { min: 0, max: 9999 },
    limitations: 'Máquina Parada / Indisponível (Sem login operacional ou produção)',
    currentShift: 'TURNO_1',
    authorizedOperatorIds: [],
    historicalEfficiencyFactor: 0.0,
    capabilities: {
      permiteVisor: false,
      permiteSemVisor: false,
      permiteAlcaVazada: false
    }
  },
  {
    id: 'm2-corte-solda',
    code: 'CS-02',
    name: 'Máquina 2',
    sector: 'Corte e Solda',
    processTypeId: 'proc_solda',
    status: 'DISPONIVEL',
    isActive: true,
    nominalSpeed: 0,
    productionUnit: 'UNIDADES',
    compatibleProducts: ['*'],
    compatibleMaterials: ['TNT'],
    grammageRange: { min: 0, max: 9999 },
    widthRange: { min: 0, max: 9999 },
    currentShift: 'TURNO_1',
    authorizedOperatorIds: ['user_op_corte_solda'],
    historicalEfficiencyFactor: 0.90,
    capabilities: {
      permiteVisor: true,
      permiteSemVisor: true,
      permiteAlcaVazada: true,
      tamanhoMinimo: 'PP',
      tamanhoMaximo: 'M'
    }
  },
  {
    id: 'm3-corte-solda',
    code: 'CS-03',
    name: 'Máquina 3',
    sector: 'Corte e Solda',
    processTypeId: 'proc_solda',
    status: 'DISPONIVEL',
    isActive: true,
    nominalSpeed: 0,
    productionUnit: 'UNIDADES',
    compatibleProducts: ['*'],
    compatibleMaterials: ['TNT'],
    grammageRange: { min: 0, max: 9999 },
    widthRange: { min: 0, max: 9999 },
    currentShift: 'TURNO_1',
    authorizedOperatorIds: ['user_op_corte_solda'],
    historicalEfficiencyFactor: 0.85,
    capabilities: {
      permiteVisor: true,
      permiteSemVisor: true,
      permiteAlcaVazada: true,
      tamanhoMinimo: 'PP',
      tamanhoMaximo: 'GG',
      medidasExclusivas: ['8x12']
    }
  },
  {
    id: 'm4-corte-solda',
    code: 'CS-04',
    name: 'Máquina 4',
    sector: 'Corte e Solda',
    processTypeId: 'proc_solda',
    status: 'DISPONIVEL',
    isActive: true,
    nominalSpeed: 0,
    productionUnit: 'UNIDADES',
    compatibleProducts: ['*'],
    compatibleMaterials: ['TNT'],
    grammageRange: { min: 0, max: 9999 },
    widthRange: { min: 0, max: 9999 },
    currentShift: 'TURNO_1',
    authorizedOperatorIds: ['user_op_corte_solda'],
    historicalEfficiencyFactor: 0.88,
    capabilities: {
      permiteVisor: false,
      permiteSemVisor: true,
      permiteAlcaVazada: true,
      preferencias: ['ALCA_VAZADA_SEM_VISOR'],
      tamanhoMinimo: 'P',
      tamanhoMaximo: 'GG'
    }
  },
  {
    id: 'CARROSSEL_01',
    code: 'CRS-01',
    name: 'Carrossel',
    sector: 'Estamparia / Serigrafia',
    processTypeId: 'proc_serigrafia',
    status: 'DISPONIVEL',
    isActive: true,
    nominalSpeed: 0,
    productionUnit: 'UNIDADES',
    compatibleProducts: ['*'],
    compatibleMaterials: ['TNT', 'TNT Laminado', 'Algodão Cru'],
    grammageRange: { min: 0, max: 9999 },
    widthRange: { min: 0, max: 9999 },
    currentShift: 'TURNO_1',
    authorizedOperatorIds: ['user_op_serigrafia'],
    historicalEfficiencyFactor: 0.85,
    capabilities: { observacoes: 'A VALIDAR NA FÁBRICA' }
  },
  {
    id: 'CARROSSEL_PEQUENA_01',
    code: 'CRS-02',
    name: 'Carrossel Pequena',
    sector: 'Estamparia / Serigrafia',
    processTypeId: 'proc_serigrafia',
    status: 'DISPONIVEL',
    isActive: true,
    nominalSpeed: 0,
    productionUnit: 'UNIDADES',
    compatibleProducts: ['*'],
    compatibleMaterials: ['TNT', 'TNT Laminado', 'Algodão Cru'],
    grammageRange: { min: 0, max: 9999 },
    widthRange: { min: 0, max: 9999 },
    currentShift: 'TURNO_1',
    authorizedOperatorIds: ['user_op_serigrafia'],
    historicalEfficiencyFactor: 0.85,
    capabilities: { observacoes: 'A VALIDAR NA FÁBRICA' }
  },
  {
    id: 'workstation_proc_colocar_alca',
    code: 'ALC-01',
    name: 'Posto de Alça & Acabamento',
    sector: 'Alça e Acabamento',
    processTypeId: 'proc_colocar_alca',
    status: 'DISPONIVEL',
    isActive: true,
    nominalSpeed: 0,
    productionUnit: 'UNIDADES',
    compatibleProducts: ['*'],
    compatibleMaterials: ['TNT', 'TNT Laminado', 'Algodão Cru'],
    grammageRange: { min: 0, max: 9999 },
    widthRange: { min: 0, max: 9999 },
    currentShift: 'TURNO_1',
    authorizedOperatorIds: ['*'],
    historicalEfficiencyFactor: 0.9,
    capabilities: { observacoes: 'Posto manual de aplicação de alça fita e acabamento' }
  },
  {
    id: 'workstation_proc_cordao_manual',
    code: 'CDM-01',
    name: 'Posto de Cordão Manual',
    sector: 'Cordão Manual',
    processTypeId: 'proc_passar_fio',
    status: 'DISPONIVEL',
    isActive: true,
    nominalSpeed: 0,
    productionUnit: 'UNIDADES',
    compatibleProducts: ['*'],
    compatibleMaterials: ['TNT', 'TNT Laminado', 'Algodão Cru'],
    grammageRange: { min: 0, max: 9999 },
    widthRange: { min: 0, max: 9999 },
    currentShift: 'TURNO_1',
    authorizedOperatorIds: ['*'],
    historicalEfficiencyFactor: 0.9,
    capabilities: { observacoes: 'Posto manual de aplicação de cordão, depois do corte e solda' }
  },
  {
    id: 'workstation_proc_costura',
    code: 'COS-01',
    name: 'Posto de Costura',
    sector: 'Costura',
    processTypeId: 'proc_costura',
    status: 'DISPONIVEL',
    isActive: true,
    nominalSpeed: 0,
    productionUnit: 'UNIDADES',
    compatibleProducts: ['*'],
    compatibleMaterials: ['TNT', 'TNT Laminado', 'Algodão Cru'],
    grammageRange: { min: 0, max: 9999 },
    widthRange: { min: 0, max: 9999 },
    currentShift: 'TURNO_1',
    authorizedOperatorIds: ['*'],
    historicalEfficiencyFactor: 0.9,
    capabilities: { observacoes: 'Costura estrutural da sacola box' }
  },
  {
    id: 'workstation_proc_terceirizado',
    code: 'TER-01',
    name: 'Recebimento Terceirizado',
    sector: 'Terceirizado',
    processTypeId: 'proc_terceirizado',
    status: 'DISPONIVEL',
    isActive: true,
    nominalSpeed: 0,
    productionUnit: 'UNIDADES',
    compatibleProducts: ['*'],
    compatibleMaterials: ['TNT', 'TNT Laminado', 'Algodão Cru'],
    grammageRange: { min: 0, max: 9999 },
    widthRange: { min: 0, max: 9999 },
    currentShift: 'TURNO_1',
    authorizedOperatorIds: ['*'],
    historicalEfficiencyFactor: 0.9,
    capabilities: { observacoes: 'Registro do lote produzido fora da fábrica' }
  },
  {
    id: 'workstation_proc_expedicao',
    code: 'EXP-01',
    name: 'Expedição & Embalagem',
    sector: 'Expedição',
    processTypeId: 'proc_expedicao',
    status: 'DISPONIVEL',
    isActive: true,
    nominalSpeed: 0,
    productionUnit: 'UNIDADES',
    compatibleProducts: ['*'],
    compatibleMaterials: ['TNT', 'TNT Laminado', 'Algodão Cru'],
    grammageRange: { min: 0, max: 9999 },
    widthRange: { min: 0, max: 9999 },
    currentShift: 'TURNO_1',
    authorizedOperatorIds: ['*'],
    historicalEfficiencyFactor: 0.9,
    capabilities: { observacoes: 'Conferência final, embalagem e liberação para coleta' }
  }
];

export const INITIAL_PRODUCTS: ProductTechnicalSpec[] = [
  {
    id: 'prod_sacola_alca_fita',
    code: 'BT-SAF-01',
    name: 'Sacola Alça Fita',
    family: 'Sacolas Alça Fita',
    material: 'TNT',
    allowedGrammages: [60, 70, 80, 100],
    standardWidths: [300, 350, 400, 450, 500],
    standardHeights: [350, 400, 450, 500],
    hasGusset: false,
    allowedPrintingTypes: ['FLEXOGRAFIA', 'SERIGRAFIA', 'SEM_IMPRESSAO'],
    defaultProcessSequence: ['proc_refile', 'proc_flexografia'],
    compatibleMachineIds: [],
    unit: 'UNIDADES',
    manufacturingRules: [
      'Se houver impressão contínua em bobina, passar por Flexografia antes do corte',
      'Solda ultrassônica lateral e reforço de alça fita',
    ],
    requiresHandle: true,
    handleTypes: ['FITA'],
    requiresDrawstring: false,
    requiresVisor: false,
    requiresWelding: true,
    requiresCutting: true,
  },
  {
    id: 'prod_sacola_alca_fita_fundo',
    code: 'BT-SAF-FD-02',
    name: 'Sacola Alça Fita com Fundo',
    family: 'Sacolas Alça Fita',
    material: 'TNT',
    allowedGrammages: [70, 80, 100, 120],
    standardWidths: [350, 400, 450, 500],
    standardHeights: [350, 400, 450, 500],
    hasGusset: true,
    allowedPrintingTypes: ['FLEXOGRAFIA', 'SERIGRAFIA'],
    defaultProcessSequence: ['proc_refile', 'proc_flexografia'],
    compatibleMachineIds: [],
    unit: 'UNIDADES',
    manufacturingRules: [
      'Sanfona de fundo automática montada no Carrossel',
      'Alça fita soldada termicamente nos dois lados',
    ],
    requiresHandle: true,
    handleTypes: ['FITA'],
    requiresDrawstring: false,
    requiresVisor: false,
    requiresWelding: true,
    requiresCutting: true,
  },
  {
    id: 'prod_sacola_alca_vazada',
    code: 'BT-SAV-03',
    name: 'Sacola Alça Vazada',
    family: 'Sacolas Alça Vazada',
    material: 'TNT',
    allowedGrammages: [60, 70, 80],
    standardWidths: [200, 250, 300, 350, 400],
    standardHeights: [300, 350, 400, 450],
    hasGusset: false,
    allowedPrintingTypes: ['FLEXOGRAFIA', 'SERIGRAFIA', 'SEM_IMPRESSAO'],
    defaultProcessSequence: ['proc_refile', 'proc_flexografia'],
    compatibleMachineIds: [],
    unit: 'UNIDADES',
    manufacturingRules: [
      'Corte de boca de palhaço (alça vazada) integrado no carrossel',
    ],
    requiresHandle: true,
    handleTypes: ['VAZADA'],
    requiresDrawstring: false,
    requiresVisor: false,
    requiresWelding: true,
    requiresCutting: true,
  },
  {
    id: 'prod_sacola_alca_vazada_fundo',
    code: 'BT-SAV-FD-04',
    name: 'Sacola Alça Vazada com Fundo',
    family: 'Sacolas Alça Vazada',
    material: 'TNT',
    allowedGrammages: [70, 80, 100],
    standardWidths: [300, 350, 400, 450],
    standardHeights: [350, 400, 450, 500],
    hasGusset: true,
    allowedPrintingTypes: ['FLEXOGRAFIA', 'SERIGRAFIA'],
    defaultProcessSequence: ['proc_refile', 'proc_flexografia'],
    compatibleMachineIds: [],
    unit: 'UNIDADES',
    manufacturingRules: [
      'Alça vazada estampada com sanfona inferior',
    ],
    requiresHandle: true,
    handleTypes: ['VAZADA'],
    requiresDrawstring: false,
    requiresVisor: false,
    requiresWelding: true,
    requiresCutting: true,
  },
  {
    id: 'prod_saco_com_visor',
    code: 'BT-SCV-05',
    name: 'Saco com Visor',
    family: 'Sacos e Envelopes',
    material: 'TNT + Cristal PVC',
    allowedGrammages: [60, 70, 80],
    standardWidths: [200, 250, 300, 400],
    standardHeights: [300, 350, 400, 500],
    hasGusset: false,
    allowedPrintingTypes: ['SERIGRAFIA', 'FLEXOGRAFIA', 'SEM_IMPRESSAO'],
    defaultProcessSequence: ['proc_refile', 'proc_serigrafia', 'proc_solda'],
    compatibleMachineIds: ['m1-corte-solda', 'm2-corte-solda', 'm3-corte-solda', 'm4-corte-solda'],
    unit: 'UNIDADES',
    manufacturingRules: [
      'Solda de filme cristal transparente no recorte do visor frontal',
      'Inserção de cordão duplo para fechamento',
    ],
    requiresHandle: false,
    handleTypes: ['CORDÃO'],
    requiresDrawstring: true,
    requiresVisor: true,
    requiresWelding: true,
    requiresCutting: true,
  },
  {
    id: 'prod_saco_sem_visor',
    code: 'BT-SSV-06',
    name: 'Saco sem Visor',
    family: 'Sacos e Envelopes',
    material: 'TNT',
    allowedGrammages: [45, 60, 70, 80],
    standardWidths: [150, 200, 250, 300, 400],
    standardHeights: [200, 250, 300, 400, 500],
    hasGusset: false,
    allowedPrintingTypes: ['SERIGRAFIA', 'FLEXOGRAFIA', 'SEM_IMPRESSAO'],
    defaultProcessSequence: ['proc_refile', 'proc_serigrafia', 'proc_solda'],
    compatibleMachineIds: ['m1-corte-solda', 'm2-corte-solda', 'm3-corte-solda', 'm4-corte-solda'],
    unit: 'UNIDADES',
    manufacturingRules: [
      'Solda lateral ultrassônica com bainha superior para cordão',
    ],
    requiresHandle: false,
    handleTypes: ['CORDÃO'],
    requiresDrawstring: true,
    requiresVisor: false,
    requiresWelding: true,
    requiresCutting: true,
  },
  {
    id: 'prod_mochilinha',
    code: 'BT-MOC-07',
    name: 'Mochilinha',
    family: 'Mochilas e Sacos Promocionais',
    material: 'TNT',
    allowedGrammages: [70, 80, 100],
    standardWidths: [300, 350, 400],
    standardHeights: [380, 400, 450],
    hasGusset: false,
    allowedPrintingTypes: ['SERIGRAFIA', 'FLEXOGRAFIA'],
    defaultProcessSequence: ['proc_refile', 'proc_serigrafia', 'proc_solda'],
    compatibleMachineIds: ['m1-corte-solda', 'm2-corte-solda', 'm3-corte-solda', 'm4-corte-solda'],
    unit: 'UNIDADES',
    manufacturingRules: [
      'Ilhós ou terminal soldado nos cantos inferiores para cordão duplo de costas',
      'Passagem de fio de polipropileno 4mm',
    ],
    requiresHandle: false,
    handleTypes: ['CORDÃO'],
    requiresDrawstring: true,
    requiresVisor: false,
    requiresWelding: true,
    requiresCutting: true,
  },
  {
    id: 'prod_sacola_box',
    code: 'BT-SBX-10',
    name: 'Sacola Box',
    family: 'Sacolas Box Premium',
    material: 'TNT Laminado',
    allowedGrammages: [80, 100, 120],
    standardWidths: [300, 350, 400],
    standardHeights: [300, 350, 400],
    hasGusset: true,
    allowedPrintingTypes: ['FLEXOGRAFIA', 'SERIGRAFIA'],
    defaultProcessSequence: ['proc_refile', 'proc_flexografia', 'proc_solda'],
    compatibleMachineIds: ['m1-corte-solda', 'm2-corte-solda', 'm3-corte-solda', 'm4-corte-solda'],
    unit: 'UNIDADES',
    manufacturingRules: [
      'Solda de cantos retos para formato caixa tridimensional',
      'Alça de gorgurão ou fita reforçada com acabamento premium',
    ],
    requiresHandle: true,
    handleTypes: ['FITA'],
    requiresDrawstring: false,
    requiresVisor: false,
    requiresWelding: true,
    requiresCutting: true,
  },,
  {
    id: 'prod_sacola_presente',
    code: 'BT-SPR-01',
    name: 'Sacola de Presente',
    family: 'Presente',
    material: 'TNT',
    allowedGrammages: [60, 70, 80, 100],
    standardWidths: [200, 250, 300, 350],
    standardHeights: [250, 300, 350, 400],
    hasGusset: true,
    allowedPrintingTypes: ['FLEXOGRAFIA', 'SERIGRAFIA', 'SEM_IMPRESSAO'],
    defaultProcessSequence: ['proc_solda', 'proc_passar_fio', 'proc_colocar_alca'],
    compatibleMachineIds: [],
    unit: 'UNIDADES',
    manufacturingRules: ['Cordão sempre manual, aplicado antes da alça',
      'Alça fita aplicada no posto de acabamento'],
    requiresHandle: true,
    handleTypes: ['FITA'],
    requiresDrawstring: true,
    requiresVisor: false,
    requiresWelding: true,
    requiresCutting: true,
  },
  {
    id: 'prod_saco_presente',
    code: 'BT-SCP-01',
    name: 'Saco de Presente',
    family: 'Presente',
    material: 'TNT',
    allowedGrammages: [60, 70, 80],
    standardWidths: [150, 200, 250, 300],
    standardHeights: [200, 250, 300, 350],
    hasGusset: false,
    allowedPrintingTypes: ['FLEXOGRAFIA', 'SERIGRAFIA', 'SEM_IMPRESSAO'],
    defaultProcessSequence: ['proc_solda', 'proc_passar_fio'],
    compatibleMachineIds: [],
    unit: 'UNIDADES',
    manufacturingRules: ['Cordão sempre manual',
      'Não leva alça'],
    requiresHandle: false,
    requiresDrawstring: true,
    requiresVisor: false,
    requiresWelding: true,
    requiresCutting: true,
  },
  {
    id: 'prod_ecobag_algodao',
    code: 'BT-ECO-01',
    name: 'Ecobag de Algodão',
    family: 'Algodão',
    material: 'Algodão Cru',
    allowedGrammages: [0],
    standardWidths: [300, 350, 400],
    standardHeights: [400, 420, 450],
    hasGusset: false,
    allowedPrintingTypes: ['SERIGRAFIA', 'ESTAMPARIA'],
    defaultProcessSequence: ['proc_serigrafia', 'proc_expedicao'],
    compatibleMachineIds: [],
    unit: 'UNIDADES',
    manufacturingRules: ['Chega pronta de fornecedor: não passa por refile, flexografia, corte e solda ou costura',
      'Somente estamparia e expedição'],
    requiresHandle: false,
    requiresDrawstring: false,
    requiresVisor: false,
    requiresWelding: false,
    requiresCutting: false,
  },
  {
    id: 'prod_lixo_car',
    code: 'BT-LXC-01',
    name: 'Lixo Car',
    family: 'Automotivo',
    material: 'TNT',
    allowedGrammages: [40, 60, 80],
    standardWidths: [150, 180, 200],
    standardHeights: [200, 220, 250],
    hasGusset: false,
    allowedPrintingTypes: ['FLEXOGRAFIA', 'SERIGRAFIA', 'SEM_IMPRESSAO'],
    defaultProcessSequence: ['proc_solda'],
    compatibleMachineIds: [],
    unit: 'UNIDADES',
    manufacturingRules: ['Mesma lógica da sacola alça vazada: sem etapa de alça'],
    requiresHandle: false,
    requiresDrawstring: false,
    requiresVisor: false,
    requiresWelding: true,
    requiresCutting: true,
  },
  {
    id: 'prod_saquinho_algodao',
    code: 'BT-SQA-01',
    name: 'Saquinho de Algodão',
    family: 'Algodão',
    material: 'Algodão Cru',
    allowedGrammages: [0],
    standardWidths: [100, 150, 200, 250],
    standardHeights: [150, 200, 250, 300],
    hasGusset: false,
    allowedPrintingTypes: ['SERIGRAFIA', 'ESTAMPARIA'],
    defaultProcessSequence: ['proc_terceirizado', 'proc_serigrafia', 'proc_expedicao'],
    compatibleMachineIds: [],
    unit: 'UNIDADES',
    manufacturingRules: ['Fabricação inicial terceirizada fora da fábrica',
      'Após o recebimento segue para estamparia e expedição'],
    requiresHandle: false,
    requiresDrawstring: true,
    requiresVisor: false,
    requiresWelding: false,
    requiresCutting: false,
  }
];

export const INITIAL_ROUTING_RULES: RoutingRule[] = [
  {
    id: 'rule_flexo',
    name: 'Impressão Flexográfica',
    description: 'Adiciona etapa de Flexografia quando a OP indicar impressão contínua / flexográfica',
    conditionType: 'PRINT_TYPE',
    conditionValue: 'FLEXOGRAFIA',
    action: 'INSERT_PROCESS',
    targetProcessTypeId: 'proc_flexografia',
    insertPosition: 'AFTER',
    relativeToProcessTypeId: 'proc_refile',
    isActive: true,
  },
  {
    id: 'rule_serigrafia',
    name: 'Impressão Serigráfica',
    description: 'Adiciona etapa de Serigrafia em folhas cortadas quando a OP indicar serigrafia',
    conditionType: 'PRINT_TYPE',
    conditionValue: 'SERIGRAFIA',
    action: 'INSERT_PROCESS',
    targetProcessTypeId: 'proc_serigrafia',
    insertPosition: 'AFTER',
    relativeToProcessTypeId: 'proc_corte',
    isActive: true,
  },
  {
    id: 'rule_alca_fita',
    name: 'Aplicação de Alça Fita',
    description: 'Adiciona Colocar Alça se o produto utilizar alça fita',
    conditionType: 'HAS_HANDLE',
    conditionValue: 'FITA',
    action: 'INSERT_PROCESS',
    targetProcessTypeId: 'proc_colocar_alca',
    insertPosition: 'AFTER',
    relativeToProcessTypeId: 'proc_carrossel',
    isActive: true,
  },
];

export const INITIAL_USERS: User[] = [
  // 1. Administrador Principal (Acesso total a todas as funções, relatórios, OPs e gestão)
  {
    id: 'user_admin_root',
    name: 'Administrador Principal',
    login: 'admin',
    username: 'admin',
    passwordHash: HASH_ADMIN,
    passwordSalt: DEFAULT_SALT,
    sectors: ['ADMIN'],
    role: 'ADMIN',
    jobTitle: 'Administrador do Sistema MES',
    sector: 'Administração',
    authorizedMachineIds: ['*'],
    assignedMachineNames: ['Acesso Total ao Sistema'],
    shift: 'GERAL',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

export const INITIAL_ORDERS: ProductionOrder[] = [];

export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [];

export const INITIAL_ALERTS: FactoryAlert[] = [];



// =====================================================================
// REGRAS OFICIAIS DE ROTEIRO DE PRODUCAO
// Fonte unica usada pelo PCP (mesStore) e pelo motor do servidor (routingEngine).
// Regra mestra: REFILE **XOR** FLEXOGRAFIA. Flexografia e Carrossel nunca
// executam a mesma impressao na mesma OP.
// =====================================================================

export type PrintingPath = "FLEXOGRAFIA" | "CARROSSEL" | "SEM_IMPRESSAO" | "NAO_IDENTIFICADO";

export type { CordMode };

export type ProductKey =
  | "SACOLA_ALCA_FITA"
  | "SACOLA_ALCA_VAZADA"
  | "SACO_TNT"
  | "MOCHILINHA"
  | "SACOLA_PRESENTE"
  | "SACO_PRESENTE"
  | "SACOLA_BOX"
  | "ECOBAG_ALGODAO"
  | "LIXO_CAR"
  | "SAQUINHO_ALGODAO"
  | "NAO_IDENTIFICADO";

/** Marcas que sempre usam cordao manual, por regra comercial fixa. */
export const MANUAL_CORD_CLIENTS = ["arezzo", "anacapri", "sonho dos pes"];

export interface BlueprintStep {
  processTypeId: string;
  processName: string;
  sector: string;
}

export interface RouteBlueprintInput {
  productName?: string;
  productCode?: string;
  model?: string;
  client?: string;
  printingMethod?: string;
  handleType?: string;
  hasCord?: boolean;
  cordMode?: string;
  hasWindow?: boolean;
  /** Produto confirmado pelo PCP na tela de revisao. Vence a identificacao automatica. */
  productKeyOverride?: ProductKey | string;
}

export interface RouteBlueprint {
  productKey: ProductKey;
  productLabel: string;
  productCatalogId?: string;
  printingPath: PrintingPath;
  cordMode: CordMode;
  cordForcedByClient: boolean;
  requiresCordStep: boolean;
  requiresHandleStep: boolean;
  requiresSewing: boolean;
  requiresOutsourcing: boolean;
  steps: BlueprintStep[];
  processIds: string[];
  warnings: string[];
  needsPcpValidation: boolean;
}

const ROUTE_STEP_CATALOG: Record<string, BlueprintStep> = {
  proc_refile: { processTypeId: "proc_refile", processName: "Refile", sector: "Refile e Bobinagem" },
  proc_flexografia: { processTypeId: "proc_flexografia", processName: "Flexografia", sector: "Flexografia" },
  proc_serigrafia: { processTypeId: "proc_serigrafia", processName: "Estamparia / Carrossel", sector: "Estamparia" },
  proc_solda: { processTypeId: "proc_solda", processName: "Corte e Solda", sector: "Corte e Solda" },
  proc_passar_fio: { processTypeId: "proc_passar_fio", processName: "Cordão Manual", sector: "Cordão Manual" },
  proc_costura: { processTypeId: "proc_costura", processName: "Costura", sector: "Costura" },
  proc_colocar_alca: { processTypeId: "proc_colocar_alca", processName: "Colocar Alça / Acabamento", sector: "Acabamento" },
  proc_terceirizado: { processTypeId: "proc_terceirizado", processName: "Produção Terceirizada", sector: "Terceirizado" },
  proc_expedicao: { processTypeId: "proc_expedicao", processName: "Expedição & Embalagem", sector: "Expedição" },
};

interface ProductRule {
  label: string;
  catalogId?: string;
  flow: "PADRAO" | "ECOBAG" | "TERCEIRIZADO";
  handleStep: boolean;
  sewing: boolean;
  cordFixedManual: boolean;
}

const PRODUCT_RULES: Record<ProductKey, ProductRule> = {
  SACOLA_ALCA_FITA: { label: "Sacola Alça Fita", catalogId: "prod_sacola_alca_fita", flow: "PADRAO", handleStep: true, sewing: false, cordFixedManual: false },
  SACOLA_ALCA_VAZADA: { label: "Sacola Alça Vazada", catalogId: "prod_sacola_alca_vazada", flow: "PADRAO", handleStep: false, sewing: false, cordFixedManual: false },
  SACO_TNT: { label: "Saco de TNT", catalogId: "prod_saco_sem_visor", flow: "PADRAO", handleStep: false, sewing: false, cordFixedManual: false },
  MOCHILINHA: { label: "Mochilinha", catalogId: "prod_mochilinha", flow: "PADRAO", handleStep: false, sewing: false, cordFixedManual: true },
  SACOLA_PRESENTE: { label: "Sacola de Presente", catalogId: "prod_sacola_presente", flow: "PADRAO", handleStep: true, sewing: false, cordFixedManual: true },
  SACO_PRESENTE: { label: "Saco de Presente", catalogId: "prod_saco_presente", flow: "PADRAO", handleStep: false, sewing: false, cordFixedManual: true },
  SACOLA_BOX: { label: "Sacola Box", catalogId: "prod_sacola_box", flow: "PADRAO", handleStep: true, sewing: true, cordFixedManual: false },
  ECOBAG_ALGODAO: { label: "Ecobag de Algodão", catalogId: "prod_ecobag_algodao", flow: "ECOBAG", handleStep: false, sewing: false, cordFixedManual: false },
  LIXO_CAR: { label: "Lixo Car", catalogId: "prod_lixo_car", flow: "PADRAO", handleStep: false, sewing: false, cordFixedManual: false },
  SAQUINHO_ALGODAO: { label: "Saquinho de Algodão", catalogId: "prod_saquinho_algodao", flow: "TERCEIRIZADO", handleStep: false, sewing: false, cordFixedManual: false },
  NAO_IDENTIFICADO: { label: "Produto não identificado", flow: "PADRAO", handleStep: false, sewing: false, cordFixedManual: false },
};

function normalizeRouteText(value?: string): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/** Identifica o produto pelo que a OP traz escrito. Ambiguo devolve NAO_IDENTIFICADO. */
export function identifyProductKey(input: RouteBlueprintInput): ProductKey {
  const hay = normalizeRouteText([input.productName, input.model, input.productCode].join(" "));
  const handle = normalizeRouteText(input.handleType);

  if (!hay.trim()) return "NAO_IDENTIFICADO";
  if (hay.includes("saquinho") && hay.includes("algod")) return "SAQUINHO_ALGODAO";
  if (hay.includes("ecobag") || hay.includes("eco bag")) return "ECOBAG_ALGODAO";
  if (hay.includes("lixo car") || hay.includes("lixocar") || hay.includes("lixo de carro")) return "LIXO_CAR";
  if (hay.includes(" box") || hay.includes("sacola box") || hay.endsWith("box")) return "SACOLA_BOX";
  if (hay.includes("presente")) return hay.includes("sacola") ? "SACOLA_PRESENTE" : "SACO_PRESENTE";
  if (hay.includes("mochil")) return "MOCHILINHA";
  if (hay.includes("vazada")) return "SACOLA_ALCA_VAZADA";
  if (hay.includes("fita")) return "SACOLA_ALCA_FITA";
  if (hay.includes("saco")) return "SACO_TNT";
  if (hay.includes("sacola")) {
    if (handle === "vazada") return "SACOLA_ALCA_VAZADA";
    if (handle === "fita") return "SACOLA_ALCA_FITA";
  }
  return "NAO_IDENTIFICADO";
}

/** Caminho de impressao. Refile e Flexografia sao alternativos, nunca somados. */
export function resolvePrintingPath(printingMethod?: string): PrintingPath {
  const printing = normalizeRouteText(printingMethod);
  if (!printing) return "NAO_IDENTIFICADO";
  if (printing.includes("flexo")) return "FLEXOGRAFIA";
  if (
    printing.includes("serigraf") ||
    printing.includes("estampar") ||
    printing.includes("carross") ||
    printing.includes("silk")
  ) {
    return "CARROSSEL";
  }
  if (printing.includes("sem_impressao") || printing.includes("sem impressao") || printing.includes("liso")) {
    return "SEM_IMPRESSAO";
  }
  return "NAO_IDENTIFICADO";
}

/**
 * Monta o roteiro oficial da OP. Devolve tambem os avisos e se precisa do PCP.
 * Nada aqui inventa etapa: informacao critica ambigua vira REVISAO_PCP.
 */
export function buildRouteBlueprint(input: RouteBlueprintInput): RouteBlueprint {
  const warnings: string[] = [];
  let needsPcpValidation = false;

  const overrideKey = input.productKeyOverride as ProductKey | undefined;
  const productKey: ProductKey =
    overrideKey && overrideKey !== "NAO_IDENTIFICADO" && PRODUCT_RULES[overrideKey]
      ? overrideKey
      : identifyProductKey(input);

  if (productKey === "NAO_IDENTIFICADO") {
    needsPcpValidation = true;
    warnings.push("Produto não identificado com segurança na OP. O PCP precisa confirmar o tipo antes de liberar.");
  }

  const rule = PRODUCT_RULES[productKey];

  const printingPath = resolvePrintingPath(input.printingMethod);
  if (printingPath === "NAO_IDENTIFICADO" && rule.flow === "PADRAO") {
    needsPcpValidation = true;
    warnings.push("Tipo de impressão não identificado: o PCP precisa definir entre Flexografia e Carrossel antes de liberar.");
  }

  // ---- cordao: automatico (na propria maquina) x manual (posto proprio) ----
  const clientText = normalizeRouteText(input.client);
  const cordForcedByClient = MANUAL_CORD_CLIENTS.some((brand) => clientText.includes(brand));
  const declaredCord = normalizeRouteText(input.cordMode);
  const opIndicatesCord =
    Boolean(input.hasCord) || normalizeRouteText(input.handleType) === "cordao" || rule.cordFixedManual;

  let cordMode: CordMode;
  if (rule.cordFixedManual) {
    cordMode = "MANUAL";
  } else if (declaredCord.includes("manual")) {
    cordMode = "MANUAL";
  } else if (declaredCord.includes("automat")) {
    cordMode = "AUTOMATICO";
  } else if (declaredCord.includes("nenhum") || declaredCord.includes("sem")) {
    cordMode = "NENHUM";
  } else {
    cordMode = opIndicatesCord ? "NAO_IDENTIFICADO" : "NENHUM";
  }

  if (cordForcedByClient) {
    if (opIndicatesCord || cordMode !== "NENHUM") {
      cordMode = "MANUAL";
    } else {
      needsPcpValidation = true;
      warnings.push("Cliente com regra fixa de cordão manual, mas a OP não indica uso de cordão. Confirmar com o PCP.");
    }
  }

  if (cordMode === "NAO_IDENTIFICADO") {
    needsPcpValidation = true;
    warnings.push("A OP indica cordão, mas não informa se é automático (na máquina) ou manual (posto próprio).");
  }

  // ---- montagem do roteiro ----
  const processIds: string[] = [];

  if (rule.flow === "ECOBAG") {
    processIds.push("proc_serigrafia", "proc_expedicao");
  } else if (rule.flow === "TERCEIRIZADO") {
    processIds.push("proc_terceirizado", "proc_serigrafia", "proc_expedicao");
  } else {
    if (printingPath === "FLEXOGRAFIA") {
      processIds.push("proc_flexografia", "proc_solda");
    } else if (printingPath === "CARROSSEL") {
      processIds.push("proc_refile", "proc_solda", "proc_serigrafia");
    } else {
      processIds.push("proc_refile", "proc_solda");
    }

    if (rule.sewing) processIds.push("proc_costura");
    if (cordMode === "MANUAL") processIds.push("proc_passar_fio");
    if (rule.handleStep) processIds.push("proc_colocar_alca");
    processIds.push("proc_expedicao");
  }

  return {
    productKey,
    productLabel: rule.label,
    productCatalogId: rule.catalogId,
    printingPath,
    cordMode,
    cordForcedByClient,
    requiresCordStep: cordMode === "MANUAL",
    requiresHandleStep: rule.handleStep,
    requiresSewing: rule.sewing,
    requiresOutsourcing: rule.flow === "TERCEIRIZADO",
    steps: processIds.map((id) => ROUTE_STEP_CATALOG[id]).filter(Boolean),
    processIds,
    warnings,
    needsPcpValidation,
  };
}
