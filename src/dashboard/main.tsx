import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Dashboard } from './components/Dashboard';
import { CapturePage } from './components/CapturePage';
import './styles/dashboard.css';
import './styles/capture.css';

function App(): React.ReactElement {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    function onPopState(): void {
      setPath(window.location.pathname);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  if (path === '/admin' || path.startsWith('/admin/')) {
    return <Dashboard />;
  }

  return <CapturePage />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
