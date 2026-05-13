# Deployment Guide

## 1. Scope

This guide describes the current recommended Leviathan deployment model:

- Ubuntu or Debian for the panel/API host
- Ubuntu or Debian for daemon nodes
- local MariaDB on the panel host
- separate local MariaDB on each daemon host
- Docker on daemon hosts
- optional Redis/BullMQ, S3, Cloudflare, firewall, reverse proxy, and SFTP features

Fedora, Rocky Linux, AlmaLinux, CentOS Stream, and Arch Linux remain best-effort installer targets until they receive dedicated smoke testing.

## 2. Panel/API Host

Recommended one-line install:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/REALJasonAU/Leviathan-Panel/refs/heads/master/installers/panel/install.sh)
```

The installer will:

- install Node.js and pnpm
- install Docker if needed
- install and enable MariaDB
- provision the panel database and database user
- prompt for panel origin plus the first admin username, email, and password
- build Leviathan
- write `.env` files
- install systemd services
- enable daily update timers by default

## 3. Daemon/Node Host

Recommended one-line install:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/REALJasonAU/Leviathan-Panel/refs/heads/master/installers/daemon/install.sh) \
  --panel-url https://panel.example.com \
  --node-id node_123 \
  --bootstrap-token nd_bootstrap_xxx
```

The installer will:

- install Node.js and pnpm
- install Docker if needed
- install and enable MariaDB
- provision the daemon-local database and database user
- build Leviathan
- write the daemon `.env`
- install the daemon systemd service
- enable the daemon update timer by default

## 4. Reverse Proxy / TLS

Leviathan should sit behind a normal reverse proxy such as Caddy.

Example Caddy layout:

```caddy
panel.example.com {
  reverse_proxy /v1/* 127.0.0.1:4000
  reverse_proxy /health 127.0.0.1:4000
  reverse_proxy 127.0.0.1:4173
}
```

## 5. Redis / BullMQ

Optional for larger installs:

- set `QUEUE_DRIVER=bullmq`
- set `REDIS_URL=redis://...`

If you stay with `QUEUE_DRIVER=local`, Leviathan runs the built-in worker path.

## 6. S3 Backups

Configure backup targets through the panel UI or API. Keep S3 credentials server-side only. Use a dedicated IAM user or S3-compatible access key with the narrowest permissions possible.

## 7. Cloudflare

Cloudflare integration is optional. If enabled:

- keep API tokens encrypted at rest
- scope tokens narrowly to the required zone/account permissions
- use dry-run before apply in production

## 8. Firewall / SFTP / Reverse Proxy

These features are available in varying states of completeness:

- firewall apply flows should be staged carefully
- full embedded SFTP serving is still a partial area
- reverse-proxy config generation exists and should be validated in staging before wide rollout

## 9. Backup / Restore Recovery

Minimum recovery checklist:

1. Back up the panel MariaDB database.
2. Back up daemon MariaDB databases where operational history matters.
3. Back up server data directories.
4. Back up local backup archives or validate S3 lifecycle/retention externally.
5. Keep a copy of panel and daemon `.env` files in secure secret storage.

## 10. Security Checklist

Before production launch:

- use HTTPS
- keep browser auth on secure cookie sessions
- keep the panel and daemon pointed at their MariaDB instances
- rotate bootstrap and daemon tokens if exposed
- protect MariaDB root access
- protect panel and daemon hosts with OS-level hardening
- verify update timers, backups, and health checks

See [Security Checklist](./security-checklist.md) for the fuller operational list.
