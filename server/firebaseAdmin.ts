import { initializeApp, getApps, cert } from 'firebase-admin/app';
import type { App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

/**
 * Inicialização única do Firebase Admin SDK usando GOOGLE_SERVICE_ACCOUNT_KEY.
 * Suporta string JSON pura ou codificada em Base64.
 * Exporta a instância única do Firestore para toda a aplicação backend.
 */
let adminApp: App | null = null;
let firestoreInstance: Firestore | null = null;

function parseServiceAccount(): Record<string, any> | null {
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
  if (!rawKey || !rawKey.trim()) {
    return null;
  }

  const trimmed = rawKey.trim();

  // 1. JSON direto
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // continua para tentativa base64
    }
  }

  // 2. Base64
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf-8').trim();
    if (decoded.startsWith('{') && decoded.endsWith('}')) {
      return JSON.parse(decoded);
    }
  } catch {
    // fallback
  }

  return null;
}

export function getFirebaseAdminApp(): App {
  if (adminApp) {
    return adminApp;
  }

  const apps = getApps();
  const existing = apps.find((app) => app?.name === 'bellatop-admin') || apps[0];
  if (existing) {
    adminApp = existing;
    return adminApp;
  }

  const serviceAccount = parseServiceAccount();
  if (!serviceAccount) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_KEY não configurada ou inválida no ambiente para inicialização do Firebase Admin.'
    );
  }

  adminApp = initializeApp(
    {
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID,
    },
    'bellatop-admin'
  );

  return adminApp;
}

export function getFirestoreDb(): Firestore {
  if (firestoreInstance) {
    return firestoreInstance;
  }

  const app = getFirebaseAdminApp();
  firestoreInstance = getFirestore(app);
  return firestoreInstance;
}

/**
/**
 * Retorna (ou inicializa) o bucket padrao do Firebase Storage, resolvendo
 * automaticamente a convencao de nome correta:
 * - FIREBASE_STORAGE_BUCKET, quando definido explicitamente no ambiente;
 * - <project_id>.firebasestorage.app (padrao para projetos criados a partir de 2024);
 * - <project_id>.appspot.com (padrao legado).
 * O resultado e cacheado em memoria apos a primeira resolucao bem-sucedida.
 */
let storageBucketInstance: ReturnType<ReturnType<typeof getStorage>['bucket']> | null = null;

export async function getStorageBucket() {
  if (storageBucketInstance) {
    return storageBucketInstance;
  }

  const app = getFirebaseAdminApp();
  const serviceAccount = parseServiceAccount();
  const projectId = (serviceAccount && serviceAccount.project_id) || process.env.FIREBASE_PROJECT_ID;

  const candidates: string[] = [];
  if (process.env.FIREBASE_STORAGE_BUCKET) {
    candidates.push(process.env.FIREBASE_STORAGE_BUCKET);
  }
  if (projectId) {
    candidates.push(`${projectId}.firebasestorage.app`);
    candidates.push(`${projectId}.appspot.com`);
  }

  const storage = getStorage(app);
  let lastError: any = null;

  for (const candidate of candidates) {
    try {
      const bucket = storage.bucket(candidate);
      const [exists] = await bucket.exists();
      if (exists) {
        storageBucketInstance = bucket;
        return storageBucketInstance;
      }
    } catch (err: any) {
      lastError = err;
    }
  }

  const attempted = candidates.join(', ') || '(nenhum candidato - projectId ausente)';
  throw new Error(
    `Nenhum bucket do Firebase Storage encontrado. Tentativas: ${attempted}. ` +
      'Verifique se o Cloud Storage foi habilitado para este projeto Firebase, ou defina FIREBASE_STORAGE_BUCKET explicitamente.' +
      (lastError ? ` Ultimo erro: ${lastError.message}` : '')
  );
}

export const db = {
  get instance(): Firestore {
    return getFirestoreDb();
  },
};
