
<div align="center"> 
  
<img width="1100" height="600" alt="Adobe Express - Screen Recording 2026-05-08 at 7 23 24 PM" src="https://github.com/user-attachments/assets/bd1507ee-ed06-45cc-8522-4b15c4108815" />

<br />

<img src="https://img.shields.io/badge/repos%20modeled-10%2C223-2ea44f?style=for-the-badge" />
<img src="https://img.shields.io/badge/open%20items%20mapped-1M%2B-0969da?style=for-the-badge" />
<img src="https://img.shields.io/badge/repository%20expansion-1%E2%86%92N-8250df?style=for-the-badge" />
<img src="https://img.shields.io/badge/retrieval%20time-sub--5ms-f0883e?style=for-the-badge" />

<br />


### Sift is an open-source spatial engine that transforms GitHub into a searchable 3D landscape

[docs](#local-development) · [architecture](#architecture) · [features](#features) · [contribute](#contributing)  · [site](https://sift-opensource.vercel.app) 


</div>

---


<div align="center">
  
## Contributing

<a href="https://github.com/v1shay/sift/issues/6">
  <img src="https://img.shields.io/badge/current-issue%20%236%20·%20new%20features-238636?style=for-the-badge" />
</a>

<a href="https://github.com/v1shay/sift/issues">
  <img src="https://img.shields.io/badge/issues-view%20all-0969da?style=for-the-badge" />
</a>

<a href="https://github.com/v1shay/sift/issues/new">
  <img src="https://img.shields.io/badge/discussion-open%20an%20issue-8250df?style=for-the-badge" />
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

‎ 

<div align=center>
  
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
</div>

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
