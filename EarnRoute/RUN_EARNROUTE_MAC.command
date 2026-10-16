#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

fail() { echo; echo "EarnRoute could not start: $*"; echo; read -r -p "Press Enter to close..." _ || true; exit 1; }
command -v python3 >/dev/null 2>&1 || fail "Install Python 3.11 or newer from python.org, then run this file again."
python3 - <<'PY' || exit 1
import sys
if sys.version_info < (3, 11):
    raise SystemExit("EarnRoute requires Python 3.11 or newer. Install a supported Python from python.org.")
PY
[ -f .env ] || cp .env.example .env
[ -x .venv/bin/python ] || python3 -m venv .venv

echo "Preparing EarnRoute's local Python environment..."
.venv/bin/python -m pip install --disable-pip-version-check -r requirements.txt || fail "Dependency installation failed. Check this Mac's internet connection, then retry."
exec .venv/bin/python scripts/start_local.py
