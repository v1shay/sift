import argparse
import asyncio
import os
import subprocess
import sys
from datetime import datetime

import httpx
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.models.base import Base
from app.db.models.project import Project, Topic
from app.db.models.user import User
from app.db.session import SessionLocal, engine

GRAPHQL_URL = "https://api.github.com/graphql"
GRAPHQL_PAGE_SIZE = 100

SEARCH_QUERY = """
query($query: String!, $cursor: String) {
  search(query: $query, type: REPOSITORY, first: 100, after: $cursor) {
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      ... on Repository {
        databaseId
        name
        nameWithOwner
        description
        url
        homepageUrl
        stargazerCount
        forkCount
        watchers {
          totalCount
        }
        issues(states: OPEN) {
          totalCount
        }
        primaryLanguage {
          name
        }
        licenseInfo {
          spdxId
        }
        createdAt
        updatedAt
        pushedAt
        repositoryTopics(first: 10) {
          nodes {
            topic {
              name
            }
          }
        }
        owner {
          login
          avatarUrl
          url
          ... on User {
            databaseId
          }
          ... on Organization {
            databaseId
          }
        }
      }
    }
  }
}
"""

BASE_QUALIFIERS = "archived:false fork:false"
RECENT_QUALIFIER = "pushed:>2024-01-01"

STAR_SHARDS = [
    "stars:>10000 sort:updated-desc",
    "stars:5000..10000 sort:updated-desc",
    "stars:1000..5000 sort:stars-desc",
    "stars:500..1000 sort:updated-desc",
    "stars:100..500 sort:updated-desc",
    "stars:25..100 sort:updated-desc",
    "stars:5..25 sort:updated-desc",
    "stars:1..5 sort:updated-desc",
    "stars:0..1 sort:updated-desc",
]

TOPIC_SHARDS = [
    "machine-learning", "llm", "agents", "rag", "computer-vision", "nlp", "robotics",
    "react", "nextjs", "vue", "svelte", "solidjs", "tailwindcss", "design-system",
    "accessibility", "web-components", "browser-extension", "webgl", "threejs",
    "developer-tools", "cli", "terminal", "shell", "testing", "linting", "build-tool",
    "observability", "monitoring", "opentelemetry", "logging", "kubernetes", "docker",
    "terraform", "serverless", "database", "postgres", "sqlite", "redis", "vector-database",
    "security", "auth", "oauth", "cryptography", "privacy", "zero-knowledge",
    "compiler", "runtime", "programming-language", "operating-system", "embedded", "iot",
    "ios", "android", "flutter", "react-native", "swiftui", "game-engine", "graphics",
    "audio", "video", "ffmpeg", "web3", "blockchain", "p2p", "protocol", "networking",
    "bioinformatics", "physics", "simulation", "math", "documentation", "education",
    "awesome-list", "homebrew", "package-manager", "data-engineering", "analytics",
]

LANGUAGE_SHARDS = [
    "TypeScript", "JavaScript", "Python", "Go", "Rust", "Swift", "Kotlin", "Dart",
    "C", "C++", "Zig", "Ruby", "PHP", "Java", "Scala", "Elixir", "Clojure",
    "Haskell", "Lua", "R", "Julia", "Shell", "PowerShell",
]


def build_backfill_queries() -> list[str]:
    queries = []

    for topic in TOPIC_SHARDS:
        queries.append(f"topic:{topic} stars:0..100 {BASE_QUALIFIERS} {RECENT_QUALIFIER}")

    for language in LANGUAGE_SHARDS:
        queries.append(f"language:{language} stars:0..50 {BASE_QUALIFIERS} {RECENT_QUALIFIER}")

    queries.extend([
        f"good-first-issues:>0 {BASE_QUALIFIERS} {RECENT_QUALIFIER}",
        f"help-wanted-issues:>0 {BASE_QUALIFIERS} {RECENT_QUALIFIER}",
        f"created:>2025-01-01 stars:0..200 {BASE_QUALIFIERS} sort:updated-desc",
        f"created:>2026-01-01 stars:0..200 {BASE_QUALIFIERS} sort:updated-desc",
    ])

    queries.extend(f"{shard} {BASE_QUALIFIERS}" for shard in STAR_SHARDS)

    for topic in TOPIC_SHARDS:
        queries.append(f"topic:{topic} {BASE_QUALIFIERS} {RECENT_QUALIFIER}")

    for language in LANGUAGE_SHARDS:
        queries.append(f"language:{language} stars:50..2000 {BASE_QUALIFIERS} {RECENT_QUALIFIER}")

    return queries


BACKFILL_QUERIES = build_backfill_queries()


def token_from_gh_cli() -> str | None:
    try:
        result = subprocess.run(
            ["gh", "auth", "token"],
            check=True,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except (FileNotFoundError, subprocess.SubprocessError):
        return None
    return result.stdout.strip() or None


async def resolve_github_token() -> str:
    token = os.getenv("GITHUB_TOKEN") or token_from_gh_cli()
    if token:
        return token
    from app.services.github.auth import get_first_installation_token

    return await get_first_installation_token()


async def fetch_repos_graphql(token: str, query: str, max_results: int = 100):
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "User-Agent": "open-sift",
    }
    repos = []
    cursor = None

    async with httpx.AsyncClient(timeout=30) as client:
        while len(repos) < max_results:
            response = await client.post(
                GRAPHQL_URL,
                json={"query": SEARCH_QUERY, "variables": {"query": query, "cursor": cursor}},
                headers=headers,
            )

            if response.status_code != 200:
                print(f"Error fetching: {response.text}")
                break

            data = response.json()
            if "errors" in data:
                print(f"GraphQL Errors: {data['errors']}")
                break

            search_data = data["data"]["search"]
            repos.extend(node for node in search_data.get("nodes", []) if node)

            page_info = search_data["pageInfo"]
            if not page_info["hasNextPage"]:
                break

            cursor = page_info["endCursor"]
            await asyncio.sleep(0.35)

    return repos[:max_results]


def parse_dt(value: str | None):
    if not value:
        return None
    return datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ")


def get_or_create_owner(db: Session, owner_data: dict):
    if not owner_data or not owner_data.get("databaseId"):
        return None

    owner = db.query(User).filter(User.github_id == owner_data["databaseId"]).first()
    if not owner:
        owner = db.query(User).filter(User.login == owner_data["login"]).first()
    if owner:
        owner.github_id = owner_data["databaseId"]
        owner.login = owner_data["login"]
        owner.avatar_url = owner_data.get("avatarUrl")
        owner.url = owner_data.get("url")
        return owner

    owner = User(
        github_id=owner_data["databaseId"],
        login=owner_data["login"],
        avatar_url=owner_data.get("avatarUrl"),
        url=owner_data.get("url"),
    )
    db.add(owner)
    db.flush()
    return owner


def resolve_topics(db: Session, repo_data: dict):
    topics = []
    for topic_node in repo_data.get("repositoryTopics", {}).get("nodes", []):
        topic_name = topic_node["topic"]["name"].lower()
        topic = db.query(Topic).filter(Topic.name == topic_name).first()
        if not topic:
            topic = Topic(name=topic_name)
            db.add(topic)
            try:
                db.flush()
            except IntegrityError:
                db.rollback()
                topic = db.query(Topic).filter(Topic.name == topic_name).first()
        if topic:
            topics.append(topic)
    return topics


def save_repo_to_db(db: Session, repo_data: dict):
    owner = get_or_create_owner(db, repo_data.get("owner"))
    if not owner:
        return False

    project = db.query(Project).filter(Project.github_id == repo_data["databaseId"]).first()
    created = project is None
    if not project:
        project = Project(github_id=repo_data["databaseId"], owner_id=owner.id)
        db.add(project)

    project.name = repo_data["name"]
    project.full_name = repo_data["nameWithOwner"]
    project.description = repo_data.get("description")
    project.url = repo_data["url"]
    project.homepage = repo_data.get("homepageUrl")
    project.language = repo_data.get("primaryLanguage", {}).get("name") if repo_data.get("primaryLanguage") else None
    project.stars = repo_data.get("stargazerCount", 0)
    project.forks = repo_data.get("forkCount", 0)
    project.open_issues = repo_data.get("issues", {}).get("totalCount", 0)
    project.watchers = repo_data.get("watchers", {}).get("totalCount", 0)
    project.license_spdx = repo_data.get("licenseInfo", {}).get("spdxId") if repo_data.get("licenseInfo") else None
    project.created_at = parse_dt(repo_data.get("createdAt"))
    project.updated_at = parse_dt(repo_data.get("updatedAt"))
    project.pushed_at = parse_dt(repo_data.get("pushedAt"))
    project.owner_id = owner.id
    project.topics = resolve_topics(db, repo_data)

    try:
        db.commit()
        return created
    except IntegrityError:
        db.rollback()
        return False


async def backfill(target_total: int = 5000, per_query: int = 100, query: str | None = None):
    print("Getting GitHub token...")
    token = await resolve_github_token()

    print("Ensuring database tables exist...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        start_count = db.query(Project).count()
        print(f"Starting with {start_count} repositories. Target: {target_total}.")
        queries = [query] if query else BACKFILL_QUERIES
        total_processed = 0
        total_created = 0

        for shard_query in queries:
            current_count = db.query(Project).count()
            if current_count >= target_total:
                break

            remaining = target_total - current_count
            fetch_limit = min(per_query, max(GRAPHQL_PAGE_SIZE, remaining))
            print(f"Running shard query: {shard_query}")
            repos = await fetch_repos_graphql(token, shard_query, max_results=fetch_limit)
            print(f"Fetched {len(repos)} repos for query.")

            for repo in repos:
                created = save_repo_to_db(db, repo)
                total_processed += 1
                total_created += 1 if created else 0
                action = "Added" if created else "Updated"
                print(f"{action}: {repo['nameWithOwner']} ({repo.get('stargazerCount')} stars)")

                if db.query(Project).count() >= target_total:
                    break

        final_count = db.query(Project).count()
        print(
            f"Backfill complete. Processed {total_processed}; "
            f"added {total_created}; database now has {final_count} repositories."
        )
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill live GitHub repositories into Sift.")
    parser.add_argument("--target-total", type=int, default=15000, help="Stop once the local database reaches this repository count.")
    parser.add_argument("--per-query", type=int, default=100, help="Maximum repositories to fetch from each search shard.")
    parser.add_argument("--query", type=str, default=None, help="Run one GitHub search query instead of the default diverse shard list.")
    args = parser.parse_args()

    asyncio.run(backfill(target_total=args.target_total, per_query=args.per_query, query=args.query))
