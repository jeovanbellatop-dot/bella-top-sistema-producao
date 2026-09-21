import { getFirestoreDb } from '../firebaseAdmin';
import type { FactoryAlert } from '../../src/types/mes';

/**
 * alertsRepository
 * Coleção Firestore: alertas/{alertId}
 * Schema: FactoryAlert
 */

export const alertsRepository = {
  async listAlerts(unreadOnly: boolean = false): Promise<FactoryAlert[]> {
    const firestore = getFirestoreDb();
    let query: FirebaseFirestore.Query = firestore.collection('alertas');

    if (unreadOnly) {
      query = query.where('isRead', '==', false);
    }

    const snapshot = await query.get();
    const alerts = snapshot.docs.map((d) => d.data() as FactoryAlert);

    // Ordena pelo timestamp decrescente
    alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return alerts;
  },

  async getAlertById(alertId: string): Promise<FactoryAlert | null> {
    const firestore = getFirestoreDb();
    const doc = await firestore.collection('alertas').doc(alertId).get();
    if (!doc.exists) {
      return null;
    }
    return doc.data() as FactoryAlert;
  },

  async createAlert(alert: FactoryAlert): Promise<FactoryAlert> {
    const firestore = getFirestoreDb();
    await firestore.collection('alertas').doc(alert.id).set(alert);
    return alert;
  },

  async markAsRead(alertId: string): Promise<FactoryAlert> {
    const firestore = getFirestoreDb();
    const docRef = firestore.collection('alertas').doc(alertId);
    await docRef.update({ isRead: true });
    const updated = await docRef.get();
    return updated.data() as FactoryAlert;
  },
};
