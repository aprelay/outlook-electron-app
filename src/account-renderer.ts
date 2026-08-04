type AccountSummary = {
  homeAccountId: string;
  name: string;
  username: string;
  tenantId: string;
};

type AccountState = {
  config: { clientId: string; tenantId: string };
  accounts: AccountSummary[];
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
  openExternal: (url: string) => Promise<void>;
  onDeviceCode: (callback: (prompt: DeviceCodePrompt) => void) => () => void;
};

declare global {
  interface Window {
    accountManager: AccountManagerApi;
  }
}

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Account manager UI is missing ${selector}.`);
  }
  return element;
}

const clientIdInput = requiredElement<HTMLInputElement>('#client-id');
const tenantIdInput = requiredElement<HTMLInputElement>('#tenant-id');
const configForm = requiredElement<HTMLFormElement>('#config-form');
const signInButton = requiredElement<HTMLButtonElement>('#sign-in');
const accountsElement = requiredElement<HTMLDivElement>('#accounts');
const storageStatus = requiredElement<HTMLSpanElement>('#storage-status');
const messageElement = requiredElement<HTMLParagraphElement>('#message');
const deviceCard = requiredElement<HTMLElement>('#device-card');
const deviceMessage = requiredElement<HTMLParagraphElement>('#device-message');
const deviceCode = requiredElement<HTMLElement>('#device-code');
const copyCodeButton = requiredElement<HTMLButtonElement>('#copy-code');
const verificationButton = requiredElement<HTMLButtonElement>('#open-verification');

let currentPrompt: DeviceCodePrompt | null = null;

function setMessage(message: string, isError = false): void {
  messageElement.textContent = message;
  messageElement.classList.toggle('error', isError);
}

function setBusy(busy: boolean): void {
  for (const button of configForm.querySelectorAll<HTMLButtonElement>('button')) {
    button.disabled = busy;
  }
}

function makeButton(label: string, className: string, action: () => Promise<void>): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.className = className;
  button.addEventListener('click', () => void runAction(action));
  return button;
}

function renderState(state: AccountState): void {
  clientIdInput.value = state.config.clientId;
  tenantIdInput.value = state.config.tenantId;
  storageStatus.textContent = state.securePersistenceAvailable ? 'Encrypted storage' : 'Session only';
  storageStatus.classList.toggle('warning', !state.securePersistenceAvailable);
  accountsElement.replaceChildren();

  if (state.accounts.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'No Microsoft account is connected yet.';
    accountsElement.append(empty);
    return;
  }

  for (const account of state.accounts) {
    const container = document.createElement('article');
    container.className = 'account';

    const name = document.createElement('h3');
    name.textContent = account.name;
    const username = document.createElement('p');
    username.textContent = account.username;
    const tenant = document.createElement('p');
    tenant.textContent = `Tenant: ${account.tenantId}`;

    const actions = document.createElement('div');
    actions.className = 'account-actions';
    actions.append(
      makeButton('Refresh session', '', async () => {
        const result = await window.accountManager.refresh(account.homeAccountId);
        const expiry = result.expiresOn ? new Date(result.expiresOn).toLocaleString() : 'unknown';
        setMessage(`Session refreshed. Access expires ${expiry}.`);
      }),
      makeButton('Remove local token', 'danger', async () => {
        renderState(await window.accountManager.remove(account.homeAccountId));
        setMessage('The encrypted local token was removed.');
      }),
    );

    container.append(name, username, tenant, actions);
    accountsElement.append(container);
  }
}

async function runAction(action: () => Promise<void>): Promise<void> {
  setBusy(true);
  setMessage('');
  try {
    await action();
  } catch (error) {
    setMessage(error instanceof Error ? error.message : 'The operation failed.', true);
  } finally {
    setBusy(false);
  }
}

configForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void runAction(async () => {
    renderState(await window.accountManager.saveConfig(clientIdInput.value, tenantIdInput.value));
    setMessage('Microsoft Entra configuration saved.');
  });
});

signInButton.addEventListener('click', () => {
  void runAction(async () => {
    const result = await window.accountManager.signIn();
    deviceCard.hidden = true;
    renderState(await window.accountManager.getState());
    setMessage(`${result.account.username} is connected.`);
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
    void window.accountManager.openExternal(currentPrompt.verificationUri);
  }
});

window.accountManager.onDeviceCode((prompt) => {
  currentPrompt = prompt;
  deviceMessage.textContent = prompt.message;
  deviceCode.textContent = prompt.userCode;
  deviceCard.hidden = false;
});

void runAction(async () => renderState(await window.accountManager.getState()));

export {};
