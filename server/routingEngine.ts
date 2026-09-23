import { buildRouteBlueprint } from '../src/data/initialData';
import type { BlueprintStep } from '../src/data/initialData';

export interface MachineCandidate {
  id: string;
  name: string;
  sector: string;
  isCompatible: boolean;
  incompatibilityReason?: string;
  isPreferred?: boolean;
  score: number;
}

export interface SuggestedStep {
  sequenceIndex: number;
  processTypeId: string;
  processName: string;
  sector: string;
  assignedOperatorName: string;
  assignedOperatorRole: string;
  suggestedMachineId?: string | null;
  suggestedMachineName: string;
  isMachineAvailable: boolean;
  waitingCompatibleMachine?: boolean;
  estimatedMinutes: number;
  eligibleMachines: MachineCandidate[];
  requiredImageTypes: string[];
  isManual?: boolean;
  hasCord?: boolean;
}

/**
 * Validador e Motor de Roteamento Determinístico Bella Top.
 * Aplica as regras industriais estritas independentemente de alucinações da IA.
 */
export class RoutingEngine {
  public static computeRoute(op: {
    opNumber: string;
    product: string;
    model: string;
    material: string;
    gsm: number;
    size?: string;
    width?: number;
    height?: number;
    bottom?: number;
    quantity: number;
    handleType: string;
    hasWindow: boolean;
    hasCord: boolean;
    printingMethod: string;
    printingColors?: number;
    finishing?: string[];
    /** Cliente/marca da OP: usado nas regras fixas de cordao manual. */
    client?: string;
    /** AUTOMATICO | MANUAL | NENHUM | NAO_IDENTIFICADO */
    cordMode?: string;
  }): {
    steps: SuggestedStep[];
    warnings: string[];
    needsPcpValidation: boolean;
    explanation: string[];
  } {
    const steps: SuggestedStep[] = [];
    const warnings: string[] = [];
    const explanation: string[] = [];
    let needsPcpValidation = false;

    // Normalização dos dados
    const printMethod = (op.printingMethod || '').toUpperCase();
    const handle = (op.handleType || '').toUpperCase();
    const isAlcaVazada = handle === 'VAZADA' || op.model.toLowerCase().includes('vazada');
    const isAlcaFita = handle === 'FITA' || op.model.toLowerCase().includes('fita');
    const hasCordLegacy = op.hasCord || handle === 'CORDAO' || op.model.toLowerCase().includes('mochil') || op.model.toLowerCase().includes('cordao');
    const hasWindow = op.hasWindow || op.model.toLowerCase().includes('visor') || op.model.toLowerCase().includes('janela');
    
    // Normalização do tamanho
    let size = (op.size || '').toUpperCase().trim();
    if (!size) {
      if (op.width && op.height) {
        if (op.width === 8 && op.height === 12) size = '8x12';
        else if (op.width <= 250) size = 'P';
        else if (op.width <= 350) size = 'M';
        else if (op.width <= 450) size = 'G';
        else size = 'GG';
      } else {
        size = 'M';
      }
    }

    const is8x12 = size === '8x12' || size === '8 X 12' || size === '8*12';

    // 1. ROTEIRO OFICIAL: mesma fonte de regras usada pelo PCP (REFILE XOR FLEXOGRAFIA).
    const blueprint = buildRouteBlueprint({
      productName: op.product,
      model: op.model,
      client: (op as any).customer || (op as any).client,
      printingMethod: op.printingMethod,
      handleType: op.handleType,
      hasCord: op.hasCord,
      cordMode: (op as any).cordMode,
      hasWindow: op.hasWindow,
    });

    blueprint.warnings.forEach((w) => warnings.push(w));
    if (blueprint.needsPcpValidation) needsPcpValidation = true;

    explanation.push(
      'Produto identificado: ' + blueprint.productLabel + '. Caminho de impressão: ' + blueprint.printingPath + '.'
    );
    if (blueprint.cordMode !== 'NENHUM') {
      explanation.push(
        'Cordão: ' + blueprint.cordMode + (blueprint.cordForcedByClient ? ' (regra fixa do cliente).' : '.')
      );
    }

    const STEP_STAFF: Record<string, { operator: string; role: string; machineId: string | null; machineName: string; minutesDivisor: number; images: string[] }> = {
      proc_refile: { operator: 'Welton', role: 'OPERADOR', machineId: 'REFILADEIRA_01', machineName: 'Refiladeira', minutesDivisor: 200, images: ['desenho_tecnico', 'layout_aprovado'] },
      proc_flexografia: { operator: 'Gabriel', role: 'OPERADOR', machineId: 'FLEXOGRAFIA_01', machineName: 'Flexografia', minutesDivisor: 150, images: ['arte_frente', 'arte_verso', 'layout_aprovado'] },
      proc_serigrafia: { operator: 'Viola', role: 'OPERADOR', machineId: 'CARROSSEL_01', machineName: 'Carrossel', minutesDivisor: 80, images: ['arte_frente', 'arte_verso', 'layout_aprovado'] },
      proc_passar_fio: { operator: 'Posto de Cordão Manual', role: 'OPERATOR', machineId: 'workstation_proc_cordao_manual', machineName: 'Posto de Cordão Manual', minutesDivisor: 70, images: ['foto_produto', 'layout_aprovado'] },
      proc_costura: { operator: 'Posto de Costura', role: 'OPERATOR', machineId: 'workstation_proc_costura', machineName: 'Posto de Costura', minutesDivisor: 60, images: ['desenho_tecnico', 'foto_produto'] },
      proc_colocar_alca: { operator: 'Setor de Acabamento', role: 'OPERATOR', machineId: 'workstation_proc_colocar_alca', machineName: 'Posto de Alça & Acabamento', minutesDivisor: 90, images: ['foto_produto', 'layout_aprovado'] },
      proc_terceirizado: { operator: 'Recebimento Terceirizado', role: 'OPERATOR', machineId: 'workstation_proc_terceirizado', machineName: 'Recebimento Terceirizado', minutesDivisor: 0, images: ['foto_produto'] },
      proc_expedicao: { operator: 'Carlos', role: 'EXPEDITION', machineId: null, machineName: 'Expedição Manual', minutesDivisor: 0, images: ['layout_aprovado', 'foto_produto'] },
    };

    let stepIndex = 0;
    const pushBlueprintStep = (step: BlueprintStep) => {
      const staff = STEP_STAFF[step.processTypeId];
      if (!staff) return;
      const minutes = staff.minutesDivisor > 0 ? Math.max(20, Math.round(op.quantity / staff.minutesDivisor)) : 20;
      steps.push({
        sequenceIndex: stepIndex++,
        processTypeId: step.processTypeId,
        processName: step.processName,
        sector: step.sector,
        assignedOperatorName: staff.operator,
        assignedOperatorRole: staff.role,
        suggestedMachineId: staff.machineId,
        suggestedMachineName: staff.machineName,
        isMachineAvailable: true,
        estimatedMinutes: minutes,
        eligibleMachines: staff.machineId
          ? [{ id: staff.machineId, name: staff.machineName, sector: step.sector, isCompatible: true, score: 100 }]
          : [],
        isManual: step.processTypeId === 'proc_expedicao' || step.processTypeId === 'proc_terceirizado',
        requiredImageTypes: staff.images,
      });
    };

    // Etapas anteriores ao Corte e Solda
    const corteIdx = blueprint.processIds.indexOf('proc_solda');
    const antesDoCorte = corteIdx >= 0 ? blueprint.steps.slice(0, corteIdx) : blueprint.steps;
    const depoisDoCorte = corteIdx >= 0 ? blueprint.steps.slice(corteIdx + 1) : [];
    antesDoCorte.forEach(pushBlueprintStep);

    // 3. CORTE E SOLDA (Regras rígidas da matriz de máquinas)
    const corteCandidates: MachineCandidate[] = [
      {
        id: 'mach_corte_1',
        name: 'Máquina 1 — Corte e Solda',
        sector: 'Corte e Solda',
        isCompatible: false,
        incompatibilityReason: 'Máquina cadastrada, porém atualmente indisponível (manutenção/legado).',
        score: 0,
      },
    ];

    // MÁQUINA 2: Visor, Sem Visor, Alça Vazada, até tamanho M
    const m2SizeIncompatible = ['G', 'GG'].includes(size);
    if (m2SizeIncompatible) {
      corteCandidates.push({
        id: 'mach_corte_2',
        name: 'Máquina 2 — Corte e Solda',
        sector: 'Corte e Solda',
        isCompatible: false,
        incompatibilityReason: `Incompatível com tamanho ${size} (capacidade máxima da M2 é tamanho M).`,
        score: 0,
      });
    } else {
      corteCandidates.push({
        id: 'mach_corte_2',
        name: 'Máquina 2 — Corte e Solda',
        sector: 'Corte e Solda',
        isCompatible: true,
        score: hasWindow ? 95 : 85,
      });
    }

    // MÁQUINA 3: Visor, Sem Visor, Alça Vazada, até GG. Única para 8x12
    corteCandidates.push({
      id: 'mach_corte_3',
      name: 'Máquina 3 — Corte e Solda',
      sector: 'Corte e Solda',
      isCompatible: true,
      isPreferred: is8x12 || hasWindow,
      score: is8x12 ? 100 : (hasWindow ? 90 : 80),
    });

    // MÁQUINA 4: Sem Visor. Preferencial para Alça Vazada sem visor
    if (hasWindow) {
      corteCandidates.push({
        id: 'mach_corte_4',
        name: 'Máquina 4 — Corte e Solda',
        sector: 'Corte e Solda',
        isCompatible: false,
        incompatibilityReason: 'Incompatível com Visor Cristal (M4 opera apenas Sem Visor).',
        score: 0,
      });
    } else {
      corteCandidates.push({
        id: 'mach_corte_4',
        name: 'Máquina 4 — Corte e Solda',
        sector: 'Corte e Solda',
        isCompatible: true,
        isPreferred: isAlcaVazada && !hasWindow,
        score: isAlcaVazada && !hasWindow ? 98 : 75,
      });
    }

    // Escolha da melhor máquina de Corte e Solda
    let selectedCorte = corteCandidates.find(c => c.isPreferred && c.isCompatible);
    if (!selectedCorte) {
      selectedCorte = corteCandidates.filter(c => c.isCompatible).sort((a, b) => b.score - a.score)[0];
    }

    // Somente o cordao AUTOMATICO e aplicado dentro do Corte e Solda (Maquina 3).
    // O manual virou etapa propria (posto de Cordao Manual) e nao prende a maquina.
    const hasCord = blueprint.cordMode === 'AUTOMATICO';
    void hasCordLegacy;

    let waitingM3 = false;
    if (is8x12) {
      selectedCorte = corteCandidates.find(c => c.id === 'mach_corte_3');
      explanation.push('Corte e Solda: Regra absoluta aplicada — Tamanho 8x12 alocado exclusivamente para Máquina 3.');
    } else if (selectedCorte) {
      explanation.push(
        hasCord
          ? `Corte e Solda: Alocado para ${selectedCorte.name} sob supervisão de Toninho (Processo: Corte + Solda + Aplicação de Cordão na mesma máquina).`
          : `Corte e Solda: Alocado para ${selectedCorte.name} sob supervisão de Toninho.`
      );
    } else {
      waitingM3 = true;
      needsPcpValidation = true;
      warnings.push('Nenhuma máquina de Corte e Solda compatível encontrada para estas especificações.');
    }

    // Produtos que ja chegam prontos (Ecobag, Saquinho de Algodao) nao tem Corte e Solda.
    if (corteIdx >= 0) {
    steps.push({
      sequenceIndex: stepIndex++,
      processTypeId: 'proc_solda',
      processName: 'Corte e Solda',
      sector: 'Corte e Solda',
      assignedOperatorName: 'Toninho',
      assignedOperatorRole: 'LIDER',
      suggestedMachineId: selectedCorte ? selectedCorte.id : 'mach_corte_3',
      suggestedMachineName: selectedCorte ? selectedCorte.name : 'AGUARDANDO MÁQUINA COMPATÍVEL',
      isMachineAvailable: true,
      waitingCompatibleMachine: waitingM3,
      estimatedMinutes: Math.max(35, Math.round(op.quantity / (hasCord ? 95 : 120))),
      eligibleMachines: corteCandidates,
      requiredImageTypes: ['desenho_tecnico', 'layout_aprovado', 'foto_produto'],
      hasCord: Boolean(hasCord),
    });
    }

    // 4. Etapas posteriores ao Corte e Solda, na ordem definida pelas regras de produto:
    //    Costura -> Cordão Manual -> Alça -> Expedição (as que a OP exigir).
    depoisDoCorte.forEach(pushBlueprintStep);

    return {
      steps,
      warnings,
      needsPcpValidation,
      explanation,
    };
  }
}
