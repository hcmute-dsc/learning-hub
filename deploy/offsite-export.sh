#!/usr/bin/env bash
# Weekly encrypted copy of the database backup, for keeping outside the VPS
# (deploy/README.md, "Chép bản sao lưu ra ngoài VPS").
# Cron (as the learnhub user), Sunday 20:00 UTC = Monday 03:00 Vietnam time,
# after the daily backup.sh at 19:30 UTC:
#   0 20 * * 0 /opt/learning-hub/offsite-export.sh >> /opt/learning-hub/backups/offsite.log 2>&1
#
# Encrypts the newest daily dump with `age` to the public keys in offsite-recipients.txt
# (the VPS never holds a key that can decrypt it) into backups/offsite/, and keeps the
# newest KEEP_COPIES copies there. The tech lead's machine pulls them through the
# restricted SSH key served by offsite-serve.sh (deploy/offsite-pull.ps1).
set -euo pipefail

DIR=${LH_DIR:-/opt/learning-hub}
KEEP_COPIES=${KEEP_COPIES:-4}
RECIPIENTS=${RECIPIENTS:-$DIR/offsite-recipients.txt}
SRC="$DIR/backups"
OUT="$SRC/offsite"
DUMP_RE='^learning_hub-[0-9]{8}-[0-9]{6}\.sql\.gz$'
COPY_RE='^learning_hub-[0-9]{8}-[0-9]{6}\.sql\.gz\.age$'
# Copies hold members' emails (encrypted): readable by the learnhub user only.
umask 077

log() { echo "$(date -u +%FT%TZ) $*"; }
fail() {
  log "offsite FAILED: $*"
  exit 1
}

[[ $KEEP_COPIES =~ ^[1-9][0-9]*$ ]] || fail "KEEP_COPIES must be a positive number, got '$KEEP_COPIES'"
command -v age >/dev/null || fail "age is not installed (an admin runs: sudo apt install age)"
grep -q '^age1' "$RECIPIENTS" 2>/dev/null || fail "no age public key in $RECIPIENTS"

# Dump names sort by their UTC timestamp, so the last one is the newest.
latest=$(find "$SRC" -maxdepth 1 -type f -printf '%f\n' | grep -E "$DUMP_RE" | sort | tail -n 1 || true)
[ -n "$latest" ] || fail "no daily backup in $SRC: is backup.sh running?"
[ -z "$(find "$SRC/$latest" -mmin +2880)" ] || fail "newest backup $latest is older than 2 days: is backup.sh running?"
gzip -t "$SRC/$latest" 2>/dev/null || fail "$latest is not a valid gzip file"

mkdir -p "$OUT"
chmod 700 "$OUT"
rm -f "$OUT"/*.tmp
target="$OUT/$latest.age"
if [ -e "$target" ]; then
  log "offsite skip: $latest.age already exists"
else
  age -R "$RECIPIENTS" -o "$target.tmp" "$SRC/$latest" || fail "age could not encrypt $latest"
  mv "$target.tmp" "$target"
  log "offsite ok: $target ($(du -h "$target" | cut -f1))"
fi

find "$OUT" -maxdepth 1 -type f -printf '%f\n' | grep -E "$COPY_RE" | sort -r |
  tail -n +"$((KEEP_COPIES + 1))" | while read -r old; do
  rm -f -- "${OUT:?}/$old"
  log "offsite pruned: $old"
done
