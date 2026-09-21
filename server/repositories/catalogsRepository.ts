import { getFirestoreDb } from '../firebaseAdmin';
import type { ProcessType, RoutingRule, ProductTechnicalSpec } from '../../src/types/mes';

/**
 * catalogsRepository
 * Coleções Firestore de Catálogo (Somente Leitura nesta fase):
 * - processos/{processTypeId} -> ProcessType
 * - regras_roteamento/{ruleId} -> RoutingRule
 * - produtos/{productId} -> ProductTechnicalSpec
 */

export const catalogsRepository = {
  // --- Processos ---
  async listProcessTypes(): Promise<ProcessType[]> {
    const firestore = getFirestoreDb();
    const snapshot = await firestore.collection('processos').get();
    return snapshot.docs.map((d) => d.data() as ProcessType);
  },

  async getProcessTypeById(processTypeId: string): Promise<ProcessType | null> {
    const firestore = getFirestoreDb();
    const doc = await firestore.collection('processos').doc(processTypeId).get();
    if (!doc.exists) {
      return null;
    }
    return doc.data() as ProcessType;
  },

  // --- Regras de Roteamento ---
  async listRoutingRules(): Promise<RoutingRule[]> {
    const firestore = getFirestoreDb();
    const snapshot = await firestore.collection('regras_roteamento').get();
    return snapshot.docs.map((d) => d.data() as RoutingRule);
  },

  async getRoutingRuleById(ruleId: string): Promise<RoutingRule | null> {
    const firestore = getFirestoreDb();
    const doc = await firestore.collection('regras_roteamento').doc(ruleId).get();
    if (!doc.exists) {
      return null;
    }
    return doc.data() as RoutingRule;
  },

  // --- Produtos ---
  async listProducts(): Promise<ProductTechnicalSpec[]> {
    const firestore = getFirestoreDb();
    const snapshot = await firestore.collection('produtos').get();
    return snapshot.docs.map((d) => d.data() as ProductTechnicalSpec);
  },

  async getProductById(productId: string): Promise<ProductTechnicalSpec | null> {
    const firestore = getFirestoreDb();
    const doc = await firestore.collection('produtos').doc(productId).get();
    if (!doc.exists) {
      return null;
    }
    return doc.data() as ProductTechnicalSpec;
  },
};
