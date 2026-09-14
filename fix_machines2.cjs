const fs = require('fs');
let content = fs.readFileSync('src/data/initialData.ts', 'utf8');

const newMachines = `export const INITIAL_MACHINES: Machine[] = [
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
    status: 'MANUTENCAO',
    isActive: false,
    nominalSpeed: 0,
    productionUnit: 'UNIDADES',
    compatibleProducts: ['*'],
    compatibleMaterials: ['TNT', 'Plástico'],
    grammageRange: { min: 0, max: 9999 },
    widthRange: { min: 0, max: 9999 },
    currentShift: 'TURNO_1',
    authorizedOperatorIds: ['user_op_corte_solda'],
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
  }
];`;

const startIdx = content.indexOf('export const INITIAL_MACHINES: Machine[] = [');
const endIdx = content.indexOf('export const INITIAL_PRODUCTS: ProductTechnicalSpec[] = [');

let newContent = content.substring(0, startIdx) + newMachines + '\n\n' + content.substring(endIdx);
fs.writeFileSync('src/data/initialData.ts', newContent);
console.log('done overriding machines');
