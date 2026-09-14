const fs = require('fs');
let content = fs.readFileSync('src/data/initialData.ts', 'utf8');

// Ensure capabilities are properly set for those machines that need A VALIDAR NA FÁBRICA
// REFILADEIRA_01
content = content.replace(
  "id: 'REFILADEIRA_01',\n    code: 'REF-01',\n    name: 'Refiladeira',\n    sector: 'Refile',\n    processTypeId: 'proc_refile',\n    status: 'DISPONIVEL',\n    isActive: true,\n    nominalSpeed: 60,\n    productionUnit: 'METROS',\n    compatibleProducts: ['*'],\n    compatibleMaterials: ['TNT', 'Polietileno', 'TNT Laminado'],\n    grammageRange: { min: 40, max: 150 },\n    widthRange: { min: 200, max: 1400 },\n    currentShift: 'TURNO_1',\n    authorizedOperatorIds: ['user_op_refile'],\n    historicalEfficiencyFactor: 0.92,",
  "id: 'REFILADEIRA_01',\n    code: 'REF-01',\n    name: 'Refiladeira',\n    sector: 'Refile',\n    processTypeId: 'proc_refile',\n    status: 'DISPONIVEL',\n    isActive: true,\n    nominalSpeed: 60,\n    productionUnit: 'METROS',\n    compatibleProducts: ['*'],\n    compatibleMaterials: ['TNT', 'Polietileno', 'TNT Laminado'],\n    grammageRange: { min: 40, max: 150 },\n    widthRange: { min: 200, max: 1400 },\n    currentShift: 'TURNO_1',\n    authorizedOperatorIds: ['user_op_refile'],\n    historicalEfficiencyFactor: 0.92,\n    capabilities: { observacoes: 'A VALIDAR NA FÁBRICA' }"
);

// CARROSSEL_01
content = content.replace(
  "id: 'CARROSSEL_01',\n    code: 'CRS-01',\n    name: 'Carrossel',\n    sector: 'Estamparia / Serigrafia',\n    processTypeId: 'proc_serigrafia',\n    status: 'DISPONIVEL',\n    isActive: true,\n    nominalSpeed: 450,\n    productionUnit: 'UNIDADES',\n    compatibleProducts: ['*'],\n    compatibleMaterials: ['TNT', 'TNT Laminado', 'Algodão Cru'],\n    grammageRange: { min: 40, max: 200 },\n    widthRange: { min: 100, max: 800 },\n    currentShift: 'TURNO_1',\n    authorizedOperatorIds: ['user_op_serigrafia'],\n    historicalEfficiencyFactor: 0.85,",
  "id: 'CARROSSEL_01',\n    code: 'CRS-01',\n    name: 'Carrossel',\n    sector: 'Estamparia / Serigrafia',\n    processTypeId: 'proc_serigrafia',\n    status: 'DISPONIVEL',\n    isActive: true,\n    nominalSpeed: 450,\n    productionUnit: 'UNIDADES',\n    compatibleProducts: ['*'],\n    compatibleMaterials: ['TNT', 'TNT Laminado', 'Algodão Cru'],\n    grammageRange: { min: 40, max: 200 },\n    widthRange: { min: 100, max: 800 },\n    currentShift: 'TURNO_1',\n    authorizedOperatorIds: ['user_op_serigrafia'],\n    historicalEfficiencyFactor: 0.85,\n    capabilities: { observacoes: 'A VALIDAR NA FÁBRICA' }"
);

fs.writeFileSync('src/data/initialData.ts', content);
console.log('done fixing machines');
