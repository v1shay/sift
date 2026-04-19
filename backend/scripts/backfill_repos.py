import asyncio
import os
from datetime import datetime
import argparse
import sys

# Ensure backend directory is in path when running as script
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from app.db.session import engine, SessionLocal, Base
from app.db.models.project import Project, Topic
from app.db.models.user import User, UserProject
from app.services.github.repo_fetcher import GitHubRepoFetcher

def init_db():
    print("Initializing Database tables...")
    Base.metadata.create_all(bind=engine)

from typing import Optional

def parse_datetime(dt_str) -> Optional[datetime]:
    if not dt_str: return None
    try:
        return datetime.strptime(dt_str, "%Y-%m-%dT%H:%M:%SZ")
    except ValueError:
        return None

async def ingest_repositories(query: str, limit: int = 20):
    fetcher = GitHubRepoFetcher()
    print(f"Fetching {limit} repositories for query: '{query}'")
    repos = await fetcher.fetch_repos_by_query(query, per_page=limit)
    
    db = SessionLocal()
    try:
        for repo_data in repos:
            # Upsert Owner
            owner_data = repo_data.get("owner", {})
            owner = db.query(User).filter(User.github_id == owner_data.get("id")).first()
            if not owner and owner_data.get("id"):
                owner = User(
                    github_id=owner_data.get("id"),
                    login=owner_data.get("login"),
                    avatar_url=owner_data.get("avatar_url"),
                    url=owner_data.get("html_url")
                )
                db.add(owner)
                db.flush() # get id
            
            # Upsert Project
            project = db.query(Project).filter(Project.github_id == repo_data.get("id")).first()
            if not project:
                project = Project(
                    github_id=repo_data.get("id"),
                    name=repo_data.get("name"),
                    full_name=repo_data.get("full_name"),
                    description=repo_data.get("description"),
                    url=repo_data.get("html_url"),
                    homepage=repo_data.get("homepage"),
                    language=repo_data.get("language"),
                    stars=repo_data.get("stargazers_count", 0),
                    forks=repo_data.get("forks_count", 0),
                    open_issues=repo_data.get("open_issues_count", 0),
                    watchers=repo_data.get("watchers_count", 0),
                    created_at=parse_datetime(repo_data.get("created_at")),
                    updated_at=parse_datetime(repo_data.get("updated_at")),
                    pushed_at=parse_datetime(repo_data.get("pushed_at")),
                    owner_id=owner.id if owner else None
                )
                if repo_data.get("license"):
                    project.license_spdx = repo_data.get("license", {}).get("spdx_id")
                    
                db.add(project)
                db.flush()

            # Process Topics
            topics = repo_data.get("topics", [])
            for t_name in topics:
                topic = db.query(Topic).filter(Topic.name == t_name).first()
                if not topic:
                    topic = Topic(name=t_name)
                    db.add(topic)
                if topic not in project.topics:
                    project.topics.append(topic)
                    
            print(f"Added/Updated Node: {project.full_name} | Stars: {project.stars} | Owner: {owner.login if owner else 'None'}")
            
            # Fetch and process Contributors (The edges)
            contributors_url = repo_data.get("contributors_url")
            if contributors_url:
                contributors_data = await fetcher.fetch_contributors(contributors_url, limit=5)
                for c_data in contributors_data:
                    # Ignore anonymous or null contributors
                    if not c_data.get("id"): continue
                    
                    user = db.query(User).filter(User.github_id == c_data.get("id")).first()
                    if not user:
                        user = User(
                            github_id=c_data.get("id"),
                            login=c_data.get("login"),
                            avatar_url=c_data.get("avatar_url"),
                            url=c_data.get("html_url")
                        )
                        db.add(user)
                        db.flush()
                        
                    # Create Edge
                    up = db.query(UserProject).filter_by(user_id=user.id, project_id=project.id).first()
                    if not up:
                        up = UserProject(user_id=user.id, project_id=project.id)
                        db.add(up)
                    up.contributions_count = c_data.get("contributions", 0)

        db.commit()
        print("Ingestion complete. Graph database populated.")
    except Exception as e:
        db.rollback()
        print(f"Failed to ingest data: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill Repositories into the local graph.")
    parser.add_argument("--query", type=str, required=True, help="GitHub search query (e.g., 'stars:>1000 topic:machine-learning')")
    parser.add_argument("--limit", type=int, default=10, help="Number of repos to fetch.")
    
    args = parser.parse_args()
    
    init_db()
    asyncio.run(ingest_repositories(args.query, args.limit))
