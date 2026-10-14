#!/usr/bin/env bash
# Daily dump of the trackboard database (cron on the VPS). Keeps the last 7 days. The uploaded files in
# /var/lib/trackboard/files are plain files and are backed up with the server's own snapshots.
set -euo pipefail

DIR="${BACKUP_DIR:-$HOME/backups/trackboard}"
KEEP_DAYS="${KEEP_DAYS:-7}"
mkdir -p "$DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$DIR/trackboard-$STAMP.sql.gz"

# Peer auth as the postgres superuser keeps the password out of the process list and the cron line.
sudo -u postgres pg_dump --no-owner trackboard | gzip -9 > "$OUT.tmp"
mv "$OUT.tmp" "$OUT"
find "$DIR" -name 'trackboard-*.sql.gz' -mtime "+$KEEP_DAYS" -delete
echo "backup ok: $OUT ($(du -h "$OUT" | cut -f1))"
