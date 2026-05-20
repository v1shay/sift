'use client';

import * as THREE from 'three';
import { Activity, Github, GitPullRequest, HelpCircle, Moon, RotateCcw, ShieldCheck, SlidersHorizontal, Sparkles, Star, Sun, TrendingUp, Users, X, ZoomIn, ZoomOut } from 'lucide-react';
import { FormEvent, MouseEvent, type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';

type DistrictKey = string;
type FilterKey = DistrictKey | 'stars' | 'safe' | 'all';
type Priority = 'hot' | 'normal' | 'quiet';
type Appearance = 'night' | 'day';
type HeightScaleDriver = 'stars' | 'activity' | 'contributors';

type SearchPing = {
  label: string;
  detail: string;
  weight: number;
};

type SearchResult = {
  repo: Repo;
  score: number;
  pings: SearchPing[];
};

type SafetyReason = {
  type: 'positive' | 'risk' | 'unknown';
  label: string;
  detail: string;
  weight: number;
  awardedPoints: number;
};

type SafetyProfile = {
  score: number;
  status: 'green' | 'amber' | 'red';
  color: string;
  breakdown: SafetyReason[];
  reasons: SafetyReason[];
  unknowns: string[];
  maxScore: number;
};

type District = {
  key: DistrictKey;
  label: string;
  color: string;
  accent: string;
  x: number;
  z: number;
  shape: string;
  parent: string;
};

type PullRequest = {
  number: number;
  title: string;
  priority: Priority;
};

type Repo = {
  id: string;
  name: string;
  owner: string;
  district: DistrictKey;
  language: string;
  description: string;
  stars: number;
  forks: number;
  openPRs: number;
  openIssues?: number;
  commitsPerWeek: number;
  contributors: number;
  goodFirstIssues: number;
  safetyScore: number;
  verifiedMaintainers: boolean;
  branchProtection: boolean;
  signedReleases: boolean;
  responseHours: number;
  topics: string[];
  prs: PullRequest[];
  ownershipDocs?: boolean;
  requiredReviews?: boolean;
  contributionGuide?: boolean;
  issueTemplates?: boolean;
  smallScopedIssues?: boolean;
  license?: string;
  hasTests?: boolean;
  manageableLocalDev?: boolean;
  safetyProfile?: SafetyProfile;
  loadedAt?: string;
  wantsContributions?: boolean;
  importSource?: 'github';
};

type GitHubRepoPayload = {
  id?: number;
  name: string;
  full_name?: string;
  owner?: { login?: string };
  description?: string | null;
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  language?: string | null;
  topics?: string[];
  pushed_at?: string | null;
  archived?: boolean;
  license?: { spdx_id?: string | null } | null;
};

type GitHubPullPayload = {
  number?: number;
  title?: string;
  draft?: boolean;
};

type GraphRepositoryNode = {
  id?: string;
  name?: string;
  fullName?: string;
  full_name?: string;
  group?: string;
  nodeType?: string;
  owner?: string;
  description?: string | null;
  language?: string | null;
  stars?: number;
  forks?: number;
  openIssues?: number;
  openPRs?: number;
  contributorsCount?: number;
  topics?: string[];
  license?: string | null;
  isBeginnerFriendly?: boolean;
  pushedAt?: string | null;
  updatedAt?: string | null;
  safetyScore?: number;
  safetyStatus?: SafetyProfile['status'];
  safetyReasons?: SafetyReason[];
  safetyBreakdown?: SafetyReason[];
  safetyUnknowns?: string[];
};

type GraphFullResponse = {
  nodes?: GraphRepositoryNode[];
};

type RepoBuildingMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
type RepoWindowsMesh = THREE.InstancedMesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;

type BuildingObject = {
  repo: Repo;
  district: District;
  group: THREE.Group;
  body: RepoBuildingMesh;
  top: RepoBuildingMesh;
  windows: RepoWindowsMesh;
  beacon: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  ring: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  selectedDetails?: THREE.Group;
  position: THREE.Vector3;
  height: number;
  width: number;
  depth: number;
  phase: number;
};

type RoadObject = {
  id: string;
  source: Repo;
  target: Repo;
  curve: THREE.CatmullRomCurve3;
  mesh: THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial>;
  cars: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[];
  label: THREE.Sprite;
  speed: number;
  phase: number;
  flowStrength: number;
  baseOpacity: number;
};

type SceneRefs = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  ambient: THREE.AmbientLight;
  key: THREE.DirectionalLight;
  rim: THREE.PointLight;
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  buildings: BuildingObject[];
  roads: RoadObject[];
  frame: number;
  startedAt: number;
  enteredAt: number | null;
  cameraPosition: THREE.Vector3;
  cameraTarget: THREE.Vector3;
  zoom: number;
  targetZoom: number;
};

const DISTRICTS: District[] = [
  // Systems
  { key: 'skyline_core', label: 'Systems Engine', color: '#ff4b4b', accent: '#ff9f80', x: 0, z: 0, shape: 'spires', parent: 'systems' },
  { key: 'clockwork_empire', label: 'Low-Level Runtimes', color: '#ff6b8b', accent: '#fca5a5', x: -75, z: 0, shape: 'factories', parent: 'systems' },
  { key: 'mountain_citadel', label: 'Compiler Tools', color: '#f43f5e', accent: '#fda4af', x: 75, z: 0, shape: 'citadel', parent: 'systems' },
  { key: 'ruined_empire', label: 'Kernel & Drivers', color: '#f59e0b', accent: '#fef08a', x: 0, z: -75, shape: 'ruins', parent: 'systems' },
  // Web
  { key: 'vertical_arcology', label: 'Frontend Frameworks', color: '#3b82f6', accent: '#93c5fd', x: 0, z: 75, shape: 'megatowers', parent: 'web' },
  { key: 'brick_boroughs', label: 'React & UI Libraries', color: '#60a5fa', accent: '#bfdbfe', x: -75, z: -75, shape: 'apartments', parent: 'web' },
  { key: 'neon_alley', label: 'Web Apps & SaaS', color: '#06b6d4', accent: '#a5f3fc', x: 75, z: 75, shape: 'glass', parent: 'web' },
  { key: 'tech_suburbs', label: 'CSS & Tailwind Styling', color: '#0ea5e9', accent: '#7dd3fc', x: -75, z: 75, shape: 'suburbs', parent: 'web' },
  { key: 'coastal_fishing', label: 'Static Site Builders', color: '#2563eb', accent: '#93c5fd', x: 75, z: -75, shape: 'fishing_docks', parent: 'web' },
  // AI/ML
  { key: 'ether_realm', label: 'Agent Design', color: '#a78bfa', accent: '#e9d5ff', x: -150, z: -150, shape: 'holographic', parent: 'ai' },
  { key: 'crystal_fields', label: 'Deep Learning & LLMs', color: '#c084fc', accent: '#f5d0fe', x: -75, z: -150, shape: 'crystal_spires', parent: 'ai' },
  { key: 'floating_island', label: 'Computer Vision & Speech', color: '#8b5cf6', accent: '#ddd6fe', x: 0, z: -150, shape: 'floating_stations', parent: 'ai' },
  // DevTools
  { key: 'bamboo_valley', label: 'Trending Repos', color: '#10b981', accent: '#a7f3d0', x: 75, z: -150, shape: 'bamboo_pagodas', parent: 'devtools' },
  { key: 'valley_villages', label: 'DevOps & CI/CD', color: '#34d399', accent: '#d1fae5', x: 150, z: -150, shape: 'valley_villages', parent: 'devtools' },
  { key: 'nomad_camps', label: 'Testing Frameworks', color: '#ec4899', accent: '#fbcfe8', x: -150, z: -75, shape: 'tents', parent: 'devtools' },
  // Infra & Others
  { key: 'financial_district', label: 'Data Engineering', color: '#fbbf24', accent: '#fef3c7', x: 150, z: -75, shape: 'blocks', parent: 'infra' },
  { key: 'volcano_forge', label: 'Container Runtimes', color: '#f97316', accent: '#fed7aa', x: -150, z: 0, shape: 'lava_foundries', parent: 'infra' },
  { key: 'corruption_wasteland', color: '#d946ef', accent: '#f5d0fe', label: 'Cybersecurity & Auditing', x: 150, z: 0, shape: 'decayed', parent: 'infra' },
  { key: 'overgrown_ruins', label: 'IoT & Embedded', color: '#22c55e', accent: '#bbf7d0', x: -150, z: 75, shape: 'overgrown', parent: 'infra' },
  { key: 'forest_repository', label: 'Database Clusters', color: '#14b8a6', accent: '#99f6e4', x: 150, z: 75, shape: 'giant_trees', parent: 'infra' },
  { key: 'redwood_archive', label: 'Caching & Queues', color: '#f97316', accent: '#ffedd5', x: -150, z: 150, shape: 'redwood_towers', parent: 'infra' },
  { key: 'jungle_canopy', label: 'Cloud Infra Platforms', color: '#f43f5e', accent: '#ffe4e6', x: -75, z: 150, shape: 'mushroom_colonies', parent: 'infra' },
  { key: 'frozen_kingdom', label: 'Distributed Systems', color: '#06b6d4', accent: '#cffafe', x: 0, z: 150, shape: 'caves', parent: 'infra' },
  { key: 'canyon_networks', label: 'Networking & Proxies', color: '#38bdf8', accent: '#e0f2fe', x: 75, z: 150, shape: 'canyon_forts', parent: 'infra' },
];

const SAFETY_GREEN_THRESHOLD = 75;
const SAFETY_AMBER_THRESHOLD = 60;
const SAFETY_MAX_SCORE = 100;
const SAFETY_WEIGHTS = {
  verifiedMaintainers: 12,
  recentMaintainerActivity: 5,
  clearOwnershipDocs: 3,
  branchProtection: 10,
  requiredReviews: 6,
  signedReleases: 4,
  goodFirstIssues: 8,
  contributionGuide: 5,
  templatesAndLabels: 4,
  smallScopedIssues: 3,
  responseTime: 8,
  recentCommitsOrReleases: 4,
  prCadence: 3,
  lowVisibleRisk: 5,
  licensePresent: 3,
  descriptionQuality: 3,
  noSuspiciousMetadata: 4,
  clearLanguageAndBuild: 4,
  testInstructions: 3,
  manageableLocalDev: 3,
};

const SAFETY_SCORE_BATCH_SIZE = 500;

const SUSPICIOUS_TERMS = [
  'paste your token',
  'paste token',
  'disable antivirus',
  'curl | sh',
  'private key',
  'seed phrase',
  'wallet',
  'airdrop',
  'free crypto',
  'download binary',
  'run as administrator',
];

function isGreenSafety(score: number) {
  return score > SAFETY_GREEN_THRESHOLD;
}

function safetyStatus(score: number): SafetyProfile['status'] {
  if (isGreenSafety(score)) return 'green';
  if (score >= SAFETY_AMBER_THRESHOLD) return 'amber';
  return 'red';
}

function hasSuspiciousMetadata(repo: Repo) {
  const text = `${repo.name} ${repo.owner} ${repo.description} ${repo.topics.join(' ')}`.toLowerCase();
  return SUSPICIOUS_TERMS.some((term) => text.includes(term));
}

function safetyType(points: number, weight: number): SafetyReason['type'] {
  return points >= weight * 0.5 ? 'positive' : 'risk';
}

function buildRepoSafetyProfile(repo: Repo): SafetyProfile {
  const breakdown: SafetyReason[] = [];
  const unknowns: string[] = [];

  const add = (label: string, detail: string, weight: number, awardedPoints: number, unknown = false) => {
    const points = unknown ? 0 : clamp(awardedPoints, 0, weight);
    if (unknown) unknowns.push(label);
    breakdown.push({
      label,
      detail,
      weight,
      awardedPoints: points,
      type: unknown ? 'unknown' : safetyType(points, weight),
    });
  };

  const suspicious = hasSuspiciousMetadata(repo);
  const recentActivity = repo.commitsPerWeek > 0;
  const hasTemplates = repo.issueTemplates ?? repo.topics.some((topic) => ['good-first-issue', 'help-wanted', 'documentation'].includes(topic.toLowerCase()));
  const hasSmallIssues = repo.smallScopedIssues ?? repo.goodFirstIssues > 0;
  const manageableLocalDev = repo.manageableLocalDev ?? repo.contributors <= 4500;
  const hasRequiredReviews = repo.requiredReviews ?? repo.branchProtection;

  add('Verified maintainers', repo.verifiedMaintainers ? 'Maintainer ownership is clear.' : 'Maintainer ownership is unclear.', SAFETY_WEIGHTS.verifiedMaintainers, repo.verifiedMaintainers ? 12 : 0);
  add('Recent maintainer activity', recentActivity ? 'Recent commits indicate active stewardship.' : 'Recent maintainer activity is sparse.', SAFETY_WEIGHTS.recentMaintainerActivity, recentActivity ? 5 : 0);
  add('Clear ownership docs', repo.ownershipDocs ? 'Ownership or governance docs are visible.' : 'Ownership docs are missing from current demo data.', SAFETY_WEIGHTS.clearOwnershipDocs, repo.ownershipDocs ? 3 : 0, repo.ownershipDocs === undefined);
  add('Protected default branch', repo.branchProtection ? 'Default branch changes are gated.' : 'Default branch protection is missing.', SAFETY_WEIGHTS.branchProtection, repo.branchProtection ? 10 : 0);
  add('Required reviews or checks', hasRequiredReviews ? 'Reviews or status checks reduce unsafe merges.' : 'Required reviews or checks are missing.', SAFETY_WEIGHTS.requiredReviews, hasRequiredReviews ? 6 : 0);
  add('Signed releases', repo.signedReleases ? 'Release artifacts have provenance signals.' : 'Release signing is missing or unavailable.', SAFETY_WEIGHTS.signedReleases, repo.signedReleases ? 4 : 0);
  add('Good-first issues', repo.goodFirstIssues > 0 ? `${repo.goodFirstIssues} good-first issues are visible.` : 'No good-first issues are visible.', SAFETY_WEIGHTS.goodFirstIssues, repo.goodFirstIssues > 0 ? 8 : 0);
  add('Contribution guide', repo.contributionGuide ? 'Contribution instructions are available.' : 'Contribution instructions are missing from current demo data.', SAFETY_WEIGHTS.contributionGuide, repo.contributionGuide ? 5 : 0, repo.contributionGuide === undefined);
  add('Templates and labels', hasTemplates ? 'Issue labels or templates guide new contributors.' : 'Contributor labels/templates are not visible.', SAFETY_WEIGHTS.templatesAndLabels, hasTemplates ? 4 : 0);
  add('Small scoped issues', hasSmallIssues ? 'Starter work appears scoped.' : 'Starter work may be hard to scope.', SAFETY_WEIGHTS.smallScopedIssues, hasSmallIssues ? 3 : 0);
  add('Maintainer response time', repo.responseHours <= 24 ? `Typical response is around ${repo.responseHours} hours.` : `Typical response is around ${repo.responseHours} hours, so feedback may be slow.`, SAFETY_WEIGHTS.responseTime, repo.responseHours <= 24 ? 8 : repo.responseHours <= 72 ? 5 : 1);
  add('Recent commits or releases', recentActivity ? 'Recent activity suggests the repo is alive.' : 'Recent commits/releases are sparse.', SAFETY_WEIGHTS.recentCommitsOrReleases, recentActivity ? 4 : 0);
  add('Open work cadence', getOpenWorkItems(repo) > 0 ? 'Open contribution work is visible.' : 'Open contribution work is not visible.', SAFETY_WEIGHTS.prCadence, getOpenWorkItems(repo) > 0 ? 3 : 0);
  add('Low visible metadata risk', suspicious ? 'Metadata contains suspicious contribution language.' : 'Metadata avoids obvious contribution traps.', SAFETY_WEIGHTS.lowVisibleRisk, suspicious ? 0 : 5);
  add('License present', repo.license ? 'A license is visible.' : 'License metadata is missing from current demo data.', SAFETY_WEIGHTS.licensePresent, repo.license ? 3 : 0, repo.license === undefined);
  add('Readable project description', repo.description.length >= 40 ? 'Description gives enough context to judge fit.' : 'Description is too thin to judge fit confidently.', SAFETY_WEIGHTS.descriptionQuality, repo.description.length >= 40 ? 3 : 0);
  add('No suspicious links or binaries', suspicious ? 'Suspicious links, binaries, or secret requests need review.' : 'No obvious unsafe links, binaries, or secret requests were detected.', SAFETY_WEIGHTS.noSuspiciousMetadata, suspicious ? 0 : 4);
  add('Clear language/build setup', repo.language ? `${repo.language} stack is visible.` : 'Language/build setup is missing.', SAFETY_WEIGHTS.clearLanguageAndBuild, repo.language ? 4 : 0);
  add('Test instructions', repo.hasTests ? 'Test instructions are visible.' : 'Test instructions are missing from current demo data.', SAFETY_WEIGHTS.testInstructions, repo.hasTests ? 3 : 0, repo.hasTests === undefined);
  add('Manageable local development', manageableLocalDev ? 'Local setup appears manageable.' : 'Local development may be heavy for a first contribution.', SAFETY_WEIGHTS.manageableLocalDev, manageableLocalDev ? 3 : 0);

  const score = Math.round(breakdown.reduce((total, item) => total + item.awardedPoints, 0));
  const status = safetyStatus(score);
  const reasons = [...breakdown]
    .sort((a, b) => {
      if (a.type !== b.type) {
        const order = { risk: 0, unknown: 1, positive: 2 };
        return order[a.type] - order[b.type];
      }
      return b.weight - a.weight;
    })
    .slice(0, 8);

  return {
    score,
    status,
    color: colorForSafety(score),
    breakdown,
    reasons,
    unknowns,
    maxScore: SAFETY_MAX_SCORE,
  };
}

function enrichRepoSafety(repo: Repo): Repo {
  const safetyProfile = buildRepoSafetyProfile(repo);
  return {
    ...repo,
    safetyScore: safetyProfile.score,
    safetyProfile,
  };
}

function applySafetyProfile(repo: Repo, safetyProfile?: SafetyProfile): Repo {
  if (!safetyProfile) return repo;
  return {
    ...repo,
    safetyScore: safetyProfile.score,
    safetyProfile,
  };
}

function inferDistrictFromMetadata(stars: number, languageValue?: string | null, rawTopics: string[] = [], name = '', description = ''): DistrictKey {
  const language = (languageValue || '').toLowerCase();
  const topics = rawTopics.map((topic) => topic.toLowerCase());
  const text = `${name} ${description} ${topics.join(' ')}`.toLowerCase();

  if (stars > 80000) return 'skyline_core';
  if (stars > 25000) return 'vertical_arcology';
  if (topics.some((topic) => ['finance', 'fintech', 'payment'].includes(topic))) return 'financial_district';
  if (topics.some((topic) => ['ml', 'ai', 'deep-learning', 'llm', 'agent'].includes(topic)) || text.includes('machine learning')) return 'neon_alley';
  if (language === 'rust') return 'clockwork_empire';
  if (language === 'c' || language === 'c++' || language === 'cpp') return 'mountain_citadel';
  if (language === 'go' || topics.some((topic) => ['cloud', 'kubernetes'].includes(topic))) return 'floating_island';
  if (['typescript', 'javascript'].includes(language) || topics.some((topic) => ['frontend', 'react', 'vue', 'svelte'].includes(topic))) return 'brick_boroughs';
  if (language === 'python') return 'ether_realm';
  if (topics.some((topic) => ['crypto', 'blockchain', 'web3'].includes(topic))) return 'crystal_fields';
  if (topics.some((topic) => ['game', 'graphics', 'rendering'].includes(topic))) return 'bamboo_valley';
  if (topics.some((topic) => ['security', 'cryptography', 'auth'].includes(topic))) return 'redwood_archive';
  if (topics.some((topic) => ['database', 'sql', 'nosql', 'redis', 'cache', 'queue'].includes(topic))) return 'canyon_networks';
  if (topics.some((topic) => ['compiler', 'parser', 'interpreter'].includes(topic))) return 'frozen_kingdom';
  if (topics.some((topic) => ['docker', 'devops', 'ci-cd', 'infra'].includes(topic))) return 'volcano_forge';
  if (topics.some((topic) => ['linux', 'kernel', 'operating-system'].includes(topic))) return 'ruined_empire';
  if (stars < 50) return 'valley_villages';
  if (stars < 250) return 'nomad_camps';
  if (stars < 1000) return 'coastal_fishing';

  const infraBiomes = ['overgrown_ruins', 'forest_repository', 'jungle_canopy', 'corruption_wasteland'];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return infraBiomes[hash % infraBiomes.length];
}

function parseGithubRepoLocator(value: string) {
  const trimmed = value.trim().replace(/\.git$/, '');
  if (!trimmed) return null;
  const withoutProtocol = trimmed.replace(/^https?:\/\//, '').replace(/^www\./, '');
  const path = withoutProtocol.startsWith('github.com/') ? withoutProtocol.slice('github.com/'.length) : withoutProtocol;
  const [owner, repo] = path.split('/').filter(Boolean);
  if (!owner || !repo) return null;
  return { owner, repo: repo.replace(/[#?].*$/, '') };
}

function buildPullRequestsFromGithub(pulls: GitHubPullPayload[]): PullRequest[] {
  return pulls.slice(0, 6).map((pull, index) => ({
    number: pull.number ?? index + 1,
    title: pull.title || 'Open pull request',
    priority: pull.draft ? 'quiet' : index < 2 ? 'hot' : 'normal',
  }));
}

async function fetchGithubOpenPullRequests(owner: string, repo: string) {
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=12`);
    if (!response.ok) return [];
    return await response.json() as GitHubPullPayload[];
  } catch {
    return [];
  }
}

function buildRepoFromGithub(payload: GitHubRepoPayload, wantsContributions: boolean, openPulls: GitHubPullPayload[] = []): Repo {
  const owner = payload.owner?.login || (payload.full_name?.split('/')[0] ?? 'github');
  const name = payload.name;
  const topics = payload.topics ?? [];
  const stars = payload.stargazers_count ?? 0;
  const openIssues = payload.open_issues_count ?? 0;
  const pullRequests = buildPullRequestsFromGithub(openPulls);
  const openPRs = Math.max(openIssues, pullRequests.length);
  const pushedAt = payload.pushed_at ? new Date(payload.pushed_at).getTime() : 0;
  const daysSincePush = pushedAt ? Math.max(1, Math.round((Date.now() - pushedAt) / 86400000)) : 90;
  const commitsPerWeek = clamp(Math.round(35 / Math.sqrt(daysSincePush)), 1, 28);
  const hasStarterSignals = topics.some((topic) => ['good-first-issue', 'good-first-issues', 'help-wanted', 'documentation'].includes(topic.toLowerCase()));

  return enrichRepoSafety({
    id: `${owner}/${name}`.toLowerCase(),
    name,
    owner,
    district: inferDistrictFromMetadata(stars, payload.language, topics, name, payload.description ?? ''),
    language: payload.language || 'Unknown',
    description: payload.description || 'GitHub repository imported into SIFT.',
    stars,
    forks: payload.forks_count ?? 0,
    openIssues,
    openPRs,
    commitsPerWeek,
    contributors: clamp(Math.round(Math.sqrt(Math.max(1, stars)) * 4), 8, 1200),
    goodFirstIssues: hasStarterSignals ? Math.max(3, Math.min(24, Math.round(openIssues * 0.18))) : 0,
    safetyScore: 80,
    verifiedMaintainers: !payload.archived,
    branchProtection: stars >= 100,
    signedReleases: false,
    responseHours: daysSincePush <= 7 ? 18 : daysSincePush <= 30 ? 36 : 72,
    topics,
    prs: pullRequests,
    contributionGuide: wantsContributions,
    issueTemplates: hasStarterSignals,
    smallScopedIssues: hasStarterSignals || openIssues > 0 || openPRs > 0,
    license: payload.license?.spdx_id || undefined,
    hasTests: undefined,
    manageableLocalDev: stars < 60000,
    loadedAt: new Date().toISOString(),
    wantsContributions,
    importSource: 'github',
  });
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isGraphRepositoryNode(node: GraphRepositoryNode) {
  return node.group === 'repository' || node.nodeType === 'repository';
}

function fullNameForGraphNode(node: GraphRepositoryNode) {
  const explicitFullName = node.fullName || node.full_name;
  if (explicitFullName?.includes('/')) return explicitFullName;
  if (node.name?.includes('/')) return node.name;
  if (node.owner && node.name) return `${node.owner}/${node.name}`;
  return node.name || node.id || 'unknown/repository';
}

function repoNameFromFullName(fullName: string) {
  return fullName.split('/').filter(Boolean).pop() || fullName;
}

function ownerFromFullName(fullName: string, fallback?: string) {
  return fallback || fullName.split('/').filter(Boolean)[0] || 'github';
}

function commitsPerWeekFromDate(value?: string | null) {
  if (!value) return 6;
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) return 6;
  const daysSinceUpdate = Math.max(1, Math.round((Date.now() - parsed) / 86400000));
  return clamp(Math.round(48 / Math.sqrt(daysSinceUpdate)), 1, 48);
}

function safetyProfileFromGraphNode(node: GraphRepositoryNode): SafetyProfile | undefined {
  if (typeof node.safetyScore !== 'number') return undefined;
  const score = clamp(Math.round(node.safetyScore), 0, SAFETY_MAX_SCORE);
  return {
    score,
    status: node.safetyStatus ?? safetyStatus(score),
    color: colorForSafety(score),
    breakdown: node.safetyBreakdown ?? node.safetyReasons ?? [],
    reasons: node.safetyReasons ?? [],
    unknowns: node.safetyUnknowns ?? [],
    maxScore: SAFETY_MAX_SCORE,
  };
}

function buildRepoFromGraphNode(node: GraphRepositoryNode): Repo {
  const fullName = fullNameForGraphNode(node);
  const owner = ownerFromFullName(fullName, node.owner);
  const name = repoNameFromFullName(fullName);
  const topics = node.topics ?? [];
  const stars = node.stars ?? 0;
  const openIssues = node.openIssues ?? node.openPRs ?? 0;
  const openPRs = node.openPRs ?? openIssues;
  const contributors = Math.max(node.contributorsCount ?? 0, Math.round(Math.sqrt(Math.max(1, stars)) * 2));
  const hasStarterSignals = Boolean(node.isBeginnerFriendly) || topics.some((topic) => ['good-first-issue', 'good-first-issues', 'help-wanted', 'documentation'].includes(topic.toLowerCase()));
  const safetyProfile = safetyProfileFromGraphNode(node);

  const repo: Repo = {
    id: fullName.toLowerCase(),
    name,
    owner,
    district: inferDistrictFromMetadata(stars, node.language, topics, name, node.description ?? ''),
    language: node.language || 'Unknown',
    description: node.description || 'Local graph repository imported into SIFT.',
    stars,
    forks: node.forks ?? 0,
    openIssues,
    openPRs,
    commitsPerWeek: commitsPerWeekFromDate(node.pushedAt ?? node.updatedAt),
    contributors,
    goodFirstIssues: hasStarterSignals ? Math.max(3, Math.min(30, Math.round(openIssues * 0.2))) : 0,
    safetyScore: safetyProfile?.score ?? clamp(node.safetyScore ?? 70, 0, SAFETY_MAX_SCORE),
    verifiedMaintainers: true,
    branchProtection: stars >= 100,
    signedReleases: Boolean(node.license),
    responseHours: commitsPerWeekFromDate(node.pushedAt ?? node.updatedAt) >= 12 ? 18 : 36,
    topics,
    prs: [],
    issueTemplates: hasStarterSignals,
    smallScopedIssues: hasStarterSignals || openIssues > 0,
    license: node.license || undefined,
    manageableLocalDev: contributors < 1800,
  };

  return safetyProfile ? applySafetyProfile(repo, safetyProfile) : enrichRepoSafety(repo);
}

const REPOS: Repo[] = [
  {
    id: 'facebook/react',
    name: 'react',
    owner: 'facebook',
    district: 'brick_boroughs',
    language: 'JavaScript',
    description: 'A core UI library with a large contributor surface and active ecosystem maintenance.',
    stars: 236000,
    forks: 48000,
    openPRs: 278,
    commitsPerWeek: 120,
    contributors: 1800,
    goodFirstIssues: 20,
    safetyScore: 82,
    verifiedMaintainers: true,
    branchProtection: true,
    signedReleases: true,
    responseHours: 28,
    topics: ['ui', 'components', 'javascript', 'frontend'],
    prs: [{ number: 9711, title: 'refine transition tracing hook', priority: 'hot' }],
  },
  {
    id: 'rust-lang/rust',
    name: 'rust',
    owner: 'rust-lang',
    district: 'mountain_citadel',
    language: 'Rust',
    description: 'Language infrastructure with careful review gates and deep compiler contribution paths.',
    stars: 103000,
    forks: 13000,
    openPRs: 221,
    commitsPerWeek: 186,
    contributors: 2600,
    goodFirstIssues: 42,
    safetyScore: 88,
    verifiedMaintainers: true,
    branchProtection: true,
    signedReleases: true,
    responseHours: 14,
    topics: ['compiler', 'language', 'systems'],
    prs: [{ number: 7781, title: 'improve diagnostics for trait bounds', priority: 'hot' }],
  },
  {
    id: 'pytorch/pytorch',
    name: 'pytorch',
    owner: 'pytorch',
    district: 'crystal_fields',
    language: 'Python',
    description: 'Deep learning framework with research-heavy development and broad starter documentation.',
    stars: 93000,
    forks: 25000,
    openPRs: 640,
    commitsPerWeek: 380,
    contributors: 3900,
    goodFirstIssues: 26,
    safetyScore: 79,
    verifiedMaintainers: true,
    branchProtection: true,
    signedReleases: true,
    responseHours: 36,
    topics: ['ml', 'deep-learning', 'gpu'],
    prs: [{ number: 8891, title: 'optimize attention kernel dispatch', priority: 'hot' }],
  },
  {
    id: 'kubernetes/kubernetes',
    name: 'kubernetes',
    owner: 'kubernetes',
    district: 'volcano_forge',
    language: 'Go',
    description: 'Container orchestration platform with dense contributor traffic and mature review processes.',
    stars: 116000,
    forks: 41000,
    openPRs: 343,
    commitsPerWeek: 310,
    contributors: 3900,
    goodFirstIssues: 68,
    safetyScore: 91,
    verifiedMaintainers: true,
    branchProtection: true,
    signedReleases: true,
    responseHours: 9,
    topics: ['containers', 'kubernetes', 'cloud', 'infra'],
    prs: [{ number: 9822, title: 'stabilize node lifecycle controller', priority: 'hot' }],
  },
  {
    id: 'microsoft/vscode',
    name: 'vscode',
    owner: 'microsoft',
    district: 'bamboo_valley',
    language: 'TypeScript',
    description: 'Developer editor platform with an active extension ecosystem and many contribution lanes.',
    stars: 173000,
    forks: 31000,
    openPRs: 409,
    commitsPerWeek: 270,
    contributors: 2300,
    goodFirstIssues: 83,
    safetyScore: 89,
    verifiedMaintainers: true,
    branchProtection: true,
    signedReleases: true,
    responseHours: 12,
    topics: ['editor', 'developer-tools', 'typescript'],
    prs: [{ number: 9003, title: 'tighten extension host telemetry', priority: 'hot' }],
  },
  {
    id: 'redis/redis',
    name: 'redis',
    owner: 'redis',
    district: 'forest_repository',
    language: 'C',
    description: 'Fast in-memory data store with visible release activity and focused systems issues.',
    stars: 69000,
    forks: 24000,
    openPRs: 98,
    commitsPerWeek: 76,
    contributors: 920,
    goodFirstIssues: 12,
    safetyScore: 77,
    verifiedMaintainers: true,
    branchProtection: true,
    signedReleases: false,
    responseHours: 31,
    topics: ['database', 'cache', 'server'],
    prs: [{ number: 6934, title: 'improve cluster failover trace', priority: 'normal' }],
  },
];

const GRAPH_REPO_LIMIT = 1200;
const GRAPH_FETCH_ATTEMPTS = 5;
const GRAPH_FETCH_RETRY_DELAY_MS = 550;

const INTRO_MS = 4600;
const ENTRY_MS = 2600;
const CAMERA_HOME = new THREE.Vector3(104, 146, 228);
const TARGET_HOME = new THREE.Vector3(0, 15, 20);
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.7;
const SCENE_PIXEL_RATIO = 1.15;
const HIGH_DETAIL_REPO_STARS = 50000;
const WINDOW_REPO_STARS = 10000;
const MAX_PR_FLOW_ROADS = 132;
const MAX_PR_FLOW_PACKETS = 420;

const FUNCTION_ALIASES: Array<{ label: string; terms: string[]; districts?: DistrictKey[]; topics?: string[]; languages?: string[] }> = [
  {
    label: 'frontend apps',
    terms: ['frontend', 'web app', 'ui', 'ux', 'react', 'components', 'browser', 'css', 'website'],
    districts: ['web'],
    topics: ['frontend', 'ui', 'components', 'css', 'framework'],
    languages: ['TypeScript', 'JavaScript', 'CSS'],
  },
  {
    label: 'ai and machine learning',
    terms: ['ai', 'ml', 'machine learning', 'llm', 'model', 'inference', 'agents', 'rag', 'gpu', 'nlp'],
    districts: ['ai'],
    topics: ['ml', 'llm', 'models', 'inference', 'agents', 'rag', 'gpu', 'nlp'],
    languages: ['Python', 'C++', 'CUDA'],
  },
  {
    label: 'developer tools',
    terms: ['devtool', 'developer tool', 'testing', 'lint', 'format', 'editor', 'automation', 'build tool', 'tooling'],
    districts: ['devtools'],
    topics: ['developer-tools', 'testing', 'linting', 'formatting', 'editor', 'automation', 'build-tool', 'tooling'],
    languages: ['TypeScript', 'JavaScript', 'Rust'],
  },
  {
    label: 'infrastructure',
    terms: ['infra', 'infrastructure', 'cloud', 'monitoring', 'observability', 'metrics', 'server', 'proxy', 'iac', 'tracing'],
    districts: ['infra'],
    topics: ['cloud', 'monitoring', 'observability', 'metrics', 'server', 'proxy', 'iac', 'tracing'],
    languages: ['Go', 'HCL', 'Shell'],
  },
  {
    label: 'systems programming',
    terms: ['systems', 'kernel', 'runtime', 'database', 'networking', 'compiler', 'cache', 'server', 'low level'],
    districts: ['systems'],
    topics: ['systems', 'kernel', 'runtime', 'database', 'networking', 'compiler', 'cache'],
    languages: ['Rust', 'C', 'Go', 'Zig'],
  },
  {
    label: 'beginner contribution',
    terms: ['beginner', 'good first', 'good-first', 'new contributor', 'easy', 'safe', 'trusted', 'contribute'],
    topics: ['safety'],
  },
];

const TUTORIAL_STEPS = [
  {
    title: 'Read The City',
    body: 'Every tower is a repository. Height tracks stars, footprint tracks activity, window density tracks contributor/file complexity, and district color shows the ecosystem.',
    action: 'Pan your eye across the districts first; the skyline is the map.',
  },
  {
    title: 'Inspect Repos',
    body: 'Hover a building to preview its safety score, stars, and open work items. Click a tower to fly closer and open the repo detail panel.',
    action: 'Try clicking a taller tower or a low neighborhood block.',
  },
  {
    title: 'Follow PR Traffic',
    body: 'Thin glowing paths mark a few high-signal pull-request relationships without filling the map with motion.',
    action: 'Look for the sparse paths that connect the largest projects.',
  },
  {
    title: 'Find Safe Work',
    body: 'Use the Safe filter and the panel score before contributing. The score rewards verified maintainers, branch protection, signed releases, fast response time, and good-first issues.',
    action: 'Filter to Safe, then open a repo with a high contribution score.',
  },
  {
    title: 'Contribute Without Risk',
    body: 'Start with good-first issues, read the repo guide, fork instead of requesting direct access, keep changes small, avoid secrets or generated binaries, and let maintainers review before merge.',
    action: 'Use View on GitHub only after the safety signals look healthy.',
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - clamp(value, 0, 1), 3);
}

function easeInOutCubic(value: number) {
  const t = clamp(value, 0, 1);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function formatMetric(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}m`;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return String(value);
}

function districtFor(repo: Repo) {
  return DISTRICTS.find((district) => district.key === repo.district) ?? DISTRICTS[0];
}

function districtCenterForFilter(filter: FilterKey) {
  const districts = DISTRICTS.filter((district) => district.key === filter || district.parent === filter);
  if (!districts.length) return null;
  return {
    x: districts.reduce((total, district) => total + district.x, 0) / districts.length,
    z: districts.reduce((total, district) => total + district.z, 0) / districts.length,
  };
}

function repoHas(repo: Repo, terms: string[]) {
  const text = `${repo.id} ${repo.name} ${repo.owner} ${repo.language} ${repo.description} ${repo.topics.join(' ')}`.toLowerCase();
  return terms.some((term) => text.includes(term));
}

function repoScale(repo: Repo) {
  const stars = clamp((Math.log10(repo.stars + 1) - 1.2) / 5, 0.08, 1);
  const forks = clamp(Math.log10(repo.forks + 1) / 5, 0.12, 1);
  const openWorkItems = getOpenWorkItems(repo);
  const activity = clamp((repo.commitsPerWeek * 0.7 + openWorkItems * 0.45) / 260, 0.08, 1);
  const community = clamp(Math.log10(repo.contributors + 20) / 3.75, 0.18, 1);
  const beginnerSurface = clamp(repo.goodFirstIssues / 80, 0.04, 1);
  return { stars, forks, activity, community, beginnerSurface };
}

function contributionStyleFor(repo: Repo) {
  if (repoHas(repo, ['kernel', 'driver', 'operating-system'])) return 'kernel spire';
  if (repoHas(repo, ['compiler', 'parser', 'language'])) return 'compiler citadel';
  if (repoHas(repo, ['react', 'svelte', 'vue', 'frontend', 'ui', 'css', 'tailwind'])) return 'framework glass';
  if (repoHas(repo, ['llm', 'agent', 'model', 'machine-learning', 'deep-learning', 'ai'])) return 'ai lab';
  if (repoHas(repo, ['testing', 'automation', 'browser'])) return 'testing rig';
  if (repoHas(repo, ['database', 'sql', 'redis', 'cache', 'queue'])) return 'data vault';
  if (repoHas(repo, ['monitoring', 'observability', 'metrics', 'tracing'])) return 'observability array';
  if (repoHas(repo, ['docker', 'kubernetes', 'infra', 'cloud', 'devops'])) return 'infra plant';
  if (repoHas(repo, ['security', 'auth', 'cryptography'])) return 'security outpost';
  return `${districtFor(repo).label.toLowerCase()} repo`;
}

function buildingShapeFor(repo: Repo, district: District) {
  if (repoHas(repo, ['kernel', 'driver', 'operating-system'])) return 'spires';
  if (repoHas(repo, ['compiler', 'parser', 'interpreter', 'language'])) return 'citadel';
  if (repoHas(repo, ['react', 'svelte', 'vue', 'frontend', 'ui', 'css', 'tailwind'])) return 'glass';
  if (repoHas(repo, ['llm', 'agent', 'model', 'machine-learning', 'deep-learning', 'ai'])) return 'holographic';
  if (repoHas(repo, ['testing', 'automation', 'browser'])) return 'tents';
  if (repoHas(repo, ['database', 'sql', 'redis', 'cache', 'queue'])) return 'blocks';
  if (repoHas(repo, ['monitoring', 'observability', 'metrics', 'tracing'])) return 'observatories';
  if (repoHas(repo, ['docker', 'kubernetes', 'infra', 'cloud', 'devops'])) return 'lava_foundries';
  if (repoHas(repo, ['security', 'auth', 'cryptography'])) return 'decayed';
  return district.shape;
}

function colorForSafety(score: number) {
  if (isGreenSafety(score)) return '#34d399';
  if (score >= SAFETY_AMBER_THRESHOLD) return '#fbbf24';
  return '#ff6b6b';
}

function tokenizeSearch(query: string) {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9+#./\s-]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function expandSearchTokens(tokens: string[]) {
  return Array.from(new Set(tokens.flatMap((token) => [token, ...token.split(/[-_/]+/)]).filter(Boolean)));
}

function districtMatchesQuery(district: District, cleanQuery: string, tokens: string[]) {
  const districtTokens = expandSearchTokens(tokenizeSearch(`${district.label} ${district.key.replace(/_/g, ' ')} ${district.parent}`));
  const queryTokens = expandSearchTokens(tokens);
  const parentMatches = tokens.some((token) => token === district.parent);
  const exactDistrictTokenMatch = queryTokens.some((token) => districtTokens.includes(token));
  const districtText = districtTokens.join(' ');
  const substantialPartialMatch = queryTokens
    .filter((token) => token.length >= 3)
    .some((token) => districtText.includes(token));

  return parentMatches || exactDistrictTokenMatch || (cleanQuery.length >= 3 && districtText.includes(cleanQuery)) || substantialPartialMatch;
}

function textMatchesTokenizedQuery(haystack: string, cleanQuery: string, tokens: string[]) {
  const normalizedHaystack = haystack.toLowerCase();
  const haystackTokens = expandSearchTokens(tokenizeSearch(normalizedHaystack));
  const queryTokens = expandSearchTokens(tokens);

  if (tokens.length > 1 && cleanQuery.length >= 3 && normalizedHaystack.includes(cleanQuery)) return true;
  if (haystackTokens.includes(cleanQuery)) return true;

  return queryTokens.some((token) => haystackTokens.includes(token));
}

function getOpenWorkItems(repo: Repo) {
  return Math.max(repo.openIssues ?? 0, repo.openPRs ?? 0);
}

function queryTermMatches(cleanQuery: string, tokens: string[], term: string) {
  const normalizedTerm = term.toLowerCase().trim();
  if (!normalizedTerm) return false;

  const queryTokens = expandSearchTokens(tokens);
  const termTokens = expandSearchTokens(tokenizeSearch(normalizedTerm));
  if (termTokens.length === 0) return false;

  if (termTokens.length === 1) {
    const [termToken] = termTokens;
    return termToken.length <= 2 ? queryTokens.includes(termToken) : cleanQuery.includes(termToken);
  }

  return cleanQuery.includes(normalizedTerm) || termTokens.every((token) => queryTokens.includes(token));
}

function queryIncludesAny(cleanQuery: string, tokens: string[], terms: string[]) {
  return terms.some((term) => queryTermMatches(cleanQuery, tokens, term));
}

function getSafetyReasons(repo: Repo): SafetyReason[] {
  return repo.safetyProfile?.reasons ?? buildRepoSafetyProfile(repo).reasons;
}

function scoreSearchResult(repo: Repo, query: string): SearchResult | null {
  const cleanQuery = query.trim().toLowerCase();
  const tokens = tokenizeSearch(query);
  if (!cleanQuery || tokens.length === 0) return null;

  const district = districtFor(repo);
  const haystacks = {
    name: repo.name.toLowerCase(),
    owner: repo.owner.toLowerCase(),
    language: repo.language.toLowerCase(),
    district: `${district.label} ${district.key}`.toLowerCase(),
    topics: repo.topics.join(' ').toLowerCase(),
    description: repo.description.toLowerCase(),
    prs: repo.prs.map((pr) => pr.title).join(' ').toLowerCase(),
  };

  const pings: SearchPing[] = [];
  const substantialTokens = tokens.filter((token) => token.length >= 3);
  const addPing = (label: string, detail: string, weight: number) => {
    const existing = pings.find((ping) => ping.label === label && ping.detail === detail);
    if (existing) existing.weight = Math.max(existing.weight, weight);
    else pings.push({ label, detail, weight });
  };

  const matchedNameToken = substantialTokens.find((token) => haystacks.name.includes(token));
  if (haystacks.name === cleanQuery) addPing('name', `exact repo match: ${repo.name}`, 150);
  else if (cleanQuery.length >= 3 && haystacks.name.includes(cleanQuery)) addPing('name', `repo name contains "${cleanQuery}"`, 95);
  else if (matchedNameToken) addPing('name', `repo name contains "${matchedNameToken}"`, 82);

  if ((cleanQuery.length >= 3 && haystacks.owner.includes(cleanQuery)) || substantialTokens.some((token) => haystacks.owner.includes(token))) {
    addPing('owner', `${repo.owner} owns this repo`, 46);
  }
  if (haystacks.language.includes(cleanQuery) || substantialTokens.some((token) => haystacks.language === token || haystacks.language.includes(token))) {
    addPing('language', `${repo.language} codebase`, 72);
  }
  if (districtMatchesQuery(district, cleanQuery, tokens)) {
    addPing('type', `${district.label} district`, 78);
  }

  const matchedTopics = repo.topics.filter((topic) => textMatchesTokenizedQuery(topic, cleanQuery, tokens));
  if (matchedTopics.length) addPing('topic', matchedTopics.slice(0, 3).join(', '), 58 + matchedTopics.length * 8);

  if (textMatchesTokenizedQuery(haystacks.description, cleanQuery, tokens)) {
    addPing('function', repo.description, 42);
  }

  const matchedPr = repo.prs.find((pr) => textMatchesTokenizedQuery(pr.title, cleanQuery, tokens));
  if (matchedPr) addPing('PR activity', `PR #${matchedPr.number}: ${matchedPr.title}`, 38);

  FUNCTION_ALIASES.forEach((alias) => {
    if (!queryIncludesAny(cleanQuery, tokens, alias.terms)) return;
    let weight = 0;
    const details: string[] = [];
    if (alias.districts?.some((districtKey) => repo.district === districtKey || district.parent === districtKey)) {
      weight += 78;
      details.push(`${district.label} type`);
    }
    const topicMatches = repo.topics.filter((topic) => alias.topics?.some((aliasTopic) => topic.toLowerCase().includes(aliasTopic)));
    if (topicMatches.length) {
      weight += 44 + topicMatches.length * 8;
      details.push(topicMatches.slice(0, 2).join(', '));
    }
    if (alias.languages?.includes(repo.language)) {
      weight += 26;
      details.push(repo.language);
    }
    if (alias.label === 'beginner contribution') {
      weight += isGreenSafety(repo.safetyScore) ? 42 : 12;
      weight += Math.min(36, repo.goodFirstIssues);
      details.push(`${repo.safetyScore}% safe, ${repo.goodFirstIssues} good-first issues`);
    }
    if (weight > 0) addPing('intent', `${alias.label}: ${details.join(' · ')}`, weight);
  });

  if (queryIncludesAny(cleanQuery, tokens, ['safe', 'trusted', 'secure', 'beginner', 'contribute', 'good first'])) {
    const topReason = repo.safetyProfile?.reasons[0]?.label ?? `${repo.goodFirstIssues} good-first issues`;
    addPing('safety', `${repo.safetyScore}% contribution-ready · ${topReason}`, Math.round(repo.safetyScore * 0.72 + repo.goodFirstIssues * 0.35));
  }

  if (queryIncludesAny(cleanQuery, tokens, ['popular', 'stars', 'big', 'famous'])) {
    addPing('popularity', `${formatMetric(repo.stars)} stars`, Math.min(86, Math.log10(repo.stars) * 16));
  }

  if (queryIncludesAny(cleanQuery, tokens, ['active', 'activity', 'prs', 'commits', 'traffic', 'busy'])) {
    const openWorkItems = getOpenWorkItems(repo);
    addPing('activity', `${repo.commitsPerWeek} commits/week and ${openWorkItems} open items`, Math.min(90, repo.commitsPerWeek / 4 + openWorkItems / 12));
  }

  const score = Math.round(pings.reduce((total, ping) => total + ping.weight, 0));
  if (score <= 0) return null;

  return {
    repo,
    score,
    pings: pings.sort((a, b) => b.weight - a.weight).slice(0, 4),
  };
}

function searchRepos(query: string, repos: Repo[] = REPOS) {
  return repos.map((repo) => scoreSearchResult(repo, query))
    .filter((result): result is SearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || b.repo.safetyScore - a.repo.safetyScore || b.repo.stars - a.repo.stars)
    .slice(0, 6);
}

function makeSpriteTexture(title: string, subtitle: string, color: string, width = 420, height = 150) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.clearRect(0, 0, width, height);
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, 'rgba(255,255,255,0.16)');
  gradient.addColorStop(0.44, 'rgba(255,255,255,0.045)');
  gradient.addColorStop(1, 'rgba(79,140,255,0.06)');
  ctx.fillStyle = 'rgba(3,8,19,0.72)';
  roundRect(ctx, 4, 4, width - 8, height - 8, 24);
  ctx.fill();
  ctx.fillStyle = gradient;
  roundRect(ctx, 4, 4, width - 8, height - 8, 24);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.56;
  ctx.lineWidth = 3;
  roundRect(ctx, 5.5, 5.5, width - 11, height - 11, 24);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.font = '700 34px Space Mono, monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText(title, 30, 58);
  ctx.font = '400 22px Space Mono, monospace';
  ctx.fillStyle = color;
  ctx.fillText(subtitle, 30, 99);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function createRepoLayout(repo: Repo, index: number, districtRepos: Repo[], heightScaleDriver: HeightScaleDriver = 'stars') {
  const district = districtFor(repo);
  const scale = repoScale(repo);
  const gridWidth = Math.max(3, Math.ceil(Math.sqrt(districtRepos.length)));
  const column = index % gridWidth;
  const row = Math.floor(index / gridWidth);
  const stagger = district.shape === 'clusters' ? Math.sin(index * 1.7) * 2.4 : 0;

  // Center the grid layout perfectly around district.x and district.z
  const x = district.x + (column - (gridWidth - 1) / 2) * 11.4 + stagger + Math.sin((repo.stars % 41) * 0.18) * 0.7;
  const z = district.z + (row - (gridWidth - 1) / 2) * 12.2 + (column % 2) * 2.4 + Math.cos((repo.forks % 37) * 0.15) * 0.7;

  let scaleDriver = scale.stars;
  if (heightScaleDriver === 'activity') {
    scaleDriver = scale.activity;
  } else if (heightScaleDriver === 'contributors') {
    scaleDriver = scale.community;
  }

  const heightBias =
    district.shape === 'spires' || district.shape === 'megatowers' || district.shape === 'vertical_arcology' ? 1.12 :
    district.shape === 'suburbs' || district.shape === 'tents' || district.shape === 'fishing_docks' ? 0.62 :
    district.shape === 'blocks' || district.shape === 'lava_foundries' ? 0.78 :
    0.94;
  const height = clamp(1.35 + Math.pow(scaleDriver, 4.15) * 72 * heightBias + Math.pow(scale.activity, 2.6) * 1.1, 1.6, 72);
  const widthBias =
    district.shape === 'blocks' || district.shape === 'apartments' || district.shape === 'valley_villages' ? 1.28 :
    district.shape === 'glass' || district.shape === 'crystal_spires' ? 0.92 :
    district.shape === 'spires' || district.shape === 'citadel' ? 0.84 :
    1;
  const width = clamp(1.35 + Math.pow(scale.forks, 1.8) * 4.4 + Math.pow(scale.activity, 1.5) * 0.45, 1.45, 6.4) * widthBias;
  const depth = clamp(1.4 + Math.pow(scale.community, 1.8) * 4.1 + Math.pow(scale.beginnerSurface, 1.4) * 0.45, 1.55, 6.6) * (district.shape === 'blocks' ? 1.1 : 1);

  return {
    position: new THREE.Vector3(x, 0, z),
    height,
    width,
    depth,
  };
}

function createSiftRenderer() {
  const rendererOptions: THREE.WebGLRendererParameters[] = [
    { antialias: false, alpha: false, powerPreference: 'high-performance' },
    { antialias: false, alpha: false, powerPreference: 'default' },
    { antialias: false, alpha: false, powerPreference: 'low-power' },
  ];

  for (const options of rendererOptions) {
    try {
      return new THREE.WebGLRenderer(options);
    } catch {
      // Try progressively gentler contexts below.
    }
  }

  const canvas = document.createElement('canvas');
  const contextOptions: WebGLContextAttributes = {
    alpha: false,
    antialias: false,
    depth: true,
    stencil: false,
    preserveDrawingBuffer: false,
    failIfMajorPerformanceCaveat: false,
    powerPreference: 'low-power',
  };
  const context =
    canvas.getContext('webgl2', contextOptions) ??
    canvas.getContext('webgl', contextOptions) ??
    canvas.getContext('experimental-webgl', contextOptions);

  if (!context) {
    throw new Error('No WebGL context available');
  }

  return new THREE.WebGLRenderer({
    canvas,
    context: context as WebGLRenderingContext | WebGL2RenderingContext,
    antialias: false,
    alpha: false,
  });
}

function scenePixelRatio() {
  return Math.min(window.devicePixelRatio || 1, SCENE_PIXEL_RATIO);
}

function setMaterialOpacity(material: THREE.Material | THREE.Material[], opacity: number) {
  const materials = Array.isArray(material) ? material : [material];
  materials.forEach((item) => {
    item.transparent = opacity < 1;
    item.opacity = opacity;
  });
}

function applyAppearance(refs: SceneRefs, appearance: Appearance) {
  const isDay = appearance === 'day';
  refs.scene.background = new THREE.Color(isDay ? '#bcd7ff' : '#030816');
  refs.scene.fog = new THREE.FogExp2(isDay ? '#9dbce7' : '#08142a', isDay ? 0.0035 : 0.0055);
  refs.renderer.toneMappingExposure = isDay ? 1.18 : 1.12;
  refs.ambient.color.set(isDay ? '#dbeafe' : '#9bb7f0');
  refs.ambient.intensity = isDay ? 1.3 : 1.05;
  refs.key.color.set(isDay ? '#fff4cf' : '#dbe8ff');
  refs.key.intensity = isDay ? 3.2 : 2.75;
  refs.rim.color.set(isDay ? '#7bbcff' : '#4f8cff');
  refs.rim.intensity = isDay ? 38 : 74;

  refs.scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    const role = mesh.userData.role;
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (!material) return;

    if (role === 'ground') {
      const groundMaterial = material as THREE.MeshBasicMaterial;
      groundMaterial.color.set(isDay ? '#c7d6cf' : '#536c88');
    }

    if (role === 'grid') setMaterialOpacity(material, isDay ? 0.05 : 0.045);
    if (role === 'stars') setMaterialOpacity(material, isDay ? 0.02 : 0.24);
    if (role === 'moon') setMaterialOpacity(material, isDay ? 0.025 : 0.08);
    if (role === 'district-plane') setMaterialOpacity(material, isDay ? 0.045 : 0.035);
    if (role === 'landscape') {
      const firstMaterial = Array.isArray(material) ? material[0] : material;
      const opacity = isDay
        ? mesh.userData.dayOpacity ?? firstMaterial.userData.dayOpacity
        : mesh.userData.nightOpacity ?? firstMaterial.userData.nightOpacity;
      if (typeof opacity === 'number') setMaterialOpacity(material, opacity);
    }
  });
}


function applyFilter(objects: BuildingObject[], roads: RoadObject[], filter: FilterKey) {
  for (const building of objects) {
    const active =
      filter === 'all' ||
      building.repo.district === filter ||
      building.district.parent === filter ||
      (filter === 'stars' && building.repo.stars >= 10000) ||
      (filter === 'safe' && isGreenSafety(building.repo.safetyScore));
    const opacity = active ? 1 : 0.22;
    building.body.material.opacity = opacity;
    building.body.material.transparent = opacity < 1;
    building.top.material.opacity = active ? 1 : 0.28;
    building.top.material.transparent = !active;
    building.windows.material.opacity = active ? 0.76 : 0.12;
  }

  for (const road of roads) {
    const sourceActive =
      filter === 'all' ||
      road.source.district === filter ||
      districtFor(road.source).parent === filter ||
      (filter === 'stars' && road.source.stars >= 10000) ||
      (filter === 'safe' && isGreenSafety(road.source.safetyScore));
    const targetActive =
      filter === 'all' ||
      road.target.district === filter ||
      districtFor(road.target).parent === filter ||
      (filter === 'stars' && road.target.stars >= 10000) ||
      (filter === 'safe' && isGreenSafety(road.target.safetyScore));
    const roadOpacity = sourceActive || targetActive ? road.baseOpacity : 0.025;
    road.mesh.material.userData.filteredOpacity = roadOpacity;
    road.mesh.material.opacity = roadOpacity;
    road.label.material.opacity = 0;
    road.cars.forEach((car) => {
      const material = car.material as THREE.MeshBasicMaterial;
      material.userData.filteredOpacity = sourceActive || targetActive ? 0.92 : 0.14;
      material.opacity = material.userData.filteredOpacity;
    });
  }
}

function getRepoScreenPosition(building: BuildingObject, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) {
  const vector = new THREE.Vector3(building.position.x, building.height + 3, building.position.z);
  vector.project(camera);
  const rect = renderer.domElement.getBoundingClientRect();
  return {
    x: (vector.x * 0.5 + 0.5) * rect.width,
    y: (-vector.y * 0.5 + 0.5) * rect.height,
  };
}

export default function Home() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [loadedRepos, setLoadedRepos] = useState<Repo[]>([]);
  const [repoImport, setRepoImport] = useState('');
  const [importingRepo, setImportingRepo] = useState(false);
  const [importStatus, setImportStatus] = useState('Paste owner/repo or a GitHub URL.');
  const [wantsContributions, setWantsContributions] = useState(true);
  const [webglError, setWebglError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadGraph = async () => {
      let lastError: unknown = null;

      for (let attempt = 1; attempt <= GRAPH_FETCH_ATTEMPTS; attempt += 1) {
        try {
          const response = await fetch(`/api/py/graph-full?limit=${GRAPH_REPO_LIMIT}`, { cache: 'no-store' });
          if (!response.ok) throw new Error(`Graph request failed with ${response.status}`);

          const data = await response.json() as GraphFullResponse;
          const mappedRepos = (data.nodes ?? [])
            .filter(isGraphRepositoryNode)
            .map(buildRepoFromGraphNode);

          if (!mappedRepos.length) throw new Error('Graph response contained no repositories');
          if (!cancelled) {
            setRepos(mappedRepos);
            setLoadingRepos(false);
          }
          return;
        } catch (error) {
          lastError = error;
          if (attempt < GRAPH_FETCH_ATTEMPTS) {
            await wait(GRAPH_FETCH_RETRY_DELAY_MS * attempt);
          }
        }
      }

      console.error('[SIFT graph] Failed to fetch local graph; using demo repositories:', lastError);
      if (!cancelled) {
        setRepos(REPOS.map((repo) => enrichRepoSafety(repo)));
        setImportStatus('Backend graph unavailable; showing demo repos.');
        setLoadingRepos(false);
      }
    };

    loadGraph();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('sift.loadedRepos');
      if (saved) {
        const parsed = JSON.parse(saved) as Repo[];
        setLoadedRepos(parsed.map((repo) => enrichRepoSafety(repo)));
      }
    } catch (error) {
      console.warn('[SIFT imports] Could not read saved repositories:', error);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('sift.loadedRepos', JSON.stringify(loadedRepos.slice(0, 20)));
    } catch (error) {
      console.warn('[SIFT imports] Could not save repositories:', error);
    }
  }, [loadedRepos]);

  const mountRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SceneRefs | null>(null);
  const enteredRef = useRef(false);
  const filterRef = useRef<FilterKey>('all');
  const appearanceRef = useRef<Appearance>('day');
  const selectedRef = useRef<Repo | null>(null);
  const hoverRef = useRef<Repo | null>(null);
  const similarDistrictRef = useRef<DistrictKey | null>(null);
  const similarUntilRef = useRef(0);

  const [entered, setEntered] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [appearance, setAppearance] = useState<Appearance>('day');
  const [heightScaleDriver, setHeightScaleDriver] = useState<HeightScaleDriver>('stars');
  const [zoomValue, setZoomValue] = useState(1);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const targetDistrictCenterRef = useRef<{ x: number; z: number } | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [query, setQuery] = useState('');
  const [hoveredRepo, setHoveredRepo] = useState<Repo | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [stats, setStats] = useState({ repos: 0, prs: 0, safe: 0 });
  const [safetyProfiles, setSafetyProfiles] = useState<Record<string, SafetyProfile>>({});
  const [rendererRetryToken, setRendererRetryToken] = useState(0);

  const allRepos = useMemo(() => {
    const importedIds = new Set(loadedRepos.map((repo) => repo.id));
    return [...loadedRepos, ...repos.filter((repo) => !importedIds.has(repo.id))];
  }, [loadedRepos, repos]);

  const effectiveRepos = useMemo(() => {
    return allRepos.map((repo) => applySafetyProfile(repo, safetyProfiles[repo.id] ?? repo.safetyProfile));
  }, [allRepos, safetyProfiles]);

  const reposByDistrict = useMemo(() => {
    return DISTRICTS.map((district) => ({
      district,
      repos: effectiveRepos.filter((repo) => repo.district === district.key),
    }));
  }, [effectiveRepos]);
  const searchResults = useMemo(() => searchRepos(query, effectiveRepos), [query, effectiveRepos]);
  const safetyReasons = useMemo(() => (selectedRepo ? getSafetyReasons(selectedRepo) : []), [selectedRepo]);
  const loadedTodayRepos = useMemo(() => {
    const today = new Date().toDateString();
    return loadedRepos.filter((repo) => repo.loadedAt && new Date(repo.loadedAt).toDateString() === today).slice(0, 4);
  }, [loadedRepos]);
  const highStarTrending = useMemo(() => {
    return [...effectiveRepos].sort((a, b) => b.stars - a.stars).slice(0, 3);
  }, [effectiveRepos]);
  const lowStarPromising = useMemo(() => {
    return [...effectiveRepos]
      .filter((repo) => repo.stars < 10000)
      .sort((a, b) => (b.goodFirstIssues * 12 + b.safetyScore + getOpenWorkItems(b) * 0.4) - (a.goodFirstIssues * 12 + a.safetyScore + getOpenWorkItems(a) * 0.4))
      .slice(0, 3);
  }, [effectiveRepos]);
  const fallbackCity = useMemo(() => {
    const items = reposByDistrict.flatMap(({ repos }) => repos.map((repo, index) => {
      const layout = createRepoLayout(repo, index, repos, heightScaleDriver);
      return { repo, district: districtFor(repo), layout };
    }));
    const extent = Math.max(
      210,
      ...items.map((item) => Math.max(Math.abs(item.layout.position.x), Math.abs(item.layout.position.z)) + 24),
    );
    return { items, extent };
  }, [reposByDistrict, heightScaleDriver]);

  useEffect(() => {
    enteredRef.current = entered;
    if (entered && sceneRef.current && !sceneRef.current.enteredAt) {
      sceneRef.current.enteredAt = performance.now();
    }
  }, [entered]);

  useEffect(() => {
    filterRef.current = filter;
    if (sceneRef.current) applyFilter(sceneRef.current.buildings, sceneRef.current.roads, filter);
  }, [filter]);

  useEffect(() => {
    appearanceRef.current = appearance;
    if (sceneRef.current) applyAppearance(sceneRef.current, appearance);
  }, [appearance]);

  useEffect(() => {
    selectedRef.current = selectedRepo;
  }, [selectedRepo]);

  useEffect(() => {
    hoverRef.current = hoveredRepo;
  }, [hoveredRepo]);

  useEffect(() => {
    if (allRepos.length === 0) return;
    let cancelled = false;
    const chunks = Array.from({ length: Math.max(1, Math.ceil(allRepos.length / SAFETY_SCORE_BATCH_SIZE)) }, (_, index) => {
      const start = index * SAFETY_SCORE_BATCH_SIZE;
      return allRepos.slice(start, start + SAFETY_SCORE_BATCH_SIZE);
    });
    const allProfiles: Record<string, SafetyProfile> = {};
    const postSafetyBatch = async (repos: Repo[]) => {
      const response = await fetch('/api/py/safety-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repos }),
      });
      if (!response.ok) {
        throw new Error(`Safety scoring failed with ${response.status}`);
      }
      const payload = await response.json() as { profiles?: Record<string, SafetyProfile> };
      if (!payload.profiles) return;
      Object.assign(allProfiles, payload.profiles);
    };

    (async () => {
      try {
        for (const chunk of chunks) {
          if (cancelled) return;
          await postSafetyBatch(chunk);
        }
        if (!cancelled) {
          setSafetyProfiles(allProfiles);
        }
      } catch (error) {
        console.warn('[Safety scoring] Using local fallback formula:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [allRepos]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('renderer')) return;
    url.searchParams.delete('renderer');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  useEffect(() => {
    if (!selectedRepo) return;
    const updated = effectiveRepos.find((repo) => repo.id === selectedRepo.id);
    if (updated && updated.safetyScore !== selectedRepo.safetyScore) {
      setSelectedRepo(updated);
    }
  }, [effectiveRepos, selectedRepo]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#040606');
    scene.fog = new THREE.FogExp2('#0c1514', 0.012);

    const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 0.1, 3500);
    camera.position.set(-220, 180, 260);

    setWebglError('');

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = createSiftRenderer();
    } catch (error) {
      console.warn('[SIFT scene] WebGL renderer could not start; rendering the lightweight city:', error);
      setWebglError('Full 3D is still retrying for this browser session.');
      return undefined;
    }
    renderer.setPixelRatio(scenePixelRatio());
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = false;
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight('#9fcfc0', 0.7);
    scene.add(ambient);

    const key = new THREE.DirectionalLight('#dbe8ff', 2.4);
    key.position.set(-22, 48, 20);
    scene.add(key);

    const rim = new THREE.PointLight('#4fb7c5', 68, 120, 1.6);
    rim.position.set(0, 18, -32);
    scene.add(rim);

    createGround(scene);
    createSky(scene);

    const buildings: BuildingObject[] = [];
    reposByDistrict.forEach(({ repos }) => {
      repos.forEach((repo, index) => {
        const building = createBuilding(repo, index, repos, heightScaleDriver);
        buildings.push(building);
        scene.add(building.group);
      });
    });
    const hitTargets = buildings.flatMap((building) => [building.body, building.top]);

    const roads = createRoads(scene, buildings);
    applyFilter(buildings, roads, filterRef.current);

    const refs: SceneRefs = {
      renderer,
      scene,
      camera,
      ambient,
      key,
      rim,
      raycaster: new THREE.Raycaster(),
      pointer: new THREE.Vector2(9, 9),
      buildings,
      roads,
      frame: 0,
      startedAt: performance.now(),
      enteredAt: null,
      cameraPosition: camera.position.clone(),
      cameraTarget: new THREE.Vector3(-12, 5, -1),
      zoom: 1,
      targetZoom: 1,
    };
    sceneRef.current = refs;
    applyAppearance(refs, appearanceRef.current);

    const findBuilding = (repoId: string | undefined) => buildings.find((building) => building.repo.id === repoId) ?? null;

    const handleResize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      renderer.setPixelRatio(scenePixelRatio());
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const nextZoom = clamp(refs.targetZoom + Math.sign(event.deltaY) * 0.08, MIN_ZOOM, MAX_ZOOM);
      refs.targetZoom = nextZoom;
      setZoomValue(Number(nextZoom.toFixed(2)));
    };

    // Free navigation offsets
    let freeNavX = 0;
    let freeNavY = 0; // Camera height adjustments (top-down vs face-on)
    let freeNavZ = 0;
    let isDragging = false;
    let didDrag = false;
    let lastDragAt = 0;
    let prevMouseX = 0;
    let prevMouseY = 0;
    const keysPressed: Record<string, boolean> = {};
    const panRight = new THREE.Vector3();
    const panForward = new THREE.Vector3();

    const clampFreeNavigation = () => {
      freeNavX = clamp(freeNavX, -260, 260);
      freeNavY = clamp(freeNavY, -165, 350);
      freeNavZ = clamp(freeNavZ, -260, 260);
    };

    const returnToCityOverview = () => {
      setSelectedRepo(null);
      setHoveredRepo(null);
      targetDistrictCenterRef.current = null;
      similarDistrictRef.current = null;
      similarUntilRef.current = 0;
      freeNavX = 0;
      freeNavY = 0;
      freeNavZ = 0;
      refs.targetZoom = 1;
      setZoomValue(1);
      refs.pointer.set(9, 9);
      renderer.domElement.style.cursor = 'grab';
      if (tooltipRef.current) tooltipRef.current.style.opacity = '0';
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysPressed[key] = true;

      if (key === 'escape') {
        e.preventDefault();
        keysPressed[key] = false;
        returnToCityOverview();
        return;
      }

      if (['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        // Clear selection on keyboard input so the camera returns to free navigation control
        setSelectedRepo(null);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed[e.key.toLowerCase()] = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button === 0) { // Left click drag
        event.preventDefault();
        isDragging = true;
        didDrag = false;
        prevMouseX = event.clientX;
        prevMouseY = event.clientY;
        renderer.domElement.style.cursor = 'grabbing';
        try {
          renderer.domElement.setPointerCapture?.(event.pointerId);
        } catch {
          // Synthetic pointer events used by browser tests may not be capturable.
        }
      }
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (isDragging && didDrag) {
        lastDragAt = performance.now();
      }
      isDragging = false;
      renderer.domElement.style.cursor = hoverRef.current ? 'pointer' : 'grab';
      try {
        if (renderer.domElement.hasPointerCapture?.(event.pointerId)) {
          renderer.domElement.releasePointerCapture?.(event.pointerId);
        }
      } catch {
        // Ignore release failures for synthetic or already-cancelled pointer streams.
      }
    };

    const handlePointerMoveDrag = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      refs.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      refs.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      if (isDragging && enteredRef.current) {
        const deltaX = event.clientX - prevMouseX;
        const deltaY = event.clientY - prevMouseY;
        prevMouseX = event.clientX;
        prevMouseY = event.clientY;

        // Clear selection on drag pan
        if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
          didDrag = true;
          setSelectedRepo(null);
        }

        // Pan the camera based on delta movement (scaled by zoom)
        const panScale = 0.32 * refs.zoom;
        if (event.shiftKey) {
          // Adjust vertical angle/height when holding Shift
          freeNavY -= deltaY * panScale * 1.5;
        } else {
          // Normal panning follows the current camera angle, so drag remains natural after camera changes.
          panRight.setFromMatrixColumn(camera.matrixWorld, 0);
          panRight.y = 0;
          panRight.normalize();
          camera.getWorldDirection(panForward);
          panForward.y = 0;
          panForward.normalize();

          freeNavX += (-deltaX * panScale * panRight.x) + (-deltaY * panScale * panForward.x);
          freeNavZ += (-deltaX * panScale * panRight.z) + (-deltaY * panScale * panForward.z);
        }
        clampFreeNavigation();
      }
    };

    const handlePointerLeave = () => {
      if (isDragging) return;
      refs.pointer.set(9, 9);
      setHoveredRepo(null);
      renderer.domElement.style.cursor = 'default';
      if (tooltipRef.current) tooltipRef.current.style.opacity = '0';
    };

    const handleClick = () => {
      if (didDrag || performance.now() - lastDragAt < 140) return;
      if (!hoverRef.current) return;
      setSelectedRepo(hoverRef.current);
    };

    let hoverFrame = 0;
    const animate = () => {
      const now = performance.now();
      const elapsed = (now - refs.startedAt) / 1000;
      const introT = easeInOutCubic((now - refs.startedAt) / INTRO_MS);
      const entryT = refs.enteredAt ? easeOutCubic((now - refs.enteredAt) / ENTRY_MS) : 0;

      hoverFrame += 1;
      const pointerOnStage = refs.pointer.x >= -1 && refs.pointer.x <= 1 && refs.pointer.y >= -1 && refs.pointer.y <= 1;
      if (pointerOnStage && !isDragging && hoverFrame % 3 === 0) {
        refs.raycaster.setFromCamera(refs.pointer, camera);
        const intersections = refs.raycaster.intersectObjects(hitTargets, false);
        const hovered = intersections.length ? findBuilding(intersections[0].object.userData.repoId as string | undefined) : null;
        if (hovered?.repo.id !== hoverRef.current?.id) {
          setHoveredRepo(hovered?.repo ?? null);
          renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab';
        }
      }

      const selected = selectedRef.current;
      const selectedBuilding = selected ? findBuilding(selected.id) : null;

      // Process keyboard movement (W, A, S, D / Arrow keys)
      const moveSpeed = 4.6 * refs.zoom;
      if (enteredRef.current) {
        let isUserMoving = false;
        if (keysPressed['w']) {
          freeNavZ -= moveSpeed;
          isUserMoving = true;
        }
        if (keysPressed['s']) {
          freeNavZ += moveSpeed;
          isUserMoving = true;
        }
        if (keysPressed['a']) {
          freeNavX -= moveSpeed;
          isUserMoving = true;
        }
        if (keysPressed['d']) {
          freeNavX += moveSpeed;
          isUserMoving = true;
        }

        // Arrow keys: Up/Down tilts vertical angle (freeNavY), Left/Right pans horizontally
        if (keysPressed['arrowup']) {
          freeNavY += moveSpeed * 1.5;
          isUserMoving = true;
        }
        if (keysPressed['arrowdown']) {
          freeNavY -= moveSpeed * 1.5;
          isUserMoving = true;
        }
        if (keysPressed['arrowleft']) {
          freeNavX -= moveSpeed;
          isUserMoving = true;
        }
        if (keysPressed['arrowright']) {
          freeNavX += moveSpeed;
          isUserMoving = true;
        }

        // Vertical look angle control (Q flies UP for top-down, E flies DOWN for face-on)
        if (keysPressed['q']) {
          freeNavY += moveSpeed * 1.2;
          isUserMoving = true;
        }
        if (keysPressed['e']) {
          freeNavY -= moveSpeed * 1.2;
          isUserMoving = true;
        }
        clampFreeNavigation();

        if (isUserMoving) {
          targetDistrictCenterRef.current = null;
        }

        const targetCenter = targetDistrictCenterRef.current;
        if (targetCenter) {
          freeNavX += (targetCenter.x - freeNavX) * 0.08;
          freeNavZ += (targetCenter.z - freeNavZ) * 0.08;
          freeNavY += (-80 - freeNavY) * 0.08;
          refs.targetZoom = THREE.MathUtils.lerp(refs.targetZoom, 0.46, 0.08);

          if (Math.abs(targetCenter.x - freeNavX) < 1 && Math.abs(targetCenter.z - freeNavZ) < 1) {
            targetDistrictCenterRef.current = null;
          }
        }
      }

      const mouseParallax = new THREE.Vector3(0, 0, 0);

      const introPosition = new THREE.Vector3(
        THREE.MathUtils.lerp(-170, 104, introT),
        THREE.MathUtils.lerp(104, 136, introT),
        THREE.MathUtils.lerp(240, 218, introT),
      );
      const introTarget = new THREE.Vector3(THREE.MathUtils.lerp(-18, 0, introT), 15, THREE.MathUtils.lerp(6, 20, introT));

      let desiredPosition = introPosition;
      let desiredTarget = introTarget;

      if (enteredRef.current) {
        const freeOffset = new THREE.Vector3(freeNavX, freeNavY, freeNavZ);
        desiredPosition = CAMERA_HOME.clone().add(mouseParallax).add(freeOffset);
        desiredTarget = TARGET_HOME.clone().add(new THREE.Vector3(freeNavX, 0, freeNavZ));
      }

      if (selectedBuilding && enteredRef.current) {
        const focusDistance = clamp(selectedBuilding.height * 0.76, 32, 88);
        const focusHeight = clamp(selectedBuilding.height * 0.58, 18, 58);
        desiredPosition = selectedBuilding.position.clone().add(new THREE.Vector3(focusDistance * 0.64, focusHeight, focusDistance));
        desiredTarget = selectedBuilding.position.clone().add(new THREE.Vector3(0, selectedBuilding.height * 0.43, 0));
      }

      if (refs.enteredAt && entryT < 1 && !selectedBuilding) {
        desiredPosition.lerpVectors(introPosition, CAMERA_HOME, entryT).add(mouseParallax);
        desiredTarget.lerpVectors(introTarget, TARGET_HOME, entryT);
      }

      refs.zoom = THREE.MathUtils.lerp(refs.zoom, refs.targetZoom, 0.08);
      if (enteredRef.current) {
        const offset = desiredPosition.clone().sub(desiredTarget).multiplyScalar(refs.zoom);
        desiredPosition = desiredTarget.clone().add(offset);
      }

      refs.cameraPosition.lerp(desiredPosition, 0.045);
      refs.cameraTarget.lerp(desiredTarget, 0.055);
      camera.position.copy(refs.cameraPosition);
      camera.lookAt(refs.cameraTarget);

      const similarActive = now < similarUntilRef.current;
      for (const building of buildings) {
        const isHovered = hoverRef.current?.id === building.repo.id;
        const isSelected = selectedRef.current?.id === building.repo.id;
        const isSimilar = similarActive && (similarDistrictRef.current === building.repo.district || similarDistrictRef.current === building.district.parent);
        const pulse = 0.5 + Math.sin(elapsed * 2.5 + building.phase * 8) * 0.5;
        building.body.material.emissiveIntensity = isSelected ? 0.12 : isHovered ? 0.08 : isSimilar ? 0.06 + pulse * 0.025 : 0.018;
        building.top.material.emissiveIntensity = isSelected || isHovered ? 0.32 : isSimilar ? 0.18 : 0.08;
        building.windows.material.opacity = isHovered || isSelected ? 0.58 : filterRef.current === 'all' ? 0.28 : building.windows.material.opacity;
        if (isSelected) {
          const details = ensureSelectedBuildingDetails(building);
          details.visible = true;
          details.children.forEach((child) => {
            const material = (child as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
            const materials = Array.isArray(material) ? material : material ? [material] : [];
            materials.forEach((item) => {
              const baseOpacity = typeof item.userData.baseOpacity === 'number' ? item.userData.baseOpacity : item.opacity;
              item.opacity = baseOpacity * (0.92 + pulse * 0.18);
            });
          });
        } else if (building.selectedDetails) {
          building.selectedDetails.visible = false;
        }
      }

      for (const road of roads) {
        road.label.quaternion.copy(camera.quaternion);
        const selectedRoad = selected ? road.source.id === selected.id || road.target.id === selected.id : false;
        const roadPulse = 0.5 + Math.sin(elapsed * 2.2 + road.phase * 6) * 0.5;
        const filteredRoadOpacity = typeof road.mesh.material.userData.filteredOpacity === 'number' ? road.mesh.material.userData.filteredOpacity : road.baseOpacity;
        road.mesh.material.opacity = selectedRoad
          ? Math.min(0.54, filteredRoadOpacity + 0.18 + roadPulse * 0.06)
          : filteredRoadOpacity;
        if (road.label.visible) {
          const labelPoint = road.curve.getPointAt(0.5);
          road.label.position.set(labelPoint.x, 2.2 + road.flowStrength * 0.6, labelPoint.z);
          road.label.material.opacity = selectedRoad ? 0.5 : 0;
        }
        road.cars.forEach((car, carIndex) => {
          const t = (road.phase + elapsed * road.speed + carIndex / road.cars.length) % 1;
          const point = road.curve.getPointAt(t);
          car.position.copy(point);
          car.position.y += 0.18 + road.flowStrength * 0.08 + Math.sin(elapsed * 8 + carIndex) * 0.035;
          const tangent = road.curve.getTangentAt(t);
          car.rotation.y = Math.atan2(tangent.x, tangent.z);
          const material = car.material as THREE.MeshBasicMaterial;
          const filteredPacketOpacity = typeof material.userData.filteredOpacity === 'number' ? material.userData.filteredOpacity : material.opacity;
          material.opacity = selectedRoad ? Math.min(1, filteredPacketOpacity + 0.08) : filteredPacketOpacity;
          car.scale.setScalar(0.82 + Math.sin(elapsed * 6 + carIndex) * 0.14);
        });
      }

      if (hoverRef.current && tooltipRef.current) {
        const building = findBuilding(hoverRef.current.id);
        if (building) {
          const point = getRepoScreenPosition(building, camera, renderer);
          tooltipRef.current.style.opacity = '1';
          tooltipRef.current.style.transform = `translate3d(${point.x}px, ${point.y}px, 0) translate(-50%, -118%)`;
        }
      } else if (tooltipRef.current) {
        tooltipRef.current.style.opacity = '0';
      }

      renderer.render(scene, camera);
      refs.frame = requestAnimationFrame(animate);
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointercancel', handlePointerUp);
    renderer.domElement.addEventListener('pointermove', handlePointerMoveDrag);
    renderer.domElement.addEventListener('pointerleave', handlePointerLeave);
    renderer.domElement.addEventListener('click', handleClick);
    renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('resize', handleResize);
    refs.frame = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointercancel', handlePointerUp);
      renderer.domElement.removeEventListener('pointermove', handlePointerMoveDrag);
      renderer.domElement.removeEventListener('pointerleave', handlePointerLeave);
      renderer.domElement.removeEventListener('click', handleClick);
      renderer.domElement.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(refs.frame);
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material?.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
    };
  }, [reposByDistrict, heightScaleDriver, rendererRetryToken]);

  useEffect(() => {
    if (!entered) return undefined;
    const started = performance.now();
    let frame = 0;
    const safeRepos = effectiveRepos.filter((repo) => isGreenSafety(repo.safetyScore)).length;

    const tick = () => {
      const progress = easeOutCubic((performance.now() - started) / 1600);
      setStats({
        repos: Math.round(effectiveRepos.length * progress),
        prs: Math.round(effectiveRepos.reduce((total, repo) => total + getOpenWorkItems(repo), 0) * progress),
        safe: Math.round(safeRepos * progress),
      });
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [entered, effectiveRepos]);

  const handleEnter = () => {
    setEntered(true);
  };

  const retry3dRenderer = () => {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete('renderer');
    window.history.replaceState(null, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    setWebglError('');
    setRendererRetryToken((current) => current + 1);
  };

  const setZoom = (nextZoom: number) => {
    const clamped = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    setZoomValue(Number(clamped.toFixed(2)));
    if (sceneRef.current) sceneRef.current.targetZoom = clamped;
  };

  const handleZoomIn = () => setZoom((sceneRef.current?.targetZoom ?? zoomValue) - 0.14);
  const handleZoomOut = () => setZoom((sceneRef.current?.targetZoom ?? zoomValue) + 0.14);
  const handleZoomReset = () => {
    setZoom(1);
    setSelectedRepo(null);
  };

  const openTutorial = () => {
    setEntered(true);
    setTutorialStep(0);
    setTutorialOpen(true);
  };

  const handleSearchMove = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    event.currentTarget.style.setProperty('--mx', `${x}%`);
    event.currentTarget.style.setProperty('--my', `${y}%`);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const lower = query.toLowerCase();
    if (searchResults[0]) {
      selectSearchResult(searchResults[0]);
      return;
    }
    const tokens = tokenizeSearch(query);
    const district = DISTRICTS.find(
      (item) => lower.includes(item.label.toLowerCase()) || lower.includes(item.key) || lower.includes(item.label.split('/')[0].toLowerCase()),
    );
    const uniqueParents = DISTRICTS.map((item) => item.parent).filter((parent, index, allParents) => allParents.indexOf(parent) === index);
    const parentDistrict = uniqueParents.find((parent) => tokens.includes(parent));
    const nextFilter = district?.key ?? parentDistrict;
    if (nextFilter) {
      setFilter(nextFilter);
      similarDistrictRef.current = nextFilter;
      similarUntilRef.current = performance.now() + 5200;
      targetDistrictCenterRef.current = districtCenterForFilter(nextFilter);
    }
  };

  const focusRepo = (repo: Repo) => {
    setEntered(true);
    setSelectedRepo(repo);
    setFilter(repo.district);
    similarDistrictRef.current = repo.district;
    similarUntilRef.current = performance.now() + 3600;
  };

  const selectSearchResult = (result: SearchResult) => {
    focusRepo(result.repo);
  };

  const handleRepoImport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const locator = parseGithubRepoLocator(repoImport);
    if (!locator) {
      setImportStatus('Use owner/repo or a GitHub repository URL.');
      return;
    }

    setImportingRepo(true);
    setImportStatus(`Loading ${locator.owner}/${locator.repo}...`);
    try {
      const response = await fetch(`https://api.github.com/repos/${locator.owner}/${locator.repo}`);
      if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
      const payload = await response.json() as GitHubRepoPayload;
      const openPulls = await fetchGithubOpenPullRequests(locator.owner, locator.repo);
      const imported = buildRepoFromGithub(payload, wantsContributions, openPulls);
      setLoadedRepos((current) => [imported, ...current.filter((repo) => repo.id !== imported.id)].slice(0, 20));
      setRepoImport('');
      setImportStatus(`${imported.owner}/${imported.name} loaded into ${districtFor(imported).label}.`);
      focusRepo(imported);
    } catch (error) {
      console.error('[SIFT imports] GitHub import failed:', error);
      setImportStatus('Could not load that public GitHub repo.');
    } finally {
      setImportingRepo(false);
    }
  };

  const handleFilter = (next: FilterKey) => {
    const activeFilter = filter === next ? 'all' : next;
    setFilter(activeFilter);
    if (activeFilter !== 'all' && activeFilter !== 'stars' && activeFilter !== 'safe') {
      similarDistrictRef.current = activeFilter;
      similarUntilRef.current = performance.now() + 2800;
      targetDistrictCenterRef.current = districtCenterForFilter(activeFilter);
    } else {
      targetDistrictCenterRef.current = null;
    }
  };

  const handleFindSimilar = () => {
    if (!selectedRepo) return;
    setFilter(selectedRepo.district);
    similarDistrictRef.current = selectedRepo.district;
    similarUntilRef.current = performance.now() + 6000;
  };

  return (
    <main className={`sift-page ${appearance === 'day' ? 'is-day' : 'is-night'} ${selectedRepo ? 'is-repo-focus' : ''}`} aria-label="SIFT 3D open-source city">
      <div ref={mountRef} className="three-stage" aria-label="Interactive 3D city of open-source repositories">
        {webglError ? (
          <div className={`fallback-city ${entered ? 'is-entered' : ''}`} role="img" aria-label="Lightweight city of open-source repositories">
            <div className="fallback-map" aria-hidden={!entered}>
              {fallbackCity.items.map(({ repo, district, layout }) => {
                const left = ((layout.position.x + fallbackCity.extent) / (fallbackCity.extent * 2)) * 100;
                const top = ((layout.position.z + fallbackCity.extent) / (fallbackCity.extent * 2)) * 100;
                const height = clamp(layout.height * 1.35, 8, 92);
                const width = clamp(layout.width * 1.7, 4, 16);
                return (
                  <button
                    key={repo.id}
                    className="fallback-building"
                    type="button"
                    title={`${repo.owner}/${repo.name}: ${formatMetric(repo.stars)} stars`}
                    aria-label={`${repo.owner}/${repo.name}, ${formatMetric(repo.stars)} stars`}
                    onClick={() => focusRepo(repo)}
                    style={{
                      '--repo-color': district.color,
                      '--repo-accent': district.accent,
                      '--fallback-height': `${height}px`,
                      '--fallback-width': `${width}px`,
                      left: `${left}%`,
                      top: `${top}%`,
                    } as CSSProperties}
                  />
                );
              })}
            </div>
            <div className="fallback-notice" role="status">
              <strong>Map mode</strong>
              <span>Showing the lightweight city view for this browser session.</span>
              <button type="button" onClick={retry3dRenderer}>Try full 3D</button>
            </div>
          </div>
        ) : null}
      </div>

      <section className={`intro-layer ${entered ? 'is-exiting' : ''}`} aria-hidden={entered}>
        <div className="intro-copy">
          <h1 aria-label="sift">
            {'sift'.split('').map((letter, index) => (
              <span key={letter} style={{ animationDelay: `${0.65 + index * 0.18}s` }}>
                {letter}
              </span>
            ))}
          </h1>
          <p>open source, mapped as a living city</p>
          <button className="enter-city" type="button" onClick={handleEnter}>
            enter the city →
          </button>
        </div>
      </section>

      <div ref={tooltipRef} className="repo-tooltip" style={{ '--repo-color': hoveredRepo ? districtFor(hoveredRepo).color : '#4f8cff' } as CSSProperties}>
        {hoveredRepo ? (
          <>
            <span>{hoveredRepo.name}</span>
            <strong>{hoveredRepo.safetyScore}% safe to contribute</strong>
            <small>{contributionStyleFor(hoveredRepo)} · {formatMetric(hoveredRepo.stars)} stars · {getOpenWorkItems(hoveredRepo)} open items</small>
          </>
        ) : null}
      </div>

      <section className={`city-ui ${entered ? 'is-visible' : ''}`} aria-hidden={!entered}>
        <div className="control-dock" aria-label="City view controls">
          <div className="tool-group" aria-label="Zoom controls">
            <button type="button" onClick={handleZoomIn} title="Zoom in" aria-label="Zoom in">
              <ZoomIn size={16} strokeWidth={1.8} />
            </button>
            <span aria-label={`Zoom ${Math.round((2 - zoomValue) * 100)} percent`}>{Math.round((2 - zoomValue) * 100)}%</span>
            <button type="button" onClick={handleZoomOut} title="Zoom out" aria-label="Zoom out">
              <ZoomOut size={16} strokeWidth={1.8} />
            </button>
            <button type="button" onClick={handleZoomReset} title="Reset camera" aria-label="Reset camera">
              <RotateCcw size={15} strokeWidth={1.8} />
            </button>
          </div>

          <div className="mode-toggle" aria-label="Appearance setting">
            <button
              className={appearance === 'night' ? 'is-active' : ''}
              type="button"
              onClick={() => setAppearance('night')}
              aria-pressed={appearance === 'night'}
              aria-label="Night appearance"
              title="Night appearance"
            >
              <Moon size={14} strokeWidth={1.8} />
              Night
            </button>
            <button
              className={appearance === 'day' ? 'is-active' : ''}
              type="button"
              onClick={() => setAppearance('day')}
              aria-pressed={appearance === 'day'}
              aria-label="Day appearance"
              title="Day appearance"
            >
              <Sun size={14} strokeWidth={1.8} />
              Day
            </button>
          </div>

          <button className="guide-button" type="button" onClick={openTutorial}>
            <HelpCircle size={15} strokeWidth={1.8} />
            Walkthrough
          </button>
        </div>

        <form className={`search-cluster ${selectedRepo ? 'has-panel' : ''}`} onSubmit={handleSubmit}>
          <div className="glass-search" onMouseMove={handleSearchMove}>
            <span className="glass-pulse" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="try: safe ai, observability, rust runtime..."
              aria-label="Search the SIFT city"
            />
            <button type="submit">EXPLORE</button>
          </div>
          {query.trim() ? (
            <div className="search-results" aria-label="Ranked search results">
              <div className="search-results-head">
                <span>{searchResults.length ? 'ranked by matched pings' : 'no strong pings yet'}</span>
                <strong>{searchResults.length ? `${searchResults.length} results` : 'try a type, function, language, or safety term'}</strong>
              </div>
              {searchResults.map((result) => (
                <button
                  className="search-result"
                  type="button"
                  key={result.repo.id}
                  style={{ '--repo-color': districtFor(result.repo).color } as CSSProperties}
                  onClick={() => selectSearchResult(result)}
                >
                  <div className="search-result-main">
                    <span>{result.repo.name}</span>
                    <strong>{districtFor(result.repo).label} · {result.repo.language} · {result.repo.safetyScore}% safe</strong>
                  </div>
                  <div className="search-pings">
                    {result.pings.map((ping) => (
                      <i key={`${result.repo.id}-${ping.label}-${ping.detail}`}>
                        {ping.label}: {ping.detail}
                      </i>
                    ))}
                  </div>
                  <b>{result.score}</b>
                </button>
              ))}
            </div>
          ) : null}
          <div className="filter-row" aria-label="City filters" style={{ position: 'relative', display: 'flex', gap: '8px', width: '100%', alignItems: 'center' }}>
            <button
              className={`filter-chip config-chip ${sectionsOpen ? 'is-active' : ''}`}
              type="button"
              onClick={() => setSectionsOpen(!sectionsOpen)}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <SlidersHorizontal size={13} strokeWidth={1.8} />
              Sections
            </button>
            <button className={`filter-chip star-chip ${filter === 'stars' ? 'is-active' : ''}`} type="button" onClick={() => handleFilter('stars')}>
              <Star size={13} strokeWidth={1.8} />
              10k+
            </button>
            <button className={`filter-chip safe-chip ${filter === 'safe' ? 'is-active' : ''}`} type="button" onClick={() => handleFilter('safe')}>
              <ShieldCheck size={13} strokeWidth={1.8} />
              safe
            </button>

            <div className="height-driver-container" style={{ display: 'flex', gap: '6px', marginLeft: 'auto', alignItems: 'center' }}>
              <span className="scale-label" style={{ fontSize: '10px', opacity: 0.6, marginRight: '4px', textTransform: 'uppercase', fontFamily: '"Space Mono", monospace', letterSpacing: '0.04em' }}>Height By:</span>
              <button
                className={`filter-chip scale-stars-chip ${heightScaleDriver === 'stars' ? 'is-active' : ''}`}
                type="button"
                onClick={() => setHeightScaleDriver('stars')}
              >
                <Star size={13} strokeWidth={1.8} />
                Stars
              </button>
              <button
                className={`filter-chip scale-activity-chip ${heightScaleDriver === 'activity' ? 'is-active' : ''}`}
                type="button"
                onClick={() => setHeightScaleDriver('activity')}
              >
                <Activity size={13} strokeWidth={1.8} />
                Activity
              </button>
              <button
                className={`filter-chip scale-contributors-chip ${heightScaleDriver === 'contributors' ? 'is-active' : ''}`}
                type="button"
                onClick={() => setHeightScaleDriver('contributors')}
              >
                <Users size={13} strokeWidth={1.8} />
                Contributors
              </button>
            </div>

            {sectionsOpen && (
              <div className="city-sections-dropdown">
                <div className="dropdown-header">
                  <span>Select Sector to Zoom & Highlight</span>
                  <button type="button" className="close-btn" onClick={() => setSectionsOpen(false)}>×</button>
                </div>
                <div className="dropdown-grid">
                  {DISTRICTS.map((district) => (
                    <button
                      key={district.key}
                      className={`dropdown-item ${filter === district.key ? 'is-active' : ''}`}
                      style={{ '--item-color': district.color } as CSSProperties}
                      type="button"
                      onClick={() => {
                        handleFilter(district.key);
                        setSectionsOpen(false);
                      }}
                    >
                      <span className="color-dot" style={{ background: district.color }} />
                      {district.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </form>

        <div className="stat-bar" aria-label="Live city stats">
          <div>
            <strong>{stats.repos}</strong>
            <span>repos modeled</span>
          </div>
          <div>
            <strong>{stats.prs.toLocaleString()}</strong>
            <span>open items</span>
          </div>
          <div>
            <strong>{stats.safe}</strong>
            <span>safe routes</span>
          </div>
        </div>

        <div className="cinema-readout">
          <span>3D contribution atlas</span>
          <strong>height: {heightScaleDriver} · roads: PR flow · terrain: hills + greenery</strong>
        </div>
      </section>

      <section className={`network-dock ${entered ? 'is-visible' : ''} ${selectedRepo ? 'has-panel' : ''}`} aria-label="Contribution network">
        <div className="network-head">
          <span>
            <Github size={14} strokeWidth={1.8} />
            Contribution Network
          </span>
          <a href="/api/github/auth">
            <Github size={13} strokeWidth={1.8} />
            Connect
          </a>
        </div>

        <form className="repo-load-form" onSubmit={handleRepoImport}>
          <input
            value={repoImport}
            onChange={(event) => setRepoImport(event.target.value)}
            placeholder="owner/repo"
            aria-label="Load GitHub repository"
          />
          <button type="submit" disabled={importingRepo}>
            <GitPullRequest size={13} strokeWidth={1.8} />
            {importingRepo ? 'Loading' : 'Load'}
          </button>
        </form>

        <label className="network-toggle">
          <input
            type="checkbox"
            checked={wantsContributions}
            onChange={(event) => setWantsContributions(event.target.checked)}
          />
          <span>mark as seeking contributors</span>
        </label>

        <div className="network-status">
          <span>{loadingRepos ? 'syncing graph' : `${effectiveRepos.length} mapped`}</span>
          <strong>{importStatus}</strong>
        </div>

        <div className="network-lists">
          <div>
            <span className="network-list-title">
              <Sparkles size={12} strokeWidth={1.8} />
              loaded today
            </span>
            {(loadedTodayRepos.length ? loadedTodayRepos : loadedRepos.slice(0, 3)).map((repo) => (
              <button key={`loaded-${repo.id}`} type="button" onClick={() => focusRepo(repo)}>
                <strong>{repo.owner}/{repo.name}</strong>
                <span>{districtFor(repo).label}</span>
              </button>
            ))}
            {loadedRepos.length === 0 ? <p>No imports yet</p> : null}
          </div>

          <div>
            <span className="network-list-title">
              <TrendingUp size={12} strokeWidth={1.8} />
              trending
            </span>
            {highStarTrending.map((repo) => (
              <button key={`trend-${repo.id}`} type="button" onClick={() => focusRepo(repo)}>
                <strong>{repo.name}</strong>
                <span>{formatMetric(repo.stars)} stars</span>
              </button>
            ))}
          </div>

          <div>
            <span className="network-list-title">
              <ShieldCheck size={12} strokeWidth={1.8} />
              low-star ready
            </span>
            {lowStarPromising.map((repo) => (
              <button key={`promising-${repo.id}`} type="button" onClick={() => focusRepo(repo)}>
                <strong>{repo.name}</strong>
                <span>{repo.goodFirstIssues || getOpenWorkItems(repo)} starter signals</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={`tutorial-overlay ${tutorialOpen ? 'is-open' : ''}`} aria-hidden={!tutorialOpen} aria-label="SIFT walkthrough">
        <div className="tutorial-card">
          <button className="tutorial-close" type="button" onClick={() => setTutorialOpen(false)} aria-label="Close walkthrough">
            <X size={17} strokeWidth={1.8} />
          </button>
          <div className="tutorial-progress">
            {TUTORIAL_STEPS.map((step, index) => (
              <button
                key={step.title}
                className={index === tutorialStep ? 'is-active' : ''}
                type="button"
                onClick={() => setTutorialStep(index)}
                aria-label={`Go to walkthrough step ${index + 1}`}
              />
            ))}
          </div>
          <span className="tutorial-kicker">walkthrough {tutorialStep + 1} / {TUTORIAL_STEPS.length}</span>
          <h2>{TUTORIAL_STEPS[tutorialStep].title}</h2>
          <p>{TUTORIAL_STEPS[tutorialStep].body}</p>
          <div className="tutorial-action">
            <strong>Try this</strong>
            <span>{TUTORIAL_STEPS[tutorialStep].action}</span>
          </div>
          <div className="tutorial-nav">
            <button type="button" onClick={() => setTutorialStep(Math.max(0, tutorialStep - 1))} disabled={tutorialStep === 0}>
              Back
            </button>
            {tutorialStep < TUTORIAL_STEPS.length - 1 ? (
              <button type="button" onClick={() => setTutorialStep(Math.min(TUTORIAL_STEPS.length - 1, tutorialStep + 1))}>
                Next
              </button>
            ) : (
              <button type="button" onClick={() => setTutorialOpen(false)}>
                Start exploring
              </button>
            )}
          </div>
        </div>
      </section>

      <aside
        className={`repo-panel ${selectedRepo ? 'is-open' : ''}`}
        aria-hidden={!selectedRepo}
        style={{ '--repo-color': selectedRepo ? districtFor(selectedRepo).color : '#4f8cff', '--safe-color': selectedRepo ? colorForSafety(selectedRepo.safetyScore) : '#34d399' } as CSSProperties}
      >
        {selectedRepo ? (
          <>
            <button className="panel-close" type="button" onClick={() => setSelectedRepo(null)} aria-label="Close repository panel">
              ×
            </button>
            <div className="panel-kicker">{districtFor(selectedRepo).label} district</div>
            <h2>{selectedRepo.name}</h2>
            <p>{selectedRepo.description}</p>

            <div className="safe-score">
              <div>
                <span>{selectedRepo.safetyProfile?.status ?? safetyStatus(selectedRepo.safetyScore)} contribution readiness</span>
                <strong>{selectedRepo.safetyScore}%</strong>
              </div>
              <i>
                <b style={{ width: `${selectedRepo.safetyScore}%` }} />
              </i>
            </div>

            <div className="safety-reasons">
              <span className="section-label">why this score</span>
              {safetyReasons.map((reason) => (
                <div className={`safety-reason ${reason.type}`} key={`${reason.type}-${reason.label}`}>
                  <strong>{reason.label} <b>{reason.awardedPoints}/{reason.weight}</b></strong>
                  <span>{reason.detail}</span>
                </div>
              ))}
            </div>

            <div className="repo-badges">
              <span>{selectedRepo.language}</span>
              <span>{formatMetric(selectedRepo.stars)} stars</span>
              <span>{formatMetric(selectedRepo.forks)} forks</span>
              <span>{getOpenWorkItems(selectedRepo)} open items</span>
              <span>{selectedRepo.goodFirstIssues} good first</span>
              <span>{contributionStyleFor(selectedRepo)}</span>
              {selectedRepo.wantsContributions ? <span>seeking contributors</span> : null}
            </div>

            <div className="trust-grid">
              <div className={selectedRepo.verifiedMaintainers ? 'is-good' : ''}>
                <strong>{selectedRepo.verifiedMaintainers ? 'verified' : 'unknown'}</strong>
                <span>maintainers</span>
              </div>
              <div className={selectedRepo.branchProtection ? 'is-good' : ''}>
                <strong>{selectedRepo.branchProtection ? 'protected' : 'loose'}</strong>
                <span>branches</span>
              </div>
              <div className={selectedRepo.signedReleases ? 'is-good' : ''}>
                <strong>{selectedRepo.signedReleases ? 'signed' : 'unsigned'}</strong>
                <span>releases</span>
              </div>
              <div className={selectedRepo.responseHours <= 18 ? 'is-good' : ''}>
                <strong>{selectedRepo.responseHours}h</strong>
                <span>response</span>
              </div>
            </div>

            <div className="pr-list">
              <span className="section-label">open pull requests</span>
              {selectedRepo.prs.map((pr) => (
                <div className="pr-item" key={pr.number}>
                  <i className={`priority-dot ${pr.priority}`} />
                  <div>
                    <strong>PR #{pr.number}</strong>
                    <span>{pr.title}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="panel-actions">
              <a href={`https://github.com/${selectedRepo.owner}/${selectedRepo.name}`} target="_blank" rel="noreferrer">
                view on github ↗
              </a>
              <button type="button" onClick={handleFindSimilar}>
                find similar repos
              </button>
            </div>
          </>
        ) : null}
      </aside>

      <style suppressHydrationWarning>{`
        :root {
          --sift-bg-deep: #040606;
          --sift-bg-mid: #0c1514;
          --sift-bg-surface: #17211d;
          --sift-glass-surface: rgba(255,255,255,0.04);
          --sift-glass-border: rgba(255,255,255,0.12);
          --sift-primary-blue: #4fb7c5;
          --sift-warm: #f2a65a;
          --sift-leaf: #6dd6a7;
          --sift-text-primary: rgba(255,255,255,0.92);
          --sift-text-secondary: rgba(255,255,255,0.45);
          --sift-text-tertiary: rgba(255,255,255,0.22);
        }

        html,
        body {
          min-height: 100%;
          overflow: hidden;
          background: var(--sift-bg-deep);
        }

        .sift-page {
          position: relative;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          color: var(--sift-text-primary);
          background:
            radial-gradient(circle at 78% 18%, rgba(79,183,197,0.18), transparent 30%),
            radial-gradient(circle at 22% 72%, rgba(242,166,90,0.12), transparent 28%),
            radial-gradient(circle at 52% 45%, rgba(109,214,167,0.08), transparent 34%),
            linear-gradient(180deg, #040606 0%, #0c1514 48%, #17211d 100%);
          font-family: Inter, system-ui, sans-serif;
          isolation: isolate;
        }

        .sift-page.is-day {
          --sift-glass-surface: rgba(15,23,42,0.16);
          --sift-glass-border: rgba(15,23,42,0.18);
          --sift-text-primary: rgba(15,23,42,0.92);
          --sift-text-secondary: rgba(30,41,59,0.66);
          --sift-text-tertiary: rgba(30,41,59,0.42);
          background:
            radial-gradient(circle at 76% 16%, rgba(255,238,198,0.32), transparent 28%),
            radial-gradient(circle at 22% 72%, rgba(79,183,197,0.2), transparent 30%),
            linear-gradient(180deg, #b7d4d1 0%, #789d91 48%, #26372f 100%);
        }

        .sift-page::before {
          content: "";
          position: fixed;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background:
            linear-gradient(90deg, rgba(2,4,8,0.34), transparent 22%, transparent 76%, rgba(2,4,8,0.38)),
            radial-gradient(circle at 50% 72%, transparent 22%, rgba(2,4,8,0.16) 78%);
        }

        .sift-page.is-day::before {
          background:
            linear-gradient(90deg, rgba(8,20,42,0.08), transparent 24%, transparent 78%, rgba(8,20,42,0.1)),
            radial-gradient(circle at 50% 72%, transparent 28%, rgba(8,20,42,0.08) 84%);
        }

        .three-stage {
          position: fixed;
          inset: 0;
          z-index: 0;
          width: 100%;
          height: 100%;
        }

        .three-stage canvas {
          display: block;
          width: 100%;
          height: 100%;
          cursor: grab;
          touch-action: none;
        }

        .fallback-city {
          position: absolute;
          inset: 0;
          overflow: hidden;
          background:
            linear-gradient(180deg, rgba(188,215,255,0.9), rgba(129,159,151,0.72)),
            #9fb8b0;
          pointer-events: none;
        }

        .fallback-city::before {
          content: "";
          position: absolute;
          inset: 0;
          opacity: 0.36;
          background-image:
            linear-gradient(rgba(15,23,42,0.22) 1px, transparent 1px),
            linear-gradient(90deg, rgba(15,23,42,0.22) 1px, transparent 1px);
          background-size: 24px 24px;
          transform: perspective(720px) rotateX(58deg) translateY(84px) scale(1.34);
          transform-origin: 50% 62%;
        }

        .fallback-city::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.42), transparent 34%),
            radial-gradient(circle at 50% 48%, transparent 24%, rgba(15,23,42,0.16) 86%);
        }

        .fallback-map {
          position: absolute;
          inset: 4% 6% 8%;
          transform: perspective(860px) rotateX(57deg) rotateZ(-2deg);
          transform-origin: 50% 56%;
        }

        .fallback-building {
          position: absolute;
          width: var(--fallback-width);
          height: var(--fallback-height);
          border: 1px solid color-mix(in srgb, var(--repo-accent), white 22%);
          border-radius: 3px 3px 1px 1px;
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--repo-accent), white 18%), var(--repo-color)),
            var(--repo-color);
          box-shadow:
            8px 10px 0 color-mix(in srgb, var(--repo-color), black 36%),
            0 12px 24px rgba(15,23,42,0.18);
          opacity: 0.88;
          transform: translate(-50%, -100%) skewY(-4deg);
          transform-origin: 50% 100%;
          pointer-events: none;
        }

        .fallback-building::before {
          content: "";
          position: absolute;
          left: -1px;
          right: -1px;
          top: -7px;
          height: 7px;
          border: 1px solid color-mix(in srgb, var(--repo-accent), white 28%);
          border-bottom: 0;
          border-radius: 3px 3px 0 0;
          background: color-mix(in srgb, var(--repo-accent), white 24%);
          transform: skewX(-36deg);
          transform-origin: 0 100%;
        }

        .fallback-city.is-entered .fallback-building {
          pointer-events: auto;
          cursor: pointer;
        }

        .fallback-city.is-entered .fallback-building:hover {
          z-index: 2;
          opacity: 1;
          filter: saturate(1.22) brightness(1.08);
        }

        .fallback-notice {
          position: absolute;
          left: 50%;
          bottom: 18px;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: min(520px, calc(100vw - 32px));
          transform: translateX(-50%);
          border: 1px solid rgba(15,23,42,0.12);
          border-radius: 8px;
          padding: 8px 10px;
          background: rgba(255,255,255,0.48);
          box-shadow: 0 16px 44px rgba(15,23,42,0.16);
          color: rgba(15,23,42,0.76);
          backdrop-filter: blur(18px);
          pointer-events: auto;
        }

        .fallback-notice strong,
        .fallback-notice span,
        .fallback-notice button {
          font-family: "Space Mono", monospace;
          letter-spacing: 0;
        }

        .fallback-notice strong {
          font-size: 10px;
          text-transform: uppercase;
        }

        .fallback-notice span {
          font-size: 10px;
          line-height: 1.4;
          min-width: 0;
          color: rgba(15,23,42,0.66);
        }

        .fallback-notice button {
          flex: 0 0 auto;
          min-height: 28px;
          border: 1px solid rgba(15,23,42,0.12);
          border-radius: 7px;
          padding: 0 10px;
          color: rgba(15,23,42,0.78);
          background: rgba(255,255,255,0.44);
          font-size: 10px;
          cursor: pointer;
        }

        .fallback-notice button:hover {
          color: rgba(15,23,42,0.96);
          background: rgba(255,255,255,0.68);
        }

        .fallback-city.is-entered .fallback-notice {
          bottom: 18px;
          top: auto;
          width: min(430px, calc(100vw - 32px));
          opacity: 0.76;
        }

        .webgl-fallback {
          position: absolute;
          left: 50%;
          top: 50%;
          z-index: 1;
          width: min(420px, calc(100vw - 32px));
          transform: translate(-50%, -50%);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 8px;
          padding: 16px;
          background: rgba(5, 12, 14, 0.78);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
          color: rgba(255, 255, 255, 0.92);
          text-align: center;
          backdrop-filter: blur(18px);
        }

        .webgl-fallback strong,
        .webgl-fallback span {
          display: block;
        }

        .webgl-fallback strong {
          font-size: 0.9rem;
          line-height: 1.35;
        }

        .webgl-fallback span {
          margin-top: 6px;
          color: var(--sift-text-muted);
          font-size: 0.78rem;
          line-height: 1.45;
        }

        .intro-layer {
          position: fixed;
          inset: 0;
          z-index: 4;
          display: grid;
          place-items: center;
          pointer-events: none;
          transition: opacity 900ms ease, transform 900ms ease, visibility 900ms ease;
        }

        .intro-layer.is-exiting {
          opacity: 0;
          transform: translateY(-18px) scale(1.015);
          visibility: hidden;
        }

        .intro-copy {
          position: absolute;
          top: 20%;
          left: 50%;
          transform: translateX(-50%);
          display: grid;
          justify-items: center;
          gap: 18px;
          text-align: center;
        }

        .intro-copy h1 {
          margin: 0;
          font-family: Syne, Inter, sans-serif;
          font-size: 184px;
          font-weight: 800;
          line-height: 0.78;
          letter-spacing: 0;
          color: rgba(255,255,255,0.97);
          text-shadow: 0 0 70px rgba(79,140,255,0.36), 0 22px 100px rgba(0,0,0,0.9);
        }

        .intro-copy h1 span {
          display: inline-block;
          opacity: 0;
          transform: translateY(18px) scale(0.96);
          animation: letterRise 1100ms cubic-bezier(.16,1,.3,1) forwards;
        }

        .intro-copy p {
          margin: 0;
          opacity: 0;
          color: rgba(255,255,255,0.48);
          font-family: "Space Mono", monospace;
          font-size: 11px;
          letter-spacing: 0;
          text-transform: uppercase;
          animation: enterIn 900ms cubic-bezier(.16,1,.3,1) 2.4s forwards;
        }

        .enter-city {
          border: 0;
          background: transparent;
          color: rgba(255,255,255,0.74);
          font-family: "Space Mono", monospace;
          font-size: 13px;
          letter-spacing: 0;
          cursor: pointer;
          opacity: 0;
          pointer-events: auto;
          text-transform: lowercase;
          text-shadow: 0 0 24px rgba(79,140,255,0.55);
          animation: enterIn 900ms cubic-bezier(.16,1,.3,1) 3s forwards;
        }

        .enter-city:hover {
          color: #fff;
          text-shadow: 0 0 32px rgba(79,140,255,0.9);
        }

        .sift-page.is-day .intro-copy h1 {
          color: rgba(15,23,42,0.86);
          text-shadow: 0 2px 0 rgba(255,255,255,0.38), 0 22px 80px rgba(255,255,255,0.58);
        }

        .sift-page.is-day .intro-copy p,
        .sift-page.is-day .enter-city {
          color: rgba(15,23,42,0.68);
          text-shadow: 0 10px 28px rgba(255,255,255,0.52);
        }

        .sift-page.is-day .enter-city:hover {
          color: rgba(15,23,42,0.96);
        }

        .city-ui {
          position: fixed;
          inset: 0;
          z-index: 3;
          pointer-events: none;
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 800ms cubic-bezier(.16,1,.3,1), transform 800ms cubic-bezier(.16,1,.3,1);
        }

        .city-ui.is-visible {
          opacity: 1;
          transform: translateY(0);
        }

        .control-dock {
          position: absolute;
          top: 24px;
          left: 28px;
          display: grid;
          gap: 10px;
          width: 244px;
          pointer-events: auto;
          transition: opacity 220ms ease, transform 220ms ease, visibility 220ms ease;
        }

        .tool-group,
        .mode-toggle,
        .guide-button {
          border: 1px solid rgba(255,255,255,0.11);
          background:
            linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.025)),
            rgba(4,9,20,0.52);
          box-shadow: 0 12px 34px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.1);
          backdrop-filter: blur(28px) saturate(180%);
          -webkit-backdrop-filter: blur(28px) saturate(180%);
        }

        .tool-group {
          display: grid;
          grid-template-columns: 36px 1fr 36px 36px;
          align-items: center;
          gap: 6px;
          padding: 7px;
          border-radius: 10px;
        }

        .tool-group button,
        .mode-toggle button,
        .guide-button {
          display: inline-grid;
          place-items: center;
          min-width: 34px;
          height: 34px;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          color: rgba(255,255,255,0.72);
          background: rgba(255,255,255,0.035);
          cursor: pointer;
          transition: transform 160ms ease, color 160ms ease, border-color 160ms ease, background 160ms ease;
        }

        .tool-group button:hover,
        .mode-toggle button:hover,
        .guide-button:hover {
          transform: translateY(-1px);
          color: rgba(255,255,255,0.96);
          border-color: rgba(79,140,255,0.44);
          background: rgba(79,140,255,0.13);
        }

        .tool-group span {
          display: grid;
          place-items: center;
          height: 34px;
          color: rgba(255,255,255,0.72);
          font-family: "Space Mono", monospace;
          font-size: 11px;
          letter-spacing: 0;
        }

        .mode-toggle {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px;
          padding: 7px;
          border-radius: 10px;
        }

        .mode-toggle button,
        .guide-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          font-family: "Space Mono", monospace;
          font-size: 10px;
          letter-spacing: 0;
        }

        .mode-toggle button.is-active {
          color: rgba(255,255,255,0.96);
          border-color: rgba(79,140,255,0.58);
          background: rgba(79,140,255,0.22);
          box-shadow: 0 0 22px rgba(79,140,255,0.18), inset 0 1px 0 rgba(255,255,255,0.16);
        }

        .guide-button {
          width: 100%;
          border-radius: 10px;
        }

        .sift-page.is-day .tool-group,
        .sift-page.is-day .mode-toggle,
        .sift-page.is-day .guide-button,
        .sift-page.is-day .glass-search,
        .sift-page.is-day .search-results,
        .sift-page.is-day .filter-chip,
        .sift-page.is-day .repo-tooltip,
        .sift-page.is-day .repo-panel,
        .sift-page.is-day .network-dock,
        .sift-page.is-day .tutorial-card {
          background:
            linear-gradient(135deg, rgba(15,23,42,0.7), rgba(15,23,42,0.42)),
            rgba(255,255,255,0.14);
          border-color: rgba(255,255,255,0.34);
        }

        .search-cluster {
          position: absolute;
          left: 50%;
          bottom: 42px;
          width: min(760px, calc(100vw - 32px));
          transform: translateX(-50%);
          display: grid;
          gap: 13px;
          pointer-events: auto;
          transition: left 260ms ease, width 260ms ease, opacity 220ms ease, transform 220ms ease, visibility 220ms ease;
        }

        .search-cluster.has-panel {
          left: calc(50% - 178px);
          width: min(660px, calc(100vw - 430px));
        }

        .glass-search {
          --mx: 28%;
          --my: 12%;
          position: relative;
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 12px;
          min-height: 70px;
          padding: 12px 12px 12px 22px;
          border: 1px solid transparent;
          border-radius: 12px;
          background:
            radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,0.09), rgba(255,255,255,0.026) 32%, rgba(255,255,255,0.012) 62%),
            linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.026) 36%, rgba(79,140,255,0.035));
          box-shadow: 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15);
          backdrop-filter: blur(40px) saturate(200%);
          -webkit-backdrop-filter: blur(40px) saturate(200%);
          overflow: hidden;
        }

        .glass-search::before {
          content: "";
          position: absolute;
          inset: -2px;
          border-radius: inherit;
          padding: 1px;
          background: conic-gradient(from 0deg, rgba(255,255,255,0), rgba(255,255,255,0.32), rgba(79,183,197,0.72), rgba(255,255,255,0), rgba(242,166,90,0.36), rgba(255,255,255,0));
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          animation: rimSpin 8s linear infinite;
        }

        .glass-search::after {
          content: "";
          position: absolute;
          top: 9px;
          left: 16px;
          width: 46%;
          height: 2px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(255,255,255,0.3), rgba(255,255,255,0.02));
          opacity: 0.88;
          transition: transform 260ms ease, opacity 260ms ease;
          pointer-events: none;
        }

        .glass-search:hover::after {
          transform: translateX(10px);
          opacity: 1;
        }

        .glass-search:focus-within::before {
          animation-duration: 2s;
        }

        .glass-pulse {
          position: absolute;
          inset: -3px;
          border-radius: inherit;
          pointer-events: none;
          opacity: 0;
          border: 1px solid rgba(79,140,255,0.34);
        }

        .glass-search:focus-within .glass-pulse {
          animation: focusPulse 760ms ease-out;
        }

        .glass-search input {
          position: relative;
          z-index: 1;
          width: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          color: rgba(255,255,255,0.9);
          font-family: "Space Mono", monospace;
          font-size: 14px;
          letter-spacing: 0;
        }

        .glass-search input::placeholder {
          color: rgba(255,255,255,0.4);
          font-style: italic;
        }

        .glass-search button {
          position: relative;
          z-index: 1;
          height: 46px;
          padding: 0 22px;
          border: 1px solid rgba(255,255,255,0.16);
          border-radius: 8px;
          color: rgba(255,255,255,0.94);
          background: linear-gradient(135deg, rgba(79,183,197,0.72), rgba(242,166,90,0.28)), rgba(255,255,255,0.04);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.16), 0 10px 28px rgba(79,183,197,0.18);
          font-family: "Space Mono", monospace;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0;
          cursor: pointer;
        }

        .search-results {
          display: grid;
          gap: 8px;
          max-height: 292px;
          padding: 10px;
          border: 1px solid rgba(255,255,255,0.11);
          border-radius: 18px;
          background:
            linear-gradient(145deg, rgba(255,255,255,0.07), rgba(255,255,255,0.024)),
            rgba(4,9,20,0.62);
          box-shadow: 0 18px 54px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.1);
          backdrop-filter: blur(34px) saturate(190%);
          -webkit-backdrop-filter: blur(34px) saturate(190%);
          overflow-y: auto;
        }

        .search-results-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 2px 4px 4px;
          font-family: "Space Mono", monospace;
          letter-spacing: 0;
        }

        .search-results-head span {
          color: rgba(255,255,255,0.46);
          font-size: 9px;
          text-transform: uppercase;
        }

        .search-results-head strong {
          color: rgba(255,255,255,0.68);
          font-size: 10px;
          font-weight: 400;
          text-align: right;
        }

        .search-result {
          position: relative;
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 8px;
          width: 100%;
          padding: 11px 46px 11px 12px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 13px;
          background: rgba(255,255,255,0.035);
          text-align: left;
          cursor: pointer;
          transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
        }

        .search-result:hover {
          transform: translateY(-1px);
          border-color: color-mix(in srgb, var(--repo-color, #4f8cff), transparent 42%);
          background: rgba(79,140,255,0.1);
        }

        .search-result-main {
          display: grid;
          gap: 3px;
          min-width: 0;
        }

        .search-result-main span,
        .search-result-main strong,
        .search-pings i,
        .search-result b {
          font-family: "Space Mono", monospace;
          letter-spacing: 0;
        }

        .search-result-main span {
          color: var(--repo-color, #4f8cff);
          font-size: 12px;
          font-weight: 700;
        }

        .search-result-main strong {
          color: rgba(255,255,255,0.58);
          font-size: 10px;
          font-weight: 400;
        }

        .search-pings {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          min-width: 0;
        }

        .search-pings i {
          max-width: 100%;
          padding: 4px 7px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 999px;
          color: rgba(255,255,255,0.5);
          background: rgba(255,255,255,0.035);
          font-size: 9px;
          font-style: normal;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .search-result b {
          position: absolute;
          top: 12px;
          right: 12px;
          color: rgba(255,255,255,0.42);
          font-size: 10px;
        }

        .filter-row {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 8px;
        }

        .filter-chip {
          --chip-color: var(--sift-primary-blue);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          min-height: 33px;
          padding: 0 14px;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          color: rgba(255,255,255,0.62);
          background: linear-gradient(135deg, rgba(255,255,255,0.052), rgba(255,255,255,0.018)), rgba(255,255,255,0.03);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.09), 0 8px 24px rgba(0,0,0,0.24);
          backdrop-filter: blur(28px) saturate(180%);
          -webkit-backdrop-filter: blur(28px) saturate(180%);
          font-family: "Space Mono", monospace;
          font-size: 11px;
          letter-spacing: 0;
          white-space: nowrap;
          cursor: pointer;
          transition: transform 180ms ease, border-color 180ms ease, color 180ms ease, background 180ms ease;
        }

        .filter-chip:hover {
          transform: translateY(-1px);
          color: rgba(255,255,255,0.86);
          border-color: color-mix(in srgb, var(--chip-color), transparent 42%);
        }

        .filter-chip.is-active {
          color: rgba(255,255,255,0.96);
          border-color: color-mix(in srgb, var(--chip-color), white 18%);
          background: linear-gradient(135deg, color-mix(in srgb, var(--chip-color), transparent 76%), rgba(255,255,255,0.028)), rgba(255,255,255,0.04);
          box-shadow: 0 0 0 1px color-mix(in srgb, var(--chip-color), transparent 58%), 0 0 26px color-mix(in srgb, var(--chip-color), transparent 74%), inset 0 1px 0 rgba(255,255,255,0.12);
        }

        .scale-stars-chip {
          --chip-color: #fbbf24;
        }

        .scale-activity-chip {
          --chip-color: #3b82f6;
        }

        .scale-contributors-chip {
          --chip-color: #a855f7;
        }

        .star-chip {
          --chip-color: #fbbf24;
        }

        .safe-chip {
          --chip-color: #34d399;
        }

        .city-sections-dropdown {
          position: absolute;
          bottom: calc(100% + 12px);
          left: 50%;
          transform: translateX(-50%);
          width: 580px;
          max-width: 95vw;
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.98), rgba(15, 23, 42, 0.98));
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(28px);
          z-index: 1000;
          animation: slideUp 200ms cubic-bezier(0.16, 1, 0.3, 1);
        }

        .sift-page.is-day .city-sections-dropdown {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(241, 245, 249, 0.98));
          border: 1px solid rgba(0, 0, 0, 0.08);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }

        .sift-page.is-day .network-head span,
        .sift-page.is-day .network-status strong,
        .sift-page.is-day .network-toggle,
        .sift-page.is-day .repo-load-form input,
        .sift-page.is-day .network-lists strong {
          color: rgba(255,255,255,0.78);
        }

        @keyframes slideUp {
          from {
            transform: translate(-50%, 10px);
            opacity: 0;
          }
          to {
            transform: translate(-50%, 0);
            opacity: 1;
          }
        }

        .dropdown-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding-bottom: 8px;
        }

        .sift-page.is-day .dropdown-header {
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
        }

        .dropdown-header span {
          font-family: "Space Mono", monospace;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: rgba(255, 255, 255, 0.76);
        }

        .sift-page.is-day .dropdown-header span {
          color: rgba(15, 23, 42, 0.76);
        }

        .dropdown-header .close-btn {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.6);
          font-size: 18px;
          cursor: pointer;
          padding: 0 4px;
        }

        .sift-page.is-day .dropdown-header .close-btn {
          color: rgba(15, 23, 42, 0.6);
        }

        .dropdown-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 6px;
          max-height: 280px;
          overflow-y: auto;
          padding-right: 4px;
        }

        .dropdown-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          color: rgba(255, 255, 255, 0.8);
          font-family: "Space Mono", monospace;
          font-size: 10px;
          text-align: left;
          cursor: pointer;
          transition: all 150ms ease;
        }

        .sift-page.is-day .dropdown-item {
          background: rgba(0, 0, 0, 0.02);
          border: 1px solid rgba(0, 0, 0, 0.04);
          color: rgba(15, 23, 42, 0.8);
        }

        .dropdown-item:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: var(--item-color);
          color: white;
        }

        .sift-page.is-day .dropdown-item:hover {
          background: rgba(0, 0, 0, 0.05);
          color: rgba(15, 23, 42, 1);
        }

        .dropdown-item.is-active {
          background: color-mix(in srgb, var(--item-color), transparent 82%);
          border-color: var(--item-color);
          color: white;
        }

        .sift-page.is-day .dropdown-item.is-active {
          color: rgba(15, 23, 42, 1);
        }

        .dropdown-item .color-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .stat-bar {
          position: absolute;
          top: 28px;
          right: 32px;
          display: flex;
          gap: 30px;
          align-items: flex-start;
          pointer-events: none;
        }

        .stat-bar div {
          display: grid;
          gap: 4px;
          text-align: right;
        }

        .stat-bar strong {
          font-family: "Space Mono", monospace;
          font-size: 24px;
          line-height: 1;
          font-weight: 700;
          color: rgba(255,255,255,0.94);
          text-shadow: 0 0 24px rgba(79,140,255,0.24);
        }

        .sift-page.is-day .stat-bar strong {
          color: rgba(15,23,42,0.9);
          text-shadow: 0 1px 0 rgba(255,255,255,0.42), 0 14px 36px rgba(255,255,255,0.32);
        }

        .stat-bar span,
        .cinema-readout span {
          font-family: "Space Mono", monospace;
          font-size: 9px;
          letter-spacing: 0;
          text-transform: uppercase;
          color: rgba(255,255,255,0.42);
        }

        .sift-page.is-day .stat-bar span,
        .sift-page.is-day .cinema-readout span,
        .sift-page.is-day .cinema-readout strong {
          color: rgba(15,23,42,0.58);
          text-shadow: 0 1px 0 rgba(255,255,255,0.34);
        }

        .cinema-readout {
          position: absolute;
          left: 30px;
          bottom: 32px;
          display: grid;
          gap: 5px;
          pointer-events: none;
        }

        .cinema-readout strong {
          font-family: "Space Mono", monospace;
          font-size: 11px;
          font-weight: 400;
          color: rgba(255,255,255,0.68);
        }

        .network-dock {
          position: fixed;
          top: 104px;
          right: 32px;
          z-index: 5;
          width: min(360px, calc(100vw - 64px));
          display: grid;
          gap: 10px;
          padding: 12px;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px;
          background:
            linear-gradient(145deg, rgba(255,255,255,0.07), rgba(255,255,255,0.024)),
            rgba(5,11,17,0.62);
          box-shadow: 0 18px 54px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.1);
          backdrop-filter: blur(32px) saturate(180%);
          -webkit-backdrop-filter: blur(32px) saturate(180%);
          opacity: 0;
          transform: translateY(16px);
          pointer-events: none;
          transition: opacity 280ms ease, transform 280ms ease, right 280ms ease;
        }

        .network-dock.is-visible {
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
        }

        .network-dock.has-panel {
          right: 420px;
          opacity: 0;
          pointer-events: none;
          transform: translateY(10px) scale(0.98);
        }

        .sift-page.is-repo-focus .network-dock,
        .sift-page.is-repo-focus .search-cluster,
        .sift-page.is-repo-focus .stat-bar,
        .sift-page.is-repo-focus .cinema-readout {
          opacity: 0;
          pointer-events: none;
          visibility: hidden;
        }

        .sift-page.is-repo-focus .search-cluster {
          transform: translateX(-50%) translateY(24px) scale(0.98);
        }

        .sift-page.is-repo-focus .control-dock {
          opacity: 0;
          pointer-events: none;
          visibility: hidden;
          transform: translate3d(-16px, -14px, 0) scale(0.88);
        }

        .network-head,
        .network-status,
        .network-list-title,
        .network-toggle {
          font-family: "Space Mono", monospace;
          letter-spacing: 0;
        }

        .network-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .network-head span,
        .network-head a,
        .network-list-title {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .network-head span {
          color: rgba(255,255,255,0.84);
          font-size: 11px;
          text-transform: uppercase;
        }

        .network-head a {
          min-height: 30px;
          padding: 0 10px;
          border: 1px solid rgba(79,183,197,0.28);
          border-radius: 8px;
          color: rgba(255,255,255,0.82);
          background: rgba(79,183,197,0.1);
          font-size: 10px;
          text-decoration: none;
        }

        .repo-load-form {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
        }

        .repo-load-form input {
          min-width: 0;
          height: 38px;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          color: rgba(255,255,255,0.88);
          background: rgba(255,255,255,0.04);
          padding: 0 11px;
          outline: none;
          font-family: "Space Mono", monospace;
          font-size: 11px;
        }

        .repo-load-form button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          min-width: 82px;
          height: 38px;
          border: 1px solid rgba(242,166,90,0.28);
          border-radius: 8px;
          color: rgba(255,255,255,0.9);
          background: linear-gradient(135deg, rgba(242,166,90,0.32), rgba(79,183,197,0.18));
          font-family: "Space Mono", monospace;
          font-size: 10px;
          cursor: pointer;
        }

        .repo-load-form button:disabled {
          opacity: 0.58;
          cursor: wait;
        }

        .network-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          color: rgba(255,255,255,0.58);
          font-size: 10px;
        }

        .network-toggle input {
          accent-color: var(--sift-leaf);
        }

        .network-status {
          display: grid;
          gap: 3px;
          padding: 9px 10px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          background: rgba(255,255,255,0.035);
        }

        .network-status span {
          color: var(--sift-leaf);
          font-size: 9px;
          text-transform: uppercase;
        }

        .network-status strong {
          color: rgba(255,255,255,0.64);
          font-size: 10px;
          font-weight: 400;
          line-height: 1.45;
        }

        .network-lists {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .network-lists > div {
          display: grid;
          align-content: start;
          gap: 6px;
          min-width: 0;
        }

        .network-list-title {
          min-height: 24px;
          color: rgba(255,255,255,0.5);
          font-size: 9px;
          text-transform: uppercase;
        }

        .network-lists button,
        .network-lists p {
          display: grid;
          gap: 3px;
          width: 100%;
          min-height: 50px;
          margin: 0;
          padding: 8px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          background: rgba(255,255,255,0.032);
          text-align: left;
        }

        .network-lists button {
          cursor: pointer;
          transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
        }

        .network-lists button:hover {
          transform: translateY(-1px);
          border-color: rgba(79,183,197,0.3);
          background: rgba(79,183,197,0.08);
        }

        .network-lists strong,
        .network-lists span,
        .network-lists p {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-family: "Space Mono", monospace;
          letter-spacing: 0;
        }

        .network-lists strong {
          color: rgba(255,255,255,0.78);
          font-size: 10px;
          font-weight: 700;
        }

        .network-lists span,
        .network-lists p {
          color: rgba(255,255,255,0.42);
          font-size: 9px;
        }

        .tutorial-overlay {
          position: fixed;
          inset: 0;
          z-index: 8;
          display: grid;
          place-items: center;
          padding: 20px;
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          background: radial-gradient(circle at 50% 52%, rgba(79,140,255,0.12), rgba(2,4,8,0.42) 58%, rgba(2,4,8,0.68));
          transition: opacity 220ms ease, visibility 220ms ease;
        }

        .tutorial-overlay.is-open {
          opacity: 1;
          visibility: visible;
          pointer-events: auto;
        }

        .tutorial-card {
          position: relative;
          width: min(520px, calc(100vw - 32px));
          padding: 26px;
          border: 1px solid rgba(255,255,255,0.13);
          border-radius: 20px;
          background:
            radial-gradient(circle at 15% 0%, rgba(79,140,255,0.18), transparent 36%),
            linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.026)),
            rgba(4,9,20,0.76);
          box-shadow: 0 28px 90px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.12);
          backdrop-filter: blur(38px) saturate(190%);
          -webkit-backdrop-filter: blur(38px) saturate(190%);
        }

        .tutorial-close {
          position: absolute;
          top: 16px;
          right: 16px;
          display: grid;
          place-items: center;
          width: 32px;
          height: 32px;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 12px;
          color: rgba(255,255,255,0.72);
          background: rgba(255,255,255,0.04);
          cursor: pointer;
        }

        .tutorial-progress {
          display: flex;
          gap: 7px;
          padding-right: 44px;
          margin-bottom: 18px;
        }

        .tutorial-progress button {
          height: 4px;
          flex: 1;
          border: 0;
          border-radius: 999px;
          background: rgba(255,255,255,0.14);
          cursor: pointer;
        }

        .tutorial-progress button.is-active {
          background: #4f8cff;
          box-shadow: 0 0 18px rgba(79,140,255,0.65);
        }

        .tutorial-kicker {
          display: block;
          color: #4f8cff;
          font-family: "Space Mono", monospace;
          font-size: 10px;
          letter-spacing: 0;
          text-transform: uppercase;
        }

        .tutorial-card h2 {
          margin: 10px 0 12px;
          color: rgba(255,255,255,0.96);
          font-family: Syne, Inter, sans-serif;
          font-size: 30px;
          line-height: 1.04;
          letter-spacing: 0;
        }

        .tutorial-card p {
          margin: 0;
          color: rgba(255,255,255,0.62);
          font-size: 14px;
          line-height: 1.7;
        }

        .tutorial-action {
          display: grid;
          gap: 5px;
          margin: 20px 0 22px;
          padding: 14px;
          border: 1px solid rgba(79,140,255,0.24);
          border-radius: 12px;
          background: rgba(79,140,255,0.075);
        }

        .tutorial-action strong,
        .tutorial-action span,
        .tutorial-nav button {
          font-family: "Space Mono", monospace;
          letter-spacing: 0;
        }

        .tutorial-action strong {
          color: rgba(255,255,255,0.9);
          font-size: 11px;
          text-transform: uppercase;
        }

        .tutorial-action span {
          color: rgba(255,255,255,0.58);
          font-size: 11px;
          line-height: 1.6;
        }

        .tutorial-nav {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .tutorial-nav button {
          min-height: 42px;
          border: 1px solid rgba(255,255,255,0.13);
          border-radius: 14px;
          color: rgba(255,255,255,0.86);
          background: rgba(255,255,255,0.045);
          cursor: pointer;
          font-size: 11px;
        }

        .tutorial-nav button:last-child {
          background: linear-gradient(135deg, rgba(79,140,255,0.64), rgba(79,140,255,0.25));
          box-shadow: 0 12px 32px rgba(79,140,255,0.22), inset 0 1px 0 rgba(255,255,255,0.14);
        }

        .tutorial-nav button:disabled {
          opacity: 0.36;
          cursor: not-allowed;
        }

        .repo-tooltip {
          position: fixed;
          left: 0;
          top: 0;
          z-index: 6;
          min-width: 160px;
          padding: 10px 12px;
          border: 1px solid color-mix(in srgb, var(--repo-color), transparent 40%);
          border-radius: 12px;
          background: rgba(4,9,20,0.72);
          box-shadow: 0 18px 50px rgba(0,0,0,0.42), 0 0 24px color-mix(in srgb, var(--repo-color), transparent 78%);
          backdrop-filter: blur(28px) saturate(190%);
          -webkit-backdrop-filter: blur(28px) saturate(190%);
          pointer-events: none;
          opacity: 0;
          transition: opacity 140ms ease;
        }

        .repo-tooltip span,
        .repo-tooltip strong,
        .repo-tooltip small {
          display: block;
          font-family: "Space Mono", monospace;
          letter-spacing: 0;
        }

        .repo-tooltip span {
          color: var(--repo-color);
          font-size: 12px;
          font-weight: 700;
        }

        .repo-tooltip strong {
          margin-top: 3px;
          color: rgba(255,255,255,0.86);
          font-size: 10px;
        }

        .repo-tooltip small {
          margin-top: 5px;
          color: rgba(255,255,255,0.42);
          font-size: 9px;
        }

        .repo-panel {
          position: fixed;
          top: 0;
          right: 0;
          z-index: 7;
          width: min(390px, calc(100vw - 20px));
          height: 100vh;
          padding: 34px 28px 28px;
          border-left: 1px solid rgba(255,255,255,0.13);
          background:
            radial-gradient(circle at 20% 5%, color-mix(in srgb, var(--repo-color), transparent 82%), rgba(255,255,255,0) 32%),
            linear-gradient(145deg, rgba(255,255,255,0.075), rgba(255,255,255,0.028)),
            rgba(4,9,20,0.72);
          box-shadow: -24px 0 80px rgba(0,0,0,0.46), inset 1px 0 0 rgba(255,255,255,0.09);
          backdrop-filter: blur(38px) saturate(195%);
          -webkit-backdrop-filter: blur(38px) saturate(195%);
          transform: translateX(105%);
          transition: transform 300ms cubic-bezier(.16,1,.3,1);
          overflow-y: auto;
        }

        .repo-panel.is-open {
          transform: translateX(0);
        }

        .panel-close {
          position: absolute;
          top: 18px;
          right: 18px;
          width: 30px;
          height: 30px;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 12px;
          color: rgba(255,255,255,0.74);
          background: rgba(255,255,255,0.04);
          cursor: pointer;
          font-size: 20px;
          line-height: 1;
        }

        .panel-kicker,
        .section-label {
          font-family: "Space Mono", monospace;
          font-size: 10px;
          letter-spacing: 0;
          text-transform: uppercase;
          color: var(--repo-color);
        }

        .repo-panel h2 {
          margin: 10px 0 12px;
          font-family: Syne, Inter, sans-serif;
          font-size: 30px;
          line-height: 1.02;
          font-weight: 800;
          letter-spacing: 0;
          color: var(--repo-color);
        }

        .repo-panel p {
          margin: 0;
          color: rgba(255,255,255,0.56);
          font-size: 13px;
          line-height: 1.7;
        }

        .safe-score {
          display: grid;
          gap: 10px;
          margin: 22px 0 20px;
        }

        .safe-score div {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          font-family: "Space Mono", monospace;
        }

        .safe-score span {
          color: rgba(255,255,255,0.48);
          font-size: 10px;
          text-transform: uppercase;
        }

        .safe-score strong {
          color: var(--safe-color);
          font-size: 22px;
        }

        .safe-score i {
          position: relative;
          height: 8px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
          overflow: hidden;
        }

        .safe-score b {
          position: absolute;
          inset: 0 auto 0 0;
          border-radius: inherit;
          background: linear-gradient(90deg, var(--safe-color), color-mix(in srgb, var(--safe-color), white 28%));
          box-shadow: 0 0 20px var(--safe-color);
        }

        .safety-reasons {
          display: grid;
          gap: 8px;
          margin: 0 0 22px;
        }

        .safety-reason {
          display: grid;
          gap: 4px;
          padding: 11px 12px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          background: rgba(255,255,255,0.035);
        }

        .safety-reason.positive {
          border-color: rgba(52,211,153,0.2);
          background: rgba(52,211,153,0.055);
        }

        .safety-reason.risk {
          border-color: rgba(255,107,107,0.22);
          background: rgba(255,107,107,0.052);
        }

        .safety-reason.unknown {
          border-color: rgba(251,191,36,0.2);
          background: rgba(251,191,36,0.05);
        }

        .safety-reason strong,
        .safety-reason span {
          font-family: "Space Mono", monospace;
          letter-spacing: 0;
        }

        .safety-reason strong {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          color: rgba(255,255,255,0.84);
          font-size: 11px;
        }

        .safety-reason strong b {
          color: var(--safe-color);
          font-weight: 400;
          white-space: nowrap;
        }

        .safety-reason span {
          color: rgba(255,255,255,0.48);
          font-size: 10px;
          line-height: 1.55;
        }

        .repo-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin: 0 0 22px;
        }

        .repo-badges span {
          padding: 8px 10px;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 999px;
          background: rgba(255,255,255,0.045);
          color: rgba(255,255,255,0.72);
          font-family: "Space Mono", monospace;
          font-size: 10px;
          letter-spacing: 0;
        }

        .trust-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 24px;
        }

        .trust-grid div {
          display: grid;
          gap: 4px;
          padding: 12px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          background: rgba(255,255,255,0.035);
        }

        .trust-grid div.is-good {
          border-color: rgba(52,211,153,0.28);
          background: rgba(52,211,153,0.06);
        }

        .trust-grid strong,
        .trust-grid span {
          font-family: "Space Mono", monospace;
          letter-spacing: 0;
        }

        .trust-grid strong {
          color: rgba(255,255,255,0.84);
          font-size: 12px;
        }

        .trust-grid span {
          color: rgba(255,255,255,0.4);
          font-size: 9px;
          text-transform: uppercase;
        }

        .pr-list {
          display: grid;
          gap: 10px;
        }

        .pr-item {
          display: grid;
          grid-template-columns: 8px 1fr;
          gap: 10px;
          align-items: start;
          padding: 12px 0;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }

        .priority-dot {
          width: 7px;
          height: 7px;
          margin-top: 6px;
          border-radius: 999px;
          background: rgba(255,255,255,0.28);
          box-shadow: 0 0 12px currentColor;
        }

        .priority-dot.hot {
          color: #ff6b6b;
          background: #ff6b6b;
        }

        .priority-dot.normal {
          color: var(--repo-color);
          background: var(--repo-color);
        }

        .priority-dot.quiet {
          color: rgba(255,255,255,0.28);
          background: rgba(255,255,255,0.28);
        }

        .pr-item div {
          display: grid;
          gap: 3px;
        }

        .pr-item strong {
          font-family: "Space Mono", monospace;
          font-size: 11px;
          color: rgba(255,255,255,0.86);
        }

        .pr-item span {
          font-size: 12px;
          color: rgba(255,255,255,0.47);
        }

        .panel-actions {
          display: grid;
          gap: 10px;
          margin-top: 26px;
        }

        .panel-actions a,
        .panel-actions button {
          display: grid;
          place-items: center;
          min-height: 44px;
          border: 1px solid rgba(255,255,255,0.13);
          border-radius: 14px;
          color: rgba(255,255,255,0.88);
          background: linear-gradient(135deg, color-mix(in srgb, var(--repo-color), transparent 78%), rgba(255,255,255,0.032));
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.12);
          font-family: "Space Mono", monospace;
          font-size: 11px;
          text-decoration: none;
          cursor: pointer;
        }

        .panel-actions a:hover,
        .panel-actions button:hover {
          border-color: color-mix(in srgb, var(--repo-color), white 18%);
          box-shadow: 0 0 24px color-mix(in srgb, var(--repo-color), transparent 78%), inset 0 1px 0 rgba(255,255,255,0.15);
        }

        @keyframes rimSpin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes focusPulse {
          0% {
            opacity: 1;
            transform: scale(1);
          }
          100% {
            opacity: 0;
            transform: scale(1.01);
          }
        }

        @keyframes letterRise {
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes enterIn {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (min-width: 1500px) {
          .intro-copy h1 {
            font-size: 220px;
          }
        }

        @media (max-width: 760px) {
          .intro-copy {
            top: 17%;
            width: 100%;
            padding: 0 18px;
          }

          .intro-copy h1 {
            font-size: 92px;
          }

          .search-cluster {
            bottom: 22px;
          }

          .search-cluster.has-panel {
            left: 50%;
            width: min(760px, calc(100vw - 32px));
          }

          .control-dock {
            top: 76px;
            left: 14px;
            width: calc(100vw - 28px);
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }

          .tool-group {
            grid-template-columns: 34px 1fr 34px 34px;
            padding: 6px;
          }

          .mode-toggle {
            padding: 6px;
          }

          .guide-button {
            grid-column: 1 / -1;
            height: 34px;
          }

          .glass-search {
            grid-template-columns: 1fr;
            min-height: 116px;
            padding: 18px;
          }

          .glass-search button {
            width: 100%;
          }

          .search-results {
            max-height: 190px;
            padding: 8px;
          }

          .search-results-head {
            align-items: flex-start;
            flex-direction: column;
            gap: 3px;
          }

          .search-result {
            padding-right: 40px;
          }

          .stat-bar {
            top: 16px;
            right: 14px;
            gap: 14px;
          }

          .stat-bar strong {
            font-size: 17px;
          }

          .stat-bar span {
            font-size: 8px;
          }

          .network-dock {
            top: 188px;
            right: 14px;
            width: calc(100vw - 28px);
            max-height: 34vh;
            overflow-y: auto;
          }

          .network-dock.has-panel {
            right: 14px;
          }

          .network-lists {
            grid-template-columns: 1fr;
          }

          .cinema-readout {
            display: none;
          }

          .repo-tooltip {
            display: none;
          }

          .tutorial-card {
            padding: 22px;
          }

          .tutorial-card h2 {
            font-size: 25px;
          }
        }
      `}</style>
    </main>
  );
}


function createBuilding(repo: Repo, index: number, districtRepos: Repo[], heightScaleDriver: HeightScaleDriver) {
  const district = districtFor(repo);
  const layout = createRepoLayout(repo, index, districtRepos, heightScaleDriver);
  const group = new THREE.Group();
  group.position.copy(layout.position);

  const shape = buildingShapeFor(repo, district);
  const baseColor = new THREE.Color(district.color);
  const bodyColor = baseColor.clone().lerp(new THREE.Color('#050708'), 0.1);
  const accentColor = new THREE.Color(district.accent);

  const style = {
    bodyWidth: 0.78,
    bodyDepth: 0.78,
    bodyHeight: 0.82,
    capWidth: 0.82,
    capDepth: 0.82,
    capHeight: 0.055,
    windows: true,
    transparent: false,
    detail: 'stripe',
  };

  if (['spires', 'megatowers', 'vertical_arcology', 'skyline_core'].includes(shape)) {
    Object.assign(style, { bodyWidth: 0.52, bodyDepth: 0.56, bodyHeight: 0.97, capWidth: 0.38, capDepth: 0.42, capHeight: 0.07, detail: 'spire' });
  } else if (['citadel', 'fortresses', 'castles', 'canyon_forts'].includes(shape)) {
    Object.assign(style, { bodyWidth: 0.96, bodyDepth: 0.96, bodyHeight: 0.72, capWidth: 0.68, capDepth: 0.68, capHeight: 0.16, detail: 'setback' });
  } else if (['glass', 'neon_alley', 'apartments', 'brick_boroughs'].includes(shape)) {
    Object.assign(style, { bodyWidth: 0.62, bodyDepth: 0.86, bodyHeight: 0.9, capWidth: 0.82, capDepth: 0.98, capHeight: 0.05, detail: 'fin' });
  } else if (['holographic_forms', 'holographic', 'floating_stations', 'ether_realm', 'crystal_spires', 'crystal_fields'].includes(shape)) {
    Object.assign(style, { bodyWidth: 0.72, bodyDepth: 0.72, bodyHeight: 0.78, capWidth: 1.02, capDepth: 0.36, capHeight: 0.055, transparent: true, detail: 'crossbar' });
  } else if (['suburban_homes', 'rooftop_villages', 'suburbs', 'valley_villages', 'tents', 'nomad_camps', 'shipyards', 'fishing_docks'].includes(shape)) {
    Object.assign(style, { bodyWidth: 1.18, bodyDepth: 0.82, bodyHeight: 0.32, capWidth: 1.04, capDepth: 0.68, capHeight: 0.08, windows: false, detail: 'podium' });
  } else if (['blocks', 'financial_district'].includes(shape)) {
    Object.assign(style, { bodyWidth: 1.24, bodyDepth: 1.18, bodyHeight: 0.42, capWidth: 0.78, capDepth: 0.78, capHeight: 0.12, detail: 'setback' });
  } else if (['reactors', 'refineries', 'factories', 'lava_foundries'].includes(shape)) {
    Object.assign(style, { bodyWidth: 1.18, bodyDepth: 0.98, bodyHeight: 0.64, capWidth: 0.54, capDepth: 1.14, capHeight: 0.12, detail: 'chimney' });
  } else if (['observatories'].includes(shape)) {
    Object.assign(style, { bodyWidth: 1.08, bodyDepth: 0.62, bodyHeight: 0.58, capWidth: 1.22, capDepth: 0.24, capHeight: 0.07, detail: 'fin' });
  } else if (['ruins', 'decayed', 'overgrown'].includes(shape)) {
    Object.assign(style, { bodyWidth: 1.14, bodyDepth: 0.9, bodyHeight: 0.5, capWidth: 0.78, capDepth: 0.72, capHeight: 0.1, windows: false, detail: 'offset' });
  } else if (['giant_trees', 'forest_repository', 'redwood_archive', 'redwood_towers', 'mushroom_colonies', 'bamboo_pagodas', 'bamboo_valley', 'caves', 'stone_villages'].includes(shape)) {
    Object.assign(style, { bodyWidth: 0.82, bodyDepth: 0.82, bodyHeight: 0.66, capWidth: 1.08, capDepth: 0.9, capHeight: 0.16, windows: false, detail: 'canopy' });
  }

  const bodyHeight = Math.max(1.25, layout.height * style.bodyHeight);
  const capHeight = Math.max(0.16, layout.height * style.capHeight);
  const bodyWidth = Math.max(1.15, layout.width * style.bodyWidth);
  const bodyDepth = Math.max(1.15, layout.depth * style.bodyDepth);
  const capWidth = Math.max(0.95, layout.width * style.capWidth);
  const capDepth = Math.max(0.95, layout.depth * style.capDepth);
  const visualHeight = bodyHeight + capHeight;
  const highDetail = repo.stars >= HIGH_DETAIL_REPO_STARS || index % 14 === 0;
  const showWindows = style.windows && repo.stars >= WINDOW_REPO_STARS;

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: style.transparent ? 0.24 : 0.48,
    metalness: style.transparent ? 0.6 : 0.22,
    emissive: baseColor,
    emissiveIntensity: style.transparent ? 0.1 : 0.026,
    transparent: style.transparent,
    opacity: style.transparent ? 0.72 : 1,
  });

  const body: RepoBuildingMesh = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyDepth),
    bodyMaterial,
  );
  body.position.y = bodyHeight / 2;
  body.userData.repoId = repo.id;
  group.add(body);

  const topMaterial = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.36,
    metalness: 0.32,
    emissive: accentColor,
    emissiveIntensity: 0.08,
  });
  const top: RepoBuildingMesh = new THREE.Mesh(
    new THREE.BoxGeometry(capWidth, capHeight, capDepth),
    topMaterial,
  );
  top.position.y = bodyHeight + capHeight / 2;
  top.userData.repoId = repo.id;
  group.add(top);

  const accentMaterial = new THREE.MeshBasicMaterial({
    color: accentColor,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
  });
  const addDetail = (mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>) => {
    mesh.userData.repoId = repo.id;
    group.add(mesh);
  };

  if (highDetail && (style.detail === 'stripe' || style.detail === 'fin' || style.detail === 'spire')) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.08, bodyWidth * 0.08), bodyHeight * 0.86, 0.055), accentMaterial);
    stripe.position.set(-bodyWidth * 0.32, bodyHeight * 0.52, bodyDepth / 2 + 0.035);
    addDetail(stripe);
  }
  if (highDetail && (style.detail === 'setback' || style.detail === 'offset')) {
    const tier = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth * 0.62, bodyHeight * 0.18, bodyDepth * 0.62), bodyMaterial);
    tier.position.set(style.detail === 'offset' ? -bodyWidth * 0.12 : 0, bodyHeight * 0.77, 0);
    addDetail(tier);
  }
  if (highDetail && style.detail === 'crossbar') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth * 1.18, Math.max(0.12, bodyHeight * 0.035), bodyDepth * 0.22), accentMaterial);
    bar.position.set(0, bodyHeight * 0.58, bodyDepth / 2 + 0.04);
    addDetail(bar);
  }
  if (highDetail && (style.detail === 'podium' || style.detail === 'canopy')) {
    const podium = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth * 1.08, Math.max(0.18, bodyHeight * 0.08), bodyDepth * 1.08), accentMaterial);
    podium.position.set(0, Math.max(0.16, bodyHeight * 0.08), 0);
    addDetail(podium);
  }
  if (highDetail && style.detail === 'chimney') {
    const stack = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth * 0.16, bodyHeight * 0.42, bodyDepth * 0.16), topMaterial);
    stack.position.set(bodyWidth * 0.32, bodyHeight * 0.72, -bodyDepth * 0.28);
    addDetail(stack);
  }

  if (highDetail) {
    const edgeGeometry = new THREE.EdgesGeometry(body.geometry);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: accentColor, transparent: true, opacity: 0.1 });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    edges.position.copy(body.position);
    group.add(edges);
  }

  let windows: RepoWindowsMesh;
  if (showWindows) {
    const windowGeometry = new THREE.PlaneGeometry(0.22, 0.16);
    const windowMaterial = new THREE.MeshBasicMaterial({
      color: accentColor,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    const cols = Math.min(3, Math.max(1, Math.floor(bodyWidth / 1.7)));
    const rows = Math.min(6, Math.max(1, Math.floor(bodyHeight / 5.2)));
    const litWindows: THREE.Matrix4[] = [];
    const dummy = new THREE.Object3D();
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const litSeed = Math.sin((row + 1) * 12.9 + (col + 1) * 78.2 + repo.stars * 0.001);
        if (litSeed - Math.floor(litSeed) < 0.52) continue;
        const wx = -bodyWidth / 2 + 0.42 + col * ((bodyWidth - 0.84) / Math.max(1, cols - 1));
        const wy = 0.9 + row * ((bodyHeight - 1.6) / Math.max(1, rows - 1));
        dummy.position.set(wx, wy, bodyDepth / 2 + 0.035);
        dummy.updateMatrix();
        litWindows.push(dummy.matrix.clone());
      }
    }
    windows = new THREE.InstancedMesh(windowGeometry, windowMaterial, Math.max(1, litWindows.length));
    litWindows.forEach((matrix, matrixIndex) => windows.setMatrixAt(matrixIndex, matrix));
  } else {
    windows = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.01, 0.01),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }),
      1,
    );
    windows.visible = false;
  }
  windows.userData.repoId = repo.id;
  group.add(windows);

  const beacon = new THREE.Mesh(
    new THREE.BoxGeometry(0.01, 0.01, 0.01),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }),
  );
  const ring = new THREE.Mesh(
    new THREE.BoxGeometry(0.01, 0.01, 0.01),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }),
  );
  beacon.visible = false;
  ring.visible = false;
  group.add(beacon, ring);

  return {
    repo,
    district,
    group,
    body,
    top,
    windows,
    beacon,
    ring,
    position: layout.position.clone(),
    height: visualHeight,
    width: bodyWidth,
    depth: bodyDepth,
    phase: (repo.stars % 1000) / 1000,
  };
}

function repoDetailSeed(repo: Repo) {
  return `${repo.owner}/${repo.name}`.split('').reduce((total, char, index) => total + char.charCodeAt(0) * (index + 3), 17);
}

function ensureSelectedBuildingDetails(building: BuildingObject) {
  if (building.selectedDetails) return building.selectedDetails;

  const { repo, district } = building;
  const seed = repoDetailSeed(repo);
  const bodyHeight = Math.max(1.25, building.body.position.y * 2);
  const capHeight = Math.max(0.16, building.height - bodyHeight);
  const bodyWidth = building.width;
  const bodyDepth = building.depth;
  const accentColor = new THREE.Color(district.accent);
  const softLight = accentColor.clone().lerp(new THREE.Color('#f8fafc'), 0.48);
  const railColor = accentColor.clone().lerp(new THREE.Color('#020617'), 0.14);
  const group = new THREE.Group();
  group.visible = false;
  group.userData.repoId = repo.id;

  const paneMaterial = new THREE.MeshBasicMaterial({
    color: softLight,
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
  });
  paneMaterial.userData.baseOpacity = 0.94;
  const dimPaneMaterial = new THREE.MeshBasicMaterial({
    color: accentColor.clone().lerp(new THREE.Color('#dbeafe'), 0.18),
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  dimPaneMaterial.userData.baseOpacity = 0.42;
  const facadePlateMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#020617').lerp(accentColor, 0.18),
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });
  facadePlateMaterial.userData.baseOpacity = 0.16;
  const paneGeometry = new THREE.PlaneGeometry(1, 1);
  const brightMatrices: THREE.Matrix4[] = [];
  const dimMatrices: THREE.Matrix4[] = [];
  const dummy = new THREE.Object3D();
  const rows = Math.min(22, Math.max(4, Math.floor(bodyHeight / 1.35)));
  const frontCols = Math.min(10, Math.max(2, Math.floor(bodyWidth / 0.42)));
  const sideCols = Math.min(9, Math.max(2, Math.floor(bodyDepth / 0.46)));
  const paneWidth = clamp(bodyWidth / Math.max(7, frontCols * 1.85), 0.16, 0.38);
  const paneHeight = clamp(bodyHeight / Math.max(22, rows * 2.45), 0.12, 0.34);
  const yPad = clamp(bodyHeight * 0.13, 0.32, 1.1);
  const usableHeight = Math.max(0.4, bodyHeight - yPad * 1.55);

  const addPane = (x: number, y: number, z: number, rotationY: number, bright: boolean) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, rotationY, 0);
    dummy.scale.set(paneWidth, paneHeight, 1);
    dummy.updateMatrix();
    (bright ? brightMatrices : dimMatrices).push(dummy.matrix.clone());
  };

  const addFacade = (face: 'front' | 'back' | 'left' | 'right') => {
    const isSide = face === 'left' || face === 'right';
    const cols = isSide ? sideCols : frontCols;
    const span = isSide ? bodyDepth : bodyWidth;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const skip = (seed + row * 11 + col * 17 + face.length * 19) % 17 === 0;
        if (skip) continue;
        const lane = cols === 1 ? 0 : -span / 2 + 0.38 + col * ((span - 0.76) / Math.max(1, cols - 1));
        const y = yPad + row * (usableHeight / Math.max(1, rows - 1));
        const bright = (seed + row * 7 + col * 5 + face.length * 3) % 5 !== 0;
        if (face === 'front') addPane(lane, y, bodyDepth / 2 + 0.062, 0, bright);
        if (face === 'back') addPane(-lane, y, -bodyDepth / 2 - 0.062, Math.PI, bright);
        if (face === 'right') addPane(bodyWidth / 2 + 0.062, y, lane, Math.PI / 2, bright);
        if (face === 'left') addPane(-bodyWidth / 2 - 0.062, y, -lane, -Math.PI / 2, bright);
      }
    }
  };

  addFacade('front');
  addFacade('back');
  addFacade('left');
  addFacade('right');

  [
    { position: [0, bodyHeight * 0.5, bodyDepth / 2 + 0.048], scale: [bodyWidth * 0.96, bodyHeight * 0.92, 0.035] },
    { position: [bodyWidth / 2 + 0.048, bodyHeight * 0.5, 0], scale: [0.035, bodyHeight * 0.86, bodyDepth * 0.72] },
  ].forEach(({ position, scale }) => {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(scale[0], scale[1], scale[2]), facadePlateMaterial);
    plate.position.set(position[0], position[1], position[2]);
    plate.userData.repoId = repo.id;
    group.add(plate);
  });

  const brightPanes = new THREE.InstancedMesh(paneGeometry, paneMaterial, brightMatrices.length || 1);
  brightPanes.renderOrder = 3;
  brightPanes.userData.repoId = repo.id;
  brightMatrices.forEach((matrix, index) => brightPanes.setMatrixAt(index, matrix));
  brightPanes.instanceMatrix.needsUpdate = true;
  group.add(brightPanes);

  const dimPanes = new THREE.InstancedMesh(paneGeometry.clone(), dimPaneMaterial, dimMatrices.length || 1);
  dimPanes.renderOrder = 2;
  dimPanes.userData.repoId = repo.id;
  dimMatrices.forEach((matrix, index) => dimPanes.setMatrixAt(index, matrix));
  dimPanes.instanceMatrix.needsUpdate = true;
  group.add(dimPanes);

  const railMaterial = new THREE.MeshBasicMaterial({
    color: railColor,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
  });
  railMaterial.userData.baseOpacity = 0.78;
  const bandMaterial = new THREE.MeshBasicMaterial({
    color: softLight,
    transparent: true,
    opacity: 0.56,
    depthWrite: false,
  });
  bandMaterial.userData.baseOpacity = 0.56;
  const cornerRailGeometry = new THREE.BoxGeometry(0.055, bodyHeight * 0.94, 0.055);
  [
    [-bodyWidth / 2 - 0.035, bodyDepth / 2 + 0.035],
    [bodyWidth / 2 + 0.035, bodyDepth / 2 + 0.035],
    [-bodyWidth / 2 - 0.035, -bodyDepth / 2 - 0.035],
    [bodyWidth / 2 + 0.035, -bodyDepth / 2 - 0.035],
  ].forEach(([x, z]) => {
    const rail = new THREE.Mesh(cornerRailGeometry.clone(), railMaterial);
    rail.position.set(x, bodyHeight * 0.49, z);
    rail.userData.repoId = repo.id;
    group.add(rail);
  });

  const bandCount = Math.min(4, Math.max(2, Math.round(getOpenWorkItems(repo) / 120) + 2));
  for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
    const y = yPad + (bandIndex + 1) * (usableHeight / (bandCount + 1));
    const frontBand = new THREE.Mesh(
      new THREE.BoxGeometry(bodyWidth * (0.68 + ((seed + bandIndex) % 4) * 0.07), 0.045, 0.07),
      bandMaterial,
    );
    frontBand.position.set(0, y, bodyDepth / 2 + 0.085);
    frontBand.userData.repoId = repo.id;
    group.add(frontBand);

    const sideBand = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.045, bodyDepth * (0.5 + ((seed + bandIndex * 2) % 5) * 0.06)),
      bandMaterial,
    );
    sideBand.position.set(bodyWidth / 2 + 0.085, y + paneHeight * 0.55, 0);
    sideBand.userData.repoId = repo.id;
    group.add(sideBand);
  }

  const crownY = bodyHeight + capHeight + 0.08;
  const crownMaterial = new THREE.MeshBasicMaterial({
    color: accentColor,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
  });
  crownMaterial.userData.baseOpacity = 0.62;
  const crown = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth * 0.68, 0.12, Math.max(0.12, bodyDepth * 0.16)),
    crownMaterial,
  );
  crown.position.set(0, crownY, bodyDepth * 0.24);
  crown.userData.repoId = repo.id;
  group.add(crown);

  const markerCount = Math.min(5, Math.max(2, repo.topics.length || Math.round(repo.safetyScore / 30)));
  for (let markerIndex = 0; markerIndex < markerCount; markerIndex += 1) {
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, clamp(bodyHeight * 0.08, 0.16, 0.7), 0.08),
      markerIndex % 2 === 0 ? crownMaterial : bandMaterial,
    );
    marker.position.set(
      -bodyWidth / 2 - 0.1,
      yPad + markerIndex * (usableHeight / Math.max(1, markerCount)),
      -bodyDepth * 0.28 + markerIndex * 0.13,
    );
    marker.userData.repoId = repo.id;
    group.add(marker);
  }

  building.selectedDetails = group;
  building.group.add(group);
  return group;
}

function seededUnit(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function landscapePaletteFor(district: District) {
  if (['forest_repository', 'jungle_canopy', 'bamboo_valley', 'overgrown_ruins', 'redwood_archive'].includes(district.key)) {
    return { ground: '#14532d', path: '#86efac', planter: '#22c55e', node: '#bbf7d0' };
  }
  if (district.key === 'volcano_forge') {
    return { ground: '#431407', path: '#fb923c', planter: '#7f1d1d', node: '#fed7aa' };
  }
  if (district.key === 'frozen_kingdom') {
    return { ground: '#dbeafe', path: '#38bdf8', planter: '#e0f2fe', node: '#f8fafc' };
  }
  if (district.parent === 'web') {
    return { ground: '#0f2a4a', path: '#93c5fd', planter: '#1d4ed8', node: '#bfdbfe' };
  }
  if (district.parent === 'ai') {
    return { ground: '#2e1065', path: '#d8b4fe', planter: '#7e22ce', node: '#f5d0fe' };
  }
  if (district.parent === 'systems') {
    return { ground: '#3f1118', path: '#fda4af', planter: '#991b1b', node: '#fecdd3' };
  }
  return { ground: '#12332d', path: district.accent, planter: '#115e59', node: '#ccfbf1' };
}

function createLandscapeMaterial(color: string, dayOpacity: number, nightOpacity = dayOpacity * 0.9) {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: dayOpacity,
    depthWrite: false,
  });
  material.userData.dayOpacity = dayOpacity;
  material.userData.nightOpacity = nightOpacity;
  return material;
}

function createTerrainMaterial(color: string, dayOpacity: number, nightOpacity = dayOpacity * 0.82) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.92,
    metalness: 0,
    transparent: true,
    opacity: dayOpacity,
    depthWrite: false,
    flatShading: true,
  });
  material.userData.dayOpacity = dayOpacity;
  material.userData.nightOpacity = nightOpacity;
  return material;
}

function markLandscape(mesh: THREE.Mesh, dayOpacity: number, nightOpacity = dayOpacity * 0.9) {
  mesh.userData.role = 'landscape';
  mesh.userData.dayOpacity = dayOpacity;
  mesh.userData.nightOpacity = nightOpacity;
  return mesh;
}

function addLandscapePlane(scene: THREE.Scene, x: number, z: number, width: number, depth: number, rotation: number, color: string, dayOpacity: number) {
  const nightOpacity = dayOpacity * 0.86;
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    createLandscapeMaterial(color, dayOpacity, nightOpacity),
  );
  plane.rotation.set(-Math.PI / 2, 0, rotation);
  plane.position.set(x, 0.035, z);
  markLandscape(plane, dayOpacity, nightOpacity);
  scene.add(plane);
  return plane;
}

function addLandscapeBox(scene: THREE.Scene, x: number, z: number, width: number, depth: number, height: number, color: string, dayOpacity: number, rotation: number) {
  const nightOpacity = dayOpacity * 0.9;
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    createLandscapeMaterial(color, dayOpacity, nightOpacity),
  );
  box.position.set(x, height / 2, z);
  box.rotation.y = rotation;
  markLandscape(box, dayOpacity, nightOpacity);
  scene.add(box);
  return box;
}

function addLandscapeNode(scene: THREE.Scene, x: number, z: number, radius: number, color: string, dayOpacity: number) {
  const nightOpacity = dayOpacity * 0.95;
  const node = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 0.085, 8),
    createLandscapeMaterial(color, dayOpacity, nightOpacity),
  );
  node.position.set(x, 0.055, z);
  markLandscape(node, dayOpacity, nightOpacity);
  scene.add(node);
  return node;
}

function addTerrainMound(scene: THREE.Scene, x: number, z: number, width: number, depth: number, height: number, color: string, dayOpacity: number, seed: number) {
  const geometry = new THREE.PlaneGeometry(width, depth, 12, 12);
  const positions = geometry.attributes.position as THREE.BufferAttribute;
  const shoulder = 0.28 + seededUnit(seed + 0.9) * 0.22;
  for (let index = 0; index < positions.count; index += 1) {
    const px = positions.getX(index) / (width / 2);
    const py = positions.getY(index) / (depth / 2);
    const dist = Math.sqrt(px * px + py * py);
    const ripple = Math.sin((px * 2.7 + py * 1.6 + seed) * Math.PI) * 0.08;
    const moundHeight = Math.max(0, 1 - Math.pow(dist, 1.8 + shoulder)) * height;
    positions.setZ(index, Math.max(0, moundHeight + ripple * height));
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();

  const nightOpacity = dayOpacity * 0.82;
  const mound = new THREE.Mesh(geometry, createTerrainMaterial(color, dayOpacity, nightOpacity));
  mound.rotation.set(-Math.PI / 2, 0, seededUnit(seed + 2.1) * Math.PI);
  mound.position.set(x, 0.015, z);
  markLandscape(mound, dayOpacity, nightOpacity);
  scene.add(mound);
  return mound;
}

function createRollingTerrain(scene: THREE.Scene) {
  const geometry = new THREE.PlaneGeometry(980, 980, 72, 72);
  const positions = geometry.attributes.position as THREE.BufferAttribute;
  const hillAnchors = [
    { x: -210, z: -190, r: 180, h: 1.8 },
    { x: 225, z: -170, r: 170, h: 1.45 },
    { x: -255, z: 185, r: 190, h: 1.65 },
    { x: 245, z: 220, r: 210, h: 1.35 },
    { x: 0, z: -250, r: 150, h: 1.15 },
    { x: 20, z: 260, r: 170, h: 1.25 },
  ];

  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const z = positions.getY(index);
    let y = 0;
    hillAnchors.forEach((hill, hillIndex) => {
      const dx = x - hill.x;
      const dz = z - hill.z;
      const falloff = Math.max(0, 1 - Math.sqrt(dx * dx + dz * dz) / hill.r);
      y += Math.pow(falloff, 2.2) * hill.h;
      y += Math.sin((x * 0.012 + z * 0.009 + hillIndex) * Math.PI) * falloff * 0.12;
    });
    const cityBowl = Math.max(0, 1 - Math.sqrt(x * x + z * z) / 210);
    positions.setZ(index, Math.max(0, y - cityBowl * 0.68));
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();

  const dayOpacity = 0.34;
  const nightOpacity = 0.22;
  const terrain = new THREE.Mesh(geometry, createTerrainMaterial('#2f8a4f', dayOpacity, nightOpacity));
  terrain.rotation.x = -Math.PI / 2;
  terrain.position.y = -0.07;
  terrain.renderOrder = -2;
  markLandscape(terrain, dayOpacity, nightOpacity);
  scene.add(terrain);
  return terrain;
}

function createDistrictLandscaping(scene: THREE.Scene, district: District, districtIndex: number) {
  const palette = landscapePaletteFor(district);
  const centerX = district.x;
  const centerZ = district.z + 2;

  addTerrainMound(
    scene,
    centerX + (seededUnit(districtIndex + 14.2) - 0.5) * 24,
    centerZ + (seededUnit(districtIndex + 18.8) - 0.5) * 24,
    82 + seededUnit(districtIndex + 2.5) * 32,
    60 + seededUnit(districtIndex + 3.4) * 30,
    0.95 + seededUnit(districtIndex + 4.6) * 1.75,
    palette.planter,
    0.24,
    districtIndex * 19.3,
  );

  addLandscapePlane(scene, centerX, centerZ, 82, 72, seededUnit(districtIndex + 0.2) * 0.24 - 0.12, palette.ground, 0.06);

  for (let lane = 0; lane < 3; lane += 1) {
    const laneSeed = districtIndex * 31 + lane * 7;
    const rotation = (seededUnit(laneSeed) - 0.5) * 0.48 + (lane === 0 ? 0 : Math.PI / 2);
    const offset = (seededUnit(laneSeed + 2) - 0.5) * 16;
    const laneX = centerX + Math.cos(rotation + Math.PI / 2) * offset;
    const laneZ = centerZ + Math.sin(rotation + Math.PI / 2) * offset;
    addLandscapePlane(scene, laneX, laneZ, 62 + seededUnit(laneSeed + 3) * 22, 2.6 + seededUnit(laneSeed + 4) * 2.0, rotation, palette.path, 0.1);
  }

  for (let planterIndex = 0; planterIndex < 8; planterIndex += 1) {
    const seed = districtIndex * 71 + planterIndex * 13;
    const angle = seededUnit(seed) * Math.PI * 2;
    const ringRadiusX = 18 + seededUnit(seed + 1) * 26;
    const ringRadiusZ = 15 + seededUnit(seed + 2) * 24;
    const x = centerX + Math.cos(angle) * ringRadiusX;
    const z = centerZ + Math.sin(angle) * ringRadiusZ;
    const width = 5.6 + seededUnit(seed + 3) * 10.5;
    const depth = 1.7 + seededUnit(seed + 4) * 3.6;
    const height = 0.08 + seededUnit(seed + 5) * 0.16;
    addLandscapeBox(scene, x, z, width, depth, height, palette.planter, 0.3, angle + Math.PI / 2);
  }

  for (let nodeIndex = 0; nodeIndex < 5; nodeIndex += 1) {
    const seed = districtIndex * 43 + nodeIndex * 11;
    const angle = nodeIndex * (Math.PI * 2 / 5) + seededUnit(seed) * 0.5;
    const radius = 13 + seededUnit(seed + 1) * 24;
    addLandscapeNode(
      scene,
      centerX + Math.cos(angle) * radius,
      centerZ + Math.sin(angle) * radius,
      0.95 + seededUnit(seed + 2) * 1.2,
      palette.node,
      0.28,
    );
  }
}

function createGround(scene: THREE.Scene) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Muted civic grid background
  ctx.fillStyle = '#06120d';
  ctx.fillRect(0, 0, 512, 512);

  // Tech grid lines
  ctx.strokeStyle = '#173829';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 512; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.22;
  for (let i = 0; i < 90; i += 1) {
    const x = seededUnit(i + 0.31) * 512;
    const y = seededUnit(i + 4.73) * 512;
    const width = 8 + seededUnit(i + 7.19) * 36;
    const height = 2 + seededUnit(i + 9.41) * 8;
    ctx.fillStyle = i % 3 === 0 ? '#163d35' : i % 3 === 1 ? '#102b35' : '#24321f';
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((seededUnit(i + 12.4) - 0.5) * 0.9);
    roundRect(ctx, -width / 2, -height / 2, width, height, 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 16);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1000, 1000, 1, 1),
    new THREE.MeshBasicMaterial({
      map: texture,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  ground.userData.role = 'ground';
  scene.add(ground);

  createRollingTerrain(scene);

  const grid = new THREE.GridHelper(1000, 120, '#4fb7c5', '#204d45');
  grid.userData.role = 'grid';
  const gridMaterial = grid.material as THREE.Material;
  gridMaterial.transparent = true;
  gridMaterial.opacity = 0.045;
  grid.position.y = 0.01;
  scene.add(grid);

  DISTRICTS.forEach((district, districtIndex) => {
    const isNature = ['forest_repository', 'jungle_canopy', 'bamboo_valley', 'overgrown_ruins'].includes(district.key);
    const isLava = district.key === 'volcano_forge';
    const isIce = district.key === 'frozen_kingdom';

    let planeColor = district.color;
    if (isNature) planeColor = '#064e3b';
    if (isLava) planeColor = '#450a0a';
    if (isIce) planeColor = '#e0f2fe';

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(35, 35),
      new THREE.MeshBasicMaterial({
        color: planeColor,
        transparent: true,
        opacity: isNature ? 0.09 : 0.045,
        depthWrite: false,
      }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(district.x, 0.02, district.z + 2);
    plane.userData.role = 'district-plane';
    scene.add(plane);

    createDistrictLandscaping(scene, district, districtIndex);

    const labelTexture = makeSpriteTexture(district.label.toUpperCase(), 'semantic district', district.color, 520, 130);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, transparent: true, opacity: 0.38, depthWrite: false }));
    label.position.set(district.x, 1.4, district.z + 22);
    label.scale.set(9.5, 2.25, 1);
    scene.add(label);
  });
}

function createSky(scene: THREE.Scene) {
  const starGeometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  for (let i = 0; i < 420; i += 1) {
    const radius = 400 + Math.random() * 600;
    const theta = Math.random() * Math.PI * 2;
    const y = 40 + Math.random() * 250;
    positions.push(Math.cos(theta) * radius, y, Math.sin(theta) * radius);
  }
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      color: '#ffffff',
      size: 0.22,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  stars.userData.role = 'stars';
  scene.add(stars);
}

function flowColorFor(building: BuildingObject) {
  if (['forest_repository', 'jungle_canopy', 'bamboo_valley', 'overgrown_ruins'].includes(building.district.key)) return '#86efac';
  if (building.district.key === 'volcano_forge') return '#fb923c';
  if (building.district.key === 'frozen_kingdom') return '#e0f2fe';
  if (building.district.parent === 'ai') return '#d8b4fe';
  if (building.district.parent === 'web') return '#93c5fd';
  if (building.district.parent === 'systems') return '#fda4af';
  return building.district.accent;
}

function prFlowScore(building: BuildingObject) {
  return getOpenWorkItems(building.repo) * 1.1 + building.repo.prs.length * 70 + building.repo.goodFirstIssues * 8 + Math.log10(building.repo.stars + 1) * 7;
}

function createRoads(scene: THREE.Scene, buildings: BuildingObject[]) {
  const roads: RoadObject[] = [];
  const roadPairs = new Set<string>();
  let packetBudget = MAX_PR_FLOW_PACKETS;

  const buildingsByDistrict = new Map<DistrictKey, BuildingObject[]>();
  buildings.forEach((building) => {
    const items = buildingsByDistrict.get(building.repo.district) ?? [];
    items.push(building);
    buildingsByDistrict.set(building.repo.district, items);
  });

  const addRoad = (source: BuildingObject, target: BuildingObject, laneIndex: number, isDistrictTrunk = false) => {
    if (roads.length >= MAX_PR_FLOW_ROADS || packetBudget <= 0 || source === target) return;
    const pairKey = [source.repo.id, target.repo.id].sort().join('::');
    if (roadPairs.has(pairKey)) return;

    const distance = source.position.distanceTo(target.position);
    if (distance < 5 || distance > (isDistrictTrunk ? 180 : 118)) return;

    roadPairs.add(pairKey);

    const openWork = Math.max(1, getOpenWorkItems(source.repo));
    const flowStrength = clamp(Math.log10(openWork + source.repo.prs.length * 40 + 8) / 3.25, 0.22, 1);
    const pathColor = flowColorFor(source);
    const baseOpacity = clamp(0.1 + flowStrength * 0.16, 0.12, 0.28);
    const radius = clamp(0.035 + flowStrength * 0.07, 0.045, 0.115);

    const p1 = source.position.clone();
    const p2 = target.position.clone();
    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const invLength = 1 / Math.max(1, Math.sqrt(dx * dx + dz * dz));
    const normal = new THREE.Vector3(-dz * invLength, 0, dx * invLength);
    const seed = source.repo.stars * 0.013 + target.repo.forks * 0.017 + laneIndex * 11.7;
    const bow = (seededUnit(seed) - 0.5) * clamp(distance * 0.24, 6, 24) + (laneIndex - 0.5) * 2.8;
    const midX = (p1.x + p2.x) / 2 + normal.x * bow;
    const midZ = (p1.z + p2.z) / 2 + normal.z * bow;
    const start = new THREE.Vector3(p1.x, 0.18, p1.z);
    const end = new THREE.Vector3(p2.x, 0.18, p2.z);
    const curve = new THREE.CatmullRomCurve3([
      start,
      new THREE.Vector3(p1.x * 0.72 + midX * 0.28, 0.2 + flowStrength * 0.08, p1.z * 0.72 + midZ * 0.28),
      new THREE.Vector3(midX, 0.22 + flowStrength * 0.1, midZ),
      new THREE.Vector3(p2.x * 0.72 + midX * 0.28, 0.2 + flowStrength * 0.08, p2.z * 0.72 + midZ * 0.28),
      end,
    ]);

    const roadMaterial = new THREE.MeshBasicMaterial({
      color: pathColor,
      transparent: true,
      opacity: baseOpacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    roadMaterial.userData.filteredOpacity = baseOpacity;

    const mesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 28, radius, 4, false),
      roadMaterial,
    );
    mesh.userData.role = 'pr-flow-road';
    scene.add(mesh);

    const packetCount = Math.max(1, Math.min(packetBudget, Math.round(1 + flowStrength * 3.2 + Math.min(2, source.repo.prs.length))));
    packetBudget -= packetCount;
    const packetGeometry = new THREE.BoxGeometry(
      clamp(radius * 7.2, 0.34, 0.82),
      clamp(radius * 2.1, 0.11, 0.24),
      clamp(radius * 3.7, 0.18, 0.42),
    );
    const cars: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[] = [];
    for (let packetIndex = 0; packetIndex < packetCount; packetIndex += 1) {
      const packetMaterial = new THREE.MeshBasicMaterial({
        color: packetIndex % 2 === 0 ? pathColor : source.district.color,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      });
      packetMaterial.userData.filteredOpacity = 0.92;
      const packet = new THREE.Mesh(packetGeometry, packetMaterial);
      packet.userData.role = 'pr-flow-packet';
      scene.add(packet);
      cars.push(packet);
    }

    const flowLabel = source.repo.prs.length > 0 ? `${source.repo.prs.length} listed PRs` : `${formatMetric(openWork)} open`;
    const labelTexture = makeSpriteTexture(flowLabel, 'PR flow', pathColor, 260, 72);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, transparent: true, opacity: 0, depthWrite: false }));
    const labelPoint = curve.getPointAt(0.5);
    label.position.set(labelPoint.x, 2.1 + flowStrength * 0.5, labelPoint.z);
    label.scale.set(5.2, 1.45, 1);
    label.visible = source.repo.prs.length > 0 || flowStrength > 0.72;
    scene.add(label);

    roads.push({
      id: `${source.repo.id}-${target.repo.id}-${laneIndex}`,
      source: source.repo,
      target: target.repo,
      curve,
      mesh,
      cars,
      label,
      speed: 0.055 + flowStrength * 0.065 + (source.repo.stars % 7) * 0.003,
      phase: seededUnit(seed + 3.8),
      flowStrength,
      baseOpacity,
    });
  };

  DISTRICTS.forEach((district) => {
    const districtBuildings = buildingsByDistrict.get(district.key) ?? [];
    if (districtBuildings.length < 2) return;

    const activeBuildings = [...districtBuildings]
      .filter((building) => getOpenWorkItems(building.repo) > 0 || building.repo.prs.length > 0)
      .sort((a, b) => prFlowScore(b) - prFlowScore(a));
    const sourceCount = Math.min(5, Math.max(2, Math.ceil(activeBuildings.length / 9)));

    activeBuildings.slice(0, sourceCount).forEach((source, sourceIndex) => {
      const connectionCount = getOpenWorkItems(source.repo) > 280 || source.repo.prs.length > 0 ? 2 : 1;
      for (let connectionIndex = 0; connectionIndex < connectionCount; connectionIndex += 1) {
        const offset = Math.max(1, Math.floor(activeBuildings.length / (connectionIndex + 2)));
        let target = activeBuildings[(sourceIndex + offset + connectionIndex * 3) % activeBuildings.length];
        if (target === source) {
          target = activeBuildings.find((building) => building !== source) ?? districtBuildings.find((building) => building !== source) ?? source;
        }
        addRoad(source, target, connectionIndex);
      }
    });
  });

  const hubsByParent = new Map<string, BuildingObject[]>();
  DISTRICTS.forEach((district) => {
    const hub = [...(buildingsByDistrict.get(district.key) ?? [])]
      .filter((building) => getOpenWorkItems(building.repo) > 0)
      .sort((a, b) => prFlowScore(b) - prFlowScore(a))[0];
    if (!hub) return;
    const parentHubs = hubsByParent.get(district.parent) ?? [];
    parentHubs.push(hub);
    hubsByParent.set(district.parent, parentHubs);
  });

  hubsByParent.forEach((hubs) => {
    hubs.forEach((hub, hubIndex) => {
      const target = hubs[(hubIndex + 1) % hubs.length];
      if (target && target !== hub) addRoad(hub, target, hubIndex + 10, true);
    });
  });

  return roads;
}
