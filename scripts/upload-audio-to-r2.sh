#!/usr/bin/env bash
# =============================================================================
# upload-audio-to-r2.sh
# Uploads every file in audio-mp3/ to the cantmute-audio R2 bucket.
# Run from the repo root: bash scripts/upload-audio-to-r2.sh
# Requires: wrangler installed + `wrangler login` already run.
# Idempotent: safe to re-run; uploads overwrite existing objects.
# =============================================================================

set -e

BUCKET="cantmute-audio"
SOURCE_DIR="audio-mp3"

if [ ! -d "$SOURCE_DIR" ]; then
  echo "ERROR: $SOURCE_DIR not found. Run from repo root."
  exit 1
fi

if ! command -v wrangler >/dev/null 2>&1; then
  echo "ERROR: wrangler not on PATH. Run: npm install -g wrangler"
  exit 1
fi

TOTAL=$(ls "$SOURCE_DIR" | wc -l | tr -d ' ')
COUNT=0
FAILED=0

echo "Uploading $TOTAL files from $SOURCE_DIR/ to R2 bucket '$BUCKET'..."
echo

for file in "$SOURCE_DIR"/*; do
  COUNT=$((COUNT + 1))
  name=$(basename "$file")
  printf "[%3d/%3d] %s ... " "$COUNT" "$TOTAL" "$name"

  if wrangler r2 object put "$BUCKET/$name" \
       --file "$file" \
       --content-type "audio/mpeg" \
       --remote >/dev/null 2>&1; then
    echo "OK"
  else
    echo "FAILED"
    FAILED=$((FAILED + 1))
  fi
done

echo
echo "Done. $((COUNT - FAILED))/$TOTAL uploaded successfully."
if [ "$FAILED" -gt 0 ]; then
  echo "WARNING: $FAILED files failed. Re-run the script — successful uploads will be overwritten harmlessly."
  exit 1
fi
