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

The example env files default to local-friendly settings:

- `DB_DRIVER=memory`
- `DAEMON_DB_DRIVER=memory`

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
DB_DRIVER=mysql
DAEMON_DB_DRIVER=mysql
```

6. Seed an admin account or bootstrap one on start with explicit credentials:

```bash
ADMIN_USERNAME=local-admin \
ADMIN_EMAIL=local-admin@example.test \
ADMIN_PASSWORD='change-me-now' \
BOOTSTRAP_ADMIN_ON_START=true \
pnpm --filter @voltan/api seed
```

Leviathan no longer creates an implicit admin user. If you are using the memory-backed local dev server, provide explicit credentials as shown above or log in with the account created by the installer.

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
- The panel client will also fall back to the current host when the API base is still pointed at a loopback address, which keeps direct IP/browser-preview access working.
- Local development should use the real login flow with a seeded or bootstrapped admin account.
