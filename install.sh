#!/usr/bin/env bash
# Mantém a URL histórica do instalador na raiz do repositório.
# O app mora em apps/patrimonio. Este script só chega até lá.
set -euo pipefail

REPO_URL="https://github.com/gustavogpassos/patrimonio.git"
BRANCH="main"

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

ensure_git() {
  command -v git >/dev/null 2>&1 && return 0
  log "Instalando git"
  if command -v apt-get >/dev/null 2>&1; then
    as_root apt-get update -y
    as_root apt-get install -y ca-certificates git
  elif command -v dnf >/dev/null 2>&1; then
    as_root dnf install -y ca-certificates git
  elif command -v pacman >/dev/null 2>&1; then
    as_root pacman -Sy --noconfirm ca-certificates git
  else
    die "Não reconheci o gerenciador de pacotes. Instale git e rode de novo."
  fi
}

if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [[ -f "$root/apps/patrimonio/install.sh" ]]; then
    if [[ -n "${PATRIMONIO_INSTALL_TARGET:-}" ]]; then
      exec bash "$PATRIMONIO_INSTALL_TARGET"
    fi
    exec bash "$root/apps/patrimonio/install.sh"
  fi
fi

if [[ "$(id -u)" -eq 0 ]]; then
  dest="/opt/patrimonio"
else
  dest="${HOME}/patrimonio"
fi

if [[ ! -f "$dest/apps/patrimonio/install.sh" ]]; then
  ensure_git
  log "Clonando ${REPO_URL} em ${dest}"
  git clone --branch "$BRANCH" "$REPO_URL" "$dest"
fi

exec bash "$dest/apps/patrimonio/install.sh"
