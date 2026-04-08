#!/usr/bin/env bash
# Test the Drive upload script locally.
# Usage: ./test_drive_upload.sh <path-to-service-account-json> <gdrive-folder-id>
set -euo pipefail
KEY_JSON_PATH="$1"
FOLDER_ID="$2"

if [ ! -f "$KEY_JSON_PATH" ]; then
  echo "Service account JSON not found: $KEY_JSON_PATH" >&2
  exit 2
fi

export GDRIVE_SERVICE_ACCOUNT_JSON=$(base64 --wrap=0 "$KEY_JSON_PATH")
export GDRIVE_FOLDER_ID="$FOLDER_ID"

node scripts/upload_to_drive.js
