# Outlook Cookie Debugger Worker

This Worker exposes three small debugging endpoints:

- `GET /oauth/device-code` starts the Microsoft Entra OAuth 2.0 device-code flow.
- `POST /oauth/token` polls the flow with `{ "device_code": "..." }`.
- `GET /session/inspect?path=/owa/` makes a controlled request to
  `outlook.office365.com` and reports request-cookie and `Set-Cookie` metadata.
- `GET /session/inspect-office?path=/owa/` performs the same probe against
  `outlook.office.com`.
- `GET /history` returns recent safe diagnostic snapshots retained for 30 days.

Cookie values, OAuth tokens, and device codes are never persisted or written to
logs. The metadata includes names, lengths, flags, domains, paths, expiration
attributes, and counts.

## Configuration

1. The Worker defaults to Microsoft's documented Azure CLI public client ID
   (`04b07795-8ddb-461a-bbee-02f9e1bf7b46`) so the device-code dashboard works
   immediately for basic identity sign-in.
2. For an enterprise deployment, register your own public/native application,
   enable **Allow public client flows**, grant only the permissions needed for
   the debugging session, and override the default:

   ```sh
   npx wrangler@4.44.0 secret put MICROSOFT_CLIENT_ID
   ```

3. Optionally edit `wrangler.toml` to set `MICROSOFT_TENANT`,
   `MICROSOFT_SCOPE`, and an exact `ALLOWED_ORIGIN`.

The device-code endpoint returns Microsoft's `user_code`, `verification_uri`,
and polling interval. The Worker does not store device codes or tokens. The
default scope is limited to identity claims; use a tenant-owned app and
explicit delegated Outlook scopes if the diagnostic needs an Outlook API token.

## Deploy

From the repository root:

```sh
npx wrangler@4.44.0 login
npx wrangler@4.44.0 deploy
```

For a local smoke test:

```sh
npx wrangler@4.44.0 dev
curl http://localhost:8787/
curl http://localhost:8787/oauth/device-code
```

## Inspecting an Outlook session

Call `/session/inspect` from the same controlled browser context that has the
session cookie and pass the cookie header to the Worker-side request. For
example, a reverse proxy or test harness can request:

```sh
curl -H 'Cookie: <session-cookie-header>' \
  'https://<worker-host>/session/inspect?path=/owa/'
```

Do not paste cookie headers into shell history or tickets. For production use,
put the Worker behind Cloudflare Access and restrict `ALLOWED_ORIGIN`; this
tool is intended for short-lived, authorized troubleshooting only.

The endpoint uses a fixed upstream origin and only accepts an absolute path,
so it cannot be used as a general-purpose proxy.
