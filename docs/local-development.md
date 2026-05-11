# Local Development

## Mock mode

Mock mode is intended for local development only.

Set:

- `apps/api/.env`
  - `MOCK_AUTH=true`
  - `MOCK_DATA=true`
- `apps/panel/.env`
  - `VITE_USE_MOCK_AUTH=true`

Then run:

```bash
pnpm install
pnpm dev
```

Use the mock sign-in buttons in the panel:

- `Use Mock Admin`
- `Use Mock User`

## What works in mock mode

- Panel auth flow
- Node and server CRUD
- Template import and validation
- Console/file/backup/task API paths when a daemon is connected
- Admin roles, audit logs, settings, API keys, and webhooks stored in memory

## What mock mode does not represent faithfully

- Real Firebase Authentication
- Real Firestore persistence
- Linux Docker runtime behaviour
- Real SFTP provisioning
- Real reverse proxy or Cloudflare management
