# Leviathan

Leviathan is a self-hosted server orchestration platform for game servers and Docker-based workloads. It combines a Svelte control panel, a Fastify API, and a lightweight node daemon into a modern alternative to the classic panel-plus-daemon model, with built-in local accounts, MariaDB-backed state, secure cookie sessions, and Docker-native runtime control.

This repository is organized as a monorepo:

- `apps/panel`: Svelte web panel for admins and users
- `apps/api`: Fastify control plane and REST API
- `apps/daemon`: lightweight node daemon for Docker orchestration
- `packages/shared`: shared contracts, schemas, permissions, and env tooling
- `installers`: one-command install, update, and uninstall scripts
- `docs`: architecture, schema, auth flow, deployment, and operations docs
- `examples`: template, daemon, and infrastructure examples

## Highlights

- Local Leviathan accounts stored in MariaDB
- Secure server-side session cookies for the panel
- Scoped API keys for automation and integrations
- Real-time panel-to-daemon command channel over authenticated WebSockets
- Docker-native server lifecycle management
- Live console streaming and command input
- File browsing, editing, archive, extract, upload, and streamed download flows
- Local and S3-compatible backup providers
- Queue-backed scheduled task execution with local and BullMQ/Redis options
- Admin users, roles, audit logs, settings, webhooks, plugins, and daemon update controls
- Template-based provisioning with environment variable metadata and `.env.example` import
- Multi-node architecture with bootstrap-token registration and daemon-local operational SQL state
- One-line panel and daemon installers with MariaDB auto-provisioning
- Leviathan Command Deck UI with a unified admin/user shell and abyss infrastructure theme

## Quick Start

1. Install dependencies:

```bash
pnpm install
```

2. Copy environment files:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/panel/.env.example apps/panel/.env
cp apps/daemon/.env.example apps/daemon/.env
```

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

## One-Line Install

Panel:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/REALJasonAU/Leviathan-Panel/refs/heads/master/installers/panel/install.sh)
```

Daemon:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/REALJasonAU/Leviathan-Panel/refs/heads/master/installers/daemon/install.sh) \
  --panel-url https://panel.example.com \
  --node-id node_123 \
  --bootstrap-token nd_bootstrap_xxx
```

The panel installer prompts for the panel origin plus the first admin username, email, and password. Both installers provision local MariaDB by default. Ubuntu and Debian are the fully targeted paths; Fedora, Rocky Linux, AlmaLinux, CentOS Stream, and Arch Linux remain best-effort until distro-specific smoke tests are completed.

## Documentation

- [Architecture](./docs/architecture.md)
- [Database Schema](./docs/database-schema.md)
- [Authentication Flow](./docs/auth-flow.md)
- [Panel-to-Daemon Protocol](./docs/panel-daemon-protocol.md)
- [Deployment Guide](./docs/deployment.md)
- [Panel Installer](./docs/panel-installer.md)
- [Daemon Installer](./docs/daemon-installer.md)
- [MariaDB And Local Auth Setup](./docs/database-setup.md)
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

The E2E suite runs against a local MariaDB-backed bootstrap admin unless a dedicated test environment is wired in.

## Current Scope

The repository includes working core flows for:

- local-account auth and session wiring
- dashboard pages and admin tooling
- template and server management APIs
- environment validation and import
- daemon bootstrap and registration
- Docker lifecycle control
- console streaming
- file operations and byte-stream transfers
- local and S3 backup providers
- queue-backed scheduled tasks
- metrics retention and alerts
- scoped API keys
- sub-users
- encrypted provider secrets
- Cloudflare route automation
- signed update manifests
- trusted runtime plugin loading
- billing webhook validation interfaces
- installer automation

Some advanced roadmap items remain partial rather than fully production-complete, including full embedded SFTP network serving, package-specific daemon replacement, and broad distro smoke testing outside Ubuntu/Debian.
