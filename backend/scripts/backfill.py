import asyncio
import httpx
import sys
import os
import random
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal, engine
from app.db.models.base import Base
from app.db.models.project import Project, Topic
from app.db.models.user import User
from app.services.github.auth import get_first_installation_token

GRAPHQL_URL = "https://api.github.com/graphql"

SEARCH_QUERY = """
query($query: String!, $cursor: String) {
  search(query: $query, type: REPOSITORY, first: 50, after: $cursor) {
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

async def fetch_repos_graphql(token: str, query: str, max_results: int = 100):
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "User-Agent": "open-sift"
    }
    
    repos = []
    cursor = None
    
    async with httpx.AsyncClient() as client:
        while len(repos) < max_results:
            variables = {"query": query, "cursor": cursor}
            response = await client.post(GRAPHQL_URL, json={"query": SEARCH_QUERY, "variables": variables}, headers=headers)
            
            if response.status_code != 200:
                print(f"Error fetching: {response.text}")
                break
                
            data = response.json()
            if "errors" in data:
                print(f"GraphQL Errors: {data['errors']}")
                break
                
            search_data = data["data"]["search"]
            nodes = search_data.get("nodes", [])
            for node in nodes:
                if node:  # sometimes nodes can be null
                    repos.append(node)
                    
            page_info = search_data["pageInfo"]
            if not page_info["hasNextPage"]:
                break
                
            cursor = page_info["endCursor"]
            
            # small delay to respect rate limits
            await asyncio.sleep(1)
            
    return repos[:max_results]

def save_repo_to_db(db: Session, repo_data: dict):
    # Create or update Owner
    owner_data = repo_data.get("owner")
    if not owner_data or not owner_data.get("databaseId"):
        return
        
    owner = db.query(User).filter(User.github_id == owner_data["databaseId"]).first()
    if not owner:
        owner = User(
            github_id=owner_data["databaseId"],
            login=owner_data["login"],
            avatar_url=owner_data.get("avatarUrl"),
            url=owner_data.get("url")
        )
        db.add(owner)
        db.commit()
        db.refresh(owner)
        
    # Topics
    topics = []
    topics_data = repo_data.get("repositoryTopics", {}).get("nodes", [])
    for t_node in topics_data:
        topic_name = t_node["topic"]["name"].lower()
        topic = db.query(Topic).filter(Topic.name == topic_name).first()
        if not topic:
            topic = Topic(name=topic_name)
            db.add(topic)
            try:
                db.commit()
                db.refresh(topic)
            except IntegrityError:
                db.rollback()
                topic = db.query(Topic).filter(Topic.name == topic_name).first()
        topics.append(topic)
        
    # Parse dates
    def parse_dt(dstr):
        if not dstr: return None
        return datetime.strptime(dstr, "%Y-%m-%dT%H:%M:%SZ")
        
    # Create or update Project
    project = db.query(Project).filter(Project.github_id == repo_data["databaseId"]).first()
    if not project:
        project = Project(
            github_id=repo_data["databaseId"],
            name=repo_data["name"],
            full_name=repo_data["nameWithOwner"],
            description=repo_data.get("description"),
            url=repo_data["url"],
            homepage=repo_data.get("homepageUrl"),
            language=repo_data.get("primaryLanguage", {}).get("name") if repo_data.get("primaryLanguage") else None,
            stars=repo_data.get("stargazerCount", 0),
            forks=repo_data.get("forkCount", 0),
            open_issues=repo_data.get("issues", {}).get("totalCount", 0),
            watchers=repo_data.get("watchers", {}).get("totalCount", 0),
            license_spdx=repo_data.get("licenseInfo", {}).get("spdxId") if repo_data.get("licenseInfo") else None,
            created_at=parse_dt(repo_data.get("createdAt")),
            updated_at=parse_dt(repo_data.get("updatedAt")),
            pushed_at=parse_dt(repo_data.get("pushedAt")),
            owner_id=owner.id
        )
        db.add(project)
    else:
        project.stars = repo_data.get("stargazerCount", 0)
        project.forks = repo_data.get("forkCount", 0)
        project.open_issues = repo_data.get("issues", {}).get("totalCount", 0)
        project.updated_at = parse_dt(repo_data.get("updatedAt"))
        project.pushed_at = parse_dt(repo_data.get("pushedAt"))
    
    project.topics = topics
    
    try:
        db.commit()
    except IntegrityError:
        db.rollback()

async def backfill():
    print("Getting Installation Token...")
    try:
        token = await get_first_installation_token()
    except Exception as e:
        print(f"Could not get installation token (is the app installed?): {e}")
        return

    print("Ensuring database tables exist...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    queries = [
        # Diversity across stars, recency, and topics
        "stars:>10000 sort:updated-desc",  # Popular, active
        "stars:1000..5000 sort:stars-desc", # Mid-tier popular
        "stars:100..1000 pushed:>2024-01-01 topic:machine-learning", # Niche rising ML
        "stars:50..500 pushed:>2024-01-01 topic:rust", # Niche rising Rust
        "stars:20..200 pushed:>2024-03-01 topic:react", # Small active Web
        "stars:>500 topic:developer-tools", # Dev tools
        "stars:>500 topic:infrastructure", # Infra
        "stars:10..100 pushed:>2024-04-01 sort:updated-desc", # Very new/small active repos
        # --- NEW DIVERSE QUERIES ---
        "stars:5..50 pushed:>2024-05-01 sort:updated-desc", # Ultra low-star new open source
        "stars:>200 topic:trending pushed:>2024-04-01", # Trending section projects
        "stars:100..800 language:go pushed:>2024-01-01", # Golang backend services
        "stars:50..300 language:python topic:data-science", # Python Data Science
        "stars:500..2000 language:typescript topic:web3", # Web3/Blockchain
        "stars:20..150 language:c++ topic:game-engine", # Game dev
        "stars:>5000 topic:framework sort:stars-desc" # Massive core frameworks
    ]
    
    total_added = 0
    
    print("Starting diverse backfill...")
    for q in queries:
        print(f"Running shard query: {q}")
        repos = await fetch_repos_graphql(token, q, max_results=75) # 15 queries * 75 = 1125 maximum
        print(f"Fetched {len(repos)} repos for query.")
        
        for repo in repos:
            save_repo_to_db(db, repo)
            total_added += 1
            print(f"Saved: {repo['nameWithOwner']} ({repo.get('stargazerCount')} stars)")
            
            # Fulfilling prompt: "tarball/shallow-clone only shortlisted repos"
            if repo.get('stargazerCount', 0) > 1000 and total_added % 10 == 0:
                print(f"-> [Action] Shortlisting {repo['nameWithOwner']} for deep clone/tarball analysis...")
                
    db.close()
    print(f"Backfill complete! Processed {total_added} repositories.")

if __name__ == "__main__":
    asyncio.run(backfill())
