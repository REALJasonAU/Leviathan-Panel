# Security Checklist

## Core Runtime

- panel and API are behind HTTPS
- session cookies are `Secure` in production deployments
- only intended panel origins are allowed by CORS

## Accounts And Sessions

- first admin password is strong and unique
- local passwords are never stored plaintext
- API keys are only shown once and stored hashed
- revoked or expired API keys are pruned or monitored
- sensitive admin actions generate audit records

## Panel MariaDB

- MariaDB runs locally or on a protected private network path
- the Leviathan panel DB user is scoped to its database only
- root MariaDB access is limited
- database backups are tested

## Daemon MariaDB

- each daemon host has its own separate local database
- daemon DB credentials are not shared with the panel
- daemon-local backups and operational records are monitored as needed

## Secrets

- Cloudflare, S3, webhook, billing, and similar secrets remain encrypted at rest
- secrets are redacted from logs, audit records, and panel payloads
- one-time secret reveal flows are used where intended
- `.env` files are permissioned tightly

## Daemon And Node Security

- bootstrap tokens are treated as sensitive and short-lived
- daemon tokens are rotated when needed
- Docker access is restricted to trusted node operators
- reverse proxy, Cloudflare, firewall, and SFTP features are staged before broad use

## Update / Recovery

- auto-update timers are monitored rather than assumed
- panel and daemon update logs are reviewed after rollout
- restore drills exist for panel DB, daemon DB, and server data
- rollback steps are documented for daemon updates and infrastructure changes
