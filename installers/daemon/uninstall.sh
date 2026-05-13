#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/leviathan}"
SERVICE_NAME="${SERVICE_NAME:-leviathan-daemon}"
UPDATE_SERVICE_NAME="${UPDATE_SERVICE_NAME:-leviathan-daemon-update}"
UPDATE_TIMER_NAME="${UPDATE_TIMER_NAME:-leviathan-daemon-update}"
INSTALL_MARKER="${INSTALL_MARKER:-${INSTALL_DIR}/.leviathan-install.json}"
KEEP_DATA=false
DRY_RUN=false

usage() {
  cat <<EOF
Leviathan daemon uninstaller

Usage:
  sudo bash uninstall.sh [options]

Options:
  --install-dir PATH   Install directory (default: /opt/leviathan)
  --keep-data          Keep daemon data directories
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

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-dir) INSTALL_DIR="$2"; shift 2 ;;
    --keep-data) KEEP_DATA=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    --help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ "${DRY_RUN}" != "true" && "${EUID}" -ne 0 ]]; then
  echo "Please run as root: sudo bash installers/daemon/uninstall.sh" >&2
  exit 1
fi

run systemctl disable --now "${SERVICE_NAME}.service"
if systemctl list-unit-files "${UPDATE_TIMER_NAME}.timer" >/dev/null 2>&1; then
  run systemctl disable --now "${UPDATE_TIMER_NAME}.timer"
fi
run rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
run rm -f "/etc/systemd/system/${UPDATE_SERVICE_NAME}.service"
run rm -f "/etc/systemd/system/${UPDATE_TIMER_NAME}.timer"
run rm -f "${INSTALL_MARKER}"
run systemctl daemon-reload
run rm -rf "${INSTALL_DIR}"

if [[ "${KEEP_DATA}" == "false" ]]; then
  run rm -rf /var/lib/leviathan
fi

echo "[leviathan-daemon] Uninstalled ${SERVICE_NAME}.service."
