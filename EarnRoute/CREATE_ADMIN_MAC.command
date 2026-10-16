#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo
echo "EarnRoute — create the first founder/admin account"
echo "This creates a separate administrator account. It does not promote an existing worker/business user."
echo "The database connection URL is used only for this process and is not written to .env."
echo
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required. Install Python 3.12 or newer, then run this file again."
  read -r -p "Press Enter to close."
  exit 1
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "OpenSSL is required to create a temporary application secret."
  read -r -p "Press Enter to close."
  exit 1
fi

read -r -s -p "Paste the Neon PostgreSQL DATABASE_URL (hidden): " DATABASE_URL
echo
case "$DATABASE_URL" in
  postgres://*|postgresql://*|postgresql+psycopg://*) ;;
  *)
    unset DATABASE_URL
    echo "That does not look like a PostgreSQL connection URL."
    read -r -p "Press Enter to close."
    exit 1
    ;;
esac

if [ ! -x "$ROOT/.venv/bin/python" ]; then
  python3 -m venv "$ROOT/.venv"
fi

"$ROOT/.venv/bin/python" -m pip install --upgrade pip
"$ROOT/.venv/bin/python" -m pip install -r "$ROOT/requirements.txt"

TEMP_JWT_SECRET="$(openssl rand -hex 48)"
echo
echo "Connecting to the production database and opening the private account-creation prompt..."
APP_ENV=production DATABASE_URL="$DATABASE_URL" JWT_SECRET="$TEMP_JWT_SECRET" "$ROOT/.venv/bin/python" "$ROOT/scripts/create_admin.py"
RESULT=$?
unset DATABASE_URL TEMP_JWT_SECRET
echo
if [ "$RESULT" -eq 0 ]; then
  echo "Founder account created. Open https://earnroute-api.onrender.com/admin and sign in."
  echo "Save the password in your password manager. The configured email provider is not enabled, so password recovery mail is not available yet."
else
  echo "The account was not created. Review the message above; existing accounts are never promoted by this script."
fi
read -r -p "Press Enter to close."
exit "$RESULT"
