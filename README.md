# Leviathan

Leviathan is a self-hosted server orchestration platform for game servers and Docker-based workloads. It is designed as a modern alternative to the classic panel-plus-daemon model, with a faster Svelte-based panel, a TypeScript control plane, a lightweight node daemon, and Firebase-backed identity plus data management.

This repository is organized as a monorepo:

- `apps/panel`: Svelte web panel for admins and users
- `apps/api`: Fastify control plane and REST API
- `apps/daemon`: lightweight node daemon for Docker orchestration
- `packages/shared`: shared contracts, schemas, permissions, and env tooling
- `installers`: one-command install, update, and uninstall scripts
- `docs`: architecture, schema, auth flow, and deployment docs
- `examples`: Firebase, template, daemon, and Cloudflare examples

## Highlights

- Firebase Authentication with Google sign-in support
- Firestore-first data layer with a mock adapter for local development
- Real-time panel-to-daemon command channel over authenticated WebSockets
- Docker-native server lifecycle management
- Live console streaming and command input
- File browsing, editing, archive, extract, and upload flows
- Local backup create, restore, delete, and download flows
- Local/S3-compatible backup targets with daemon-side S3 upload, download, restore, and delete
- Queue-backed scheduled task execution with lock/retry metadata
- Optional BullMQ/Redis production queue adapter
- Admin users, roles, audit logs, API keys, settings, and webhook management
- Hashed API-key authentication with scoped permissions, expiry, revocation, and last-used tracking
- Server sub-users with server-scoped permissions
- Alert records, metric threshold evaluation, signed webhooks, Caddy config generation, and UFW rule generation
- Cloudflare route automation, signed daemon update manifests, trusted plugin manifests, and billing webhook validation interfaces
- Short-lived daemon transfer IDs for byte-stream file and local backup transfers
- AES-256-GCM local secret encryption adapter for sensitive provider credentials
- Trusted runtime plugin loader for admin-installed plugins
- Template-based provisioning with environment variable metadata and `.env.example` import
- Multi-node architecture with token rotation and audit logging hooks
- Installer scripts for Ubuntu/Debian panel and daemon deployments, with best-effort paths for Fedora, Rocky Linux, AlmaLinux, CentOS Stream, and Arch Linux
- Leviathan Command Deck panel redesign with a unified admin/user shell, premium abyss palette, safer destructive workflows, and reusable Svelte UI primitives

## Quick Start

1. Install dependencies:

```bash
pnpm install
```

2. Copy example environment files:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/panel/.env.example apps/panel/.env
cp apps/daemon/.env.example apps/daemon/.env
```

The API now accepts both `localhost` and `127.0.0.1` panel origins for local development. If you use a custom dev host, add it to `PANEL_EXTRA_ORIGINS` in `apps/api/.env`.

3. Start the workspace:

```bash
pnpm dev
```

4. Build everything:

```bash
pnpm build
```

5. Run verification:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Documentation

- [Architecture](./docs/architecture.md)
- [Firestore Schema](./docs/firestore-schema.md)
- [Authentication Flow](./docs/auth-flow.md)
- [Panel-to-Daemon Protocol](./docs/panel-daemon-protocol.md)
- [Deployment Guide](./docs/deployment.md)
- [Panel Installer](./docs/panel-installer.md)
- [Daemon Installer](./docs/daemon-installer.md)
- [Firebase Setup](./docs/firebase-setup.md)
- [Local Development](./docs/local-development.md)
- [Security Checklist](./docs/security-checklist.md)
- [Release And Update Operations](./docs/updates.md)
- [Release Checklist](./docs/release-checklist.md)
- [Phase 2 Notes](./docs/phase2-notes.md)
- [Phase 3 Notes](./docs/phase3-notes.md)
- [Phase 4 Notes](./docs/phase4-notes.md)
- [Phase 5 Notes](./docs/phase5-notes.md)
- [Phase 6 Notes](./docs/phase6-notes.md)

## CI

GitHub Actions CI runs:

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

The E2E suite runs against mock auth/data and installs Chromium through Playwright on Linux runners.

## Current Scope

The repository now includes working core flows for panel auth wiring, dashboard pages, template and server management APIs, environment validation/import, daemon bootstrap and registration, Docker lifecycle control, console streaming, file operations, short-lived daemon byte-stream transfers, multipart browser uploads, binary browser downloads, local/S3 backups, queue-backed scheduled tasks, optional BullMQ queueing, metrics retention and alerts, scoped API keys, sub-users, encrypted provider secrets, Cloudflare route automation, signed update manifests, trusted runtime plugin loading, billing webhook validation, admin management, and installer scaffolding.

Some advanced items from the roadmap, such as full live migration, full embedded SFTP network serving, package-specific daemon service replacement, S3-to-browser backpressure streaming without staging, and root-level firewall enforcement by default, are represented with safe extension points and documentation rather than claimed as fully completed production modules.

## Installer Support

The panel installer and daemon installer both detect `/etc/os-release` and common package managers. Ubuntu and Debian are the fully targeted paths. Fedora, Rocky Linux, AlmaLinux, CentOS Stream, and Arch Linux are best-effort until distro-specific smoke tests are added.

Panel:

```bash
sudo bash installers/panel/install.sh \
  --panel-origin https://panel.example.com \
  --api-base-url https://panel.example.com \
  --non-interactive
```

Daemon:

```bash
sudo bash installers/daemon/install.sh \
  --panel-url https://panel.example.com \
  --node-id node_123 \
  --bootstrap-token nd_bootstrap_xxx \
  --non-interactive
```
