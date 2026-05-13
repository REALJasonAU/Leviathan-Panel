#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/leviathan}"
API_SERVICE_NAME="${API_SERVICE_NAME:-leviathan-api}"
PANEL_SERVICE_NAME="${PANEL_SERVICE_NAME:-leviathan-panel}"
UPDATE_TIMER_NAME="${UPDATE_TIMER_NAME:-leviathan-panel-update}"
INSTALL_MARKER="${INSTALL_MARKER:-${INSTALL_DIR}/.leviathan-install.json}"
DRY_RUN=false
REPO_URL="${REPO_URL:-https://github.com/REALJasonAU/Leviathan-Panel.git}"
REPO_BRANCH="${REPO_BRANCH:-master}"

usage() {
  cat <<EOF
Leviathan panel updater

Usage:
  sudo bash update.sh [options]

Options:
  --install-dir PATH   Install directory (default: /opt/leviathan)
  --repo-url URL       Repository URL to update from
  --repo-branch NAME   Branch/tag to update from
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

read_install_marker_value() {
  local key="$1"
  [[ -f "${INSTALL_MARKER}" ]] || return 0
  tr -d '\n' <"${INSTALL_MARKER}" | sed -n "s/.*\"${key}\": \"\\([^\"]*\\)\".*/\\1/p"
}

log() {
  echo "[leviathan-panel] $*"
}

is_installed() {
  if [[ -f "${INSTALL_MARKER}" && -f "/etc/systemd/system/${API_SERVICE_NAME}.service" && -f "/etc/systemd/system/${PANEL_SERVICE_NAME}.service" ]]; then
    return 0
  fi

  [[ -d "${INSTALL_DIR}" && -f "/etc/systemd/system/${API_SERVICE_NAME}.service" && -f "/etc/systemd/system/${PANEL_SERVICE_NAME}.service" ]]
}

write_install_marker() {
  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "[dry-run] write ${INSTALL_MARKER}"
    return
  fi
  cat >"${INSTALL_MARKER}" <<EOF
{
  "product": "Leviathan Panel",
  "installDir": "${INSTALL_DIR}",
  "updatedAt": "$(date --iso-8601=seconds)"
}
EOF
  chmod 600 "${INSTALL_MARKER}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-dir) INSTALL_DIR="$2"; shift 2 ;;
    --repo-url) REPO_URL="$2"; shift 2 ;;
    --repo-branch) REPO_BRANCH="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    --help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ "${DRY_RUN}" != "true" && "${EUID}" -ne 0 ]]; then
  echo "Please run as root: sudo bash installers/panel/update.sh" >&2
  exit 1
fi

[[ "${DRY_RUN}" == "true" || is_installed ]] || {
  echo "Leviathan panel is not installed at ${INSTALL_DIR}. Run the panel installer first." >&2
  exit 1
}

marker_repo_url="$(read_install_marker_value repoUrl)"
marker_repo_branch="$(read_install_marker_value repoBranch)"
REPO_URL="${marker_repo_url:-${REPO_URL}}"
REPO_BRANCH="${marker_repo_branch:-${REPO_BRANCH}}"

if [[ -d "${INSTALL_DIR}/.git" ]]; then
  log "Refreshing git checkout in ${INSTALL_DIR}..."
  run_shell "cd '${INSTALL_DIR}' && git fetch --all --prune && git checkout '${REPO_BRANCH}' && git pull --ff-only origin '${REPO_BRANCH}'"
else
  local_temp_dir="/tmp/leviathan-panel-update-$$"
  log "No git metadata found under ${INSTALL_DIR}; refreshing from ${REPO_URL} (${REPO_BRANCH})..."
  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "[dry-run] git clone --depth 1 --branch '${REPO_BRANCH}' '${REPO_URL}' '${local_temp_dir}'"
    echo "[dry-run] rsync -a --delete --exclude node_modules --exclude dist '${local_temp_dir}/' '${INSTALL_DIR}/'"
  else
    rm -rf "${local_temp_dir}"
    git clone --depth 1 --branch "${REPO_BRANCH}" "${REPO_URL}" "${local_temp_dir}"
    rsync -a --delete --exclude node_modules --exclude dist "${local_temp_dir}/" "${INSTALL_DIR}/"
    rm -rf "${local_temp_dir}"
  fi
fi

run_shell "cd '${INSTALL_DIR}' && pnpm install && pnpm build"
run systemctl restart "${API_SERVICE_NAME}.service"
run systemctl restart "${PANEL_SERVICE_NAME}.service"
run systemctl is-active --quiet "${API_SERVICE_NAME}.service"
run systemctl is-active --quiet "${PANEL_SERVICE_NAME}.service"
if systemctl list-unit-files "${UPDATE_TIMER_NAME}.timer" >/dev/null 2>&1; then
  run systemctl is-enabled --quiet "${UPDATE_TIMER_NAME}.timer"
fi

write_install_marker

echo "[leviathan-panel] Updated ${API_SERVICE_NAME}.service and ${PANEL_SERVICE_NAME}.service."
