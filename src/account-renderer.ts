{
type AccountSummary = {
  homeAccountId: string;
  name: string;
  username: string;
  tenantId: string;
  expiresOn: string | null;
  lastRefreshedAt: string | null;
  scopes: string[];
  status: 'active' | 'expired' | 'unknown';
};

type AuditEvent = {
  id: string;
  action: 'connected' | 'refreshed' | 'refresh_failed' | 'removed' | 'configuration_updated';
  account: string | null;
  timestamp: string;
  success: boolean;
};

type AccountState = {
  config: { clientId: string; tenantId: string };
  accounts: AccountSummary[];
  audit: AuditEvent[];
  metrics: {
    totalSessions: number;
    activeSessions: number;
    refreshes24h: number;
    failedRefreshes24h: number;
  };
  securePersistenceAvailable: boolean;
};

type DeviceCodePrompt = {
  userCode: string;
  verificationUri: string;
  message: string;
};

type AccountManagerApi = {
  getState: () => Promise<AccountState>;
  saveConfig: (clientId: string, tenantId: string) => Promise<AccountState>;
  signIn: () => Promise<{ account: AccountSummary; expiresOn: string | null }>;
  refresh: (homeAccountId: string) => Promise<{ account: AccountSummary; expiresOn: string | null }>;
  remove: (homeAccountId: string) => Promise<AccountState>;
  removeAll: () => Promise<AccountState>;
  openExternal: (url: string) => Promise<void>;
  onDeviceCode: (callback: (prompt: DeviceCodePrompt) => void) => () => void;
};

const dashboardApi = (window as unknown as { accountManager: AccountManagerApi }).accountManager;

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Token dashboard is missing ${selector}.`);
  }
  return element;
}

const clientIdInput = requiredElement<HTMLInputElement>('#client-id');
const tenantIdInput = requiredElement<HTMLInputElement>('#tenant-id');
const configForm = requiredElement<HTMLFormElement>('#config-form');
const connectButton = requiredElement<HTMLButtonElement>('#connect-account');
const settingsConnectButton = requiredElement<HTMLButtonElement>('#settings-connect');
const overviewSessions = requiredElement<HTMLDivElement>('#overview-sessions');
const sessionCards = requiredElement<HTMLDivElement>('#session-cards');
const auditBody = requiredElement<HTMLTableSectionElement>('#audit-body');
const storageStatus = requiredElement<HTMLSpanElement>('#storage-status');
const sidebarStorage = requiredElement<HTMLSpanElement>('#sidebar-storage');
const messageElement = requiredElement<HTMLParagraphElement>('#message');
const deviceModal = requiredElement<HTMLDivElement>('#device-modal');
const deviceMessage = requiredElement<HTMLParagraphElement>('#device-message');
const deviceCode = requiredElement<HTMLElement>('#device-code');
const copyCodeButton = requiredElement<HTMLButtonElement>('#copy-code');
const verificationButton = requiredElement<HTMLButtonElement>('#open-verification');
const permissionsButton = requiredElement<HTMLButtonElement>('#open-permissions');
const removeAllButton = requiredElement<HTMLButtonElement>('#remove-all');
const viewTitle = requiredElement<HTMLHeadingElement>('#view-title');

let currentState: AccountState | null = null;
let currentPrompt: DeviceCodePrompt | null = null;

function setText(selector: string, value: string | number): void {
  requiredElement<HTMLElement>(selector).textContent = String(value);
}

function setMessage(message: string, isError = false): void {
  messageElement.textContent = message;
  messageElement.classList.toggle('error', isError);
}

function setBusy(busy: boolean): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('button')) {
    if (!button.closest('#device-modal')) {
      button.disabled = busy;
    }
  }
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : 'Not available';
}

function labelForAction(action: AuditEvent['action']): string {
  const labels: Record<AuditEvent['action'], string> = {
    connected: 'Account connected',
    refreshed: 'Session refreshed',
    refresh_failed: 'Refresh failed',
    removed: 'Local session removed',
    configuration_updated: 'Configuration updated',
  };
  return labels[action];
}

function emptyState(text: string): HTMLParagraphElement {
  const empty = document.createElement('p');
  empty.className = 'empty';
  empty.textContent = text;
  return empty;
}

function statusElement(account: AccountSummary): HTMLSpanElement {
  const status = document.createElement('span');
  status.className = `status-dot ${account.status}`;
  status.textContent = account.status === 'unknown' ? 'Expiry unknown' : account.status;
  return status;
}

function actionButton(
  label: string,
  className: string,
  action: () => Promise<void>,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', () => void runAction(action));
  return button;
}

function renderOverview(accounts: AccountSummary[]): void {
  overviewSessions.replaceChildren();
  if (accounts.length === 0) {
    overviewSessions.append(emptyState('No Microsoft sessions are connected.'));
    return;
  }

  for (const account of accounts) {
    const row = document.createElement('div');
    row.className = 'session-row';
    const identity = document.createElement('div');
    identity.className = 'session-identity';
    const name = document.createElement('strong');
    name.textContent = account.name;
    const username = document.createElement('span');
    username.textContent = account.username;
    identity.append(name, username);

    const refreshed = document.createElement('span');
    refreshed.textContent = account.lastRefreshedAt
      ? `Refreshed ${new Date(account.lastRefreshedAt).toLocaleString()}`
      : 'Not refreshed yet';
    row.append(identity, statusElement(account), refreshed);
    overviewSessions.append(row);
  }
}

function renderSessions(accounts: AccountSummary[]): void {
  sessionCards.replaceChildren();
  if (accounts.length === 0) {
    sessionCards.append(emptyState('Connect a Microsoft account to manage its session.'));
    return;
  }

  for (const account of accounts) {
    const card = document.createElement('article');
    card.className = 'session-card';
    const header = document.createElement('div');
    header.className = 'session-card-header';
    const identity = document.createElement('div');
    const name = document.createElement('h3');
    name.textContent = account.name;
    const username = document.createElement('p');
    username.textContent = account.username;
    identity.append(name, username);
    header.append(identity, statusElement(account));

    const details = document.createElement('dl');
    const detailValues = [
      ['Expires', formatDate(account.expiresOn)],
      ['Last refreshed', formatDate(account.lastRefreshedAt)],
      ['Tenant', account.tenantId],
    ];
    for (const [label, value] of detailValues) {
      const item = document.createElement('div');
      const term = document.createElement('dt');
      term.textContent = label;
      const description = document.createElement('dd');
      description.textContent = value;
      item.append(term, description);
      details.append(item);
    }

    const scopes = document.createElement('div');
    scopes.className = 'scopes';
    for (const scopeName of account.scopes) {
      const scope = document.createElement('span');
      scope.className = 'scope';
      scope.textContent = scopeName;
      scopes.append(scope);
    }
    if (account.scopes.length === 0) {
      scopes.append(emptyState('Scopes become available after sign-in or refresh.'));
    }

    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.append(
      actionButton('Force refresh', '', async () => {
        const result = await dashboardApi.refresh(account.homeAccountId);
        await refreshState();
        setMessage(`Session refreshed. Access expires ${formatDate(result.expiresOn)}.`);
      }),
      actionButton('Review Microsoft permissions', '', async () => {
        await dashboardApi.openExternal('https://myaccount.microsoft.com/');
      }),
      actionButton('Remove local session', 'danger', async () => {
        currentState = await dashboardApi.remove(account.homeAccountId);
        renderState(currentState);
        setMessage('The encrypted local session was removed.');
      }),
    );

    card.append(header, details, scopes, actions);
    sessionCards.append(card);
  }
}

function renderAudit(audit: AuditEvent[]): void {
  auditBody.replaceChildren();
  if (audit.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.className = 'empty';
    cell.textContent = 'No token lifecycle activity yet.';
    row.append(cell);
    auditBody.append(row);
    return;
  }

  for (const event of audit) {
    const row = document.createElement('tr');
    const values = [
      labelForAction(event.action),
      event.account ?? 'Application',
      event.success ? 'Success' : 'Failed',
      new Date(event.timestamp).toLocaleString(),
    ];
    values.forEach((value, index) => {
      const cell = document.createElement('td');
      cell.textContent = value;
      if (index === 2) {
        cell.className = event.success ? 'audit-success' : 'audit-failed';
      }
      row.append(cell);
    });
    auditBody.append(row);
  }
}

function renderState(state: AccountState): void {
  currentState = state;
  clientIdInput.value = state.config.clientId;
  tenantIdInput.value = state.config.tenantId;
  setText('#metric-total', state.metrics.totalSessions);
  setText('#metric-active', state.metrics.activeSessions);
  setText('#metric-refreshes', state.metrics.refreshes24h);
  setText('#metric-failures', state.metrics.failedRefreshes24h);

  const storageLabel = state.securePersistenceAvailable ? 'Encrypted storage' : 'Session-only storage';
  storageStatus.textContent = storageLabel;
  storageStatus.classList.toggle('warning', !state.securePersistenceAvailable);
  sidebarStorage.textContent = state.securePersistenceAvailable
    ? 'OS-encrypted token cache'
    : 'No secure OS keyring detected';

  renderOverview(state.accounts);
  renderSessions(state.accounts);
  renderAudit(state.audit);
}

async function refreshState(): Promise<void> {
  const state = await dashboardApi.getState();
  renderState(state);
}

async function runAction(action: () => Promise<void>): Promise<void> {
  setBusy(true);
  setMessage('');
  try {
    await action();
  } catch (error) {
    const message = error instanceof Error
      ? error.message.replace(/^Error invoking remote method '[^']+': Error: /, '')
      : 'The operation failed.';
    setMessage(message, true);
  } finally {
    setBusy(false);
  }
}

function showView(view: string): void {
  for (const item of document.querySelectorAll<HTMLElement>('.view')) {
    item.classList.toggle('active', item.id === `view-${view}`);
  }
  for (const item of document.querySelectorAll<HTMLButtonElement>('.nav-item')) {
    item.classList.toggle('active', item.dataset.view === view);
  }
  const titles: Record<string, string> = {
    overview: 'Token Overview',
    sessions: 'Session Management',
    audit: 'Audit Log',
    settings: 'Settings',
  };
  viewTitle.textContent = titles[view] ?? 'Token Manager';
}

async function connectAccount(): Promise<void> {
  if (!currentState?.config.clientId) {
    showView('settings');
    setMessage('Save your Microsoft Entra client ID before connecting.', true);
    return;
  }

  const result = await dashboardApi.signIn();
  deviceModal.hidden = true;
  currentPrompt = null;
  await refreshState();
  showView('sessions');
  setMessage(`${result.account.username} is connected.`);
}

for (const navItem of document.querySelectorAll<HTMLButtonElement>('.nav-item')) {
  navItem.addEventListener('click', () => showView(navItem.dataset.view ?? 'overview'));
}

connectButton.addEventListener('click', () => void runAction(connectAccount));
settingsConnectButton.addEventListener('click', () => void runAction(connectAccount));

configForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void runAction(async () => {
    const state = await dashboardApi.saveConfig(clientIdInput.value, tenantIdInput.value);
    renderState(state);
    setMessage('Microsoft Entra configuration saved.');
  });
});

copyCodeButton.addEventListener('click', () => {
  if (currentPrompt) {
    void navigator.clipboard.writeText(currentPrompt.userCode);
    setMessage('Device code copied.');
  }
});

verificationButton.addEventListener('click', () => {
  if (currentPrompt) {
    void dashboardApi.openExternal(currentPrompt.verificationUri);
  }
});

permissionsButton.addEventListener('click', () => {
  void dashboardApi.openExternal('https://myaccount.microsoft.com/');
});

removeAllButton.addEventListener('click', () => {
  if (!window.confirm('Remove every locally cached Microsoft session from this app?')) {
    return;
  }
  void runAction(async () => {
    const state = await dashboardApi.removeAll();
    renderState(state);
    setMessage('All encrypted local sessions were removed.');
  });
});

dashboardApi.onDeviceCode((prompt) => {
  currentPrompt = prompt;
  deviceMessage.textContent = prompt.message;
  deviceCode.textContent = prompt.userCode;
  deviceModal.hidden = false;
});

void runAction(refreshState);
}
