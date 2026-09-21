import { getFirestoreDb } from '../firebaseAdmin';
import type { AuditLogEntry } from '../../src/types/mes';

/**
 * auditRepository
 * Coleção Firestore: auditoria/{auditId}
 * Schema: AuditLogEntry (append-only)
 */

export const auditRepository = {
  async listLogs(limit: number = 200): Promise<AuditLogEntry[]> {
    const firestore = getFirestoreDb();
    const snapshot = await firestore
      .collection('auditoria')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map((d) => d.data() as AuditLogEntry);
  },

  async getLogById(auditId: string): Promise<AuditLogEntry | null> {
    const firestore = getFirestoreDb();
    const doc = await firestore.collection('auditoria').doc(auditId).get();
    if (!doc.exists) {
      return null;
    }
    return doc.data() as AuditLogEntry;
  },

  /**
   * Append-only: apenas inserção permitida
   */
  async appendLog(entry: AuditLogEntry): Promise<AuditLogEntry> {
    const firestore = getFirestoreDb();
    await firestore.collection('auditoria').doc(entry.id).set(entry);
    return entry;
  },
};
