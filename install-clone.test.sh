#!/usr/bin/env bash
set -euo pipefail

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }

root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/bin" "$TMP/wrapper" "$TMP/home" "$TMP/home2"
cp "$root/install.sh" "$TMP/wrapper/install.sh"
[[ ! -f "$TMP/wrapper/apps/patrimonio/install.sh" ]] || fail "wrapper must not ship apps/patrimonio/install.sh"

cat >"$TMP/bin/git" <<'GIT'
#!/usr/bin/env bash
if [[ "${1:-}" == clone ]]; then
  dest="${@: -1}"
  mkdir -p "${dest}/apps/patrimonio"
  cat >"${dest}/apps/patrimonio/install.sh" <<'INNER'
#!/bin/bash
printf '%s\n' cloned
INNER
  chmod +x "${dest}/apps/patrimonio/install.sh"
  exit 0
fi
exit 1
GIT
chmod +x "$TMP/bin/git"

opt_before=0
[[ -e /opt/patrimonio ]] && opt_before=1

out="$(HOME="$TMP/home" PATH="$TMP/bin:$PATH" bash "$TMP/wrapper/install.sh" 2>&1)" || fail "direct run exited non-zero"
last="$(printf '%s\n' "$out" | tail -n 1)"
[[ "$last" == cloned ]] || fail "direct run: last stdout line want cloned, got '$last'"
[[ -f "$TMP/home/patrimonio/apps/patrimonio/install.sh" ]] || fail "direct run: cloned install.sh missing"
if [[ "$opt_before" -eq 0 ]]; then
  [[ ! -e /opt/patrimonio ]] || fail "direct run: /opt/patrimonio must not exist"
fi

out="$(HOME="$TMP/home2" PATH="$TMP/bin:$PATH" bash -s <"$TMP/wrapper/install.sh" 2>&1)" || fail "piped run exited non-zero"
last="$(printf '%s\n' "$out" | tail -n 1)"
[[ "$last" == cloned ]] || fail "piped run: last stdout line want cloned, got '$last'"
[[ -f "$TMP/home2/patrimonio/apps/patrimonio/install.sh" ]] || fail "piped run: cloned install.sh missing"
if [[ "$opt_before" -eq 0 ]]; then
  [[ ! -e /opt/patrimonio ]] || fail "piped run: /opt/patrimonio must not exist"
fi

printf 'OK install-clone.test.sh\n'