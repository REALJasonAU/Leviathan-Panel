# Security Checklist

Use this checklist before calling a Leviathan deployment production-ready.

## Identity And Authentication

- Firebase Authentication is configured for the real project, not mock mode.
- `MOCK_AUTH=false` and `MOCK_DATA=false` in every production API environment.
- Panel Firebase config points at the correct production project.
- Google sign-in is restricted to the intended tenant or email policy where required.

## Secrets

- `SECRET_ENCRYPTION_KEY` is set to a strong production value.
- Cloudflare tokens are encrypted at rest.
- S3 secrets are encrypted at rest.
- Webhook signing secrets are encrypted at rest.
- Billing secrets are encrypted at rest.
- Daemon bootstrap and live tokens are not exposed in panel responses except one-time values where intended.
- Logs and audit logs are checked to confirm secret redaction is working.

## API Keys

- API keys use hashed storage only.
- Operators understand that raw API keys are shown once at creation time.
- Expiry and revocation workflows are documented for admins.
- Scopes are limited to the minimum required permissions.
- Legacy `vtk_` keys are rotated to the Leviathan `lvk_` prefix where practical.

## Network And Transport

- TLS termination is enabled in front of the panel/API host.
- Reverse proxy rules expose only intended routes.
- Daemon nodes can reach the panel/API host over HTTPS.
- Firewall defaults are reviewed before enabling live apply.
- Cloudflare tokens have least-privilege access for DNS and tunnel configuration.

## Queue And Background Work

- Production uses Redis/BullMQ rather than local queue mode.
- Redis is restricted to trusted network paths.
- Failed-job visibility is enabled through the Jobs page or logs.

## Audit And Rate Limiting

- Audit logs are reviewed for:
  - API key creation/revocation
  - daemon token rotation
  - backup restore/delete
  - file upload/delete
  - console commands
  - SFTP credential rotation/revoke
  - Cloudflare route sync/delete
  - firewall dry-run/apply
  - plugin install/enable/disable
  - daemon update actions
- Sensitive routes are covered by Fastify rate limits.
- Production logs are retained long enough to investigate incidents.

## Firestore And Firebase

- Firestore rules remain narrow and do not allow broad direct client writes to secrets or operational collections.
- Admin SDK credentials are stored only on the API host.
- Firebase service account permissions are limited to what Leviathan needs.

## Daemon Nodes

- Docker is installed from a trusted source and validated with `docker info`.
- Daemon systemd service is enabled and stable.
- Node base directories under `/var/lib/leviathan` have reviewed permissions.
- Daemon update staging directory is writable only to trusted operators.

## Still Partial

- Full production SFTP network serving still needs operator-specific node hardening.
- Root-level firewall enforcement should be staged and verified before broad rollout.
- Multi-distro support outside Ubuntu/Debian is still best-effort until smoke-tested in CI.
