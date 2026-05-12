# Phase 4 Production Notes

Phase 4 closes more production gaps without replacing the Phase 1-3 architecture. The project now has stronger production adapters and validated extension contracts, but a few operating-system-specific actions remain gated for safety.

## Queue Setup

Local development uses the built-in job worker:

```bash
QUEUE_DRIVER=local
```

Production can use BullMQ:

```bash
QUEUE_DRIVER=bullmq
REDIS_URL=redis://localhost:6379
```

BullMQ jobs still mirror to the `jobs` store so the panel and API can show job history. The local adapter is fine for development; use BullMQ for multi-instance API deployments.

## Streaming Files And Backups

New browser-facing endpoints:

```text
POST /v1/servers/:id/files/upload
GET  /v1/servers/:id/files/download?path=...
GET  /v1/backups/:id/stream
```

Uploads are multipart and enforce `FILE_UPLOAD_LIMIT_MB`. Downloads return binary responses to the browser instead of JSON/base64. The daemon command bus still returns some payloads over request/response messages, so true daemon-to-API backpressure streaming should be finished in Phase 5.

## S3 Backups

S3-compatible targets support endpoint, region, bucket, access key, secret key, path prefix, and force path style. The daemon streams to and from S3 using the AWS SDK.

## Cloudflare

Cloudflare routes support:

- Account ID
- Zone ID
- Tunnel ID
- API token
- Hostname
- Service URL
- Dry-run mode

Required token permissions:

- Zone DNS edit
- Cloudflare Tunnel edit
- Account read

Secrets are redacted from settings responses and audit logs.

## Firewall

The daemon generates UFW commands as argument arrays rather than shell strings. Apply mode only runs when:

```bash
FIREWALL_APPLY_ENABLED=true
```

Otherwise the daemon returns dry-run output. This avoids accidental root-level firewall mutation during development.

## SFTP

SFTP credentials now include rotation, revoke, expiry, and daemon-side lifecycle validation. The current implementation provides the virtual credential registry and isolation checks. Production OpenSSH or a full embedded SFTP network listener still requires operator-specific binding in Phase 5.

## Daemon Updates

Update commands now require a signed manifest:

```json
{
  "version": "0.4.0",
  "url": "https://releases.example.com/leviathan-daemon.tar.gz",
  "sha256": "64 lowercase hex chars",
  "signature": "base64 signature",
  "publishedAt": "2026-05-11T00:00:00.000Z"
}
```

The daemon verifies the signature and returns a staged rollout/rollback plan. Automatic service replacement remains disabled until packaging is finalized.

## Plugins

Plugins are trusted, admin-installed manifests. They are not sandboxed.

Supported manifest contribution points:

- API routes
- Webhook handlers
- Notification providers
- Server template providers
- Admin navigation entries
- User navigation entries

Example: `examples/plugins/hello-world/plugin.json`.

## Billing

Stripe and WHMCS webhook routes validate provider shape and signatures when secrets are configured.

```bash
STRIPE_WEBHOOK_SECRET=whsec_...
WHMCS_WEBHOOK_SECRET=shared-secret
```

Billing events map to provision, suspend, unsuspend, terminate, update-limits, or ignore. Actual provisioning policy should be implemented in a deployment-specific provisioner adapter.

## Security Checklist

- Keep `MOCK_AUTH=false` and `MOCK_DATA=false` in production.
- Restrict CORS with `PANEL_ORIGIN`.
- Keep Leviathan secrets encrypted server-side and out of frontend env files.
- Use SQL-backed control-plane writes for operational collections.
- Rotate API keys and daemon tokens periodically.
- Keep Cloudflare, S3, webhook, Stripe, WHMCS, and daemon secrets out of frontend env files.
- Enable HTTPS at the reverse proxy.
- Keep `FIREWALL_APPLY_ENABLED=false` until the node is intentionally configured for UFW management.
- Use BullMQ/Redis for multi-instance scheduler deployments.
