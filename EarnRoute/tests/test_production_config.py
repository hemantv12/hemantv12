from app.main import normalize_database_url


def test_normalizes_render_postgres_url_to_psycopg3():
    assert normalize_database_url("postgres://user:pass@db.example:5432/earnroute") == (
        "postgresql+psycopg://user:pass@db.example:5432/earnroute"
    )
    assert normalize_database_url("postgresql://user:pass@db.example:5432/earnroute") == (
        "postgresql+psycopg://user:pass@db.example:5432/earnroute"
    )


def test_leaves_sqlite_url_unchanged():
    assert normalize_database_url("sqlite:///./earnroute.db") == "sqlite:///./earnroute.db"
