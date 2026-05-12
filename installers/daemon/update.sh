#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/leviathan}"
SERVICE_NAME="${SERVICE_NAME:-leviathan-daemon}"
UPDATE_TIMER_NAME="${UPDATE_TIMER_NAME:-leviathan-daemon-update}"
DRY_RUN=false

usage() {
  cat <<EOF
Leviathan daemon updater

Usage:
  sudo bash update.sh [options]

Options:
  --install-dir PATH   Install directory (default: /opt/leviathan)
  --dry-run            Print actions without changing the system
  --help               Show this help
EOF
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

log() {
  echo "[leviathan-daemon] $*"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-dir) INSTALL_DIR="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    --help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ "${DRY_RUN}" != "true" && "${EUID}" -ne 0 ]]; then
  echo "Please run as root: sudo bash installers/daemon/update.sh" >&2
  exit 1
fi

[[ "${DRY_RUN}" == "true" || -d "${INSTALL_DIR}" ]] || {
  echo "Install directory not found: ${INSTALL_DIR}" >&2
  exit 1
}

if [[ -d "${INSTALL_DIR}/.git" ]]; then
  log "Refreshing git checkout in ${INSTALL_DIR}..."
  run_shell "cd '${INSTALL_DIR}' && git fetch --all --prune && git pull --ff-only"
else
  log "No git metadata found under ${INSTALL_DIR}; reusing existing source tree."
fi

run_shell "cd '${INSTALL_DIR}' && pnpm install && pnpm build"
run systemctl restart "${SERVICE_NAME}.service"
run systemctl is-active --quiet "${SERVICE_NAME}.service"
if systemctl list-unit-files "${UPDATE_TIMER_NAME}.timer" >/dev/null 2>&1; then
  run systemctl is-enabled --quiet "${UPDATE_TIMER_NAME}.timer"
fi

echo "[leviathan-daemon] Updated ${SERVICE_NAME}.service."
