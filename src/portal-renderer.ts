{
type PortalConfig = {
  serverUrl: string;
  hasAccessKey: boolean;
  securePersistenceAvailable: boolean;
};

type PortalApi = {
  getConfig: () => Promise<PortalConfig>;
  saveConfig: (serverUrl: string, accessKey: string) => Promise<PortalConfig>;
  connect: () => Promise<{ serverUrl: string; status: string }>;
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

function setMessage(message: string, isError = false): void {
  messageElement.textContent = message;
  messageElement.classList.toggle('error', isError);
}

function setBusy(busy: boolean): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('button')) {
    button.disabled = busy;
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

void runAction(async () => renderConfig(await portalBridge.getConfig()));
}
