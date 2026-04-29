<div align="center">

# sift

### Your next PR starts here


<img width="2550" height="1172" alt="sift demo" src="https://github.com/user-attachments/assets/ee084c75-30b9-4113-9907-7940fb784de5" />



---

Sift is a visual interface for exploring open-source repositories with sub-5ms retrieval and 1→N indexing.

It turns GitHub into a living graph of projects, languages, domains, and similarity clusters with PR-level resolution to find your next contribution easily.

</div>

---

## Features

- Explore open-source repositories through an interactive graph
- Search repositories by meaning, not only exact keywords
- Filter by stars, language, and technical domain
- Discover niche project clusters through semantic similarity
- Use natural language prompts with sift companion to zoom into relevant repo spaces
- Identify projects that match your contribution interests faster

## Architecture

| Layer | Purpose | Stack |
|---|---|---|
| Frontend | Graph interface and repo exploration UI | React / Next.js |
| Search | Semantic repo retrieval | Embeddings + vector database |
| Graphing | Repo similarity, clustering, and structure | Linear algebra + graph layout |
| Data | Repository metadata, languages, stars, topics | GitHub data |
| Companion | Natural language cluster navigation | LLM-assisted search |


## Anatomy

```txt
sift/
├── frontend/        # graph UI and search interface
├── backend/         # API routes and repo query logic
├── embeddings/      # repo vectorization pipeline
├── graph/           # clustering and similarity structure
├── data/            # repository metadata
└── companion/       # natural language repo navigation
```

## Install

```bash
git clone https://github.com/your-username/sift.git
cd sift
npm install
npm run dev
```

## Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

```
