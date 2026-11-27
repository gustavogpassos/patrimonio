#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT}/deploy/compose.yml"

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

env_file="${tmpdir}/.env"
cat >"${env_file}" <<'EOF'
INTRANET_IP=test
POSTGRES_PASSWORD=test
AUTHENTIK_SECRET_KEY=test
AUTHENTIK_ADMIN_PASSWORD=test
AUTHENTIK_DB_PASSWORD=test
WIKI_DB_PASSWORD=test
PATRIMONIO_DB_PASSWORD=test
CHAMADOS_DB_PASSWORD=test
SESSION_SECRET=test
CHAMADOS_OIDC_SECRET=test
EOF

output="$(docker compose -f "${COMPOSE_FILE}" --env-file "${env_file}" config 2>&1)" || {
  echo "${output}"
  exit 1
}

# Extract postgres service block (until next top-level service or end)
postgres_block="$(echo "${output}" | awk '
  /^  postgres:/ { found=1; print; next }
  found && /^  [a-zA-Z0-9_-]+:/ { exit }
  found { print }
')"

postgres_publishes_port() {
  local block="$1"
  echo "$block" | grep -qE '[0-9]+:[0-9]+' && return 0
  echo "$block" | grep -qE 'published:[[:space:]]+"?[0-9]+"?' && return 0
  return 1
}

if postgres_publishes_port "${postgres_block}"; then
  echo "FAIL: postgres service has host port mapping"
  exit 1
fi

fixture_v5_published_port="$(cat <<'EOF'
  postgres:
    ports:
      - target: 5432
        published: "5432"
        protocol: tcp
EOF
)"

if ! postgres_publishes_port "${fixture_v5_published_port}"; then
  echo "FAIL: postgres port check missed a Compose v5 published port"
  exit 1
fi

fixture_no_ports="$(cat <<'EOF'
  postgres:
    image: postgres:16
EOF
)"

if postgres_publishes_port "${fixture_no_ports}"; then
  echo "FAIL: postgres port check rejected a service with no ports"
  exit 1
fi

nginx_block="$(echo "${output}" | awk '
  /^  nginx:/ { found=1; print; next }
  found && /^  [a-zA-Z0-9_-]+:/ { exit }
  found { print }
')"

has_nginx_80=false
has_nginx_8081=false
if echo "${output}" | grep -q '80:80'; then
  has_nginx_80=true
elif echo "${nginx_block}" | grep -q 'published: "80"'; then
  has_nginx_80=true
fi
if echo "${output}" | grep -q '8081:8081'; then
  has_nginx_8081=true
elif echo "${nginx_block}" | grep -q 'published: "8081"'; then
  has_nginx_8081=true
fi

if [[ "${has_nginx_80}" != true ]]; then
  echo "FAIL: missing nginx port mapping 80:80"
  exit 1
fi

if [[ "${has_nginx_8081}" != true ]]; then
  echo "FAIL: missing nginx port mapping 8081:8081"
  exit 1
fi

chamados_block="$(echo "${output}" | awk '
  /^  chamados:/ { found=1; print; next }
  found && /^  [a-zA-Z0-9_-]+:/ { exit }
  found { print }
')"

if [[ -z "${chamados_block}" ]]; then
  echo "FAIL: missing chamados service"
  exit 1
fi

if postgres_publishes_port "${chamados_block}"; then
  echo "FAIL: chamados service has host port mapping"
  exit 1
fi

if ! echo "${chamados_block}" | grep -q 'postgres://chamados'; then
  echo "FAIL: chamados service missing postgres://chamados DATABASE_URL"
  exit 1
fi

echo "OK compose.test.sh"
exit 0