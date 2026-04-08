#!/usr/bin/env bash
# Usage: ./push_to_github.sh <github-owner> <repo-name>
# Requires: git, gh (GitHub CLI) authenticated, and this workspace checked out
set -euo pipefail
OWNER="$1"
REPO="$2"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh (GitHub CLI) is required. Install and run 'gh auth login' first." >&2
  exit 2
fi

git init || true
git add -A
git commit -m "Add eav monitoring and automation" || echo "Nothing to commit"

if gh repo view "${OWNER}/${REPO}" >/dev/null 2>&1; then
  echo "Repository ${OWNER}/${REPO} exists. Setting remote and pushing..."
  git remote remove origin 2>/dev/null || true
  git remote add origin "https://github.com/${OWNER}/${REPO}.git"
else
  echo "Creating repository ${OWNER}/${REPO} under ${OWNER}..."
  gh repo create "${OWNER}/${REPO}" --public --confirm
fi

git branch -M main
git push -u origin main --force
echo "Pushed to https://github.com/${OWNER}/${REPO}" 
