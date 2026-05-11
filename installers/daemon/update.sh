#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/leviathan}"
SERVICE_NAME="${SERVICE_NAME:-leviathan-daemon}"
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

run_shell "cd '${INSTALL_DIR}' && pnpm install && pnpm build"
run systemctl restart "${SERVICE_NAME}.service"
run systemctl is-active --quiet "${SERVICE_NAME}.service"

echo "[leviathan-daemon] Updated ${SERVICE_NAME}.service."
