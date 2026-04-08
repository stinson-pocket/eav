#!/usr/bin/env bash
# Usage: ./set_github_secrets.sh <owner/repo>
# Requires: gh (GitHub CLI) authenticated
set -euo pipefail
REPO="$1"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh (GitHub CLI) is required. Install and run 'gh auth login' first." >&2
  exit 2
fi

echo "Setting recommended secrets for ${REPO}. You will be prompted for values."
read -p "WP_SITE (e.g. https://eastatlantavillage.com): " WP_SITE
read -p "WP_USER: " WP_USER
read -p "WP_APP_PASSWORD: " WP_APP_PASSWORD
read -p "DISCORD_WEBHOOK_URL (leave blank to skip): " DISCORD_WEBHOOK_URL
read -p "TELEGRAM_BOT_TOKEN (leave blank to skip): " TELEGRAM_BOT_TOKEN
read -p "TELEGRAM_CHAT_ID (leave blank to skip): " TELEGRAM_CHAT_ID
read -p "ADMIN_EMAIL (signup06@gmail.com): " ADMIN_EMAIL
read -p "GDRIVE_FOLDER_ID (leave blank to skip): " GDRIVE_FOLDER_ID

gh secret set WP_SITE --body "$WP_SITE" --repo "$REPO"
gh secret set WP_USER --body "$WP_USER" --repo "$REPO"
gh secret set WP_APP_PASSWORD --body "$WP_APP_PASSWORD" --repo "$REPO"
if [ -n "$DISCORD_WEBHOOK_URL" ]; then gh secret set DISCORD_WEBHOOK_URL --body "$DISCORD_WEBHOOK_URL" --repo "$REPO"; fi
if [ -n "$TELEGRAM_BOT_TOKEN" ]; then gh secret set TELEGRAM_BOT_TOKEN --body "$TELEGRAM_BOT_TOKEN" --repo "$REPO"; fi
if [ -n "$TELEGRAM_CHAT_ID" ]; then gh secret set TELEGRAM_CHAT_ID --body "$TELEGRAM_CHAT_ID" --repo "$REPO"; fi
if [ -n "$ADMIN_EMAIL" ]; then gh secret set ADMIN_EMAIL --body "$ADMIN_EMAIL" --repo "$REPO"; fi
if [ -n "$GDRIVE_FOLDER_ID" ]; then gh secret set GDRIVE_FOLDER_ID --body "$GDRIVE_FOLDER_ID" --repo "$REPO"; fi

echo "Secrets set. For GDrive service account JSON, paste the BASE64 of the JSON and run: gh secret set GDRIVE_SERVICE_ACCOUNT_JSON --body '<base64>' --repo ${REPO}" 
