import { useEffect, useState } from 'react';
import { mesStore } from '../services/mesStore';

export function useMesStore() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsubscribe = mesStore.subscribe(() => {
      setTick((prev) => prev + 1);
    });
    return unsubscribe;
  }, []);

  return {
    machines: mesStore.getMachines(),
    allFactoryMachines: mesStore.getAllFactoryMachines(),
    products: mesStore.getProducts(),
    processTypes: mesStore.getProcessTypes(),
    routingRules: mesStore.getRoutingRules(),
    users: mesStore.getUsers(),
    orders: mesStore.getOrders(),
    auditLogs: mesStore.getAuditLogs(),
    alerts: mesStore.getAlerts(),
    pauseLogs: mesStore.getPauseLogs(),
    machineSessions: mesStore.getAllMachineSessions(),
    
    // Autenticação & Sessão Real
    currentUser: mesStore.getCurrentUser(),
    authenticatedUser: mesStore.getAuthenticatedUser(),
    isAuthenticated: mesStore.isAuthenticated(),
    selectedSector: mesStore.getSelectedSector(),
    activeOperatorMachineId: mesStore.getActiveOperatorMachineId(),
    validateOperatorMachineAccess: mesStore.validateOperatorMachineAccess.bind(mesStore),
    login: mesStore.login.bind(mesStore),
    loginAdministrator: mesStore.loginAdministrator.bind(mesStore),
    logout: mesStore.logout.bind(mesStore),
    setSelectedSector: mesStore.setSelectedSector.bind(mesStore),
    isAuthorizedForSector: mesStore.isAuthorizedForSector.bind(mesStore),
    isAuthorizedForTab: mesStore.isAuthorizedForTab.bind(mesStore),
    getMachinesForUser: mesStore.getMachinesForUser.bind(mesStore),
    getOrdersForUser: mesStore.getOrdersForUser.bind(mesStore),
    getMachineSession: mesStore.getMachineSession.bind(mesStore),
    loginMachineOperator: mesStore.loginMachineOperator.bind(mesStore),
    logoutMachineOperator: mesStore.logoutMachineOperator.bind(mesStore),
    getAvailableCorteSoldaOps: mesStore.getAvailableCorteSoldaOps.bind(mesStore),
    calculateCorteSoldaRecommendation: mesStore.calculateCorteSoldaRecommendation.bind(mesStore),
    claimOperation: mesStore.claimOperation.bind(mesStore),
    createUser: mesStore.createUser.bind(mesStore),
    updateUser: mesStore.updateUser.bind(mesStore),
    resetUserPassword: mesStore.resetUserPassword.bind(mesStore),
    changePassword: mesStore.changePassword.bind(mesStore),
    toggleUserStatus: mesStore.toggleUserStatus.bind(mesStore),
    setCurrentUser: (userId: string) => mesStore.setCurrentUser(userId),
    logAudit: mesStore.logAudit.bind(mesStore),

    // Operações Industriais MES
    createOrderFromExtracted: mesStore.createOrderFromExtracted.bind(mesStore),
    updateOrderThumbnail: mesStore.updateOrderThumbnail.bind(mesStore),
    generateRouteForOpData: mesStore.generateRouteForOpData.bind(mesStore),
    startOperation: mesStore.startOperation.bind(mesStore),
    pauseOperation: mesStore.pauseOperation.bind(mesStore),
    resumeOperation: mesStore.resumeOperation.bind(mesStore),
    finishOperation: mesStore.finishOperation.bind(mesStore),
    updateStepMachine: mesStore.updateStepMachine.bind(mesStore),
    setManualPriority: mesStore.setManualPriority.bind(mesStore),
    approveOpRoute: mesStore.approveOpRoute.bind(mesStore),
    dispatchOp: mesStore.dispatchOp.bind(mesStore),
    openMachineMaintenanceCall: mesStore.openMachineMaintenanceCall.bind(mesStore),
    closeMachineMaintenanceCall: mesStore.closeMachineMaintenanceCall.bind(mesStore),
    getMachineQueue: mesStore.getMachineQueue.bind(mesStore),

    // Sincronização com o Firestore — erro visível em vez de falha silenciosa
    ordersSyncError: mesStore.getOrdersSyncError(),
    clearOrdersSyncError: mesStore.clearOrdersSyncError.bind(mesStore),
    markAlertRead: mesStore.markAlertRead.bind(mesStore),
    markAllAlertsRead: mesStore.markAllAlertsRead.bind(mesStore),
    resetToDemoData: mesStore.resetToDemoData.bind(mesStore),
    clearAllData: mesStore.clearAllData.bind(mesStore),
  };
}
