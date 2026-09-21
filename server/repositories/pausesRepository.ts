import { getFirestoreDb } from '../firebaseAdmin';
import type { PauseLog } from '../../src/types/mes';

/**
 * pausesRepository
 * Coleção Firestore: paradas/{paradaId}
 * Schema: PauseLog + campo tipo: 'PARADA' | 'MANUTENCAO'
 * (unifica pausas e chamados de manutenção, como mesStore.ts já faz hoje)
 */

export interface UnifiedPauseLog extends PauseLog {
  tipo: 'PARADA' | 'MANUTENCAO';
}

export const pausesRepository = {
  async listPauses(filters?: { machineId?: string; opId?: string; tipo?: 'PARADA' | 'MANUTENCAO' }): Promise<UnifiedPauseLog[]> {
    const firestore = getFirestoreDb();
    let query: FirebaseFirestore.Query = firestore.collection('paradas');

    if (filters?.machineId) {
      query = query.where('machineId', '==', filters.machineId);
    }
    if (filters?.opId) {
      query = query.where('opId', '==', filters.opId);
    }
    if (filters?.tipo) {
      query = query.where('tipo', '==', filters.tipo);
    }

    const snapshot = await query.get();
    const list = snapshot.docs.map((d) => d.data() as UnifiedPauseLog);

    // Ordena pelo startedAt mais recente
    list.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    return list;
  },

  async getPauseById(paradaId: string): Promise<UnifiedPauseLog | null> {
    const firestore = getFirestoreDb();
    const doc = await firestore.collection('paradas').doc(paradaId).get();
    if (!doc.exists) {
      return null;
    }
    return doc.data() as UnifiedPauseLog;
  },

  async createPause(pause: UnifiedPauseLog): Promise<UnifiedPauseLog> {
    const firestore = getFirestoreDb();
    await firestore.collection('paradas').doc(pause.id).set(pause);
    return pause;
  },

  async updatePause(paradaId: string, data: Partial<UnifiedPauseLog>): Promise<UnifiedPauseLog> {
    const firestore = getFirestoreDb();
    const docRef = firestore.collection('paradas').doc(paradaId);
    await docRef.update(data);
    const updated = await docRef.get();
    return updated.data() as UnifiedPauseLog;
  },
};
