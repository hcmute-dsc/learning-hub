#!/usr/bin/env bash
# Daily database backup on the VPS (deploy/README.md, "Sao lưu").
# Cron (as the learnhub user), 02:30 Vietnam time = 19:30 UTC:
#   30 19 * * * /opt/learning-hub/backup.sh >> /opt/learning-hub/backups/backup.log 2>&1
# Restore: see the README. Keeps the last KEEP_DAYS days.
set -euo pipefail

DIR=/opt/learning-hub
KEEP_DAYS=${KEEP_DAYS:-14}
# Backups hold members' emails: readable by the learnhub user only.
umask 077
mkdir -p "$DIR/backups"
chmod 700 "$DIR/backups"
file="$DIR/backups/learning_hub-$(date -u +%Y%m%d-%H%M%S).sql.gz"

docker compose -f "$DIR/docker-compose.prod.yml" --project-directory "$DIR" exec -T db \
  pg_dump -U hub -d learning_hub --no-owner | gzip > "$file"

find "$DIR/backups" -name 'learning_hub-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date -u +%FT%TZ) backup ok: $file ($(du -h "$file" | cut -f1))"
