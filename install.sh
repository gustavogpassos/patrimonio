#!/usr/bin/env bash
# Installs or updates Assets.
#
# First time, on a Linux machine without Bun or Git:
#   curl -fsSL https://raw.githubusercontent.com/gustavogpassos/patrimonio/main/install.sh | sudo bash
#
# Update, from the install directory, after a new version is on GitHub:
#   sudo ./install.sh
#
# data/patrimonio.db is not in the repository. If it does not exist, startup
# creates an empty file for this install. If it does, the new code is downloaded
# and only pending migrations are applied.
set -euo pipefail

REPO_URL="https://github.com/gustavogpassos/patrimonio.git"
BRANCH="main"
SERVICE_NAME="patrimonio"
export PATH="/usr/local/bin:${HOME:-/root}/.bun/bin:${PATH}"

log() { printf '==> %s\n' "$*"; }
die() { printf 'Error: %s\n' "$*" >&2; exit 1; }

as_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    die "Run as root, or install sudo, to prepare the system."
  fi
}

install_base_packages() {
  local missing=0 cmd
  for cmd in curl git unzip; do
    command -v "$cmd" >/dev/null 2>&1 || missing=1
  done
  [[ "$missing" -eq 0 ]] && return 0

  log "Installing curl, git, and unzip"
  if command -v apt-get >/dev/null 2>&1; then
    as_root apt-get update -y
    as_root apt-get install -y ca-certificates curl git unzip
  elif command -v dnf >/dev/null 2>&1; then
    as_root dnf install -y ca-certificates curl git unzip
  elif command -v pacman >/dev/null 2>&1; then
    as_root pacman -Sy --noconfirm ca-certificates curl git unzip
  else
    die "Could not recognize the package manager. Install curl, git, and unzip, then run this again."
  fi
}

bun_bin() {
  if [[ -x /usr/local/bin/bun ]]; then
    printf '%s\n' /usr/local/bin/bun
  elif [[ -n "${HOME:-}" && -x "${HOME}/.bun/bin/bun" ]]; then
    printf '%s\n' "${HOME}/.bun/bin/bun"
  elif command -v bun >/dev/null 2>&1; then
    command -v bun
  else
    return 1
  fi
}

install_bun() {
  if bun_bin >/dev/null 2>&1; then
    log "Bun already installed: $(bun_bin) ($( "$(bun_bin)" --version ))"
    return 0
  fi
  log "Installing Bun"
  if [[ "$(id -u)" -eq 0 ]]; then
    curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local bash
  else
    curl -fsSL https://bun.sh/install | bash
    export PATH="${HOME}/.bun/bin:${PATH}"
  fi
  bun_bin >/dev/null 2>&1 || die "Bun is not available after installation."
}

resolve_install_dir() {
  if [[ -n "${PATRIMONIO_DIR:-}" ]]; then
    printf '%s\n' "$PATRIMONIO_DIR"
    return 0
  fi
  local src="${BASH_SOURCE[0]:-}"
  if [[ -f "$src" ]]; then
    local top
    top="$(git -C "$(cd "$(dirname "$src")" && pwd)" rev-parse --show-toplevel 2>/dev/null || true)"
    if [[ -n "$top" ]]; then
      printf '%s\n' "$top"
      return 0
    fi
  fi
  if [[ "$(id -u)" -eq 0 ]]; then
    printf '%s\n' /opt/patrimonio
  else
    printf '%s\n' "${HOME}/patrimonio"
  fi
}

db_fingerprint() {
  local db="$1/data/patrimonio.db"
  if [[ -f "$db" ]]; then
    sha256sum "$db" | awk '{print $1}'
  else
    printf '%s\n' missing
  fi
}

ensure_service_user() {
  local dir="$1"
  if [[ "$(id -u)" -ne 0 ]]; then
    id -un
    return 0
  fi
  if [[ -d "$dir" ]]; then
    stat -c '%U' "$dir"
    return 0
  fi
  if ! id patrimonio >/dev/null 2>&1; then
    log "Creating the patrimonio system user"
    local nologin="/usr/sbin/nologin"
    [[ -x "$nologin" ]] || nologin="/sbin/nologin"
    [[ -x "$nologin" ]] || nologin="/usr/bin/false"
    useradd --system --home-dir "$dir" --shell "$nologin" patrimonio
  fi
  printf '%s\n' patrimonio
}

run_as_owner() {
  local owner="$1"
  local dir="$2"
  shift 2
  if [[ "$(id -un)" == "$owner" ]]; then
    (cd "$dir" && "$@")
  else
    sudo -u "$owner" -H -- bash -c 'cd "$1" && shift && exec "$@"' bash "$dir" "$@"
  fi
}

sync_code() {
  local dir="$1"
  local owner="$2"
  if [[ -d "$dir/.git" ]]; then
    [[ -w "$dir/.git" || "$(id -u)" -eq 0 ]] || die "No permission to update ${dir}. Run: sudo ./install.sh"
    local remote
    remote="$(git -C "$dir" -c "safe.directory=${dir}" remote get-url origin 2>/dev/null || true)"
    case "$remote" in
      *github.com[:/]gustavogpassos/patrimonio*) ;;
      *) die "Directory ${dir} is not a clone of ${REPO_URL}." ;;
    esac
    log "Downloading the published version into ${dir}"
    run_as_owner "$owner" "$dir" git -c "safe.directory=${dir}" fetch origin "$BRANCH"
    run_as_owner "$owner" "$dir" git -c "safe.directory=${dir}" checkout -f -B "$BRANCH" "origin/${BRANCH}"
    return 0
  fi
  if [[ -e "$dir" ]] && [[ -n "$(ls -A "$dir" 2>/dev/null || true)" ]]; then
    die "${dir} already exists and is not an Assets install."
  fi
  log "Cloning ${REPO_URL} into ${dir}"
  mkdir -p "$dir"
  if [[ "$(id -u)" -eq 0 && "$owner" != "root" ]]; then
    chown "$owner:" "$dir"
  fi
  run_as_owner "$owner" "$(dirname "$dir")" git clone --branch "$BRANCH" "$REPO_URL" "$dir"
}

write_env_if_missing() {
  local dir="$1"
  local owner="$2"
  if [[ -f "$dir/patrimonio.env" ]]; then
    return 0
  fi
  printf 'PORT=8787\n' >"$dir/patrimonio.env"
  if [[ "$(id -un)" != "$owner" ]]; then
    chown "$owner:" "$dir/patrimonio.env"
  fi
}

read_port() {
  local file="$1/patrimonio.env"
  local port="8787"
  if [[ -f "$file" ]]; then
    local line
    line="$(grep -E '^PORT=' "$file" | tail -n 1 || true)"
    if [[ -n "$line" ]]; then
      port="${line#PORT=}"
      port="${port//$'\r'/}"
    fi
  fi
  if [[ ! "$port" =~ ^[0-9]+$ ]]; then
    port="8787"
  fi
  printf '%s\n' "$port"
}

backup_database() {
  local dir="$1"
  local owner="$2"
  local bun="$3"
  local db="$dir/data/patrimonio.db"
  [[ -f "$db" ]] || return 0
  run_as_owner "$owner" "$dir" "$bun" -e 'import { Database } from "bun:sqlite"; const db = new Database(process.argv[1]); db.exec("PRAGMA wal_checkpoint(TRUNCATE)"); db.close()' "$db"
  local backup_dir="$dir/data/backups"
  mkdir -p "$backup_dir"
  local backup="${backup_dir}/patrimonio-$(date +%Y%m%d%H%M%S).db"
  cp -a "$db" "$backup"
  if [[ "$(id -un)" != "$owner" ]]; then
    chown -R "$owner:" "$backup_dir"
  fi
  log "Database copy before the update: ${backup}"
  mapfile -t old < <(find "$backup_dir" -maxdepth 1 -type f -name 'patrimonio-*.db' -printf '%T@ %p\n' | sort -nr | awk 'NR>5 { print $2 }')
  if [[ "${#old[@]}" -gt 0 ]]; then
    rm -f "${old[@]}"
  fi
}

apply_migrations() {
  local dir="$1"
  local owner="$2"
  local bun="$3"
  local db="$dir/data/patrimonio.db"
  if [[ -f "$db" ]]; then
    log "Existing database at ${db}. Data stays; only pending migrations are applied."
  else
    log "No database yet. Creating ${db} for this install."
  fi
  run_as_owner "$owner" "$dir" "$bun" -e 'import { openDatabase } from "./src/db/sqlite.ts"; const db = openDatabase(); db.close()'
}

stop_previous() {
  local dir="$1"
  if command -v systemctl >/dev/null 2>&1 && [[ -d /run/systemd/system ]]; then
    if [[ "$(id -u)" -eq 0 ]]; then
      systemctl stop "${SERVICE_NAME}.service" >/dev/null 2>&1 || true
    elif systemctl --user show-environment >/dev/null 2>&1; then
      systemctl --user stop "${SERVICE_NAME}.service" >/dev/null 2>&1 || true
    fi
  fi
  local pidfile="$dir/data/patrimonio.pid"
  if [[ -f "$pidfile" ]]; then
    local pid
    pid="$(cat "$pidfile" || true)"
    if [[ -n "${pid}" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      sleep 1
    fi
    rm -f "$pidfile"
  fi
}

install_service() {
  local dir="$1"
  local owner="$2"
  local bun="$3"
  local port="$4"
  local unit group
  group="$(id -gn "$owner")"
  unit="$(cat <<EOF
[Unit]
Description=Assets
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${owner}
Group=${group}
WorkingDirectory=${dir}
EnvironmentFile=-${dir}/patrimonio.env
ExecStart=${bun} src/server/index.ts
Restart=on-failure
RestartSec=3
StartLimitIntervalSec=60
StartLimitBurst=5

[Install]
WantedBy=multi-user.target
EOF
)"

  if [[ "$(id -u)" -eq 0 ]] && command -v systemctl >/dev/null 2>&1 && [[ -d /run/systemd/system ]]; then
    printf '%s\n' "$unit" >"/etc/systemd/system/${SERVICE_NAME}.service"
    systemctl daemon-reload
    systemctl enable "${SERVICE_NAME}.service"
    systemctl restart "${SERVICE_NAME}.service"
    return 0
  fi

  if command -v systemctl >/dev/null 2>&1 && systemctl --user show-environment >/dev/null 2>&1; then
    unit="$(cat <<EOF
[Unit]
Description=Assets
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${dir}
EnvironmentFile=-${dir}/patrimonio.env
ExecStart=${bun} src/server/index.ts
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
EOF
)"
    mkdir -p "${HOME}/.config/systemd/user"
    printf '%s\n' "$unit" >"${HOME}/.config/systemd/user/${SERVICE_NAME}.service"
    systemctl --user daemon-reload
    systemctl --user enable "${SERVICE_NAME}.service"
    systemctl --user restart "${SERVICE_NAME}.service"
    if command -v loginctl >/dev/null 2>&1; then
      loginctl enable-linger "$(id -un)" >/dev/null 2>&1 || sudo -n loginctl enable-linger "$(id -un)" >/dev/null 2>&1 || \
        log "The service starts for this session. To keep it after logout, run: sudo loginctl enable-linger $(id -un)"
    fi
    return 0
  fi

  log "systemd is not available. Starting the process in the background."
  local log_file="$dir/data/patrimonio.log"
  mkdir -p "$dir/data"
  (
    cd "$dir"
    set -a
    # shellcheck disable=SC1091
    [[ -f patrimonio.env ]] && . ./patrimonio.env
    set +a
    nohup "$bun" src/server/index.ts >>"$log_file" 2>&1 &
    echo $! >"$dir/data/patrimonio.pid"
  )
}

wait_until_up() {
  local port="$1"
  local i
  for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
    if curl -fsS "http://127.0.0.1:${port}/" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.4
  done
  return 1
}

main() {
  install_base_packages
  install_bun
  local bun dir owner before after
  bun="$(bun_bin)"
  dir="$(resolve_install_dir)"
  owner="$(ensure_service_user "$dir")"

  before="$(db_fingerprint "$dir")"
  sync_code "$dir" "$owner"
  after="$(db_fingerprint "$dir")"
  [[ "$before" == "$after" ]] || die "The version switch changed ${dir}/data/patrimonio.db. Install stopped before touching the service."

  if [[ "${PATRIMONIO_INNER:-}" != 1 ]]; then
    export PATRIMONIO_INNER=1
    export PATRIMONIO_DIR="$dir"
    exec bash "$dir/install.sh"
  fi

  chmod +x "$dir/install.sh" 2>/dev/null || true
  write_env_if_missing "$dir" "$owner"
  local port
  port="$(read_port "$dir")"

  log "Stopping the version that is running"
  stop_previous "$dir"

  log "Installing dependencies and building the interface"
  if ! run_as_owner "$owner" "$dir" "$bun" install; then
    install_service "$dir" "$owner" "$bun" "$port" || true
    die "bun install failed. If a version was running, startup was tried again."
  fi
  if ! run_as_owner "$owner" "$dir" "$bun" run build; then
    install_service "$dir" "$owner" "$bun" "$port" || true
    die "The build failed. If a version was running, startup was tried again."
  fi

  backup_database "$dir" "$owner" "$bun"
  if ! apply_migrations "$dir" "$owner" "$bun"; then
    die "The database migration failed. ${dir}/data/patrimonio.db was kept and, if it already existed, there is a copy in ${dir}/data/backups/."
  fi

  log "Starting the service on port ${port}"
  install_service "$dir" "$owner" "$bun" "$port"
  if ! wait_until_up "$port"; then
    if [[ "$(id -u)" -eq 0 ]]; then
      journalctl -u "${SERVICE_NAME}.service" -n 40 --no-pager || true
    fi
    die "The process did not respond at http://127.0.0.1:${port}/."
  fi

  local ip
  ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  [[ -n "$ip" ]] || ip="127.0.0.1"
  log "Assets is up: http://${ip}:${port}"
  log "Install: ${dir}"
  log "Database on this machine: ${dir}/data/patrimonio.db"
  if [[ -f "$dir/data/patrimonio.db" && "$before" != missing ]]; then
    log "Update finished. Data that was already in the database is still there."
  else
    log "First startup. The database was created empty, with only the initial categories."
  fi
}

main "$@"
