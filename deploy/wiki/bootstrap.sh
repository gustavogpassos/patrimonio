#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

set -a
# shellcheck source=/dev/null
source "$REPO_ROOT/deploy/.env"
set +a

: "${INTRANET_IP:?INTRANET_IP obrigatório}"
: "${WIKI_OIDC_SECRET:?WIKI_OIDC_SECRET obrigatório}"
: "${WIKI_ADMIN_PASSWORD:?WIKI_ADMIN_PASSWORD obrigatório}"

WIKI_URL="http://127.0.0.1:8081"
SITE_URL="http://${INTRANET_IP}:8081"

LOGIN_MUTATION='mutation ($username: String!, $password: String!, $strategy: String!) {
  authentication {
    login(username: $username, password: $password, strategy: $strategy) {
      jwt
      responseResult { succeeded message }
    }
  }
}'

gql_body() {
  python3 -c '
import json, sys
print(json.dumps({"query": sys.argv[1], "variables": json.loads(sys.argv[2])}))
' "$1" "$2"
}

gql_post() {
  local jwt="${1:-}"
  local query="$2"
  local variables="${3:-\{\}}"
  local body
  body="$(gql_body "$query" "$variables")"
  if [[ -n "$jwt" ]]; then
    curl -sS -X POST "$WIKI_URL/graphql" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $jwt" \
      -d "$body"
  else
    curl -sS -X POST "$WIKI_URL/graphql" \
      -H "Content-Type: application/json" \
      -d "$body"
  fi
}

gql_failed() {
  python3 -c '
import json, sys
data = json.load(sys.stdin)
rr = data.get("data") or {}
# walk for responseResult.succeeded is false
def walk(o):
  if isinstance(o, dict):
    if "responseResult" in o and o["responseResult"].get("succeeded") is False:
      print(o["responseResult"].get("message", "unknown error"), file=sys.stderr)
      sys.exit(1)
    for v in o.values():
      walk(v)
  elif isinstance(o, list):
    for i in o:
      walk(i)
walk(data)
if data.get("errors"):
  for e in data["errors"]:
    print(e.get("message", e), file=sys.stderr)
  sys.exit(1)
'
}

extract_jwt() {
  python3 -c '
import json, sys
data = json.load(sys.stdin)
login = (data.get("data") or {}).get("authentication") or {}
login = (login.get("login") or {}) if isinstance(login, dict) else {}
jwt = login.get("jwt") if isinstance(login, dict) else None
print(jwt or "")
'
}

vars_login="$(WIKI_ADMIN_PASSWORD="$WIKI_ADMIN_PASSWORD" python3 -c '
import json, os
print(json.dumps({
  "username": "admin@localhost",
  "strategy": "local",
  "password": os.environ["WIKI_ADMIN_PASSWORD"],
}))
')"

wait_http_200() {
  local deadline=$((SECONDS + 180))
  while ((SECONDS < deadline)); do
    code="$(curl -sS -o /dev/null -w '%{http_code}' "$WIKI_URL/" || true)"
    if [[ "$code" == "200" ]]; then
      return 0
    fi
    if [[ "$code" == "302" ]]; then
      resp="$(gql_post "" "$LOGIN_MUTATION" "$vars_login" 2>/dev/null || true)"
      if [[ -n "$(printf '%s' "$resp" | extract_jwt)" ]]; then
        return 0
      fi
    fi
    sleep 1
  done
  echo "Wiki não respondeu 200 em 180s" >&2
  exit 1
}

wait_http_200

resp="$(gql_post "" "$LOGIN_MUTATION" "$vars_login")"
jwt="$(printf '%s' "$resp" | extract_jwt)"

if [[ -z "$jwt" ]]; then
  finalize_body="$(WIKI_ADMIN_PASSWORD="$WIKI_ADMIN_PASSWORD" SITE_URL="$SITE_URL" python3 -c '
import json, os
print(json.dumps({
  "adminEmail": "admin@localhost",
  "adminPassword": os.environ["WIKI_ADMIN_PASSWORD"],
  "siteUrl": os.environ["SITE_URL"],
  "telemetry": False,
}))
')"
  curl -sS -X POST "$WIKI_URL/finalize" \
    -H "Content-Type: application/json" \
    -d "$finalize_body" >/dev/null

  deadline=$((SECONDS + 180))
  jwt=""
  while ((SECONDS < deadline)); do
    resp="$(gql_post "" "$LOGIN_MUTATION" "$vars_login")"
    jwt="$(printf '%s' "$resp" | extract_jwt)"
    if [[ -n "$jwt" ]]; then
      break
    fi
    sleep 1
  done
  if [[ -z "$jwt" ]]; then
    echo "Login sem jwt após finalize" >&2
    exit 1
  fi
fi

export JWT="$jwt"
export INTRANET_IP WIKI_OIDC_SECRET SITE_URL

python3 <<'PY'
import json
import os
import subprocess
import sys

JWT = os.environ["JWT"]
WIKI_URL = "http://127.0.0.1:8081"
SITE_URL = os.environ["SITE_URL"]
INTRANET_IP = os.environ["INTRANET_IP"]
WIKI_OIDC_SECRET = os.environ["WIKI_OIDC_SECRET"]

READ_PERMS = ["read:pages", "read:assets", "read:comments"]
WRITE_PERMS = READ_PERMS + ["write:pages", "write:assets", "write:comments"]

GROUPS = [
    ("wiki", "geral", "read"),
    ("wiki-geral-editar", "geral", "write"),
    ("wiki-almoxarifado", "almoxarifado", "read"),
    ("wiki-almoxarifado-editar", "almoxarifado", "write"),
    ("wiki-financeiro", "financeiro", "read"),
    ("wiki-financeiro-editar", "financeiro", "write"),
    ("wiki-ti", "ti", "read"),
    ("wiki-ti-editar", "ti", "write"),
]

CREATE_GROUP = """mutation ($name: String!) {
  groups { create(name: $name) { responseResult { succeeded message } group { id name } } }
}"""

UPDATE_GROUP = """mutation ($id: Int!, $name: String!, $redirectOnLogin: String!, $permissions: [String]!, $pageRules: [PageRuleInput]!) {
  groups {
    update(id: $id, name: $name, redirectOnLogin: $redirectOnLogin, permissions: $permissions, pageRules: $pageRules) {
      responseResult { succeeded message }
    }
  }
}"""

UPDATE_SITE = """mutation ($host: String, $authHideLocal: Boolean) {
  site { updateConfig(host: $host, authHideLocal: $authHideLocal) { responseResult { succeeded message } } }
}"""

UPDATE_STRATEGIES = """mutation ($strategies: [AuthenticationStrategyInput]!) {
  authentication {
    updateStrategies(strategies: $strategies) { responseResult { succeeded message } }
  }
}"""

LIST_GROUPS = "query { groups { list { id name } } }"


def gql(query, variables=None):
    payload = {"query": query}
    if variables is not None:
        payload["variables"] = variables
    body = json.dumps(payload)
    proc = subprocess.run(
        [
            "curl",
            "-sS",
            "-X",
            "POST",
            f"{WIKI_URL}/graphql",
            "-H",
            "Content-Type: application/json",
            "-H",
            f"Authorization: Bearer {JWT}",
            "-d",
            body,
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    data = json.loads(proc.stdout)
    if data.get("errors"):
        for e in data["errors"]:
            print(e.get("message", e), file=sys.stderr)
        sys.exit(1)

    def walk(o):
        if isinstance(o, dict):
            if "responseResult" in o and o["responseResult"].get("succeeded") is False:
                print(o["responseResult"].get("message", "unknown error"), file=sys.stderr)
                sys.exit(1)
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for i in o:
                walk(i)

    walk(data)
    return data


def page_rule(name, path, perms):
    return {
        "id": f"{name}-{path}",
        "deny": False,
        "match": "START",
        "path": path,
        "locales": [],
        "roles": perms,
    }


def cfg(v):
    return json.dumps({"v": v})


listed = gql(LIST_GROUPS)["data"]["groups"]["list"]
by_name = {g["name"]: g["id"] for g in listed}

for name, path, kind in GROUPS:
    if name not in by_name:
        gql(CREATE_GROUP, {"name": name})
        listed = gql(LIST_GROUPS)["data"]["groups"]["list"]
        by_name = {g["name"]: g["id"] for g in listed}
    perms = READ_PERMS if kind == "read" else WRITE_PERMS
    rule = page_rule(name, path, perms)
    gql(
        UPDATE_GROUP,
        {
            "id": by_name[name],
            "name": name,
            "redirectOnLogin": "",
            "permissions": perms,
            "pageRules": [rule],
        },
    )

guests_id = by_name.get("Guests")
if guests_id is None:
    listed = gql(LIST_GROUPS)["data"]["groups"]["list"]
    by_name = {g["name"]: g["id"] for g in listed}
    guests_id = by_name.get("Guests")
if guests_id is None:
    print("Grupo Guests não encontrado", file=sys.stderr)
    sys.exit(1)

gql(
    UPDATE_GROUP,
    {
        "id": guests_id,
        "name": "Guests",
        "redirectOnLogin": "",
        "permissions": [],
        "pageRules": [],
    },
)

gql(UPDATE_SITE, {"host": SITE_URL, "authHideLocal": True})

oidc_config = [
    {"key": "clientId", "value": cfg("wiki")},
    {"key": "clientSecret", "value": cfg(WIKI_OIDC_SECRET)},
    {
        "key": "authorizationURL",
        "value": cfg(f"http://{INTRANET_IP}/authentik/application/o/wiki/authorize/"),
    },
    {
        "key": "tokenURL",
        "value": cfg("http://authentik:9000/authentik/application/o/wiki/token/"),
    },
    {
        "key": "userInfoURL",
        "value": cfg("http://authentik:9000/authentik/application/o/wiki/userinfo/"),
    },
    {"key": "skipUserProfile", "value": cfg(False)},
    {"key": "issuer", "value": cfg(f"http://{INTRANET_IP}/authentik/application/o/wiki/")},
    {"key": "emailClaim", "value": cfg("email")},
    {"key": "displayNameClaim", "value": cfg("name")},
    {"key": "pictureClaim", "value": cfg("picture")},
    {"key": "mapGroups", "value": cfg(True)},
    {"key": "groupsClaim", "value": cfg("groups")},
    {"key": "logoutURL", "value": cfg("")},
    {"key": "acrValues", "value": cfg("")},
]

strategies = [
    {
        "key": "local",
        "strategyKey": "local",
        "displayName": "Local",
        "order": 0,
        "isEnabled": True,
        "selfRegistration": False,
        "domainWhitelist": [],
        "autoEnrollGroups": [],
        "config": [],
    },
    {
        "key": "wiki",
        "strategyKey": "oidc",
        "displayName": "Authentik",
        "order": 1,
        "isEnabled": True,
        "selfRegistration": False,
        "domainWhitelist": [],
        "autoEnrollGroups": [],
        "config": oidc_config,
    },
]

gql(UPDATE_STRATEGIES, {"strategies": strategies})
PY