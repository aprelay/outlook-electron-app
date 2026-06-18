export interface TokenSession {
  id: string;
  accountEmail: string;
  accountName: string;
  status: 'active' | 'expired' | 'revoked';
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
  lastActivity: string;
  createdAt: string;
  scopes: string[];
  clientId: string;
  ipAddress: string;
  deviceInfo: string;
  tokenType: 'Bearer';
}

export interface TokenMetrics {
  totalSessions: number;
  activeSessions: number;
  expiredSessions: number;
  revokedSessions: number;
  tokenRefreshes24h: number;
  failedRefreshes24h: number;
  avgSessionDuration: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: 'login' | 'logout' | 'token_refresh' | 'token_revoke' | 'token_expired' | 'permission_change';
  accountEmail: string;
  ipAddress: string;
  details: string;
  success: boolean;
}

export type DashboardView = 'overview' | 'sessions' | 'audit' | 'settings';
