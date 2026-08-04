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

type PortalApi = {
  getConfig: () => Promise<PortalConfig>;
  saveConfig: (serverUrl: string, accessKey: string) => Promise<PortalConfig>;
  connect: () => Promise<{ serverUrl: string; status: string }>;
  getDeviceConfig: () => Promise<{ clientId: string; tenantId: string }>;
  startDeviceCode: (clientId: string, tenantId: string) => Promise<{ account: { username: string } }>;
  openExternal: (url: string) => Promise<void>;
  onDeviceCode: (callback: (prompt: DeviceCodePrompt) => void) => () => void;
  openOutlook: () => Promise<void>;
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
const tokenDashboardButton = requiredElement<HTMLButtonElement>('#token-dashboard');
const adminCenterButton = requiredElement<HTMLButtonElement>('#admin-center');
const deviceClientIdInput = requiredElement<HTMLInputElement>('#device-client-id');
const deviceTenantInput = requiredElement<HTMLInputElement>('#device-tenant');
const deviceSignInButton = requiredElement<HTMLButtonElement>('#device-sign-in');
const deviceModal = requiredElement<HTMLDivElement>('#device-modal');
const deviceMessage = requiredElement<HTMLParagraphElement>('#device-message');
const deviceCode = requiredElement<HTMLElement>('#device-code');
const copyDeviceCodeButton = requiredElement<HTMLButtonElement>('#copy-device-code');
const openDeviceLoginButton = requiredElement<HTMLButtonElement>('#open-device-login');

let currentDevicePrompt: DeviceCodePrompt | null = null;

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

tokenDashboardButton.addEventListener('click', () => {
  void runAction(async () => portalBridge.openTokenDashboard());
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

void runAction(async () => {
  const [portalConfig, deviceConfig] = await Promise.all([
    portalBridge.getConfig(),
    portalBridge.getDeviceConfig(),
  ]);
  renderConfig(portalConfig);
  deviceClientIdInput.value = deviceConfig.clientId;
  deviceTenantInput.value = deviceConfig.tenantId;
});
}
