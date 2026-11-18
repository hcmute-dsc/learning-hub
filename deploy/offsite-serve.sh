#!/usr/bin/env bash
# Forced command for the backup-pull SSH key (deploy/README.md, "Chép bản sao lưu ra ngoài VPS").
# The key's line in /home/learnhub/.ssh/authorized_keys starts with:
#   restrict,command="/opt/learning-hub/offsite-serve.sh" ssh-ed25519 AAAA… learning-hub-backup-pull
# Whatever the client asks, this key can only list and download the encrypted copies in
# backups/offsite/. It cannot open a shell, read .env or read the unencrypted dumps.
#   ssh learnhub-backup list          one file name per line
#   ssh learnhub-backup get <name>    the file's bytes on stdout
set -euo pipefail

DIR=${LH_DIR:-/opt/learning-hub}
OUT="$DIR/backups/offsite"
COPY_RE='^learning_hub-[0-9]{8}-[0-9]{6}\.sql\.gz\.age$'

cmd=${SSH_ORIGINAL_COMMAND:-}
case "$cmd" in
  list)
    [ -d "$OUT" ] || exit 0
    find "$OUT" -maxdepth 1 -type f -printf '%f\n' | grep -E "$COPY_RE" | sort || true
    ;;
  "get "*)
    name=${cmd#get }
    [[ $name =~ $COPY_RE ]] || {
      echo "offsite-serve: bad file name" >&2
      exit 2
    }
    [ -f "$OUT/$name" ] || {
      echo "offsite-serve: no such copy: $name" >&2
      exit 3
    }
    cat -- "$OUT/$name"
    ;;
  *)
    echo "offsite-serve: only 'list' and 'get <name>' are allowed" >&2
    exit 2
    ;;
esac
