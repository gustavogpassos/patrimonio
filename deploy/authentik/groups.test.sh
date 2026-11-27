#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BLUEPRINT="$ROOT/deploy/authentik/blueprints/intranet.yaml"
ENV_FILE="$ROOT/deploy/.env"
COMPOSE="docker compose -f $ROOT/deploy/compose.yml --env-file $ENV_FILE"

if [[ ! -f "$BLUEPRINT" ]]; then
  echo "FAIL: blueprint ausente" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE" 2>/dev/null || true
set +a

tmp_env="$(mktemp)"
trap 'rm -f "$tmp_env"' EXIT
cp "$ENV_FILE" "$tmp_env" 2>/dev/null || touch "$tmp_env"
if [[ -s "$tmp_env" ]] && [[ -n "$(tail -c 1 "$tmp_env")" ]]; then
  printf '\n' >>"$tmp_env"
fi

get_var() {
  local key="$1"
  local val
  val="$(grep -E "^${key}=" "$tmp_env" | tail -n1 | cut -d= -f2- || true)"
  printf '%s' "$val"
}

set_var() {
  local key="$1" val="$2"
  if grep -qE "^${key}=" "$tmp_env"; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$tmp_env"
  else
    printf '%s=%s\n' "$key" "$val" >>"$tmp_env"
  fi
}

rand_b64_32() {
  openssl rand -base64 32 | tr -d '\n'
}

rand_b64_48() {
  openssl rand -base64 48 | tr -d '\n'
}

intranet_ip="$(get_var INTRANET_IP)"
if [[ -z "$intranet_ip" || "$intranet_ip" == "test" ]]; then
  set_var INTRANET_IP "127.0.0.1"
fi

secret_key="$(get_var AUTHENTIK_SECRET_KEY)"
if [[ ${#secret_key} -lt 32 ]]; then
  set_var AUTHENTIK_SECRET_KEY "$(rand_b64_48)"
fi

for key in AUTHENTIK_BOOTSTRAP_TOKEN PATRIMONIO_OIDC_SECRET WIKI_OIDC_SECRET CHAMADOS_OIDC_SECRET; do
  val="$(get_var "$key")"
  if [[ -z "$val" ]]; then
    set_var "$key" "$(rand_b64_32)"
  fi
done

cp "$tmp_env" "$ENV_FILE"
chmod 600 "$ENV_FILE"

$COMPOSE up -d authentik authentik-worker

deadline=$((SECONDS + 180))
healthy=0
while ((SECONDS < deadline)); do
  if curl -sf http://127.0.0.1/authentik/-/health/live/ >/dev/null; then
    healthy=1
    break
  fi
  sleep 2
done

if [[ "$healthy" -ne 1 ]]; then
  echo "FAIL: authentik health check timeout" >&2
  $COMPOSE logs --tail=100 authentik-worker authentik >&2 || true
  echo "BLOCKED" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

token="${AUTHENTIK_BOOTSTRAP_TOKEN:-}"
if [[ -z "$token" ]]; then
  echo "FAIL: AUTHENTIK_BOOTSTRAP_TOKEN ausente" >&2
  $COMPOSE logs --tail=100 authentik-worker authentik >&2 || true
  echo "BLOCKED" >&2
  exit 1
fi

api_ready=0
while ((SECONDS < deadline)); do
  code="$(curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $token" "http://127.0.0.1/authentik/api/v3/core/groups/?page_size=1")"
  if [[ "$code" == "401" ]]; then
    echo "FAIL: API 401" >&2
    $COMPOSE logs --tail=100 authentik-worker authentik >&2 || true
    echo "BLOCKED" >&2
    exit 1
  fi
  if [[ "$code" == "200" ]]; then
    api_ready=1
    break
  fi
  sleep 2
done
if [[ "$api_ready" -ne 1 ]]; then
  echo "FAIL: authentik API not ready" >&2
  $COMPOSE logs --tail=100 authentik-worker authentik >&2 || true
  echo "BLOCKED" >&2
  exit 1
fi

api_get() {
  local url="$1"
  local code body
  body="$(curl -sS -w '\n%{http_code}' -H "Authorization: Bearer $token" "$url")"
  code="${body##*$'\n'}"
  body="${body%$'\n'*}"

  if [[ "$code" == "401" ]]; then
    echo "FAIL: API 401" >&2
    $COMPOSE logs --tail=100 authentik-worker authentik >&2 || true
    echo "BLOCKED" >&2
    exit 1
  fi
  if [[ "$code" != "200" ]]; then
    echo "FAIL: API HTTP $code for $url" >&2
    $COMPOSE logs --tail=100 authentik-worker authentik >&2 || true
    echo "BLOCKED" >&2
    exit 1
  fi
  printf '%s' "$body"
}

parent_names_for_group() {
  local group_name="$1"
  local payload results parent_list names uuid
  payload="$(api_get "http://127.0.0.1/authentik/api/v3/core/groups/?name=${group_name}&include_parents=true")"

  if ! command -v python3 >/dev/null 2>&1; then
    echo "FAIL: python3 required" >&2
    exit 1
  fi

  names="$(printf '%s' "$payload" | python3 -c "
import json, sys, urllib.request, os

data = json.load(sys.stdin)
results = data.get('results') or []
if not results:
    print('__MISSING__')
    sys.exit(0)
g = results[0]
parents_obj = g.get('parents_obj') or []
if parents_obj:
    names = sorted(p.get('name', '') for p in parents_obj if p.get('name'))
else:
    parents = g.get('parents') or []
    names = []
    token = os.environ.get('AK_TOKEN', '')
    for pid in parents:
        req = urllib.request.Request(
            f'http://127.0.0.1/authentik/api/v3/core/groups/{pid}/',
            headers={'Authorization': f'Bearer {token}'},
        )
        with urllib.request.urlopen(req) as resp:
            pg = json.load(resp)
        n = pg.get('name')
        if n:
            names.append(n)
    names = sorted(names)
print(','.join(names))
")"

  if [[ "$names" == "__MISSING__" ]]; then
    echo "FAIL: grupo $group_name ausente" >&2
    $COMPOSE logs --tail=100 authentik-worker authentik >&2 || true
    echo "BLOCKED" >&2
    exit 1
  fi

  printf '%s' "$names"
}

export AK_TOKEN="$token"

almox_parents="$(parent_names_for_group setor-almoxarifado)"
expected_almox="chamados,wiki,wiki-almoxarifado"
if [[ "$almox_parents" != "$expected_almox" ]]; then
  echo "FAIL: setor-almoxarifado parents: got [$almox_parents], want [$expected_almox]" >&2
  $COMPOSE logs --tail=100 authentik-worker authentik >&2 || true
  echo "BLOCKED" >&2
  exit 1
fi

ti_parents="$(parent_names_for_group setor-ti)"
expected_ti="chamados,chamados-atender,patrimonio,wiki,wiki-almoxarifado,wiki-financeiro,wiki-ti"
if [[ "$ti_parents" != "$expected_ti" ]]; then
  echo "FAIL: setor-ti parents: got [$ti_parents], want [$expected_ti]" >&2
  $COMPOSE logs --tail=100 authentik-worker authentik >&2 || true
  echo "BLOCKED" >&2
  exit 1
fi

if [[ "$ti_parents" == *wiki-financeiro-editar* ]]; then
  echo "FAIL: wiki-financeiro-editar must not be parent of setor-ti" >&2
  $COMPOSE logs --tail=100 authentik-worker authentik >&2 || true
  echo "BLOCKED" >&2
  exit 1
fi

effective_out="$($COMPOSE exec -T authentik-worker ak shell -c "$(cat "$ROOT/deploy/authentik/effective-groups.py")")"
if ! printf '%s\n' "$effective_out" | grep -qx 'OK effective-groups'; then
  echo "FAIL: effective-groups check" >&2
  printf '%s\n' "$effective_out" >&2
  $COMPOSE logs --tail=100 authentik-worker authentik >&2 || true
  exit 1
fi
printf '%s\n' "$effective_out" | grep '^OK effective-groups$'

echo "OK groups.test.sh"