#!/usr/bin/env bash
# Runs on the VPS (sent over ssh by Ansible from Semaphore). Pulls the monorepo, installs dependencies, restarts
# trackboard-backend, and waits for /api/health.
set -euo pipefail

TRACKBOARD_DIR="${TRACKBOARD_DIR:-$HOME/trackboard}"
BUN="${BUN:-/usr/local/bin/bun}"

# `bun install` can rewrite bun.lock on the server (a newer bun). That is never a deliberate edit, and a dirty lockfile
# makes the next `git pull --ff-only` refuse. Drop it first.
echo "==> pull"
cd "$TRACKBOARD_DIR"
git checkout -- trackboard-packages/bun.lock trackboard-be/bun.lock 2>/dev/null || true
git pull --ff-only

echo "==> trackboard-packages"
cd "$TRACKBOARD_DIR/trackboard-packages"
"$BUN" install --frozen-lockfile || "$BUN" install

echo "==> trackboard-be"
cd "$TRACKBOARD_DIR/trackboard-be"
"$BUN" install --frozen-lockfile || "$BUN" install

echo "==> restart trackboard-backend"
sudo systemctl restart trackboard-backend.service

echo "==> health"
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3400/api/health; then
    echo
    echo "deploy ok: $(git -C "$TRACKBOARD_DIR" rev-parse --short HEAD)"
    exit 0
  fi
  sleep 2
done

echo "health check failed; recent logs:" >&2
sudo journalctl -u trackboard-backend -n 40 --no-pager >&2
exit 1
