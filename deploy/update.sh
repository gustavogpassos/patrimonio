#!/usr/bin/env bash
set -euo pipefail

DEPLOY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DEPLOY/.." && pwd)"
ENV_FILE="$DEPLOY/.env"
COMPOSE=(docker compose -f "$DEPLOY/compose.yml" --env-file "$ENV_FILE")

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Erro: deploy/.env não existe" >&2
  exit 1
fi

# INTRANET_SKIP_PULL=1 skips git pull. Used by deploy/setup.test.sh.
if [[ "${INTRANET_SKIP_PULL:-}" != 1 ]]; then
  git -C "$ROOT" pull --ff-only
fi

mkdir -p "$DEPLOY/backups"
stamp="$(date +%Y%m%d%H%M%S)"
for db in authentik wiki patrimonio chamados; do
  "${COMPOSE[@]}" exec -T postgres pg_dump -U postgres --dbname="$db" \
    >"$DEPLOY/backups/${db}-${stamp}.sql"
done

shopt -s nullglob
for db in authentik wiki patrimonio chamados; do
  mapfile -t old < <(find "$DEPLOY/backups" -maxdepth 1 -type f -name "${db}-*.sql" -printf '%T@ %p\n' | sort -nr | tail -n +6 | cut -d' ' -f2-)
  if ((${#old[@]})); then
    rm -f "${old[@]}"
  fi
done

fail() {
  newest="$(ls -1t "$DEPLOY/backups/"*.sql | head -n 1)"
  echo "Atualização falhou. Dump: ${newest}" >&2
  exit 1
}

if ! "${COMPOSE[@]}" up -d; then
  fail
fi

deadline=$(( $(date +%s) + 180 ))
while true; do
  ps_out="$("${COMPOSE[@]}" ps --format '{{.Service}} {{.Health}}')"
  starting=0
  while IFS= read -r line; do
    [[ -z "${line}" ]] && continue
    health="${line##* }"
    [[ -z "${health}" ]] && continue
    if [[ "${health}" == unhealthy ]]; then
      fail
    fi
    if [[ "${health}" == starting ]]; then
      starting=1
    fi
  done <<<"${ps_out}"
  if [[ "${starting}" -eq 0 ]]; then
    break
  fi
  if (( $(date +%s) >= deadline )); then
    fail
  fi
  sleep 2
done