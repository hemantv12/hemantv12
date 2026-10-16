#!/usr/bin/env python3
"""Create a founder/admin account interactively; never exposes a preset password."""
from __future__ import annotations

import getpass
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
os.chdir(ROOT)

# Running a script by filename puts its scripts/ directory (not the project
# root) first on sys.path. Add the project root so "app.main" resolves reliably.
root_text = str(ROOT)
if root_text not in sys.path:
    sys.path.insert(0, root_text)

# Import only after loading the configured DB URL / APP_ENV.
from app.main import APP_ENV, Base, SessionLocal, User, hash_password, log_event  # noqa: E402


def main() -> int:
    email = input("Admin email: ").strip().lower()
    full_name = " ".join(input("Admin full name: ").split())
    password = getpass.getpass("New admin password (min 14 characters): ")
    confirm = getpass.getpass("Repeat admin password: ")

    if not re.fullmatch(r"[^\\s@]+@[^\\s@]+\\.[^\\s@]+", email):
        print("Invalid email address.")
        return 2
    if len(full_name) < 2 or len(full_name) > 100:
        print("Enter a name between 2 and 100 characters.")
        return 2
    if len(password) < 14 or len(password) > 128 or password != confirm:
        print("Passwords must match and be 14–128 characters long.")
        return 2

    # Development bootstrap convenience only. Production schema must be migrated.
    if APP_ENV != "production":
        Base.metadata.create_all(bind=SessionLocal.kw["bind"])

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            print("That account already exists. This script will not promote or change an existing account.")
            return 3
        user = User(
            email=email, full_name=full_name, password_hash=hash_password(password),
            role="admin", active=True, email_verified=False,
        )
        db.add(user)
        db.flush()
        log_event(db, user.id, "admin_account_created", "user", user.id, {"provisioning": "interactive_cli"})
        db.commit()
        print(f"Admin account created for {email}. Store the password in your password manager.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
