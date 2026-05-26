# SIFT Visual Atlas Encoding Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved Visual Atlas First pass on `main`: smarter height/cluster controls, explainable local intent search, reliable owner/repo loading, and regression coverage while keeping SIFT package identity clean.

**Architecture:** Keep the first pass frontend-first with pure metric helpers in `frontend/lib/repoMetrics.mjs`, typed declarations beside it, and page state in `frontend/app/page.tsx`. The 3D renderer keeps district geometry but receives ranked repos from the helper so height and cluster modes affect visible atlas ordering without changing backend contracts.

**Tech Stack:** Next.js 14, React 18, Three.js, lucide-react, Playwright smoke scripts, Node ESM helper tests, existing FastAPI backend endpoints.

---

## File Structure

- Modify `frontend/package.json` and lockfiles only to restore SIFT metadata and add `test:repo-metrics`.
- Restore Next 14-compatible config drift in `frontend/next-env.d.ts`, `frontend/next.config.mjs`, `frontend/tailwind.config.ts`, `frontend/tsconfig.json`, `frontend/app/projects/[id]/page.tsx`, `package.json`, `package-lock.json`, and `run.sh`.
- Create `frontend/lib/repoMetrics.mjs`: pure scoring, cluster ranking, and intent search helpers.
- Create `frontend/lib/repoMetrics.d.ts`: lightweight TypeScript surface for page imports.
- Create `frontend/components/ViewEncodingPanel.tsx`: controlled panel for height scale, cluster mode, and legends.
- Modify `frontend/app/page.tsx`: import helpers/panel, add `clusterMode` and panel state, replace inline search with helper ranking, use helper ranking for visual district selection, harden import status/focus.
- Create `frontend/scripts/repo-metrics-test.mjs`: fast Node tests for score/ranking behavior.
- Modify `frontend/scripts/sift-regression-smoke.mjs`: verify height controls, cluster controls, View Encoding panel, explainable intent search, and mocked import persistence.
- Run existing backend/frontend checks before handoff.

## Task 1: Clean Package And Runtime Drift

**Files:**
- Restore: `frontend/package.json`
- Restore: `frontend/package-lock.json`
- Restore: `package.json`
- Restore: `package-lock.json`
- Restore: `frontend/next-env.d.ts`
- Restore: `frontend/next.config.mjs`
- Restore: `frontend/tailwind.config.ts`
- Restore: `frontend/tsconfig.json`
- Restore: `frontend/app/projects/[id]/page.tsx`
- Restore: `run.sh`
- Restore generated Python bytecode under `backend/app/**/__pycache__`

- [ ] **Step 1: Restore fake3d/Next 15 drift to the committed SIFT baseline**

Run:

```bash
git restore frontend/package.json frontend/package-lock.json package.json package-lock.json frontend/next-env.d.ts frontend/next.config.mjs frontend/tailwind.config.ts frontend/tsconfig.json 'frontend/app/projects/[id]/page.tsx' run.sh backend/app/__pycache__/main.cpython-313.pyc backend/app/db/__pycache__/session.cpython-313.pyc backend/app/db/models/__pycache__/base.cpython-313.pyc backend/app/db/models/__pycache__/project.cpython-313.pyc backend/app/db/models/__pycache__/user.cpython-313.pyc backend/app/services/github/__pycache__/pull_requests.cpython-313.pyc backend/app/services/llm/__pycache__/query_parser.cpython-313.pyc backend/app/services/ranking/__pycache__/score.cpython-313.pyc backend/app/services/ranking/__pycache__/weights.cpython-313.pyc backend/app/services/search_pipeline/__pycache__/orchestrator.cpython-313.pyc
```

Expected: `frontend/package.json` returns to `"name": "sift-frontend"` and `next: "14.2.3"`.

- [ ] **Step 2: Confirm only real SIFT atlas files remain dirty**

Run:

```bash
git status --short
git diff -- frontend/package.json run.sh package.json
```

Expected: no fake3d text remains; remaining dirty files are the plan and intentional SIFT frontend implementation files.

## Task 2: Metrics Helper And Unit Tests

**Files:**
- Create: `frontend/lib/repoMetrics.mjs`
- Create: `frontend/lib/repoMetrics.d.ts`
- Create: `frontend/scripts/repo-metrics-test.mjs`
- Modify: `frontend/package.json`

- [ ] **Step 1: Write the helper tests**

Create `frontend/scripts/repo-metrics-test.mjs` with tests for star ranking, trending ranking, response health, contribution safety, and intent search:

```js
import assert from 'node:assert/strict';
import {
  estimateResponseHealth,
  rankReposForCluster,
  rankReposForIntent,
  scoreContributionSafety,
  scoreTrending,
} from '../lib/repoMetrics.mjs';

const repo = (overrides) => ({
  id: overrides.id,
  name: overrides.name ?? overrides.id.split('/')[1],
  owner: overrides.owner ?? overrides.id.split('/')[0],
  district: overrides.district ?? 'crystal_fields',
  language: overrides.language ?? 'TypeScript',
  description: overrides.description ?? 'developer tool with starter issues',
  stars: overrides.stars ?? 100,
  forks: overrides.forks ?? 10,
  openPRs: overrides.openPRs ?? 2,
  openIssues: overrides.openIssues ?? 10,
  commitsPerWeek: overrides.commitsPerWeek ?? 5,
  contributors: overrides.contributors ?? 20,
  goodFirstIssues: overrides.goodFirstIssues ?? 2,
  safetyScore: overrides.safetyScore ?? 70,
  verifiedMaintainers: overrides.verifiedMaintainers ?? true,
  branchProtection: overrides.branchProtection ?? true,
  signedReleases: overrides.signedReleases ?? false,
  responseHours: overrides.responseHours ?? 48,
  topics: overrides.topics ?? ['developer-tools'],
  prs: overrides.prs ?? [],
  ...overrides,
});

const landmark = repo({ id: 'big/landmark', stars: 100000, commitsPerWeek: 3, responseHours: 96 });
const activeSmall = repo({ id: 'small/active', stars: 600, commitsPerWeek: 120, openIssues: 75, openPRs: 14, responseHours: 8, goodFirstIssues: 18, safetyScore: 88 });
const staleSmall = repo({ id: 'small/stale', stars: 700, commitsPerWeek: 0, openIssues: 2, responseHours: 240, safetyScore: 42 });

assert.equal(rankReposForCluster([activeSmall, landmark], 'stars')[0].id, 'big/landmark');
assert.equal(rankReposForCluster([landmark, activeSmall], 'trending')[0].id, 'small/active');
assert.ok(estimateResponseHealth(activeSmall) > estimateResponseHealth(landmark));
assert.ok(scoreContributionSafety(activeSmall) > scoreContributionSafety(staleSmall));
assert.ok(scoreTrending(activeSmall) > scoreTrending(landmark));
assert.equal(rankReposForIntent('beginner friendly ai repo with fast maintainers', [landmark, activeSmall])[0].id, 'small/active');
assert.equal(rankReposForIntent('underrated active repo', [landmark, activeSmall])[0].id, 'small/active');

console.log(JSON.stringify({ ok: true }, null, 2));
```

- [ ] **Step 2: Run tests and confirm the expected failure**

Run:

```bash
npm --prefix frontend run test:repo-metrics
```

Expected: FAIL because `test:repo-metrics` and/or `frontend/lib/repoMetrics.mjs` do not exist yet.

- [ ] **Step 3: Implement `frontend/lib/repoMetrics.mjs`**

Create pure functions:

```js
export const CLUSTER_MODES = ['stack', 'stars', 'trending', 'response'];
export const HEIGHT_SCALE_DRIVERS = ['stars', 'activity', 'contributors'];

export function normalizeRepoNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : fallback;
}

export function scoreActivity(repo) {
  return normalizeRepoNumber(repo.commitsPerWeek) * 2.2
    + normalizeRepoNumber(repo.openPRs) * 1.8
    + normalizeRepoNumber(repo.openIssues) * 0.18
    + normalizeRepoNumber(repo.goodFirstIssues) * 1.6;
}

export function estimateResponseHealth(repo) {
  const hours = Math.max(1, normalizeRepoNumber(repo.responseHours, 168));
  return Math.round(Math.max(0, Math.min(100, 112 - Math.log2(hours + 1) * 14)));
}

export function scoreContributionSafety(repo) {
  return Math.round(
    normalizeRepoNumber(repo.safetyScore, 60) * 0.48
    + estimateResponseHealth(repo) * 0.22
    + Math.min(22, normalizeRepoNumber(repo.goodFirstIssues) * 1.4)
    + (repo.branchProtection ? 5 : 0)
    + (repo.verifiedMaintainers ? 5 : 0)
    + (repo.contributionGuide || repo.issueTemplates ? 4 : 0),
  );
}

export function scoreTrending(repo) {
  return Math.round(
    scoreActivity(repo)
    + Math.log10(normalizeRepoNumber(repo.stars) + 1) * 12
    + estimateResponseHealth(repo) * 0.18
    + scoreContributionSafety(repo) * 0.1,
  );
}

export function clusterRank(repo, mode = 'stack') {
  if (mode === 'stars') return Math.log10(normalizeRepoNumber(repo.stars) + 1) * 100 + normalizeRepoNumber(repo.contributors) * 0.08;
  if (mode === 'trending') return scoreTrending(repo);
  if (mode === 'response') return estimateResponseHealth(repo) * 2 + scoreContributionSafety(repo) + normalizeRepoNumber(repo.goodFirstIssues);
  return normalizeRepoNumber(repo.stars) + scoreActivity(repo) * 18 + normalizeRepoNumber(repo.contributors) * 0.8;
}

export function rankReposForCluster(repos, mode = 'stack') {
  return [...repos].sort((a, b) => clusterRank(b, mode) - clusterRank(a, mode) || normalizeRepoNumber(b.stars) - normalizeRepoNumber(a.stars) || String(a.id).localeCompare(String(b.id)));
}

export function rankReposForIntent(query, repos) {
  const cleanQuery = String(query ?? '').trim().toLowerCase();
  if (!cleanQuery) return [];
  const tokens = cleanQuery.split(/[^a-z0-9+#.-]+/).filter(Boolean);
  const hasAny = (terms) => terms.some((term) => cleanQuery.includes(term) || tokens.includes(term));
  const intents = {
    beginner: hasAny(['beginner', 'starter', 'good first', 'first issue', 'new contributor']),
    popular: hasAny(['popular', 'stars', 'famous', 'landmark', 'big']),
    underrated: hasAny(['underrated', 'hidden gem', 'low star', 'small']),
    active: hasAny(['active', 'trending', 'busy', 'recent', 'alive']),
    safe: hasAny(['safe', 'trusted', 'maintained', 'stable']),
    fast: hasAny(['fast maintainer', 'fast maintainers', 'quick response', 'responsive', 'response']),
    ai: hasAny(['ai', 'ml', 'llm', 'rag', 'model']),
    infra: hasAny(['infra', 'infrastructure', 'cloud', 'devops']),
    frontend: hasAny(['frontend', 'ui', 'react', 'css']),
    backend: hasAny(['backend', 'api', 'server']),
    systems: hasAny(['systems', 'runtime', 'compiler', 'os']),
    docs: hasAny(['docs', 'documentation', 'guide']),
  };

  return repos
    .map((repo) => {
      const pings = [];
      const text = `${repo.owner ?? ''} ${repo.name ?? ''} ${repo.language ?? ''} ${(repo.topics ?? []).join(' ')} ${repo.description ?? ''}`.toLowerCase();
      const addPing = (label, detail, weight) => {
        if (weight > 0) pings.push({ label, detail, weight: Math.round(weight) });
      };
      tokens.forEach((token) => {
        if (token.length >= 2 && text.includes(token)) addPing('match', `matches "${token}"`, 18);
      });
      if (intents.beginner) addPing('intent', `${repo.goodFirstIssues ?? 0} good-first issues`, Math.min(80, (repo.goodFirstIssues ?? 0) * 4 + scoreContributionSafety(repo) * 0.35));
      if (intents.popular) addPing('popularity', `${repo.stars ?? 0} stars`, Math.log10(normalizeRepoNumber(repo.stars) + 1) * 18);
      if (intents.underrated) addPing('underrated', `${repo.stars ?? 0} stars with ${repo.commitsPerWeek ?? 0} commits/week`, Math.max(0, 90 - Math.log10(normalizeRepoNumber(repo.stars) + 1) * 15) + scoreActivity(repo) * 0.22);
      if (intents.active) addPing('activity', `${repo.commitsPerWeek ?? 0} commits/week`, scoreTrending(repo) * 0.45);
      if (intents.safe) addPing('safety', `${repo.safetyScore ?? 0}% contribution-ready`, scoreContributionSafety(repo));
      if (intents.fast) addPing('response', `${repo.responseHours ?? 168}h response estimate`, estimateResponseHealth(repo));
      if (intents.ai && /\b(ai|ml|llm|rag|model|vector|inference)\b/.test(text)) addPing('intent', 'AI/ML stack match', 70);
      if (intents.infra && /\b(infra|cloud|devops|kubernetes|container|deploy)\b/.test(text)) addPing('intent', 'infra stack match', 70);
      if (intents.frontend && /\b(frontend|ui|react|css|component|web)\b/.test(text)) addPing('intent', 'frontend stack match', 70);
      if (intents.backend && /\b(backend|api|server|database|service)\b/.test(text)) addPing('intent', 'backend stack match', 70);
      if (intents.systems && /\b(system|runtime|compiler|kernel|os|language)\b/.test(text)) addPing('intent', 'systems stack match', 70);
      if (intents.docs && /\b(doc|guide|tutorial|example)\b/.test(text)) addPing('intent', 'documentation match', 60);
      const score = pings.reduce((total, ping) => total + ping.weight, 0);
      return score > 0 ? { repo, score: Math.round(score), pings: pings.sort((a, b) => b.weight - a.weight).slice(0, 4) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || scoreContributionSafety(b.repo) - scoreContributionSafety(a.repo) || normalizeRepoNumber(b.repo.stars) - normalizeRepoNumber(a.repo.stars))
    .slice(0, 6);
}
```

- [ ] **Step 4: Implement `rankReposForIntent` and type declarations**

`rankReposForIntent(query, repos)` returns `{ repo, score, pings }[]`, where `pings` are `{ label, detail, weight }`. It must tolerate missing repo fields, slice to 6 results, and include short explainable labels like `intent`, `safety`, `activity`, `response`, and `underrated`.

- [ ] **Step 5: Add package script and run the tests**

Modify `frontend/package.json`:

```json
"test:repo-metrics": "node scripts/repo-metrics-test.mjs"
```

Run:

```bash
npm --prefix frontend run test:repo-metrics
```

Expected: PASS with `{ "ok": true }`.

## Task 3: Wire Cluster/Search Helpers Into The Atlas

**Files:**
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Import helper functions**

Add:

```ts
import { rankReposForCluster, rankReposForIntent } from '../lib/repoMetrics.mjs';
```

- [ ] **Step 2: Add `ClusterMode` and state**

Add:

```ts
type ClusterMode = 'stack' | 'stars' | 'trending' | 'response';
const [clusterMode, setClusterMode] = useState<ClusterMode>('stack');
const [viewEncodingOpen, setViewEncodingOpen] = useState(false);
```

- [ ] **Step 3: Replace visual ranking and search ranking**

Change `visualReposByDistrict` to call `rankReposForCluster(repos, clusterMode)`. Change `searchResults` to call `rankReposForIntent(query, effectiveRepos)`.

- [ ] **Step 4: Run metrics tests and TypeScript build check**

Run:

```bash
npm --prefix frontend run test:repo-metrics
npm --prefix frontend run build
```

Expected: helper tests pass; build either passes or exposes exact type/import issues to fix before continuing.

## Task 4: Add View Encoding Controls

**Files:**
- Create: `frontend/components/ViewEncodingPanel.tsx`
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Create controlled panel component**

Create a component with props:

```ts
type HeightScaleDriver = 'stars' | 'activity' | 'contributors';
type ClusterMode = 'stack' | 'stars' | 'trending' | 'response';

export function ViewEncodingPanel({
  open,
  heightScaleDriver,
  clusterMode,
  onHeightScaleChange,
  onClusterModeChange,
  onClose,
}: ViewEncodingPanelProps) { ... }
```

It renders no network calls, uses lucide icons, has a close button labeled `Close view encoding`, and shows compact legends for height, glow, safety, routes, and clusters.

- [ ] **Step 2: Add compact cluster buttons next to height buttons**

Add visible buttons:

- `Stack`
- `Stars`
- `Trending`
- `Response`

Each button uses `aria-pressed={clusterMode === mode}` and calls `setClusterMode(mode)`.

- [ ] **Step 3: Add View Encoding launcher and panel**

Add a `View Encoding` button to the filter row and render:

```tsx
<ViewEncodingPanel
  open={viewEncodingOpen}
  heightScaleDriver={heightScaleDriver}
  clusterMode={clusterMode}
  onHeightScaleChange={setHeightScaleDriver}
  onClusterModeChange={setClusterMode}
  onClose={() => setViewEncodingOpen(false)}
/>
```

- [ ] **Step 4: Add CSS inside the existing page style block**

Add `.cluster-driver-container`, `.view-encoding-panel`, `.encoding-option-grid`, `.encoding-legend`, responsive rules, and day-mode styles. Ensure all compact controls wrap without overlapping on mobile and desktop.

## Task 5: Harden Owner/Repo Import

**Files:**
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Make import statuses specific**

When the input is invalid, show `Use owner/repo or paste a full GitHub repository URL.`. When import succeeds with `meta.created === false`, show that the repo was already modeled. When graph refresh is queued, keep the imported repo immediately visible through `loadedRepos`.

- [ ] **Step 2: Preserve focus/search visibility**

After success or fallback-from-graph, call `focusRepo(importedRepo)` and prepend the repo to `loadedRepos` with `loadedAt`, `wantsContributions`, and `importSource: 'github'`.

- [ ] **Step 3: Explain backend failures**

If the route fails, show the backend detail when present; otherwise show `Could not load that public GitHub repo. Check the owner/repo spelling or try again after GitHub rate limits reset.`

## Task 6: Browser Smoke Coverage

**Files:**
- Modify: `frontend/scripts/sift-regression-smoke.mjs`

- [ ] **Step 1: Expand fixture diversity**

Make the mocked graph include a high-star landmark, an active low-star repo, and beginner-friendly AI/devtools topics so intent search has meaningful ranking differences.

- [ ] **Step 2: Verify controls**

Add Playwright steps:

```js
await page.getByRole('button', { name: /Activity/ }).click();
await page.getByRole('button', { name: /Trending/ }).click();
await page.getByRole('button', { name: /View Encoding/ }).click();
await page.waitForFunction(() => document.body.innerText.includes('Height maps to'));
await page.getByRole('button', { name: 'Close view encoding' }).click();
```

- [ ] **Step 3: Verify explainable intent search**

Search `beginner friendly ai repo with fast maintainers`, wait for a search result containing a useful AI/devtools repo, and assert the page contains `intent:` or `response:`.

- [ ] **Step 4: Preserve import persistence check**

Keep the existing mocked `codex-smoke/sift-loaded-repo` import, reload, and visible-after-reload assertion.

## Task 7: Full Verification

**Files:**
- No source changes unless a verification failure points to a specific bug.

- [ ] **Step 1: Run backend regression**

Run:

```bash
PYTHONPATH=backend python3 -m pytest backend/app/tests/test_issue_doc_fixes.py
```

Expected: PASS.

- [ ] **Step 2: Run frontend helper and smoke tests**

Run:

```bash
npm --prefix frontend run test:repo-metrics
npm --prefix frontend run test:camera-focus
npm --prefix frontend run test:regression-smoke
```

Expected: all PASS against the local app URL.

- [ ] **Step 3: Run production build**

Run:

```bash
npm --prefix frontend run build
```

Expected: PASS, no fake3d identity, no Next framework overlay.

- [ ] **Step 4: Review final diff**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Expected: whitespace check passes; dirty files match the implementation; `.superpowers/` remains untracked unless explicitly ignored or removed outside this feature.

## Self-Review

- Spec coverage: height scale controls are preserved; cluster controls, View Encoding panel, local intent search, and owner/repo import reliability are implemented. GitHub login, vector search, external account connections, and PR bots remain deferred.
- Placeholder scan: no `TBD`, `TODO`, or deferred implementation placeholders remain.
- Type consistency: `HeightScaleDriver` remains `stars | activity | contributors`; `ClusterMode` is `stack | stars | trending | response`; search result pings stay compatible with the existing page UI.
