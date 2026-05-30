
<div align="center"> 
  
<img width="1100" height="600" alt="Adobe Express - Screen Recording 2026-05-08 at 7 23 24 PM" src="https://github.com/user-attachments/assets/bd1507ee-ed06-45cc-8522-4b15c4108815" />

<br />

<img src="https://img.shields.io/badge/REPOS%20MODELED-10%2C223-2ea44f?style=for-the-badge" />
<img src="https://img.shields.io/badge/OPEN%20ITEMS%20MAPPED-1M%2B-0969da?style=for-the-badge" />
<img src="https://img.shields.io/badge/REPOSITORY%20EXPANSION-1%E2%86%92N-8250df?style=for-the-badge" />
<img src="https://img.shields.io/badge/RETRIEVAL%20TIME-SUB--5MS-f0883e?style=for-the-badge" />

<br />


### Sift is an open-source spatial engine that transforms GitHub into a searchable 3D landscape

<a href="#local-development"><img src="https://img.shields.io/badge/docs-blue?style=for-the-badge" /></a>
<a href="#architecture"><img src="https://img.shields.io/badge/architecture-969da?style=for-the-badge" /></a>
<a href="#features"><img src="https://img.shields.io/badge/features-238636?style=for-the-badge" /></a>
<a href="#contributing"><img src="https://img.shields.io/badge/contribute-8250df?style=for-the-badge" /></a>
<a href="https://sift-opensource.vercel.app"><img src="https://img.shields.io/badge/site-f0883e?style=for-the-badge" /></a>

</div>

---


<div align="center">
  
## Contributing

<a href="https://github.com/v1shay/sift/issues/9">
  <img src="https://img.shields.io/badge/CURRENT-ISSUE%20%239%20%C2%B7%20NEW%20FEATURES-238636?style=for-the-badge" />
</a>

<a href="https://github.com/v1shay/sift/issues">
  <img src="https://img.shields.io/badge/ISSUES-VIEW%20ALL-0969da?style=for-the-badge" />
</a>

<a href="https://github.com/v1shay/sift/issues/new">
  <img src="https://img.shields.io/badge/DISCUSSION-OPEN%20AN%20ISSUE-8250df?style=for-the-badge" />
</a>

</div>

‎ 

## Features

- 10,000+ explorable repositories
- 1,000,000+ contribution-ready issues
- 9900+ safe pull request routes
- 42 unqiue repository types
- vector-powered semantic search
- height adjustable by repository stars, contributor size, or activity
- filter clusters by stack, stars, trending, and response times

### sift computes repository-scoped analytics from live repo activity

- surfaces contribution readiness scores
- derives repository response times across issues and pull requests
- verifies repository maintainers, branch protection, and signed releases


  
## Architecture

```txt

GitHub API
  └─ Repository ingestion

Embedding Models
  └─ Semantic vectorization

Vector Index (SQLite)
  └─ Repository retrieval

Graph Algorithms
  └─ Clustering & biomes

Analytics Engine
  └─ Health & activity metrics

 Rendering (Three.js)
  └─ Spatial exploration

Sift LLM (RAG)
  └─ Natural language navigation
```


## Local Development

### Prerequisites

```txt
- Node.js
- Python 3.11+
- Git
```

### Frontend

```bash
git clone https://github.com/v1shay/sift.git
cd sift
npm install
./run.sh
````

### Backend API

```bash
cd backend
pip install -r requirements.txt
PYTHONPATH=. uvicorn app.main:app --reload
```

<div align="center">

<p align="center">
  <img width="900" alt="Sift graph exploration" src="https://github.com/user-attachments/assets/bd55a4a5-90f6-486e-82e0-24531d333d9b" />
</p>

<p align="center">
  <img width="900" alt="Sift screenshot" src="https://github.com/user-attachments/assets/d16d73db-4fe3-4e6e-9402-9bdcda6d9ffa" />
</p>

<div align="center">
