# Daemon Installer

The daemon installer is designed to get a Linux node online with as few manual steps as possible. It detects `/etc/os-release`, chooses a supported package manager, installs safe dependencies, installs Docker when requested, installs and enables local MariaDB for node-local operational state, writes daemon configuration, creates the systemd service plus a daily update timer, and validates panel reachability, MariaDB, Docker, and service startup.

## Supported Distro Matrix

| Distro        | Package Manager | Status         | Notes                                                                                                              |
| ------------- | --------------- | -------------- | ------------------------------------------------------------------------------------------------------------------ |
| Ubuntu        | `apt`           | Fully targeted | Primary tested path. Installs Docker through Docker's official convenience script and Node.js through NodeSource.  |
| Debian        | `apt`           | Fully targeted | Primary tested path. Same dependency flow as Ubuntu.                                                               |
| Fedora        | `dnf`           | Best-effort    | Uses `dnf`, Docker convenience script, and NodeSource RPM setup. Validate in staging before production.            |
| Rocky Linux   | `dnf`/`yum`     | Best-effort    | Uses RPM-family package flow. Validate firewall/OpenSSH package names for your version.                            |
| AlmaLinux     | `dnf`/`yum`     | Best-effort    | Uses RPM-family package flow. Validate firewall/OpenSSH package names for your version.                            |
| CentOS Stream | `dnf`/`yum`     | Best-effort    | Uses RPM-family package flow. Validate Docker repository behavior for your version.                                |
| Arch Linux    | `pacman`        | Best-effort    | Installs distro packages with `pacman`; `cloudflared` usually requires AUR or a manual Cloudflare release package. |

Only Ubuntu and Debian should be considered fully tested until CI/container smoke tests are added for the other distros.

## One-Command Install

Recommended raw GitHub one-line install:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/REALJasonAU/Leviathan-Panel/refs/heads/master/installers/daemon/install.sh) \
  --panel-url https://panel.example.com \
  --node-id node_123 \
  --bootstrap-token nd_bootstrap_xxx
```

Run from the Leviathan monorepo root on the node:

```bash
sudo bash installers/daemon/install.sh \
  --panel-url https://panel.example.com \
  --node-id node_123 \
  --bootstrap-token nd_bootstrap_xxx \
  --non-interactive
```

Interactive mode prompts for missing panel URL, node ID, and bootstrap token:

```bash
sudo bash installers/daemon/install.sh
```

Dry-run mode prints the actions without changing the system:

```bash
bash installers/daemon/install.sh \
  --panel-url https://panel.example.com \
  --node-id node_123 \
  --bootstrap-token nd_bootstrap_xxx \
  --dry-run
```

## Options

```text
--base-dir PATH             Daemon data directory, default /var/lib/leviathan
--daemon-port PORT          Daemon HTTP port, default 4100
--install-dir PATH          Install directory, default /opt/leviathan
--workdir PATH              Source checkout to copy from; if missing, the installer clones from GitHub
--repo-url URL              Leviathan Git repository
--repo-branch NAME          Git branch or tag to install
--db-name NAME              Local daemon MariaDB database name
--db-user USER              Local daemon MariaDB user
--db-password PASS          Local daemon MariaDB password
--enable-cloudflare         Install/check cloudflared where supported
--enable-firewall           Install/check ufw or nftables
--firewall-provider NAME    ufw or nftables, default ufw
--enable-sftp-openssh       Install/check openssh-server for OpenSSH SFTP mode
--disable-auto-update       Skip installation of the daily update timer
--skip-docker-install       Fail if Docker is missing instead of installing it
--non-interactive           Fail instead of prompting for missing values
--dry-run                   Print actions without changing the system
```

## What The Installer Checks

- Required tools: `curl`, `bash`, `ca-certificates`, `tar`, `gzip`, `systemd`, `rsync`, `git`, Node.js 20+, and `pnpm`.
- Docker: installed automatically unless `--skip-docker-install` is set, then enabled and started with systemd.
- MariaDB: installed automatically, enabled with systemd, and provisioned with a daemon-local database and DB user.
- Source handling: uses `--workdir` when it points at the monorepo; otherwise clones the configured repo/branch from GitHub.
- Optional Cloudflare: `cloudflared` is installed automatically on `apt`; RPM-family and Arch print exact manual guidance if automatic install is not safe.
- Optional firewall: installs `ufw` or `nftables` depending on `--firewall-provider`.
- Optional SFTP/OpenSSH: installs `openssh-server` on apt/RPM-family distros or `openssh` on Arch.
- Users and folders: creates a `leviathan` system user for ownership/future hardening and creates `/var/lib/leviathan`, `/var/lib/leviathan/servers`, and `/var/lib/leviathan/backups`.
- Runtime validation: `GET /health` against the panel/API host, `mysql -uroot -e "SELECT 1"`, `docker info`, and `systemctl is-active leviathan-daemon.service`.
- Services:
  - `leviathan-daemon.service`
  - `leviathan-daemon-update.timer` by default

## Update

```bash
sudo bash /opt/leviathan/installers/daemon/update.sh
```

Dry-run:

```bash
bash /opt/leviathan/installers/daemon/update.sh --dry-run
```

## Uninstall

```bash
sudo bash /opt/leviathan/installers/daemon/uninstall.sh
```

Keep server data:

```bash
sudo bash /opt/leviathan/installers/daemon/uninstall.sh --keep-data
```

## Useful Commands

```bash
systemctl status leviathan-daemon.service --no-pager
journalctl -u leviathan-daemon.service -f
systemctl restart leviathan-daemon.service
docker info
```
