#!/usr/bin/env python3
"""Encrypted PostgreSQL backup to a private S3-compatible bucket."""
from __future__ import annotations
import hashlib
import os
import subprocess
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

import boto3
from botocore.config import Config


def required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Required backup setting is missing: {name}")
    return value


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def run_checked(args: list[str], *, env: dict[str, str] | None = None) -> None:
    result = subprocess.run(args, env=env, text=True, capture_output=True, check=False)
    if result.returncode:
        detail = (result.stderr or result.stdout or "no command output")[-1500:]
        raise RuntimeError(f"Backup command failed ({Path(args[0]).name}, exit {result.returncode}): {detail}")


def pg_settings(database_url: str) -> tuple[dict[str, str], str]:
    normalized = database_url.replace("postgresql+psycopg://", "postgresql://", 1)
    if normalized.startswith("postgres://"):
        normalized = "postgresql://" + normalized[len("postgres://"):]
    parsed = urlparse(normalized)
    if parsed.scheme not in {"postgres", "postgresql"}:
        raise RuntimeError("Backup requires PostgreSQL DATABASE_URL.")
    host, user = parsed.hostname or "", unquote(parsed.username or "")
    password, database = unquote(parsed.password or ""), unquote(parsed.path.lstrip("/"))
    port = str(parsed.port or 5432)
    if not all((host, user, password, database)):
        raise RuntimeError("DATABASE_URL is missing host, database, user or password.")
    sslmode = parse_qs(parsed.query).get("sslmode", ["require"])[0]

    def escape_passfile(value: str) -> str:
        return value.replace("\\", "\\\\").replace(":", "\\:")
    entry = ":".join(escape_passfile(v) for v in (host, port, database, user, password))
    env = os.environ.copy()
    env.update({
        "PGHOST": host, "PGPORT": port, "PGUSER": user, "PGDATABASE": database,
        "PGSSLMODE": sslmode, "PGCONNECT_TIMEOUT": "20",
    })
    return env, entry


def verify_dump(dump_path: Path) -> None:
    result = subprocess.run(["pg_restore", "--list", str(dump_path)], text=True, capture_output=True, check=False)
    if result.returncode or "Dumped from database version" not in (result.stdout or ""):
        raise RuntimeError("Backup archive verification failed.")


def gpg_args(home: Path, passfile: Path) -> list[str]:
    return ["gpg", "--batch", "--yes", "--no-options", "--homedir", str(home),
            "--pinentry-mode", "loopback", "--passphrase-file", str(passfile)]


def main() -> None:
    database_url = required("DATABASE_URL")
    access_key = required("AWS_ACCESS_KEY_ID")
    secret_key = required("AWS_SECRET_ACCESS_KEY")
    endpoint = required("AWS_ENDPOINT_URL_S3")
    region = required("AWS_REGION")
    bucket = required("BACKUP_BUCKET")
    passphrase = required("BACKUP_ENCRYPTION_PASSPHRASE")
    if len(passphrase) < 32:
        raise RuntimeError("BACKUP_ENCRYPTION_PASSPHRASE must be at least 32 characters.")
    retention_days = max(1, min(int(os.getenv("BACKUP_RETENTION_DAYS", "14")), 90))
    now = datetime.now(timezone.utc)
    stamp = now.strftime("%Y%m%dT%H%M%SZ")
    prefix = "postgres/earnroute/"
    object_key = f"{prefix}{now:%Y/%m/%d}/earnroute-{stamp}.dump.gpg"

    s3 = boto3.client(
        "s3", endpoint_url=endpoint, region_name=region,
        aws_access_key_id=access_key, aws_secret_access_key=secret_key,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )
    encrypted_bytes = 0
    with tempfile.TemporaryDirectory(prefix="earnroute-backup-") as temp_name:
        temp = Path(temp_name)
        os.chmod(temp, 0o700)
        dump_path = temp / "earnroute.dump"
        encrypted_path = temp / "earnroute.dump.gpg"
        downloaded_path = temp / "downloaded.dump.gpg"
        passfile = temp / "backup-passphrase"
        passfile.write_text(passphrase, encoding="utf-8")
        os.chmod(passfile, 0o600)
        gpg_home = temp / "gpg-home"
        gpg_home.mkdir(mode=0o700)

        pg_env, pgpass_entry = pg_settings(database_url)
        pgpass_file = temp / "pgpass"
        pgpass_file.write_text(pgpass_entry + "\n", encoding="utf-8")
        os.chmod(pgpass_file, 0o600)
        pg_env["PGPASSFILE"] = str(pgpass_file)
        run_checked([
            "pg_dump", "--no-password", "--format=custom", "--compress=6",
            "--no-owner", "--no-privileges", "--file", str(dump_path), pg_env["PGDATABASE"],
        ], env=pg_env)
        plain_sha = sha256_file(dump_path)

        run_checked(gpg_args(gpg_home, passfile) + [
            "--symmetric", "--cipher-algo", "AES256", "--output", str(encrypted_path), str(dump_path)
        ])
        encrypted_sha = sha256_file(encrypted_path)
        local_verified = temp / "local-verified.dump"
        run_checked(gpg_args(gpg_home, passfile) + ["--output", str(local_verified), "--decrypt", str(encrypted_path)])
        verify_dump(local_verified)
        if sha256_file(local_verified) != plain_sha:
            raise RuntimeError("Local decrypted backup did not match the dump checksum.")

        s3.upload_file(
            str(encrypted_path), bucket, object_key,
            ExtraArgs={"ContentType": "application/octet-stream", "Metadata": {
                "plain-sha256": plain_sha, "encrypted-sha256": encrypted_sha,
                "backup-format": "pg_dump-custom-gpg-aes256", "created-utc": stamp,
            }},
        )
        uploaded = s3.head_object(Bucket=bucket, Key=object_key)
        if int(uploaded.get("ContentLength", -1)) != encrypted_path.stat().st_size:
            raise RuntimeError("Uploaded object size mismatch.")
        s3.download_file(bucket, object_key, str(downloaded_path))
        if sha256_file(downloaded_path) != encrypted_sha:
            raise RuntimeError("Downloaded backup checksum mismatch.")
        downloaded_dump = temp / "downloaded-verified.dump"
        run_checked(gpg_args(gpg_home, passfile) + ["--output", str(downloaded_dump), "--decrypt", str(downloaded_path)])
        verify_dump(downloaded_dump)
        if sha256_file(downloaded_dump) != plain_sha:
            raise RuntimeError("Downloaded backup decrypt/checksum verification failed.")
        encrypted_bytes = encrypted_path.stat().st_size

    cutoff = now - timedelta(days=retention_days)
    objects: list[dict] = []
    for page in s3.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=prefix):
        objects.extend(page.get("Contents", []))
    newest_key = max(objects, key=lambda item: item["LastModified"])["Key"] if objects else object_key
    pruned = 0
    for item in objects:
        if item["Key"] not in {newest_key, object_key} and item["LastModified"] < cutoff:
            s3.delete_object(Bucket=bucket, Key=item["Key"])
            pruned += 1
    print(f"VERIFIED_BACKUP_OK key={object_key} encrypted_bytes={encrypted_bytes} retention_days={retention_days} pruned={pruned}")


if __name__ == "__main__":
    main()
