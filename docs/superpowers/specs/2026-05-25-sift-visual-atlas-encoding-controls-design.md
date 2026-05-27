# SIFT Visual Atlas Encoding Controls Design

## Goal

Build the first SIFT Visual Atlas pass on `main`: smarter data-encoded atlas controls, a clear View Encoding panel, light intent-aware search ranking, and reliable owner/repo loading.

This pass must keep SIFT as SIFT. Package metadata, run scripts, and UI copy must not retain `fake-3d-render` drift.

## Scope

Included:

- Height scaling controls for `stars`, `contributors`, and `activity`.
- Cluster controls for `stack`, `stars`, `trending`, and `response time`.
- Compact controls in the current search/control cluster plus an expandable View Encoding panel.
- Shared scoring/ranking helpers that can later move backend-side.
- Light local search upgrade that interprets user intent and sentiment without embeddings.
- Owner/repo import reliability: import, persist, refresh, focus/open, search visibility, and reload survival.
- Tests for scoring helpers, UI controls, search intent, and import persistence.

Deferred:

- GitHub login.
- One-button import of all user repositories.
- Full embedding/vector search.
- Google Jules, Codex, Claude Code account connections.
- Sandbox PR bots and persistent agent workflows.
- Major terrain/building art overhaul.

## Product Behavior

The atlas should answer three user questions without requiring them to read docs:

- Why is this building tall?
- Why are these repos near each other?
- Why is this repo recommended for me?

Height scale controls change building height and related legends:

- `stars`: height tracks popularity.
- `contributors`: height tracks community size.
- `activity`: height tracks recent work and open contribution surface.

Cluster mode controls change how repos are ranked and visually grouped:

- `stack`: current ecosystem/topic grouping.
- `stars`: high-star landmarks are emphasized, low-star repos still remain discoverable.
- `trending`: active repos with recent work and strong issue/PR movement rise visually.
- `response`: repos with better maintainer-response health and contribution safety rise visually.

Search should understand intent enough to rank useful repos:

- "beginner friendly AI repo with fast maintainers" boosts AI/topic matches, good-first issues, safety, and response health.
- "popular infra project" boosts infrastructure topics and stars.
- "underrated active repo" boosts lower-star repos with high activity, open work, and reasonable safety.

Owner/repo loading should behave like a real product feature:

- Valid `owner/repo` input shows a loading state.
- Success refreshes the graph, adds the repo to loaded today, opens/focuses the repo, and makes it searchable.
- Duplicate import reports that the repo is already modeled and still focuses it.
- Failure explains whether the input, GitHub fetch, backend persistence, or graph refresh failed.

## Architecture

Use a hybrid frontend-first architecture. The first implementation lives in frontend helpers and UI state, but the helper boundaries should be clean enough to move backend-side later.

New or refactored frontend units:

- `frontend/lib/repoMetrics.ts`
  - Pure functions for metrics and ranking.
  - Exports `scoreTrending(repo)`, `estimateResponseHealth(repo)`, `scoreContributionSafety(repo)`, `clusterRank(repo, mode)`, and `rankReposForIntent(query, repos)`.
- `frontend/components/ViewEncodingPanel.tsx`
  - Panel UI for height scale, cluster mode, and visual legends.
  - No data fetching. Receives state and callbacks from the page.
- `frontend/app/page.tsx`
  - Owns selected height scale, cluster mode, import state, selected repo, and graph refresh.
  - Uses helper functions for sorting/search instead of inline ad hoc ranking.

Existing backend endpoints remain the source of truth for graph and import:

- `GET /api/py/graph-full`
- `POST /api/py/repos/import`
- `POST /api/py/safety-score`
- `POST /api/py/pr-flow`

No new auth endpoints are part of this pass.

## Data Model

Use existing repo fields first:

- `stars`
- `contributors`
- `commitsPerWeek`
- `openIssues`
- `openPRs`
- `goodFirstIssues`
- `topics`
- `language`
- `safetyScore`
- `responseHours`
- `pushedAt`
- `recentPullRequests`

Derived values:

- `activityScore`: combines commits per week, open work, recent push freshness, and PR activity.
- `trendingScore`: favors recent activity and open contribution surface, with a smaller stars component.
- `responseHealth`: converts `responseHours` into a normalized health score.
- `contributionSafetyScore`: combines current safety score, good-first issues, response health, branch/maintainer signals when available, and open-work clarity.
- `intentScore`: query-dependent score combining token/topic matches with intent buckets such as beginner, popular, underrated, active, safe, fast, AI, infra, frontend, backend, systems, and docs.

The helper module should return explainable score parts so the UI can show short "why this matched" text.

## UX

Compact control cluster:

- Keep the existing `Height By` buttons visible.
- Add a compact `Cluster` segmented control with Stack, Stars, Trending, Response.
- Add a View Encoding button with an icon and accessible label.

View Encoding panel:

- Shows current height scale and cluster mode.
- Shows concise legends:
  - Height means selected metric.
  - Glow means trending/activity.
  - Safety badge/color means contribution readiness.
  - Routes mean PR/open-work flow.
  - Cluster mode means active grouping/ranking basis.
- Includes short metric explanations, not a long tutorial.

Search UX:

- Preserve the current search box.
- Results should include a short match reason when possible.
- Search should not require an API key or network call in this pass.

Import UX:

- Keep the owner/repo field in the contribution network dock.
- Disable the load button while importing.
- On success or duplicate, focus/open the imported repo.
- On failure, show a specific user-facing message.

## Error Handling

Import handling must distinguish:

- Invalid input format.
- Backend route unavailable.
- GitHub repository not found or rate-limited.
- Backend import succeeded but graph refresh failed.
- Imported repo not visible after refresh.

Graph refresh failures should leave the existing graph visible and show a recoverable status message.

Search/ranking helpers should tolerate missing fields and return stable results.

## Testing

Unit tests:

- Metrics helpers rank high-star repos above low-star repos in `stars` mode.
- Metrics helpers rank active low-star repos above stale high-star repos in `trending` mode.
- Response mode rewards lower `responseHours`.
- Intent search boosts beginner/safe repos for beginner-friendly prompts.
- Intent search boosts low-star active repos for "underrated active" prompts.

Browser smoke tests:

- Height buttons change rendered building height distribution or renderer state.
- Cluster buttons change visual grouping/ranking state.
- View Encoding panel opens and reflects selected controls.
- Search for beginner/safe/AI returns an explainable relevant repo.
- Owner/repo import loads a mocked repo, focuses it, keeps it searchable, and remains visible after reload.

Regression checks:

- `PYTHONPATH=backend python3 -m pytest backend/app/tests/test_issue_doc_fixes.py`
- `npm --prefix frontend run test:camera-focus`
- `npm --prefix frontend run test:regression-smoke`
- `npm --prefix frontend run build` when local package state is clean and aligned with SIFT metadata.

## Rollout

Implement as one SIFT `main` feature branch or direct `main` worktree change, depending on Rushil's preference, but preserve unrelated local changes and avoid staging `fake-3d-render` drift.

Recommended implementation order:

1. Clean package/run-script drift back to SIFT metadata.
2. Add pure metrics tests and helpers.
3. Wire cluster mode into repo ranking and atlas render inputs.
4. Extract/add View Encoding panel.
5. Upgrade local intent search using helpers.
6. Harden import success/duplicate/failure flow.
7. Add browser smoke coverage.
8. Run backend, build, and browser checks.

## Non-Goals

This design does not create authentication, agent execution, sandbox infrastructure, billing, or external account integrations. Those require separate specs because they involve secrets, permissions, long-running jobs, and user trust boundaries.

## Open Follow-Up Specs

Next recommended specs:

1. GitHub login and one-button import all my repositories.
2. Full discovery engine with backend/vector search and smarter global repo ingestion.
3. Visual world polish with richer terrain and more diverse building structures.
4. Agent PR bot system with sandboxing, audit logs, permissions, queues, and persistence.
