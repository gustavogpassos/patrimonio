#!/usr/bin/env bash
set -euo pipefail

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }

root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

target="$tmpdir/delegate.sh"
printf '%s\n' '#!/usr/bin/env bash' 'printf delegated' >"$target"
chmod +x "$target"

cd "$root"
out="$(PATRIMONIO_INSTALL_TARGET="$target" bash "$root/install.sh" 2>&1)" || fail "install.sh exited non-zero"
code=$?
[[ "$code" -eq 0 ]] || fail "exit code want 0, got $code"
[[ "$out" == "delegated" ]] || fail "stdout want 'delegated', got '$out'"

printf 'OK install-wrapper.test.sh\n'