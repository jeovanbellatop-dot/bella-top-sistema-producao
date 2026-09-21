import { Router, Request, Response } from 'express';
import { opsRepository } from '../repositories/opsRepository';
import { machinesRepository } from '../repositories/machinesRepository';
import { usersRepository } from '../repositories/usersRepository';
import { pausesRepository } from '../repositories/pausesRepository';
import { auditRepository } from '../repositories/auditRepository';
import { alertsRepository } from '../repositories/alertsRepository';
import { catalogsRepository } from '../repositories/catalogsRepository';

export const dbRoutes = Router();

// =========================================================================
// 1. ORDENS DE PRODUÇÃO (ops)
// =========================================================================

// GET /api/db/ops - Lista todas as OPs
dbRoutes.get('/ops', async (_req: Request, res: Response) => {
  try {
    const list = await opsRepository.listOps();
    return res.json({ success: true, data: list });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/db/ops - Cria nova OP
dbRoutes.post('/ops', async (req: Request, res: Response) => {
  try {
    const created = await opsRepository.createOp(req.body);
    return res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/db/ops/:opId - Busca OP por ID com suas etapas
dbRoutes.get('/ops/:opId', async (req: Request, res: Response) => {
  try {
    const op = await opsRepository.getOpById(req.params.opId);
    if (!op) {
      return res.status(404).json({ success: false, error: 'Ordem de Produção não encontrada.' });
    }
    return res.json({ success: true, data: op });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/db/ops/:opId - Atualiza OP
dbRoutes.put('/ops/:opId', async (req: Request, res: Response) => {
  try {
    const updated = await opsRepository.updateOp(req.params.opId, req.body);
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 2. ETAPAS DE OPERAÇÃO (ops/:opId/etapas)
// =========================================================================

// GET /api/db/ops/:opId/etapas - Lista etapas da OP
dbRoutes.get('/ops/:opId/etapas', async (req: Request, res: Response) => {
  try {
    const steps = await opsRepository.listSteps(req.params.opId);
    return res.json({ success: true, data: steps });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/db/ops/:opId/etapas - Cria nova etapa na OP
dbRoutes.post('/ops/:opId/etapas', async (req: Request, res: Response) => {
  try {
    const step = await opsRepository.createStep(req.params.opId, req.body);
    return res.status(201).json({ success: true, data: step });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/db/ops/:opId/etapas/:etapaId - Busca etapa específica
dbRoutes.get('/ops/:opId/etapas/:etapaId', async (req: Request, res: Response) => {
  try {
    const step = await opsRepository.getStep(req.params.opId, req.params.etapaId);
    if (!step) {
      return res.status(404).json({ success: false, error: 'Etapa não encontrada.' });
    }
    return res.json({ success: true, data: step });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/db/ops/:opId/etapas/:etapaId - Atualiza etapa
dbRoutes.put('/ops/:opId/etapas/:etapaId', async (req: Request, res: Response) => {
  try {
    const updated = await opsRepository.updateStep(req.params.opId, req.params.etapaId, req.body);
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 3. OPERAÇÕES EM TRANSAÇÃO CONCORRENTE
// =========================================================================

// POST /api/db/ops/:opId/etapas/:etapaId/reivindicar
dbRoutes.post('/ops/:opId/etapas/:etapaId/reivindicar', async (req: Request, res: Response) => {
  try {
    const { opId, etapaId } = req.params;
    const { machineId, operatorId, machineName, operatorName } = req.body;

    if (!machineId || !operatorId) {
      return res.status(400).json({
        success: false,
        error: 'machineId e operatorId são obrigatórios para reivindicar a etapa.',
      });
    }

    const updated = await opsRepository.claimStep(opId, etapaId, machineId, operatorId, {
      machineName,
      operatorName,
    });
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    const isConflict = err.message?.includes('Conflito de concorrência');
    return res.status(isConflict ? 409 : 400).json({ success: false, error: err.message });
  }
});

// POST /api/db/ops/:opId/etapas/:etapaId/iniciar
dbRoutes.post('/ops/:opId/etapas/:etapaId/iniciar', async (req: Request, res: Response) => {
  try {
    const { opId, etapaId } = req.params;
    const { machineId, operatorId, machineName, operatorName } = req.body;

    const result = await opsRepository.startStep(opId, etapaId, machineId, operatorId, {
      machineName,
      operatorName,
    });
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/db/ops/:opId/etapas/:etapaId/pausar
dbRoutes.post('/ops/:opId/etapas/:etapaId/pausar', async (req: Request, res: Response) => {
  try {
    const { opId, etapaId } = req.params;
    const { reason, operatorId, operatorName } = req.body;

    const updated = await opsRepository.pauseStep(opId, etapaId, reason, operatorId, {
      operatorName,
    });
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/db/ops/:opId/etapas/:etapaId/retomar
dbRoutes.post('/ops/:opId/etapas/:etapaId/retomar', async (req: Request, res: Response) => {
  try {
    const { opId, etapaId } = req.params;
    const { operatorId, operatorName } = req.body;

    const updated = await opsRepository.resumeStep(opId, etapaId, operatorId, {
      operatorName,
    });
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/db/ops/:opId/etapas/:etapaId/finalizar
dbRoutes.post('/ops/:opId/etapas/:etapaId/finalizar', async (req: Request, res: Response) => {
  try {
    const { opId, etapaId } = req.params;
    const {
      producedQuantity,
      lossQuantity,
      lossReason,
      observation,
      lossClassification,
      lossDestination,
      reworkQuantity,
      heldQuantity,
      operatorId,
      operatorName,
    } = req.body;

    const result = await opsRepository.finishStep(
      opId,
      etapaId,
      {
        producedQuantity,
        lossQuantity,
        lossReason,
        observation,
        lossClassification,
        lossDestination,
        reworkQuantity,
        heldQuantity,
      },
      operatorId,
      { operatorName }
    );
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/db/ops/:opId/etapas/:etapaId/transferir
dbRoutes.post('/ops/:opId/etapas/:etapaId/transferir', async (req: Request, res: Response) => {
  try {
    const { opId, etapaId } = req.params;
    const { newMachineId, newMachineName } = req.body;

    if (!newMachineId || !newMachineName) {
      return res.status(400).json({
        success: false,
        error: 'newMachineId e newMachineName são obrigatórios.',
      });
    }

    const updated = await opsRepository.transferStepMachine(
      opId,
      etapaId,
      newMachineId,
      newMachineName
    );
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 4. MÁQUINAS E FILA
// =========================================================================

// GET /api/db/maquinas/:machineId/fila - Fila da máquina
dbRoutes.get('/maquinas/:machineId/fila', async (req: Request, res: Response) => {
  try {
    const queue = await opsRepository.getMachineQueue(req.params.machineId);
    return res.json({ success: true, data: queue });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/db/maquinas - Lista máquinas
dbRoutes.get('/maquinas', async (_req: Request, res: Response) => {
  try {
    const list = await machinesRepository.listMachines();
    return res.json({ success: true, data: list });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/db/maquinas - Cria máquina
dbRoutes.post('/maquinas', async (req: Request, res: Response) => {
  try {
    const created = await machinesRepository.createMachine(req.body);
    return res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /api/db/maquinas/:machineId - Atualiza máquina
dbRoutes.put('/maquinas/:machineId', async (req: Request, res: Response) => {
  try {
    const updated = await machinesRepository.updateMachine(req.params.machineId, req.body);
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 5. USUÁRIOS
// =========================================================================

// GET /api/db/usuarios - Lista usuários
dbRoutes.get('/usuarios', async (_req: Request, res: Response) => {
  try {
    const list = await usersRepository.listUsers();
    return res.json({ success: true, data: list });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/db/usuarios - Cria usuário
dbRoutes.post('/usuarios', async (req: Request, res: Response) => {
  try {
    const created = await usersRepository.createUser(req.body);
    return res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /api/db/usuarios/:userId - Atualiza usuário
dbRoutes.put('/usuarios/:userId', async (req: Request, res: Response) => {
  try {
    const updated = await usersRepository.updateUser(req.params.userId, req.body);
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 6. PARADAS E MANUTENÇÃO (unificadas)
// =========================================================================

// GET /api/db/paradas - Lista paradas
dbRoutes.get('/paradas', async (req: Request, res: Response) => {
  try {
    const { machineId, opId, tipo } = req.query as {
      machineId?: string;
      opId?: string;
      tipo?: 'PARADA' | 'MANUTENCAO';
    };
    const list = await pausesRepository.listPauses({ machineId, opId, tipo });
    return res.json({ success: true, data: list });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/db/paradas - Cria parada ou chamado de manutenção
dbRoutes.post('/paradas', async (req: Request, res: Response) => {
  try {
    const created = await pausesRepository.createPause(req.body);
    return res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 7. AUDITORIA (append-only)
// =========================================================================

// GET /api/db/auditoria - Lista logs de auditoria
dbRoutes.get('/auditoria', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 200;
    const list = await auditRepository.listLogs(limit);
    return res.json({ success: true, data: list });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/db/auditoria - Grava novo log
dbRoutes.post('/auditoria', async (req: Request, res: Response) => {
  try {
    const created = await auditRepository.appendLog(req.body);
    return res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 8. ALERTAS DA FÁBRICA
// =========================================================================

// GET /api/db/alertas - Lista alertas
dbRoutes.get('/alertas', async (req: Request, res: Response) => {
  try {
    const unreadOnly = req.query.unread === 'true';
    const list = await alertsRepository.listAlerts(unreadOnly);
    return res.json({ success: true, data: list });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/db/alertas - Cria alerta
dbRoutes.post('/alertas', async (req: Request, res: Response) => {
  try {
    const created = await alertsRepository.createAlert(req.body);
    return res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /api/db/alertas/:alertId/ler - Marca alerta como lido
dbRoutes.put('/alertas/:alertId/ler', async (req: Request, res: Response) => {
  try {
    const updated = await alertsRepository.markAsRead(req.params.alertId);
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 9. CATÁLOGOS (Somente Leitura nesta fase)
// =========================================================================

// GET /api/db/processos - Tipos de Processo
dbRoutes.get('/processos', async (_req: Request, res: Response) => {
  try {
    const list = await catalogsRepository.listProcessTypes();
    return res.json({ success: true, data: list });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/db/regras-roteamento - Regras de Roteamento Dinâmico
dbRoutes.get('/regras-roteamento', async (_req: Request, res: Response) => {
  try {
    const list = await catalogsRepository.listRoutingRules();
    return res.json({ success: true, data: list });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/db/produtos - Especificações Técnicas de Produtos
dbRoutes.get('/produtos', async (_req: Request, res: Response) => {
  try {
    const list = await catalogsRepository.listProducts();
    return res.json({ success: true, data: list });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
