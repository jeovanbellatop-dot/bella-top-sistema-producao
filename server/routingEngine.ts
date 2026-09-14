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
    const hasCord = op.hasCord || handle === 'CORDAO' || op.model.toLowerCase().includes('mochil') || op.model.toLowerCase().includes('cordao');
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

    // 1. REFILE (Sempre a 1ª etapa)
    steps.push({
      sequenceIndex: 0,
      processTypeId: 'proc_refile',
      processName: 'Refile',
      sector: 'Refile e Bobinagem',
      assignedOperatorName: 'Welton',
      assignedOperatorRole: 'OPERADOR',
      suggestedMachineId: 'mach_refiladeira',
      suggestedMachineName: 'Refiladeira',
      isMachineAvailable: true,
      estimatedMinutes: Math.max(25, Math.round(op.quantity / 200)),
      eligibleMachines: [
        {
          id: 'mach_refiladeira',
          name: 'Refiladeira',
          sector: 'Refile',
          isCompatible: true,
          score: 100,
        },
      ],
      requiredImageTypes: ['desenho_tecnico', 'layout_aprovado'],
    });
    explanation.push('Etapa 1: Refile alocado para Welton (Refiladeira) para preparação das bobinas na largura correta.');

    // 2. IMPRESSÃO (Flexografia ou Carrossel / Estamparia)
    let stepIndex = 1;
    if (printMethod === 'FLEXOGRAFIA') {
      steps.push({
        sequenceIndex: stepIndex++,
        processTypeId: 'proc_flexografia',
        processName: 'Flexografia',
        sector: 'Flexografia',
        assignedOperatorName: 'Gabriel',
        assignedOperatorRole: 'OPERADOR',
        suggestedMachineId: 'mach_flexografia',
        suggestedMachineName: 'Flexografia',
        isMachineAvailable: true,
        estimatedMinutes: Math.max(30, Math.round(op.quantity / 150)),
        eligibleMachines: [
          {
            id: 'mach_flexografia',
            name: 'Flexografia',
            sector: 'Flexografia',
            isCompatible: true,
            score: 100,
          },
        ],
        requiredImageTypes: ['arte_frente', 'arte_verso', 'layout_aprovado'],
      });
      explanation.push('Etapa 2: Flexografia alocada para Gabriel (Flexografia) conforme indicação técnica da OP.');
    } else if (
      printMethod === 'SERIGRAFIA' ||
      printMethod === 'ESTAMPARIA' ||
      printMethod === 'CARROSSEL' ||
      printMethod === 'SILK'
    ) {
      steps.push({
        sequenceIndex: stepIndex++,
        processTypeId: 'proc_serigrafia',
        processName: 'Estamparia / Carrossel',
        sector: 'Estamparia',
        assignedOperatorName: 'Viola',
        assignedOperatorRole: 'OPERADOR',
        suggestedMachineId: 'mach_carrossel_1',
        suggestedMachineName: 'Carrossel',
        isMachineAvailable: true,
        estimatedMinutes: Math.max(45, Math.round(op.quantity / 80)),
        eligibleMachines: [
          {
            id: 'mach_carrossel_1',
            name: 'Carrossel',
            sector: 'Estamparia',
            isCompatible: true,
            score: 100,
          },
          {
            id: 'mach_carrossel_2',
            name: 'Carrossel Pequena',
            sector: 'Estamparia',
            isCompatible: true,
            score: 90,
          },
        ],
        requiredImageTypes: ['arte_frente', 'arte_verso', 'layout_aprovado'],
      });
      explanation.push('Etapa 2: Estamparia / Carrossel alocada para Viola (Carrossel) para impressão localizada.');
    } else if (printMethod === 'SEM_IMPRESSAO' || printMethod === 'LISO') {
      explanation.push('Impressão: Material liso sem impressão. Etapa pulada conforme regra industrial.');
    } else {
      needsPcpValidation = true;
      warnings.push('Tipo de impressão não identificado com 100% de clareza no documento.');
      explanation.push('Impressão: Tipo incerto. Necessita validação do PCP.');
    }

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

    // 4. ALÇA / ACABAMENTO (Colocar Alça se for alça fita / acabamento manual)
    if (isAlcaFita && !isAlcaVazada && !hasCord) {
      steps.push({
        sequenceIndex: stepIndex++,
        processTypeId: 'proc_colocar_alca',
        processName: 'Colocar Alça / Acabamento',
        sector: 'Acabamento',
        assignedOperatorName: 'Setor de Acabamento',
        assignedOperatorRole: 'OPERATOR',
        suggestedMachineId: 'workstation_proc_colocar_alca',
        suggestedMachineName: 'Posto de Alça & Acabamento',
        isMachineAvailable: true,
        estimatedMinutes: Math.max(30, Math.round(op.quantity / 90)),
        eligibleMachines: [
          {
            id: 'workstation_proc_colocar_alca',
            name: 'Posto de Alça & Acabamento',
            sector: 'Acabamento',
            isCompatible: true,
            score: 100,
          },
        ],
        requiredImageTypes: ['foto_produto', 'layout_aprovado'],
      });
      explanation.push('Alça / Acabamento: Etapa de Colocar Alça inserida para aplicação de Alça Fita.');
    } else if (isAlcaVazada) {
      explanation.push('Alça / Acabamento: Alça Vazada dispensada de acabamento manual (concluída no corte).');
    }

    // 6. EXPEDIÇÃO & EMBALAGEM (Etapa manual final)
    steps.push({
      sequenceIndex: stepIndex++,
      processTypeId: 'proc_expedicao',
      processName: 'Expedição & Embalagem',
      sector: 'Expedição',
      assignedOperatorName: 'Carlos',
      assignedOperatorRole: 'EXPEDITION',
      suggestedMachineId: null,
      suggestedMachineName: 'Expedição Manual',
      isMachineAvailable: true,
      estimatedMinutes: 20,
      eligibleMachines: [],
      isManual: true,
      requiredImageTypes: ['layout_aprovado', 'foto_produto'],
    });
    explanation.push('Etapa Final: Expedição & Embalagem alocada para Carlos (processo manual de conferência visual do layout aprovado, embalagem e liberação para coleta).');

    return {
      steps,
      warnings,
      needsPcpValidation,
      explanation,
    };
  }
}
