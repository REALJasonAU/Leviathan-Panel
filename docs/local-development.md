# Local Development

## Fastest Path

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/panel/.env.example apps/panel/.env
cp apps/daemon/.env.example apps/daemon/.env
pnpm dev
```

This starts the API, panel, and daemon in local development mode.

## Default Local Mode

The example env files default to mock/local-friendly settings:

- `MOCK_AUTH=true`
- `MOCK_DATA=true`
- `DB_DRIVER=memory`
- `DAEMON_DB_DRIVER=memory`
- `VITE_USE_MOCK_AUTH=true`

This is the intended path for quick UI and workflow work.

## Local Real SQL Mode

If you want to test the MariaDB-backed auth/storage path locally:

1. Install local MariaDB.
2. Create a panel database and database user.
3. Create a daemon database and database user.
4. Update:
   - `apps/api/.env`
   - `apps/daemon/.env`
   - `apps/panel/.env`
5. Set:

```env
MOCK_AUTH=false
MOCK_DATA=false
DB_DRIVER=mysql
DAEMON_DB_DRIVER=mysql
VITE_USE_MOCK_AUTH=false
```

6. Seed an admin account:

```bash
ADMIN_USERNAME=owner \
ADMIN_EMAIL=owner@example.com \
ADMIN_PASSWORD='strong-password' \
pnpm --filter @voltan/api seed
```

## Useful Commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

## Notes

- Local browser development supports both `localhost` and `127.0.0.1` panel origins by default.
- Mock mode should stay local-only and should not be used in production installs.
