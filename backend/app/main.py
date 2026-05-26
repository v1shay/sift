import os
from collections import Counter, defaultdict
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from urllib.parse import urlencode

import httpx
from math import log10, sqrt
from pydantic import BaseModel, Field
from sqlalchemy.orm import joinedload
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from app.db.session import SessionLocal
from app.db.models.project import Project, Topic
from app.db.models.user import User

from app.services.search_pipeline.orchestrator import orchestrate_search
from app.services.llm.query_parser import LLMConfigurationError, LLMQueryError
from app.services.github.pull_requests import GitHubPullRequestFetcher
from app.services.ranking.score import calculate_weighted_safety_score, score_project_safety

app = FastAPI(title="Sift Graph Backend")

DOMAIN_RULES: Sequence[Tuple[str, Sequence[str]]] = (
    ("LLM Work", ("llm", "large-language-model", "prompt", "rag", "agent", "openai", "anthropic", "langchain", "transformer")),
    ("Machine Learning", ("machine-learning", "deep-learning", "ai", "pytorch", "tensorflow", "model", "diffusion", "neural")),
    ("Frontend Design", ("react", "vue", "svelte", "ui", "design-system", "component", "css", "tailwind", "storybook")),
    ("Web Frameworks", ("next", "web-framework", "api", "server", "frontend", "fullstack")),
    ("DevOps", ("devops", "docker", "kubernetes", "ci", "deployment", "monitoring", "observability", "infra")),
    ("Databases", ("database", "sql", "postgres", "sqlite", "redis", "vector", "storage")),
    ("Security", ("security", "auth", "privacy", "cryptography", "vulnerability")),
    ("Mobile", ("android", "ios", "mobile", "flutter", "react-native")),
    ("Programming Languages", ("compiler", "language", "runtime", "rust", "typescript", "javascript", "python", "go")),
    ("Learning", ("course", "tutorial", "roadmap", "book", "awesome", "interview", "algorithm")),
    ("Web3", ("blockchain", "ethereum", "solidity", "cosmos", "zero-knowledge", "web3")),
)


def project_node_size(stars: Optional[int]) -> float:
    """Keep very popular repositories visible without letting them dominate the canvas."""
    return min(10, max(3, 3 + sqrt(max(stars or 0, 0)) / 75))


def cluster_node_size(repo_count: int, stars: int) -> float:
    return min(28, max(9, 8 + sqrt(max(repo_count, 1)) * 2.5 + sqrt(max(stars, 0)) / 260))


def star_bucket(stars: Optional[int]) -> str:
    value = stars or 0
    if value >= 250000:
        return "250k+ stars"
    if value >= 100000:
        return "100k-250k stars"
    if value >= 50000:
        return "50k-100k stars"
    if value >= 10000:
        return "10k-50k stars"
    if value >= 1000:
        return "1k-10k stars"
    return "Under 1k stars"


def coverage_star_bucket(stars: Optional[int]) -> str:
    value = stars or 0
    if value >= 10000:
        return "10k+"
    if value >= 1000:
        return "1k-10k"
    if value >= 100:
        return "100-1k"
    if value >= 25:
        return "25-100"
    if value >= 5:
        return "5-25"
    return "0-5"


def detect_domain(project: Project) -> str:
    text = " ".join(
        [
            project.full_name or "",
            project.description or "",
            project.language or "",
            " ".join(topic.name for topic in project.topics),
        ]
    ).lower()

    for domain, keywords in DOMAIN_RULES:
        if any(keyword in text for keyword in keywords):
            return domain
    return "General Open Source"


def owner_login(project: Project) -> str:
    if project.owner and project.owner.login:
        return project.owner.login
    return project.full_name.split("/", 1)[0] if "/" in project.full_name else "Unknown"


def repo_node(project: Project, muted: bool = False) -> Dict:
    safety_profile = score_project_safety(project)
    topics = [topic.name for topic in project.topics[:8]]
    return {
        "id": f"repo_{project.id}",
        "name": project.name,
        "fullName": project.full_name,
        "description": project.description or "",
        "group": "repository",
        "nodeType": "repository",
        "val": project_node_size(project.stars),
        "color": "#8b5cf6" if not muted else "#3f3f46",
        "language": project.language,
        "stars": project.stars or 0,
        "forks": project.forks or 0,
        "openIssues": project.open_issues or 0,
        "openPRs": 0,
        "contributorsCount": len(project.contributors or []),
        "owner": owner_login(project),
        "topics": topics,
        "license": project.license_spdx,
        "isBeginnerFriendly": bool(project.is_beginner_friendly),
        "createdAt": project.created_at.isoformat() if project.created_at else None,
        "updatedAt": project.updated_at.isoformat() if project.updated_at else None,
        "pushedAt": project.pushed_at.isoformat() if project.pushed_at else None,
        "url": project.url,
        "safetyScore": safety_profile["score"],
        "safetyStatus": safety_profile["status"],
        "safetyReasons": safety_profile["reasons"],
        "safetyBreakdown": safety_profile["breakdown"],
        "safetyUnknowns": safety_profile["unknowns"],
    }


def resolve_backend_public_url(request: Request) -> str:
    configured_url = os.getenv("BACKEND_PUBLIC_URL", "").rstrip("/")
    if configured_url:
        return configured_url

    forwarded_host = request.headers.get("x-forwarded-host")
    if forwarded_host:
        host = forwarded_host.split(",")[0].strip()
        if host:
            forwarded_proto = request.headers.get("x-forwarded-proto")
            scheme = (
                forwarded_proto.split(",")[0].strip()
                if forwarded_proto
                else request.url.scheme
            ) or "https"
            return f"{scheme}://{host}".rstrip("/")

    return str(request.base_url).rstrip("/")


def cluster_node(node_id: str, label: str, group: str, projects: Iterable[Project], color: str) -> Dict:
    project_list = list(projects)
    total_stars = sum(project.stars or 0 for project in project_list)
    return {
        "id": node_id,
        "name": label,
        "group": group,
        "nodeType": "cluster",
        "val": cluster_node_size(len(project_list), total_stars),
        "color": color,
        "repoCount": len(project_list),
        "stars": total_stars,
    }


def apply_project_filters(
    projects: List[Project],
    language: Optional[str],
    topic: Optional[str],
    org: Optional[str],
    min_stars: int,
) -> List[Project]:
    normalized_language = language.lower() if language else None
    normalized_topic = topic.lower() if topic else None
    normalized_org = org.lower() if org else None

    filtered = []
    for project in projects:
        if min_stars and (project.stars or 0) < min_stars:
            continue
        if normalized_language and (project.language or "").lower() != normalized_language:
            continue
        if normalized_org and owner_login(project).lower() != normalized_org:
            continue
        if normalized_topic and normalized_topic not in {topic.name.lower() for topic in project.topics}:
            continue
        filtered.append(project)
    return filtered


def sort_projects(projects: List[Project], sort_by: str) -> List[Project]:
    if sort_by == "coverage":
        return coverage_rank_projects(projects)

    sorters = {
        "stars": lambda project: project.stars or 0,
        "forks": lambda project: project.forks or 0,
        "issues": lambda project: project.open_issues or 0,
        "updated": lambda project: project.pushed_at or project.updated_at or datetime.min,
        "name": lambda project: project.full_name.lower(),
    }
    key = sorters.get(sort_by, sorters["stars"])
    return sorted(projects, key=key, reverse=sort_by != "name")


def project_coverage_score(project: Project) -> float:
    updated = project.pushed_at or project.updated_at or project.created_at or datetime.min
    updated_score = updated.timestamp() / 86_400 if updated != datetime.min else 0
    return (
        log10((project.stars or 0) + 1) * 20
        + log10((project.forks or 0) + 1) * 6
        + log10((project.open_issues or 0) + 1) * 4
        + updated_score * 0.01
    )


def coverage_rank_projects(projects: List[Project]) -> List[Project]:
    buckets: Dict[Tuple[str, str, str], List[Project]] = defaultdict(list)
    for project in projects:
        key = (
            detect_domain(project),
            coverage_star_bucket(project.stars),
            (project.language or "Unknown").lower(),
        )
        buckets[key].append(project)

    for bucket_projects in buckets.values():
        bucket_projects.sort(key=project_coverage_score, reverse=True)

    ranked: List[Project] = []
    ordered_keys = sorted(
        buckets,
        key=lambda key: (
            len(buckets[key]),
            key[0],
            key[1],
            key[2],
        ),
    )

    while ordered_keys:
        next_keys = []
        for key in ordered_keys:
            bucket_projects = buckets[key]
            if bucket_projects:
                ranked.append(bucket_projects.pop(0))
            if bucket_projects:
                next_keys.append(key)
        ordered_keys = next_keys

    return ranked


def group_projects(projects: List[Project], group_by: str) -> Dict[str, List[Project]]:
    grouped: Dict[str, List[Project]] = defaultdict(list)
    for project in projects:
        if group_by == "language":
            key = project.language or "Unknown"
        elif group_by == "topic":
            key = project.topics[0].name if project.topics else "Untagged"
        elif group_by == "org":
            key = owner_login(project)
        elif group_by == "stars":
            key = star_bucket(project.stars)
        elif group_by == "raw":
            key = "Repositories"
        else:
            key = detect_domain(project)
        grouped[key].append(project)
    return dict(grouped)


def graph_color(group_by: str) -> str:
    return {
        "language": "#14b8a6",
        "topic": "#f59e0b",
        "org": "#38bdf8",
        "stars": "#f43f5e",
        "raw": "#10b981",
        "domain": "#a78bfa",
    }.get(group_by, "#a78bfa")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SearchRequest(BaseModel):
    query: str


class PullRequestFlowRequest(BaseModel):
    repoIds: List[int] = Field(default_factory=list, max_length=100)
    days: int = Field(default=30, ge=1, le=365)


class SafetyScoreRequest(BaseModel):
    repos: List[Dict[str, Any]] = Field(default_factory=list, max_length=5000)


class ImportRepositoryRequest(BaseModel):
    owner: str = Field(min_length=1, max_length=100, pattern=r"^[A-Za-z0-9_.-]+$")
    repo: str = Field(min_length=1, max_length=160, pattern=r"^[A-Za-z0-9_.-]+$")
    wantsContributions: bool = True


def parse_github_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def normalize_topics(raw_topics: Any) -> List[str]:
    if not isinstance(raw_topics, list):
        return []
    normalized = []
    seen = set()
    for topic in raw_topics[:24]:
        name = str(topic).strip().lower()
        if not name or name in seen:
            continue
        seen.add(name)
        normalized.append(name)
    return normalized


def imported_repo_is_beginner_friendly(topics: Sequence[str], open_issues: int, wants_contributions: bool) -> bool:
    beginner_topics = {"good-first-issue", "good-first-issues", "help-wanted", "documentation", "beginner-friendly"}
    return wants_contributions or any(topic in beginner_topics for topic in topics) or open_issues > 0


async def fetch_github_json(client: httpx.AsyncClient, url: str) -> Any:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "SIFT-repository-import",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    response = await client.get(url, headers=headers)
    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="GitHub repository not found")
    if response.status_code == 403:
        raise HTTPException(status_code=429, detail="GitHub rate limit reached while importing repository")
    if not response.is_success:
        raise HTTPException(status_code=502, detail=f"GitHub returned {response.status_code}")
    return response.json()


@app.post("/api/py/graph-search")
async def graph_search(req: SearchRequest):
    try:
        data = orchestrate_search(req.query)
        return {"data": data}
    except LLMConfigurationError as e:
        print(f"Graph Search Configuration Error: {e}")
        raise HTTPException(status_code=503, detail=str(e))
    except LLMQueryError as e:
        print(f"Graph Search LLM Error: {e}")
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        print(f"Graph Search Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/py/graph-full")
def get_full_graph(
    group_by: str = Query("domain", alias="groupBy", pattern="^(domain|language|topic|org|stars|raw)$"),
    sort_by: str = Query("coverage", alias="sortBy", pattern="^(coverage|stars|forks|issues|updated|name)$"),
    limit: int = Query(250, ge=1, le=15000),
    min_stars: int = Query(0, alias="minStars", ge=0),
    language: Optional[str] = None,
    topic: Optional[str] = None,
    org: Optional[str] = None,
):
    """Returns a grouped repository graph formatted for react-force-graph-2d."""
    db = SessionLocal()
    try:
        nodes = []
        links = []

        projects = db.query(Project).options(
            joinedload(Project.topics),
            joinedload(Project.owner),
            joinedload(Project.contributors),
        ).all()
        projects = apply_project_filters(projects, language, topic, org, min_stars)
        projects = sort_projects(projects, sort_by)[:limit]

        if group_by == "raw":
            for project in projects:
                nodes.append(repo_node(project))

                for project_topic in project.topics:
                    topic_id = f"topic_{project_topic.id}"
                    if not any(node["id"] == topic_id for node in nodes):
                        nodes.append({
                            "id": topic_id,
                            "name": project_topic.name,
                            "group": "topic",
                            "nodeType": "topic",
                            "val": 3,
                            "color": "#10b981",
                        })
                    links.append({"source": f"repo_{project.id}", "target": topic_id, "type": "has_topic"})

                for contribution in project.contributors[:5]:
                    user_id = f"user_{contribution.user_id}"
                    if not any(node["id"] == user_id for node in nodes):
                        nodes.append({
                            "id": user_id,
                            "name": contribution.user.login,
                            "group": "user",
                            "nodeType": "user",
                            "val": 2,
                            "color": "#64748b",
                        })
                    links.append({"source": user_id, "target": f"repo_{project.id}", "type": "contributed_to"})
        else:
            grouped = group_projects(projects, group_by)
            cluster_color = graph_color(group_by)
            for key, grouped_projects in sorted(
                grouped.items(),
                key=lambda item: sum(project.stars or 0 for project in item[1]),
                reverse=True,
            ):
                cluster_id = f"{group_by}_{key.lower().replace(' ', '_').replace('/', '_')}"
                nodes.append(cluster_node(cluster_id, key, group_by, grouped_projects, cluster_color))

                for project in grouped_projects:
                    nodes.append(repo_node(project))
                    links.append({
                        "source": cluster_id,
                        "target": f"repo_{project.id}",
                        "type": f"grouped_by_{group_by}",
                    })

                    if group_by != "topic":
                        for project_topic in project.topics[:3]:
                            topic_id = f"topic_{project_topic.id}"
                            if not any(node["id"] == topic_id for node in nodes):
                                nodes.append({
                                    "id": topic_id,
                                    "name": project_topic.name,
                                    "group": "topic",
                                    "nodeType": "topic",
                                    "val": 2,
                                    "color": "#334155",
                                })
                            links.append({"source": f"repo_{project.id}", "target": topic_id, "type": "has_topic"})

        return {
            "nodes": nodes,
            "links": links,
            "meta": {
                "groupBy": group_by,
                "sortBy": sort_by,
                "projectCount": len(projects),
                "clusterCount": len([node for node in nodes if node.get("nodeType") == "cluster"]),
            }
        }
    finally:
        db.close()


@app.post("/api/py/repos/import")
async def import_repository(req: ImportRepositoryRequest):
    owner_name = req.owner.strip()
    repo_name = req.repo.strip()
    full_name = f"{owner_name}/{repo_name}"

    async with httpx.AsyncClient(timeout=12.0) as client:
        repo_payload = await fetch_github_json(client, f"https://api.github.com/repos/{owner_name}/{repo_name}")
        pulls_payload = await fetch_github_json(
            client,
            f"https://api.github.com/repos/{owner_name}/{repo_name}/pulls?state=open&per_page=12",
        )

    if not isinstance(repo_payload, dict):
        raise HTTPException(status_code=502, detail="GitHub repository payload was invalid")

    owner_payload = repo_payload.get("owner") if isinstance(repo_payload.get("owner"), dict) else {}
    topics = normalize_topics(repo_payload.get("topics"))
    open_issues = int(repo_payload.get("open_issues_count") or 0)
    watchers = int(repo_payload.get("watchers_count") or repo_payload.get("subscribers_count") or 0)
    github_id = repo_payload.get("id")
    if not isinstance(github_id, int):
        raise HTTPException(status_code=502, detail="GitHub repository was missing a numeric id")

    db = SessionLocal()
    try:
        owner_github_id = owner_payload.get("id")
        if not isinstance(owner_github_id, int):
            owner_github_id = -github_id
        owner_login_value = str(owner_payload.get("login") or owner_name)
        owner = db.query(User).filter(User.github_id == owner_github_id).one_or_none()
        if not owner:
            owner = db.query(User).filter(User.login == owner_login_value).one_or_none()
        if not owner:
            owner = User(
                github_id=owner_github_id,
                login=owner_login_value,
                avatar_url=owner_payload.get("avatar_url"),
                url=owner_payload.get("html_url") or f"https://github.com/{owner_login_value}",
            )
            db.add(owner)
            db.flush()
        else:
            owner.login = owner_login_value
            owner.avatar_url = owner_payload.get("avatar_url") or owner.avatar_url
            owner.url = owner_payload.get("html_url") or owner.url

        project = db.query(Project).filter(Project.github_id == github_id).one_or_none()
        if not project:
            project = db.query(Project).filter(Project.full_name == repo_payload.get("full_name", full_name)).one_or_none()
        if not project:
            project = Project(github_id=github_id)
            db.add(project)

        project.name = str(repo_payload.get("name") or repo_name)
        project.full_name = str(repo_payload.get("full_name") or full_name)
        project.description = repo_payload.get("description")
        project.url = str(repo_payload.get("html_url") or f"https://github.com/{project.full_name}")
        project.homepage = repo_payload.get("homepage") or None
        project.language = repo_payload.get("language") or "Unknown"
        project.stars = int(repo_payload.get("stargazers_count") or 0)
        project.forks = int(repo_payload.get("forks_count") or 0)
        project.open_issues = open_issues
        project.watchers = watchers
        license_payload = repo_payload.get("license") if isinstance(repo_payload.get("license"), dict) else {}
        project.license_spdx = license_payload.get("spdx_id") or None
        project.is_beginner_friendly = imported_repo_is_beginner_friendly(topics, open_issues, req.wantsContributions)
        project.created_at = parse_github_datetime(repo_payload.get("created_at"))
        project.updated_at = parse_github_datetime(repo_payload.get("updated_at"))
        project.pushed_at = parse_github_datetime(repo_payload.get("pushed_at"))
        project.owner_id = owner.id

        topic_rows = []
        for topic_name in topics:
            topic = db.query(Topic).filter(Topic.name == topic_name).one_or_none()
            if not topic:
                topic = Topic(name=topic_name)
                db.add(topic)
                db.flush()
            topic_rows.append(topic)
        project.topics = topic_rows

        db.commit()
        db.refresh(project)
        project = (
            db.query(Project)
            .options(joinedload(Project.topics), joinedload(Project.owner), joinedload(Project.contributors))
            .filter(Project.id == project.id)
            .one()
        )
        node = repo_node(project)
        open_pull_requests = pulls_payload if isinstance(pulls_payload, list) else []
        node["openPRs"] = len(open_pull_requests)
        node["recentPullRequests"] = [
            {
                "number": item.get("number"),
                "title": item.get("title"),
                "state": item.get("state", "open"),
                "draft": item.get("draft", False),
            }
            for item in open_pull_requests[:6]
            if isinstance(item, dict)
        ]
        return {"repo": node, "meta": {"created": True, "fullName": project.full_name}}
    finally:
        db.close()


@app.post("/api/py/pr-flow")
async def get_pull_request_flow(req: PullRequestFlowRequest):
    unique_repo_ids = list(dict.fromkeys(req.repoIds))[:24]
    db = SessionLocal()
    try:
        projects = (
            db.query(Project)
            .filter(Project.id.in_(unique_repo_ids))
            .all()
            if unique_repo_ids
            else []
        )
        project_by_id = {project.id: project for project in projects}
        fetcher = GitHubPullRequestFetcher()
        summaries = {}

        for repo_id in unique_repo_ids:
            project = project_by_id.get(repo_id)
            if not project:
                summaries[str(repo_id)] = {
                    "repoId": repo_id,
                    "fullName": None,
                    "available": False,
                    "openCount": 0,
                    "mergedCount": 0,
                    "closedCount": 0,
                    "recentPullRequests": [],
                    "error": "Repository not found in local graph",
                }
                continue

            summary = await fetcher.fetch_recent_pull_requests(project.full_name, req.days)
            summaries[str(repo_id)] = {
                "repoId": repo_id,
                **summary,
            }

        aggregate = {
            "repoCount": len(unique_repo_ids),
            "availableRepoCount": sum(1 for item in summaries.values() if item["available"]),
            "openCount": sum(item["openCount"] for item in summaries.values()),
            "mergedCount": sum(item["mergedCount"] for item in summaries.values()),
            "closedCount": sum(item["closedCount"] for item in summaries.values()),
        }

        return {
            "days": req.days,
            "limit": 24,
            "summaries": summaries,
            "aggregate": aggregate,
        }
    finally:
        db.close()


@app.post("/api/py/safety-score")
def get_safety_scores(req: SafetyScoreRequest):
    profiles = {}
    for repo in req.repos:
        repo_id = repo.get("id") or repo.get("fullName") or repo.get("full_name") or repo.get("name")
        if not repo_id:
            continue
        profiles[str(repo_id)] = calculate_weighted_safety_score(repo)
    return {"profiles": profiles}


@app.get("/api/py/graph-facets")
def get_graph_facets():
    db = SessionLocal()
    try:
        projects = db.query(Project).options(joinedload(Project.topics), joinedload(Project.owner)).all()
        languages = Counter(project.language for project in projects if project.language)
        topics = Counter(topic.name for project in projects for topic in project.topics)
        orgs = Counter(owner_login(project) for project in projects)

        def top(counter: Counter, limit: int = 20) -> List[Dict]:
            return [{"name": name, "count": count} for name, count in counter.most_common(limit)]

        return {
            "languages": top(languages),
            "topics": top(topics, 30),
            "orgs": top(orgs),
            "totalProjects": len(projects),
        }
    finally:
        db.close()

@app.post("/api/github/webhook")
async def github_webhook(request: Request):
    payload = await request.json()
    event_type = request.headers.get("X-GitHub-Event", "unknown")
    print(f"Received GitHub webhook event: {event_type}")
    return {"status": "ok", "event": event_type}


@app.get("/api/github/auth")
async def github_auth_login(request: Request):
    client_id = os.getenv("GITHUB_CLIENT_ID")
    if not client_id:
        raise HTTPException(status_code=500, detail="Missing GITHUB_CLIENT_ID")

    backend_public_url = resolve_backend_public_url(request)
    params = urlencode({
        "client_id": client_id,
        "redirect_uri": f"{backend_public_url}/api/github/callback",
        "scope": "read:user,user:email",
    })
    url = f"https://github.com/login/oauth/authorize?{params}"
    return RedirectResponse(url)

@app.get("/api/github/callback")
async def github_auth_callback(code: str):
    client_id = os.getenv("GITHUB_CLIENT_ID")
    client_secret = os.getenv("GITHUB_CLIENT_SECRET")

    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="Missing Client ID or Secret")

    async with httpx.AsyncClient() as client:
        # Exchange code for token
        response = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code
            },
            headers={"Accept": "application/json"}
        )
        token_data = response.json()
        access_token = token_data.get("access_token")

        if not access_token:
            raise HTTPException(status_code=400, detail=f"Failed to get token: {token_data}")

        # Here we would normally save the token for the user, fetch their repositories,
        # and insert them into the Sift DB using the same logic from backfill.py.
        # For now, we simulate fetching their repos to add to Sift.

        user_resp = await client.get("https://api.github.com/user", headers={"Authorization": f"Bearer {access_token}"})
        user_info = user_resp.json()
        print(f"User {user_info.get('login')} connected their GitHub!")

    return {"message": "Successfully authenticated with GitHub!", "user": user_info.get("login")}


@app.get("/health")
def health_check():
    return {"status": "ok"}
