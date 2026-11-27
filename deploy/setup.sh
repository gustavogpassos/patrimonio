#!/usr/bin/env bash
set -euo pipefail

DEPLOY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$DEPLOY/.env"

if [[ -f "$ENV_FILE" ]]; then
  echo "Erro: deploy/.env já existe" >&2
  exit 1
fi

if [[ -z "${INTRANET_IP:-}" ]]; then
  read -r -p "INTRANET_IP: " INTRANET_IP
fi
if [[ -z "${AUTHENTIK_ADMIN_PASSWORD:-}" ]]; then
  read -r -s -p "AUTHENTIK_ADMIN_PASSWORD: " AUTHENTIK_ADMIN_PASSWORD
  printf '\n'
fi
if [[ -z "$INTRANET_IP" || -z "$AUTHENTIK_ADMIN_PASSWORD" ]]; then
  echo "Erro: INTRANET_IP e AUTHENTIK_ADMIN_PASSWORD são obrigatórios" >&2
  exit 1
fi

rand() {
  openssl rand -base64 "$1" | tr -d '\n'
}

POSTGRES_PASSWORD="$(rand 24)"
AUTHENTIK_DB_PASSWORD="$(rand 24)"
WIKI_DB_PASSWORD="$(rand 24)"
PATRIMONIO_DB_PASSWORD="$(rand 24)"
CHAMADOS_DB_PASSWORD="$(rand 24)"
AUTHENTIK_SECRET_KEY="$(rand 48)"
SESSION_SECRET="$(rand 32)"
AUTHENTIK_BOOTSTRAP_TOKEN="$(rand 32)"
PATRIMONIO_OIDC_SECRET="$(rand 32)"
WIKI_OIDC_SECRET="$(rand 32)"
CHAMADOS_OIDC_SECRET="$(rand 32)"
WIKI_ADMIN_PASSWORD="$(rand 24)"

umask 077
{
  printf 'INTRANET_IP=%s\n' "$INTRANET_IP"
  printf 'POSTGRES_PASSWORD=%s\n' "$POSTGRES_PASSWORD"
  printf 'AUTHENTIK_SECRET_KEY=%s\n' "$AUTHENTIK_SECRET_KEY"
  printf 'AUTHENTIK_ADMIN_PASSWORD=%s\n' "$AUTHENTIK_ADMIN_PASSWORD"
  printf 'AUTHENTIK_DB_PASSWORD=%s\n' "$AUTHENTIK_DB_PASSWORD"
  printf 'WIKI_DB_PASSWORD=%s\n' "$WIKI_DB_PASSWORD"
  printf 'PATRIMONIO_DB_PASSWORD=%s\n' "$PATRIMONIO_DB_PASSWORD"
  printf 'CHAMADOS_DB_PASSWORD=%s\n' "$CHAMADOS_DB_PASSWORD"
  printf 'SESSION_SECRET=%s\n' "$SESSION_SECRET"
  printf 'AUTHENTIK_BOOTSTRAP_TOKEN=%s\n' "$AUTHENTIK_BOOTSTRAP_TOKEN"
  printf 'PATRIMONIO_OIDC_SECRET=%s\n' "$PATRIMONIO_OIDC_SECRET"
  printf 'WIKI_OIDC_SECRET=%s\n' "$WIKI_OIDC_SECRET"
  printf 'CHAMADOS_OIDC_SECRET=%s\n' "$CHAMADOS_OIDC_SECRET"
  printf 'WIKI_ADMIN_PASSWORD=%s\n' "$WIKI_ADMIN_PASSWORD"
} >"$ENV_FILE"
chmod 600 "$ENV_FILE"
echo "deploy/.env gravado"