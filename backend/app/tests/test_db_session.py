from app.db.session import DEFAULT_SQLITE_PATH, resolve_database_url


def test_relative_sqlite_url_resolves_to_bundled_backend_db():
    assert resolve_database_url("sqlite:///./sift.db") == f"sqlite:///{DEFAULT_SQLITE_PATH}"


def test_absolute_sqlite_url_is_preserved():
    assert resolve_database_url("sqlite:////tmp/sift.db") == "sqlite:////tmp/sift.db"


def test_non_sqlite_database_url_is_preserved():
    url = "postgresql://user:pass@example.com/sift"

    assert resolve_database_url(url) == url
