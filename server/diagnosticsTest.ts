import { initializeApp, getApps, cert } from 'firebase-admin/app';
import type { App } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { google } from 'googleapis';

export interface ServiceDiagnosticResult {
  service: 'firestore' | 'google_drive';
  name: string;
  status: 'CONNECTED' | 'NOT_CONFIGURED' | 'REACHABLE_AUTH_REQUIRED' | 'ERROR';
  configured: boolean;
  latencyMs: number;
  message: string;
  testedAt: string;
  operations?: {
    create?: boolean;
    read?: boolean;
    delete?: boolean;
  };
  details: Record<string, any>;
}

export interface DiagnosticsReport {
  success: boolean;
  timestamp: string;
  environment: {
    nodeVersion: string;
    platform: string;
    uptimeSeconds: number;
    memoryUsageMb: {
      rss: number;
      heapUsed: number;
      heapTotal: number;
    };
  };
  services: {
    firestore: ServiceDiagnosticResult;
    googleDrive: ServiceDiagnosticResult;
  };
  summary: {
    total: number;
    connected: number;
    notConfigured: number;
    error: number;
    allReady: boolean;
  };
}

export interface DiagnosticOptions {
  timeoutMs?: number;
}

/**
 * Carrega e faz o parse da credencial de Service Account.
 * Suporta JSON em string pura, Base64 ou objeto serializado.
 */
function parseServiceAccountKey(): Record<string, any> | null {
  const rawKey =
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    '';

  if (!rawKey || !rawKey.trim()) {
    return null;
  }

  const trimmed = rawKey.trim();

  // 1. Tenta parse direto de string JSON
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // continua para tentar base64
    }
  }

  // 2. Tenta decodificar de Base64
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf-8').trim();
    if (decoded.startsWith('{') && decoded.endsWith('}')) {
      return JSON.parse(decoded);
    }
  } catch {
    // continua
  }

  return null;
}

/**
 * Inicialização lazy do Firebase Admin para evitar múltiplas instâncias ou crash na inicialização
 */
let firestoreApp: App | null = null;

function getFirestoreInstance(): Firestore | null {
  const serviceAccount = parseServiceAccountKey();
  if (!serviceAccount) {
    return null;
  }

  if (!firestoreApp) {
    const apps = getApps();
    const existing = apps.find((app) => app?.name === 'bellatop-diagnostics');
    if (existing) {
      firestoreApp = existing;
    } else {
      firestoreApp = initializeApp(
        {
          credential: cert(serviceAccount),
          projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID,
        },
        'bellatop-diagnostics'
      );
    }
  }

  return getFirestore(firestoreApp);
}

/**
 * Validação de conectividade e teste real com Firestore usando firebase-admin
 * Operações testadas:
 * 1. Escrita (doc set) em collection de teste `_diagnostics_test`
 * 2. Leitura (doc get) e verificação do documento gravado
 * 3. Exclusão (doc delete) para limpeza imediata
 */
export async function validateFirestoreConnectivity(
  _options: DiagnosticOptions = {}
): Promise<ServiceDiagnosticResult> {
  const testedAt = new Date().toISOString();
  const serviceAccount = parseServiceAccountKey();

  if (!serviceAccount) {
    return {
      service: 'firestore',
      name: 'Google Cloud Firestore (firebase-admin)',
      status: 'NOT_CONFIGURED',
      configured: false,
      latencyMs: 0,
      message: 'GOOGLE_SERVICE_ACCOUNT_KEY não configurada no ambiente.',
      testedAt,
      details: {
        variable: 'GOOGLE_SERVICE_ACCOUNT_KEY',
        configured: false,
      },
    };
  }

  const startTime = Date.now();
  const testDocId = `diag_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const operations = {
    create: false,
    read: false,
    delete: false,
  };

  try {
    const db = getFirestoreInstance();
    if (!db) {
      throw new Error('Falha ao instanciar Firestore com as credenciais fornecidas.');
    }

    const testRef = db.collection('_diagnostics_test').doc(testDocId);
    const testPayload = {
      testId: testDocId,
      system: 'Bella Top MES',
      purpose: 'Diagnostics Read/Write/Delete Test',
      createdAt: FieldValue.serverTimestamp(),
      isoDate: testedAt,
    };

    // 1. Escrita (set)
    await testRef.set(testPayload);
    operations.create = true;

    // 2. Leitura (get)
    const snapshot = await testRef.get();
    if (!snapshot.exists) {
      throw new Error('Documento de teste não foi localizado após a escrita.');
    }
    operations.read = true;

    // 3. Exclusão (delete)
    await testRef.delete();
    operations.delete = true;

    const latencyMs = Date.now() - startTime;

    return {
      service: 'firestore',
      name: 'Google Cloud Firestore (firebase-admin)',
      status: 'CONNECTED',
      configured: true,
      latencyMs,
      message: 'Teste de ciclo completo no Firestore (escrita, leitura e exclusão) realizado com sucesso!',
      testedAt,
      operations,
      details: {
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        testCollection: '_diagnostics_test',
        testDocId,
        readSuccess: true,
        deleteSuccess: true,
      },
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const isPermission =
      err.code === 7 ||
      err.message?.includes('PERMISSION_DENIED') ||
      err.message?.includes('permission');

    return {
      service: 'firestore',
      name: 'Google Cloud Firestore (firebase-admin)',
      status: isPermission ? 'REACHABLE_AUTH_REQUIRED' : 'ERROR',
      configured: true,
      latencyMs,
      message: isPermission
        ? `Firestore acessível, mas permissões insuficientes para a Service Account: ${err.message}`
        : `Erro ao executar teste real no Firestore: ${err.message || 'Falha desconhecida'}`,
      testedAt,
      operations,
      details: {
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        errorCode: err.code || null,
        errorMessage: err.message,
      },
    };
  }
}

/**
 * Validação de conectividade e teste real com Google Drive API usando googleapis
 * Operações testadas:
 * 1. Criação de pasta de teste dentro de GOOGLE_DRIVE_ROOT_FOLDER_ID
 * 2. Leitura de metadados da pasta criada
 * 3. Exclusão permanente da pasta de teste
 */
export async function validateGoogleDriveConnectivity(
  _options: DiagnosticOptions = {}
): Promise<ServiceDiagnosticResult> {
  const testedAt = new Date().toISOString();
  const serviceAccount = parseServiceAccountKey();
  const rootFolderId =
    process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ||
    process.env.GOOGLE_DRIVE_FOLDER_ID ||
    '';

  if (!serviceAccount || !rootFolderId) {
    const missing: string[] = [];
    if (!serviceAccount) missing.push('GOOGLE_SERVICE_ACCOUNT_KEY');
    if (!rootFolderId) missing.push('GOOGLE_DRIVE_ROOT_FOLDER_ID');

    return {
      service: 'google_drive',
      name: 'Google Drive API (googleapis)',
      status: 'NOT_CONFIGURED',
      configured: false,
      latencyMs: 0,
      message: `Variáveis de ambiente do Google Drive não configuradas: ${missing.join(', ')}.`,
      testedAt,
      details: {
        hasServiceAccount: Boolean(serviceAccount),
        hasRootFolderId: Boolean(rootFolderId),
        missing,
      },
    };
  }

  const startTime = Date.now();
  const operations = {
    create: false,
    read: false,
    delete: false,
  };

  let createdFolderId: string | null = null;

  try {
    const auth = new google.auth.JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // 1. Criação de pasta de teste dentro de GOOGLE_DRIVE_ROOT_FOLDER_ID
    const testFolderName = `_diagnostics_test_${Date.now()}`;
    const createRes = await drive.files.create({
      requestBody: {
        name: testFolderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [rootFolderId],
      },
      fields: 'id, name, mimeType, parents',
      supportsAllDrives: true,
    });

    createdFolderId = createRes.data.id || null;
    if (!createdFolderId) {
      throw new Error('Falha ao obter ID da pasta criada no Google Drive.');
    }
    operations.create = true;

    // 2. Leitura dos metadados da pasta recém-criada
    const readRes = await drive.files.get({
      fileId: createdFolderId,
      fields: 'id, name, mimeType, trashed, parents',
      supportsAllDrives: true,
    });

    if (readRes.data.id !== createdFolderId) {
      throw new Error('Falha ao verificar os metadados da pasta de teste criada no Google Drive.');
    }
    operations.read = true;

    // 3. Exclusão permanente da pasta de teste
    await drive.files.delete({
      fileId: createdFolderId,
      supportsAllDrives: true,
    });
    operations.delete = true;

    const latencyMs = Date.now() - startTime;

    return {
      service: 'google_drive',
      name: 'Google Drive API (googleapis)',
      status: 'CONNECTED',
      configured: true,
      latencyMs,
      message: 'Teste de ciclo completo no Google Drive (criação, leitura e exclusão de pasta) realizado com sucesso!',
      testedAt,
      operations,
      details: {
        rootFolderId,
        clientEmail: serviceAccount.client_email,
        testedFolderId: createdFolderId,
        testFolderName,
        readSuccess: true,
        deleteSuccess: true,
      },
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;

    // Tentativa de limpeza caso a pasta tenha sido criada antes de falhar
    if (createdFolderId && !operations.delete) {
      try {
        const auth = new google.auth.JWT({
          email: serviceAccount.client_email,
          key: serviceAccount.private_key,
          scopes: ['https://www.googleapis.com/auth/drive'],
        });
        const drive = google.drive({ version: 'v3', auth });
        await drive.files.delete({ fileId: createdFolderId, supportsAllDrives: true });
      } catch {
        // Silêncio no cleanup secundário
      }
    }

    const isPermission =
      err.code === 403 ||
      err.code === 401 ||
      err.message?.includes('permission') ||
      err.message?.includes('access');

    return {
      service: 'google_drive',
      name: 'Google Drive API (googleapis)',
      status: isPermission ? 'REACHABLE_AUTH_REQUIRED' : 'ERROR',
      configured: true,
      latencyMs,
      message: isPermission
        ? `Google Drive acessível, mas permissões insuficientes para a pasta raiz: ${err.message}`
        : `Erro ao executar teste real no Google Drive: ${err.message || 'Falha desconhecida'}`,
      testedAt,
      operations,
      details: {
        rootFolderId,
        clientEmail: serviceAccount?.client_email,
        errorCode: err.code || null,
        errorMessage: err.message,
      },
    };
  }
}

/**
 * Executa todos os testes de diagnóstico e compila o relatório unificado
 */
export async function runDiagnostics(options: DiagnosticOptions = {}): Promise<DiagnosticsReport> {
  const [firestoreResult, driveResult] = await Promise.all([
    validateFirestoreConnectivity(options),
    validateGoogleDriveConnectivity(options),
  ]);

  const mem = process.memoryUsage();
  const results = [firestoreResult, driveResult];

  const connected = results.filter((r) => r.status === 'CONNECTED').length;
  const notConfigured = results.filter((r) => r.status === 'NOT_CONFIGURED').length;
  const error = results.filter((r) => r.status === 'ERROR').length;

  return {
    success: error === 0,
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      uptimeSeconds: Math.round(process.uptime() * 10) / 10,
      memoryUsageMb: {
        rss: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
        heapUsed: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
        heapTotal: Math.round((mem.heapTotal / 1024 / 1024) * 10) / 10,
      },
    },
    services: {
      firestore: firestoreResult,
      googleDrive: driveResult,
    },
    summary: {
      total: results.length,
      connected,
      notConfigured,
      error,
      allReady: connected === results.length,
    },
  };
}
