import type { TokenSession, AuditLogEntry } from '../types';

const SESSIONS_KEY = 'outlook_token_sessions';
const AUDIT_KEY = 'outlook_audit_log';
const PENDING_CODE_KEY = 'outlook_pending_device_code';

export interface PendingDeviceCode {
  deviceCode: string;
  userCode: string;
  expiresAt: number;
  interval: number;
}

export function savePendingCode(pending: PendingDeviceCode): void {
  localStorage.setItem(PENDING_CODE_KEY, JSON.stringify(pending));
}

export function getPendingCode(): PendingDeviceCode | null {
  try {
    const data = localStorage.getItem(PENDING_CODE_KEY);
    if (!data) return null;
    const pending = JSON.parse(data) as PendingDeviceCode;
    if (Date.now() > pending.expiresAt) {
      clearPendingCode();
      return null;
    }
    return pending;
  } catch {
    return null;
  }
}

export function clearPendingCode(): void {
  localStorage.removeItem(PENDING_CODE_KEY);
}

export function getSessions(): TokenSession[] {
  try {
    const data = localStorage.getItem(SESSIONS_KEY);
    return data ? JSON.parse(data) as TokenSession[] : [];
  } catch {
    return [];
  }
}

export function saveSessions(sessions: TokenSession[]): void {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function addSession(session: TokenSession): void {
  const sessions = getSessions();
  const existing = sessions.findIndex((s) => s.id === session.id);
  if (existing >= 0) {
    sessions[existing] = session;
  } else {
    sessions.unshift(session);
  }
  saveSessions(sessions);
}

export function revokeSession(sessionId: string): void {
  const sessions = getSessions();
  const updated = sessions.map((s) =>
    s.id === sessionId ? { ...s, status: 'revoked' as const } : s
  );
  saveSessions(updated);
}

export function revokeAllSessions(): void {
  const sessions = getSessions();
  const updated = sessions.map((s) =>
    s.status === 'active' ? { ...s, status: 'revoked' as const } : s
  );
  saveSessions(updated);
}

export function getAuditLog(): AuditLogEntry[] {
  try {
    const data = localStorage.getItem(AUDIT_KEY);
    return data ? JSON.parse(data) as AuditLogEntry[] : [];
  } catch {
    return [];
  }
}

export function addAuditEntry(entry: AuditLogEntry): void {
  const log = getAuditLog();
  log.unshift(entry);
  if (log.length > 200) log.length = 200;
  localStorage.setItem(AUDIT_KEY, JSON.stringify(log));
}

export function createSessionFromToken(opts: {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  email: string;
  displayName: string;
  scopes: string[];
}): TokenSession {
  const now = new Date();
  return {
    id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    accountEmail: opts.email,
    accountName: opts.displayName,
    status: 'active',
    accessTokenExpiry: new Date(now.getTime() + opts.expiresIn * 1000).toISOString(),
    refreshTokenExpiry: new Date(now.getTime() + 90 * 24 * 3600 * 1000).toISOString(),
    lastActivity: now.toISOString(),
    createdAt: now.toISOString(),
    scopes: opts.scopes,
    clientId: 'd3590ed6-52b3-4102-aeff-aad2292ab01c',
    ipAddress: 'Web Client',
    deviceInfo: `${navigator.userAgent.includes('Windows') ? 'Windows' : navigator.userAgent.includes('Mac') ? 'macOS' : 'Linux'} — ${navigator.userAgent.includes('Chrome') ? 'Chrome' : navigator.userAgent.includes('Firefox') ? 'Firefox' : 'Browser'}`,
    tokenType: 'Bearer',
  };
}
