# Outlook Desktop

A focused Electron desktop app for Microsoft Outlook on the web. Sign-in happens directly on Microsoft's website; the app does not collect or store your password.

## Features

- Persistent Microsoft 365 session
- Native desktop notifications and unread badge
- Microsoft device-code sign-in for Graph mail permissions
- Encrypted local token cache with status, refresh, and removal controls
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

The app opens `https://outlook.office.com/mail/`. Enter your Office email and password only on Microsoft's sign-in page.

## Configure device-code sign-in

1. Create or select an app registration in the Microsoft Entra admin center.
2. Under **Authentication**, enable **Allow public client flows**.
3. Add delegated Microsoft Graph permissions for `User.Read`, `Mail.ReadWrite`, and `Mail.Send` and grant the consent required by your organization.
4. Copy the **Application (client) ID**. No client secret is required.
5. In Outlook Desktop, open **Mail → Microsoft Account**, enter the client ID and tenant ID or domain, then select **Connect account**.

The account manager shows account and expiry metadata only. It never displays or exports raw access or refresh tokens. The MSAL cache is persisted only when Electron can use operating-system encryption; otherwise it remains session-only.

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
