from datetime import datetime, timezone
from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.models.project import Project
from app.db.session import Base
from app.main import app


client = TestClient(app)


def make_session_factory(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'test.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


def redirect_uri(location: str) -> str:
    parsed = urlparse(location)
    params = parse_qs(parsed.query)
    return params["redirect_uri"][0]


def test_github_auth_prefers_configured_public_backend_url(monkeypatch):
    monkeypatch.setenv("GITHUB_CLIENT_ID", "client_123")
    monkeypatch.setenv("BACKEND_PUBLIC_URL", "https://sift-api.example.com/")

    response = client.get("/api/github/auth", follow_redirects=False)

    assert response.status_code == 307
    assert redirect_uri(response.headers["location"]) == "https://sift-api.example.com/api/github/callback"


def test_github_auth_uses_forwarded_proxy_headers(monkeypatch):
    monkeypatch.setenv("GITHUB_CLIENT_ID", "client_123")
    monkeypatch.delenv("BACKEND_PUBLIC_URL", raising=False)

    response = client.get(
        "/api/github/auth",
        headers={
            "x-forwarded-host": "sift.example.com",
            "x-forwarded-proto": "https",
        },
        follow_redirects=False,
    )

    assert response.status_code == 307
    assert redirect_uri(response.headers["location"]) == "https://sift.example.com/api/github/callback"


def test_github_auth_falls_back_to_request_scheme_when_forwarded_proto_is_missing(monkeypatch):
    monkeypatch.setenv("GITHUB_CLIENT_ID", "client_123")
    monkeypatch.delenv("BACKEND_PUBLIC_URL", raising=False)

    response = client.get(
        "/api/github/auth",
        headers={"x-forwarded-host": "127.0.0.1:3000"},
        follow_redirects=False,
    )

    assert response.status_code == 307
    assert redirect_uri(response.headers["location"]) == "http://127.0.0.1:3000/api/github/callback"


def test_graph_full_preserves_open_work_counts_in_issue_and_pr_fields(tmp_path, monkeypatch):
    session_factory = make_session_factory(tmp_path)
    monkeypatch.setattr("app.main.SessionLocal", session_factory)

    db = session_factory()
    try:
        db.add(
            Project(
                github_id=987654,
                name="sift",
                full_name="v1shay/sift",
                description="Repository graph",
                url="https://github.com/v1shay/sift",
                language="TypeScript",
                stars=42,
                forks=3,
                open_issues=17,
                watchers=9,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
                pushed_at=datetime.now(timezone.utc),
            )
        )
        db.commit()
    finally:
        db.close()

    response = client.get("/api/py/graph-full?groupBy=raw&limit=5")

    assert response.status_code == 200
    repo_node = next(node for node in response.json()["nodes"] if node.get("fullName") == "v1shay/sift")
    assert repo_node["openIssues"] == 17
    assert repo_node["openPRs"] == 17


def test_safety_score_endpoint_accepts_batched_payloads():
    response = client.post(
        "/api/py/safety-score",
        json={
            "repos": [
                {
                    "id": "one",
                    "name": "one",
                    "stars": 100,
                    "goodFirstIssues": 2,
                    "topics": ["good-first-issue"],
                },
                {
                    "id": "two",
                    "name": "two",
                    "stars": 200,
                    "goodFirstIssues": 4,
                    "topics": ["documentation"],
                },
            ]
        },
    )

    assert response.status_code == 200
    profiles = response.json()["profiles"]
    assert set(profiles) == {"one", "two"}
    assert all("score" in profile for profile in profiles.values())
