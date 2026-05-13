#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${SERVICE_NAME:-leviathan-daemon}"
UPDATE_SERVICE_NAME="${UPDATE_SERVICE_NAME:-leviathan-daemon-update}"
UPDATE_TIMER_NAME="${UPDATE_TIMER_NAME:-leviathan-daemon-update}"
INSTALL_DIR="${INSTALL_DIR:-/opt/leviathan}"
INSTALL_MARKER="${INSTALL_MARKER:-${INSTALL_DIR}/.leviathan-install.json}"
WORKDIR="${WORKDIR:-$(pwd)}"
SOURCE_DIR=""
TEMP_SOURCE_DIR=""
REPO_URL="${REPO_URL:-https://github.com/REALJasonAU/Leviathan-Panel.git}"
REPO_BRANCH="${REPO_BRANCH:-master}"
PANEL_URL="${PANEL_URL:-}"
NODE_ID="${NODE_ID:-}"
BOOTSTRAP_TOKEN="${BOOTSTRAP_TOKEN:-}"
DAEMON_BASE_DIR="${DAEMON_BASE_DIR:-/var/lib/leviathan}"
DAEMON_PORT="${DAEMON_PORT:-4100}"
DAEMON_DB_NAME="${DAEMON_DB_NAME:-leviathan_daemon}"
DAEMON_DB_USER="${DAEMON_DB_USER:-leviathan_daemon}"
DAEMON_DB_PASSWORD="${DAEMON_DB_PASSWORD:-}"
DRY_RUN=false
SKIP_DOCKER_INSTALL=false
NON_INTERACTIVE=false
AUTO_UPDATE=true
ENABLE_CLOUDFLARE=false
ENABLE_FIREWALL=false
ENABLE_SFTP_OPENSSH=false
FIREWALL_PROVIDER="${FIREWALL_PROVIDER:-ufw}"
DISTRO_ID="unknown"
DISTRO_LIKE=""
PACKAGE_MANAGER=""
PACKAGE_REFRESHED=false
MARIADB_SERVICE="mariadb"

usage() {
  cat <<EOF
Leviathan daemon installer

Usage:
  sudo bash install.sh --panel-url https://panel.example.com --node-id node_123 --bootstrap-token nd_bootstrap_xxx [options]
  bash <(curl -fsSL https://raw.githubusercontent.com/REALJasonAU/Leviathan-Panel/refs/heads/master/installers/daemon/install.sh) --panel-url https://panel.example.com --node-id node_123 --bootstrap-token nd_bootstrap_xxx [options]

Required unless prompted interactively:
  --panel-url URL             Public URL of the Leviathan panel/API
  --node-id ID                Node ID from the panel
  --bootstrap-token TOKEN     One-time daemon bootstrap token from the panel

Options:
  --base-dir PATH             Daemon server data directory (default: /var/lib/leviathan)
  --daemon-port PORT          Daemon HTTP port (default: 4100)
  --install-dir PATH          Install directory (default: /opt/leviathan)
  --workdir PATH              Source checkout to copy from. If omitted or invalid, the installer clones from GitHub.
  --repo-url URL              Leviathan Git repository (default: ${REPO_URL})
  --repo-branch NAME          Git branch/tag to install (default: ${REPO_BRANCH})
  --db-name NAME              Local daemon MariaDB database name (default: leviathan_daemon)
  --db-user USER              Local daemon MariaDB user (default: leviathan_daemon)
  --db-password PASS          Local daemon MariaDB password (default: generated)
  --enable-cloudflare         Install/check cloudflared
  --enable-firewall           Install/check ufw or nftables
  --firewall-provider NAME    ufw or nftables (default: ufw)
  --enable-sftp-openssh       Install/check OpenSSH server for SFTP mode
  --skip-docker-install       Do not install Docker automatically
  --disable-auto-update       Do not install the daily update timer
  --non-interactive           Fail instead of prompting for missing values
  --dry-run                   Print actions without changing the system
  --help                      Show this help

Supported distro handling:
  Ubuntu/Debian: tested path using apt
  Fedora/Rocky/AlmaLinux/CentOS Stream: best-effort path using dnf/yum
  Arch Linux: best-effort path using pacman
EOF
}

log() {
  echo "[leviathan-daemon] $*"
}

fail() {
  echo "[leviathan-daemon] ERROR: $*" >&2
  exit 1
}

run() {
  if [[ "${DRY_RUN}" == "true" ]]; then
    printf '[dry-run]'; printf ' %q' "$@"; printf '\n'
  else
    "$@"
  fi
}

run_shell() {
  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "[dry-run] $*"
  else
    bash -lc "$*"
  fi
}

cleanup_temp_source() {
  if [[ -n "${TEMP_SOURCE_DIR}" && -d "${TEMP_SOURCE_DIR}" && "${DRY_RUN}" != "true" ]]; then
    rm -rf "${TEMP_SOURCE_DIR}"
  fi
}

is_already_installed() {
  if [[ -f "${INSTALL_MARKER}" && -f "/etc/systemd/system/${SERVICE_NAME}.service" ]]; then
    return 0
  fi

  [[ -d "${INSTALL_DIR}" && -f "/etc/systemd/system/${SERVICE_NAME}.service" ]]
}

need_root() {
  if [[ "${DRY_RUN}" == "true" ]]; then
    return
  fi
  if [[ "${EUID}" -ne 0 ]]; then
    fail "Please run as root: sudo bash installers/daemon/install.sh ..."
  fi
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --panel-url) PANEL_URL="$2"; shift 2 ;;
      --node-id) NODE_ID="$2"; shift 2 ;;
      --bootstrap-token) BOOTSTRAP_TOKEN="$2"; shift 2 ;;
      --base-dir) DAEMON_BASE_DIR="$2"; shift 2 ;;
      --daemon-port) DAEMON_PORT="$2"; shift 2 ;;
      --install-dir) INSTALL_DIR="$2"; shift 2 ;;
      --workdir) WORKDIR="$2"; shift 2 ;;
      --repo-url) REPO_URL="$2"; shift 2 ;;
      --repo-branch) REPO_BRANCH="$2"; shift 2 ;;
      --db-name) DAEMON_DB_NAME="$2"; shift 2 ;;
      --db-user) DAEMON_DB_USER="$2"; shift 2 ;;
      --db-password) DAEMON_DB_PASSWORD="$2"; shift 2 ;;
      --enable-cloudflare) ENABLE_CLOUDFLARE=true; shift ;;
      --enable-firewall) ENABLE_FIREWALL=true; shift ;;
      --firewall-provider) FIREWALL_PROVIDER="$2"; shift 2 ;;
      --enable-sftp-openssh) ENABLE_SFTP_OPENSSH=true; shift ;;
      --skip-docker-install) SKIP_DOCKER_INSTALL=true; shift ;;
      --disable-auto-update) AUTO_UPDATE=false; shift ;;
      --non-interactive) NON_INTERACTIVE=true; shift ;;
      --dry-run) DRY_RUN=true; shift ;;
      --help) usage; exit 0 ;;
      *) fail "Unknown argument: $1. Run with --help for usage." ;;
    esac
  done
}

prompt_if_missing() {
  local var_name="$1"
  local prompt="$2"
  local secret="${3:-false}"
  local value="${!var_name}"
  if [[ -n "${value}" ]]; then
    return
  fi
  if [[ "${NON_INTERACTIVE}" == "true" ]]; then
    fail "${var_name} is required in --non-interactive mode."
  fi
  if [[ "${secret}" == "true" ]]; then
    read -r -s -p "${prompt}: " value
    echo
  else
    read -r -p "${prompt}: " value
  fi
  printf -v "${var_name}" '%s' "${value}"
}

random_secret() {
  local length="${1:-32}"
  local secret=""
  secret="$(
    LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c "${length}" || true
  )"
  if [[ "${#secret}" -lt "${length}" ]]; then
    secret="${secret}$(date +%s%N)LeviathanInstallerSecret"
    secret="${secret:0:${length}}"
  fi
  printf "%s" "${secret}"
}

sql_escape() {
  printf "%s" "$1" | sed "s/'/''/g"
}

validate_inputs() {
  prompt_if_missing PANEL_URL "Panel URL"
  prompt_if_missing NODE_ID "Node ID"
  prompt_if_missing BOOTSTRAP_TOKEN "Bootstrap token" true
  [[ "${PANEL_URL}" =~ ^https?:// ]] || fail "--panel-url must start with http:// or https://"
  [[ "${DAEMON_PORT}" =~ ^[0-9]+$ ]] || fail "--daemon-port must be numeric"
  case "${FIREWALL_PROVIDER}" in
    ufw|nftables) ;;
    *) fail "--firewall-provider must be ufw or nftables" ;;
  esac
  [[ "${DAEMON_DB_NAME}" =~ ^[A-Za-z0-9_]+$ ]] || fail "--db-name must contain only letters, numbers, and underscores"
  [[ "${DAEMON_DB_USER}" =~ ^[A-Za-z0-9_]+$ ]] || fail "--db-user must contain only letters, numbers, and underscores"
  if [[ -z "${DAEMON_DB_PASSWORD}" ]]; then
    DAEMON_DB_PASSWORD="$(random_secret 32)"
  fi
  log "Install configuration collected. Continuing with dependency and MariaDB setup..."
}

write_install_marker() {
  local marker_file="${INSTALL_MARKER}"
  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "[dry-run] write ${marker_file}"
    return
  fi
  cat >"${marker_file}" <<EOF
{
  "product": "Leviathan Daemon",
  "installDir": "${INSTALL_DIR}",
  "repoUrl": "${REPO_URL}",
  "repoBranch": "${REPO_BRANCH}",
  "installedAt": "$(date --iso-8601=seconds)"
}
EOF
  chmod 600 "${marker_file}"
}

detect_distro() {
  if [[ -r /etc/os-release ]]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    DISTRO_ID="${ID:-unknown}"
    DISTRO_LIKE="${ID_LIKE:-}"
  fi
}

detect_package_manager() {
  if command -v apt-get >/dev/null 2>&1; then
    PACKAGE_MANAGER="apt"
  elif command -v dnf >/dev/null 2>&1; then
    PACKAGE_MANAGER="dnf"
  elif command -v yum >/dev/null 2>&1; then
    PACKAGE_MANAGER="yum"
  elif command -v pacman >/dev/null 2>&1; then
    PACKAGE_MANAGER="pacman"
  else
    fail "No supported package manager found. Install dependencies manually, then rerun. Expected one of: apt-get, dnf, yum, pacman."
  fi
}

assert_supported_distro() {
  case "${DISTRO_ID}" in
    ubuntu|debian|fedora|rocky|almalinux|centos|arch)
      ;;
    *)
      log "Distro '${DISTRO_ID}' is not in the tested matrix. Continuing with detected package manager '${PACKAGE_MANAGER}' as best-effort."
      ;;
  esac
}

refresh_packages_once() {
  if [[ "${PACKAGE_REFRESHED}" == "true" ]]; then
    return
  fi
  case "${PACKAGE_MANAGER}" in
    apt) run apt-get update -y ;;
    dnf) run dnf makecache -y ;;
    yum) run yum makecache -y ;;
    pacman) run pacman -Sy --noconfirm ;;
  esac
  PACKAGE_REFRESHED=true
}

install_packages() {
  local packages=("$@")
  refresh_packages_once
  case "${PACKAGE_MANAGER}" in
    apt) run apt-get install -y "${packages[@]}" ;;
    dnf) run dnf install -y "${packages[@]}" ;;
    yum) run yum install -y "${packages[@]}" ;;
    pacman) run pacman -S --needed --noconfirm "${packages[@]}" ;;
  esac
}

manual_dependency_error() {
  local dep="$1"
  local command_hint="$2"
  fail "Could not install '${dep}' automatically. Run this command, then rerun installer: ${command_hint}"
}

install_core_dependencies() {
  case "${PACKAGE_MANAGER}" in
    apt)
      install_packages curl bash ca-certificates tar gzip systemd rsync git build-essential gnupg lsb-release
      ;;
    dnf|yum)
      install_packages curl bash ca-certificates tar gzip systemd rsync git gcc-c++ make gnupg2
      ;;
    pacman)
      install_packages curl bash ca-certificates tar gzip systemd rsync git base-devel
      ;;
  esac
}

install_optional_dependencies() {
  if [[ "${ENABLE_CLOUDFLARE}" == "true" ]] && ! command -v cloudflared >/dev/null 2>&1; then
    case "${PACKAGE_MANAGER}" in
      apt)
        run_shell "curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null"
        run_shell "echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' > /etc/apt/sources.list.d/cloudflared.list"
        PACKAGE_REFRESHED=false
        install_packages cloudflared
        ;;
      dnf|yum)
        manual_dependency_error "cloudflared" "Follow https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/ and then rerun this installer."
        ;;
      pacman)
        manual_dependency_error "cloudflared" "Install cloudflared from the AUR or Cloudflare release package, then rerun this installer."
        ;;
    esac
  fi

  if [[ "${ENABLE_FIREWALL}" == "true" ]]; then
    if [[ "${FIREWALL_PROVIDER}" == "ufw" ]] && ! command -v ufw >/dev/null 2>&1; then
      install_packages ufw
    fi
    if [[ "${FIREWALL_PROVIDER}" == "nftables" ]] && ! command -v nft >/dev/null 2>&1; then
      install_packages nftables
    fi
  fi

  if [[ "${ENABLE_SFTP_OPENSSH}" == "true" ]] && ! command -v sshd >/dev/null 2>&1; then
    case "${PACKAGE_MANAGER}" in
      apt|dnf|yum) install_packages openssh-server ;;
      pacman) install_packages openssh ;;
    esac
  fi
}

install_nodejs() {
  local major=0
  if command -v node >/dev/null 2>&1; then
    major="$(node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || echo 0)"
  fi
  if [[ "${major}" -ge 20 ]]; then
    return
  fi

  log "Installing Node.js 20+..."
  case "${PACKAGE_MANAGER}" in
    apt)
      run_shell "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -"
      PACKAGE_REFRESHED=false
      install_packages nodejs
      ;;
    dnf|yum)
      run_shell "curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -"
      install_packages nodejs
      ;;
    pacman)
      install_packages nodejs npm
      ;;
  esac
}

install_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    return
  fi
  if [[ "${DRY_RUN}" == "true" ]]; then
    run npm install -g pnpm
    return
  fi
  if ! command -v npm >/dev/null 2>&1; then
    manual_dependency_error "pnpm" "Install Node.js/npm, then run: npm install -g pnpm"
  fi
  run npm install -g pnpm
}

install_docker() {
  if command -v docker >/dev/null 2>&1; then
    return
  fi
  if [[ "${SKIP_DOCKER_INSTALL}" == "true" ]]; then
    fail "Docker is required but missing. Re-run without --skip-docker-install or install it manually: curl -fsSL https://get.docker.com | sh"
  fi

  log "Installing Docker..."
  case "${PACKAGE_MANAGER}" in
    apt|dnf|yum)
      run_shell "curl -fsSL https://get.docker.com | sh"
      ;;
    pacman)
      install_packages docker
      ;;
  esac
}

enable_docker() {
  if [[ "${DRY_RUN}" != "true" ]]; then
    command -v systemctl >/dev/null 2>&1 || fail "systemd is required. Install systemd/systemctl and rerun the installer."
  fi
  run systemctl enable --now docker
}

install_mariadb() {
  if command -v mysql >/dev/null 2>&1; then
    return
  fi
  log "Installing MariaDB..."
  case "${PACKAGE_MANAGER}" in
    apt)
      install_packages mariadb-server mariadb-client
      ;;
    dnf|yum)
      install_packages mariadb-server mariadb
      ;;
    pacman)
      install_packages mariadb
      ;;
  esac
}

detect_mariadb_service() {
  if systemctl list-unit-files mariadb.service >/dev/null 2>&1; then
    MARIADB_SERVICE="mariadb"
  elif systemctl list-unit-files mysql.service >/dev/null 2>&1; then
    MARIADB_SERVICE="mysql"
  else
    MARIADB_SERVICE="mariadb"
  fi
}

initialize_mariadb_if_needed() {
  if [[ "${PACKAGE_MANAGER}" == "pacman" && "${DRY_RUN}" != "true" && ! -d /var/lib/mysql/mysql ]]; then
    run mariadb-install-db --user=mysql --basedir=/usr --datadir=/var/lib/mysql
  fi
}

enable_mariadb() {
  detect_mariadb_service
  initialize_mariadb_if_needed
  run systemctl enable --now "${MARIADB_SERVICE}.service"
}

create_users() {
  if id leviathan >/dev/null 2>&1; then
    return
  fi
  run useradd --system --home-dir "${DAEMON_BASE_DIR}" --shell /usr/sbin/nologin leviathan
}

create_layout() {
  run mkdir -p "${INSTALL_DIR}" "${DAEMON_BASE_DIR}" "${DAEMON_BASE_DIR}/servers" "${DAEMON_BASE_DIR}/backups"
  run chown -R root:root "${DAEMON_BASE_DIR}"
  run chmod 750 "${DAEMON_BASE_DIR}"
}

is_repo_root() {
  local candidate="$1"
  [[ -d "${candidate}/apps/daemon" && -f "${candidate}/package.json" ]]
}

prepare_source_dir() {
  if is_repo_root "${WORKDIR}"; then
    SOURCE_DIR="${WORKDIR}"
    return
  fi

  TEMP_SOURCE_DIR="/tmp/leviathan-daemon-src-$$"
  log "No local Leviathan checkout detected at ${WORKDIR}. Cloning ${REPO_URL} (${REPO_BRANCH})..."
  run git clone --depth 1 --branch "${REPO_BRANCH}" "${REPO_URL}" "${TEMP_SOURCE_DIR}"
  SOURCE_DIR="${TEMP_SOURCE_DIR}"
}

copy_source_and_build() {
  run mkdir -p "${INSTALL_DIR}"
  run rsync -a --delete \
    --exclude node_modules \
    --exclude dist \
    "${SOURCE_DIR}/" "${INSTALL_DIR}/"
  run_shell "cd '${INSTALL_DIR}' && pnpm install && pnpm build"
}

configure_database() {
  local db_user_escaped db_password_escaped
  db_user_escaped="$(sql_escape "${DAEMON_DB_USER}")"
  db_password_escaped="$(sql_escape "${DAEMON_DB_PASSWORD}")"

  log "Configuring local daemon MariaDB database '${DAEMON_DB_NAME}'..."
  run_shell "mysql -uroot <<SQL
CREATE DATABASE IF NOT EXISTS ${DAEMON_DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${db_user_escaped}'@'localhost' IDENTIFIED BY '${db_password_escaped}';
ALTER USER '${db_user_escaped}'@'localhost' IDENTIFIED BY '${db_password_escaped}';
GRANT ALL PRIVILEGES ON ${DAEMON_DB_NAME}.* TO '${db_user_escaped}'@'localhost';
FLUSH PRIVILEGES;
SQL"
}

write_daemon_env() {
  local env_file="${INSTALL_DIR}/apps/daemon/.env"
  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "[dry-run] write ${env_file}"
    return
  fi
  cat >"${env_file}" <<EOF
DAEMON_HOST=0.0.0.0
DAEMON_PORT=${DAEMON_PORT}
PANEL_URL=${PANEL_URL}
NODE_ID=${NODE_ID}
BOOTSTRAP_TOKEN=${BOOTSTRAP_TOKEN}
DAEMON_TOKEN=
DAEMON_BASE_DIR=${DAEMON_BASE_DIR}
DOCKER_SOCKET_PATH=/var/run/docker.sock
DAEMON_DB_DRIVER=mysql
DAEMON_DB_HOST=127.0.0.1
DAEMON_DB_PORT=3306
DAEMON_DB_NAME=${DAEMON_DB_NAME}
DAEMON_DB_USER=${DAEMON_DB_USER}
DAEMON_DB_PASSWORD=${DAEMON_DB_PASSWORD}
DAEMON_DB_NAMESPACE=leviathan
EOF
  chmod 600 "${env_file}"
}

write_systemd_service() {
  local service_path="/etc/systemd/system/${SERVICE_NAME}.service"
  local update_service_path="/etc/systemd/system/${UPDATE_SERVICE_NAME}.service"
  local update_timer_path="/etc/systemd/system/${UPDATE_TIMER_NAME}.timer"
  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "[dry-run] write ${service_path}"
    if [[ "${AUTO_UPDATE}" == "true" ]]; then
      echo "[dry-run] write ${update_service_path}"
      echo "[dry-run] write ${update_timer_path}"
    fi
    return
  fi
  cat >"${service_path}" <<EOF
[Unit]
Description=Leviathan Daemon
After=network-online.target docker.service ${MARIADB_SERVICE}.service
Wants=network-online.target
Requires=docker.service ${MARIADB_SERVICE}.service

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}/apps/daemon
EnvironmentFile=${INSTALL_DIR}/apps/daemon/.env
ExecStart=$(command -v node) ${INSTALL_DIR}/apps/daemon/dist/index.js
Restart=always
RestartSec=5
User=root
LimitNOFILE=1048576

[Install]
WantedBy=multi-user.target
EOF

  if [[ "${AUTO_UPDATE}" == "true" ]]; then
    cat >"${update_service_path}" <<EOF
[Unit]
Description=Leviathan Daemon Automatic Update
After=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/bin/env bash ${INSTALL_DIR}/installers/daemon/update.sh
User=root
EOF

    cat >"${update_timer_path}" <<EOF
[Unit]
Description=Daily Leviathan Daemon Update Check

[Timer]
OnCalendar=daily
RandomizedDelaySec=30m
Persistent=true
Unit=${UPDATE_SERVICE_NAME}.service

[Install]
WantedBy=timers.target
EOF
  fi
}

validate_panel_reachable() {
  log "Validating panel reachability..."
  local attempt=1
  while [[ "${attempt}" -le 30 ]]; do
    if run_shell "curl -fsS --max-time 5 '${PANEL_URL%/}/health' >/dev/null"; then
      return 0
    fi
    log "Panel not ready yet (attempt ${attempt}/30); waiting 2s..."
    sleep 2
    attempt=$((attempt + 1))
  done

  fail "Panel health check did not pass. See: journalctl -u ${SERVICE_NAME}.service -n 100 --no-pager"
}

validate_mariadb() {
  log "Validating MariaDB..."
  run_shell "mysql -uroot -e 'SELECT 1;' >/dev/null"
}

validate_docker() {
  log "Validating Docker..."
  run_shell "docker info >/dev/null"
}

validate_service() {
  log "Validating daemon service startup..."
  run systemctl is-active --quiet "${SERVICE_NAME}.service"
}

start_service() {
  run systemctl daemon-reload
  run systemctl enable --now "${SERVICE_NAME}.service"
  if [[ "${AUTO_UPDATE}" == "true" ]]; then
    run systemctl enable --now "${UPDATE_TIMER_NAME}.timer"
  fi
}

print_troubleshooting() {
  echo
  echo "Troubleshooting commands:"
  echo "  Daemon logs:   journalctl -u ${SERVICE_NAME}.service -n 100 --no-pager"
  echo "  MariaDB logs:  journalctl -u ${MARIADB_SERVICE}.service -n 100 --no-pager"
  echo "  Docker:        systemctl status docker --no-pager"
}

print_success() {
  echo
  log "Installed successfully."
  echo "Daemon status: systemctl status ${SERVICE_NAME}.service --no-pager"
  echo "Node ID: ${NODE_ID}"
  echo "Panel URL: ${PANEL_URL}"
  echo "MariaDB: systemctl status ${MARIADB_SERVICE}.service --no-pager"
  echo "Service name: ${SERVICE_NAME}.service"
  echo
  echo "One-line installer:"
  echo "  bash <(curl -fsSL https://raw.githubusercontent.com/REALJasonAU/Leviathan-Panel/refs/heads/${REPO_BRANCH}/installers/daemon/install.sh) --panel-url ${PANEL_URL} --node-id ${NODE_ID} --bootstrap-token <bootstrap-token>"
  echo
  echo "Useful commands:"
  echo "  Logs:        journalctl -u ${SERVICE_NAME}.service -f"
  echo "  Restart:     systemctl restart ${SERVICE_NAME}.service"
  echo "  Update:      bash ${INSTALL_DIR}/installers/daemon/update.sh"
  echo "  Uninstall:   bash ${INSTALL_DIR}/installers/daemon/uninstall.sh"
  if [[ "${AUTO_UPDATE}" == "true" ]]; then
    echo "  Update timer: systemctl status ${UPDATE_TIMER_NAME}.timer --no-pager"
  fi
}

main() {
  trap 'print_troubleshooting' ERR
  trap 'cleanup_temp_source' EXIT
  parse_args "$@"
  need_root
  if [[ "${DRY_RUN}" != "true" && is_already_installed ]]; then
    fail "Leviathan daemon is already installed at ${INSTALL_DIR}. Run update.sh or uninstall.sh instead."
  fi
  validate_inputs
  detect_distro
  detect_package_manager
  assert_supported_distro
  log "Detected distro=${DISTRO_ID} like='${DISTRO_LIKE}' package_manager=${PACKAGE_MANAGER}"
  install_core_dependencies
  install_nodejs
  install_pnpm
  install_docker
  enable_docker
  install_mariadb
  enable_mariadb
  validate_mariadb
  install_optional_dependencies
  create_users
  create_layout
  prepare_source_dir
  copy_source_and_build
  configure_database
  write_daemon_env
  log "Writing systemd service..."
  write_systemd_service
  log "Checking panel reachability..."
  validate_panel_reachable
  log "Starting daemon service and update timer..."
  start_service
  log "Validating Docker..."
  validate_docker
  log "Waiting for daemon service startup..."
  validate_service
  write_install_marker
  print_success
}

main "$@"
