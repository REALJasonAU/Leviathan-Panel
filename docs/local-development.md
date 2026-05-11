# Local Development

## Mock mode

Mock mode is intended for local development only.

Set:

- `apps/api/.env`
  - `MOCK_AUTH=true`
  - `MOCK_DATA=true`
  - `PANEL_ORIGIN=http://localhost:5173`
  - `PANEL_EXTRA_ORIGINS=http://127.0.0.1:4173`
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

Leviathan accepts both `http://localhost:*` and `http://127.0.0.1:*` during local development so the panel can be opened from either address without tripping API CORS.

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
