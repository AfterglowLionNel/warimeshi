#!/bin/bash
set -e

DUMP_FILE="/tmp/warimeshi.dump"

if [ ! -f "$DUMP_FILE" ]; then
  echo "[init] $DUMP_FILE が見つからないため復元をスキップします"
  exit 0
fi

echo "[init] warimeshi.dump を $POSTGRES_DB に復元します..."
pg_restore \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --no-owner \
  --no-privileges \
  --clean --if-exists \
  --exit-on-error \
  "$DUMP_FILE"

echo "[init] 復元完了"
