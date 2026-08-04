# Test Plan — Outlook Electron PR #2 (redesigned token dashboard)

Branch `devin/1785830297-outlook-desktop-app` @ 7a4cc6c. Run via local electron with
`--remote-debugging-port=9222` (CDP for isolation + token-hygiene text evidence).
Public non-secret client ID for device-code initiation: Azure CLI `04b07795-8ddb-461a-bbee-02f9e1bf7b46`.
App state cleared before run (no account-config/msal-cache/token-lifecycle).

## T1 Startup & Outlook loading (recorded)
Launch app. Pass: main window loads Microsoft/Outlook sign-in page. Fail: blank/crash.

## T2 Open dashboard + empty metrics + storage + isolation (recorded + CDP)
Alt→Mail→Microsoft Account. Pass: "Token Manager" dashboard opens with sidebar
(Overview/Sessions/Audit Log/Settings). Overview shows metrics all = 0
(Total/Active/Refreshes/Failures), "Active Sessions" panel shows
"No Microsoft sessions are connected.", storage pill renders a value
("Encrypted storage" or "Session-only storage"; record actual), sidebar security shows
matching text. CDP: account renderer exposes ONLY
{getState,saveConfig,signIn,refresh,remove,removeAll,openExternal,onDeviceCode};
`process`/`require`/`module` undefined. Outlook renderer: no accountManager, no node globals.
Fail: renderer console error (e.g. exports not defined), blank metrics, missing empty text.

## T3 Navigation between views (recorded)
Click Sessions, Audit Log, Settings nav items. Pass: each swaps the active view and
`#view-title` updates (Session Management / Audit Log / Settings); Sessions empty =
"Connect a Microsoft account to manage its session.", Audit empty row =
"No token lifecycle activity yet.". Fail: view does not change / title stale.

## T4 Invalid client ID validation (recorded)
Settings tab, type `not-a-valid-guid`, click "Save configuration".
Pass: red error `#message` = "Enter the Application (client) ID from Microsoft Entra.";
config not saved. Fail: any other/blank message or acceptance.

## T5 Valid device-code initiation + prompt token hygiene (recorded + CDP)
Settings: enter `04b07795-8ddb-461a-bbee-02f9e1bf7b46`, tenant `organizations`, Save
(expect "Microsoft Entra configuration saved.", audit gains "Configuration updated"),
then Connect account. Pass: device modal appears with a message, `#device-code` = short
human user code (~9 chars, NOT a token). CDP dump of modal/document: contains only
userCode + verification URL + message; NO raw deviceCode, NO access/refresh token, NO
`eyJ...` JWT. Fail: long/opaque token shown, or CDP reveals raw device/access/refresh token.

## T6 External-link behavior (recorded)
In device modal click "Open Microsoft sign-in". Pass: verification URL opens in EXTERNAL
system browser (Chrome to microsoft.com/devicelogin), dashboard stays on its page.
Also (if time) Settings "Open Microsoft permissions" opens myaccount.microsoft.com externally.
Fail: navigation inside the app window or nothing opens.

## Gap
Completing sign-in / per-account Force refresh / Remove local session / Remove all with a
real connected account require an interactive Microsoft login (user creds) — mark UNTESTED
with code references (renderer 169-238, auth.ts refresh/remove/removeAll). removeAll with 0
accounts can be exercised but is a no-op.
