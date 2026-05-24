# Sift Vercel Deployment Runbook

This repo deploys to Vercel as one project:

- `frontend/` is the Next.js app.
- `api/index.py` is the Vercel Python serverless entrypoint.
- `backend/app/main.py` is the FastAPI app mounted behind `/api/py/*`, `/api/github/*`, and `/health`.
- `backend/sift.db` is the bundled read-only SQLite database used by the graph APIs.

## Vercel Project Settings

Use these exact settings when importing the GitHub repo into Vercel:

| Setting | Value |
|---|---|
| Framework Preset | Other |
| Root Directory | `.` |
| Build Command | Leave empty |
| Output Directory | Leave empty |
| Install Command | Leave empty |

Do not set the root directory to `frontend`, because Vercel also needs `api/index.py`, `backend/app`, `backend/sift.db`, and the root `requirements.txt`.

The root `vercel.json` handles both runtimes:

- `frontend/package.json` builds the Next.js frontend with `@vercel/next`.
- `api/index.py` builds the FastAPI backend with `@vercel/python`.
- `/api/py/*`, `/api/github/*`, and `/health` route to FastAPI.
- Everything else routes to the frontend.

This file intentionally uses Vercel's legacy `builds` array because Sift is a mixed-runtime repo with the Next.js app in `frontend/` and the Python API at the repo root. Do not add a top-level `functions` block while `builds` is present; Vercel rejects that combination.

## Required Environment Variables

Set these in Vercel Project Settings -> Environment Variables for Production, Preview, and Development unless noted.

| Name | Required | Runtime | Value |
|---|---:|---|---|
| `OPENROUTER_API_KEY` | Yes | Backend | Your OpenRouter key. Required for `/api/py/graph-search` unless local fallback is enabled. |
| `OPENROUTER_MODEL` | Yes | Backend | `openai/gpt-4o-mini` |
| `LLM_PROVIDER` | Yes | Backend | `openrouter` |
| `ALLOW_LOCAL_QUERY_FALLBACK` | Yes | Backend | `false` for production, `true` only if you want non-LLM fallback behavior. |
| `GITHUB_TOKEN` | Recommended | Backend and server-side frontend code | A GitHub fine-grained or classic token for higher GitHub API rate limits. |
| `GITHUB_CLIENT_ID` | Required for OAuth | Backend | GitHub OAuth App client ID. |
| `GITHUB_CLIENT_SECRET` | Required for OAuth | Backend | GitHub OAuth App client secret. |
| `BACKEND_PUBLIC_URL` | Recommended | Backend | Your production URL, for example `https://sift.example.com` or `https://<project>.vercel.app`. |
| `DATABASE_URL` | Optional | Backend | Leave unset for bundled SQLite. If set, use `sqlite:////var/task/backend/sift.db` only for the bundled read-only DB, or use an external Postgres URL after migrating the schema/data. |
| `ANTHROPIC_API_KEY` | Optional | Frontend server route only | Only needed if you revive `frontend/lib/llm.ts` or `/api/chat`; current UI calls `/api/py/*` directly. |
| `GITHUB_APP_ID` | Optional | Backend GitHub App token helper | Only needed if you wire installation-token flows. |
| `GITHUB_PEM_PATH` | Optional | Backend GitHub App token helper | Not recommended on Vercel. Prefer storing private-key content in an env var and updating the helper before using this path-based flow. |
| `OLLAMA_URL` | No | Local only | Do not use on Vercel. Vercel cannot reach your local Ollama daemon. |
| `OLLAMA_MODEL` | No | Local only | Do not use on Vercel. |

Do not commit `.env`, `backend/.env`, GitHub private keys, Vercel tokens, or OAuth secrets.

## GitHub OAuth Setup

Create or update a GitHub OAuth App:

1. Open GitHub -> Settings -> Developer settings -> OAuth Apps.
2. Set Homepage URL to your production Vercel URL.
3. Set Authorization callback URL to:

```txt
https://<your-vercel-domain>/api/github/callback
```

For local development, use:

```txt
http://127.0.0.1:3000/api/github/callback
```

If you use both production and preview deployments, create a separate OAuth App for preview or update the callback while testing a preview URL. GitHub OAuth Apps allow one callback URL per app.

## Database Provider Notes

The current deployment is read-only SQLite:

- `backend/sift.db` is committed and included in the Python function bundle.
- The FastAPI app defaults to that file when `DATABASE_URL` is unset.
- This works for graph browsing and search over the bundled data.

Use an external database before adding write-heavy production features:

1. Create a Vercel Postgres, Neon, Supabase, or other managed Postgres database.
2. Set `DATABASE_URL` to the Postgres connection string.
3. Run Alembic migrations and seed/backfill scripts against that database.
4. Confirm `backend/app/db/session.py` and the SQLAlchemy models work with the provider.

SQLite inside a Vercel serverless function should be treated as immutable deployment data.

## Deploy Steps

1. Push the repo to GitHub.
2. In Vercel, import `v1shay/sift`.
3. Use Root Directory `.`.
4. Keep build/install/output settings empty so `vercel.json` controls the deploy.
5. Add the environment variables listed above.
6. Deploy.
7. Test these URLs after deployment:

```txt
https://<your-vercel-domain>/health
https://<your-vercel-domain>/api/py/graph-facets
https://<your-vercel-domain>/api/py/graph-full?limit=25
https://<your-vercel-domain>/
```

8. Test OAuth by opening:

```txt
https://<your-vercel-domain>/api/github/auth
```

## Local Verification Commands

From the repo root:

```bash
python3 -m pytest backend/app/tests
cd frontend
npm run build
```

For a Vercel-like check:

```bash
npx vercel build
```

Use `vercel deploy --prebuilt` after a successful local Vercel build, or let the GitHub integration deploy automatically on push.
