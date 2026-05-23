<table border="0">
  <tr>
    <td width="200" valign="top">
      <img width="378" height="430" alt="Untitled - May 22, 2026 at 19 48 49 (1)" src="https://github.com/user-attachments/assets/0706bcf4-94f7-4656-bbf1-78a34e4340d6" />
    </td>
    <td valign="top" style="padding-left: 20px;">
      <h3>Sift</h3>
      <p>An open-source spatial engine that turns the GitHub ecosystem into a 3D landscape of structural biomes. 
  <br><br></p>
      <p>Powered by a 1→N indexing pipeline with sub-5ms semantic retrieval, track PRs in real-time and explore GitHub repos by true architectural meaning.</p>
    </td>
  </tr>
</table>

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
