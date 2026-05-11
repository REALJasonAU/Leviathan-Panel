# Phase 3 Runtime Notes

Phase 3 extends the Phase 1/2 monorepo without replacing the foundation. The implementation focuses on real security boundaries, durable records, daemon-side provider abstractions, and UI surfaces for production operations.

## Fully Wired

- API-key authentication accepts `Authorization: Bearer lvk_...`, stores only SHA-256 hashes, shows the raw key once on creation, tracks last use, supports expiry and revocation, and enforces scopes through the same permission gate used by Firebase users. Legacy `vtk_...` keys are still accepted for compatibility.
- Server sub-users are stored on each server with scoped permissions such as `console.view`, `files.read`, `backups.restore`, `network.manage`, and `settings.manage`.
- Scheduled task execution now goes through job records with pending/running/success/failed/cancelled states, lock fields, retry metadata, and a local worker. Firestore mode stores the same records in the `jobs` collection.
- Webhook delivery creates persistent delivery records, signs generic payloads with `x-leviathan-signature: sha256=...`, formats Discord events, and stores delivery status.
- Backup targets support S3-compatible configuration. The daemon can upload, download, restore, and delete S3 backup objects using endpoint, region, bucket, access key, secret key, prefix, and force path style.
- Metrics are persisted and evaluated against alert rules for CPU, RAM, and disk thresholds. Node disconnect and server crash events create alert records.
- Domain mappings are stored per server and the daemon generates Caddy reverse proxy config.
- Firewall rules are stored per server and the daemon generates deterministic UFW commands with a dry-run-first provider.
- The panel now includes Phase 3 navigation for API Keys, Webhooks, Backup Targets, Alerts, Cloudflare, Firewall, and server Sub-users.

## Partial By Design

- SFTP provisioning registers credentials and enforces path isolation, but OS-level OpenSSH user creation is intentionally documented as an operator-enabled step because it requires root privileges and distro-specific hardening.
- Cloudflare Tunnel automation has secure settings and documentation surface, but live Cloudflare API route creation is still a provider integration task for Phase 4.
- Daemon self-update validates the requested manifest shape and returns an auditable rollout plan. Automatic binary replacement is not enabled by default because checksum verification, service replacement, and rollback must be tailored to the packaged installer target.
- File and backup downloads still return base64 through the API in some flows. The daemon S3 provider streams to and from S3, but browser-facing HTTP streaming should be finished in Phase 4.
- Firewall enforcement returns generated UFW commands. Actual command execution is intentionally gated for root/systemd deployments.

## API Key Usage

Create a scoped API key:

```bash
curl -X POST "$API_URL/v1/api-keys" \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  -H "content-type: application/json" \
  -d '{"name":"Automation","scopes":["servers.view","servers.power"],"expiresAt":"2026-12-31T23:59:59.000Z"}'
```

Use it:

```bash
curl "$API_URL/v1/servers" -H "Authorization: Bearer lvk_api_..."
```

Revoke it:

```bash
curl -X DELETE "$API_URL/v1/api-keys/key_id" \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN"
```

## Queue Design

Local development uses the built-in job worker. Production deployments can keep Firestore-backed job records for smaller installs, but high-throughput/multi-region installs should add a Redis/BullMQ adapter behind the same `store.createJob`, `store.claimPendingJobs`, and `store.updateJob` interface.

The current locking fields are:

- `status`
- `attempts`
- `maxAttempts`
- `runAfter`
- `lockedBy`
- `lockedUntil`
- `completedAt`

## S3 Backup Target

Create a target from the panel or API:

```json
{
  "name": "Primary S3",
  "provider": "s3",
  "enabled": true,
  "serverIds": [],
  "s3": {
    "endpoint": "https://s3.example.com",
    "region": "us-east-1",
    "bucket": "leviathan-backups",
    "accessKeyId": "AKIA...",
    "secretAccessKey": "secret",
    "pathPrefix": "leviathan/backups",
    "forcePathStyle": true
  }
}
```

Secrets are redacted from panel responses and audit logs.

## SFTP

The daemon exposes credential rotation/revocation hooks and path isolation tests. For production OpenSSH SFTP, create a restricted group, use chroot-compatible server roots, and map generated credentials to OS users through an operator-approved provisioning script.

Recommended OpenSSH constraints:

```text
Match Group leviathan-sftp
  ChrootDirectory /var/lib/leviathan/servers/%u
  ForceCommand internal-sftp
  AllowTcpForwarding no
  X11Forwarding no
```

## Cloudflare Tunnel

Store Cloudflare account, zone, tunnel name, and token in settings. Do not expose the API token in frontend code. Phase 4 should add a provider that calls Cloudflare DNS and Tunnel APIs from the API service, then sends daemon-side `cloudflared` config reload commands.

## Daemon Update Rollout

The panel/API can send `node.daemon.update` with:

```json
{
  "version": "0.3.0",
  "url": "https://releases.example.com/leviathan-daemon-0.3.0.tar.gz",
  "sha256": "..."
}
```

The daemon returns the rollout plan. Phase 4 should enable signed manifests, checksum verification, service replacement, restart health checks, and rollback.

## Billing And Plugin Interfaces

Billing webhooks are exposed at:

```text
POST /v1/integrations/billing/stripe/webhook
POST /v1/integrations/billing/whmcs/webhook
```

The routes validate provider payload shape and require provider signature headers. They do not provision servers by themselves. Production deployments should implement a `BillingProvisioner` adapter with explicit methods:

- `provisionServer(payload)`
- `suspendServer(payload)`
- `unsuspendServer(payload)`
- `cancelServer(payload)`

Trusted plugins should register through a server-side extension registry, not browser-provided code. Supported extension points planned for Phase 4:

- API routes
- Webhook handlers
- UI navigation entries
- Server template providers
- Notification providers
