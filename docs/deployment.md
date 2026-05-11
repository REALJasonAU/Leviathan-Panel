# Production Deployment Guide

This guide covers the current Leviathan release-candidate deployment path. Ubuntu 22.04+ and Debian 12+ are the fully targeted operating systems. Fedora, Rocky Linux, AlmaLinux, CentOS Stream, and Arch Linux are installer-supported on a best-effort basis and should be validated in staging before production.

## 1. Recommended Topology

- Panel/API host:
  - Ubuntu 22.04 or Debian 12
  - 2 vCPU minimum
  - 4 GB RAM minimum
  - Public HTTPS endpoint for the panel and API
- Daemon/node host:
  - Ubuntu 22.04 or Debian 12
  - Docker Engine
  - Enough disk for workspaces and backups
  - Outbound HTTPS access to the panel/API host
- Optional shared services:
  - Redis for BullMQ production queue mode
  - S3-compatible object storage for remote backups
  - Cloudflare account for Tunnel and DNS automation

## 2. Clone And Prepare The Repository

```bash
git clone <your-leviathan-repo-url> leviathan
cd leviathan
corepack enable
pnpm install
```

## 3. Panel/API Host Setup

The panel installer now supports distro detection, dependency installation, Docker setup, systemd services, dry-run, and update/uninstall flows.

Installer docs:

- [Panel Installer](./panel-installer.md)

Install from the repository checkout:

```bash
sudo bash installers/panel/install.sh \
  --panel-origin https://panel.example.com \
  --api-base-url https://panel.example.com \
  --non-interactive
```

Validated commands after install:

```bash
systemctl status leviathan-api.service --no-pager
systemctl status leviathan-panel.service --no-pager
journalctl -u leviathan-api.service -f
journalctl -u leviathan-panel.service -f
```

## 4. Firebase Setup

Use the dedicated guide:

- [Firebase Setup](./firebase-setup.md)

At minimum:

1. Create a Firebase project.
2. Enable Authentication and the Google provider.
3. Enable Firestore in native mode.
4. Create a service account for the API.
5. Populate:
   - `apps/api/.env`
   - `apps/panel/.env`
6. Seed the initial admin account and default roles/templates:

```bash
cd apps/api
export ADMIN_UID="your-firebase-uid"
export ADMIN_EMAIL="owner@example.com"
pnpm seed
```

## 5. Docker Setup

Docker is installed automatically by the panel and daemon installers unless you pass `--skip-docker-install`.

Validate the runtime:

```bash
docker info
docker version
systemctl status docker --no-pager
```

## 6. Redis / BullMQ Queue Setup

Local development can use the in-process queue. Production should use Redis.

Example Ubuntu install:

```bash
sudo apt-get update
sudo apt-get install -y redis-server
sudo systemctl enable --now redis-server
redis-cli ping
```

Set API environment variables:

```bash
QUEUE_DRIVER=bullmq
REDIS_URL=redis://127.0.0.1:6379
```

Leviathan will fall back to local queue mode only when production Redis is not configured. For release-candidate deployments, Redis is strongly recommended.

## 7. S3 Backup Setup

Create a backup target in the panel or seed it through the API settings flow with:

- endpoint
- region
- bucket
- access key ID
- secret access key
- optional path prefix
- optional force path style

These values are encrypted at rest by the API secret storage layer.

For MinIO-style targets, set:

```text
endpoint=http://minio.internal:9000
forcePathStyle=true
```

Backups can run locally without S3, but S3-compatible storage is recommended for disaster recovery.

## 8. Daemon / Node Setup

Use the dedicated daemon installer guide:

- [Daemon Installer](./daemon-installer.md)

Create the node in the panel first, then install on the node host:

```bash
sudo bash installers/daemon/install.sh \
  --panel-url https://panel.example.com \
  --node-id node_123 \
  --bootstrap-token nd_bootstrap_xxx \
  --non-interactive
```

Validated commands after install:

```bash
systemctl status leviathan-daemon.service --no-pager
journalctl -u leviathan-daemon.service -f
curl http://127.0.0.1:4100/health
```

## 9. Reverse Proxy Setup

Leviathan can generate daemon-side Caddy config for server mappings, but the panel/API host still needs a front door.

Recommended host routing:

- `https://panel.example.com/` -> Leviathan panel
- `https://panel.example.com/v1/*` -> Leviathan API
- `https://panel.example.com/health` -> Leviathan API health route

If you want daemon-side generated Caddy output for workload domains, set:

```bash
LEVIATHAN_PROXY_CONFIG_PATH=/etc/caddy/conf.d/leviathan.caddy
```

Manual Caddy or Traefik validation is still part of the operator workflow before full automatic roll-forward.

## 10. Cloudflare Tunnel Setup

Leviathan supports Cloudflare settings storage, route records, and dry-run/apply/delete lifecycle flows.

Provide:

- account ID
- zone ID
- tunnel ID
- API token

Cloudflare token permissions should cover:

- DNS edit for the target zone
- Tunnel configuration edit for the target account

If you prefer manual bootstrap of `cloudflared`, install it first on the node and then use Leviathan only for config generation and route lifecycle management.

Reference example:

- [examples/cloudflare/tunnel.example.yml](../examples/cloudflare/tunnel.example.yml)

## 11. Firewall Setup

Leviathan currently supports safe rule generation plus daemon-side application hooks. For production:

1. Decide whether the node will use `ufw` or `nftables`.
2. Install the matching package through the daemon installer flags:

```bash
sudo bash installers/daemon/install.sh \
  --panel-url https://panel.example.com \
  --node-id node_123 \
  --bootstrap-token nd_bootstrap_xxx \
  --enable-firewall \
  --firewall-provider ufw
```

3. Use dry-run from the panel before applying live rules.

Root-level firewall enforcement remains a carefully controlled path and should be validated in staging before broad rollout.

## 12. SFTP Setup

Current Leviathan status:

- Credential lifecycle is implemented:
  - create
  - rotate
  - revoke
  - expiry metadata
- Network-facing production SFTP serving still requires operator-specific daemon/node setup and should be treated as partial.

If you are using OpenSSH mode on a node, the installer can install the package:

```bash
sudo bash installers/daemon/install.sh \
  --panel-url https://panel.example.com \
  --node-id node_123 \
  --bootstrap-token nd_bootstrap_xxx \
  --enable-sftp-openssh
```

See Phase notes and the security checklist before enabling external SFTP access on a public node.

## 13. Daemon Update Setup

Leviathan supports signed update manifests and daemon-side staged update execution. For production:

```bash
DAEMON_UPDATE_APPLY_ENABLED=true
DAEMON_UPDATE_TARGET_PATH=/usr/local/bin/leviathan-daemon
DAEMON_UPDATE_STAGING_DIR=/var/lib/leviathan/updates
```

See:

- [Release And Update Operations](./updates.md)

## 14. Backup / Restore Disaster Recovery

Recommended recovery posture:

1. Keep local node backups for quick restore.
2. Mirror critical workloads to S3-compatible storage.
3. Back up Firestore separately through your Google Cloud backup process.
4. Export panel/API environment files and service definitions.

Disaster recovery checklist:

1. Restore Firebase credentials and Firestore data.
2. Restore API and panel environment files.
3. Reinstall Leviathan on the panel/API host.
4. Reinstall each daemon node and reconnect it to the panel.
5. Restore server data from local or S3 backup targets.
6. Re-validate Cloudflare, reverse proxy, and firewall state.

## 15. Security Checklist

Use the dedicated checklist before production go-live:

- [Security Checklist](./security-checklist.md)

At minimum:

- terminate TLS in front of the panel/API
- keep mock auth/data disabled
- encrypt provider secrets
- restrict Firestore client access
- enable Redis for queue locking
- validate audit logs for sensitive actions
- verify rate limits on auth, API keys, file operations, backups, daemon updates, Cloudflare, and firewall changes

## 16. Update And Uninstall Commands

Panel:

```bash
sudo bash /opt/leviathan/installers/panel/update.sh
sudo bash /opt/leviathan/installers/panel/uninstall.sh
```

Daemon:

```bash
sudo bash /opt/leviathan/installers/daemon/update.sh
sudo bash /opt/leviathan/installers/daemon/uninstall.sh
```
