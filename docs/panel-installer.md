# Panel Installer

The Leviathan panel installer provisions the API and Svelte panel on a Linux host with as few manual steps as practical. It detects `/etc/os-release`, chooses a supported package manager, installs safe dependencies, installs Docker when needed, installs and enables local MariaDB, seeds the first Leviathan admin account, writes API and panel environment files, creates systemd services plus a daily update timer, and validates the API, panel, MariaDB, and Docker runtime before declaring success.

## Supported Distro Matrix

| Distro        | Package Manager | Status         | Notes                                                                                             |
| ------------- | --------------- | -------------- | ------------------------------------------------------------------------------------------------- |
| Ubuntu        | `apt`           | Fully targeted | Primary tested path for panel/API deployment. Uses NodeSource for Node.js 20+ and Docker install. |
| Debian        | `apt`           | Fully targeted | Primary tested path for panel/API deployment.                                                     |
| Fedora        | `dnf`           | Best-effort    | Uses RPM-family package flow. Validate in staging before production.                              |
| Rocky Linux   | `dnf`/`yum`     | Best-effort    | Package names are handled, but distro-specific smoke tests are still recommended.                 |
| AlmaLinux     | `dnf`/`yum`     | Best-effort    | Package names are handled, but distro-specific smoke tests are still recommended.                 |
| CentOS Stream | `dnf`/`yum`     | Best-effort    | Package names are handled, but Docker repository behavior should be verified in staging.          |
| Arch Linux    | `pacman`        | Best-effort    | Uses distro packages with `pacman`; validate your local Node.js and Docker package state first.   |

Only Ubuntu and Debian should be treated as fully supported release-candidate targets until distro-specific CI smoke tests are added.

## One-Command Install

Recommended raw GitHub one-line install:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/REALJasonAU/Leviathan-Panel/main/installers/panel/install.sh)
```

Run from the Leviathan monorepo root on the panel/API host:

```bash
sudo bash installers/panel/install.sh \
  --panel-origin https://panel.example.com \
  --api-base-url https://panel.example.com \
  --non-interactive
```

If you are testing locally on the host, the defaults are enough:

```bash
sudo bash installers/panel/install.sh
```

Dry-run mode prints the full plan without changing the machine:

```bash
bash installers/panel/install.sh \
  --panel-origin https://panel.example.com \
  --api-base-url https://panel.example.com \
  --dry-run
```

## Options

```text
--install-dir PATH         Install directory, default /opt/leviathan
--workdir PATH             Source checkout to copy from; if missing, the installer clones from GitHub
--repo-url URL             Leviathan Git repository
--repo-branch NAME         Git branch or tag to install
--api-port PORT            API listen port, default 4000
--panel-port PORT          Panel listen port, default 4173
--panel-origin URL         Public panel origin used for API CORS
--api-base-url URL         Public API base URL baked into panel assets
--db-name NAME             Local panel MariaDB database name
--db-user USER             Local panel MariaDB user
--db-password PASS         Local panel MariaDB password
--admin-username NAME      First admin username
--admin-email EMAIL        First admin email
--admin-password PASS      First admin password
--disable-auto-update      Skip installation of the daily update timer
--skip-docker-install      Fail if Docker is missing instead of installing it
--non-interactive          Fail instead of prompting for missing values
--dry-run                  Print actions without changing the system
```

## What The Installer Checks

- Required tools: `curl`, `bash`, `ca-certificates`, `tar`, `gzip`, `systemd`, `rsync`, `git`, Node.js 20+, and `pnpm`.
- Docker: installed automatically unless `--skip-docker-install` is set, then enabled and started with systemd.
- MariaDB: installed automatically, enabled with systemd, and provisioned with a local Leviathan database and DB user.
- Source handling: uses `--workdir` when it points at the monorepo; otherwise clones the configured repo/branch from GitHub.
- Build and copy: copies the monorepo into `/opt/leviathan`, runs `pnpm install`, and builds every workspace package.
- Environment files:
  - `apps/api/.env` is generated with SQL/session settings and production-safe mock flags disabled
  - `apps/panel/.env` is generated with the configured public API base URL
- Admin bootstrap:
  - prompts for first admin username, email, and password unless supplied as flags
  - seeds the account through `pnpm --filter @voltan/api seed`
- Services:
  - `leviathan-api.service`
  - `leviathan-panel.service`
  - `leviathan-panel-update.timer` by default
- Runtime validation:
  - `GET /health` on the API
  - `GET /` on the panel preview service
  - `mysql -uroot -e "SELECT 1"`
  - `docker info`
  - `systemctl is-active` for both services

## Update

```bash
sudo bash /opt/leviathan/installers/panel/update.sh
```

Dry-run:

```bash
bash /opt/leviathan/installers/panel/update.sh --dry-run
```

## Uninstall

```bash
sudo bash /opt/leviathan/installers/panel/uninstall.sh
```

Keep the copied install directory in place:

```bash
sudo bash /opt/leviathan/installers/panel/uninstall.sh --keep-data
```

## Useful Commands

```bash
systemctl status leviathan-api.service --no-pager
systemctl status leviathan-panel.service --no-pager
journalctl -u leviathan-api.service -f
journalctl -u leviathan-panel.service -f
systemctl restart leviathan-api.service
systemctl restart leviathan-panel.service
```

## Troubleshooting

- API logs: `journalctl -u leviathan-api.service -n 100 --no-pager`
- Panel logs: `journalctl -u leviathan-panel.service -n 100 --no-pager`
- MariaDB logs: `journalctl -u mariadb.service -n 100 --no-pager`
- Docker: `systemctl status docker --no-pager`
- If the panel cannot reach the API from a browser, re-check `--api-base-url` and your reverse proxy routing for `/v1` and `/health`.
