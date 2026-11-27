#!/usr/bin/env bash
# Instala ou atualiza o Patrimônio.
#
# Primeira vez, num Linux sem Bun nem Git:
#   curl -fsSL https://raw.githubusercontent.com/gustavogpassos/patrimonio/main/install.sh | sudo bash
#
# Atualização, no diretório da instalação, depois de uma versão nova no GitHub:
#   sudo ./install.sh
#
# O banco data/patrimonio.db não vai no repositório. Se não existir, a
# inicialização cria um arquivo vazio desta instalação. Se existir, o código
# novo é baixado e só as migrações pendentes são aplicadas.
set -euo pipefail

REPO_URL="https://github.com/gustavogpassos/patrimonio.git"
BRANCH="main"
SERVICE_NAME="patrimonio"
export PATH="/usr/local/bin:${HOME:-/root}/.bun/bin:${PATH}"

log() { printf '==> %s\n' "$*"; }
die() { printf 'Erro: %s\n' "$*" >&2; exit 1; }

as_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    die "Execute como root ou instale o sudo para preparar o sistema."
  fi
}

install_base_packages() {
  local missing=0 cmd
  for cmd in curl git unzip; do
    command -v "$cmd" >/dev/null 2>&1 || missing=1
  done
  [[ "$missing" -eq 0 ]] && return 0

  log "Instalando curl, git e unzip"
  if command -v apt-get >/dev/null 2>&1; then
    as_root apt-get update -y
    as_root apt-get install -y ca-certificates curl git unzip
  elif command -v dnf >/dev/null 2>&1; then
    as_root dnf install -y ca-certificates curl git unzip
  elif command -v pacman >/dev/null 2>&1; then
    as_root pacman -Sy --noconfirm ca-certificates curl git unzip
  else
    die "Não reconheci o gerenciador de pacotes. Instale curl, git e unzip e rode de novo."
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
    log "Bun já instalado: $(bun_bin) ($( "$(bun_bin)" --version ))"
    return 0
  fi
  log "Instalando Bun"
  if [[ "$(id -u)" -eq 0 ]]; then
    curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local bash
  else
    curl -fsSL https://bun.sh/install | bash
    export PATH="${HOME}/.bun/bin:${PATH}"
  fi
  bun_bin >/dev/null 2>&1 || die "O Bun não ficou disponível depois da instalação."
}

resolve_install_dir() {
  if [[ -n "${PATRIMONIO_DIR:-}" ]]; then
    printf '%s\n' "$PATRIMONIO_DIR"
    return 0
  fi
  local src="${BASH_SOURCE[0]:-}"
  if [[ -n "$src" && -f "$src" ]]; then
    cd "$(dirname "$src")" && pwd
    return 0
  fi
  if [[ "$(id -u)" -eq 0 ]]; then
    printf '%s\n' /opt/patrimonio/apps/patrimonio
  else
    printf '%s\n' "${HOME}/patrimonio/apps/patrimonio"
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
    log "Criando o usuário de sistema patrimonio"
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
  local app="$1"
  local owner="$2"
  local repo
  repo="$(git -C "$app" rev-parse --show-toplevel 2>/dev/null || true)"
  if [[ -n "$repo" && -d "$repo/.git" ]]; then
    [[ -w "$repo/.git" || "$(id -u)" -eq 0 ]] || die "Sem permissão para atualizar ${repo}. Rode: sudo ./install.sh"
    local remote
    remote="$(git -C "$repo" -c "safe.directory=${repo}" remote get-url origin 2>/dev/null || true)"
    case "$remote" in
      *github.com[:/]gustavogpassos/patrimonio*) ;;
      *) die "O diretório ${repo} não é um clone de ${REPO_URL}." ;;
    esac
    log "Baixando a versão publicada em ${repo}"
    run_as_owner "$owner" "$repo" git -c "safe.directory=${repo}" fetch origin "$BRANCH"
    run_as_owner "$owner" "$repo" git -c "safe.directory=${repo}" checkout -f -B "$BRANCH" "origin/${BRANCH}"
    return 0
  fi
  local dest
  if [[ "$(basename "$(dirname "$app")")" == "apps" ]]; then
    dest="$(dirname "$(dirname "$app")")"
  else
    dest="$app"
  fi
  if [[ -e "$dest" ]] && [[ -n "$(ls -A "$dest" 2>/dev/null || true)" ]]; then
    die "${dest} já existe e não é uma instalação do Patrimônio."
  fi
  log "Clonando ${REPO_URL} em ${dest}"
  mkdir -p "$dest"
  if [[ "$(id -u)" -eq 0 && "$owner" != "root" ]]; then
    chown "$owner:" "$dest"
  fi
  run_as_owner "$owner" "$(dirname "$dest")" git clone --branch "$BRANCH" "$REPO_URL" "$(basename "$dest")"
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
  log "Cópia do banco antes da atualização: ${backup}"
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
    log "Banco existente em ${db}. Os dados ficam; só entram migrações pendentes."
  else
    log "Nenhum banco ainda. Criando ${db} nesta instalação."
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
Description=Patrimônio
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
Description=Patrimônio
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
        log "O serviço sobe nesta sessão. Para continuar depois de sair, rode: sudo loginctl enable-linger $(id -un)"
    fi
    return 0
  fi

  log "systemd não está disponível. Subindo o processo em segundo plano."
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
  [[ "$before" == "$after" ]] || die "A troca de versão alterou ${dir}/data/patrimonio.db. A instalação parou antes de mexer no serviço."

  if [[ "${PATRIMONIO_INNER:-}" != 1 ]]; then
    export PATRIMONIO_INNER=1
    export PATRIMONIO_DIR="$dir"
    exec bash "$dir/install.sh"
  fi

  chmod +x "$dir/install.sh" 2>/dev/null || true
  write_env_if_missing "$dir" "$owner"
  local port
  port="$(read_port "$dir")"

  log "Parando a versão que estiver no ar"
  stop_previous "$dir"

  log "Instalando dependências e gerando a interface"
  if ! run_as_owner "$owner" "$dir" "$bun" install; then
    install_service "$dir" "$owner" "$bun" "$port" || true
    die "bun install falhou. Se havia uma versão no ar, a subida foi tentada de novo."
  fi
  if ! run_as_owner "$owner" "$dir" "$bun" run build; then
    install_service "$dir" "$owner" "$bun" "$port" || true
    die "A compilação falhou. Se havia uma versão no ar, a subida foi tentada de novo."
  fi

  backup_database "$dir" "$owner" "$bun"
  if ! apply_migrations "$dir" "$owner" "$bun"; then
    die "A migração do banco falhou. O arquivo ${dir}/data/patrimonio.db foi mantido e, se já existia, há uma cópia em ${dir}/data/backups/."
  fi

  log "Subindo o serviço na porta ${port}"
  install_service "$dir" "$owner" "$bun" "$port"
  if ! wait_until_up "$port"; then
    if [[ "$(id -u)" -eq 0 ]]; then
      journalctl -u "${SERVICE_NAME}.service" -n 40 --no-pager || true
    fi
    die "O processo não respondeu em http://127.0.0.1:${port}/."
  fi

  local ip
  ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  [[ -n "$ip" ]] || ip="127.0.0.1"
  log "Patrimônio no ar: http://${ip}:${port}"
  log "Instalação: ${dir}"
  log "Banco desta máquina: ${dir}/data/patrimonio.db"
  if [[ -f "$dir/data/patrimonio.db" && "$before" != missing ]]; then
    log "Atualização concluída. Os dados que já estavam no banco continuam nele."
  else
    log "Primeira inicialização. O banco foi criado vazio, só com as categorias iniciais."
  fi
}

main "$@"
