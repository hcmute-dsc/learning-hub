#!/usr/bin/env bash
# Tests for offsite-export.sh and offsite-serve.sh (deploy/README.md, "Chép bản sao lưu ra ngoài VPS").
# Needs bash, gzip, GNU find and age (CI: sudo apt-get install -y age). Run: bash deploy/test/offsite.test.sh
set -uo pipefail

HERE=$(cd "$(dirname "$0")/.." && pwd)
EXPORT="$HERE/offsite-export.sh"
SERVE="$HERE/offsite-serve.sh"
fails=0
pass() { echo "ok   $*"; }
bad() {
  echo "FAIL $*"
  fails=$((fails + 1))
}
check() { # check <description> <command…>
  local what=$1
  shift
  if "$@"; then pass "$what"; else bad "$what"; fi
}

new_dir() {
  local d
  d=$(mktemp -d)
  mkdir -p "$d/backups"
  age-keygen -o "$d/key.txt" 2>/dev/null
  age-keygen -y "$d/key.txt" >"$d/offsite-recipients.txt"
  echo "$d"
}
dump() { # dump <dir> <timestamp> [age-of-file]
  echo "select $2;" | gzip >"$1/backups/learning_hub-$2.sql.gz"
  [ -z "${3:-}" ] || touch -d "$3" "$1/backups/learning_hub-$2.sql.gz"
}
run_export() { LH_DIR=$1 bash "$EXPORT" >"$1/out.log" 2>&1; }
copies() { find "$1/backups/offsite" -maxdepth 1 -type f -name '*.age' -printf '%f\n' 2>/dev/null | sort | tr '\n' ' '; }

# --- export: encrypts only the newest dump, and the key can decrypt it
d=$(new_dir)
dump "$d" 20261101-193000 "2 hours ago"
dump "$d" 20261102-193000
check "export succeeds" run_export "$d"
check "only the newest dump is copied" [ "$(copies "$d")" = "learning_hub-20261102-193000.sql.gz.age " ]
check "copy decrypts to the original dump" cmp -s \
  <(age -d -i "$d/key.txt" "$d/backups/offsite/learning_hub-20261102-193000.sql.gz.age") \
  "$d/backups/learning_hub-20261102-193000.sql.gz"
check "offsite folder is private (700)" [ "$(stat -c %a "$d/backups/offsite")" = 700 ]
check "copy is private (600)" [ "$(stat -c %a "$d/backups/offsite/learning_hub-20261102-193000.sql.gz.age")" = 600 ]
check "copy is not plain gzip" bash -c "! gzip -t '$d/backups/offsite/learning_hub-20261102-193000.sql.gz.age' 2>/dev/null"

# --- export: running twice for the same dump keeps one copy
check "second run succeeds" run_export "$d"
check "second run skips" grep -q "offsite skip" "$d/out.log"
check "still one copy" [ "$(copies "$d")" = "learning_hub-20261102-193000.sql.gz.age " ]

# --- export: keeps the newest KEEP_COPIES copies by name, ignores other files
for t in 20261005-193000 20261012-193000 20261019-193000 20261026-193000; do
  echo old >"$d/backups/offsite/learning_hub-$t.sql.gz.age"
done
echo notes >"$d/backups/offsite/README.txt"
check "export with 5 copies succeeds" env KEEP_COPIES=3 LH_DIR="$d" bash "$EXPORT" >/dev/null
check "keeps the newest 3" [ "$(copies "$d")" = \
  "learning_hub-20261019-193000.sql.gz.age learning_hub-20261026-193000.sql.gz.age learning_hub-20261102-193000.sql.gz.age " ]
check "other files are left alone" [ -f "$d/backups/offsite/README.txt" ]

# --- export: refuses bad input instead of copying something useless
d2=$(new_dir)
dump "$d2" 20261102-193000 "3 days ago"
check "stale newest dump fails" bash -c "! LH_DIR='$d2' bash '$EXPORT' >'$d2/out.log' 2>&1"
check "stale dump is reported" grep -q "older than 2 days" "$d2/out.log"

d3=$(new_dir)
echo "not gzip" >"$d3/backups/learning_hub-20261102-193000.sql.gz"
check "corrupt dump fails" bash -c "! LH_DIR='$d3' bash '$EXPORT' >/dev/null 2>&1"
check "corrupt dump makes no copy" [ -z "$(copies "$d3")" ]

d4=$(new_dir)
dump "$d4" 20261102-193000
: >"$d4/offsite-recipients.txt"
check "missing public key fails" bash -c "! LH_DIR='$d4' bash '$EXPORT' >/dev/null 2>&1"

d5=$(new_dir)
check "no dump at all fails" bash -c "! LH_DIR='$d5' bash '$EXPORT' >/dev/null 2>&1"
check "KEEP_COPIES=0 fails" bash -c "! KEEP_COPIES=0 LH_DIR='$d' bash '$EXPORT' >/dev/null 2>&1"

# --- serve: only list and get of a copy name
serve() { SSH_ORIGINAL_COMMAND=$2 LH_DIR=$1 bash "$SERVE"; }
echo "SECRET=1" >"$d/.env"
check "list shows only copies" [ "$(serve "$d" list | tr '\n' ' ')" = \
  "learning_hub-20261019-193000.sql.gz.age learning_hub-20261026-193000.sql.gz.age learning_hub-20261102-193000.sql.gz.age " ]
check "get returns the copy's bytes" cmp -s \
  <(serve "$d" "get learning_hub-20261102-193000.sql.gz.age") \
  "$d/backups/offsite/learning_hub-20261102-193000.sql.gz.age"
check "get of a missing copy fails" bash -c "! SSH_ORIGINAL_COMMAND='get learning_hub-20200101-000000.sql.gz.age' LH_DIR='$d' bash '$SERVE' 2>/dev/null"
for evil in "get ../../.env" "get ../learning_hub-20261102-193000.sql.gz" "get learning_hub-20261102-193000.sql.gz" \
  "cat .env" "" "list; cat .env" "get learning_hub-20261102-193000.sql.gz.age; cat .env"; do
  out=$(serve "$d" "$evil" 2>/dev/null)
  rc=$?
  check "rejects '$evil'" [ "$rc" -ne 0 ] && check "leaks nothing for '$evil'" [ -z "$out" ]
done
d6=$(mktemp -d)
check "list with no offsite folder is empty" [ -z "$(serve "$d6" list)" ]

rm -rf "$d" "$d2" "$d3" "$d4" "$d5" "$d6"
if [ "$fails" -ne 0 ]; then
  echo "$fails test(s) failed"
  exit 1
fi
echo "all offsite tests passed"
