#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SETUP_SRC="$ROOT/deploy/setup.sh"
UPDATE_SRC="$ROOT/deploy/update.sh"

# --- 1. setup.sh ---
tmpdir_a="$(mktemp -d)"
tmpdir_b=""
trap 'rm -rf "$tmpdir_a" ${tmpdir_b:+"$tmpdir_b"} 2>/dev/null' EXIT
mkdir -p "$tmpdir_a/deploy"
cp "$SETUP_SRC" "$tmpdir_a/deploy/setup.sh"

out="$(INTRANET_IP=10.0.0.8 AUTHENTIK_ADMIN_PASSWORD=secret bash "$tmpdir_a/deploy/setup.sh" 2>&1)"
status=$?
[[ $status -eq 0 ]] || { echo "setup: expected exit 0, got $status" >&2; echo "$out"; exit 1; }

mode="$(stat -c %a "$tmpdir_a/deploy/.env")"
[[ "$mode" == "600" ]] || { echo "setup: expected mode 600, got $mode" >&2; exit 1; }

grep -qx 'INTRANET_IP=10.0.0.8' "$tmpdir_a/deploy/.env" || {
  echo "setup: INTRANET_IP line mismatch" >&2
  exit 1
}

postgres_pw="$(grep '^POSTGRES_PASSWORD=' "$tmpdir_a/deploy/.env" | cut -d= -f2-)"
session_secret="$(grep '^SESSION_SECRET=' "$tmpdir_a/deploy/.env" | cut -d= -f2-)"
[[ -n "$postgres_pw" ]] || { echo "setup: POSTGRES_PASSWORD empty" >&2; exit 1; }
[[ -n "$session_secret" ]] || { echo "setup: SESSION_SECRET empty" >&2; exit 1; }

if grep -qF "$postgres_pw" <<<"$out"; then
  echo "setup: stdout leaked POSTGRES_PASSWORD" >&2
  exit 1
fi

saved="$(cat "$tmpdir_a/deploy/.env")"
err="$(INTRANET_IP=10.0.0.8 AUTHENTIK_ADMIN_PASSWORD=secret bash "$tmpdir_a/deploy/setup.sh" 2>&1 >/dev/null)" || status=$?
status=${status:-0}
[[ $status -ne 0 ]] || { echo "setup: second run expected non-zero exit" >&2; exit 1; }
grep -q 'já existe' <<<"$err" || { echo "setup: stderr missing já existe" >&2; echo "$err"; exit 1; }
[[ "$(cat "$tmpdir_a/deploy/.env")" == "$saved" ]] || {
  echo "setup: .env changed on second run" >&2
  exit 1
}

# --- 2. update.sh ---
tmpdir_b="$(mktemp -d)"
mkdir -p "$tmpdir_b/deploy/backups"
git -C "$tmpdir_b" init -q
cp "$UPDATE_SRC" "$tmpdir_b/deploy/update.sh"
printf 'services: {}\n' >"$tmpdir_b/deploy/compose.yml"
umask 077
printf 'INTRANET_IP=10.0.0.8\nPOSTGRES_PASSWORD=test\n' >"$tmpdir_b/deploy/.env"
chmod 600 "$tmpdir_b/deploy/.env"
env_checksum="$(cksum "$tmpdir_b/deploy/.env" | awk '{print $1 " " $2}')"

for n in 1 2 3 4 5 6; do
  f="$tmpdir_b/deploy/backups/authentik-2000010100000${n}.sql"
  printf 'old %s\n' "$n" >"$f"
  touch -d "2000-01-0${n} 00:00:00" "$f"
done

fakebin="$(mktemp -d)"
cat >"$fakebin/docker" <<'FAKE'
#!/usr/bin/env bash
args=("$@")
joined="${args[*]}"
if [[ "$joined" == *exec* ]]; then
  for a in "${args[@]}"; do
    if [[ "$a" == --dbname=* ]]; then
      echo "dump ${a#--dbname=}"
      exit 0
    fi
  done
  echo "exec without --dbname=" >&2
  exit 1
fi
if [[ "$joined" == *up* ]] && [[ "$joined" == *-d* ]]; then
  exit 0
fi
if [[ "$joined" == *ps* ]]; then
  echo unhealthy
  exit 0
fi
printf '%s\n' "${args[@]}" >&2
exit 1
FAKE
chmod +x "$fakebin/docker"

combined="$(
  INTRANET_SKIP_PULL=1 PATH="$fakebin:$PATH" bash "$tmpdir_b/deploy/update.sh" 2>&1
)" || upd_status=$?
upd_status=${upd_status:-0}
[[ $upd_status -eq 1 ]] || { echo "update: expected exit 1, got $upd_status" >&2; echo "$combined"; exit 1; }
grep -q 'deploy/backups/' <<<"$combined" || {
  echo "update: output missing deploy/backups/" >&2
  echo "$combined"
  exit 1
}

new_checksum="$(cksum "$tmpdir_b/deploy/.env" | awk '{print $1 " " $2}')"
[[ "$new_checksum" == "$env_checksum" ]] || {
  echo "update: .env checksum changed" >&2
  exit 1
}

count="$(find "$tmpdir_b/deploy/backups" -maxdepth 1 -type f -name 'authentik-*.sql' | wc -l)"
[[ "$count" -eq 5 ]] || { echo "update: expected 5 authentik backups, got $count" >&2; exit 1; }

found_dump=0
while IFS= read -r f; do
  if grep -qx 'dump authentik' "$f"; then
    found_dump=1
    break
  fi
done < <(find "$tmpdir_b/deploy/backups" -maxdepth 1 -type f -name 'authentik-*.sql')
[[ $found_dump -eq 1 ]] || { echo "update: no dump authentik line" >&2; exit 1; }

rm -rf "$fakebin"

echo OK setup.test.sh