from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.db.session import SessionLocal
from app.db.models.project import Project, Topic
from app.db.models.user import User

from app.services.search_pipeline.orchestrator import orchestrate_search

app = FastAPI(title="Sift Graph Backend")

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
    except Exception as e:
        print(f"Graph Search Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/py/graph-full")
def get_full_graph():
    """Returns the entire graph formatted for react-force-graph-2d."""
    db = SessionLocal()
    try:
        nodes = []
        links = []
        
        # 1. Add all projects
        projects = db.query(Project).all()
        for p in projects:
            nodes.append({
                "id": f"repo_{p.id}",
                "name": p.full_name,
                "group": "repository",
                "val": (p.stars or 100) / 1000 + 3, # Scale visually by stars
                "color": "#8b5cf6", # violet
                "language": p.language,
                "stars": p.stars
            })
            
            # Edges: Project -> Topics
            for t in p.topics:
                links.append({
                    "source": f"repo_{p.id}",
                    "target": f"topic_{t.id}",
                    "type": "has_topic"
                })
                
            # Edges: User -> Project (contributors)
            for c in p.contributors:
                links.append({
                    "source": f"user_{c.user_id}",
                    "target": f"repo_{p.id}",
                    "type": "contributed_to"
                })

        # 2. Add all topics
        topics = db.query(Topic).all()
        for t in topics:
            nodes.append({
                "id": f"topic_{t.id}",
                "name": t.name,
                "group": "topic",
                "val": 2, 
                "color": "#10b981" # emerald
            })
            
        # 3. Add all users
        users = db.query(User).all()
        for u in users:
            nodes.append({
                "id": f"user_{u.id}",
                "name": u.login,
                "group": "user",
                "val": 1.5,
                "color": "#3f3f46" # zinc
            })
            
        return {"nodes": nodes, "links": links}
    finally:
        db.close()

@app.get("/health")
def health_check():
    return {"status": "ok"}
