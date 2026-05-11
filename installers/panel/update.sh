#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/leviathan}"
API_SERVICE_NAME="${API_SERVICE_NAME:-leviathan-api}"
PANEL_SERVICE_NAME="${PANEL_SERVICE_NAME:-leviathan-panel}"
DRY_RUN=false

usage() {
  cat <<EOF
Leviathan panel updater

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
  echo "Please run as root: sudo bash installers/panel/update.sh" >&2
  exit 1
fi

[[ "${DRY_RUN}" == "true" || -d "${INSTALL_DIR}" ]] || {
  echo "Install directory not found: ${INSTALL_DIR}" >&2
  exit 1
}

run_shell "cd '${INSTALL_DIR}' && pnpm install && pnpm build"
run systemctl restart "${API_SERVICE_NAME}.service"
run systemctl restart "${PANEL_SERVICE_NAME}.service"
run systemctl is-active --quiet "${API_SERVICE_NAME}.service"
run systemctl is-active --quiet "${PANEL_SERVICE_NAME}.service"

echo "[leviathan-panel] Updated ${API_SERVICE_NAME}.service and ${PANEL_SERVICE_NAME}.service."
