

<div align="center">

<img width="800" height="700" alt="Untitled - May 22, 2026 at 19 48 49 (1)" src="https://github.com/user-attachments/assets/0706bcf4-94f7-4656-bbf1-78a34e4340d6" />

---

Sift is an open-source spatial engine that transforms GitHub into a searchable 3D landscape of repositories.

Explore open-source projects through semantic structure instead of exact keywords with sub-5ms retrieval and real-time repository indexing.

</div>

---

## Features

- Explore repositories through an interactive graph world
- Search projects by architectural meaning instead of exact matches
- Discover hidden open-source clusters through semantic similarity
- Filter repositories by language, stars, and technical domain
- Navigate GitHub using natural language prompts
- Surface contribution-ready repositories faster
- Track repository structure and relationships in real time

## Architecture

| Layer | Purpose | Stack |
|---|---|---|
| Frontend | Interactive graph exploration UI | React / Next.js |
| Search | Semantic repository retrieval | Embeddings + vector database |
| Graphing | Similarity clustering and biome generation | Linear algebra + graph layouts |
| Data | Repository metadata and indexing | GitHub data |
| Companion | Natural language repo navigation | LLM-assisted search |

## Anatomy

```txt
sift/
├── frontend/        # graph UI and exploration interface
├── backend/         # API routes and query engine
├── embeddings/      # repository vectorization pipeline
├── graph/           # clustering and similarity systems
├── data/            # repository metadata and indexing
└── companion/       # natural language navigation

```

## Install

```bash
git clone https://github.com/v1shay/sift.git
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
<div align="center">
<img width="1000" height="600" alt="ChatGPT Image May 23, 2026, 05_59_09 PM" src="https://github.com/user-attachments/assets/a59bc514-0ca0-41d5-aa89-2bf15ce57e97" />

<div align="center">
