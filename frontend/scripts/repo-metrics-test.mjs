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

const landmark = repo({
  id: 'big/landmark',
  stars: 100000,
  commitsPerWeek: 3,
  responseHours: 96,
  topics: ['platform'],
});

const activeSmall = repo({
  id: 'small/active',
  stars: 600,
  commitsPerWeek: 120,
  openIssues: 75,
  openPRs: 14,
  responseHours: 8,
  goodFirstIssues: 18,
  safetyScore: 88,
  topics: ['ai', 'developer-tools', 'good-first-issue'],
});

const staleSmall = repo({
  id: 'small/stale',
  stars: 700,
  commitsPerWeek: 0,
  openIssues: 2,
  responseHours: 240,
  safetyScore: 42,
  branchProtection: false,
  verifiedMaintainers: false,
});

assert.equal(rankReposForCluster([activeSmall, landmark], 'stars')[0].id, 'big/landmark');
assert.equal(rankReposForCluster([landmark, activeSmall], 'trending')[0].id, 'small/active');
assert.ok(estimateResponseHealth(activeSmall) > estimateResponseHealth(landmark));
assert.ok(scoreContributionSafety(activeSmall) > scoreContributionSafety(staleSmall));
assert.ok(scoreTrending(activeSmall) > scoreTrending(landmark));
assert.equal(rankReposForIntent('beginner friendly ai repo with fast maintainers', [landmark, activeSmall])[0].repo.id, 'small/active');
assert.equal(rankReposForIntent('underrated active repo', [landmark, activeSmall])[0].repo.id, 'small/active');

console.log(JSON.stringify({ ok: true }, null, 2));
