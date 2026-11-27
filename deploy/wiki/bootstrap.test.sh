#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

bash deploy/wiki/bootstrap.sh
bash deploy/wiki/bootstrap.sh

set -a
# shellcheck source=/dev/null
source "$REPO_ROOT/deploy/.env"
set +a

: "${WIKI_ADMIN_PASSWORD:?}"

WIKI_URL="http://127.0.0.1:8081"

LOGIN_MUTATION='mutation ($username: String!, $password: String!, $strategy: String!) {
  authentication {
    login(username: $username, password: $password, strategy: $strategy) {
      jwt
      responseResult { succeeded message }
    }
  }
}'

vars_login="$(WIKI_ADMIN_PASSWORD="$WIKI_ADMIN_PASSWORD" python3 -c '
import json, os
print(json.dumps({
  "username": "admin@localhost",
  "strategy": "local",
  "password": os.environ["WIKI_ADMIN_PASSWORD"],
}))
')"

body="$(python3 -c 'import json,sys; print(json.dumps({"query": sys.argv[1], "variables": json.loads(sys.argv[2])}))' \
  "$LOGIN_MUTATION" "$vars_login")"

resp="$(curl -sS -X POST "$WIKI_URL/graphql" -H "Content-Type: application/json" -d "$body")"
jwt="$(printf '%s' "$resp" | python3 -c '
import json, sys
data = json.load(sys.stdin)
jwt = data.get("data", {}).get("authentication", {}).get("login", {}).get("jwt")
if not jwt:
  sys.exit("login failed")
print(jwt)
')"

gql_auth() {
  local query="$1"
  local variables="${2:-}"
  local payload
  if [[ -n "$variables" ]]; then
    payload="$(python3 -c 'import json,sys; print(json.dumps({"query": sys.argv[1], "variables": json.loads(sys.argv[2])}))' \
      "$query" "$variables")"
  else
    payload="$(python3 -c 'import json,sys; print(json.dumps({"query": sys.argv[1]}))' "$query")"
  fi
  curl -sS -X POST "$WIKI_URL/graphql" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $jwt" \
    -d "$payload"
}

LIST_GROUPS='query { groups { list { id name } } }'
resp="$(gql_auth "$LIST_GROUPS")"

ids="$(python3 -c '
import json, sys
data = json.loads(sys.argv[1])
groups = data["data"]["groups"]["list"]
financeiro = [g for g in groups if g["name"] == "wiki-financeiro"]
if len(financeiro) != 1:
    sys.exit(f"esperado 1 wiki-financeiro, encontrado {len(financeiro)}")
almox = next((g for g in groups if g["name"] == "wiki-almoxarifado"), None)
if not almox:
    sys.exit("wiki-almoxarifado não encontrado")
print(financeiro[0]["id"], almox["id"])
' "$resp")"
read -r fid aid <<<"$ids"

SINGLE_GROUP='query ($id: Int!) {
  groups { single(id: $id) { name permissions pageRules { path match deny roles } } }
}'

resp_f="$(gql_auth "$SINGLE_GROUP" "{\"id\": $fid}")"
resp_a="$(gql_auth "$SINGLE_GROUP" "{\"id\": $aid}")"

python3 -c '
import json
import sys

financeiro = json.loads(sys.argv[1])["data"]["groups"]["single"]
almox = json.loads(sys.argv[2])["data"]["groups"]["single"]

ok_rule = False
for rule in financeiro.get("pageRules") or []:
    if (
        rule.get("path") == "financeiro"
        and rule.get("match") == "START"
        and rule.get("deny") is False
        and "read:pages" in (rule.get("roles") or [])
    ):
        ok_rule = True
        break
if not ok_rule:
    print("wiki-financeiro sem regra read:pages em financeiro", file=sys.stderr)
    sys.exit(1)

for rule in almox.get("pageRules") or []:
    if rule.get("path") == "financeiro" and "write:pages" in (rule.get("roles") or []):
        print("wiki-almoxarifado tem write:pages em financeiro", file=sys.stderr)
        sys.exit(1)

print("OK bootstrap.test.sh")
' "$resp_f" "$resp_a"