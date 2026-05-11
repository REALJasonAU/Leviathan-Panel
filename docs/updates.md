# Release And Update Operations

This document covers versioning, daemon release artifacts, signed update manifests, and panel/API update steps for Leviathan.

## Versioning Guidance

- Use semantic versioning for release tags.
- Treat the current milestone as release-candidate quality until the remaining partial systems are completed.
- Recommended initial public tag format:
  - `v0.1.0-rc.1`
  - `v0.1.0-rc.2`
  - `v0.1.0`

## Daemon Release Artifact Publishing

The daemon updater expects:

- an artifact URL
- a SHA-256 checksum
- a detached signature or public-key-verifiable signature
- a version string

Example manifest shape:

```json
{
  "version": "0.1.0-rc.1",
  "url": "https://releases.example.com/leviathan-daemon.tar.gz",
  "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "signature": "base64-signature"
}
```

Publish flow:

1. Build the daemon artifact.
2. Generate the checksum.
3. Sign the manifest with the release private key.
4. Upload the artifact and manifest to your release bucket or HTTPS host.
5. Update the panel-side release metadata or operator docs.

## Daemon Update Runtime

Recommended daemon environment:

```bash
DAEMON_UPDATE_APPLY_ENABLED=true
DAEMON_UPDATE_TARGET_PATH=/usr/local/bin/leviathan-daemon
DAEMON_UPDATE_STAGING_DIR=/var/lib/leviathan/updates
```

The current updater workflow:

1. Download update artifact
2. Verify checksum and signature
3. Stage artifact
4. Replace daemon target
5. Restart service
6. Run health check
7. Roll back if the health check fails

## Panel/API Update Steps

Update the panel/API host:

```bash
sudo bash /opt/leviathan/installers/panel/update.sh
```

Validate:

```bash
systemctl status leviathan-api.service --no-pager
systemctl status leviathan-panel.service --no-pager
curl https://panel.example.com/health
```

## Daemon Update Steps

Update a daemon host:

```bash
sudo bash /opt/leviathan/installers/daemon/update.sh
```

Validate:

```bash
systemctl status leviathan-daemon.service --no-pager
curl http://127.0.0.1:4100/health
```

## Rollback Guidance

If an update fails:

1. Review `journalctl -u leviathan-daemon.service -n 200 --no-pager`
2. Restore the previous daemon artifact if the automatic rollback did not complete
3. Re-run health checks
4. Leave the node in maintenance mode until validated

## Release Checklist

Use:

- [Release Checklist](./release-checklist.md)
