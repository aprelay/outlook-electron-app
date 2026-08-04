{
type PortalConfig = {
  serverUrl: string;
  hasAccessKey: boolean;
  securePersistenceAvailable: boolean;
};

type DeviceCodePrompt = {
  userCode: string;
  verificationUri: string;
  message: string;
};

type BrowserSessionStatus = {
  signedIn: boolean;
  cookieCount: number;
  domains: string[];
  updatedAt: string;
};

type AccountSummary = {
  homeAccountId: string;
  username: string;
  expiresOn: string | null;
  status: 'active' | 'expired' | 'unknown';
};

type AccountState = {
  accounts: AccountSummary[];
};

type ResourceTokenStatus = {
  resource: string;
  status: 'active' | 'unavailable';
  expiresOn: string | null;
};

type PortalApi = {
  getConfig: () => Promise<PortalConfig>;
  saveConfig: (serverUrl: string, accessKey: string) => Promise<PortalConfig>;
  connect: () => Promise<{ serverUrl: string; status: string }>;
  getDeviceConfig: () => Promise<{ clientId: string; tenantId: string }>;
  startDeviceCode: (clientId: string, tenantId: string) => Promise<{ account: { username: string } }>;
  openExternal: (url: string) => Promise<void>;
  onDeviceCode: (callback: (prompt: DeviceCodePrompt) => void) => () => void;
  openOutlook: () => Promise<void>;
  openMsOffice: () => Promise<void>;
  getSessionStatus: () => Promise<BrowserSessionStatus>;
  clearSession: () => Promise<BrowserSessionStatus>;
  getAccountSummary: () => Promise<AccountState>;
  refreshAccount: (homeAccountId: string) => Promise<{ account: AccountSummary }>;
  removeAccount: (homeAccountId: string) => Promise<AccountState>;
  exchangeTokens: (homeAccountId: string) => Promise<ResourceTokenStatus[]>;
  openTokenDashboard: () => Promise<void>;
  openAdminCenter: () => Promise<void>;
};

const portalBridge = (window as unknown as { outlookPortal: PortalApi }).outlookPortal;

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Outlook Portal is missing ${selector}.`);
  }
  return element;
}

const connectionForm = requiredElement<HTMLFormElement>('#connection-form');
const serverUrlInput = requiredElement<HTMLInputElement>('#server-url');
const accessKeyInput = requiredElement<HTMLInputElement>('#access-key');
const storageLabel = requiredElement<HTMLElement>('#storage-label');
const messageElement = requiredElement<HTMLParagraphElement>('#connection-message');
const browserSessionsButton = requiredElement<HTMLButtonElement>('#browser-sessions');
const tokenExchangeButton = requiredElement<HTMLButtonElement>('#token-exchange');
const adminCenterButton = requiredElement<HTMLButtonElement>('#admin-center');
const deviceClientIdInput = requiredElement<HTMLInputElement>('#device-client-id');
const deviceTenantInput = requiredElement<HTMLInputElement>('#device-tenant');
const deviceSignInButton = requiredElement<HTMLButtonElement>('#device-sign-in');
const deviceModal = requiredElement<HTMLDivElement>('#device-modal');
const deviceMessage = requiredElement<HTMLParagraphElement>('#device-message');
const deviceCode = requiredElement<HTMLElement>('#device-code');
const copyDeviceCodeButton = requiredElement<HTMLButtonElement>('#copy-device-code');
const openDeviceLoginButton = requiredElement<HTMLButtonElement>('#open-device-login');
const methodDeviceTab = requiredElement<HTMLButtonElement>('#method-device');
const methodOfficeTab = requiredElement<HTMLButtonElement>('#method-office');
const devicePanel = requiredElement<HTMLDivElement>('#device-panel');
const officePanel = requiredElement<HTMLDivElement>('#office-panel');
const officeSignInButton = requiredElement<HTMLButtonElement>('#office-sign-in');
const sessionBadge = requiredElement<HTMLElement>('#session-badge');
const sessionDetail = requiredElement<HTMLParagraphElement>('#session-detail');
const sessionRefreshButton = requiredElement<HTMLButtonElement>('#session-refresh');
const sessionClearButton = requiredElement<HTMLButtonElement>('#session-clear');
const tokenBadge = requiredElement<HTMLElement>('#token-badge');
const tokenDetail = requiredElement<HTMLParagraphElement>('#token-detail');
const tokenRefreshButton = requiredElement<HTMLButtonElement>('#token-refresh');
const tokenRemoveButton = requiredElement<HTMLButtonElement>('#token-remove');

let currentDevicePrompt: DeviceCodePrompt | null = null;
let currentAccount: AccountSummary | null = null;

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
  if (!busy && !currentAccount) {
    tokenRefreshButton.disabled = true;
    tokenRemoveButton.disabled = true;
  }
}

async function runAction(action: () => Promise<void>): Promise<void> {
  setBusy(true);
  setMessage('');
  try {
    await action();
  } catch (error) {
    const message = error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : 'The operation failed.';
    setMessage(message, true);
  } finally {
    setBusy(false);
  }
}

function renderConfig(config: PortalConfig): void {
  serverUrlInput.value = config.serverUrl;
  accessKeyInput.placeholder = config.hasAccessKey
    ? 'Saved securely — enter only to replace'
    : 'Enter your portal access key';
  storageLabel.textContent = config.securePersistenceAvailable
    ? 'OS-encrypted portal credentials'
    : 'Access key kept for this session only';
}

connectionForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void runAction(async () => {
    renderConfig(await portalBridge.saveConfig(serverUrlInput.value, accessKeyInput.value));
    accessKeyInput.value = '';
    const result = await portalBridge.connect();
    setMessage(`Connected securely to ${result.serverUrl}.`);
  });
});

browserSessionsButton.addEventListener('click', () => {
  void runAction(async () => portalBridge.openOutlook());
});

tokenExchangeButton.addEventListener('click', () => {
  void runAction(async () => {
    if (!currentAccount) {
      await portalBridge.openTokenDashboard();
      setMessage('Connect an account (device code or MS Office) to exchange resource tokens.');
      return;
    }
    const results = await portalBridge.exchangeTokens(currentAccount.homeAccountId);
    const summary = results
      .map((item) => `${item.resource}: ${item.status === 'active' ? 'active' : 'unavailable'}`)
      .join(' · ');
    setMessage(`Token exchange complete — ${summary}. Raw tokens are never exposed.`);
  });
});

adminCenterButton.addEventListener('click', () => {
  void runAction(async () => portalBridge.openAdminCenter());
});

deviceSignInButton.addEventListener('click', () => {
  void runAction(async () => {
    const result = await portalBridge.startDeviceCode(
      deviceClientIdInput.value,
      deviceTenantInput.value,
    );
    deviceModal.hidden = true;
    currentDevicePrompt = null;
    setMessage(`${result.account.username} connected with device code.`);
  });
});

copyDeviceCodeButton.addEventListener('click', () => {
  if (currentDevicePrompt) {
    void navigator.clipboard.writeText(currentDevicePrompt.userCode);
    setMessage('Device code copied.');
  }
});

openDeviceLoginButton.addEventListener('click', () => {
  if (currentDevicePrompt) {
    void portalBridge.openExternal(currentDevicePrompt.verificationUri);
  }
});

portalBridge.onDeviceCode((prompt) => {
  currentDevicePrompt = prompt;
  deviceMessage.textContent = prompt.message;
  deviceCode.textContent = prompt.userCode;
  deviceModal.hidden = false;
});

function selectMethod(method: 'device' | 'office'): void {
  const isDevice = method === 'device';
  methodDeviceTab.classList.toggle('is-active', isDevice);
  methodOfficeTab.classList.toggle('is-active', !isDevice);
  methodDeviceTab.setAttribute('aria-selected', String(isDevice));
  methodOfficeTab.setAttribute('aria-selected', String(!isDevice));
  devicePanel.hidden = !isDevice;
  officePanel.hidden = isDevice;
}

methodDeviceTab.addEventListener('click', () => selectMethod('device'));
methodOfficeTab.addEventListener('click', () => selectMethod('office'));

officeSignInButton.addEventListener('click', () => {
  void runAction(async () => {
    await portalBridge.openMsOffice();
    setMessage('Opened the Microsoft sign-in window. Complete login there to persist your session.');
    await refreshSessionStatus();
  });
});

function renderSessionStatus(status: BrowserSessionStatus): void {
  sessionBadge.textContent = status.signedIn ? 'Signed in' : 'Signed out';
  sessionBadge.classList.toggle('ok', status.signedIn);
  sessionBadge.classList.toggle('muted', !status.signedIn);
  sessionDetail.textContent = status.signedIn
    ? `Active Microsoft cookies stored (${status.cookieCount} across ${status.domains.length} domain(s)). Raw cookie values are never shown.`
    : `No Microsoft sign-in cookies stored (${status.cookieCount} cookie(s)).`;
}

function renderTokenStatus(account: AccountSummary | null): void {
  currentAccount = account;
  const hasAccount = Boolean(account);
  tokenRefreshButton.disabled = !hasAccount;
  tokenRemoveButton.disabled = !hasAccount;
  if (!account) {
    tokenBadge.textContent = 'No account';
    tokenBadge.classList.remove('ok');
    tokenBadge.classList.add('muted');
    tokenDetail.textContent = 'No device-code account connected yet.';
    return;
  }
  const active = account.status === 'active';
  tokenBadge.textContent = active ? 'Active' : account.status === 'expired' ? 'Expired' : 'Unknown';
  tokenBadge.classList.toggle('ok', active);
  tokenBadge.classList.toggle('muted', !active);
  const expiry = account.expiresOn
    ? `expires ${new Date(account.expiresOn).toLocaleString()}`
    : 'expiry unknown';
  tokenDetail.textContent = `${account.username} — ${expiry}. Raw access/refresh tokens are never exposed.`;
}

async function refreshSessionStatus(): Promise<void> {
  renderSessionStatus(await portalBridge.getSessionStatus());
}

sessionRefreshButton.addEventListener('click', () => {
  void runAction(refreshSessionStatus);
});

sessionClearButton.addEventListener('click', () => {
  void runAction(async () => {
    renderSessionStatus(await portalBridge.clearSession());
    setMessage('Cleared the Outlook browser session.');
  });
});

tokenRefreshButton.addEventListener('click', () => {
  void runAction(async () => {
    if (!currentAccount) {
      return;
    }
    const result = await portalBridge.refreshAccount(currentAccount.homeAccountId);
    renderTokenStatus(result.account);
    setMessage(`Refreshed the token for ${result.account.username}.`);
  });
});

tokenRemoveButton.addEventListener('click', () => {
  void runAction(async () => {
    if (!currentAccount) {
      return;
    }
    const state = await portalBridge.removeAccount(currentAccount.homeAccountId);
    renderTokenStatus(state.accounts[0] ?? null);
    setMessage('Removed the device-code token.');
  });
});

void runAction(async () => {
  const [portalConfig, deviceConfig, sessionStatus, accountState] = await Promise.all([
    portalBridge.getConfig(),
    portalBridge.getDeviceConfig(),
    portalBridge.getSessionStatus(),
    portalBridge.getAccountSummary(),
  ]);
  renderConfig(portalConfig);
  deviceClientIdInput.value = deviceConfig.clientId || deviceClientIdInput.value;
  deviceTenantInput.value = deviceConfig.tenantId || deviceTenantInput.value;
  renderSessionStatus(sessionStatus);
  renderTokenStatus(accountState.accounts[0] ?? null);
});
}
