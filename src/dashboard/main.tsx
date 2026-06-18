import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Dashboard } from './components/Dashboard';
import { CapturePage } from './components/CapturePage';
import './styles/dashboard.css';
import './styles/capture.css';

function App(): React.ReactElement {
  const [route, setRoute] = useState(window.location.hash);

  useEffect(() => {
    function onHashChange(): void {
      setRoute(window.location.hash);
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (route === '#capture' || route.startsWith('#capture?')) {
    return <CapturePage />;
  }

  return <Dashboard />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
