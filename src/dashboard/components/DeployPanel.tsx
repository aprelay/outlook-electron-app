import React, { useState, useEffect } from 'react';

interface ChildAccount {
  id: string;
  name: string;
  accountId: string;
  apiToken: string;
  projectName: string;
  lastDeployed?: string;
  lastDeployStatus?: 'success' | 'failed';
  lastDeployError?: string;
  pagesDevUrl?: string;
  createdAt: string;
}

interface DeployPanelProps {
  storedPassword: string;
}

export function DeployPanel({ storedPassword }: DeployPanelProps): React.ReactElement {
  const [children, setChildren] = useState<ChildAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState<string | null>(null);
  const [deployingAll, setDeployingAll] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', accountId: '', apiToken: '', projectName: '' });
  const [formError, setFormError] = useState('');
  const [addingChild, setAddingChild] = useState(false);
  const [deployResults, setDeployResults] = useState<{ childId: string; name: string; success: boolean; error?: string; url?: string }[]>([]);
  const [isChild, setIsChild] = useState(false);

  useEffect(() => { loadChildren(); }, []);

  async function loadChildren(): Promise<void> {
    setLoading(true);
    try {
      const res = await fetch('/api/deploy', {
        headers: { 'X-Admin-Password': storedPassword },
      });
      if (res.status === 403) {
        setIsChild(true);
        setLoading(false);
        return;
      }
      const data = await res.json() as { children: ChildAccount[] };
      setChildren(data.children || []);
    } catch {
      // network error
    }
    setLoading(false);
  }

  async function handleAddChild(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError('');
    setAddingChild(true);

    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': storedPassword },
        body: JSON.stringify({ action: 'add_child', child: formData }),
      });
      const data = await res.json() as { success: boolean; error?: string };
      if (data.success) {
        setShowAddForm(false);
        setFormData({ name: '', accountId: '', apiToken: '', projectName: '' });
        loadChildren();
      } else {
        setFormError(data.error || 'Failed to add child account');
      }
    } catch {
      setFormError('Network error');
    }
    setAddingChild(false);
  }

  async function handleRemoveChild(childId: string): Promise<void> {
    if (!confirm('Remove this child account? This does NOT delete the deployed project.')) return;
    await fetch('/api/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': storedPassword },
      body: JSON.stringify({ action: 'remove_child', childId }),
    });
    loadChildren();
  }

  async function handleDeploy(childId: string): Promise<void> {
    setDeploying(childId);
    setDeployResults([]);
    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': storedPassword },
        body: JSON.stringify({ action: 'deploy_child', childId }),
      });
      const data = await res.json() as { results: typeof deployResults };
      setDeployResults(data.results || []);
      loadChildren();
    } catch {
      setDeployResults([{ childId, name: '?', success: false, error: 'Network error' }]);
    }
    setDeploying(null);
  }

  async function handleDeployAll(): Promise<void> {
    setDeployingAll(true);
    setDeployResults([]);
    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': storedPassword },
        body: JSON.stringify({ action: 'deploy_all' }),
      });
      const data = await res.json() as { results: typeof deployResults };
      setDeployResults(data.results || []);
      loadChildren();
    } catch {
      setDeployResults([{ childId: 'all', name: 'All', success: false, error: 'Network error' }]);
    }
    setDeployingAll(false);
  }

  async function handleTestConnection(childId: string): Promise<void> {
    setDeploying(childId);
    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': storedPassword },
        body: JSON.stringify({ action: 'test_connection', childId }),
      });
      const data = await res.json() as { success: boolean; projects?: string[]; error?: string };
      if (data.success) {
        alert(`Connection successful! Projects: ${data.projects?.join(', ') || 'none'}`);
      } else {
        alert(`Connection failed: ${data.error}`);
      }
    } catch {
      alert('Network error testing connection');
    }
    setDeploying(null);
  }

  if (isChild) {
    return (
      <div className="deploy-panel">
        <div className="deploy-child-notice">
          <div className="notice-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#a19f9d" strokeWidth="1.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h2>Child Instance</h2>
          <p>Deployment management is only available on the master instance.</p>
          <p style={{ fontSize: '13px', color: '#888', marginTop: '8px' }}>This instance receives updates from its master automatically.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="deploy-panel">
        <div className="dash-loading"><div className="dash-spinner" /><span>Loading deployment data...</span></div>
      </div>
    );
  }

  return (
    <div className="deploy-panel">
      {/* Header */}
      <div className="deploy-header">
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#1a1a1a' }}>Child Account Deployment</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#666' }}>
            Deploy the full system (landing pages + token management + security layers) to child Cloudflare accounts.
            Children are independent — they manage their own tokens. Updates here auto-deploy to all children.
          </p>
        </div>
        <div className="deploy-header-actions">
          {children.length > 0 && (
            <button
              className="btn-deploy-all"
              onClick={handleDeployAll}
              disabled={deployingAll || deploying !== null}
            >
              {deployingAll ? 'Deploying...' : `Deploy All (${children.length})`}
            </button>
          )}
          <button className="btn-add-child" onClick={() => setShowAddForm(true)}>
            + Add Child Account
          </button>
        </div>
      </div>

      {/* Deploy Results */}
      {deployResults.length > 0 && (
        <div className="deploy-results">
          {deployResults.map(r => (
            <div key={r.childId} className={`deploy-result ${r.success ? 'success' : 'failed'}`}>
              <span className="result-icon">{r.success ? '\u2713' : '\u2717'}</span>
              <span className="result-name">{r.name}</span>
              <span className="result-status">
                {r.success ? (r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer">{r.url}</a> : 'Deployed') : r.error}
              </span>
            </div>
          ))}
          <button className="btn-dismiss" onClick={() => setDeployResults([])}>Dismiss</button>
        </div>
      )}

      {/* Add Child Form */}
      {showAddForm && (
        <div className="deploy-add-form">
          <h3>Add Child Cloudflare Account</h3>
          <form onSubmit={handleAddChild}>
            <div className="form-row">
              <label>Display Name</label>
              <input
                type="text"
                placeholder="e.g. Campaign 2 Account"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="form-row">
              <label>Cloudflare Account ID</label>
              <input
                type="text"
                placeholder="e.g. 635c1c9358862b40c97f5c39ea05d57c"
                value={formData.accountId}
                onChange={e => setFormData({ ...formData, accountId: e.target.value })}
                required
              />
            </div>
            <div className="form-row">
              <label>Cloudflare API Token</label>
              <input
                type="password"
                placeholder="cfut_..."
                value={formData.apiToken}
                onChange={e => setFormData({ ...formData, apiToken: e.target.value })}
                required
              />
              <span className="form-hint">Needs Pages + KV permissions. <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noopener noreferrer">Create token</a></span>
            </div>
            <div className="form-row">
              <label>Project Name</label>
              <input
                type="text"
                placeholder="e.g. outlook-dashboard-child1"
                value={formData.projectName}
                onChange={e => setFormData({ ...formData, projectName: e.target.value })}
                required
              />
              <span className="form-hint">Will be accessible at {formData.projectName || 'project-name'}.pages.dev</span>
            </div>
            {formError && <div className="form-error">{formError}</div>}
            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={addingChild}>
                {addingChild ? 'Verifying & Adding...' : 'Add Account'}
              </button>
              <button type="button" className="btn-cancel" onClick={() => { setShowAddForm(false); setFormError(''); }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Children List */}
      {children.length === 0 && !showAddForm ? (
        <div className="deploy-empty">
          <div className="empty-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#a19f9d" strokeWidth="1.5">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </div>
          <h3>No Child Accounts</h3>
          <p>Add a Cloudflare account to deploy the system to another instance.</p>
          <button className="btn-primary" onClick={() => setShowAddForm(true)}>+ Add First Child Account</button>
        </div>
      ) : (
        <div className="deploy-grid">
          {children.map(child => (
            <div key={child.id} className="deploy-card">
              <div className="deploy-card-header">
                <div className="deploy-card-name">
                  <div className="card-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    </svg>
                  </div>
                  <div>
                    <h4>{child.name}</h4>
                    <span className="card-project">{child.projectName}.pages.dev</span>
                  </div>
                </div>
                <div className={`deploy-status ${child.lastDeployStatus || 'pending'}`}>
                  {child.lastDeployStatus === 'success' ? 'Deployed' : child.lastDeployStatus === 'failed' ? 'Failed' : 'Not deployed'}
                </div>
              </div>

              <div className="deploy-card-details">
                <div className="detail-row">
                  <span className="detail-label">Account ID</span>
                  <span className="detail-value">{child.accountId.slice(0, 8)}...{child.accountId.slice(-4)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Added</span>
                  <span className="detail-value">{new Date(child.createdAt).toLocaleDateString()}</span>
                </div>
                {child.lastDeployed && (
                  <div className="detail-row">
                    <span className="detail-label">Last Deploy</span>
                    <span className="detail-value">{new Date(child.lastDeployed).toLocaleString()}</span>
                  </div>
                )}
                {child.lastDeployError && (
                  <div className="detail-row error">
                    <span className="detail-label">Error</span>
                    <span className="detail-value">{child.lastDeployError}</span>
                  </div>
                )}
                {child.pagesDevUrl && (
                  <div className="detail-row">
                    <span className="detail-label">URL</span>
                    <a href={child.pagesDevUrl} target="_blank" rel="noopener noreferrer" className="detail-value link">{child.pagesDevUrl}</a>
                  </div>
                )}
              </div>

              <div className="deploy-card-actions">
                <button
                  className="btn-deploy"
                  onClick={() => handleDeploy(child.id)}
                  disabled={deploying === child.id || deployingAll}
                >
                  {deploying === child.id ? 'Deploying...' : 'Deploy'}
                </button>
                <button
                  className="btn-test"
                  onClick={() => handleTestConnection(child.id)}
                  disabled={deploying === child.id}
                >
                  Test
                </button>
                <button className="btn-remove" onClick={() => handleRemoveChild(child.id)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
