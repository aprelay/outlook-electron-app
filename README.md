# Outlook Desktop

A secure Electron portal for Microsoft Outlook browser sessions, a persistent desktop Outlook window, and a separate Microsoft token lifecycle dashboard. Sign-in happens directly on Microsoft's website; the app does not collect or store your password.

## Features

- Portal-style main window with separate browser, token dashboard, and admin-center actions
- Outlook browser launch using the user's normal browser profile and Microsoft cookies
- Optional persistent Electron Outlook window with a dedicated session partition and browser-compatible user agent
- Native desktop notifications and unread badge
- Microsoft device-code sign-in for Graph mail permissions
- Dashboard for session counts, scopes, expiry, refreshes, failures, and local audit history
- Encrypted local token cache with force-refresh, per-account removal, and remove-all controls
- Secure isolated web content (`sandbox`, context isolation, no Node.js access)
- Microsoft links open in-app; other links open in the default browser
- Single-instance behavior, spellcheck, zoom, reload, and fullscreen controls
- Windows, macOS, and Linux packaging

## Requirements

- Node.js 20 or newer
- npm 10 or newer
- A Microsoft 365 or Outlook account

## Run locally

```bash
npm install
npm start
```

The app opens the local Outlook Portal. The right-side panel provides a visible **Sign in with device code** flow using your Microsoft Entra client ID and tenant. **Browser Sessions** launches official Outlook in your normal browser, where Chrome/Edge owns and persists the Microsoft session. The menu also provides an optional Electron Outlook window backed by the persistent `persist:outlook` partition. Enter your Office email and password only on Microsoft's sign-in page.

## Configure the portal server

The portal accepts an HTTPS server URL and access key and checks `<server>/api/health`. The key is never returned to the renderer and is persisted only when operating-system encryption is available; otherwise it remains in memory for the current app session.

## Configure the separate device-code dashboard

1. Create or select an app registration in the Microsoft Entra admin center.
2. Under **Authentication**, enable **Allow public client flows**.
3. Add delegated Microsoft Graph permissions for `User.Read`, `Mail.ReadWrite`, and `Mail.Send` and grant the consent required by your organization.
4. Copy the **Application (client) ID**. No client secret is required.
5. In Outlook Portal, open **Token Dashboard**, enter the client ID and tenant ID or domain under **Settings**, then select **Connect account**.

The token dashboard gives you lifecycle control over your own Microsoft sessions: status, expiry, granted scopes, forced refresh, local removal, remove-all, audit history, and a link to Microsoft's consent controls. It never displays, imports, or exports raw access or refresh tokens. The MSAL cache is persisted only when Electron can use operating-system encryption; otherwise it remains session-only.

## Quality checks

```bash
npm run lint
npm run typecheck
npm run build
```

## Build an installer

Build for the current operating system:

```bash
npm run package
```

Installers are written to `release/`. Windows installers should normally be built on Windows, macOS images on macOS, and Linux packages on Linux.

To create an unpacked application for development:

```bash
npm run package:dir
```
