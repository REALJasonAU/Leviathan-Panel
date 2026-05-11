#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${SERVICE_NAME:-leviathan-daemon}"
INSTALL_DIR="${INSTALL_DIR:-/opt/leviathan}"
WORKDIR="${WORKDIR:-$(pwd)}"
PANEL_URL="${PANEL_URL:-}"
NODE_ID="${NODE_ID:-}"
BOOTSTRAP_TOKEN="${BOOTSTRAP_TOKEN:-}"
DAEMON_BASE_DIR="${DAEMON_BASE_DIR:-/var/lib/leviathan}"
DAEMON_PORT="${DAEMON_PORT:-4100}"
DRY_RUN=false
SKIP_DOCKER_INSTALL=false
NON_INTERACTIVE=false
ENABLE_CLOUDFLARE=false
ENABLE_FIREWALL=false
ENABLE_SFTP_OPENSSH=false
FIREWALL_PROVIDER="${FIREWALL_PROVIDER:-ufw}"
DISTRO_ID="unknown"
DISTRO_LIKE=""
PACKAGE_MANAGER=""
PACKAGE_REFRESHED=false

usage() {
  cat <<EOF
Leviathan daemon installer

Usage:
  sudo bash install.sh --panel-url https://panel.example.com --node-id node_123 --bootstrap-token nd_bootstrap_xxx [options]

Required unless prompted interactively:
  --panel-url URL             Public URL of the Leviathan panel/API
  --node-id ID                Node ID from the panel
  --bootstrap-token TOKEN     One-time daemon bootstrap token from the panel

Options:
  --base-dir PATH             Daemon server data directory (default: /var/lib/leviathan)
  --daemon-port PORT          Daemon HTTP port (default: 4100)
  --install-dir PATH          Install directory (default: /opt/leviathan)
  --workdir PATH              Source checkout to copy from (default: current directory)
  --enable-cloudflare         Install/check cloudflared
  --enable-firewall           Install/check ufw or nftables
  --firewall-provider NAME    ufw or nftables (default: ufw)
  --enable-sftp-openssh       Install/check OpenSSH server for future SFTP mode
  --skip-docker-install       Do not install Docker automatically
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
      --enable-cloudflare) ENABLE_CLOUDFLARE=true; shift ;;
      --enable-firewall) ENABLE_FIREWALL=true; shift ;;
      --firewall-provider) FIREWALL_PROVIDER="$2"; shift 2 ;;
      --enable-sftp-openssh) ENABLE_SFTP_OPENSSH=true; shift ;;
      --skip-docker-install) SKIP_DOCKER_INSTALL=true; shift ;;
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

copy_source_and_build() {
  [[ -d "${WORKDIR}/apps/daemon" ]] || fail "--workdir must point to the Leviathan monorepo root. Missing apps/daemon under ${WORKDIR}."
  run rsync -a --delete \
    --exclude node_modules \
    --exclude dist \
    --exclude .git \
    "${WORKDIR}/" "${INSTALL_DIR}/"
  run_shell "cd '${INSTALL_DIR}' && pnpm install && pnpm build"
}

write_daemon_env() {
  local env_file="${INSTALL_DIR}/apps/daemon/.env"
  run cp "${INSTALL_DIR}/apps/daemon/.env.example" "${env_file}"
  run_shell "sed -i 's|^PANEL_URL=.*|PANEL_URL=${PANEL_URL}|' '${env_file}'"
  run_shell "sed -i 's|^NODE_ID=.*|NODE_ID=${NODE_ID}|' '${env_file}'"
  run_shell "sed -i 's|^BOOTSTRAP_TOKEN=.*|BOOTSTRAP_TOKEN=${BOOTSTRAP_TOKEN}|' '${env_file}'"
  run_shell "sed -i 's|^DAEMON_BASE_DIR=.*|DAEMON_BASE_DIR=${DAEMON_BASE_DIR}|' '${env_file}'"
  run_shell "sed -i 's|^DAEMON_PORT=.*|DAEMON_PORT=${DAEMON_PORT}|' '${env_file}'"
  run chmod 600 "${env_file}"
}

write_systemd_service() {
  local service_path="/etc/systemd/system/${SERVICE_NAME}.service"
  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "[dry-run] write ${service_path}"
    return
  fi
  cat >"${service_path}" <<EOF
[Unit]
Description=Leviathan Daemon
After=network-online.target docker.service
Wants=network-online.target
Requires=docker.service

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
}

validate_panel_reachable() {
  log "Validating panel reachability..."
  run_shell "curl -fsS --max-time 10 '${PANEL_URL%/}/health' >/dev/null"
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
}

print_success() {
  echo
  log "Installed successfully."
  echo "Daemon status: systemctl status ${SERVICE_NAME}.service --no-pager"
  echo "Node ID: ${NODE_ID}"
  echo "Panel URL: ${PANEL_URL}"
  echo "Service name: ${SERVICE_NAME}.service"
  echo
  echo "Useful commands:"
  echo "  Logs:      journalctl -u ${SERVICE_NAME}.service -f"
  echo "  Restart:   systemctl restart ${SERVICE_NAME}.service"
  echo "  Update:    bash ${INSTALL_DIR}/installers/daemon/update.sh"
  echo "  Uninstall: bash ${INSTALL_DIR}/installers/daemon/uninstall.sh"
}

main() {
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
  install_optional_dependencies
  create_users
  create_layout
  copy_source_and_build
  write_daemon_env
  write_systemd_service
  start_service
  validate_panel_reachable
  validate_docker
  validate_service
  print_success
}

main "$@"
