import { getFirestoreDb } from '../firebaseAdmin';
import type { ProductionOrder, OperationStep, PriorityLevel } from '../../src/types/mes';

/**
 * opsRepository
 * Coleções Firestore:
 * - ops/{opId} -> ProductionOrder sem o array steps
 * - ops/{opId}/etapas/{etapaId} -> OperationStep
 */

export type ProductionOrderWithoutSteps = Omit<ProductionOrder, 'steps'>;

export const opsRepository = {
  /**
   * Lista todas as OPs (sem steps)
   */
  async listOps(): Promise<ProductionOrderWithoutSteps[]> {
    const firestore = getFirestoreDb();
    const snapshot = await firestore.collection('ops').get();
    return snapshot.docs.map((doc) => doc.data() as ProductionOrderWithoutSteps);
  },

  /**
   * Busca uma OP pelo ID com seus steps carregados da subcoleção etapas
   */
  async getOpById(opId: string): Promise<ProductionOrder | null> {
    const firestore = getFirestoreDb();
    const opDoc = await firestore.collection('ops').doc(opId).get();
    if (!opDoc.exists) {
      return null;
    }

    const opData = opDoc.data() as ProductionOrderWithoutSteps;
    const stepsSnapshot = await firestore
      .collection('ops')
      .doc(opId)
      .collection('etapas')
      .orderBy('sequenceIndex', 'asc')
      .get();

    const steps = stepsSnapshot.docs.map((d) => d.data() as OperationStep);

    return {
      ...opData,
      steps,
    };
  },

  /**
   * Cria uma nova OP e opcionalmente suas etapas filhas
   */
  async createOp(order: ProductionOrder): Promise<ProductionOrder> {
    const firestore = getFirestoreDb();
    const { steps = [], ...opWithoutSteps } = order;

    const opRef = firestore.collection('ops').doc(order.id);
    await opRef.set(opWithoutSteps);

    if (steps.length > 0) {
      const batch = firestore.batch();
      for (const step of steps) {
        const stepRef = opRef.collection('etapas').doc(step.id);
        batch.set(stepRef, step);
      }
      await batch.commit();
    }

    return order;
  },

  /**
   * Atualiza dados da OP (sem steps)
   */
  async updateOp(opId: string, data: Partial<ProductionOrderWithoutSteps>): Promise<ProductionOrderWithoutSteps> {
    const firestore = getFirestoreDb();
    const opRef = firestore.collection('ops').doc(opId);
    await opRef.update(data);
    const updated = await opRef.get();
    return updated.data() as ProductionOrderWithoutSteps;
  },

  /**
   * Lista todas as etapas de uma OP
   */
  async listSteps(opId: string): Promise<OperationStep[]> {
    const firestore = getFirestoreDb();
    const stepsSnapshot = await firestore
      .collection('ops')
      .doc(opId)
      .collection('etapas')
      .orderBy('sequenceIndex', 'asc')
      .get();

    return stepsSnapshot.docs.map((d) => d.data() as OperationStep);
  },

  /**
   * Busca uma etapa específica
   */
  async getStep(opId: string, etapaId: string): Promise<OperationStep | null> {
    const firestore = getFirestoreDb();
    const stepDoc = await firestore
      .collection('ops')
      .doc(opId)
      .collection('etapas')
      .doc(etapaId)
      .get();

    if (!stepDoc.exists) {
      return null;
    }
    return stepDoc.data() as OperationStep;
  },

  /**
   * Cria uma nova etapa
   */
  async createStep(opId: string, step: OperationStep): Promise<OperationStep> {
    const firestore = getFirestoreDb();
    const stepRef = firestore
      .collection('ops')
      .doc(opId)
      .collection('etapas')
      .doc(step.id);

    await stepRef.set(step);
    return step;
  },

  /**
   * Atualiza uma etapa diretamente (quando fora de transação)
   */
  async updateStep(opId: string, etapaId: string, data: Partial<OperationStep>): Promise<OperationStep> {
    const firestore = getFirestoreDb();
    const stepRef = firestore
      .collection('ops')
      .doc(opId)
      .collection('etapas')
      .doc(etapaId);

    await stepRef.update(data);
    const updated = await stepRef.get();
    return updated.data() as OperationStep;
  },

  // =========================================================================
  // TRANSAÇÕES CONCORRENTES (runTransaction) COM VALIDAÇÃO DE ESTADO
  // =========================================================================

  /**
   * claimStep: Lê a etapa em transação.
   * Se claimedByMachineId já pertence a OUTRA máquina, retorna erro de conflito.
   * Senão, grava claimedByMachineId, claimedByOperatorId, claimedAt (e nomes se informados).
   */
  async claimStep(
    opId: string,
    etapaId: string,
    machineId: string,
    operatorId: string,
    extra?: { machineName?: string; operatorName?: string }
  ): Promise<OperationStep> {
    const firestore = getFirestoreDb();
    const stepRef = firestore.collection('ops').doc(opId).collection('etapas').doc(etapaId);

    return firestore.runTransaction(async (transaction) => {
      const stepDoc = await transaction.get(stepRef);
      if (!stepDoc.exists) {
        throw new Error(`Etapa ${etapaId} da OP ${opId} não foi encontrada.`);
      }

      const step = stepDoc.data() as OperationStep;

      // Se já reivindicada por outra máquina
      if (step.claimedByMachineId && step.claimedByMachineId !== machineId) {
        throw new Error(
          `Conflito de concorrência: a etapa ${step.processName || etapaId} já foi reivindicada pela máquina ${
            step.claimedByMachineName || step.claimedByMachineId
          }.`
        );
      }

      const nowIso = new Date().toISOString();
      const updates: Partial<OperationStep> = {
        claimedByMachineId: machineId,
        claimedByOperatorId: operatorId,
        claimedAt: nowIso,
      };

      if (extra?.machineName) updates.claimedByMachineName = extra.machineName;
      if (extra?.operatorName) updates.claimedByOperatorName = extra.operatorName;
      if (!step.assignedMachineId) {
        updates.assignedMachineId = machineId;
        if (extra?.machineName) updates.assignedMachineName = extra.machineName;
      }

      transaction.update(stepRef, updates);
      return { ...step, ...updates };
    });
  },

  /**
   * startStep: Valida em transação que a etapa pode ser iniciada (status PRONTA, NA_FILA ou PAUSADA).
   * Valida máquina alvo e atualiza etapa e OP para status de produção.
   */
  async startStep(
    opId: string,
    etapaId: string,
    machineId?: string,
    operatorId?: string,
    extra?: { operatorName?: string; machineName?: string }
  ): Promise<{ step: OperationStep; op: ProductionOrderWithoutSteps }> {
    const firestore = getFirestoreDb();
    const opRef = firestore.collection('ops').doc(opId);
    const stepRef = opRef.collection('etapas').doc(etapaId);

    return firestore.runTransaction(async (transaction) => {
      const opDoc = await transaction.get(opRef);
      if (!opDoc.exists) {
        throw new Error(`OP ${opId} não encontrada.`);
      }
      const opData = opDoc.data() as ProductionOrderWithoutSteps;

      if (opData.status === 'REVISAO_PCP') {
        throw new Error(`Operação bloqueada: a OP ${opData.opNumber} está sob revisão do PCP.`);
      }
      if (opData.status === 'FINALIZADA') {
        throw new Error(`Operação bloqueada: a OP ${opData.opNumber} já foi finalizada.`);
      }

      const stepDoc = await transaction.get(stepRef);
      if (!stepDoc.exists) {
        throw new Error(`Etapa ${etapaId} não encontrada.`);
      }
      const step = stepDoc.data() as OperationStep;

      // Validação de estado atual
      if (step.status === 'FINALIZADA') {
        throw new Error(`A etapa ${step.processName} já foi finalizada.`);
      }
      if (step.status === 'PRODUZINDO') {
        throw new Error(`A etapa ${step.processName} já se encontra em produção.`);
      }
      if (step.status === 'AGUARDANDO_ANTERIOR') {
        throw new Error(`A etapa ${step.processName} ainda aguarda liberação da etapa anterior.`);
      }

      const nowIso = new Date().toISOString();
      const stepUpdates: Partial<OperationStep> = {
        status: 'PRODUZINDO',
        actualStartTime: step.actualStartTime || nowIso,
      };

      if (machineId) stepUpdates.assignedMachineId = machineId;
      if (extra?.machineName) stepUpdates.assignedMachineName = extra.machineName;
      if (operatorId) stepUpdates.activeOperatorId = operatorId;
      if (extra?.operatorName) stepUpdates.activeOperatorName = extra.operatorName;

      const opUpdates: Partial<ProductionOrderWithoutSteps> = {
        status: 'EM_PRODUCAO',
        currentStepIndex: step.sequenceIndex,
      };

      transaction.update(stepRef, stepUpdates);
      transaction.update(opRef, opUpdates);

      return {
        step: { ...step, ...stepUpdates },
        op: { ...opData, ...opUpdates },
      };
    });
  },

  /**
   * pauseStep: Valida que a etapa está PRODUZINDO antes de pausar em transação.
   */
  async pauseStep(
    opId: string,
    etapaId: string,
    reason: string,
    operatorId?: string,
    extra?: { operatorName?: string }
  ): Promise<OperationStep> {
    if (!reason || !reason.trim()) {
      throw new Error('É obrigatório informar o motivo da pausa da operação.');
    }

    const firestore = getFirestoreDb();
    const opRef = firestore.collection('ops').doc(opId);
    const stepRef = opRef.collection('etapas').doc(etapaId);

    return firestore.runTransaction(async (transaction) => {
      const stepDoc = await transaction.get(stepRef);
      if (!stepDoc.exists) {
        throw new Error(`Etapa ${etapaId} não encontrada.`);
      }
      const step = stepDoc.data() as OperationStep;

      if (step.status !== 'PRODUZINDO') {
        throw new Error(
          `Não é possível pausar a etapa "${step.processName}" porque seu status atual é "${step.status}".`
        );
      }

      const stepUpdates: Partial<OperationStep> = {
        status: 'PAUSADA',
      };
      if (operatorId) stepUpdates.activeOperatorId = operatorId;
      if (extra?.operatorName) stepUpdates.activeOperatorName = extra.operatorName;

      transaction.update(stepRef, stepUpdates);
      return { ...step, ...stepUpdates };
    });
  },

  /**
   * resumeStep: Valida que a etapa está PAUSADA antes de retomar em transação.
   */
  async resumeStep(
    opId: string,
    etapaId: string,
    operatorId?: string,
    extra?: { operatorName?: string }
  ): Promise<OperationStep> {
    const firestore = getFirestoreDb();
    const opRef = firestore.collection('ops').doc(opId);
    const stepRef = opRef.collection('etapas').doc(etapaId);

    return firestore.runTransaction(async (transaction) => {
      const stepDoc = await transaction.get(stepRef);
      if (!stepDoc.exists) {
        throw new Error(`Etapa ${etapaId} não encontrada.`);
      }
      const step = stepDoc.data() as OperationStep;

      if (step.status !== 'PAUSADA') {
        throw new Error(
          `Não é possível retomar a etapa "${step.processName}" porque ela não está pausada (status: ${step.status}).`
        );
      }

      const stepUpdates: Partial<OperationStep> = {
        status: 'PRODUZINDO',
      };
      if (operatorId) stepUpdates.activeOperatorId = operatorId;
      if (extra?.operatorName) stepUpdates.activeOperatorName = extra.operatorName;

      transaction.update(stepRef, stepUpdates);
      transaction.update(opRef, { status: 'EM_PRODUCAO' });

      return { ...step, ...stepUpdates };
    });
  },

  /**
   * finishStep: Valida e finaliza a etapa em transação.
   * Aplica a REGRA CRÍTICA DE PERDAS:
   * Quantidade Boa = Quantidade Produzida - Perdas.
   * Libera a próxima etapa (sequenceIndex + 1) com status 'PRONTA' e receivedQuantity = Quantidade Boa!
   */
  async finishStep(
    opId: string,
    etapaId: string,
    data: {
      producedQuantity: number;
      lossQuantity: number;
      lossReason?: string;
      observation?: string;
      lossClassification?: any;
      lossDestination?: any;
      reworkQuantity?: number;
      heldQuantity?: number;
    },
    operatorId?: string,
    extra?: { operatorName?: string }
  ): Promise<{ step: OperationStep; nextStep?: OperationStep; op: ProductionOrderWithoutSteps }> {
    const producedQuantity = Number(data.producedQuantity) || 0;
    const lossQuantity = Number(data.lossQuantity) || 0;

    if (producedQuantity <= 0) {
      throw new Error('A quantidade produzida deve ser maior que zero.');
    }
    if (lossQuantity < 0) {
      throw new Error('A quantidade de perda não pode ser negativa.');
    }
    if (lossQuantity > producedQuantity) {
      throw new Error(
        `A quantidade de perda (${lossQuantity}) não pode exceder a quantidade produzida (${producedQuantity}).`
      );
    }
    if (lossQuantity > 0 && (!data.lossReason || !data.lossReason.trim())) {
      throw new Error('É obrigatório informar o motivo da perda quando houver refugo.');
    }

    const goodQuantity = producedQuantity - lossQuantity;
    const nowIso = new Date().toISOString();

    const firestore = getFirestoreDb();
    const opRef = firestore.collection('ops').doc(opId);
    const stepRef = opRef.collection('etapas').doc(etapaId);

    return firestore.runTransaction(async (transaction) => {
      const opDoc = await transaction.get(opRef);
      if (!opDoc.exists) {
        throw new Error(`OP ${opId} não encontrada.`);
      }
      const opData = opDoc.data() as ProductionOrderWithoutSteps;

      const stepDoc = await transaction.get(stepRef);
      if (!stepDoc.exists) {
        throw new Error(`Etapa ${etapaId} não encontrada.`);
      }
      const step = stepDoc.data() as OperationStep;

      if (step.status === 'FINALIZADA') {
        throw new Error(`A etapa ${step.processName} já se encontra finalizada.`);
      }

      // Lê todas as etapas para identificar a próxima etapa da sequência
      const allStepsSnapshot = await transaction.get(
        opRef.collection('etapas').orderBy('sequenceIndex', 'asc')
      );
      const allSteps = allStepsSnapshot.docs.map((d) => d.data() as OperationStep);

      const currentIndex = allSteps.findIndex((s) => s.id === etapaId);
      const nextStep = currentIndex >= 0 && currentIndex < allSteps.length - 1 ? allSteps[currentIndex + 1] : null;

      // 1. Atualiza etapa atual
      const stepUpdates: Partial<OperationStep> = {
        status: 'FINALIZADA',
        producedQuantity,
        lossQuantity,
        goodQuantity,
        lossReason: data.lossReason,
        lossObservation: data.observation,
        lossClassification: data.lossClassification,
        lossDestination: data.lossDestination,
        reworkQuantity: data.reworkQuantity,
        heldQuantity: data.heldQuantity,
        actualEndTime: nowIso,
      };
      if (operatorId) stepUpdates.activeOperatorId = operatorId;
      if (extra?.operatorName) stepUpdates.activeOperatorName = extra.operatorName;

      transaction.update(stepRef, stepUpdates);

      // 2. Atualiza próxima etapa com propagação estrita de saldo líquido bom
      let updatedNextStep: OperationStep | undefined = undefined;
      if (nextStep) {
        const nextStepRef = opRef.collection('etapas').doc(nextStep.id);
        const nextUpdates: Partial<OperationStep> = {
          status: 'PRONTA',
          receivedQuantity: goodQuantity,
          plannedQuantity: goodQuantity,
        };
        transaction.update(nextStepRef, nextUpdates);
        updatedNextStep = { ...nextStep, ...nextUpdates };
      }

      // 3. Atualiza dados agregados da OP
      const totalLosses = (opData.totalLosses || 0) + lossQuantity;
      const isLastStep = !nextStep;
      const opUpdates: Partial<ProductionOrderWithoutSteps> = {
        totalLosses,
        currentGoodQuantity: goodQuantity,
        currentStepIndex: nextStep ? nextStep.sequenceIndex : step.sequenceIndex,
        status: isLastStep ? 'PRODUCAO_CONCLUIDA' : 'EM_PRODUCAO',
      };
      if (isLastStep) {
        opUpdates.completedAt = nowIso;
      }

      transaction.update(opRef, opUpdates);

      return {
        step: { ...step, ...stepUpdates },
        nextStep: updatedNextStep,
        op: { ...opData, ...opUpdates },
      };
    });
  },

  /**
   * transferStepMachine: Transfere a máquina de uma etapa em transação.
   * Valida que a etapa não está PRODUZINDO (deve estar pausada ou pronta/na_fila).
   */
  async transferStepMachine(
    opId: string,
    etapaId: string,
    newMachineId: string,
    newMachineName: string
  ): Promise<OperationStep> {
    const firestore = getFirestoreDb();
    const stepRef = firestore.collection('ops').doc(opId).collection('etapas').doc(etapaId);

    return firestore.runTransaction(async (transaction) => {
      const stepDoc = await transaction.get(stepRef);
      if (!stepDoc.exists) {
        throw new Error(`Etapa ${etapaId} não encontrada.`);
      }
      const step = stepDoc.data() as OperationStep;

      if (step.status === 'PRODUZINDO') {
        throw new Error(
          `Bloqueio de reatribuição: a etapa "${step.processName}" está em andamento (PRODUZINDO). Pause a operação antes de transferir.`
        );
      }

      const stepUpdates: Partial<OperationStep> = {
        assignedMachineId: newMachineId,
        assignedMachineName: newMachineName,
        claimedByMachineId: newMachineId,
        claimedByMachineName: newMachineName,
      };

      transaction.update(stepRef, stepUpdates);
      return { ...step, ...stepUpdates };
    });
  },

  // =========================================================================
  // FILA DA MÁQUINA (getMachineQueue)
  // Espelha fielmente a lógica de mesStore.ts:
  // Busca todas as ops e suas subcoleções etapas com assignedMachineId === machineId.
  // Filtra status: PRODUZINDO, PAUSADA, PRONTA, NA_FILA, AGUARDANDO_ANTERIOR.
  // Ordena: PRODUZINDO primeiro, depois por prioridade (VERMELHO > AMARELO > VERDE),
  // e desempate por deadline mais próximo.
  // =========================================================================
  async getMachineQueue(machineId: string): Promise<Array<{ order: ProductionOrder; step: OperationStep }>> {
    const firestore = getFirestoreDb();

    // 1. Busca todas as OPs
    const opsSnapshot = await firestore.collection('ops').get();
    const allOps = opsSnapshot.docs.map((d) => d.data() as ProductionOrderWithoutSteps);

    const queue: Array<{ order: ProductionOrder; step: OperationStep }> = [];

    // 2. Para cada OP, busca as etapas associadas a esta máquina
    for (const op of allOps) {
      if (op.status === 'FINALIZADA') continue;

      const stepsSnapshot = await firestore
        .collection('ops')
        .doc(op.id)
        .collection('etapas')
        .where('assignedMachineId', '==', machineId)
        .get();

      if (stepsSnapshot.empty) continue;

      const fullStepsSnapshot = await firestore
        .collection('ops')
        .doc(op.id)
        .collection('etapas')
        .orderBy('sequenceIndex', 'asc')
        .get();

      const allOpSteps = fullStepsSnapshot.docs.map((d) => d.data() as OperationStep);
      const fullOrder: ProductionOrder = {
        ...op,
        steps: allOpSteps,
      };

      for (const stepDoc of stepsSnapshot.docs) {
        const step = stepDoc.data() as OperationStep;
        if (
          step.status === 'PRODUZINDO' ||
          step.status === 'PAUSADA' ||
          step.status === 'PRONTA' ||
          step.status === 'NA_FILA' ||
          step.status === 'AGUARDANDO_ANTERIOR'
        ) {
          queue.push({ order: fullOrder, step });
        }
      }
    }

    // 3. Ordenação idêntica à getMachineQueue de mesStore.ts
    const priorityWeight: Record<PriorityLevel, number> = {
      VERMELHO: 3,
      AMARELO: 2,
      VERDE: 1,
    };

    queue.sort((a, b) => {
      // Produzindo sempre primeiro
      if (a.step.status === 'PRODUZINDO' && b.step.status !== 'PRODUZINDO') return -1;
      if (b.step.status === 'PRODUZINDO' && a.step.status !== 'PRODUZINDO') return 1;

      // Maior prioridade primeiro (VERMELHO > AMARELO > VERDE)
      const pDiff = (priorityWeight[b.order.priority] || 0) - (priorityWeight[a.order.priority] || 0);
      if (pDiff !== 0) return pDiff;

      // Prazo de entrega mais próximo primeiro
      const timeA = a.order.deadline ? new Date(a.order.deadline).getTime() : 0;
      const timeB = b.order.deadline ? new Date(b.order.deadline).getTime() : 0;
      return timeA - timeB;
    });

    return queue;
  },
};
