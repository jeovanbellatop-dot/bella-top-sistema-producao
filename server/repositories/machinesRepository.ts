import { getFirestoreDb } from '../firebaseAdmin';
import type { Machine } from '../../src/types/mes';

/**
 * machinesRepository
 * Coleção Firestore: maquinas/{machineId}
 * Schema: Machine (campos exatos de src/types/mes.ts)
 */

export const machinesRepository = {
  async listMachines(): Promise<Machine[]> {
    const firestore = getFirestoreDb();
    const snapshot = await firestore.collection('maquinas').get();
    return snapshot.docs.map((d) => d.data() as Machine);
  },

  async getMachineById(machineId: string): Promise<Machine | null> {
    const firestore = getFirestoreDb();
    const doc = await firestore.collection('maquinas').doc(machineId).get();
    if (!doc.exists) {
      return null;
    }
    return doc.data() as Machine;
  },

  async createMachine(machine: Machine): Promise<Machine> {
    const firestore = getFirestoreDb();
    await firestore.collection('maquinas').doc(machine.id).set(machine);
    return machine;
  },

  async updateMachine(machineId: string, data: Partial<Machine>): Promise<Machine> {
    const firestore = getFirestoreDb();
    const docRef = firestore.collection('maquinas').doc(machineId);
    await docRef.set(data as any, { merge: true });
    const updated = await docRef.get();
    return updated.data() as Machine;
  },
};
