#!/usr/bin/env bash
set -euo pipefail

API_SERVICE_NAME="${API_SERVICE_NAME:-leviathan-api}"
PANEL_SERVICE_NAME="${PANEL_SERVICE_NAME:-leviathan-panel}"
UPDATE_SERVICE_NAME="${UPDATE_SERVICE_NAME:-leviathan-panel-update}"
UPDATE_TIMER_NAME="${UPDATE_TIMER_NAME:-leviathan-panel-update}"
INSTALL_DIR="${INSTALL_DIR:-/opt/leviathan}"
WORKDIR="${WORKDIR:-$(pwd)}"
SOURCE_DIR=""
TEMP_SOURCE_DIR=""
REPO_URL="${REPO_URL:-https://github.com/REALJasonAU/Leviathan-Panel.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"
API_PORT="${API_PORT:-4000}"
PANEL_PORT="${PANEL_PORT:-4173}"
PANEL_ORIGIN="${PANEL_ORIGIN:-http://localhost:${PANEL_PORT}}"
API_BASE_URL="${API_BASE_URL:-${PANEL_ORIGIN%/}}"
DB_NAME="${DB_NAME:-leviathan_panel}"
DB_USER="${DB_USER:-leviathan_panel}"
DB_PASSWORD="${DB_PASSWORD:-}"
SESSION_COOKIE_NAME="${SESSION_COOKIE_NAME:-leviathan_session}"
SESSION_TTL_HOURS="${SESSION_TTL_HOURS:-168}"
ADMIN_USERNAME="${ADMIN_USERNAME:-}"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
SKIP_DOCKER_INSTALL=false
NON_INTERACTIVE=false
DRY_RUN=false
AUTO_UPDATE=true
DISTRO_ID="unknown"
DISTRO_LIKE=""
PACKAGE_MANAGER=""
PACKAGE_REFRESHED=false
MARIADB_SERVICE="mariadb"

usage() {
  cat <<EOF
Leviathan panel installer

Usage:
  sudo bash install.sh [options]
  bash <(curl -fsSL https://raw.githubusercontent.com/REALJasonAU/Leviathan-Panel/main/installers/panel/install.sh) [options]

Options:
  --install-dir PATH         Install directory (default: /opt/leviathan)
  --workdir PATH             Source checkout to copy from. If omitted or invalid, the installer clones from GitHub.
  --repo-url URL             Leviathan Git repository (default: ${REPO_URL})
  --repo-branch NAME         Git branch/tag to install (default: ${REPO_BRANCH})
  --api-port PORT            API listen port (default: 4000)
  --panel-port PORT          Panel listen port (default: 4173)
  --panel-origin URL         Public panel origin used for cookies/CORS
  --api-base-url URL         Public API base URL baked into panel assets
  --db-name NAME             Local MariaDB database name (default: leviathan_panel)
  --db-user USER             Local MariaDB user (default: leviathan_panel)
  --db-password PASS         Local MariaDB password (default: generated)
  --admin-username NAME      First Leviathan admin username
  --admin-email EMAIL        First Leviathan admin email
  --admin-password PASS      First Leviathan admin password
  --session-cookie-name NAME Session cookie name (default: leviathan_session)
  --session-ttl-hours HOURS  Session lifetime (default: 168)
  --skip-docker-install      Do not install Docker automatically
  --disable-auto-update      Do not install the daily update timer
  --non-interactive          Fail instead of prompting for missing values
  --dry-run                  Print actions without changing the system
  --help                     Show this help

Supported distro handling:
  Ubuntu/Debian: tested path using apt
  Fedora/Rocky/AlmaLinux/CentOS Stream: best-effort path using dnf/yum
  Arch Linux: best-effort path using pacman
EOF
}

log() {
  echo "[leviathan-panel] $*"
}

fail() {
  echo "[leviathan-panel] ERROR: $*" >&2
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

need_root() {
  if [[ "${DRY_RUN}" == "true" ]]; then
    return
  fi
  if [[ "${EUID}" -ne 0 ]]; then
    fail "Please run as root: sudo bash installers/panel/install.sh ..."
  fi
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --install-dir) INSTALL_DIR="$2"; shift 2 ;;
      --workdir) WORKDIR="$2"; shift 2 ;;
      --repo-url) REPO_URL="$2"; shift 2 ;;
      --repo-branch) REPO_BRANCH="$2"; shift 2 ;;
      --api-port) API_PORT="$2"; shift 2 ;;
      --panel-port) PANEL_PORT="$2"; shift 2 ;;
      --panel-origin) PANEL_ORIGIN="$2"; shift 2 ;;
      --api-base-url) API_BASE_URL="$2"; shift 2 ;;
      --db-name) DB_NAME="$2"; shift 2 ;;
      --db-user) DB_USER="$2"; shift 2 ;;
      --db-password) DB_PASSWORD="$2"; shift 2 ;;
      --admin-username) ADMIN_USERNAME="$2"; shift 2 ;;
      --admin-email) ADMIN_EMAIL="$2"; shift 2 ;;
      --admin-password) ADMIN_PASSWORD="$2"; shift 2 ;;
      --session-cookie-name) SESSION_COOKIE_NAME="$2"; shift 2 ;;
      --session-ttl-hours) SESSION_TTL_HOURS="$2"; shift 2 ;;
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
  local confirm="${4:-false}"
  local value="${!var_name}"
  local confirm_value=""
  if [[ -n "${value}" ]]; then
    return
  fi
  if [[ "${NON_INTERACTIVE}" == "true" ]]; then
    fail "${var_name} is required in --non-interactive mode."
  fi
  while true; do
    if [[ "${secret}" == "true" ]]; then
      read -r -s -p "${prompt}: " value
      echo
    else
      read -r -p "${prompt}: " value
    fi
    if [[ -z "${value}" ]]; then
      echo "Value cannot be empty."
      continue
    fi
    if [[ "${confirm}" == "true" ]]; then
      read -r -s -p "Confirm ${prompt}: " confirm_value
      echo
      [[ "${value}" == "${confirm_value}" ]] || {
        echo "Values did not match. Try again."
        continue
      }
    fi
    printf -v "${var_name}" '%s' "${value}"
    return
  done
}

random_secret() {
  local length="${1:-32}"
  LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c "${length}"
}

sql_escape() {
  printf "%s" "$1" | sed "s/'/''/g"
}

shell_quote() {
  printf "%q" "$1"
}

validate_inputs() {
  prompt_if_missing PANEL_ORIGIN "Panel origin URL"
  prompt_if_missing API_BASE_URL "Public API base URL"
  prompt_if_missing ADMIN_USERNAME "First admin username"
  prompt_if_missing ADMIN_EMAIL "First admin email"
  prompt_if_missing ADMIN_PASSWORD "First admin password" true true
  [[ "${API_PORT}" =~ ^[0-9]+$ ]] || fail "--api-port must be numeric"
  [[ "${PANEL_PORT}" =~ ^[0-9]+$ ]] || fail "--panel-port must be numeric"
  [[ "${SESSION_TTL_HOURS}" =~ ^[0-9]+$ ]] || fail "--session-ttl-hours must be numeric"
  [[ "${PANEL_ORIGIN}" =~ ^https?:// ]] || fail "--panel-origin must start with http:// or https://"
  [[ "${API_BASE_URL}" =~ ^https?:// ]] || fail "--api-base-url must start with http:// or https://"
  [[ "${ADMIN_EMAIL}" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || fail "--admin-email must be a valid email address"
  if [[ -z "${DB_PASSWORD}" ]]; then
    DB_PASSWORD="$(random_secret 32)"
  fi
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
  run useradd --system --home-dir "${INSTALL_DIR}" --shell /usr/sbin/nologin leviathan
}

create_layout() {
  run mkdir -p "${INSTALL_DIR}"
}

is_repo_root() {
  local candidate="$1"
  [[ -d "${candidate}/apps/api" && -d "${candidate}/apps/panel" && -f "${candidate}/package.json" ]]
}

prepare_source_dir() {
  if is_repo_root "${WORKDIR}"; then
    SOURCE_DIR="${WORKDIR}"
    return
  fi

  TEMP_SOURCE_DIR="/tmp/leviathan-panel-src-$$"
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
  local db_name_escaped db_user_escaped db_password_escaped
  db_name_escaped="$(sql_escape "${DB_NAME}")"
  db_user_escaped="$(sql_escape "${DB_USER}")"
  db_password_escaped="$(sql_escape "${DB_PASSWORD}")"

  log "Configuring local MariaDB database '${DB_NAME}'..."
  run_shell "mysql -uroot <<SQL
CREATE DATABASE IF NOT EXISTS \`${db_name_escaped}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${db_user_escaped}'@'localhost' IDENTIFIED BY '${db_password_escaped}';
ALTER USER '${db_user_escaped}'@'localhost' IDENTIFIED BY '${db_password_escaped}';
GRANT ALL PRIVILEGES ON \`${db_name_escaped}\`.* TO '${db_user_escaped}'@'localhost';
FLUSH PRIVILEGES;
SQL"
}

write_api_env() {
  local env_file="${INSTALL_DIR}/apps/api/.env"
  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "[dry-run] write ${env_file}"
    return
  fi
  cat >"${env_file}" <<EOF
PORT=${API_PORT}
HOST=0.0.0.0
PANEL_ORIGIN=${PANEL_ORIGIN}
PANEL_EXTRA_ORIGINS=
MOCK_AUTH=false
MOCK_DATA=false
DB_DRIVER=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_NAMESPACE=leviathan
SESSION_COOKIE_NAME=${SESSION_COOKIE_NAME}
SESSION_TTL_HOURS=${SESSION_TTL_HOURS}
QUEUE_DRIVER=local
REDIS_URL=
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=1 minute
FILE_UPLOAD_LIMIT_MB=256
EOF
  chmod 600 "${env_file}"
}

write_panel_env() {
  local env_file="${INSTALL_DIR}/apps/panel/.env"
  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "[dry-run] write ${env_file}"
    return
  fi
  cat >"${env_file}" <<EOF
VITE_API_BASE_URL=${API_BASE_URL}
VITE_USE_MOCK_AUTH=false
EOF
  chmod 644 "${env_file}"
}

seed_admin_user() {
  local admin_username_q admin_email_q admin_password_q
  admin_username_q="$(shell_quote "${ADMIN_USERNAME}")"
  admin_email_q="$(shell_quote "${ADMIN_EMAIL}")"
  admin_password_q="$(shell_quote "${ADMIN_PASSWORD}")"
  log "Seeding first Leviathan admin user..."
  run_shell "cd '${INSTALL_DIR}' && ADMIN_USERNAME=${admin_username_q} ADMIN_EMAIL=${admin_email_q} ADMIN_PASSWORD=${admin_password_q} pnpm --filter @voltan/api seed"
}

write_systemd_services() {
  local api_service_path="/etc/systemd/system/${API_SERVICE_NAME}.service"
  local panel_service_path="/etc/systemd/system/${PANEL_SERVICE_NAME}.service"
  local update_service_path="/etc/systemd/system/${UPDATE_SERVICE_NAME}.service"
  local update_timer_path="/etc/systemd/system/${UPDATE_TIMER_NAME}.timer"

  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "[dry-run] write ${api_service_path}"
    echo "[dry-run] write ${panel_service_path}"
    if [[ "${AUTO_UPDATE}" == "true" ]]; then
      echo "[dry-run] write ${update_service_path}"
      echo "[dry-run] write ${update_timer_path}"
    fi
    return
  fi

  cat >"${api_service_path}" <<EOF
[Unit]
Description=Leviathan API
After=network-online.target docker.service ${MARIADB_SERVICE}.service
Wants=network-online.target
Requires=docker.service ${MARIADB_SERVICE}.service

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}/apps/api
EnvironmentFile=${INSTALL_DIR}/apps/api/.env
ExecStart=$(command -v node) ${INSTALL_DIR}/apps/api/dist/index.js
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
EOF

  cat >"${panel_service_path}" <<EOF
[Unit]
Description=Leviathan Panel
After=network-online.target ${API_SERVICE_NAME}.service
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}/apps/panel
EnvironmentFile=${INSTALL_DIR}/apps/panel/.env
ExecStart=$(command -v pnpm) --dir ${INSTALL_DIR}/apps/panel exec vite preview --host 0.0.0.0 --port ${PANEL_PORT}
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
EOF

  if [[ "${AUTO_UPDATE}" == "true" ]]; then
    cat >"${update_service_path}" <<EOF
[Unit]
Description=Leviathan Panel Automatic Update
After=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/bin/env bash ${INSTALL_DIR}/installers/panel/update.sh
User=root
EOF

    cat >"${update_timer_path}" <<EOF
[Unit]
Description=Daily Leviathan Panel Update Check

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

start_services() {
  run systemctl daemon-reload
  run systemctl enable --now "${API_SERVICE_NAME}.service"
  run systemctl enable --now "${PANEL_SERVICE_NAME}.service"
  if [[ "${AUTO_UPDATE}" == "true" ]]; then
    run systemctl enable --now "${UPDATE_TIMER_NAME}.timer"
  fi
}

validate_mariadb() {
  log "Validating MariaDB..."
  run_shell "mysql -uroot -e 'SELECT 1;' >/dev/null"
}

validate_api_service() {
  log "Validating API service startup..."
  run systemctl is-active --quiet "${API_SERVICE_NAME}.service"
  run_shell "curl -fsS --retry 5 --retry-delay 2 --max-time 10 'http://127.0.0.1:${API_PORT}/health' >/dev/null"
}

validate_panel_service() {
  log "Validating panel service startup..."
  run systemctl is-active --quiet "${PANEL_SERVICE_NAME}.service"
  run_shell "curl -fsS --retry 5 --retry-delay 2 --max-time 10 'http://127.0.0.1:${PANEL_PORT}' >/dev/null"
}

validate_docker() {
  log "Validating Docker..."
  run_shell "docker info >/dev/null"
}

print_troubleshooting() {
  echo
  echo "Troubleshooting commands:"
  echo "  API logs:      journalctl -u ${API_SERVICE_NAME}.service -n 100 --no-pager"
  echo "  Panel logs:    journalctl -u ${PANEL_SERVICE_NAME}.service -n 100 --no-pager"
  echo "  MariaDB logs:  journalctl -u ${MARIADB_SERVICE}.service -n 100 --no-pager"
  echo "  Docker:        systemctl status docker --no-pager"
}

print_success() {
  echo
  log "Installed successfully."
  echo "API status: systemctl status ${API_SERVICE_NAME}.service --no-pager"
  echo "Panel status: systemctl status ${PANEL_SERVICE_NAME}.service --no-pager"
  echo "MariaDB: systemctl status ${MARIADB_SERVICE}.service --no-pager"
  echo "Panel origin: ${PANEL_ORIGIN}"
  echo "API base URL: ${API_BASE_URL}"
  echo "Admin login: ${ADMIN_EMAIL}"
  echo "Install directory: ${INSTALL_DIR}"
  echo
  echo "One-line installer:"
  echo "  bash <(curl -fsSL https://raw.githubusercontent.com/REALJasonAU/Leviathan-Panel/${REPO_BRANCH}/installers/panel/install.sh) --panel-origin ${PANEL_ORIGIN} --api-base-url ${API_BASE_URL}"
  echo
  echo "Useful commands:"
  echo "  API logs:       journalctl -u ${API_SERVICE_NAME}.service -f"
  echo "  Panel logs:     journalctl -u ${PANEL_SERVICE_NAME}.service -f"
  echo "  Restart API:    systemctl restart ${API_SERVICE_NAME}.service"
  echo "  Restart panel:  systemctl restart ${PANEL_SERVICE_NAME}.service"
  echo "  Update:         bash ${INSTALL_DIR}/installers/panel/update.sh"
  echo "  Uninstall:      bash ${INSTALL_DIR}/installers/panel/uninstall.sh"
  if [[ "${AUTO_UPDATE}" == "true" ]]; then
    echo "  Update timer:   systemctl status ${UPDATE_TIMER_NAME}.timer --no-pager"
  fi
}

main() {
  trap 'print_troubleshooting' ERR
  trap 'cleanup_temp_source' EXIT
  parse_args "$@"
  validate_inputs
  need_root
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
  create_users
  create_layout
  prepare_source_dir
  copy_source_and_build
  configure_database
  write_api_env
  write_panel_env
  seed_admin_user
  write_systemd_services
  start_services
  validate_api_service
  validate_panel_service
  validate_docker
  print_success
}

main "$@"
