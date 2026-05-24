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

BACKFILL_QUERIES = [
    "stars:>10000 archived:false sort:updated-desc",
    "stars:5000..10000 archived:false sort:updated-desc",
    "stars:1000..5000 archived:false sort:stars-desc",
    "stars:500..1000 archived:false pushed:>2024-01-01 sort:updated-desc",
    "stars:100..500 archived:false pushed:>2024-01-01 sort:updated-desc",
    "stars:25..100 archived:false pushed:>2024-01-01 sort:updated-desc",
    "stars:5..25 archived:false pushed:>2024-01-01 sort:updated-desc",
    "topic:machine-learning archived:false pushed:>2024-01-01",
    "topic:llm archived:false pushed:>2024-01-01",
    "topic:agents archived:false pushed:>2024-01-01",
    "topic:rag archived:false pushed:>2024-01-01",
    "topic:react archived:false pushed:>2024-01-01",
    "topic:nextjs archived:false pushed:>2024-01-01",
    "topic:vue archived:false pushed:>2024-01-01",
    "topic:svelte archived:false pushed:>2024-01-01",
    "topic:tailwindcss archived:false pushed:>2024-01-01",
    "topic:design-system archived:false pushed:>2024-01-01",
    "topic:developer-tools archived:false pushed:>2024-01-01",
    "topic:cli archived:false pushed:>2024-01-01",
    "topic:testing archived:false pushed:>2024-01-01",
    "topic:observability archived:false pushed:>2024-01-01",
    "topic:kubernetes archived:false pushed:>2024-01-01",
    "topic:docker archived:false pushed:>2024-01-01",
    "topic:terraform archived:false pushed:>2024-01-01",
    "topic:database archived:false pushed:>2024-01-01",
    "topic:postgres archived:false pushed:>2024-01-01",
    "topic:redis archived:false pushed:>2024-01-01",
    "topic:security archived:false pushed:>2024-01-01",
    "topic:auth archived:false pushed:>2024-01-01",
    "topic:cryptography archived:false pushed:>2024-01-01",
    "topic:compiler archived:false pushed:>2024-01-01",
    "topic:runtime archived:false pushed:>2024-01-01",
    "topic:operating-system archived:false pushed:>2024-01-01",
    "topic:embedded archived:false pushed:>2024-01-01",
    "topic:ios archived:false pushed:>2024-01-01",
    "topic:android archived:false pushed:>2024-01-01",
    "topic:flutter archived:false pushed:>2024-01-01",
    "topic:game-engine archived:false pushed:>2024-01-01",
    "topic:web3 archived:false pushed:>2024-01-01",
    "topic:blockchain archived:false pushed:>2024-01-01",
    "language:TypeScript archived:false pushed:>2024-01-01 stars:50..2000",
    "language:JavaScript archived:false pushed:>2024-01-01 stars:50..2000",
    "language:Python archived:false pushed:>2024-01-01 stars:50..2000",
    "language:Go archived:false pushed:>2024-01-01 stars:50..2000",
    "language:Rust archived:false pushed:>2024-01-01 stars:50..2000",
    "language:Swift archived:false pushed:>2024-01-01 stars:20..1000",
    "language:Kotlin archived:false pushed:>2024-01-01 stars:20..1000",
    "language:C archived:false pushed:>2024-01-01 stars:50..2000",
    "language:C++ archived:false pushed:>2024-01-01 stars:50..2000",
    "language:Zig archived:false pushed:>2024-01-01 stars:20..1000",
    "good-first-issues:>0 archived:false pushed:>2024-01-01",
    "help-wanted-issues:>0 archived:false pushed:>2024-01-01",
]


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
    parser.add_argument("--target-total", type=int, default=5000, help="Stop once the local database reaches this repository count.")
    parser.add_argument("--per-query", type=int, default=100, help="Maximum repositories to fetch from each search shard.")
    parser.add_argument("--query", type=str, default=None, help="Run one GitHub search query instead of the default diverse shard list.")
    args = parser.parse_args()

    asyncio.run(backfill(target_total=args.target_total, per_query=args.per_query, query=args.query))
