#!/usr/bin/env python3
"""Start a safe localhost EarnRoute instance after applying database migrations."""
from __future__ import annotations

import os
import secrets
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

from alembic import command
from alembic.config import Config
from dotenv import load_dotenv, set_key

ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / ".env"
if not ENV_FILE.exists():
    raise SystemExit("Missing .env. Copy .env.example to .env first.")

load_dotenv(ENV_FILE, override=False)
os.environ.setdefault("APP_ENV", "development")

# Replace the sample secret for local use, so every installation gets a unique signing key.
secret = os.getenv("JWT_SECRET", "")
if len(secret) < 32 or secret.startswith("replace-with-") or secret.startswith("dev-only"):
    secret = secrets.token_urlsafe(48)
    set_key(str(ENV_FILE), "JWT_SECRET", secret)
    os.environ["JWT_SECRET"] = secret

os.chdir(ROOT)
config = Config(str(ROOT / "alembic.ini"))
command.upgrade(config, "head")

from app.main import app  # noqa: E402
import uvicorn  # noqa: E402

host = "127.0.0.1"
port = int(os.getenv("PORT", "8000"))
url = f"http://{host}:{port}"


def open_when_ready() -> None:
    if os.getenv("EARNROUTE_NO_BROWSER") == "1":
        return
    deadline = time.monotonic() + 25
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(f"{url}/api/health", timeout=1) as response:
                if response.status == 200:
                    webbrowser.open(url)
                    return
        except Exception:
            time.sleep(0.25)


thread = threading.Thread(target=open_when_ready, name="earnroute-open-browser", daemon=True)
thread.start()
print("\nEarnRoute is starting on this Mac only (127.0.0.1). Keep this Terminal window open.")
print(f"Local address: {url}")
print("Press Ctrl+C in this window to stop the app. For admin setup, see README.md.\n", flush=True)
uvicorn.run(app, host=host, port=port, log_level=os.getenv("LOG_LEVEL", "info"))
