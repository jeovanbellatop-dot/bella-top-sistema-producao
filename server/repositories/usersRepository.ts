import { getFirestoreDb } from '../firebaseAdmin';
import type { User } from '../../src/types/mes';

/**
 * usersRepository
 * Coleção Firestore: usuarios/{userId}
 * Schema: User (campos exatos de src/types/mes.ts, sem alterar regras de login existentes)
 */

export const usersRepository = {
  async listUsers(): Promise<User[]> {
    const firestore = getFirestoreDb();
    const snapshot = await firestore.collection('usuarios').get();
    return snapshot.docs.map((d) => d.data() as User);
  },

  async getUserById(userId: string): Promise<User | null> {
    const firestore = getFirestoreDb();
    const doc = await firestore.collection('usuarios').doc(userId).get();
    if (!doc.exists) {
      return null;
    }
    return doc.data() as User;
  },

  async createUser(user: User): Promise<User> {
    const firestore = getFirestoreDb();
    await firestore.collection('usuarios').doc(user.id).set(user);
    return user;
  },

  async updateUser(userId: string, data: Partial<User>): Promise<User> {
    const firestore = getFirestoreDb();
    const docRef = firestore.collection('usuarios').doc(userId);
    await docRef.set(data as any, { merge: true });
    const updated = await docRef.get();
    return updated.data() as User;
  },
};
