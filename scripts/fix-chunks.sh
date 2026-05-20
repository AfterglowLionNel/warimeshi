#!/bin/bash
# Fix Turbopack chunk hash mismatch bug in Next.js 16
# The build generates chunks with one hash, but the server references them with different hashes.
# This script starts the server temporarily, detects mismatched chunks, and creates symlinks.

set -e

# プロジェクトルート (このスクリプトの親ディレクトリ) からの相対パスで解決する
# 必要なら NEXT_DIR を環境変数で上書き可能
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
NEXT_DIR="${NEXT_DIR:-$PROJECT_ROOT/.next}"
CHUNKS_DIR="$NEXT_DIR/static/chunks"

# Fix empty prerender-manifest.json (another Turbopack bug)
if [ ! -s "$NEXT_DIR/prerender-manifest.json" ]; then
  echo '{"version":4,"routes":{},"dynamicRoutes":{},"notFoundRoutes":[],"preview":{"previewModeId":"","previewModeSigningKey":"","previewModeEncryptionKey":""}}' > "$NEXT_DIR/prerender-manifest.json"
  echo "Fixed empty prerender-manifest.json"
fi

# Start server on a temp port to get the actual chunk references
TEMP_PORT=3099
pnpm next start --port $TEMP_PORT > /dev/null 2>&1 &
SERVER_PID=$!
sleep 6

# Get chunk references from the served HTML
MISSING=()
while IFS= read -r chunk; do
  if [ ! -e "$CHUNKS_DIR/$chunk" ]; then
    MISSING+=("$chunk")
  fi
done < <(curl -s "http://localhost:$TEMP_PORT" | grep -oP '/_next/static/chunks/[^"\\]+' | sed 's|/_next/static/chunks/||' | sort -u)

kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null || true

if [ ${#MISSING[@]} -eq 0 ]; then
  echo "All chunks are present. No fix needed."
  exit 0
fi

# Get correct chunk paths from the client-reference-manifest
MANIFEST="$NEXT_DIR/server/app/page_client-reference-manifest.js"
if [ ! -f "$MANIFEST" ]; then
  echo "ERROR: Cannot find client-reference-manifest"
  exit 1
fi

# Extract CSS and JS entries from the manifest
MANIFEST_CSS=$(grep -oP '"path":"static/chunks/[^"]+\.css"' "$MANIFEST" | grep -oP '[a-f0-9]+\.css' | sort -u)
MANIFEST_JS=$(grep -oP '"static/chunks/[^"]+\.js"' "$MANIFEST" | grep -oP '[a-f0-9]+\.js' | sort -u)

for missing in "${MISSING[@]}"; do
  ext="${missing##*.}"
  if [ "$ext" = "css" ]; then
    # Find CSS that exists on disk but is NOT in the HTML
    for css in $MANIFEST_CSS; do
      if [ -f "$CHUNKS_DIR/$css" ]; then
        ln -sf "$css" "$CHUNKS_DIR/$missing"
        echo "Symlinked: $missing -> $css"
        break
      fi
    done
  elif [ "$ext" = "js" ]; then
    # For JS, find a chunk on disk that's in the manifest but NOT referenced in HTML
    # The missing JS chunk is the page-specific chunk
    for js in $MANIFEST_JS; do
      if [ -f "$CHUNKS_DIR/$js" ] && [ ! -L "$CHUNKS_DIR/$js" ]; then
        # Check if this chunk is already referenced in HTML
        if ! curl -s "http://localhost:$TEMP_PORT" 2>/dev/null | grep -q "$js"; then
          ln -sf "$js" "$CHUNKS_DIR/$missing"
          echo "Symlinked: $missing -> $js"
          break
        fi
      fi
    done
  fi
done

echo "Chunk fix complete."
