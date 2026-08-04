# PR #2 Runtime Test Report — Redesigned Token Dashboard

**Checkout:** `devin/1785830297-outlook-desktop-app` @ `7a4cc6c`

**Result:** FAILED — the Electron app starts and Outlook loads, but the redesigned Token Manager dashboard's renderer throws a startup syntax error and all dashboard interactions are inert.

## Escalation / blocking defect

The account preload exposes `window.accountManager` with `contextBridge.exposeInMainWorld(...)`. The redesigned browser renderer then declares `const accountManager = window.accountManager;` at global scope. In this Electron context, that produces:

```text
SyntaxError: Identifier 'accountManager' has already been declared
```

The exception occurs before any listeners or initial-state rendering are installed. Consequently:

- sidebar remains on **Checking storage**;
- storage-status pill is blank;
- Overview empty-state text never appears;
- Sessions / Audit Log / Settings navigation does not respond;
- Connect Microsoft account does not respond;
- invalid-ID validation, device modal, and external links are unreachable through the UI.

The previous CommonJS `exports is not defined` failure is fixed (compiled renderer contains no `exports` reference), but this replacement global-name collision still prevents the feature from functioning.

## Visual evidence

| Outlook startup — PASS | Dashboard shell / initialization — FAIL |
|---|---|
| ![Outlook loaded](https://app.devin.ai/attachments/e5b95f5a-03a9-44b7-b271-e43bc9f317a9/ss_ec2cb6ee.png) | ![Dashboard failed initialization](https://app.devin.ai/attachments/24c6366b-691c-4146-9c1d-95ea09ff0a48/ss_fc0a1be9.png) |
| Microsoft/Outlook sign-in page loads in the maximized Electron window. | Dashboard shell renders, but Local Security remains “Checking storage,” status pill is blank, and Active Sessions has no empty-state text. Clicking Sessions did not change the active view. |

### Inert connect control — FAIL

![Connect button remains inert](https://app.devin.ai/attachments/4c673367-6419-4d01-bfb0-452b1929ae7d/ss_55ba4c84.png)

After clicking **Connect Microsoft account**, the view remains unchanged; no Settings redirect, error message, or device modal appears.

## Test assertions

- **PASS — App startup and Outlook loading:** Electron main window launched and rendered the Microsoft/Outlook sign-in page.
- **FAIL — Dashboard initialization and empty state:** static metric cards display their HTML defaults of `0`, but dynamic state did not render. Storage status was blank, sidebar stayed “Checking storage,” and “No Microsoft sessions are connected.” was absent.
- **FAIL — Sidebar navigation:** clicking Sessions did not activate the Sessions view or update the title from Token Overview.
- **FAIL — Invalid client-ID validation via UI:** Settings was unreachable and controls were inert. The exact validation error could not be shown to the user.
- **PASS (backend-only diagnostic) — Invalid client-ID rejection:** invoking the intended preload bridge directly through CDP rejected `not-a-valid-guid` with `Enter the Application (client) ID from Microsoft Entra.` This does not rescue the broken UI result.
- **PASS — Renderer isolation and bridge allowlist:** in both renderers, `process`, `require`, and `module` were `undefined`. Outlook had no `window.accountManager`. The account renderer exposed exactly: `getState`, `saveConfig`, `signIn`, `refresh`, `remove`, `removeAll`, `openExternal`, `onDeviceCode`; no extra internals were visible.
- **PASS (backend-only diagnostic) — Device-code initiation and prompt hygiene:** using Microsoft's public Azure CLI client ID initiated device code through the real IPC bridge. The renderer received only `userCode`, `verificationUri`, `expiresIn`, and `message`. No raw `deviceCode`, access token, refresh token, or JWT was present. The ephemeral user code is intentionally omitted from artifacts.
- **UNTESTED — Device-code modal and external verification navigation:** renderer crash makes the modal and link unreachable through the UI.
- **UNTESTED — Microsoft permissions external link:** Settings is unreachable.
- **UNTESTED — Account expiry/scopes/status, force refresh, per-account removal, and remove-all:** no live interactive Microsoft login was completed, and the dashboard UI is inert.
- **UNTESTED — Full live sign-in:** requires user interaction with a real Microsoft account after the renderer defect is fixed.

## Security notes

No account password, device code, raw MSAL device code, access token, refresh token, JWT, or secret is included in this report, screenshots, or recording.

## Runtime setup

- Reused installed Node 20 / npm 10 dependencies.
- Built with `npm run build`.
- Cleared local app account configuration, MSAL cache, and lifecycle state before testing.
- Launched local Electron with `--remote-debugging-port=9222` for isolation and IPC payload inspection.
- Installed Python `websocket-client` locally for CDP diagnostics; it is not an application runtime dependency.
