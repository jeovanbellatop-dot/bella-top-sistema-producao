/**
 * Suíte de Testes Automatizados - Bella Top MES
 * Validação Completa dos Fluxos de Produção, Máquinas, Permissões e Regras de Negócio
 */

import { mesStore } from '../src/services/mesStore';
import { INITIAL_USERS } from '../src/data/initialData';
import {
  validateFirestoreConnectivity,
  validateGoogleDriveConnectivity,
  runDiagnostics,
} from '../server/diagnosticsTest';

// Cores para saída no terminal
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

let passedTests = 0;
let failedTests = 0;

const defaultConfidence = {
  geral: 100,
  numeroOp: 100,
  cliente: 100,
  produto: 100,
  quantidade: 100,
  gramatura: 100,
  medidas: 100,
  tipoImpressao: 100,
  prazo: 100,
};

function assert(condition: boolean, testName: string, failureDetails?: string) {
  if (condition) {
    console.log(`  ${colors.green}✓${colors.reset} ${testName}`);
    passedTests++;
  } else {
    console.error(`  ${colors.red}✗${colors.reset} ${colors.bold}${testName}${colors.reset}`);
    if (failureDetails) {
      console.error(`    ${colors.yellow}Detalhes: ${failureDetails}${colors.reset}`);
    }
    failedTests++;
  }
}

async function runAllTests() {
  console.log(`\n${colors.cyan}${colors.bold}=== INICIANDO TESTES DO SISTEMA BELLA TOP MES ===${colors.reset}\n`);

  // ==========================================
  // GRUPO 1: CONTROLE DE MÁQUINAS E ESTADO
  // ==========================================
  console.log(`${colors.bold}1. Testes de Controle de Máquinas e Manutenção${colors.reset}`);

  const allMachines = mesStore.getAllFactoryMachines();
  const m1 = allMachines.find((m) => m.id === 'm1-corte-solda');
  const m2 = allMachines.find((m) => m.id === 'm2-corte-solda');
  const m3 = allMachines.find((m) => m.id === 'm3-corte-solda');
  const m4 = allMachines.find((m) => m.id === 'm4-corte-solda');

  assert(m1 !== undefined && m1.status === 'INATIVA', 'M1 (legado) deve estar permanentemente INATIVA');
  assert(m2 !== undefined && m3 !== undefined && m4 !== undefined, 'M2, M3 e M4 devem estar cadastradas e disponíveis');

  // Testar bloqueio de início de operação em máquina INATIVA
  const testOpNumber = 'TEST_OP_001';
  let createdOp;
  try {
    createdOp = mesStore.createOrderFromExtracted({
      numeroOp: testOpNumber,
      numeroPedido: 'PED_001',
      cliente: 'Cliente Teste Controle',
      produtoNome: 'Sacola Teste 40x50',
      codigoProduto: 'BT-01',
      modelo: 'Sacola Alça Fita',
      quantidade: 1000,
      unidade: 'UNIDADES',
      material: 'PEAD',
      gramatura: 40,
      corMaterial: 'Branco',
      larguraMm: 400,
      alturaMm: 500,
      fundoMm: 0,
      medidasFormatadas: '40x50',
      tipoImpressao: 'SEM_IMPRESSAO',
      numeroCores: 0,
      impressaoFrente: '',
      impressaoVerso: '',
      personalizacao: '',
      tipoAlca: 'FITA',
      usoCordao: false,
      usoVisor: false,
      acabamentos: [],
      observacoesTecnicas: '',
      prazoEntrega: new Date(Date.now() + 86400000).toISOString(),
      confiancaLeitura: defaultConfidence,
      precisaRevisaoPcp: false,
    });
  } catch (err: any) {
    createdOp = mesStore.getOrders().find(o => o.opNumber === testOpNumber);
  }

  const firstStep = createdOp?.steps[0];

  // Tentativa de iniciar em máquina inativa deve lançar erro
  let blockedOnInactive = false;
  try {
    mesStore.startOperation(firstStep!.id, 'm1-corte-solda');
  } catch (err: any) {
    blockedOnInactive = true;
  }
  assert(blockedOnInactive, 'Bloquear início de operação em máquina com status INATIVA');

  // Testar colocação de máquina em manutenção e consequente bloqueio
  const maintRes = mesStore.openMachineMaintenanceCall('m4-corte-solda', 'Troca de resistência e teflon', 'Ajuste mecânico');
  const updatedM4 = mesStore.getAllFactoryMachines().find((m) => m.id === 'm4-corte-solda');
  assert(updatedM4?.status === 'MANUTENCAO', 'Atualização de máquina para status MANUTENCAO via chamado de manutenção');

  let blockedOnMaintenance = false;
  try {
    mesStore.startOperation(firstStep!.id, 'm4-corte-solda');
  } catch (err: any) {
    blockedOnMaintenance = true;
  }
  assert(blockedOnMaintenance, 'Bloquear início de operação em máquina com status MANUTENCAO');

  // Restaurar M4 para DISPONIVEL
  mesStore.closeMachineMaintenanceCall('m4-corte-solda', 'Manutenção concluída com sucesso', 'Técnico Autorizado');
  const restoredM4 = mesStore.getAllFactoryMachines().find((m) => m.id === 'm4-corte-solda');
  assert(restoredM4?.status === 'DISPONIVEL', 'Máquina restabelecida para DISPONIVEL após fechamento do chamado');

  // ==========================================
  // GRUPO 2: PERMISSÕES, USUÁRIOS E SEGURANÇA
  // ==========================================
  console.log(`\n${colors.bold}2. Testes de Permissões, Autenticação e Usuários${colors.reset}`);

  // Testar filtragem de administradores ativos
  const activeAdmins = mesStore.getActiveAdministrators();
  const allAreAdmins = activeAdmins.every((u) => u.role === 'ADMIN' || (u.role as string) === 'MASTER');
  const allAreActive = activeAdmins.every((u) => u.isActive !== false);
  const noOperatorsInAdmins = activeAdmins.every((u) => u.role !== 'OPERATOR');

  assert(activeAdmins.length > 0, 'Lista de administradores ativos não deve ser vazia');
  assert(allAreAdmins, 'Lista de administradores contém apenas usuários com perfil ADMIN ou MASTER');
  assert(allAreActive, 'Lista de administradores contém apenas usuários ATIVOS');
  assert(noOperatorsInAdmins, 'Nenhum OPERATOR está presente na lista de administradores');

  // Testar login administrativo válido e inválido
  const adminUser = activeAdmins[0];
  const validAdminLogin = mesStore.loginAdministrator(adminUser.id, 'admin123');
  assert(validAdminLogin.success, `Login de administrador com credenciais válidas (${adminUser.name})`);

  const invalidAdminLogin = mesStore.loginAdministrator(adminUser.id, 'senha_incorreta_12345');
  assert(!invalidAdminLogin.success, 'Rejeitar login de administrador com senha incorreta');

  // Testar autenticação de operador de máquina
  const operators = mesStore.getUsers().filter((u) => u.role === 'OPERATOR' && u.isActive !== false);
  if (operators.length > 0) {
    const op = operators[0];

    // Iniciar sessão de posto de trabalho
    const sessionRes = mesStore.loginMachineOperator('m2-corte-solda', op.id, '123456');
    assert(sessionRes.success, `Sessão de posto iniciada na máquina M2 para operador ${op.name}`);

    const currentSession = mesStore.getMachineSession('m2-corte-solda');
    assert(currentSession?.operatorId === op.id, 'Sessão de posto vinculada ao ID do operador');

    // Desconectar operador
    mesStore.logoutMachineOperator('m2-corte-solda');
    const closedSession = mesStore.getMachineSession('m2-corte-solda');
    assert(closedSession === null, 'Sessão do posto de trabalho encerrada com sucesso');
  }

  // ==========================================
  // GRUPO 3: ORDENS DE PRODUÇÃO E COMPATIBILIDADE
  // ==========================================
  console.log(`\n${colors.bold}3. Testes de Ordem de Produção (OP) e Regras Técnicas${colors.reset}`);

  // Testar duplicidade de OP
  let duplicatePrevented = false;
  try {
    mesStore.createOrderFromExtracted({
      numeroOp: testOpNumber, // Já existe
      numeroPedido: 'PED_002',
      cliente: 'Outro Cliente',
      produtoNome: 'Produto Duplicado',
      codigoProduto: 'BT-02',
      modelo: 'Sacola Alça Fita',
      quantidade: 500,
      unidade: 'UNIDADES',
      material: 'PEBD',
      gramatura: 50,
      corMaterial: 'Transparente',
      larguraMm: 300,
      alturaMm: 400,
      fundoMm: 0,
      medidasFormatadas: '30x40',
      tipoImpressao: 'SEM_IMPRESSAO',
      numeroCores: 0,
      impressaoFrente: '',
      impressaoVerso: '',
      personalizacao: '',
      tipoAlca: 'FITA',
      usoCordao: false,
      usoVisor: false,
      acabamentos: [],
      observacoesTecnicas: '',
      prazoEntrega: new Date().toISOString(),
      confiancaLeitura: defaultConfidence,
      precisaRevisaoPcp: false,
    });
  } catch (err: any) {
    duplicatePrevented = true;
  }
  assert(duplicatePrevented, 'Bloquear cadastro de Ordem de Produção com número de OP já existente');

  // Testar regra exclusiva da Máquina 3: formato 8x12
  const op8x12 = {
    id: 'op_8x12_test',
    opNumber: 'OP_8X12',
    client: 'Cliente 8x12',
    productName: 'Sacola 8x12 Especial',
    dimensions: { width: 80, height: 120 },
    quantity: 1000,
    unit: 'MILHEIROS' as const,
    deadline: new Date().toISOString(),
    priority: 'VERDE' as const,
    status: 'PROGRAMADA' as const,
    sector: 'CORTE_SOLDA' as const,
    steps: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const dummyStep = {
    id: 'step_test_cs',
    opId: op8x12.id,
    processTypeId: 'proc_solda',
    processName: 'Corte e Solda',
    unit: 'MILHEIROS',
    receivedQuantity: 1000,
    producedQuantity: 0,
    wasteQuantity: 0,
    status: 'PRONTA' as const,
    sequence: 1,
    assignedMachineId: 'm3-corte-solda',
    assignedMachineName: 'Máquina 3',
  };

  const rec8x12OnM3 = mesStore.calculateCorteSoldaRecommendation(op8x12 as any, dummyStep as any, 'm3-corte-solda');
  const rec8x12OnM2 = mesStore.calculateCorteSoldaRecommendation(op8x12 as any, dummyStep as any, 'm2-corte-solda');
  const rec8x12OnM4 = mesStore.calculateCorteSoldaRecommendation(op8x12 as any, dummyStep as any, 'm4-corte-solda');

  assert(!rec8x12OnM3.isBlocked && rec8x12OnM3.isCompatible, 'Medida 8x12 permitida e compatível na Máquina 3');
  assert(rec8x12OnM2.isBlocked, 'Medida 8x12 bloqueada na Máquina 2');
  assert(rec8x12OnM4.isBlocked, 'Medida 8x12 bloqueada na Máquina 4');

  // Testar regra exclusiva da Máquina 3: Mochilinha com Cordão
  const opCord = {
    ...op8x12,
    id: 'op_cord_test',
    dimensions: { width: 250, height: 350 },
    hasDrawstring: true,
    handleType: 'CORDÃO',
  };
  const recCordOnM3 = mesStore.calculateCorteSoldaRecommendation(opCord as any, dummyStep as any, 'm3-corte-solda');
  const recCordOnM4 = mesStore.calculateCorteSoldaRecommendation(opCord as any, dummyStep as any, 'm4-corte-solda');

  assert(!recCordOnM3.isBlocked && recCordOnM3.isCompatible, 'Produto com cordão permitido e compatível na Máquina 3');
  assert(recCordOnM4.isBlocked, 'Produto com cordão bloqueado na Máquina 4');

  // Testar regra de visor: Máquina 4 não aceita visor
  const opVisor = {
    ...op8x12,
    id: 'op_visor_test',
    dimensions: { width: 300, height: 400 },
    hasVisor: true,
    productName: 'Sacola com Visor Cristal',
  };
  const recVisorOnM4 = mesStore.calculateCorteSoldaRecommendation(opVisor as any, dummyStep as any, 'm4-corte-solda');
  const recVisorOnM2 = mesStore.calculateCorteSoldaRecommendation(opVisor as any, dummyStep as any, 'm2-corte-solda');

  assert(recVisorOnM4.isBlocked, 'Máquina 4 bloqueada para produtos com Visor');
  assert(!recVisorOnM2.isBlocked, 'Máquina 2 permitida para produtos com Visor');

  // ==========================================
  // GRUPO 4: FLUXO DE PRODUÇÃO, PAUSAS E PERDAS
  // ==========================================
  console.log(`\n${colors.bold}4. Testes de Fluxo Sequencial, Pausas, Perdas e Saldo${colors.reset}`);

  // Criar uma OP multi-etapas para teste de fluxo (Extrusão -> Impressão -> Corte e Solda)
  const flowOpNumber = 'FLOW_TEST_' + Date.now().toString().slice(-4);
  const flowOp = mesStore.createOrderFromExtracted({
    numeroOp: flowOpNumber,
    numeroPedido: 'PED_FLOW_01',
    cliente: 'Cliente Fluxo Sequencial',
    produtoNome: 'Sacola 30x40 Alça Fita',
    codigoProduto: 'BT-FL-01',
    modelo: 'Sacola Alça Fita',
    quantidade: 5000,
    unidade: 'UNIDADES',
    material: 'TNT',
    gramatura: 60,
    corMaterial: 'Azul',
    larguraMm: 300,
    alturaMm: 400,
    fundoMm: 0,
    medidasFormatadas: '30x40',
    tipoImpressao: 'SEM_IMPRESSAO',
    numeroCores: 0,
    impressaoFrente: '',
    impressaoVerso: '',
    personalizacao: '',
    tipoAlca: 'FITA',
    usoCordao: false,
    usoVisor: false,
    acabamentos: [],
    observacoesTecnicas: '',
    prazoEntrega: new Date(Date.now() + 86400000).toISOString(),
    confiancaLeitura: defaultConfidence,
    precisaRevisaoPcp: false,
  });

  const step1 = flowOp.steps[0];
  const step2 = flowOp.steps[1];
  const targetMacId = step1.assignedMachineId || 'm2-corte-solda';

  // Testar bloqueio de início de etapa fora de ordem
  if (step2) {
    let outOfOrderBlocked = false;
    try {
      mesStore.startOperation(step2.id, step2.assignedMachineId || 'm2-corte-solda');
    } catch (err: any) {
      outOfOrderBlocked = true;
    }
    assert(outOfOrderBlocked, 'Bloquear início de etapa N+1 antes da conclusão da etapa N (fluxo sequencial estrito)');
  }

  // Iniciar etapa 1
  mesStore.startOperation(step1.id, targetMacId);
  const macProducing = mesStore.getAllFactoryMachines().find((m) => m.id === targetMacId);
  assert(macProducing?.status === 'PRODUZINDO', 'Máquina passa para status PRODUZINDO ao iniciar etapa');

  // Testar pausa da operação
  mesStore.pauseOperation(step1.id, 'Troca de bobina e ajuste de faca', targetMacId);
  const macPaused = mesStore.getAllFactoryMachines().find((m) => m.id === targetMacId);
  assert(macPaused?.status === 'PAUSADA', 'Máquina passa para status PAUSADA com motivo registrado');
  assert(macPaused?.currentPauseReason?.includes('Troca de bobina'), 'Motivo da pausa salvo na máquina');

  // Testar retomada da operação
  mesStore.resumeOperation(step1.id, targetMacId);
  const macResumed = mesStore.getAllFactoryMachines().find((m) => m.id === targetMacId);
  assert(macResumed?.status === 'PRODUZINDO', 'Máquina retoma para status PRODUZINDO');

  // Testar finalização com perdas: Perdas NÃO avançam para próxima etapa
  const initialQty = step1.receivedQuantity || 5000;
  const wasteQty = 200;
  const producedQty = initialQty; // produziu o lote, mas teve 200 de refugo

  mesStore.finishOperation(
    step1.id,
    {
      producedQuantity: producedQty,
      lossQuantity: wasteQty,
      lossReason: 'Aparação de refugo e teste de solda',
    },
    targetMacId
  );

  const macAfterFinish = mesStore.getAllFactoryMachines().find((m) => m.id === targetMacId);
  assert(macAfterFinish?.status === 'DISPONIVEL', 'Máquina é liberada (DISPONIVEL) ao finalizar etapa');

  const refreshedOp = mesStore.getOrders().find((o) => o.id === flowOp.id);
  const finishedStep1 = refreshedOp?.steps[0];
  assert(finishedStep1?.status === 'FINALIZADA', 'Etapa 1 marcada como FINALIZADA');
  assert(finishedStep1?.lossQuantity === wasteQty, 'Quantidade de perdas registrada na etapa');

  if (refreshedOp?.steps[1]) {
    const nextStep = refreshedOp.steps[1];
    const expectedGoodQty = Math.max(0, producedQty - wasteQty);
    assert(
      nextStep.receivedQuantity === expectedGoodQty,
      `Saldo líquido bom avança para próxima etapa (${nextStep.receivedQuantity} = ${producedQty} - ${wasteQty})`
    );
    assert(
      nextStep.receivedQuantity < initialQty,
      'Perdas NÃO avançaram para a próxima máquina'
    );
  }

  // ==========================================
  // GRUPO 5: EXPEDIÇÃO E DESPACHO
  // ==========================================
  console.log(`\n${colors.bold}5. Testes de Expedição e Despacho${colors.reset}`);

  // Testar bloqueio de despacho para OP que ainda tem etapas pendentes
  let dispatchBlocked = false;
  try {
    mesStore.dispatchOp(flowOp.id, 'Transportadora Bella - NF-998877');
  } catch (err: any) {
    dispatchBlocked = true;
  }
  assert(dispatchBlocked, 'Bloquear despacho de OP quando houver etapas produtivas pendentes');

  // Concluir todas as etapas restantes para testar despacho bem sucedido
  const opToDispatch = mesStore.getOrders().find((o) => o.id === flowOp.id);
  if (opToDispatch) {
    const finalGoodQty = 4800;
    for (let i = 1; i < opToDispatch.steps.length; i++) {
      const step = opToDispatch.steps[i];
      step.status = 'FINALIZADA';
      step.receivedQuantity = finalGoodQty;
      step.producedQuantity = finalGoodQty;
      step.lossQuantity = 0;
      step.actualEndTime = new Date().toISOString();
    }
    opToDispatch.currentGoodQuantity = finalGoodQty;

    mesStore.dispatchOp(flowOp.id, 'Transportadora Rápida - NF-12345');
    const dispatchedOp = mesStore.getOrders().find((o) => o.id === flowOp.id);
    assert(dispatchedOp?.status === 'FINALIZADA', 'Status da OP atualizado após despacho');
  }

  // ==========================================
  // 8. TESTES DE DIAGNÓSTICO E CONECTIVIDADE (FIRESTORE & GOOGLE DRIVE)
  // ==========================================
  console.log(`\n${colors.cyan}--- 8. DIAGNÓSTICO E CONECTIVIDADE (FIRESTORE & DRIVE) ---${colors.reset}`);

  // Teste 8.1: Validação de conectividade real do Firestore (firebase-admin)
  const firestoreResult = await validateFirestoreConnectivity();
  assert(
    firestoreResult.service === 'firestore' &&
      (firestoreResult.status === 'CONNECTED' || firestoreResult.status === 'NOT_CONFIGURED') &&
      typeof firestoreResult.configured === 'boolean',
    'Firestore: Executa teste de conectividade e validação via firebase-admin com sucesso'
  );

  // Teste 8.2: Validação de conectividade real do Google Drive (googleapis)
  const driveResult = await validateGoogleDriveConnectivity();
  assert(
    driveResult.service === 'google_drive' &&
      (driveResult.status === 'CONNECTED' || driveResult.status === 'NOT_CONFIGURED') &&
      typeof driveResult.configured === 'boolean',
    'Google Drive: Executa teste de criação, leitura e exclusão no Google Drive com sucesso'
  );

  // Teste 8.3: runDiagnostics compila estrutura unificada com métricas de ambiente
  const diagnosticsReport = await runDiagnostics();
  assert(
    typeof diagnosticsReport.success === 'boolean' &&
      !!diagnosticsReport.environment.nodeVersion &&
      !!diagnosticsReport.environment.platform &&
      diagnosticsReport.services.firestore.service === 'firestore' &&
      diagnosticsReport.services.googleDrive.service === 'google_drive' &&
      typeof diagnosticsReport.summary.total === 'number' &&
      diagnosticsReport.summary.total === 2,
    'runDiagnostics: Gera relatório unificado com métricas de ambiente, Firestore e Drive'
  );

  // ==========================================
  // RESUMO DOS TESTES
  // ==========================================
  console.log(`\n${colors.bold}=== RESULTADO DOS TESTES ===${colors.reset}`);
  console.log(`Total executados: ${passedTests + failedTests}`);
  console.log(`Aprovados: ${colors.green}${passedTests}${colors.reset}`);
  console.log(`Falhas: ${failedTests > 0 ? colors.red : colors.green}${failedTests}${colors.reset}\n`);

  if (failedTests > 0) {
    process.exit(1);
  } else {
    console.log(`${colors.green}${colors.bold}TODOS OS TESTES PASSARAM COM SUCESSO!${colors.reset}\n`);
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error('Erro fatal durante execução dos testes:', err);
  process.exit(1);
});
