# Phase 2 Notes

## Fully implemented in this pass

- Structured API errors and centralized error handling
- Expanded repository/store layer for users, roles, nodes, servers, allocations, backups, tasks, metrics, settings, API keys, webhooks, and audit logs
- Node maintenance toggles, daemon token rotation, daemon config generation, heartbeat and metrics storage
- Docker container create, pull, start, stop, restart, kill, delete, inspect
- Console streaming from daemon to API to panel
- Console command input from panel to daemon
- File browsing, read, write, rename, move, copy, folder creation, archive, extract, and cleanup commands
- Local backup create, restore, delete, and download
- Scheduled task storage plus cron-based execution in the API process
- Admin pages for users, roles, audit logs, settings, API keys, and webhooks
- Unit tests and API integration coverage for core paths

## Partially implemented in this pass

- S3-compatible backups: schema/settings are present, local provider is the completed implementation
- SFTP: credentials and UI are generated, but node-side OpenSSH/user provisioning is still a follow-up
- Webhook event system: generic and Discord-compatible delivery exists for a subset of events, retries/signatures are still basic
- Node self-update: endpoint and daemon command scaffold are present, full updater is not yet completed
- Metrics charts: retained metrics are available and surfaced in the UI, chart rendering is still minimal
- Reverse proxy, Cloudflare Tunnel, and firewall controls: data structures and docs/scaffolding are present, end-to-end orchestration is still a follow-up
- API keys: creation/revocation and scoped metadata exist, request authentication by API key is still a Phase 3 item
