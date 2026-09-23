import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { OpAnalyzer } from "./server/opAnalyzer";
import { RoutingEngine } from "./server/routingEngine";
import { ServerAuditService } from "./server/auditService";
import { getOpenAIClient, getOpenAIModel } from "./server/openaiClient";
import { ServerAuthService } from "./server/authService";
import {
  runDiagnostics,
  validateFirestoreConnectivity,
  validateGoogleDriveConnectivity,
} from "./server/diagnosticsTest";
import { dbRoutes } from "./server/routes/dbRoutes";
import { warmUpLiveMirrors } from "./server/firebaseAdmin";
import { storageRoutes } from './server/routes/storageRoutes';

dotenv.config();

const app = express();
const PORT = 3000;

// Enable JSON body with larger limit for base64 PDF and layout uploads
app.use(express.json({ limit: "35mb" }));
app.use(express.urlencoded({ extended: true, limit: "35mb" }));

// Middleware para verificação rigorosa de sessão e permissão de administrador
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers["authorization"] as string;
  const sessionTokenHeader = req.headers["x-session-token"] as string;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7).trim()
    : (sessionTokenHeader || "").trim();

  if (!token) {
    ServerAuditService.log({
      action: "AUTH_ACCESS_DENIED",
      entityType: "AUTH",
      entityId: "anonymous",
      details: `Tentativa de acesso não autenticado à rota restrita: ${req.method} ${req.path}`,
    });
    return res.status(401).json({
      success: false,
      error: "ACESSO NÃO AUTORIZADO: Token de sessão não fornecido. Autenticação obrigatória.",
    });
  }

  const user = ServerAuthService.validateSession(token);
  if (!user) {
    ServerAuditService.log({
      action: "AUTH_ACCESS_DENIED",
      entityType: "AUTH",
      entityId: "invalid_or_expired_token",
      details: `Tentativa com token inválido ou expirado na rota: ${req.method} ${req.path}`,
    });
    return res.status(401).json({
      success: false,
      error: "ACESSO NEGADO: Sessão inválida ou expirada. Faça login novamente.",
    });
  }

  // Validação explícita do setor ADMIN ou perfil ADMIN
  const hasAdminPrivilege =
    user.role === "ADMIN" ||
    (Array.isArray(user.sectors) && user.sectors.includes("ADMIN"));

  if (!hasAdminPrivilege) {
    ServerAuditService.log({
      action: "AUTH_ACCESS_DENIED",
      entityType: "AUTH",
      entityId: user.id,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      details: `Usuário ${user.name} (@${user.login}) tentou acessar área restrita sem permissão de Administrador: ${req.method} ${req.path}`,
    });
    return res.status(403).json({
      success: false,
      error: "ACESSO NEGADO: Apenas Administradores têm permissão para acessar esta área.",
    });
  }

  // Anexa o usuário autenticado à requisição
  (req as any).user = user;
  return next();
};

// ==========================================
// 1. ROTAS DE AUTENTICAÇÃO E SESSÃO
// ==========================================

// Login com nome de usuário e senha
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: "Nome de usuário e senha são obrigatórios.",
    });
  }

  const result = ServerAuthService.login(username, password);
  if (!result.success) {
    return res.status(401).json(result);
  }

  return res.json(result);
});

// Alteração de senha pelo próprio usuário logado
app.post("/api/auth/change-password", (req, res) => {
  const { userId, currentPassword, newPassword } = req.body;
  if (!userId || !currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      error: "Todos os campos de senha são obrigatórios.",
    });
  }

  const result = ServerAuthService.changePasswordSelf(userId, currentPassword, newPassword);
  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
});

// ==========================================
// 2. ROTAS DE GERENCIAMENTO DE USUÁRIOS (ADMIN)
// ==========================================

// Listar todos os usuários cadastrados
app.get("/api/users", requireAdmin, (req, res) => {
  return res.json({
    success: true,
    users: ServerAuthService.getUsers(),
  });
});

// Criar novo acesso
app.post("/api/users", requireAdmin, (req, res) => {
  const adminId = (req as any).user?.id || (req.headers["x-user-id"] as string) || "admin";
  const { name, username, password, sectors, jobTitle, sector, authorizedMachineIds, shift } = req.body;

  const result = ServerAuthService.createUser(adminId, {
    name,
    username,
    password,
    sectors,
    jobTitle,
    sector,
    authorizedMachineIds,
    shift,
  });

  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.status(201).json(result);
});

// Atualizar usuário existente
app.put("/api/users/:id", requireAdmin, (req, res) => {
  const adminId = (req as any).user?.id || (req.headers["x-user-id"] as string) || "admin";
  const { id } = req.params;
  const { name, sectors, authorizedMachineIds, jobTitle, sector, shift, isActive } = req.body;

  const result = ServerAuthService.updateUser(adminId, id, {
    name,
    sectors,
    authorizedMachineIds,
    jobTitle,
    sector,
    shift,
    isActive,
  });

  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
});

// Redefinir senha de um usuário pelo Administrador
app.post("/api/users/:id/reset-password", requireAdmin, (req, res) => {
  const adminId = (req as any).user?.id || (req.headers["x-user-id"] as string) || "admin";
  const { id } = req.params;
  const { newPassword } = req.body;

  const result = ServerAuthService.resetPassword(adminId, id, newPassword);
  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
});

// Ativar / Desativar status do usuário
app.patch("/api/users/:id/status", requireAdmin, (req, res) => {
  const adminId = (req as any).user?.id || (req.headers["x-user-id"] as string) || "admin";
  const { id } = req.params;
  const { isActive } = req.body;

  const result = ServerAuthService.toggleUserStatus(adminId, id, isActive);
  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  const openAiClient = getOpenAIClient();
  res.json({
    status: "ok",
    service: "Bella Top MES Server & OpenAI Production Engine",
    timestamp: new Date().toISOString(),
    aiEngine: {
      provider: openAiClient ? "OpenAI" : "Deterministic Engine Fallback",
      model: getOpenAIModel(),
      isConfigured: !!openAiClient,
    },
  });
});

// Diagnostics & Connectivity Test endpoint (Firestore, Google Drive & Environment)
app.get("/api/_diagnostics/test-connection", async (req, res) => {
  try {
    const service = (req.query.service as string)?.toLowerCase();
    const timeoutMs = req.query.timeout ? parseInt(req.query.timeout as string, 10) : 5000;

    if (service === "firestore") {
      const result = await validateFirestoreConnectivity({ timeoutMs });
      return res.json({
        success: result.status !== "ERROR",
        service: "firestore",
        data: result,
      });
    }

    if (service === "google_drive" || service === "drive") {
      const result = await validateGoogleDriveConnectivity({ timeoutMs });
      return res.json({
        success: result.status !== "ERROR",
        service: "google_drive",
        data: result,
      });
    }

    const report = await runDiagnostics({ timeoutMs });
    return res.json(report);
  } catch (err: any) {
    console.error("[Diagnostics] Erro ao executar teste de conectividade:", err);
    return res.status(500).json({
      success: false,
      error: err?.message || "Falha ao executar teste de diagnóstico",
      timestamp: new Date().toISOString(),
    });
  }
});

// Audit logs endpoint
app.get("/api/audit/logs", (req, res) => {
  const limit = parseInt(req.query.limit as string, 10) || 100;
  res.json({
    success: true,
    logs: ServerAuditService.getLogs(limit),
  });
});

// Route Preview & Machine Eligibility recalculation endpoint
app.post("/api/op/route-preview", (req, res) => {
  try {
    const {
      opNumber = "15487",
      product = "Sacola",
      model = "Alça Vazada Sem Visor",
      material = "TNT 100% Polipropileno",
      gsm = 60,
      size = "M",
      width = 400,
      height = 450,
      bottom = 0,
      quantity = 10000,
      handleType = "VAZADA",
      hasWindow = false,
      hasCord = false,
      printingMethod = "FLEXOGRAFIA",
      printingColors = 1,
      finishing = [],
      client = "",
      cordMode = "",
    } = req.body;

    const result = RoutingEngine.computeRoute({
      opNumber,
      product,
      model,
      material,
      gsm,
      size,
      width,
      height,
      bottom,
      quantity,
      handleType,
      hasWindow,
      hasCord,
      printingMethod,
      printingColors,
      finishing,
      client,
      cordMode,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    console.error("[RoutePreview] Erro ao calcular rota:", err);
    res.status(500).json({ success: false, error: err?.message || "Erro no cálculo de rota" });
  }
});

// Endpoint para registro de auditoria de revisão manual pelo PCP
app.post("/api/op/audit-revision", (req, res) => {
  try {
    const userId = (req.headers["x-user-id"] as string) || "user_pcp";
    const userName = (req.headers["x-user-name"] as string) || "Operador PCP";
    const userRole = (req.headers["x-user-role"] as string) || "PCP";
    const { opNumber, previousData, updatedData, justification, diffs } = req.body;

    const event = ServerAuditService.log({
      action: "PCP_OP_MANUALLY_REVISED",
      entityType: "OP",
      entityId: `OP_${opNumber || "PENDENTE"}`,
      userId,
      userName,
      userRole,
      details: `PCP realizou conferência e revisão manual dos dados da OP ${opNumber || "PENDENTE"}. Motivo/Justificativa: ${justification || "Correção de dados extraídos da OP"}. Alterações: ${diffs?.join("; ") || "Campos técnicos revisados"}.`,
      metadata: {
        opNumber,
        justification,
        diffs,
        updatedFields: Object.keys(updatedData || {}),
      },
    });

    return res.json({
      success: true,
      auditId: event.id,
      timestamp: event.timestamp,
    });
  } catch (err: any) {
    console.error("[AuditRevision] Erro ao registrar auditoria de revisão:", err);
    return res.status(500).json({ success: false, error: err?.message || "Erro ao registrar auditoria" });
  }
});

// Intelligent Multimodal OP Parser Endpoint powered by OpenAI + BELLA_TOP_PRODUCTION_MEMORY
app.post("/api/op/parse-pdf", async (req, res) => {
  try {
    const {
      opDocument,
      layoutDocument,
      pdfBase64,
      mimeType = "application/pdf",
      textContent,
      fileName,
      documents = [],
    } = req.body;

    const docsList = [...documents];
    if (opDocument && !docsList.some((d) => d.fileName === opDocument.fileName)) {
      docsList.unshift(opDocument);
    }
    if (layoutDocument && !docsList.some((d) => d.fileName === layoutDocument.fileName)) {
      docsList.push(layoutDocument);
    }
    if (pdfBase64 && !docsList.some((d) => d.base64 === pdfBase64)) {
      docsList.push({
        base64: pdfBase64,
        mimeType: mimeType || "application/pdf",
        fileName: fileName || "Documento_OP",
      });
    }

    const structuredResult = await OpAnalyzer.analyzeDocument({
      textContent,
      fileName: opDocument?.fileName || fileName,
      opDocument,
      layoutDocument,
      documents: docsList,
    });

    const opFileNameResolved = opDocument?.fileName || docsList.find(d => d.type === 'op_document')?.fileName || fileName || "Ordem_Producao.pdf";
    const layoutFileNameResolved = layoutDocument?.fileName || docsList.find(d => d.type === 'layout_document' || d.fileName?.toLowerCase().includes('layout'))?.fileName || "Layout_Aprovado.pdf";

    // Compatibilidade reversa com o formato anterior esperado pelos componentes existentes
    const legacyCompatData = {
      numeroOp: structuredResult.op.op_number,
      numeroPedido: "PED-" + (structuredResult.op.op_number !== 'Não identificado' ? structuredResult.op.op_number : 'PENDENTE'),
      cliente: structuredResult.op.customer,
      produtoNome: structuredResult.op.product,
      codigoProduto: "BT-" + (structuredResult.op.op_number !== 'Não identificado' ? structuredResult.op.op_number : 'NOVA'),
      modelo: structuredResult.op.model,
      quantidade: structuredResult.op.quantity,
      unidade: "UNIDADES",
      material: structuredResult.op.material,
      gramatura: structuredResult.op.gsm,
      corMaterial: structuredResult.op.material_color,
      larguraMm: structuredResult.op.width,
      alturaMm: structuredResult.op.height,
      fundoMm: structuredResult.op.bottom,
      medidasFormatadas: structuredResult.op.width > 0 && structuredResult.op.height > 0
        ? `${structuredResult.op.width / 10} x ${structuredResult.op.height / 10}${structuredResult.op.bottom ? " + " + structuredResult.op.bottom / 10 : ""} cm`
        : "Não identificado",
      tipoImpressao: structuredResult.op.printing_method,
      numeroCores: structuredResult.op.printing_colors,
      impressaoFrente: structuredResult.op.print_front,
      impressaoVerso: structuredResult.op.print_back,
      personalizacao: structuredResult.op.print_front,
      tipoAlca: structuredResult.op.handle_type,
      usoCordao: structuredResult.op.has_cord,
      tipoCordao: (structuredResult.op as any).cord_mode,
      produtoSugeridoIa: (structuredResult.op as any).product_type,
      necessitaCostura: (structuredResult.op as any).requires_sewing,
      necessitaTerceirizacao: (structuredResult.op as any).outsourced,
      usoVisor: structuredResult.op.has_window,
      acabamentos: structuredResult.op.finishing,
      observacoesTecnicas: structuredResult.op.notes,
      prazoEntrega: structuredResult.op.deadline,
      confiancaLeitura: {
        geral: Math.round(
          (Object.values(structuredResult.extracted_data).reduce((acc, curr) => acc + (curr.confidence || 0.8), 0) /
            Math.max(1, Object.keys(structuredResult.extracted_data).length)) *
            100
        ),
        numeroOp: Math.round((structuredResult.extracted_data.op_number?.confidence || 0.9) * 100),
        cliente: Math.round((structuredResult.extracted_data.customer?.confidence || 0.9) * 100),
        produto: Math.round((structuredResult.extracted_data.product?.confidence || 0.9) * 100),
        quantidade: Math.round((structuredResult.extracted_data.quantity?.confidence || 0.9) * 100),
        gramatura: Math.round((structuredResult.extracted_data.gsm?.confidence || 0.9) * 100),
        medidas: Math.round((structuredResult.extracted_data.width?.confidence || 0.9) * 100),
        tipoImpressao: Math.round((structuredResult.extracted_data.printing_method?.confidence || 0.9) * 100),
        prazo: Math.round((structuredResult.extracted_data.deadline?.confidence || 0.85) * 100),
      },
      inconsistencias: structuredResult.warnings,
      precisaRevisaoPcp: structuredResult.needs_pcp_validation,
      rawText: textContent || fileName || "Documento digitalizado",
      images: structuredResult.images,
      opFileName: opFileNameResolved,
      op_file: opFileNameResolved,
      layoutFileName: layoutFileNameResolved,
      layout_file: layoutFileNameResolved,
      layoutStatus: 'COMPLETO',
      layout_status: 'COMPLETO',
      layoutPreviewImage: layoutDocument?.previewImage || (layoutDocument?.base64 && layoutDocument.mimeType?.startsWith('image/')) ? (layoutDocument.previewImage || `data:${layoutDocument.mimeType};base64,${layoutDocument.base64}`) : (structuredResult.images.find((img) => img.isPrimaryLayout || img.type === 'layout_aprovado')?.urlOrBase64 || structuredResult.images[0]?.urlOrBase64),
      productThumbnail: structuredResult.images.find((img) => img.type === 'foto_produto')?.urlOrBase64 || layoutDocument?.previewImage || ((layoutDocument?.base64 && layoutDocument.mimeType?.startsWith('image/')) ? `data:${layoutDocument.mimeType};base64,${layoutDocument.base64}` : structuredResult.images.find((img) => img.isPrimaryLayout)?.urlOrBase64 || structuredResult.images[0]?.urlOrBase64),
      productThumbnailStatus: 'available',
      layoutCropBox: structuredResult.op.crop_box ? {
        x: Math.max(0, Math.min(100, structuredResult.op.crop_box.xmin / 10)),
        y: Math.max(0, Math.min(100, structuredResult.op.crop_box.ymin / 10)),
        width: Math.max(10, Math.min(100, (structuredResult.op.crop_box.xmax - structuredResult.op.crop_box.xmin) / 10)),
        height: Math.max(10, Math.min(100, (structuredResult.op.crop_box.ymax - structuredResult.op.crop_box.ymin) / 10)),
      } : undefined,
      structured: structuredResult,
    };

    return res.json({
      success: true,
      source: structuredResult.ai_engine_info.provider,
      data: legacyCompatData,
      structured: structuredResult,
    });
  } catch (err: any) {
    console.error("[ParsePDF] Erro crítico no endpoint:", err);
    return res.status(500).json({
      success: false,
      error: err?.message || "Falha no processamento da OP",
    });
  }
});

// FASE 1: Montagem das rotas do Firestore no backend sob o prefixo /api/db
app.use("/api/db", dbRoutes);
app.use('/api/storage', storageRoutes);

// Endpoint de diagnóstico rápido de ambiente
app.get("/api/_envcheck", (req, res) => {
  let pid = "nenhuma chave";
  try {
    pid = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "{}").project_id || "sem project_id";
  } catch (e) {
    pid = "json invalido";
  }
  res.json({
    projectIdDaChave: pid,
    temKey: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
    storageBucketEnv: process.env.FIREBASE_STORAGE_BUCKET || null,
  });
});


// Setup Vite middleware or static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Sobe os espelhos vivos do Firestore antes de atender os aparelhos.
  try {
    warmUpLiveMirrors();
  } catch (err: any) {
    console.error("[Bella Top MES] Espelhos do Firestore nao iniciaram:", err?.message || err);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Bella Top MES] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
