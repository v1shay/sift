from collections import Counter, defaultdict
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from math import sqrt
from pydantic import BaseModel
from sqlalchemy.orm import joinedload
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

from app.db.session import SessionLocal
from app.db.models.project import Project, Topic
from app.db.models.user import User

from app.services.search_pipeline.orchestrator import orchestrate_search
from app.services.llm.query_parser import LLMConfigurationError, LLMQueryError

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
    return {
        "id": f"repo_{project.id}",
        "name": project.full_name,
        "group": "repository",
        "nodeType": "repository",
        "val": project_node_size(project.stars),
        "color": "#8b5cf6" if not muted else "#3f3f46",
        "language": project.language,
        "stars": project.stars or 0,
        "forks": project.forks or 0,
        "openIssues": project.open_issues or 0,
        "owner": owner_login(project),
        "topics": [topic.name for topic in project.topics[:8]],
        "url": project.url,
    }


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
    sorters = {
        "stars": lambda project: project.stars or 0,
        "forks": lambda project: project.forks or 0,
        "issues": lambda project: project.open_issues or 0,
        "updated": lambda project: project.pushed_at or project.updated_at or datetime.min,
        "name": lambda project: project.full_name.lower(),
    }
    key = sorters.get(sort_by, sorters["stars"])
    return sorted(projects, key=key, reverse=sort_by != "name")


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
    sort_by: str = Query("stars", alias="sortBy", pattern="^(stars|forks|issues|updated|name)$"),
    limit: int = Query(250, ge=1, le=1000),
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

@app.get("/health")
def health_check():
    return {"status": "ok"}
