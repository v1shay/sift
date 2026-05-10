<div align="center">
  
<img width="800" height="450" alt="Adobe Express - Screen Recording 2026-05-08 at 7 23 24 PM" src="https://github.com/user-attachments/assets/bd1507ee-ed06-45cc-8522-4b15c4108815" />


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
