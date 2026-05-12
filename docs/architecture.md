# Architecture

Leviathan is split into three runtime layers:

- `apps/panel`: the Svelte browser UI
- `apps/api`: the control-plane API and session/auth layer
- `apps/daemon`: the node-local runtime daemon

## Core Model

The panel and API run together as the control plane.

- The panel is a client-rendered Svelte application.
- The API is a Fastify service that owns auth, authorization, orchestration, and audit logging.
- The daemon runs on Linux nodes and manages Docker workloads plus node-local operational flows.

## Storage Model

Leviathan uses a split SQL model:

- `panel MariaDB`
  - source of truth for users, roles, sessions, nodes, servers, templates, allocations, API keys, audit logs, settings, alerts, webhooks, and other control-plane records
- `daemon MariaDB`
  - node-local operational state for transfers, local job state, backup execution state, SFTP metadata, update history, and reconnect-safe runtime records

Mock memory-mode storage still exists for local development only.

## Authentication

- Panel users authenticate with local username/email + password.
- The API issues secure cookie-backed server-side sessions.
- API keys are stored hashed and scoped.
- Daemons authenticate with bootstrap tokens and long-lived daemon tokens.

## Request Flow

### Panel -> API

- HTTPS
- Cookie-backed session auth for the browser
- Scoped API key auth for automation

### API -> Daemon

- HTTPS/WebSocket token auth
- Panel-originated commands become desired-state operations
- Daemon reports operational state, metrics, events, and transfer progress back

### Daemon -> Local Services

- Docker runtime
- local filesystem
- local MariaDB
- optional Cloudflare, reverse-proxy, firewall, and backup providers

## Security Boundaries

- Browser sessions never authenticate daemons.
- Daemon tokens never authenticate human UI sessions.
- Secrets stay server-side and are redacted in logs, audit records, and UI payloads unless explicitly one-time revealed.
- Sensitive provider secrets are encrypted before persistence.

## UI Architecture

The Leviathan panel uses a shared `Command Deck` shell across admin and user views:

- fixed left sidebar
- top action header
- balanced card/table density
- reusable status, tab, modal, metric, and table primitives
- shared abyss color system across admin and user surfaces

## Release Reality

Ubuntu and Debian are the fully targeted deployment paths today. Fedora, Rocky Linux, AlmaLinux, CentOS Stream, and Arch Linux are handled through best-effort installer branches and should be staged before production use.
