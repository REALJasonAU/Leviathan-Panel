#!/usr/bin/env bash
set -euo pipefail

API_SERVICE_NAME="${API_SERVICE_NAME:-leviathan-api}"
PANEL_SERVICE_NAME="${PANEL_SERVICE_NAME:-leviathan-panel}"
INSTALL_DIR="${INSTALL_DIR:-/opt/leviathan}"
WORKDIR="${WORKDIR:-$(pwd)}"
API_PORT="${API_PORT:-4000}"
PANEL_PORT="${PANEL_PORT:-4173}"
PANEL_ORIGIN="${PANEL_ORIGIN:-http://localhost:${PANEL_PORT}}"
API_BASE_URL="${API_BASE_URL:-${PANEL_ORIGIN%/}}"
SKIP_DOCKER_INSTALL=false
NON_INTERACTIVE=false
DRY_RUN=false
DISTRO_ID="unknown"
DISTRO_LIKE=""
PACKAGE_MANAGER=""
PACKAGE_REFRESHED=false

usage() {
  cat <<EOF
Leviathan panel installer

Usage:
  sudo bash install.sh [options]

Options:
  --install-dir PATH         Install directory (default: /opt/leviathan)
  --workdir PATH             Source checkout to copy from (default: current directory)
  --api-port PORT            API listen port (default: 4000)
  --panel-port PORT          Panel listen port (default: 4173)
  --panel-origin URL         Public panel origin used for API CORS (default: http://localhost:4173)
  --api-base-url URL         Public API base URL baked into panel assets (default: same as --panel-origin)
  --skip-docker-install      Do not install Docker automatically
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
      --api-port) API_PORT="$2"; shift 2 ;;
      --panel-port) PANEL_PORT="$2"; shift 2 ;;
      --panel-origin) PANEL_ORIGIN="$2"; shift 2 ;;
      --api-base-url) API_BASE_URL="$2"; shift 2 ;;
      --skip-docker-install) SKIP_DOCKER_INSTALL=true; shift ;;
      --non-interactive) NON_INTERACTIVE=true; shift ;;
      --dry-run) DRY_RUN=true; shift ;;
      --help) usage; exit 0 ;;
      *) fail "Unknown argument: $1. Run with --help for usage." ;;
    esac
  done
}

validate_inputs() {
  [[ "${API_PORT}" =~ ^[0-9]+$ ]] || fail "--api-port must be numeric"
  [[ "${PANEL_PORT}" =~ ^[0-9]+$ ]] || fail "--panel-port must be numeric"
  [[ "${PANEL_ORIGIN}" =~ ^https?:// ]] || fail "--panel-origin must start with http:// or https://"
  [[ "${API_BASE_URL}" =~ ^https?:// ]] || fail "--api-base-url must start with http:// or https://"
  [[ -d "${WORKDIR}/apps/api" && -d "${WORKDIR}/apps/panel" ]] || fail "--workdir must point to the Leviathan monorepo root. Missing apps/api or apps/panel under ${WORKDIR}."
  if [[ "${NON_INTERACTIVE}" == "true" ]]; then
    return
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
      install_packages curl bash ca-certificates tar gzip systemd rsync git build-essential gnupg
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

create_users() {
  if id leviathan >/dev/null 2>&1; then
    return
  fi
  run useradd --system --home-dir "${INSTALL_DIR}" --shell /usr/sbin/nologin leviathan
}

create_layout() {
  run mkdir -p "${INSTALL_DIR}"
}

copy_source_and_build() {
  run rsync -a --delete \
    --exclude node_modules \
    --exclude dist \
    --exclude .git \
    "${WORKDIR}/" "${INSTALL_DIR}/"
  run_shell "cd '${INSTALL_DIR}' && pnpm install && pnpm build"
}

write_api_env() {
  local env_file="${INSTALL_DIR}/apps/api/.env"
  run cp "${INSTALL_DIR}/apps/api/.env.example" "${env_file}"
  run_shell "sed -i 's|^PORT=.*|PORT=${API_PORT}|' '${env_file}'"
  run_shell "sed -i 's|^HOST=.*|HOST=0.0.0.0|' '${env_file}'"
  run_shell "sed -i 's|^PANEL_ORIGIN=.*|PANEL_ORIGIN=${PANEL_ORIGIN}|' '${env_file}'"
  run chmod 600 "${env_file}"
}

write_panel_env() {
  local env_file="${INSTALL_DIR}/apps/panel/.env"
  run cp "${INSTALL_DIR}/apps/panel/.env.example" "${env_file}"
  run_shell "sed -i 's|^VITE_API_BASE_URL=.*|VITE_API_BASE_URL=${API_BASE_URL}|' '${env_file}'"
  run chmod 644 "${env_file}"
}

write_systemd_services() {
  local api_service_path="/etc/systemd/system/${API_SERVICE_NAME}.service"
  local panel_service_path="/etc/systemd/system/${PANEL_SERVICE_NAME}.service"

  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "[dry-run] write ${api_service_path}"
    echo "[dry-run] write ${panel_service_path}"
    return
  fi

  cat >"${api_service_path}" <<EOF
[Unit]
Description=Leviathan API
After=network-online.target docker.service
Wants=network-online.target
Requires=docker.service

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
}

start_services() {
  run systemctl daemon-reload
  run systemctl enable --now "${API_SERVICE_NAME}.service"
  run systemctl enable --now "${PANEL_SERVICE_NAME}.service"
}

validate_api_service() {
  log "Validating API service startup..."
  run systemctl is-active --quiet "${API_SERVICE_NAME}.service"
  run_shell "curl -fsS --max-time 10 'http://127.0.0.1:${API_PORT}/health' >/dev/null"
}

validate_panel_service() {
  log "Validating panel service startup..."
  run systemctl is-active --quiet "${PANEL_SERVICE_NAME}.service"
  run_shell "curl -fsS --max-time 10 'http://127.0.0.1:${PANEL_PORT}' >/dev/null"
}

validate_docker() {
  log "Validating Docker..."
  run_shell "docker info >/dev/null"
}

print_troubleshooting() {
  echo
  echo "Troubleshooting commands:"
  echo "  API logs:    journalctl -u ${API_SERVICE_NAME}.service -n 100 --no-pager"
  echo "  Panel logs:  journalctl -u ${PANEL_SERVICE_NAME}.service -n 100 --no-pager"
  echo "  Docker:      systemctl status docker --no-pager"
}

print_success() {
  echo
  log "Installed successfully."
  echo "API status: systemctl status ${API_SERVICE_NAME}.service --no-pager"
  echo "Panel status: systemctl status ${PANEL_SERVICE_NAME}.service --no-pager"
  echo "Panel origin: ${PANEL_ORIGIN}"
  echo "API base URL: ${API_BASE_URL}"
  echo "Install directory: ${INSTALL_DIR}"
  echo
  echo "Useful commands:"
  echo "  API logs:     journalctl -u ${API_SERVICE_NAME}.service -f"
  echo "  Panel logs:   journalctl -u ${PANEL_SERVICE_NAME}.service -f"
  echo "  Restart API:  systemctl restart ${API_SERVICE_NAME}.service"
  echo "  Restart panel: systemctl restart ${PANEL_SERVICE_NAME}.service"
  echo "  Update:       bash ${INSTALL_DIR}/installers/panel/update.sh"
  echo "  Uninstall:    bash ${INSTALL_DIR}/installers/panel/uninstall.sh"
}

main() {
  trap 'print_troubleshooting' ERR
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
  create_users
  create_layout
  copy_source_and_build
  write_api_env
  write_panel_env
  write_systemd_services
  start_services
  validate_api_service
  validate_panel_service
  validate_docker
  print_success
}

main "$@"
