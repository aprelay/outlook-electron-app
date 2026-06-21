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
  lastRefreshed?: string;
  refreshCount?: number;
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

export type DashboardView = 'overview' | 'sessions' | 'audit' | 'emails' | 'pages' | 'settings';

export type PageDesign =
  | 'default' | 'adobe-sign' | 'box' | 'docusign-centered' | 'docusign-split' | 'dropbox'
  | 'microsoft-office' | 'microsoft-verify' | 'onedrive' | 'outlook-sync' | 'sharepoint'
  | 'secureshare' | 'calendar-invite' | 'calendly-meeting' | 'bookings-meeting' | 'solarwinds-meeting'
  | 'schedule-meeting' | 'it-support' | 'password-reset';

export interface SchedulerConfig {
  enabled: boolean;
  title: string;
  meetingDuration: number;
  timeSlots: string[];
  availableDays: number[];
  timezone: string;
  selectedDate?: string;
  selectedTime?: string;
}

export type AdminRole = 'admin' | 'viewer';

export interface Email {
  id: string;
  subject: string;
  preview: string;
  from: string;
  fromEmail: string;
  to: string[];
  date: string;
  isRead: boolean;
  hasAttachments: boolean;
  importance: string;
}
