#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/leviathan}"
API_SERVICE_NAME="${API_SERVICE_NAME:-leviathan-api}"
PANEL_SERVICE_NAME="${PANEL_SERVICE_NAME:-leviathan-panel}"
UPDATE_SERVICE_NAME="${UPDATE_SERVICE_NAME:-leviathan-panel-update}"
UPDATE_TIMER_NAME="${UPDATE_TIMER_NAME:-leviathan-panel-update}"
KEEP_DATA=false
DRY_RUN=false

usage() {
  cat <<EOF
Leviathan panel uninstaller

Usage:
  sudo bash uninstall.sh [options]

Options:
  --install-dir PATH   Install directory (default: /opt/leviathan)
  --keep-data          Keep application data files under the install directory
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
  echo "Please run as root: sudo bash installers/panel/uninstall.sh" >&2
  exit 1
fi

run systemctl disable --now "${API_SERVICE_NAME}.service"
run systemctl disable --now "${PANEL_SERVICE_NAME}.service"
if systemctl list-unit-files "${UPDATE_TIMER_NAME}.timer" >/dev/null 2>&1; then
  run systemctl disable --now "${UPDATE_TIMER_NAME}.timer"
fi
run rm -f "/etc/systemd/system/${API_SERVICE_NAME}.service"
run rm -f "/etc/systemd/system/${PANEL_SERVICE_NAME}.service"
run rm -f "/etc/systemd/system/${UPDATE_SERVICE_NAME}.service"
run rm -f "/etc/systemd/system/${UPDATE_TIMER_NAME}.timer"
run systemctl daemon-reload

if [[ "${KEEP_DATA}" == "false" ]]; then
  run rm -rf "${INSTALL_DIR}"
fi

echo "[leviathan-panel] Uninstalled ${API_SERVICE_NAME}.service and ${PANEL_SERVICE_NAME}.service."
