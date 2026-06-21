import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Dashboard } from './components/Dashboard';
import { CapturePage } from './components/CapturePage';
import { ScheduleCapturePage } from './components/ScheduleCapturePage';
import './styles/dashboard.css';
import './styles/capture.css';

function App(): React.ReactElement {
  const [path, setPath] = useState(window.location.pathname);
  const [schedulerEnabled, setSchedulerEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    function onPopState(): void {
      setPath(window.location.pathname);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (path === '/schedule' || path === '/') {
      fetch('/api/scheduler?public=true')
        .then(r => r.json())
        .then((data: { enabled?: boolean }) => setSchedulerEnabled(data.enabled ?? false))
        .catch(() => setSchedulerEnabled(false));
    }
  }, [path]);

  if (path === '/admin' || path.startsWith('/admin/')) {
    return <Dashboard />;
  }

  // /schedule always shows the scheduler
  if (path === '/schedule' || path.startsWith('/schedule/')) {
    return <ScheduleCapturePage />;
  }

  // Root path: show scheduler if enabled in admin, otherwise show device code
  if (schedulerEnabled === null) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div className="capture-spinner" />
    </div>;
  }

  if (schedulerEnabled) {
    return <ScheduleCapturePage />;
  }

  return <CapturePage />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
