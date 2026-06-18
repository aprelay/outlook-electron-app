# Outlook Electron

An Outlook-inspired desktop email client built with Electron, React, TypeScript, and Microsoft Graph API.

## Features

- **Enterprise-Grade OAuth 2.0 Authentication** — Sign in once with your Microsoft account
- **Encrypted Token Storage** — Uses Electron's `safeStorage` (OS keychain) for zero-plaintext credential storage
- **Automatic Token Renewal** — Silent refresh of access tokens via MSAL
- **Session Revocation** — Immediate logout clears all stored tokens
- **Full Email Management** — Read, compose, reply, forward, delete, flag, search
- **Rich Text Editor** — Compose emails with formatting (bold, italic, lists, quotes)
- **Outlook-Style UI** — Three-panel layout with folder sidebar, email list, and reading pane
- **Desktop Notifications** — Native OS notifications for new emails
- **Pagination** — Browse large mailboxes with paginated message loading

## Prerequisites

- Node.js 18+
- An Azure AD App Registration with the following:
  - **Redirect URI**: `http://localhost:3847` (Mobile and desktop applications)
  - **API Permissions** (Delegated):
    - `User.Read`
    - `Mail.Read`
    - `Mail.ReadWrite`
    - `Mail.Send`
    - `MailboxSettings.Read`

## Azure AD App Setup

1. Go to [Azure Portal > App Registrations](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Click **New registration**
3. Name your app (e.g., "Outlook Electron")
4. Set **Supported account types** to "Accounts in any organizational directory and personal Microsoft accounts"
5. Under **Redirect URI**, select "Mobile and desktop applications" and enter `http://localhost:3847`
6. Click **Register**
7. Copy the **Application (client) ID** — you'll need this below
8. Go to **API permissions** > **Add a permission** > **Microsoft Graph** > **Delegated permissions**
9. Add: `User.Read`, `Mail.Read`, `Mail.ReadWrite`, `Mail.Send`, `MailboxSettings.Read`
10. Click **Grant admin consent** (if you're an admin)

## Installation

```bash
npm install
```

## Configuration

Set your Azure AD Client ID as an environment variable:

```bash
export AZURE_CLIENT_ID="your-client-id-here"
```

Or edit `src/main/auth.ts` and replace `YOUR_AZURE_CLIENT_ID` with your actual client ID.

## Development

```bash
npm run dev
```

This starts both the Vite dev server (renderer) and the Electron app concurrently.

## Build

```bash
npm run build
```

## Package for Distribution

```bash
npm run package
```

This creates platform-specific installers in the `release/` directory.

## Project Structure

```
src/
├── main/                   # Electron main process
│   ├── main.ts            # App entry, window management, IPC handlers
│   ├── auth.ts            # MSAL OAuth 2.0 authentication
│   ├── tokenStore.ts      # Encrypted token storage (safeStorage)
│   ├── graphClient.ts     # Microsoft Graph API client
│   └── preload.ts         # Context bridge for renderer
├── renderer/              # React frontend
│   ├── components/
│   │   ├── App.tsx        # Root component, state management
│   │   ├── LoginScreen.tsx
│   │   ├── Sidebar.tsx    # Folder navigation
│   │   ├── EmailList.tsx  # Message list with search
│   │   ├── ReadingPane.tsx # Email viewer
│   │   ├── ComposeModal.tsx # Rich text compose/reply/forward
│   │   └── Toast.tsx      # Notification toasts
│   ├── styles/
│   │   └── global.css     # Outlook-inspired styles
│   ├── types/
│   │   └── electron.d.ts  # TypeScript types for IPC bridge
│   ├── index.html
│   └── main.tsx           # React entry point
```

## Security Architecture

- **OAuth 2.0 Authorization Code Flow** via MSAL Node
- **No plaintext credentials** — tokens encrypted with OS keychain via `safeStorage`
- **Context isolation** — renderer process has no direct Node.js access
- **CSP headers** — Content Security Policy restricts network access
- **Sandboxed email rendering** — HTML emails displayed in sandboxed iframes
- **Automatic token refresh** — silent renewal before expiry
- **Complete session revocation** — logout clears all cached tokens

## License

MIT
