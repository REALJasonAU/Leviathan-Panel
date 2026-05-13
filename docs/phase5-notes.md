# Phase 5 Release Candidate Notes

Phase 5 moves Leviathan closer to a release candidate by replacing the largest remaining in-memory transfer paths, adding trusted runtime plugins, introducing encrypted secret storage, and improving update/proxy lifecycle safety.

## Daemon Byte Streams

The API now requests short-lived transfer IDs over the authenticated daemon control channel, then proxies HTTP byte streams directly from the daemon:

```text
GET  /v1/servers/:id/files/download?path=...
POST /v1/servers/:id/files/upload
GET  /v1/backups/:id/stream
```

Daemon transfer endpoints:

```text
GET    /v1/transfers/:id/file
PUT    /v1/transfers/:id/file
GET    /v1/transfers/:id/backup
DELETE /v1/transfers/:id
```

Transfer IDs expire after five minutes and can be cancelled. Local file and local backup downloads are true byte streams. S3 backup downloads still stage through the daemon provider before response because the provider must first materialize or stream the remote object.

## SFTP

SFTP credentials now support:

- Credential creation
- Rotation
- Revoke
- Expiry metadata
- Daemon-side lifecycle checks
- Directory isolation
- One-time plaintext display on rotation

Normal SFTP detail reads redact passwords. A full network SFTP listener/OpenSSH provisioner remains the Phase 6 target.

## Daemon Updates

Update manifests are signed and checksum-verified. When `DAEMON_UPDATE_APPLY_ENABLED=true` and `DAEMON_UPDATE_TARGET_PATH` are set, the daemon can download, stage, verify, replace the target artifact, health check, and roll back the previous artifact on failure.

```bash
DAEMON_UPDATE_APPLY_ENABLED=true
DAEMON_UPDATE_TARGET_PATH=/usr/local/bin/leviathan-daemon
DAEMON_UPDATE_STAGING_DIR=/var/lib/leviathan/updates
```

Packaging-specific service stop/start is still intentionally left to installer integration.

## Secret Encryption

Sensitive values are encrypted at rest with AES-256-GCM before storage when written through the API:

- Cloudflare API token
- S3 secret access key
- Webhook signing secret

Local development uses a deterministic local key if `SECRET_ENCRYPTION_KEY` is unset. Production must set:

```bash
SECRET_ENCRYPTION_KEY="$(openssl rand -base64 32)"
```

The current KMS boundary is the `encryptSecret`/`decryptSecret` adapter. Phase 6 should add cloud KMS envelope providers.

## Runtime Plugins

Trusted plugins can now load runtime code from `PLUGINS_DIR`. Each plugin directory must contain:

```text
plugin.json
index.cjs
```

Only `trusted: true` and `enabled: true` manifests load. Plugins are admin-installed trusted code, not sandboxed.

Example:

```bash
PLUGINS_DIR=examples/plugins
```

The example plugin registers:

```text
GET /v1/plugins/hello-world
```

## Cloudflare Lifecycle

The panel supports create, dry-run, apply, and delete controls for Cloudflare routes. API tokens are redacted from settings responses. Dry-run returns planned Cloudflare operations without calling the Cloudflare API.

## Reverse Proxy Lifecycle

Caddy config generation can write to `LEVIATHAN_PROXY_CONFIG_PATH`. The daemon snapshots the previous config to `.previous` before applying and restores it on write failure.

```bash
LEVIATHAN_PROXY_CONFIG_PATH=/etc/caddy/conf.d/leviathan.caddy
```

Service reload integration is still packaging-specific.

## Browser E2E Tests

Run:

```bash
pnpm test:e2e
```

The initial Playwright coverage verifies local-admin login and release-candidate navigation. Expand this in Phase 6 for complete workflows.

## Remaining Phase 6 Work

- Full embedded SFTP listener or hardened OpenSSH provisioning.
- Daemon service stop/start and package-specific rollback orchestration.
- S3-to-browser backpressure streaming without local staging.
- Plugin webhook/notification/template runtime contribution registries beyond API route loading.
- Full Playwright coverage for server creation, files, backups, Cloudflare, firewall, SFTP, and updates.
