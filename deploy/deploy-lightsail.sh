#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# RestroGenie — one-shot deploy on a fresh AWS Lightsail (Ubuntu 22.04+) box.
# Run ON the Lightsail instance:
#   curl -fsSL <repo>/deploy/deploy-lightsail.sh -o deploy.sh && bash deploy.sh
# or after `git clone`:  bash deploy/deploy-lightsail.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/restrogenic}"
REPO_OWNER="${REPO_OWNER:-DJO1122}"
REPO_NAME="${REPO_NAME:-restrogenic}"
# PRIVATE repo? Set REPO_TOKEN to a fine-grained GitHub PAT with "Contents: Read"
# for this repo:  REPO_TOKEN=github_pat_xxx bash deploy/deploy-lightsail.sh
if [ -n "${REPO_TOKEN:-}" ]; then
  REPO_URL="https://x-access-token:${REPO_TOKEN}@github.com/${REPO_OWNER}/${REPO_NAME}.git"
else
  REPO_URL="${REPO_URL:-https://github.com/${REPO_OWNER}/${REPO_NAME}.git}"
fi

echo "==> 1/5  Installing Docker + Compose (if missing)"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER" || true
fi
# docker compose v2 ships with the Docker install above.

echo "==> 2/5  Fetching the code"
if [ ! -d "$REPO_DIR/.git" ]; then
  git clone "$REPO_URL" "$REPO_DIR"
else
  git -C "$REPO_DIR" pull --ff-only
fi
cd "$REPO_DIR/deploy"

echo "==> 3/5  Environment"
if [ ! -f .env.prod ]; then
  cp .env.prod.example .env.prod
  # auto-generate strong secrets if openssl is present
  if command -v openssl >/dev/null 2>&1; then
    sed -i "s|replace-with-64-char-random-hex|$(openssl rand -hex 32)|" .env.prod
    sed -i "s|replace-with-a-DIFFERENT-64-char-random-hex|$(openssl rand -hex 32)|" .env.prod
    sed -i "s|change-me-to-a-long-random-password|$(openssl rand -hex 16)|" .env.prod
  fi
  echo "    .env.prod created — EDIT IT NOW to set your DOMAIN, then re-run this script."
  echo "    nano .env.prod"
  exit 0
fi

echo "==> 4/5  Building & starting the stack (Postgres + API + Web + Caddy)"
sudo docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

echo "==> 5/5  Done. Status:"
sudo docker compose -f docker-compose.prod.yml ps

cat <<'EOF'

────────────────────────────────────────────────────────────────────────────
✅ Stack is up. Final checklist:
  • Point DNS (A records) for  yourpos.com, www, api  → this box's STATIC IP
  • Caddy auto-issues HTTPS certs once DNS resolves (give it ~1 min)
  • App:        https://yourpos.com
  • API health: https://api.yourpos.com/api/admin/plans  (needs admin token)
  • Super-admin login:  admin@restrogenic.cloud / admin123  (CHANGE THIS!)
  • After first boot, set SEED_ON_BOOT=false in .env.prod and `up -d` again.
Backups: enable Lightsail automatic snapshots in the AWS console.
────────────────────────────────────────────────────────────────────────────
EOF
