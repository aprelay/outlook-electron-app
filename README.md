# Outlook Desktop

A secure Electron portal for Microsoft Outlook browser sessions, a persistent desktop Outlook window, and a separate Microsoft token lifecycle dashboard. Sign-in happens directly on Microsoft's website; the app does not collect or store your password.

## Features

- Portal-style main window with separate browser, token dashboard, and admin-center actions
- Outlook browser launch using the user's normal browser profile and Microsoft cookies
- Optional persistent Electron Outlook window with a dedicated session partition and browser-compatible user agent
- Native desktop notifications and unread badge
- Two portal sign-in methods, side by side: Microsoft device code and MS Office interactive login
- On-portal management of the browser session (cookies) and device-code token: status, force refresh, clear/sign-out — never exporting raw cookies or tokens
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

The app opens the local Outlook Portal. The right-side panel offers two sign-in methods you can switch between:

- **Device code** — enter your Microsoft Entra client ID and tenant and complete the short device code on Microsoft's site. The client ID defaults to Microsoft's public Azure CLI application so you never have to expose your own app registration.
- **MS Office login** — open the official Microsoft sign-in in a persistent Electron Outlook window (`persist:outlook`), where cookies are kept in an OS-encrypted session so you stay logged in.

Below the panel, a management area shows the status of both your **browser session (cookies)** and your **device-code token**, with actions to refresh status, force a token refresh, and clear the session or remove the token. Raw cookie values and raw access/refresh tokens are never displayed or exported — only status and lifecycle controls. Enter your Office email and password only on Microsoft's sign-in page.

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

## Download and hosting

- Download page (Cloudflare Pages): https://outlook-portal.pages.dev
- Windows installer (GitHub Release): https://github.com/aprelay/outlook-electron-app/releases/latest

The download page is static and lives in `cf-site/`. Deploy it with Wrangler:

```bash
CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
  npx wrangler@3 pages deploy cf-site --project-name outlook-portal --branch main
```

Cloudflare Pages limits individual files to 25 MiB, so the ~85 MB installer is hosted as a GitHub Release asset and linked from the page rather than uploaded to Pages.
