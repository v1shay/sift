import argparse
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))))

from app.db.session import SessionLocal
from app.db.models.project import Project, Topic
from app.services.llm.query_parser import LLMQueryParser

def orchestrate_search(user_query: str):
    # 1. Parse Query
    parser = LLMQueryParser()
    filters = parser.parse_query(user_query)
    
    # 2. Query Local Graph DB
    db = SessionLocal()
    
    query = db.query(Project)
    
    if filters.languages:
        # Simplistic approach: just check the main language
        language_lower = [l.lower() for l in filters.languages]
        query = query.filter(Project.language.in_(filters.languages) | Project.language.in_([l.capitalize() for l in language_lower]))
        
    if filters.min_stars:
        query = query.filter(Project.stars >= filters.min_stars)
        
    if filters.is_beginner_friendly:
        query = query.filter(Project.is_beginner_friendly == True)
        
    if filters.topics:
        # Must have at least one of the topics
        query = query.filter(Project.topics.any(Topic.name.in_([t.lower() for t in filters.topics])))

    results = query.limit(10).all()
    
    project_nodes = []
    for r in results:
        topics_list = [t.name for t in r.topics[:5]]
        contributors_edges = [{"login": c.user.login, "contributions": c.contributions_count} for c in r.contributors[:5]]
        
        project_nodes.append({
            "id": r.id,
            "full_name": r.full_name,
            "description": r.description,
            "language": r.language,
            "stars": r.stars,
            "forks": r.forks,
            "topics": topics_list,
            "url": r.url,
            "pushed_at": r.pushed_at.isoformat() if r.pushed_at else None,
            "owner_login": r.owner.login if r.owner else None,
            "owner_avatar_url": r.owner.avatar_url if r.owner else None,
            "contributors": contributors_edges
        })

    db.close()
    
    return {
        "search_mode": parser.provider if not parser.allow_local_fallback else f"{parser.provider}_with_local_fallback",
        "llm_model": parser.model,
        "filters": {
            "topics": filters.topics,
            "languages": filters.languages,
            "is_beginner_friendly": filters.is_beginner_friendly,
            "min_stars": filters.min_stars,
            "semantic_intent": filters.semantic_intent,
        },
        "projects": project_nodes
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test the LLM orchestrator matching pipeline against the local DB")
    parser.add_argument("query", type=str, help="Natural language query to search the graph")
    args = parser.parse_args()
    
    import json
    res = orchestrate_search(args.query)
    print(json.dumps(res, indent=2))
