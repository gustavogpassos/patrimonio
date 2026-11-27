#!/usr/bin/env bash
set -euo pipefail

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }

assert_eq() {
  local file="$1" expect="$2" label="$3"
  [[ -f "$file" ]] || fail "$label: missing $file"
  local got
  got="$(cat "$file")"
  [[ "$got" == "$expect" ]] || fail "$label: want '$expect', got '$got'"
}

repo="$(mktemp -d)"
trap 'rm -rf "$repo"' EXIT

git -C "$repo" init -q
mkdir -p "$repo/data"
printf 'legacy' >"$repo/data/patrimonio.db"
printf 'wal' >"$repo/data/patrimonio.db-wal"

script_src="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/install.sh"
mkdir -p "$repo/apps/patrimonio"
cp "$script_src" "$repo/apps/patrimonio/install.sh"

PATRIMONIO_TEST_ADOPT=1 bash "$repo/apps/patrimonio/install.sh" "$repo/apps/patrimonio"

assert_eq "$repo/apps/patrimonio/data/patrimonio.db" legacy "copied db"
assert_eq "$repo/apps/patrimonio/data/patrimonio.db-wal" wal "copied wal"
assert_eq "$repo/data/patrimonio.db" legacy "original db unchanged"

printf 'kept' >"$repo/apps/patrimonio/data/patrimonio.db"
PATRIMONIO_TEST_ADOPT=1 bash "$repo/apps/patrimonio/install.sh" "$repo/apps/patrimonio"
assert_eq "$repo/apps/patrimonio/data/patrimonio.db" kept "no clobber on second run"

printf 'OK install-legacy-db.test.sh\n'