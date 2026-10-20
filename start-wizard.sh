#!/usr/bin/env bash
# Ankobia Wizard - set up (first run) and start on macOS or Linux.
# Usage: ./start-wizard.sh [--rebuild] [--no-start]
set -euo pipefail

PORT=3100
URL="http://localhost:$PORT"
cd "$(dirname "$0")"

REBUILD=0
NO_START=0
for arg in "$@"; do
  case "$arg" in
    --rebuild) REBUILD=1 ;;
    --no-start) NO_START=1 ;;
  esac
done

step() { printf '\n==> %s\n' "$1"; }
fail() { printf '\nERROR: %s\n' "$1" >&2; exit 1; }

echo "Ankobia Wizard"

# --- 1. Node.js 20+ ---
step "Checking Node.js"
command -v node >/dev/null || fail "Node.js is not installed. Install the LTS version from https://nodejs.org, then run this again."
NODE_MAJOR=$(node -v | sed 's/^v//' | cut -d. -f1)
[ "$NODE_MAJOR" -ge 20 ] || fail "Node.js $(node -v) is too old. Install version 20 or newer from https://nodejs.org."
node -v

# --- 2. pnpm ---
step "Checking pnpm"
if ! command -v pnpm >/dev/null; then
  echo "Installing pnpm..."
  npm install -g pnpm@10 >/dev/null || fail "Couldn't install pnpm. Run 'npm install -g pnpm@10' and try again."
fi
echo "pnpm $(pnpm -v)"

# --- 3. Settings file (.env.local) ---
if [ ! -f .env.local ]; then
  step "First-time setup"
  echo "Choose a password for the Admin page (where you add the AI key and edit prompts)."
  echo "Leave it blank to generate one."
  read -r -s -p "Admin password: " ADMIN_PASSWORD || true
  echo
  GENERATED=0
  if [ -z "${ADMIN_PASSWORD:-}" ]; then
    ADMIN_PASSWORD=$(node -e "console.log(require('crypto').randomBytes(12).toString('base64').replace(/[^A-Za-z0-9]/g,''))")
    GENERATED=1
  fi
  ADMIN_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  umask 077
  cat > .env.local <<EOF
# Created by start-wizard.sh. Local settings - never commit this file.
ADMIN_PASSWORD=$ADMIN_PASSWORD
ADMIN_SECRET=$ADMIN_SECRET
# Optional: a Claude API key here is used if none is saved on the Admin page.
# ANTHROPIC_API_KEY=sk-ant-...
EOF
  if [ "$GENERATED" = 1 ]; then
    printf '\nYour admin password is: %s\n(It is saved in .env.local in this folder if you forget it.)\n' "$ADMIN_PASSWORD"
  else
    echo "Saved. You can change it later in .env.local in this folder."
  fi
fi

# --- 4. Install packages ---
step "Installing packages (first run takes a minute or two)"
pnpm install --frozen-lockfile || fail "Package install failed. Check your internet connection and try again."

# --- 5. Build when needed ---
if [ "$REBUILD" = 1 ] || [ ! -f .next/BUILD_ID ] || [ -n "$(find src public package.json next.config.ts pnpm-lock.yaml -newer .next/BUILD_ID -type f 2>/dev/null | head -1)" ]; then
  step "Building the app (about a minute)"
  pnpm build || fail "The build failed. See the messages above."
else
  step "App is already built"
fi

if [ "$NO_START" = 1 ]; then
  echo; echo "Setup complete. Run ./start-wizard.sh to start the Wizard."
  exit 0
fi

# --- 6. Start ---
if curl -s -o /dev/null "$URL/api/config"; then
  echo; echo "Something is already running on port $PORT - opening it in your browser."
  (command -v open >/dev/null && open "$URL") || (command -v xdg-open >/dev/null && xdg-open "$URL") || true
  exit 0
fi

(
  for _ in $(seq 1 60); do
    if curl -s -o /dev/null "$URL/api/config"; then
      (command -v open >/dev/null && open "$URL") || (command -v xdg-open >/dev/null && xdg-open "$URL") || true
      break
    fi
    sleep 1
  done
) &

printf '\nAnkobia Wizard is starting at %s\n  Wizard: %s\n  Admin:  %s/admin  (add your Claude API key there first)\n\nKeep this terminal open while you use the Wizard. Press Ctrl+C to stop.\n\n' "$URL" "$URL" "$URL"
exec pnpm start
