# Leviathan SQL Migration Design

**Date:** 2026-05-12

**Goal:** Replace Firebase and Firestore completely with a Leviathan-native SQL architecture using local MariaDB on both the panel host and each daemon host, while preserving the existing multi-node control-plane model and one-line installer experience.

## Summary

Leviathan will move to a SQL-first architecture with:

- a **panel-local MariaDB** instance for the authoritative control-plane database
- a **daemon-local MariaDB** instance on each node for operational state and caches
- **built-in local accounts** stored in SQL
- **server-side secure cookie sessions** for the web UI
- **API keys** retained for automation and integrations
- **token-based daemon bootstrap and node auth** retained for panel-to-daemon trust
- **raw GitHub one-line installers** for both panel and daemon

Firebase, Firestore, Firebase Admin SDK, Firebase client auth, and Google SSO will be removed entirely.

## Product Decisions

### Authentication

Leviathan will use built-in local accounts stored in panel MariaDB.

- Login uses `username or email + password`.
- Passwords are stored using `argon2id` if practical in the current Node stack, with `bcrypt` acceptable only as fallback.
- Browser auth uses **server-side sessions with secure cookies**.
- Mock auth remains available **only in local development mode**.
- Google SSO is removed.
- Firebase token verification is removed.

### Panel Database Ownership

The panel database is the source of truth for:

- users
- passwords and session records
- roles and permissions
- nodes
- servers
- templates
- allocations
- API keys
- scheduled tasks
- backups metadata
- settings
- audit logs
- alerts
- webhooks
- Cloudflare settings and route records
- firewall policy records
- plugin registry records

### Daemon Database Ownership

Each daemon host gets a separate local MariaDB instance for node-local operational state only.

It stores:

- transfer records and progress
- upload/download bookkeeping
- local backup execution state
- restore progress
- local backup cache/index
- SFTP credential records and rotation history
- daemon update history
- local queue/job state
- reconnect-safe runtime operation records
- local metrics cache and health snapshots

The daemon database does **not** become the source of truth for users, permissions, servers, templates, or other control-plane objects.

## Architecture

### Panel/API

The panel API will replace the Firestore-backed store with SQL-backed repositories.

Recommended repository boundaries:

- `users`
- `roles`
- `sessions`
- `apiKeys`
- `nodes`
- `servers`
- `templates`
- `allocations`
- `backups`
- `scheduledTasks`
- `settings`
- `auditLogs`
- `alerts`
- `webhooks`
- `backupTargets`
- `cloudflare`
- `firewall`
- `plugins`

The API remains the orchestration layer for:

- panel auth and sessions
- permission checks
- node registration
- server lifecycle control
- installer bootstrap
- admin and user dashboard data

### Daemon

The daemon keeps its existing token/bootstrap model, but gains a SQL-backed local persistence layer for operational state.

The daemon remains responsible for:

- Docker lifecycle
- file operations
- console transport
- backup execution
- SFTP management
- local proxy/firewall execution
- local update execution

The daemon uses its local DB to survive reconnects and retain operational history without making the panel dependent on node filesystem snapshots.

## Auth And Session Model

### Web Sessions

Leviathan will use secure server-side sessions for the browser.

Session cookie requirements:

- `HttpOnly`
- `Secure` in HTTPS environments
- `SameSite=Lax` by default
- rotation on login

Required panel auth routes:

- `POST /v1/auth/login`
- `POST /v1/auth/logout`
- `GET /v1/auth/me`

The frontend will stop attaching Firebase bearer tokens for normal panel use.

### API Keys

API keys remain supported for:

- automation
- webhooks and integrations
- CLI/admin tooling

They continue to use hashed storage and one-time secret reveal.

### Daemon Auth

Daemon registration and daemon socket auth remain token-based.

- bootstrap token is one-time
- daemon exchanges bootstrap token for long-lived node credentials
- panel remains authoritative for daemon credential issuance
- daemon-local SQL stores operational auth metadata and rotation history only

## Installer Design

### Panel One-Line Install

Primary documented path:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/REALJasonAU/Leviathan-Panel/main/installers/panel/install.sh)
```

The panel installer must:

- detect distro and package manager
- install missing system dependencies
- install Node.js and pnpm
- install Docker if required
- install and enable MariaDB locally
- create Leviathan panel database and DB user
- generate strong DB credentials automatically
- run SQL migrations
- prompt for:
  - panel origin/domain
  - admin username
  - admin email
  - admin password
- create first admin account
- write secure environment files
- install and enable systemd services
- validate API and panel startup
- print useful restart/log/update/uninstall commands

### Daemon One-Line Install

Primary documented path:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/REALJasonAU/Leviathan-Panel/main/installers/daemon/install.sh) --panel-url https://panel.example.com --node-id node-1 --bootstrap-token nd_bootstrap_xxx
```

The daemon installer must:

- detect distro and package manager
- install missing system dependencies
- install Docker if required
- install and enable local MariaDB
- create daemon-local DB and DB user
- generate strong DB credentials automatically
- run daemon-local SQL migrations
- register/bootstrap with the panel
- write secure daemon config
- install and enable systemd service
- validate Docker and daemon startup
- print useful restart/log/update/uninstall commands

## UI Changes

The approved Leviathan redesign remains the visual baseline, but auth and settings surfaces change.

Required UI changes:

- replace Google/Firebase login with `username/email + password`
- remove all Firebase setup copy
- remove all Google SSO copy
- update users/admin settings for local accounts and password-based administration
- keep mock login available only in local dev mode

## Documentation Changes

Remove or replace:

- Firebase setup docs
- Firestore schema docs
- Firebase env examples
- Google SSO references

Add or update:

- MariaDB setup and health notes
- local account bootstrap docs
- one-line panel install docs
- one-line daemon install docs
- secure session/cookie notes
- daemon-local DB explanation

## Testing Requirements

Required verification coverage:

- SQL-backed login/logout/session auth
- password hashing and verification
- first admin bootstrap creation
- API key validation against SQL storage
- repository CRUD for core panel entities
- daemon-local repository CRUD for local operational entities
- panel installer MariaDB provisioning
- daemon installer MariaDB provisioning
- one-line install documentation accuracy
- reboot persistence of services

## Rollout Sequence

1. Add SQL foundations and migrations for panel and daemon.
2. Add panel local-auth and secure session flow.
3. Move panel repositories from Firestore to MariaDB.
4. Add daemon local MariaDB repositories.
5. Update panel installer for MariaDB provisioning and admin bootstrap.
6. Update daemon installer for local MariaDB provisioning.
7. Remove Firebase code, docs, envs, and dependencies.
8. Run full verification and installer documentation pass.

## Explicit Non-Goals For This Migration

This pass does not attempt to:

- preserve Google SSO
- maintain Firebase compatibility mode
- introduce multi-master database sync
- move the daemon to become control-plane authoritative

The migration is intentionally opinionated so the resulting Leviathan architecture stays clean and deployable.
