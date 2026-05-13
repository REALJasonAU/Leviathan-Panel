# MariaDB And Local Auth Setup

Leviathan uses local MariaDB plus built-in local accounts for production installs.

## Panel/API

The panel installer provisions this automatically by default:

- MariaDB server
- `leviathan_panel` database
- `leviathan_panel` database user
- API `.env` with SQL/session settings
- first admin user

Manual panel setup is still possible:

1. Install MariaDB locally.
2. Create the panel database and database user.
3. Copy `apps/api/.env.example` to `apps/api/.env`.
4. Set:
   - `DB_DRIVER=mysql`
   - `DB_HOST=127.0.0.1`
   - `DB_PORT=3306`
   - `DB_NAME=leviathan_panel`
   - `DB_USER=leviathan_panel`
   - `DB_PASSWORD=...`
   - `SESSION_COOKIE_NAME=leviathan_session`
   - `SESSION_TTL_HOURS=168`
5. Copy `apps/panel/.env.example` to `apps/panel/.env`.
6. Set `VITE_API_BASE_URL`.
   - If you leave it pointed at `localhost`, the panel client will fall back to the current host for browser access when possible.
7. Seed the first admin user:

```bash
cd /path/to/leviathan
ADMIN_USERNAME=local-admin \
ADMIN_EMAIL=local-admin@example.test \
ADMIN_PASSWORD='change-me-now' \
pnpm --filter @voltan/api seed
```

## Daemon

The daemon installer provisions this automatically by default:

- MariaDB server
- `leviathan_daemon` database
- `leviathan_daemon` database user
- daemon `.env` with local SQL settings

Manual daemon setup is still possible:

1. Install MariaDB locally on the node.
2. Create the daemon database and database user.
3. Copy `apps/daemon/.env.example` to `apps/daemon/.env`.
4. Set:
   - `DAEMON_DB_DRIVER=mysql`
   - `DAEMON_DB_HOST=127.0.0.1`
   - `DAEMON_DB_PORT=3306`
   - `DAEMON_DB_NAME=leviathan_daemon`
   - `DAEMON_DB_USER=leviathan_daemon`
   - `DAEMON_DB_PASSWORD=...`
   - plus the normal daemon bootstrap settings

## Sessions

Leviathan uses secure server-side sessions.

- Cookies should be `Secure` behind HTTPS.
- Cookies are `HttpOnly` and `SameSite=Lax`.
- Sessions are stored in the panel database.

## Local Development Notes

For local development, keep the panel and daemon on memory-backed or local MariaDB databases, and bootstrap a local admin account with explicit credentials when you need one.
