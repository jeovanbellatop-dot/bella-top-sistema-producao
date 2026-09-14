export interface AuditEvent {
  id: string;
  timestamp: string;
  action:
    | 'AI_ANALYSIS_CREATED'
    | 'AI_ROUTE_SUGGESTED'
    | 'PCP_ROUTE_CONFIRMED'
    | 'ROUTE_CHANGED_BY_PCP'
    | 'PCP_OP_MANUALLY_REVISED'
    | 'PCP_OP_RELEASED'
    | 'START_OPERACAO'
    | 'PAUSA_OPERACAO'
    | 'RETOMAR_OPERACAO'
    | 'REGISTRO_PERDA'
    | 'PROPAGACAO_LOTE'
    | 'CONCLUSAO_ROTEIRO'
    | 'EXPEDICAO_FINALIZADA'
    | 'AUTH_LOGIN_SUCCESS'
    | 'AUTH_LOGIN_FAILED'
    | 'AUTH_LOGOUT'
    | 'AUTH_PASSWORD_CHANGED'
    | 'AUTH_PASSWORD_RESET'
    | 'AUTH_BLOCKED_ATTEMPTS'
    | 'AUTH_ACCESS_DENIED'
    | 'USER_CREATED'
    | 'USER_UPDATED'
    | 'USER_STATUS_TOGGLED';
  entityType: 'OP' | 'OPERATION' | 'MACHINE' | 'AI_ENGINE' | 'USER' | 'AUTH';
  entityId: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  details: string;
  metadata?: Record<string, any>;
}

const inMemoryAuditLogs: AuditEvent[] = [];

export class ServerAuditService {
  public static log(event: Omit<AuditEvent, 'id' | 'timestamp'>): AuditEvent {
    const fullEvent: AuditEvent = {
      ...event,
      id: `srv_audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    inMemoryAuditLogs.unshift(fullEvent);
    if (inMemoryAuditLogs.length > 1000) {
      inMemoryAuditLogs.pop();
    }
    return fullEvent;
  }

  public static getLogs(limit = 100): AuditEvent[] {
    return inMemoryAuditLogs.slice(0, limit);
  }
}
