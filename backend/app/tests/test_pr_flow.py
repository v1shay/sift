from datetime import datetime, timezone

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


def create_project(session_factory) -> int:
    db = session_factory()
    try:
        project = Project(
            github_id=123456,
            name="sift",
            full_name="v1shay/sift",
            description="Repository graph",
            url="https://github.com/v1shay/sift",
            language="TypeScript",
            stars=42,
            forks=3,
            open_issues=7,
            watchers=9,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            pushed_at=datetime.now(timezone.utc),
        )
        db.add(project)
        db.commit()
        db.refresh(project)
        return project.id
    finally:
        db.close()


def test_pr_flow_returns_missing_repo_summary(tmp_path, monkeypatch):
    session_factory = make_session_factory(tmp_path)
    monkeypatch.setattr("app.main.SessionLocal", session_factory)

    response = client.post("/api/py/pr-flow", json={"repoIds": [999999], "days": 14})

    assert response.status_code == 200
    body = response.json()
    assert body["summaries"]["999999"]["available"] is False
    assert body["summaries"]["999999"]["error"] == "Repository not found in local graph"
    assert body["aggregate"]["repoCount"] == 1


def test_pr_flow_uses_fetcher_and_returns_aggregate(tmp_path, monkeypatch):
    session_factory = make_session_factory(tmp_path)
    monkeypatch.setattr("app.main.SessionLocal", session_factory)
    repo_id = create_project(session_factory)

    async def fake_fetch(self, full_name, days):
        assert full_name == "v1shay/sift"
        assert days == 30
        return {
            "fullName": full_name,
            "available": True,
            "openCount": 2,
            "mergedCount": 3,
            "closedCount": 1,
            "recentPullRequests": [{"number": 1, "title": "Add city mode", "state": "open"}],
            "error": None,
        }

    monkeypatch.setattr(
        "app.services.github.pull_requests.GitHubPullRequestFetcher.fetch_recent_pull_requests",
        fake_fetch,
    )

    response = client.post("/api/py/pr-flow", json={"repoIds": [repo_id], "days": 30})

    assert response.status_code == 200
    body = response.json()
    assert body["summaries"][str(repo_id)]["openCount"] == 2
    assert body["summaries"][str(repo_id)]["mergedCount"] == 3
    assert body["summaries"][str(repo_id)]["closedCount"] == 1
    assert body["aggregate"]["availableRepoCount"] == 1
    assert body["aggregate"]["openCount"] == 2


def test_pr_flow_validates_days():
    response = client.post("/api/py/pr-flow", json={"repoIds": [], "days": 0})

    assert response.status_code == 422
