from __future__ import annotations

import sys
import zlib
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlalchemy.exc import IntegrityError

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.db.models.base import Base
from app.db.models.project import Project, Topic
from app.db.models.user import User
from app.db.session import SessionLocal, engine


def stable_id(namespace: str, value: str) -> int:
    base = 10_000_000_000 if namespace == "project" else 20_000_000_000
    return base + zlib.crc32(value.lower().encode("utf-8"))


def parse_date(value: str) -> datetime:
    return datetime.strptime(value, "%Y-%m-%d")


def repo(
    full_name: str,
    description: str,
    language: str,
    stars: int,
    forks: int,
    open_issues: int,
    topics: list[str],
    *,
    license_spdx: str = "MIT",
    homepage: str | None = None,
    beginner: bool = False,
    pushed_at: str = "2026-05-01",
) -> dict[str, Any]:
    owner, name = full_name.split("/", 1)
    return {
        "github_id": stable_id("project", full_name),
        "owner_github_id": stable_id("owner", owner),
        "owner": owner,
        "name": name,
        "full_name": full_name,
        "description": description,
        "url": f"https://github.com/{full_name}",
        "homepage": homepage,
        "language": language,
        "stars": stars,
        "forks": forks,
        "open_issues": open_issues,
        "watchers": stars,
        "license_spdx": license_spdx,
        "is_beginner_friendly": beginner,
        "created_at": parse_date("2020-01-01"),
        "updated_at": parse_date(pushed_at),
        "pushed_at": parse_date(pushed_at),
        "topics": topics,
    }


CURATED_REPOS = [
    repo("huggingface/transformers", "Transformer models and tooling for NLP, vision, audio, and multimodal AI.", "Python", 148000, 30000, 1150, ["machine-learning", "llm", "nlp", "deep-learning", "transformers"], beginner=True, license_spdx="Apache-2.0"),
    repo("ollama/ollama", "Run and manage local language models with a developer-friendly CLI and server.", "Go", 150000, 12000, 720, ["llm", "local-ai", "developer-tools", "inference"], beginner=True),
    repo("openai/openai-python", "Official Python client library for the OpenAI API.", "Python", 26000, 3600, 140, ["ai", "api", "python", "sdk"], beginner=True, license_spdx="Apache-2.0"),
    repo("microsoft/autogen", "Multi-agent AI application framework for building and evaluating agent workflows.", "Python", 45000, 7200, 620, ["agents", "ai", "llm", "automation"], beginner=True),
    repo("crewAIInc/crewAI", "Framework for orchestrating role-based autonomous AI agents.", "Python", 32000, 4200, 310, ["agents", "llm", "automation", "ai"]),
    repo("run-llama/llama_index", "Data framework for connecting private data to LLM applications.", "Python", 41000, 5800, 880, ["rag", "llm", "data", "ai"], beginner=True),
    repo("milvus-io/milvus", "Vector database built for scalable similarity search and retrieval augmented generation.", "Go", 36000, 3200, 520, ["vector-database", "rag", "database", "ai"], license_spdx="Apache-2.0"),
    repo("qdrant/qdrant", "High-performance vector search engine and database written in Rust.", "Rust", 25000, 1700, 300, ["vector-database", "rust", "search", "ai"], beginner=True, license_spdx="Apache-2.0"),
    repo("weaviate/weaviate", "Open-source vector database for AI-native applications.", "Go", 12000, 900, 360, ["vector-database", "search", "database", "ai"], license_spdx="BSD-3-Clause"),
    repo("ray-project/ray", "Distributed compute framework for scaling Python and AI workloads.", "Python", 36000, 6400, 2600, ["distributed-systems", "python", "machine-learning", "infrastructure"], license_spdx="Apache-2.0"),
    repo("bentoml/BentoML", "Model serving framework for building reliable AI applications.", "Python", 7800, 920, 210, ["model-serving", "mlops", "python", "ai"], beginner=True, license_spdx="Apache-2.0"),
    repo("langfuse/langfuse", "Open-source observability and analytics platform for LLM applications.", "TypeScript", 9000, 850, 230, ["observability", "llm", "analytics", "ai"], beginner=True),

    repo("vuejs/core", "Progressive JavaScript framework for building user interfaces.", "TypeScript", 47000, 8200, 700, ["frontend", "framework", "ui", "javascript"], beginner=True),
    repo("sveltejs/svelte", "Compiler-driven UI framework for building fast web applications.", "TypeScript", 84000, 4600, 760, ["frontend", "compiler", "framework", "ui"], beginner=True),
    repo("angular/angular", "Web framework for building scalable client applications.", "TypeScript", 99000, 26000, 1700, ["frontend", "framework", "typescript", "web"], license_spdx="MIT"),
    repo("remix-run/remix", "Full-stack web framework focused on web standards and nested routing.", "TypeScript", 31000, 2600, 330, ["frontend", "framework", "react", "web"], beginner=True),
    repo("astro-build/astro", "Content-driven web framework for fast sites and islands architecture.", "TypeScript", 50000, 2600, 430, ["frontend", "static-site", "framework", "web"], beginner=True),
    repo("storybookjs/storybook", "Frontend workshop for developing and testing UI components.", "TypeScript", 87000, 9300, 2100, ["frontend", "components", "testing", "design-system"], beginner=True),
    repo("chakra-ui/chakra-ui", "Accessible React component system and design primitives.", "TypeScript", 38000, 3300, 500, ["frontend", "components", "react", "design-system"], beginner=True),
    repo("mui/material-ui", "React component library implementing Material Design.", "TypeScript", 95000, 32000, 1700, ["frontend", "components", "react", "design-system"], beginner=True),
    repo("ant-design/ant-design", "Enterprise-class React UI design language and component library.", "TypeScript", 93000, 49000, 1400, ["frontend", "components", "react", "design-system"]),
    repo("TanStack/query", "Async state management and data fetching primitives for web applications.", "TypeScript", 42000, 2500, 500, ["frontend", "data-fetching", "react", "typescript"], beginner=True),
    repo("pmndrs/react-three-fiber", "React renderer for Three.js and interactive 3D web experiences.", "TypeScript", 29000, 1500, 210, ["frontend", "threejs", "3d", "react"], beginner=True),
    repo("tailwindlabs/tailwindcss", "Utility-first CSS framework for rapidly building custom interfaces.", "TypeScript", 91000, 4600, 320, ["css", "frontend", "design-system", "tailwind"], beginner=True),

    repo("nodejs/node", "JavaScript runtime built on Chrome's V8 engine.", "JavaScript", 110000, 31000, 1600, ["runtime", "javascript", "systems", "server"], license_spdx="MIT"),
    repo("golang/go", "The Go programming language, standard library, and tooling.", "Go", 125000, 18000, 9200, ["language", "compiler", "systems", "go"], license_spdx="BSD-3-Clause"),
    repo("python/cpython", "The Python programming language reference implementation.", "Python", 68000, 32000, 8400, ["language", "compiler", "runtime", "python"], license_spdx="Python-2.0"),
    repo("llvm/llvm-project", "LLVM compiler infrastructure, Clang, and related toolchains.", "C++", 33000, 15000, 6400, ["compiler", "systems", "c-plus-plus", "toolchain"], license_spdx="Apache-2.0"),
    repo("ziglang/zig", "General-purpose programming language and toolchain for robust optimal software.", "Zig", 36000, 2500, 2100, ["language", "compiler", "systems"], beginner=True),
    repo("rust-lang/cargo", "Rust package manager and build tool.", "Rust", 13000, 2600, 1700, ["rust", "build-tool", "package-manager", "developer-tools"], beginner=True),
    repo("tokio-rs/tokio", "Asynchronous runtime for Rust network applications.", "Rust", 29000, 2700, 360, ["rust", "runtime", "networking", "async"], beginner=True),
    repo("hyperium/hyper", "Fast and correct HTTP implementation for Rust.", "Rust", 15000, 1600, 250, ["rust", "http", "networking", "systems"], beginner=True),
    repo("libuv/libuv", "Cross-platform asynchronous I/O library used by Node.js.", "C", 25000, 3600, 250, ["systems", "runtime", "c", "networking"], license_spdx="MIT"),

    repo("hashicorp/terraform", "Infrastructure as code tool for building and changing cloud resources.", "Go", 44000, 9800, 1700, ["infrastructure", "iac", "cloud", "devops"], license_spdx="MPL-2.0"),
    repo("ansible/ansible", "Automation platform for configuration management and app deployment.", "Python", 65000, 25000, 3900, ["automation", "devops", "infrastructure", "python"], license_spdx="GPL-3.0"),
    repo("prometheus/prometheus", "Monitoring system and time-series database.", "Go", 60000, 9500, 850, ["monitoring", "observability", "metrics", "go"], beginner=True, license_spdx="Apache-2.0"),
    repo("grafana/grafana", "Dashboards and observability platform for metrics, logs, and traces.", "TypeScript", 67000, 13000, 3900, ["observability", "monitoring", "dashboards", "typescript"], beginner=True, license_spdx="AGPL-3.0"),
    repo("open-telemetry/opentelemetry-collector", "Vendor-neutral collector for telemetry pipelines.", "Go", 5600, 1800, 830, ["observability", "tracing", "metrics", "go"], beginner=True, license_spdx="Apache-2.0"),
    repo("envoyproxy/envoy", "Cloud-native high-performance edge and service proxy.", "C++", 25000, 5000, 1500, ["proxy", "networking", "infrastructure", "c-plus-plus"], license_spdx="Apache-2.0"),
    repo("traefik/traefik", "Cloud-native application proxy and ingress controller.", "Go", 52000, 5200, 720, ["proxy", "cloud", "devops", "go"], beginner=True),
    repo("caddyserver/caddy", "Extensible web server with automatic HTTPS.", "Go", 62000, 4300, 520, ["server", "proxy", "https", "go"], beginner=True, license_spdx="Apache-2.0"),
    repo("tailscale/tailscale", "Private WireGuard networks made simple.", "Go", 23000, 1800, 650, ["networking", "security", "wireguard", "go"], beginner=True, license_spdx="BSD-3-Clause"),
    repo("minio/minio", "High-performance S3-compatible object store.", "Go", 51000, 5800, 310, ["storage", "s3", "cloud", "go"], license_spdx="AGPL-3.0"),
    repo("argoproj/argo-cd", "Declarative continuous delivery for Kubernetes.", "Go", 19000, 5900, 1800, ["kubernetes", "devops", "gitops", "continuous-delivery"], beginner=True, license_spdx="Apache-2.0"),
    repo("helm/helm", "Kubernetes package manager.", "Go", 27000, 7500, 680, ["kubernetes", "package-manager", "devops", "go"], beginner=True, license_spdx="Apache-2.0"),
    repo("k3s-io/k3s", "Lightweight Kubernetes distribution for edge and local environments.", "Go", 30000, 2500, 420, ["kubernetes", "edge", "infrastructure", "go"], beginner=True, license_spdx="Apache-2.0"),
    repo("crossplane/crossplane", "Cloud-native control planes and infrastructure orchestration.", "Go", 10000, 1000, 560, ["cloud", "kubernetes", "control-plane", "infrastructure"], beginner=True, license_spdx="Apache-2.0"),
    repo("pulumi/pulumi", "Infrastructure as code with general-purpose programming languages.", "Go", 22000, 1200, 1000, ["iac", "cloud", "devops", "automation"], beginner=True, license_spdx="Apache-2.0"),

    repo("apache/airflow", "Platform for authoring, scheduling, and monitoring data pipelines.", "Python", 38000, 15000, 2100, ["data-engineering", "workflow", "python", "automation"], beginner=True, license_spdx="Apache-2.0"),
    repo("dbt-labs/dbt-core", "Analytics engineering framework for transforming data in warehouses.", "Python", 11000, 1900, 520, ["data-engineering", "analytics", "sql", "python"], beginner=True, license_spdx="Apache-2.0"),
    repo("apache/superset", "Modern data exploration and visualization platform.", "TypeScript", 62000, 14000, 1100, ["data", "visualization", "dashboard", "analytics"], beginner=True, license_spdx="Apache-2.0"),
    repo("metabase/metabase", "Business intelligence and analytics tool for teams.", "Clojure", 42000, 5400, 3000, ["analytics", "dashboard", "database", "clojure"], beginner=True, license_spdx="AGPL-3.0"),
    repo("duckdb/duckdb", "In-process analytical database management system.", "C++", 29000, 2500, 1300, ["database", "analytics", "sql", "c-plus-plus"], license_spdx="MIT"),
    repo("ClickHouse/ClickHouse", "Column-oriented database for real-time analytical workloads.", "C++", 40000, 7600, 3600, ["database", "analytics", "sql", "c-plus-plus"], license_spdx="Apache-2.0"),
    repo("timescale/timescaledb", "Time-series database built on PostgreSQL.", "C", 18000, 940, 420, ["database", "timeseries", "postgresql", "c"], beginner=True, license_spdx="Apache-2.0"),
    repo("prisma/prisma", "Next-generation ORM and data tooling for TypeScript and Node.js.", "TypeScript", 42000, 1700, 2200, ["database", "orm", "typescript", "developer-tools"], beginner=True, license_spdx="Apache-2.0"),
    repo("supabase/supabase", "Open-source Firebase alternative with Postgres, auth, storage, and realtime.", "TypeScript", 80000, 7200, 620, ["database", "postgresql", "backend", "typescript"], beginner=True, license_spdx="Apache-2.0"),
    repo("PostgREST/postgrest", "Serve a fully RESTful API from an existing PostgreSQL database.", "Haskell", 25000, 1100, 240, ["database", "api", "postgresql", "haskell"], beginner=True),
    repo("hasura/graphql-engine", "GraphQL APIs over databases with authorization and events.", "Haskell", 31000, 2800, 1500, ["database", "graphql", "api", "backend"], beginner=True, license_spdx="Apache-2.0"),
    repo("temporalio/temporal", "Durable execution platform for reliable services and workflows.", "Go", 13000, 1100, 520, ["workflow", "distributed-systems", "backend", "go"], beginner=True, license_spdx="MIT"),
    repo("celery/celery", "Distributed task queue for Python applications.", "Python", 26000, 4700, 700, ["queue", "python", "backend", "distributed-systems"], beginner=True),
    repo("tiangolo/fastapi", "Fast Python web framework for APIs based on standard type hints.", "Python", 84000, 7600, 520, ["api", "python", "backend", "web"], beginner=True),
    repo("django/django", "High-level Python web framework with batteries included.", "Python", 80000, 32000, 1100, ["web", "backend", "python", "framework"], beginner=True, license_spdx="BSD-3-Clause"),
    repo("rails/rails", "Ruby on Rails web application framework.", "Ruby", 57000, 22000, 1500, ["web", "backend", "ruby", "framework"], beginner=True),
    repo("laravel/framework", "PHP web application framework with expressive developer ergonomics.", "PHP", 33000, 11000, 60, ["web", "backend", "php", "framework"], beginner=True),
    repo("spring-projects/spring-boot", "Spring Boot framework for production-grade Java applications.", "Java", 77000, 41000, 620, ["web", "backend", "java", "framework"], license_spdx="Apache-2.0"),

    repo("bitwarden/server", "Core infrastructure backend for Bitwarden password management.", "C#", 16000, 1300, 420, ["security", "password-manager", "backend", "c-sharp"], beginner=True, license_spdx="AGPL-3.0"),
    repo("goauthentik/authentik", "Open-source identity provider for authentication and authorization.", "Python", 13000, 950, 720, ["security", "auth", "identity", "python"], beginner=True),
    repo("authelia/authelia", "Single sign-on and authentication portal for self-hosted infrastructure.", "Go", 24000, 1200, 320, ["security", "auth", "sso", "go"], beginner=True, license_spdx="Apache-2.0"),
    repo("zitadel/zitadel", "Identity infrastructure and authentication platform.", "Go", 10000, 750, 460, ["security", "auth", "identity", "go"], beginner=True, license_spdx="Apache-2.0"),
    repo("trufflesecurity/trufflehog", "Secret scanning tool for finding leaked credentials.", "Go", 19000, 1900, 170, ["security", "secrets", "devtools", "go"], beginner=True, license_spdx="AGPL-3.0"),
    repo("gitleaks/gitleaks", "Detect hardcoded secrets in git repos and files.", "Go", 19000, 1600, 170, ["security", "secrets", "developer-tools", "go"], beginner=True),
    repo("semgrep/semgrep", "Static analysis engine for finding bugs and security issues.", "Python", 11000, 780, 720, ["security", "static-analysis", "developer-tools", "python"], beginner=True, license_spdx="LGPL-2.1"),
    repo("juice-shop/juice-shop", "OWASP intentionally vulnerable web app for security education.", "TypeScript", 11000, 9300, 360, ["security", "education", "web", "testing"], beginner=True, license_spdx="MIT"),
    repo("aquasecurity/trivy", "Scanner for vulnerabilities, misconfigurations, secrets, and SBOMs.", "Go", 26000, 2600, 640, ["security", "scanner", "containers", "go"], beginner=True, license_spdx="Apache-2.0"),
    repo("sigstore/cosign", "Container signing, verification, and storage in an OCI registry.", "Go", 4600, 680, 310, ["security", "supply-chain", "containers", "go"], beginner=True, license_spdx="Apache-2.0"),
    repo("falcosecurity/falco", "Cloud-native runtime security project.", "C++", 7400, 1200, 480, ["security", "runtime", "kubernetes", "c-plus-plus"], beginner=True, license_spdx="Apache-2.0"),

    repo("zed-industries/zed", "High-performance collaborative code editor.", "Rust", 49000, 3400, 2200, ["editor", "developer-tools", "rust", "collaboration"], beginner=True),
    repo("helix-editor/helix", "Modal text editor written in Rust with tree-sitter integration.", "Rust", 36000, 2800, 1200, ["editor", "rust", "terminal", "developer-tools"], beginner=True),
    repo("sharkdp/fd", "Simple, fast, and user-friendly alternative to find.", "Rust", 35000, 900, 120, ["cli", "rust", "developer-tools", "terminal"], beginner=True),
    repo("BurntSushi/ripgrep", "Line-oriented search tool that recursively searches directories.", "Rust", 52000, 2200, 260, ["cli", "rust", "search", "developer-tools"], beginner=True),
    repo("nushell/nushell", "A shell with structured data pipelines.", "Rust", 34000, 1700, 1600, ["cli", "shell", "rust", "developer-tools"], beginner=True),
    repo("starship/starship", "Cross-shell prompt written in Rust.", "Rust", 48000, 2100, 520, ["cli", "terminal", "rust", "developer-tools"], beginner=True),
    repo("jdx/mise", "Development environment tool for runtimes, tasks, and env vars.", "Rust", 17000, 430, 330, ["cli", "developer-tools", "runtime", "rust"], beginner=True),
    repo("casey/just", "Command runner for project-specific recipes.", "Rust", 25000, 800, 260, ["cli", "developer-tools", "build-tool", "rust"], beginner=True),
    repo("pnpm/pnpm", "Fast disk-space-efficient package manager.", "TypeScript", 32000, 1100, 1200, ["package-manager", "javascript", "developer-tools", "typescript"], beginner=True),
    repo("biomejs/biome", "Fast formatter and linter for web projects.", "Rust", 19000, 650, 720, ["linter", "formatter", "developer-tools", "rust"], beginner=True),
    repo("prettier/prettier", "Opinionated code formatter.", "JavaScript", 50000, 4400, 900, ["formatter", "javascript", "developer-tools"], beginner=True),
    repo("eslint/eslint", "Find and fix problems in JavaScript code.", "JavaScript", 26000, 4600, 950, ["linter", "javascript", "developer-tools"], beginner=True),
    repo("vitest-dev/vitest", "Fast Vite-native testing framework.", "TypeScript", 14000, 950, 520, ["testing", "typescript", "frontend", "developer-tools"], beginner=True),
    repo("microsoft/playwright", "End-to-end testing and browser automation framework.", "TypeScript", 73000, 4100, 1000, ["testing", "browser", "automation", "developer-tools"], beginner=True, license_spdx="Apache-2.0"),
    repo("cypress-io/cypress", "JavaScript end-to-end testing framework.", "JavaScript", 48000, 3200, 2400, ["testing", "browser", "automation", "javascript"], beginner=True),

    repo("godotengine/godot", "Open-source game engine for 2D and 3D games.", "C++", 92000, 19000, 6800, ["game-engine", "graphics", "c-plus-plus", "creative"], beginner=True),
    repo("blender/blender", "3D creation suite for modeling, animation, rendering, and compositing.", "C++", 14000, 3100, 6200, ["graphics", "3d", "creative", "c-plus-plus"], license_spdx="GPL-3.0"),
    repo("penpot/penpot", "Open-source design and prototyping platform.", "Clojure", 36000, 1800, 820, ["design", "prototyping", "frontend", "creative"], beginner=True),
    repo("excalidraw/excalidraw", "Virtual whiteboard for sketching diagrams and ideas.", "TypeScript", 96000, 9200, 650, ["design", "whiteboard", "frontend", "typescript"], beginner=True),
    repo("tldraw/tldraw", "Infinite canvas SDK and whiteboard application.", "TypeScript", 36000, 2300, 400, ["design", "canvas", "frontend", "typescript"], beginner=True),
    repo("logseq/logseq", "Privacy-first knowledge base and outlining tool.", "Clojure", 37000, 2200, 1600, ["knowledge-base", "productivity", "notes", "open-source"], beginner=True),
    repo("immich-app/immich", "Self-hosted photo and video backup solution.", "TypeScript", 64000, 3300, 1900, ["self-hosted", "photos", "typescript", "mobile"], beginner=True),
    repo("jellyfin/jellyfin", "Free software media system.", "C#", 40000, 3600, 1100, ["self-hosted", "media", "server", "c-sharp"], beginner=True, license_spdx="GPL-2.0"),
    repo("mastodon/mastodon", "Decentralized social networking server.", "Ruby", 47000, 7000, 3900, ["federated", "social", "ruby", "web"], beginner=True, license_spdx="AGPL-3.0"),
    repo("matrix-org/synapse", "Matrix homeserver implementation.", "Python", 12000, 2200, 1300, ["messaging", "federated", "python", "server"], beginner=True, license_spdx="AGPL-3.0"),
    repo("RocketChat/Rocket.Chat", "Open-source communications platform for teams.", "TypeScript", 43000, 11000, 4000, ["chat", "collaboration", "typescript", "self-hosted"], beginner=True, license_spdx="MIT"),
]


def get_or_create_topic(db, name: str) -> Topic:
    normalized = name.lower()
    topic = db.query(Topic).filter(Topic.name == normalized).first()
    if topic:
        return topic
    topic = Topic(name=normalized)
    db.add(topic)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        topic = db.query(Topic).filter(Topic.name == normalized).first()
        if not topic:
            raise
    return topic


def get_or_create_owner(db, data: dict[str, Any]) -> User:
    owner = db.query(User).filter(User.login == data["owner"]).first()
    if owner:
        return owner
    owner = db.query(User).filter(User.github_id == data["owner_github_id"]).first()
    if owner:
        return owner
    owner = User(
        github_id=data["owner_github_id"],
        login=data["owner"],
        avatar_url=f"https://github.com/{data['owner']}.png",
        url=f"https://github.com/{data['owner']}",
    )
    db.add(owner)
    db.flush()
    return owner


def upsert_repo(db, data: dict[str, Any]) -> bool:
    owner = get_or_create_owner(db, data)
    project = db.query(Project).filter(Project.full_name == data["full_name"]).first()
    created = project is None
    if project is None:
        project = db.query(Project).filter(Project.github_id == data["github_id"]).first()

    fields = {
        "name": data["name"],
        "full_name": data["full_name"],
        "description": data["description"],
        "url": data["url"],
        "homepage": data["homepage"],
        "language": data["language"],
        "stars": data["stars"],
        "forks": data["forks"],
        "open_issues": data["open_issues"],
        "watchers": data["watchers"],
        "license_spdx": data["license_spdx"],
        "is_beginner_friendly": data["is_beginner_friendly"],
        "created_at": data["created_at"],
        "updated_at": data["updated_at"],
        "pushed_at": data["pushed_at"],
        "owner_id": owner.id,
    }

    if project is None:
        project = Project(github_id=data["github_id"], **fields)
        db.add(project)
        db.flush()
    else:
        for key, value in fields.items():
            setattr(project, key, value)

    project.topics = [get_or_create_topic(db, topic) for topic in data["topics"]]
    return created


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    created = 0
    updated = 0

    try:
        for item in CURATED_REPOS:
            if upsert_repo(db, item):
                created += 1
            else:
                updated += 1
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    print(f"Seeded curated repos: {created} created, {updated} updated, {len(CURATED_REPOS)} total processed.")


if __name__ == "__main__":
    main()
