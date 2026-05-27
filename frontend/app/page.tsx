'use client';

import * as THREE from 'three';
import { Activity, Github, GitPullRequest, HelpCircle, Moon, RotateCcw, ShieldCheck, SlidersHorizontal, Sparkles, Star, Sun, TrendingUp, Users, X, ZoomIn, ZoomOut } from 'lucide-react';
import { FormEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent, type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';

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

type BackendPullRequest = {
  number?: number;
  title?: string;
  state?: string;
};

type BackendPrFlowSummary = {
  repoId: number;
  fullName?: string | null;
  available: boolean;
  openCount: number;
  mergedCount: number;
  closedCount: number;
  recentPullRequests?: BackendPullRequest[];
};

type BackendPrFlowResponse = {
  summaries?: Record<string, BackendPrFlowSummary>;
};

type Repo = {
  id: string;
  backendId?: number;
  backendDomain?: string;
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

type GraphClusterNode = {
  id?: string;
  name?: string;
  group?: string;
  nodeType?: string;
  repoCount?: number;
  stars?: number;
};

type GraphNode = GraphRepositoryNode | GraphClusterNode;

type GraphLink = {
  source?: string;
  target?: string;
  type?: string;
};

type GraphFullResponse = {
  nodes?: GraphNode[];
  links?: GraphLink[];
  meta?: {
    groupBy?: string;
  };
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
  // Functional districts laid out as a fixed-perspective contribution atlas.
  { key: 'skyline_core', label: 'Core Platforms', color: '#5d8dff', accent: '#c7ddff', x: -150, z: -188, shape: 'spires', parent: 'systems' },
  { key: 'vertical_arcology', label: 'Frontend Frameworks', color: '#8fba70', accent: '#f4ffd2', x: 50, z: -165, shape: 'megatowers', parent: 'web' },
  { key: 'volcano_forge', label: 'Cloud Infrastructure', color: '#f97316', accent: '#ffd2a0', x: 248, z: -135, shape: 'lava_foundries', parent: 'infra' },
  { key: 'redwood_archive', label: 'Security + Auth', color: '#4f9b67', accent: '#d6f9c9', x: -286, z: -18, shape: 'redwood_towers', parent: 'infra' },
  { key: 'financial_district', label: 'Data Platforms', color: '#e6bd63', accent: '#fff1c2', x: -88, z: 6, shape: 'blocks', parent: 'infra' },
  { key: 'forest_repository', label: 'Databases + Cache', color: '#3fbf84', accent: '#c9ffd9', x: 70, z: 24, shape: 'giant_trees', parent: 'infra' },
  { key: 'crystal_fields', label: 'AI + ML', color: '#a076ff', accent: '#f4dbff', x: 188, z: 52, shape: 'crystal_spires', parent: 'ai' },
  { key: 'frozen_kingdom', label: 'Distributed Systems', color: '#8bd3ff', accent: '#f2fbff', x: 288, z: 152, shape: 'caves', parent: 'infra' },
  { key: 'nomad_camps', label: 'Testing + QA', color: '#d6aa70', accent: '#fff0c8', x: -292, z: 152, shape: 'tents', parent: 'devtools' },
  { key: 'floating_island', label: 'DevOps + Delivery', color: '#62c8a4', accent: '#e1fff1', x: -92, z: 186, shape: 'floating_stations', parent: 'ai' },
  { key: 'ruined_empire', label: 'Kernels + OS', color: '#9d5cff', accent: '#efd7ff', x: 68, z: 212, shape: 'ruins', parent: 'systems' },
  { key: 'canyon_networks', label: 'APIs + Networking', color: '#42d8ff', accent: '#d7fbff', x: 214, z: 222, shape: 'holographic', parent: 'infra' },
  { key: 'clockwork_empire', label: 'Rust + Runtimes', color: '#ff6b8b', accent: '#ffd0da', x: -245, z: -122, shape: 'factories', parent: 'systems' },
  { key: 'mountain_citadel', label: 'Compilers + Languages', color: '#f43f5e', accent: '#ffd1dc', x: -20, z: -82, shape: 'citadel', parent: 'systems' },
  { key: 'brick_boroughs', label: 'UI Libraries', color: '#60a5fa', accent: '#d7e9ff', x: -160, z: 82, shape: 'apartments', parent: 'web' },
  { key: 'neon_alley', label: 'Web Apps + SaaS', color: '#06b6d4', accent: '#c7fbff', x: 152, z: -52, shape: 'glass', parent: 'web' },
  { key: 'tech_suburbs', label: 'CSS + Design Systems', color: '#0ea5e9', accent: '#bfeeff', x: -216, z: 78, shape: 'suburbs', parent: 'web' },
  { key: 'coastal_fishing', label: 'Static Sites', color: '#2563eb', accent: '#d7e7ff', x: -210, z: 236, shape: 'fishing_docks', parent: 'web' },
  { key: 'ether_realm', label: 'Agents + LLMs', color: '#a78bfa', accent: '#efe7ff', x: 28, z: -248, shape: 'holographic', parent: 'ai' },
  { key: 'bamboo_valley', label: 'Developer Tools', color: '#10b981', accent: '#d4fff0', x: 270, z: 26, shape: 'bamboo_pagodas', parent: 'devtools' },
  { key: 'valley_villages', label: 'Starter Projects', color: '#34d399', accent: '#e1fff3', x: -18, z: 114, shape: 'valley_villages', parent: 'devtools' },
  { key: 'corruption_wasteland', color: '#d946ef', accent: '#f5d0fe', label: 'Code Security', x: 136, z: 152, shape: 'decayed', parent: 'infra' },
  { key: 'overgrown_ruins', label: 'Embedded + IoT', color: '#22c55e', accent: '#dbffdf', x: -322, z: 62, shape: 'overgrown', parent: 'infra' },
  { key: 'jungle_canopy', label: 'Cloud Platforms', color: '#44b36a', accent: '#edffe6', x: -38, z: 270, shape: 'mushroom_colonies', parent: 'infra' },
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
    responseHours: (() => {
      let hours = 72;
      if (commitsPerWeek > 30) hours = 4;
      else if (commitsPerWeek > 15) hours = 12;
      else if (commitsPerWeek > 5) hours = 24;
      else if (commitsPerWeek > 0) hours = 48;
      if (openIssues > 500) hours *= 1.5;
      return Math.max(1, Math.round(hours));
    })(),
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

function isGraphClusterNode(node: GraphNode): node is GraphClusterNode {
  return node.nodeType === 'cluster';
}

function backendRepoIdFromGraphNode(node: GraphRepositoryNode) {
  const match = /^repo_(\d+)$/.exec(node.id ?? '');
  return match ? Number(match[1]) : undefined;
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
  const backendId = backendRepoIdFromGraphNode(node);
  const topics = node.topics ?? [];
  const stars = node.stars ?? 0;
  const openIssues = node.openIssues ?? node.openPRs ?? 0;
  const openPRs = node.openPRs ?? openIssues;
  const contributors = Math.max(node.contributorsCount ?? 0, Math.round(Math.sqrt(Math.max(1, stars)) * 2));
  const hasStarterSignals = Boolean(node.isBeginnerFriendly) || topics.some((topic) => ['good-first-issue', 'good-first-issues', 'help-wanted', 'documentation'].includes(topic.toLowerCase()));
  const safetyProfile = safetyProfileFromGraphNode(node);

  const repo: Repo = {
    id: fullName.toLowerCase(),
    backendId,
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
    responseHours: (() => {
      const commits = commitsPerWeekFromDate(node.pushedAt ?? node.updatedAt);
      const issues = node.openIssues ?? 0;
      let hours = 72;
      if (commits > 30) hours = 4;
      else if (commits > 15) hours = 12;
      else if (commits > 5) hours = 24;
      else if (commits > 0) hours = 48;
      if (issues > 500) hours *= 1.5;
      return Math.max(1, Math.round(hours));
    })(),
    topics,
    prs: [],
    issueTemplates: hasStarterSignals,
    smallScopedIssues: hasStarterSignals || openIssues > 0,
    license: node.license || undefined,
    manageableLocalDev: contributors < 1800,
  };

  return safetyProfile ? applySafetyProfile(repo, safetyProfile) : enrichRepoSafety(repo);
}

function pullRequestsFromBackendSummary(summary: BackendPrFlowSummary): PullRequest[] {
  return (summary.recentPullRequests ?? []).slice(0, 6).map((pull, index) => {
    const state = pull.state?.toLowerCase();
    return {
      number: pull.number ?? index + 1,
      title: pull.title || 'Recent pull request',
      priority: state === 'open' ? 'hot' : state === 'merged' ? 'normal' : 'quiet',
    };
  });
}

function applyBackendPrFlow(repo: Repo, summary?: BackendPrFlowSummary): Repo {
  if (!summary?.available) return repo;
  const prs = pullRequestsFromBackendSummary(summary);
  return {
    ...repo,
    openPRs: Math.max(repo.openPRs, summary.openCount),
    prs: prs.length ? prs : repo.prs,
  };
}

function enrichReposWithBackendDomains(
  repos: Repo[],
  nodes: GraphNode[] = [],
  links: GraphLink[] = [],
) {
  const clusterById = new Map(
    nodes
      .filter(isGraphClusterNode)
      .filter((node) => Boolean(node.id))
      .map((node) => [node.id as string, node]),
  );

  if (!clusterById.size || !links.length) return repos;

  const domainByRepoNodeId = new Map<string, string>();
  for (const link of links) {
    const source = String(link.source ?? '');
    const target = String(link.target ?? '');
    if (!source || !target || !target.startsWith('repo_')) continue;
    const cluster = clusterById.get(source);
    if (!cluster?.name) continue;
    if (link.type && !link.type.startsWith('grouped_by_')) continue;
    domainByRepoNodeId.set(target, cluster.name);
  }

  if (!domainByRepoNodeId.size) return repos;

  return repos.map((repo) => {
    const domain = repo.backendId ? domainByRepoNodeId.get(`repo_${repo.backendId}`) : undefined;
    return domain ? { ...repo, backendDomain: domain } : repo;
  });
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

const INTRO_MS = 1200;
const ENTRY_MS = 1000;
const CAMERA_HOME = new THREE.Vector3(0, 215, 390);
const TARGET_HOME = new THREE.Vector3(0, 8, 38);
const MIN_ZOOM = 0.58;
const MAX_ZOOM = 1.42;
const SCENE_PIXEL_RATIO = 1.15;
const VISUAL_REPOS_PER_DISTRICT = 34;
const FEATURED_DISTRICT_KEYS = new Set<DistrictKey>([
  'skyline_core',
  'vertical_arcology',
  'volcano_forge',
  'redwood_archive',
  'financial_district',
  'forest_repository',
  'crystal_fields',
  'frozen_kingdom',
  'nomad_camps',
  'floating_island',
  'ruined_empire',
  'canyon_networks',
]);

const ATLAS_DISTRICT_POSITIONS: Partial<Record<DistrictKey, { left: number; top: number }>> = {
  skyline_core: { left: 34.8, top: 11.7 },
  vertical_arcology: { left: 54.8, top: 15.0 },
  volcano_forge: { left: 70.7, top: 17.8 },
  redwood_archive: { left: 13.8, top: 34.6 },
  financial_district: { left: 34.9, top: 35.0 },
  forest_repository: { left: 50.9, top: 39.0 },
  crystal_fields: { left: 67.1, top: 37.4 },
  frozen_kingdom: { left: 84.5, top: 62.8 },
  nomad_camps: { left: 15.1, top: 65.2 },
  floating_island: { left: 28.2, top: 90.0 },
  ruined_empire: { left: 53.2, top: 90.2 },
  canyon_networks: { left: 79.4, top: 88.0 },
};
const ATLAS_AMBIENT_COLUMNS = [7, 21, 35, 49, 63, 77, 91];
const ATLAS_AMBIENT_ROWS = [12, 30, 48, 66, 84];
const ATLAS_AMBIENT_KINDS = ['standard', 'safe', 'activity', 'community', 'pr', 'landmark'] as const;
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

function roundTo(value: number, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
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

function buildDistrictLabelOverrides(repos: Repo[]) {
  const weights = new Map<DistrictKey, Map<string, number>>();

  repos.forEach((repo) => {
    const domain = repo.backendDomain?.trim();
    if (!domain) return;
    const domainWeights = weights.get(repo.district) ?? new Map<string, number>();
    const domainWeight = 1 + Math.log10(repo.stars + 10) + getOpenWorkItems(repo) * 0.015;
    domainWeights.set(domain, (domainWeights.get(domain) ?? 0) + domainWeight);
    weights.set(repo.district, domainWeights);
  });

  const overrides: Partial<Record<DistrictKey, string>> = {};
  weights.forEach((domainWeights, districtKey) => {
    const [topDomain] = Array.from(domainWeights.entries()).sort((a, b) => b[1] - a[1])[0] ?? [];
    if (!topDomain) return;
    const cleaned = topDomain.replace(/\s+/g, ' ').trim();
    if (cleaned.length) overrides[districtKey] = cleaned;
  });

  return overrides;
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
  if (repo.backendDomain) return `${repo.backendDomain.toLowerCase()} repo`;
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
  const seed = repo.id.split('').reduce((total, char) => total + char.charCodeAt(0), 0) + index * 17.7;
  const angle = index * 2.399963 + seededUnit(seed) * 0.55;
  const radius = 4.5 + Math.sqrt(index + 1) * 4.15 + seededUnit(seed + 2) * 3.4;
  const isTallDistrict = ['spires', 'megatowers', 'vertical_arcology', 'glass'].includes(district.shape);
  const x = district.x + Math.cos(angle) * radius * (isTallDistrict ? 0.82 : 1.08);
  const z = district.z + Math.sin(angle) * radius * 0.78 + Math.cos(index * 1.13) * 1.2;

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
  const districtHeroBoost = FEATURED_DISTRICT_KEYS.has(district.key) ? 1.22 : 0.86;
  const height = clamp(1.35 + Math.pow(scaleDriver, 4.15) * 78 * heightBias * districtHeroBoost + Math.pow(scale.activity, 2.4) * 1.15, 1.65, 82);
  const widthBias =
    district.shape === 'blocks' || district.shape === 'apartments' || district.shape === 'valley_villages' ? 1.28 :
    district.shape === 'glass' || district.shape === 'crystal_spires' ? 0.92 :
    district.shape === 'spires' || district.shape === 'citadel' ? 0.84 :
    1;
  const width = clamp(1.25 + Math.pow(scale.forks, 1.65) * 3.75 + Math.pow(scale.activity, 1.45) * 0.4, 1.35, 5.9) * widthBias;
  const depth = clamp(1.3 + Math.pow(scale.community, 1.65) * 3.65 + Math.pow(scale.beginnerSurface, 1.35) * 0.42, 1.45, 6.1) * (district.shape === 'blocks' ? 1.1 : 1);

  return {
    position: new THREE.Vector3(x, 0, z),
    height,
    width,
    depth,
  };
}

function createSiftRenderer() {
  const rendererOptions: THREE.WebGLRendererParameters[] = [
    { antialias: false, alpha: true, powerPreference: 'high-performance' },
    { antialias: false, alpha: true, powerPreference: 'default' },
    { antialias: false, alpha: true, powerPreference: 'low-power' },
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
    alpha: true,
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
    alpha: true,
    logarithmicDepthBuffer: true,
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
  refs.scene.background = new THREE.Color(isDay ? '#9fc7f8' : '#050a18');
  refs.renderer.setClearColor(isDay ? 0x9fc7f8 : 0x050a18, 1);
  refs.scene.fog = new THREE.FogExp2(isDay ? '#8eb1de' : '#090f24', isDay ? 0.00105 : 0.00145);
  refs.renderer.toneMappingExposure = isDay ? 1.14 : 1.2;
  refs.ambient.color.set(isDay ? '#d8e9ff' : '#8aa7ff');
  refs.ambient.intensity = isDay ? 1.18 : 1.26;
  refs.key.color.set(isDay ? '#ffe7bf' : '#a8ccff');
  refs.key.intensity = isDay ? 3.4 : 3.25;
  refs.rim.color.set(isDay ? '#6fd2ff' : '#9a6bff');
  refs.rim.intensity = isDay ? 44 : 92;

  refs.scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    const role = mesh.userData.role;
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (!material) return;

    if (role === 'ground') {
      const groundMaterial = material as THREE.MeshBasicMaterial;
      groundMaterial.color.set(isDay ? '#b9c8c1' : '#324868');
      groundMaterial.transparent = true;
      groundMaterial.opacity = isDay ? 0.54 : 0.56;
    }

    if (role === 'grid') setMaterialOpacity(material, isDay ? 0.046 : 0.065);
    if (role === 'stars') setMaterialOpacity(material, isDay ? 0.015 : 0.33);
    if (role === 'moon') setMaterialOpacity(material, isDay ? 0.03 : 0.1);
    if (role === 'district-plane') setMaterialOpacity(material, isDay ? 0.1 : 0.15);
    if (role === 'sky-dome') setMaterialOpacity(material, isDay ? 0.7 : 1);
    if (role === 'clouds') setMaterialOpacity(material, isDay ? 0.18 : 0.3);
    if (role === 'clouds-low') setMaterialOpacity(material, isDay ? 0.1 : 0.18);
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

function atlasPositionForDistrict(district: District) {
  const atlasPosition = ATLAS_DISTRICT_POSITIONS[district.key];
  if (atlasPosition) return atlasPosition;

  return {
    left: clamp(50 + district.x / 7.1, 6, 68),
    top: clamp(48 + district.z / 7.4, 12, 86),
  };
}

function atlasViewForDistrict(district: District) {
  return {
    x: clamp(-district.x * 0.92, -420, 420),
    y: clamp(-district.z * 0.56, -320, 320),
    scale: 1.18,
  };
}

function repoBuildingKind(repo: Repo) {
  if (isGreenSafety(repo.safetyScore) && repo.goodFirstIssues > 0) return 'safe';
  if (getOpenWorkItems(repo) >= 50 || repo.prs.length >= 2) return 'pr';
  if (repo.stars >= HIGH_DETAIL_REPO_STARS) return 'landmark';
  if (repo.contributors >= 100 || repo.forks >= 5000) return 'community';
  if (repo.commitsPerWeek >= 80) return 'activity';
  return 'standard';
}

function atlasBiomeForDistrict(district: District) {
  if (['spires', 'megatowers', 'citadel', 'glass', 'apartments'].includes(district.shape)) return 'city';
  if (['lava_foundries', 'factories', 'decayed'].includes(district.shape)) return 'forge';
  if (['giant_trees', 'redwood_towers', 'overgrown', 'mushroom_colonies', 'bamboo_pagodas'].includes(district.shape)) return 'green';
  if (['crystal_spires', 'caves', 'holographic'].includes(district.shape) || district.parent === 'ai') return 'signal';
  if (['fishing_docks', 'floating_stations', 'canyon_forts'].includes(district.shape)) return 'water';
  return 'field';
}

function atlasTerrainKindForBiome(biome: string) {
  if (biome === 'signal') return 'crystal';
  if (biome === 'field') return 'city';
  return biome;
}

function atlasMapTileKindForBiome(biome: string) {
  if (['city', 'forge', 'green', 'signal', 'water'].includes(biome)) return biome;
  return 'city';
}

function ambientBuildingKind(seed: number) {
  return ATLAS_AMBIENT_KINDS[Math.floor(seededUnit(seed) * ATLAS_AMBIENT_KINDS.length)];
}

function atlasRegionScale(repoCount: number) {
  return roundTo(clamp(0.72 + Math.log10(repoCount + 1) * 0.28, 0.78, 1.42), 3);
}

function atlasStructureCount(repoCount: number) {
  return clamp(Math.ceil(Math.log2(repoCount + 2)) + 1, 4, 9);
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
          const reposWithDomains = enrichReposWithBackendDomains(mappedRepos, data.nodes, data.links);

          if (!reposWithDomains.length) throw new Error('Graph response contained no repositories');
          if (!cancelled) {
            setRepos(reposWithDomains);
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

  useEffect(() => {
    const backendRepos = [...repos]
      .filter((repo): repo is Repo & { backendId: number } => typeof repo.backendId === 'number')
      .sort((a, b) => (getOpenWorkItems(b) + b.stars * 0.0004) - (getOpenWorkItems(a) + a.stars * 0.0004))
      .slice(0, 24);

    if (!backendRepos.length) {
      setBackendPrFlow({});
      return undefined;
    }

    let cancelled = false;

    (async () => {
      try {
        const response = await fetch('/api/py/pr-flow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repoIds: backendRepos.map((repo) => repo.backendId), days: 30 }),
        });
        if (!response.ok) throw new Error(`PR flow failed with ${response.status}`);
        const payload = await response.json() as BackendPrFlowResponse;
        if (cancelled) return;

        const repoByBackendId = new Map(backendRepos.map((repo) => [repo.backendId, repo]));
        const nextFlow: Record<string, BackendPrFlowSummary> = {};
        Object.values(payload.summaries ?? {}).forEach((summary) => {
          const repo = repoByBackendId.get(summary.repoId);
          if (repo) nextFlow[repo.id] = summary;
        });
        setBackendPrFlow(nextFlow);
      } catch (error) {
        console.warn('[SIFT PR flow] Backend PR roads are using graph open-work fallbacks:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [repos]);

  const mountRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SceneRefs | null>(null);
  const enteredRef = useRef(true);
  const filterRef = useRef<FilterKey>('all');
  const appearanceRef = useRef<Appearance>('night');
  const selectedRef = useRef<Repo | null>(null);
  const hoverRef = useRef<Repo | null>(null);
  const similarDistrictRef = useRef<DistrictKey | null>(null);
  const similarUntilRef = useRef(0);

  const [entered, setEntered] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [appearance, setAppearance] = useState<Appearance>('night');
  const [heightScaleDriver, setHeightScaleDriver] = useState<HeightScaleDriver>('stars');
  const [zoomValue, setZoomValue] = useState(1);
  const [atlasView, setAtlasView] = useState({ x: 0, y: 0, scale: 1 });
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const targetDistrictCenterRef = useRef<{ x: number; z: number } | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [query, setQuery] = useState('');
  const [hoveredRepo, setHoveredRepo] = useState<Repo | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [stats, setStats] = useState({ repos: 0, prs: 0, safe: 0 });
  const [safetyProfiles, setSafetyProfiles] = useState<Record<string, SafetyProfile>>({});
  const [backendPrFlow, setBackendPrFlow] = useState<Record<string, BackendPrFlowSummary>>({});
  const [rendererRetryToken, setRendererRetryToken] = useState(0);
  const atlasDragRef = useRef({
    active: false,
    didDrag: false,
    endedAt: 0,
    pointerId: -1,
    suppressClick: false,
    x: 0,
    y: 0,
  });

  const allRepos = useMemo(() => {
    const importedIds = new Set(loadedRepos.map((repo) => repo.id));
    return [...loadedRepos, ...repos.filter((repo) => !importedIds.has(repo.id))];
  }, [loadedRepos, repos]);

  const effectiveRepos = useMemo(() => {
    return allRepos.map((repo) => {
      const scoredRepo = applySafetyProfile(repo, safetyProfiles[repo.id] ?? repo.safetyProfile);
      return applyBackendPrFlow(scoredRepo, backendPrFlow[repo.id]);
    });
  }, [allRepos, backendPrFlow, safetyProfiles]);
  const districtLabelOverrides = useMemo(
    () => buildDistrictLabelOverrides(effectiveRepos),
    [effectiveRepos],
  );
  const districtLabelForKey = (districtKey: DistrictKey) => {
    const district = DISTRICTS.find((item) => item.key === districtKey);
    if (!district) return districtKey;
    return districtLabelOverrides[districtKey] ?? district.label;
  };
  const districtLabelForRepo = (repo: Repo) => districtLabelForKey(repo.district);

  const reposByDistrict = useMemo(() => {
    return DISTRICTS.map((district) => ({
      district,
      repos: effectiveRepos.filter((repo) => repo.district === district.key),
    }));
  }, [effectiveRepos]);
  const featuredDistricts = useMemo(() => {
    return reposByDistrict
      .filter(({ district, repos }) => FEATURED_DISTRICT_KEYS.has(district.key) && repos.length > 0)
      .map(({ district, repos }) => ({
        district,
        repoCount: repos.length,
        topRepo: [...repos].sort((a, b) => b.stars - a.stars)[0],
        position: atlasPositionForDistrict(district),
      }));
  }, [reposByDistrict]);
  const visualReposByDistrict = useMemo(() => {
    return reposByDistrict.map(({ district, repos }) => {
      const mustShowIds = new Set(
        [selectedRepo, ...loadedRepos]
          .filter((repo): repo is Repo => Boolean(repo) && repo.district === district.key)
          .map((repo) => repo.id),
      );
      const ranked = [...repos].sort(
        (a, b) => (b.stars + getOpenWorkItems(b) * 18 + b.contributors * 0.8) - (a.stars + getOpenWorkItems(a) * 18 + a.contributors * 0.8),
      );
      const visible = ranked.filter((repo, index) => index < VISUAL_REPOS_PER_DISTRICT || mustShowIds.has(repo.id));
      return { district, repos: visible };
    });
  }, [loadedRepos, reposByDistrict, selectedRepo]);
  const atlasRepoMarkers = useMemo(() => {
    return visualReposByDistrict.flatMap(({ district, repos }) => {
      const districtPosition = atlasPositionForDistrict(district);
      const isTallDistrict = ['spires', 'megatowers', 'vertical_arcology', 'glass', 'crystal_spires'].includes(district.shape);
      const featured = FEATURED_DISTRICT_KEYS.has(district.key);
      const markerLimit = clamp(
        Math.round((featured ? 20 : 8) + Math.log10(repos.length + 1) * (featured ? 9 : 4)),
        featured ? 24 : 8,
        featured ? 36 : 14,
      );

      return repos.slice(0, markerLimit).map((repo, index) => {
        const scale = repoScale(repo);
        const seed = repoDetailSeed(repo) + index * 9.71;
        const angle = index * 2.399963 + seededUnit(seed) * 0.9;
        const districtBand = Math.floor(index / 18);
        const ring = 0.5 + Math.sqrt(index + 1) * 0.5 + districtBand * 1.2 + seededUnit(seed + 1.7) * 0.62;
        const spreadX = isTallDistrict ? 2.85 : 3.95;
        const spreadY = isTallDistrict ? 2.55 : 3.25;
        const height = clamp(12 + Math.pow(scale.stars, 1.85) * 46 + Math.pow(scale.activity, 1.4) * 10, 13, isTallDistrict ? 74 : 48);
        const width = clamp(8 + Math.pow(scale.forks, 1.2) * 13, 8, 22);

        return {
          repo,
          district,
          left: roundTo(clamp(districtPosition.left + Math.cos(angle) * ring * spreadX, 1, 99)),
          top: roundTo(clamp(districtPosition.top + Math.sin(angle) * ring * spreadY + seededUnit(seed + 3.3) * 1.9, 3, 97)),
          height: roundTo(height),
          width: roundTo(width),
          delay: `${(seededUnit(seed + 4.8) * -3.2).toFixed(2)}s`,
          biome: atlasBiomeForDistrict(district),
          kind: repoBuildingKind(repo),
        };
      });
    });
  }, [visualReposByDistrict]);
  const atlasAmbientMarkers = useMemo(() => {
    const districtOutskirts = reposByDistrict.flatMap(({ district, repos }, districtIndex) => {
      if (!repos.length) return [];

      const position = atlasPositionForDistrict(district);
      const biome = atlasBiomeForDistrict(district);
      const featured = FEATURED_DISTRICT_KEYS.has(district.key);
      if (!featured && repos.length < 20) return [];
      const count = clamp(
        Math.round((featured ? 5 : 1) + Math.sqrt(repos.length) * (featured ? 0.56 : 0.14)),
        featured ? 7 : 1,
        featured ? 11 : 2,
      );

      return Array.from({ length: count }, (_, index) => {
        const seed = districtIndex * 97.13 + index * 13.71 + repos.length * 0.17;
        const ring = 1.9 + Math.sqrt(index + 1) * (featured ? 0.82 : 0.58) + Math.floor(index / 16) * 1.8;
        const angle = index * 2.399963 + seededUnit(seed + 1.1) * 1.24;
        const width = clamp(8 + seededUnit(seed + 2.3) * (featured ? 16 : 11), 7, featured ? 24 : 17);
        const height = clamp(width * (1.65 + seededUnit(seed + 3.4) * 2.5), 15, featured ? 88 : 54);

        return {
          id: `${district.key}-ambient-${index}`,
          left: roundTo(clamp(position.left + Math.cos(angle) * ring * (featured ? 2.9 : 2.3), 1, 99)),
          top: roundTo(clamp(position.top + Math.sin(angle) * ring * (featured ? 2.45 : 2.05), 3, 97)),
          width: roundTo(width),
          height: roundTo(height),
          delay: `${(seededUnit(seed + 4.5) * -5.6).toFixed(2)}s`,
          biome,
          kind: ambientBuildingKind(seed + 5.8),
          color: district.color,
          accent: district.accent,
          scale: roundTo(clamp(0.35 + seededUnit(seed + 6.4) * (featured ? 0.4 : 0.26), 0.3, featured ? 0.82 : 0.58), 3),
          opacity: roundTo(clamp(0.22 + seededUnit(seed + 7.1) * (featured ? 0.34 : 0.22), 0.18, featured ? 0.66 : 0.44), 3),
        };
      });
    });

    const gridOutposts = ATLAS_AMBIENT_ROWS.flatMap((row, rowIndex) => (
      ATLAS_AMBIENT_COLUMNS.map((column, columnIndex) => {
        const seed = 500 + rowIndex * 83.7 + columnIndex * 47.3;
        const nearest = featuredDistricts.length
          ? featuredDistricts.reduce((best, candidate) => {
            const bestDistance = Math.hypot(best.position.left - column, best.position.top - row);
            const candidateDistance = Math.hypot(candidate.position.left - column, candidate.position.top - row);
            return candidateDistance < bestDistance ? candidate : best;
          }, featuredDistricts[0])
          : {
            district: DISTRICTS[0],
            position: atlasPositionForDistrict(DISTRICTS[0]),
          };
        const distance = Math.hypot(nearest.position.left - column, nearest.position.top - row);
        const biome = atlasBiomeForDistrict(nearest.district);
        const majorRoadCrossing = rowIndex % 3 === 0 || columnIndex % 4 === 0;
        const width = clamp(6 + seededUnit(seed + 1.1) * (majorRoadCrossing ? 12 : 8), 5, majorRoadCrossing ? 18 : 14);
        const height = clamp(width * (1.5 + seededUnit(seed + 1.9) * 2.1), 11, majorRoadCrossing ? 58 : 42);

        return {
          id: `tile-outpost-${rowIndex}-${columnIndex}`,
          left: roundTo(clamp(column + (seededUnit(seed + 2.6) - 0.5) * 5.4, 0.5, 99.5)),
          top: roundTo(clamp(row + (seededUnit(seed + 3.2) - 0.5) * 4.6, 2.5, 97.5)),
          width: roundTo(width),
          height: roundTo(height),
          delay: `${(seededUnit(seed + 4.8) * -6.4).toFixed(2)}s`,
          biome,
          kind: majorRoadCrossing ? ambientBuildingKind(seed + 9.3) : ambientBuildingKind(seed + 5.8),
          color: nearest.district.color,
          accent: nearest.district.accent,
          scale: roundTo(clamp(0.24 + seededUnit(seed + 6.2) * 0.28 + Math.max(0, 16 - distance) * 0.012, 0.22, 0.62), 3),
          opacity: roundTo(clamp(0.16 + seededUnit(seed + 7.4) * 0.2 + Math.max(0, 20 - distance) * 0.008, 0.14, 0.46), 3),
        };
      })
    ));

    return [...gridOutposts, ...districtOutskirts];
  }, [featuredDistricts, reposByDistrict]);
  const atlasCityPlates = useMemo(() => {
    return featuredDistricts.flatMap(({ district, repoCount, topRepo, position }, index) => {
      const biome = atlasMapTileKindForBiome(atlasBiomeForDistrict(district));
      const baseScale = atlasRegionScale(repoCount);
      const seed = index * 41.37 + repoCount * 0.29 + position.left * 0.17 + position.top * 0.11;
      const active =
        filter === 'all' ||
        filter === district.key ||
        filter === district.parent ||
        (filter === 'safe' && Boolean(topRepo && isGreenSafety(topRepo.safetyScore))) ||
        (filter === 'stars' && (topRepo?.stars ?? 0) >= 10000);
      const plates = [{
        id: `${district.key}-city-core`,
        left: roundTo(clamp(position.left + (seededUnit(seed + 0.6) - 0.5) * 2.8, -6, 106)),
        top: roundTo(clamp(position.top + (seededUnit(seed + 1.3) - 0.5) * 2.2 + 1.1, -6, 106)),
        size: Math.round(clamp(390 + baseScale * 132 + Math.log10(repoCount + 1) * 74, 480, 690)),
        rotation: roundTo(-18 + (seededUnit(seed + 2.1) - 0.5) * 10, 2),
        opacity: roundTo(clamp(0.38 + Math.log10(repoCount + 1) * 0.035, 0.38, 0.54), 3),
        scale: 1,
        biome,
        color: district.color,
        accent: district.accent,
        active,
      }];
      const satelliteCount = clamp(Math.round(1 + Math.log10(repoCount + 1) * 1.25), 2, 4);

      for (let tileIndex = 0; tileIndex < satelliteCount; tileIndex += 1) {
        const tileSeed = seed + 17.3 + tileIndex * 9.19;
        const angle = tileIndex * 2.399963 + seededUnit(tileSeed + 0.2) * 0.72;
        const distance = 5.4 + Math.sqrt(tileIndex + 1) * 3.9 + seededUnit(tileSeed + 1.1) * 3.2;
        const accentBiome = tileIndex % 5 === 3 && biome !== 'green' ? 'green' : tileIndex % 5 === 4 && biome !== 'water' ? 'water' : biome;

        plates.push({
          id: `${district.key}-city-satellite-${tileIndex}`,
          left: roundTo(clamp(position.left + Math.cos(angle) * distance, -9, 109)),
          top: roundTo(clamp(position.top + Math.sin(angle) * distance * 0.74, -8, 108)),
          size: Math.round(clamp(270 + baseScale * 82 + seededUnit(tileSeed + 2.3) * 84, 300, 470)),
          rotation: roundTo(-20 + (seededUnit(tileSeed + 3.4) - 0.5) * 22, 2),
          opacity: roundTo(clamp(0.18 + seededUnit(tileSeed + 4.5) * 0.13, 0.18, 0.32), 3),
          scale: roundTo(clamp(0.72 + seededUnit(tileSeed + 5.6) * 0.18, 0.72, 0.9), 3),
          biome: accentBiome,
          color: district.color,
          accent: district.accent,
          active,
        });
      }

      return plates;
    });
  }, [featuredDistricts, filter]);
  const atlasTerrainTiles = useMemo(() => {
    return featuredDistricts.flatMap(({ district, repoCount, position }, index) => {
      const biome = atlasBiomeForDistrict(district);
      const primaryKind = atlasTerrainKindForBiome(biome);
      const seed = index * 19.71 + position.left * 0.53 + position.top * 0.79;
      const baseScale = atlasRegionScale(repoCount);
      const tiles = [
        {
          id: `${district.key}-terrain-primary`,
          kind: primaryKind,
          variant: Math.floor(seededUnit(seed + 1.2) * 10),
          left: roundTo(clamp(position.left + (seededUnit(seed + 2.1) - 0.5) * 4.2, -2, 102)),
          top: roundTo(clamp(position.top + (seededUnit(seed + 3.1) - 0.5) * 3.8 + 1.2, 0, 102)),
          scale: roundTo(clamp(baseScale * (0.58 + seededUnit(seed + 4.3) * 0.14), 0.48, 1.05), 3),
          rotation: roundTo(-18 + (seededUnit(seed + 5.6) - 0.5) * 14, 2),
          opacity: 0.44,
          accent: false,
        },
      ];

      const districtTileCount = clamp(Math.round(2 + Math.log10(repoCount + 1) * 2.4), 4, 9);
      for (let tileIndex = 0; tileIndex < districtTileCount; tileIndex += 1) {
        const tileSeed = seed + 20 + tileIndex * 8.37;
        const angle = tileIndex * 2.399963 + seededUnit(tileSeed + 0.5) * 0.82;
        const distance = 4.8 + Math.sqrt(tileIndex + 1) * 3.2 + seededUnit(tileSeed + 1.6) * 2.9;
        tiles.push({
          id: `${district.key}-terrain-outskirt-${tileIndex}`,
          kind: tileIndex % 4 === 0 && biome !== 'water' ? 'city' : tileIndex % 5 === 0 && biome !== 'green' ? 'green' : primaryKind,
          variant: (Math.floor(seededUnit(tileSeed + 2.4) * 10) + tileIndex) % 10,
          left: roundTo(clamp(position.left + Math.cos(angle) * distance, -5, 105)),
          top: roundTo(clamp(position.top + Math.sin(angle) * distance * 0.72, -2, 105)),
          scale: roundTo(clamp(baseScale * (0.28 + seededUnit(tileSeed + 3.5) * 0.26), 0.24, 0.66), 3),
          rotation: roundTo(-18 + (seededUnit(tileSeed + 4.6) - 0.5) * 28, 2),
          opacity: roundTo(clamp(0.16 + seededUnit(tileSeed + 5.7) * 0.2, 0.14, 0.34), 3),
          accent: true,
        });
      }

      if (index % 2 === 0 && biome !== 'forge') {
        tiles.push({
          id: `${district.key}-terrain-water`,
          kind: 'water',
          variant: (index * 3 + 1) % 10,
          left: roundTo(clamp(position.left - 4.8 + seededUnit(seed + 6.4) * 3.2, -4, 104)),
          top: roundTo(clamp(position.top + 6.2 + seededUnit(seed + 7.4) * 3.8, 0, 104)),
          scale: roundTo(clamp(baseScale * 0.44, 0.34, 0.72), 3),
          rotation: roundTo(-22 + seededUnit(seed + 8.4) * 22, 2),
          opacity: 0.34,
          accent: true,
        });
      }

      if (index % 3 === 1 && biome !== 'green' && biome !== 'water') {
        tiles.push({
          id: `${district.key}-terrain-green`,
          kind: 'green',
          variant: (index * 5 + 2) % 10,
          left: roundTo(clamp(position.left + 5.2 - seededUnit(seed + 9.5) * 4.4, -4, 104)),
          top: roundTo(clamp(position.top + 3.8 - seededUnit(seed + 10.5) * 4.6, 0, 104)),
          scale: roundTo(clamp(baseScale * 0.38, 0.32, 0.66), 3),
          rotation: roundTo(-20 + seededUnit(seed + 11.5) * 24, 2),
          opacity: 0.3,
          accent: true,
        });
      }

      return tiles;
    });
  }, [featuredDistricts]);
  const searchResults = useMemo(() => searchRepos(query, effectiveRepos), [query, effectiveRepos]);
  const safetyReasons = useMemo(() => (selectedRepo ? getSafetyReasons(selectedRepo) : []), [selectedRepo]);
  const loadedTodayRepos = useMemo(() => {
    const today = new Date().toDateString();
    return loadedRepos.filter((repo) => repo.loadedAt && new Date(repo.loadedAt).toDateString() === today).slice(0, 4);
  }, [loadedRepos]);
  const highStarTrending = useMemo(() => {
    // Sort by recent velocity: commitsPerWeek heavily weighted, plus base stars
    return [...effectiveRepos].sort((a, b) => (b.commitsPerWeek * 100 + b.stars * 0.01) - (a.commitsPerWeek * 100 + a.stars * 0.01)).slice(0, 3);
  }, [effectiveRepos]);
  const lowStarPromising = useMemo(() => {
    return [...effectiveRepos]
      .filter((repo) => repo.stars < 10000)
      .sort((a, b) => (b.goodFirstIssues * 12 + b.safetyScore + getOpenWorkItems(b) * 0.4) - (a.goodFirstIssues * 12 + a.safetyScore + getOpenWorkItems(a) * 0.4))
      .slice(0, 3);
  }, [effectiveRepos]);
  const fallbackCity = useMemo(() => {
    const items = visualReposByDistrict.flatMap(({ repos }) => repos.map((repo, index) => {
      const layout = createRepoLayout(repo, index, repos, heightScaleDriver);
      return { repo, district: districtFor(repo), layout };
    }));
    const extent = Math.max(
      210,
      ...items.map((item) => Math.max(Math.abs(item.layout.position.x), Math.abs(item.layout.position.z)) + 24),
    );
    return { items, extent };
  }, [visualReposByDistrict, heightScaleDriver]);

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
    scene.fog = new THREE.FogExp2('#0c1514', 0.002);

    const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 0.1, 8000);
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

    const ambient = new THREE.AmbientLight('#c0e8e0', 1.4);
    scene.add(ambient);

    const key = new THREE.DirectionalLight('#dbe8ff', 3.2);
    key.position.set(-22, 48, 20);
    scene.add(key);

    const rim = new THREE.PointLight('#4fb7c5', 68, 120, 1.6);
    rim.position.set(0, 18, -32);
    scene.add(rim);

    createGround(scene);
    createSky(scene);

    const buildings: BuildingObject[] = [];
    visualReposByDistrict.forEach(({ repos }) => {
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
      setAtlasView((current) => ({
        ...current,
        scale: clamp(2 - nextZoom, 0.72, 1.58),
      }));
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
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      setSelectedRepo(null);
      setHoveredRepo(null);
      setFilter('all');
      targetDistrictCenterRef.current = null;
      similarDistrictRef.current = null;
      similarUntilRef.current = 0;
      freeNavX = 0;
      freeNavY = 0;
      freeNavZ = 0;
      refs.targetZoom = 1;
      setZoomValue(1);
      setAtlasView({ x: 0, y: 0, scale: 1 });
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

      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
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

        setAtlasView((current) => ({
          ...current,
          x: clamp(current.x + deltaX * 0.86, -420, 420),
          y: clamp(current.y + deltaY * 0.86, -320, 320),
        }));

        // Pan the fixed-perspective board based on delta movement.
        const panScale = 0.32 * refs.zoom;
        panRight.setFromMatrixColumn(camera.matrixWorld, 0);
        panRight.y = 0;
        panRight.normalize();
        camera.getWorldDirection(panForward);
        panForward.y = 0;
        panForward.normalize();

        freeNavX += (-deltaX * panScale * panRight.x) + (-deltaY * panScale * panForward.x);
        freeNavZ += (-deltaX * panScale * panRight.z) + (-deltaY * panScale * panForward.z);
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

        // Arrow keys pan the same fixed-perspective board as WASD.
        if (keysPressed['arrowup']) {
          freeNavZ -= moveSpeed;
          isUserMoving = true;
        }
        if (keysPressed['arrowdown']) {
          freeNavZ += moveSpeed;
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

        clampFreeNavigation();

        if (isUserMoving) {
          targetDistrictCenterRef.current = null;
        }

        const targetCenter = targetDistrictCenterRef.current;
        if (targetCenter) {
          freeNavX += (targetCenter.x - freeNavX) * 0.08;
          freeNavZ += (targetCenter.z - freeNavZ) * 0.08;
          freeNavY += (0 - freeNavY) * 0.08;
          refs.targetZoom = THREE.MathUtils.lerp(refs.targetZoom, 0.74, 0.08);

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
        building.body.material.emissiveIntensity = isSelected ? 0.2 : isHovered ? 0.14 : isSimilar ? 0.09 + pulse * 0.05 : 0.036;
        building.top.material.emissiveIntensity = isSelected || isHovered ? 0.52 : isSimilar ? 0.28 : 0.16;
        building.windows.material.opacity = isHovered || isSelected ? 0.74 : filterRef.current === 'all' ? 0.4 : building.windows.material.opacity;
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
          ? Math.min(0.74, filteredRoadOpacity + 0.22 + roadPulse * 0.1)
          : filteredRoadOpacity;
        if (road.label.visible) {
          const labelPoint = road.curve.getPointAt(0.5);
          road.label.position.set(labelPoint.x, 2.2 + road.flowStrength * 0.6, labelPoint.z);
          road.label.material.opacity = selectedRoad ? 0.66 : 0;
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
  }, [heightScaleDriver, rendererRetryToken, reposByDistrict, visualReposByDistrict]);

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
    setAtlasView((current) => ({
      ...current,
      scale: clamp(2 - clamped, 0.72, 1.58),
    }));
    if (sceneRef.current) sceneRef.current.targetZoom = clamped;
  };

  const handleZoomIn = () => setZoom((sceneRef.current?.targetZoom ?? zoomValue) - 0.14);
  const handleZoomOut = () => setZoom((sceneRef.current?.targetZoom ?? zoomValue) + 0.14);
  const handleZoomReset = () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setZoom(1);
    setAtlasView({ x: 0, y: 0, scale: 1 });
    setSelectedRepo(null);
    setFilter('all');
    targetDistrictCenterRef.current = null;
    similarDistrictRef.current = null;
    similarUntilRef.current = 0;
  };

  const handleAtlasPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (event.button !== 0 || target.closest('button, input, a, label')) return;
    event.preventDefault();
    atlasDragRef.current = {
      active: true,
      didDrag: false,
      endedAt: 0,
      pointerId: event.pointerId,
      suppressClick: false,
      x: event.clientX,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleAtlasPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = atlasDragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.x;
    const deltaY = event.clientY - drag.y;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 2) drag.didDrag = true;
    drag.x = event.clientX;
    drag.y = event.clientY;

    setAtlasView((current) => ({
      ...current,
      x: current.x + deltaX,
      y: current.y + deltaY,
    }));
  };

  const handleAtlasPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    if (atlasDragRef.current.pointerId === event.pointerId) {
      atlasDragRef.current.active = false;
      atlasDragRef.current.endedAt = event.timeStamp;
      if (atlasDragRef.current.didDrag) {
        atlasDragRef.current.suppressClick = true;
        window.setTimeout(() => {
          atlasDragRef.current.didDrag = false;
          atlasDragRef.current.suppressClick = false;
        }, 120);
      }
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture may already be released by the browser.
      }
    }
  };

  const handleAtlasWheel = (event: ReactWheelEvent<HTMLElement>) => {
    event.preventDefault();
    setZoom((sceneRef.current?.targetZoom ?? zoomValue) + Math.sign(event.deltaY) * 0.08);
  };

  const handleAtlasClickCapture = (event: ReactMouseEvent<HTMLElement>) => {
    const drag = atlasDragRef.current;
    if (!drag.suppressClick) return;
    drag.didDrag = false;
    drag.suppressClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const openTutorial = () => {
    setEntered(true);
    setTutorialStep(0);
    setTutorialOpen(true);
  };

  const handleSearchMove = (event: ReactMouseEvent<HTMLDivElement>) => {
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
      (item) => {
        const displayLabel = districtLabelForKey(item.key).toLowerCase();
        return (
          lower.includes(displayLabel) ||
          lower.includes(item.label.toLowerCase()) ||
          lower.includes(item.key) ||
          lower.includes(displayLabel.split('/')[0]) ||
          lower.includes(item.label.split('/')[0].toLowerCase())
        );
      },
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
    setAtlasView(atlasViewForDistrict(districtFor(repo)));
  };

  const focusDistrict = (district: District) => {
    setEntered(true);
    setSelectedRepo(null);
    setFilter(district.key);
    similarDistrictRef.current = district.key;
    similarUntilRef.current = performance.now() + 4200;
    targetDistrictCenterRef.current = { x: district.x, z: district.z };
    setAtlasView(atlasViewForDistrict(district));
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
      setImportStatus(`${imported.owner}/${imported.name} loaded into ${districtLabelForRepo(imported)}.`);
      focusRepo(imported);
    } catch (error) {
      console.error('[SIFT imports] GitHub import failed:', error);
      const fallbackId = `${locator.owner}/${locator.repo}`.toLowerCase();
      const graphRepo = effectiveRepos.find((repo) => `${repo.owner}/${repo.name}`.toLowerCase() === fallbackId || repo.id === fallbackId);

      if (graphRepo) {
        const importedFromGraph: Repo = {
          ...graphRepo,
          loadedAt: new Date().toISOString(),
          wantsContributions,
          importSource: 'github',
        };
        setLoadedRepos((current) => [importedFromGraph, ...current.filter((repo) => repo.id !== importedFromGraph.id)].slice(0, 20));
        setRepoImport('');
        setImportStatus(`${importedFromGraph.owner}/${importedFromGraph.name} loaded from the SIFT graph.`);
        focusRepo(importedFromGraph);
      } else {
        setImportStatus('Could not load that public GitHub repo.');
      }
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

  const zoomTierClass =
    zoomValue <= 0.72
      ? 'is-zoom-hyper'
      : zoomValue <= 0.9
      ? 'is-zoom-near'
      : zoomValue >= 1.16
      ? 'is-zoom-far'
      : 'is-zoom-mid';
  const zoomBlend = clamp((1.12 - zoomValue) / 0.4, 0, 1);

  return (
    <main
      className={`sift-page ${appearance === 'day' ? 'is-day' : 'is-night'} ${selectedRepo ? 'is-repo-focus' : ''} ${zoomTierClass}`}
      aria-label="SIFT 3D open-source city"
      style={{
        '--zoom-blend': zoomBlend.toFixed(3),
        '--atlas-pan-x': `${atlasView.x}px`,
        '--atlas-pan-y': `${atlasView.y}px`,
        '--atlas-scale': atlasView.scale,
      } as CSSProperties}
    >
      
      {loadingRepos && (
        <div className="sift-loading-screen">
          <div className="sift-loading-content">
            <h1 className="sift-loading-title">SIFT</h1>
            <div className="sift-spinner-8bit"></div>
            <p className="sift-loading-text">Loading universe...</p>
          </div>
        </div>
      )}

      <div className="three-stage" aria-hidden="true" />

      <section
        className="rendered-atlas-layer"
        aria-label="Rendered contribution atlas"
        onPointerDown={handleAtlasPointerDown}
        onPointerMove={handleAtlasPointerMove}
        onPointerUp={handleAtlasPointerUp}
        onPointerCancel={handleAtlasPointerUp}
        onClickCapture={handleAtlasClickCapture}
        onWheel={handleAtlasWheel}
      >
        <div className="rendered-atlas-board">
          <div className="atlas-skywash" aria-hidden="true" />
          <div className="atlas-water-basin" aria-hidden="true" />
          <div className="atlas-code-grid" aria-hidden="true" />
          <div className="atlas-tileable-city-grid" aria-hidden="true" />
          {atlasCityPlates.map((plate) => (
            <span
              key={`atlas-city-plate-${plate.id}`}
              className={`atlas-city-plate atlas-city-plate-${plate.biome} ${plate.active ? 'is-active' : 'is-muted'}`}
              aria-hidden="true"
              style={{
                '--city-plate-size': `${plate.size}px`,
                '--city-plate-rotation': `${plate.rotation}deg`,
                '--city-plate-opacity': plate.opacity,
                '--city-plate-scale': plate.scale,
                '--district-color': plate.color,
                '--district-accent': plate.accent,
                left: `${plate.left}%`,
                top: `${plate.top}%`,
              } as CSSProperties}
            />
          ))}
          {atlasTerrainTiles.map((tile) => (
            <span
              key={`atlas-ground-${tile.id}`}
              className={`atlas-ground-tile atlas-ground-${tile.kind} atlas-ground-variant-${tile.variant} ${tile.accent ? 'is-accent' : ''}`}
              aria-hidden="true"
              style={{
                '--terrain-scale': tile.scale,
                '--terrain-rotation': `${tile.rotation}deg`,
                '--terrain-opacity': tile.opacity,
                left: `${tile.left}%`,
                top: `${tile.top}%`,
              } as CSSProperties}
            />
          ))}
          {featuredDistricts.map(({ district, repoCount, position }) => (
            <span
              key={`atlas-terrain-${district.key}`}
              className={`atlas-terrain-region atlas-terrain-${atlasBiomeForDistrict(district)}`}
              aria-hidden="true"
              style={{
                '--district-color': district.color,
                '--district-accent': district.accent,
                '--region-scale': atlasRegionScale(repoCount),
                left: `${position.left}%`,
                top: `${position.top}%`,
              } as CSSProperties}
            >
              <i />
            </span>
          ))}
          <div className="rendered-atlas-shade" aria-hidden="true" />
          {atlasAmbientMarkers.map(({ id, left, top, width, height, delay, biome, kind, color, accent, scale, opacity }) => (
            <span
              key={`atlas-ambient-${id}`}
              className={`atlas-repo-marker atlas-ambient-marker atlas-repo-${biome} atlas-repo-kind-${kind}`}
              aria-hidden="true"
              style={{
                '--repo-color': color,
                '--repo-accent': accent,
                '--repo-width': `${width}px`,
                '--repo-height': `${height}px`,
                '--repo-delay': delay,
                '--repo-marker-scale': scale,
                '--repo-marker-opacity': opacity,
                left: `${left}%`,
                top: `${top}%`,
              } as CSSProperties}
            >
              <span />
            </span>
          ))}
          {atlasRepoMarkers.map(({ repo, district, left, top, width, height, delay, biome, kind }) => {
            const active =
              filter === 'all' ||
              repo.district === filter ||
              district.parent === filter ||
              (filter === 'stars' && repo.stars >= 10000) ||
              (filter === 'safe' && isGreenSafety(repo.safetyScore));
            const selected = selectedRepo?.id === repo.id;

            return (
              <button
                key={`atlas-repo-${repo.id}`}
                className={`atlas-repo-marker atlas-repo-${biome} atlas-repo-kind-${kind} ${active ? 'is-active' : 'is-muted'} ${selected ? 'is-selected' : ''}`}
                type="button"
                title={`${repo.owner}/${repo.name}: ${formatMetric(repo.stars)} stars, ${repo.safetyScore}% safe`}
                aria-label={`${repo.owner}/${repo.name}, ${formatMetric(repo.stars)} stars, ${repo.safetyScore}% safe`}
                onMouseEnter={() => setHoveredRepo(repo)}
                onMouseLeave={() => setHoveredRepo(null)}
                onClick={() => focusRepo(repo)}
                style={{
                  '--repo-color': district.color,
                  '--repo-accent': district.accent,
                  '--repo-width': `${width}px`,
                  '--repo-height': `${height}px`,
                  '--repo-delay': delay,
                  left: `${left}%`,
                  top: `${top}%`,
                } as CSSProperties}
              >
                <span aria-hidden="true" />
              </button>
            );
          })}
          {featuredDistricts.map(({ district, repoCount, topRepo, position }) => (
            <button
              key={`rendered-atlas-${district.key}`}
              className={`rendered-district rendered-district-${atlasBiomeForDistrict(district)} ${filter === district.key ? 'is-active' : ''}`}
              type="button"
              onClick={() => focusDistrict(district)}
              aria-label={`${districtLabelForKey(district.key)}, ${repoCount} repositories${topRepo ? `, top repository ${topRepo.name}` : ''}`}
              style={{
                '--district-color': district.color,
                '--district-accent': district.accent,
                '--region-scale': atlasRegionScale(repoCount),
                left: `${position.left}%`,
                top: `${position.top}%`,
              } as CSSProperties}
            >
              <span className="rendered-district-art" aria-hidden="true">
                {Array.from({ length: atlasStructureCount(repoCount) }).map((_, pieceIndex) => (
                  <i key={`rendered-piece-${district.key}-${pieceIndex}`} style={{ '--piece-index': pieceIndex } as CSSProperties} />
                ))}
              </span>
              <span className="rendered-district-label">
                <strong>{districtLabelForKey(district.key)}</strong>
                <span>{repoCount} repos{topRepo ? ` · ${topRepo.name}` : ''}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

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
                    <strong>{districtLabelForRepo(result.repo)} · {result.repo.language} · {result.repo.safetyScore}% safe</strong>
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
                      {districtLabelForKey(district.key)}
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
          <span>contribution atlas</span>
          <strong>fixed perspective · drag board · live repo districts</strong>
        </div>
      </section>

      <section className={`network-dock ${entered ? 'is-visible' : ''} ${selectedRepo ? 'has-panel' : ''}`} aria-label="Contribution network">
        <div className="network-head">
          <span>
            <Github size={14} strokeWidth={1.8} />
            Contribution Network
          </span>
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
                <span>{districtLabelForRepo(repo)}</span>
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
            <div className="panel-kicker">{districtLabelForRepo(selectedRepo)} district</div>
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

        /* Code-native atlas pass */
        .sift-page {
          --sift-bg-deep: #050a16;
          --sift-glass-surface: rgba(10, 18, 37, 0.62);
          --sift-glass-border: rgba(114, 151, 255, 0.28);
          --repo-marker-scale: 0.56;
          --repo-marker-opacity: 0.42;
          font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background:
            radial-gradient(circle at 84% 10%, rgba(255, 132, 78, 0.16), transparent 30%),
            radial-gradient(circle at 24% 20%, rgba(98, 120, 255, 0.22), transparent 36%),
            radial-gradient(circle at 58% 68%, rgba(54, 201, 255, 0.1), transparent 38%),
            linear-gradient(180deg, #0a152d 0%, #10172f 44%, #0a1326 100%);
        }

        .sift-page.is-day {
          --sift-glass-surface: rgba(17, 36, 66, 0.54);
          --sift-glass-border: rgba(174, 201, 255, 0.34);
          --sift-text-primary: rgba(255,255,255,0.94);
          --sift-text-secondary: rgba(222,232,245,0.68);
          background:
            radial-gradient(circle at 84% 10%, rgba(255, 156, 108, 0.16), transparent 32%),
            radial-gradient(circle at 24% 20%, rgba(114, 161, 255, 0.2), transparent 36%),
            radial-gradient(circle at 54% 68%, rgba(76, 214, 255, 0.1), transparent 38%),
            linear-gradient(180deg, #17396a 0%, #1f3d64 44%, #173354 100%);
        }

        .sift-page.is-zoom-far {
          --repo-marker-scale: 0.42;
          --repo-marker-opacity: 0.18;
        }

        .sift-page.is-zoom-near {
          --repo-marker-scale: 0.84;
          --repo-marker-opacity: 0.72;
        }

        .sift-page.is-zoom-hyper {
          --repo-marker-scale: 1;
          --repo-marker-opacity: 0.86;
        }

        .sift-page.is-zoom-far .atlas-artwork-layer {
          opacity: 1;
          filter: saturate(0.92) contrast(1.16) brightness(0.72);
        }

        .sift-page.is-zoom-mid .atlas-artwork-layer {
          opacity: 0.76;
          filter: saturate(1.02) contrast(1.1) brightness(0.86);
        }

        .sift-page.is-zoom-near .atlas-artwork-layer {
          opacity: 0.24;
          filter: saturate(1.35) contrast(1.08) blur(0.35px);
        }

        .sift-page.is-zoom-hyper .atlas-artwork-layer {
          opacity: 0.12;
          filter: saturate(1.55) contrast(1.14) brightness(0.94) blur(0.7px);
        }

        .sift-page.is-zoom-mid .atlas-hotspots {
          opacity: 0.62;
        }

        .sift-page.is-zoom-near .atlas-hotspots,
        .sift-page.is-zoom-hyper .atlas-hotspots {
          opacity: 0;
          pointer-events: none;
        }

        .three-stage {
          z-index: 2;
          background: transparent;
          opacity: 0.76;
          mix-blend-mode: normal;
          filter: saturate(1.12) contrast(1.1) brightness(0.9);
        }

        .sift-page.is-day .three-stage {
          opacity: 0.8;
          mix-blend-mode: normal;
        }

        .sift-page.is-zoom-mid .three-stage {
          opacity: 0.87;
          filter: saturate(1.34) contrast(1.14) brightness(0.98);
        }

        .sift-page.is-zoom-near .three-stage {
          opacity: 1;
          filter: saturate(1.72) contrast(1.18) brightness(1.1) drop-shadow(0 0 42px rgba(96, 94, 255, 0.16));
        }

        .sift-page.is-zoom-hyper .three-stage {
          opacity: 1;
          filter: saturate(1.95) contrast(1.25) brightness(1.14) hue-rotate(-8deg) drop-shadow(0 0 55px rgba(82, 218, 255, 0.24));
        }

        .sift-page::before,
        .sift-page.is-day::before {
          z-index: 3;
          opacity: 1;
          background:
            radial-gradient(circle at 50% 42%, transparent 30%, rgba(9, 18, 42, 0.38) 88%),
            linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 42%, rgba(8, 16, 36, 0.34) 100%),
            linear-gradient(90deg, rgba(2,8,20,0.26), transparent 14%, transparent 84%, rgba(2,8,20,0.3));
        }

        .sift-page.is-zoom-near::before,
        .sift-page.is-day.is-zoom-near::before,
        .sift-page.is-zoom-hyper::before,
        .sift-page.is-day.is-zoom-hyper::before {
          background:
            radial-gradient(circle at 50% 46%, transparent 44%, rgba(16, 22, 78, 0.16) 92%),
            linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 62%, rgba(8, 18, 54, 0.24) 100%),
            linear-gradient(90deg, rgba(67, 36, 167, 0.24), transparent 12%, transparent 88%, rgba(45, 195, 255, 0.18));
        }

        .sift-page::after {
          display: none;
        }

        .atlas-artwork-layer {
          position: fixed;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          opacity: 1;
          background:
            radial-gradient(circle at 17% 76%, rgba(255, 165, 108, 0.14), transparent 20%),
            radial-gradient(circle at 68% 24%, rgba(105, 134, 255, 0.2), transparent 24%),
            radial-gradient(circle at 74% 68%, rgba(84, 224, 255, 0.13), transparent 20%),
            linear-gradient(180deg, rgba(31, 48, 75, 0.64), rgba(14, 24, 44, 0.74));
          transform: translate3d(var(--atlas-pan-x, 0px), var(--atlas-pan-y, 0px), 0) scale(var(--atlas-scale, 1));
          transform-origin: 50% 50%;
          will-change: transform;
        }

        .atlas-map-base {
          position: absolute;
          left: 50%;
          top: 53%;
          width: min(1480px, 146vw);
          height: min(820px, 82vw);
          border-radius: 48% 52% 44% 56% / 58% 42% 54% 46%;
          background:
            radial-gradient(ellipse at 28% 24%, rgba(81, 101, 129, 0.78), transparent 28%),
            radial-gradient(ellipse at 72% 30%, rgba(117, 92, 77, 0.64), transparent 25%),
            radial-gradient(ellipse at 36% 70%, rgba(55, 94, 76, 0.7), transparent 25%),
            radial-gradient(ellipse at 73% 73%, rgba(59, 95, 118, 0.64), transparent 28%),
            linear-gradient(140deg, #475a69 0%, #2f4350 32%, #223741 62%, #162b38 100%);
          box-shadow:
            0 58px 110px rgba(5, 10, 22, 0.46),
            inset 0 2px 0 rgba(255,255,255,0.16),
            inset 0 -38px 72px rgba(6, 14, 28, 0.44);
          transform: translate(-50%, -50%) rotate(-5deg) skewY(-3deg);
        }

        .atlas-map-base::before,
        .atlas-map-base::after {
          content: "";
          position: absolute;
          inset: 8% 9%;
          border-radius: inherit;
          pointer-events: none;
        }

        .atlas-map-base::before {
          background:
            repeating-linear-gradient(18deg, rgba(255,255,255,0.045) 0 1px, transparent 1px 38px),
            repeating-linear-gradient(105deg, rgba(3,9,20,0.2) 0 1px, transparent 1px 52px);
          opacity: 0.54;
          mask-image: radial-gradient(ellipse at center, black 34%, transparent 75%);
        }

        .atlas-map-base::after {
          inset: 13% 11%;
          border: 1px solid rgba(191, 214, 255, 0.1);
          box-shadow:
            0 0 0 18px rgba(128, 151, 211, 0.05),
            inset 0 0 72px rgba(4, 10, 26, 0.42);
          opacity: 0.8;
        }

        .atlas-river,
        .atlas-route {
          position: absolute;
          pointer-events: none;
          border-radius: 999px;
          transform-origin: 50% 50%;
        }

        .atlas-river {
          height: 18px;
          background:
            linear-gradient(90deg, rgba(82,194,244,0.04), rgba(90,183,240,0.4), rgba(82,194,244,0.08));
          box-shadow: 0 0 24px rgba(62,151,227,0.22), inset 0 1px 0 rgba(255,255,255,0.18);
          filter: blur(0.2px);
          opacity: 0.72;
        }

        .atlas-river-main {
          left: 17%;
          top: 63%;
          width: 64%;
          transform: rotate(-10deg) skewX(-22deg);
        }

        .atlas-river-west {
          left: 7%;
          top: 45%;
          width: 42%;
          transform: rotate(22deg) skewX(18deg);
          opacity: 0.44;
        }

        .atlas-route {
          height: 5px;
          background:
            repeating-linear-gradient(90deg, rgba(246, 181, 112, 0.58) 0 20px, rgba(246, 181, 112, 0.08) 20px 32px);
          box-shadow: 0 0 14px rgba(246, 162, 94, 0.2);
          opacity: 0.48;
        }

        .atlas-route-a {
          left: 24%;
          top: 36%;
          width: 47%;
          transform: rotate(11deg) skewX(-18deg);
        }

        .atlas-route-b {
          left: 33%;
          top: 58%;
          width: 39%;
          transform: rotate(-24deg) skewX(20deg);
        }

        .atlas-route-c {
          left: 13%;
          top: 72%;
          width: 58%;
          transform: rotate(4deg) skewX(-12deg);
          opacity: 0.32;
        }

        .atlas-region {
          position: absolute;
          width: 150px;
          aspect-ratio: 1.38;
          transform: translate(-50%, -50%) scale(var(--region-scale, 1)) rotate(-7deg) skew(-9deg, -2deg);
          transform-origin: 50% 50%;
          filter: drop-shadow(20px 28px 34px rgba(1, 4, 12, 0.48));
        }

        .region-shadow,
        .region-plate,
        .region-contour,
        .region-structures {
          position: absolute;
          inset: 0;
        }

        .region-shadow {
          inset: 22% 4% -10% 10%;
          border-radius: 50%;
          background: rgba(0, 4, 12, 0.44);
          filter: blur(18px);
          transform: translate(12px, 18px);
        }

        .region-plate {
          border-radius: 46% 54% 48% 52% / 56% 44% 58% 42%;
          background:
            radial-gradient(circle at 30% 24%, color-mix(in srgb, var(--district-accent), white 14%), transparent 12%),
            radial-gradient(circle at 62% 70%, color-mix(in srgb, var(--district-color), black 18%), transparent 30%),
            linear-gradient(145deg, color-mix(in srgb, var(--district-color), #8ca6d5 22%), color-mix(in srgb, var(--district-color), #0b1428 44%));
          clip-path: polygon(11% 17%, 35% 4%, 72% 8%, 93% 28%, 88% 71%, 63% 96%, 22% 87%, 5% 54%);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.2),
            inset 0 -14px 30px rgba(4, 9, 24, 0.34);
        }

        .region-contour {
          inset: 11% 10%;
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 50% 45% 55% 48%;
          opacity: 0.48;
        }

        .region-contour-b {
          inset: 25% 23%;
          opacity: 0.24;
        }

        .region-structures {
          transform: skew(9deg, 2deg) rotate(7deg);
        }

        .region-structures i {
          position: absolute;
          left: var(--sx, 50%);
          top: var(--sy, 52%);
          width: var(--sw, 13px);
          height: var(--sh, 28px);
          border-radius: 3px 3px 2px 2px;
          background:
            linear-gradient(90deg, color-mix(in srgb, var(--district-color), black 26%), color-mix(in srgb, var(--district-accent), white 8%));
          box-shadow:
            8px 10px 0 rgba(2,8,10,0.18),
            inset 2px 0 0 rgba(255,255,255,0.13),
            inset -3px 0 0 rgba(2,8,11,0.16);
          transform: translate(-50%, -100%) skewY(-8deg);
        }

        .region-structures i:nth-child(1) { --sx: 31%; --sy: 66%; --sh: 24px; }
        .region-structures i:nth-child(2) { --sx: 42%; --sy: 48%; --sh: 42px; }
        .region-structures i:nth-child(3) { --sx: 54%; --sy: 61%; --sh: 30px; }
        .region-structures i:nth-child(4) { --sx: 65%; --sy: 43%; --sh: 50px; }
        .region-structures i:nth-child(5) { --sx: 73%; --sy: 67%; --sh: 22px; }
        .region-structures i:nth-child(6) { --sx: 24%; --sy: 47%; --sh: 34px; }
        .region-structures i:nth-child(7) { --sx: 48%; --sy: 76%; --sh: 18px; }
        .region-structures i:nth-child(8) { --sx: 79%; --sy: 52%; --sh: 36px; }
        .region-structures i:nth-child(9) { --sx: 36%; --sy: 35%; --sh: 30px; }

        .atlas-region-forge .region-plate {
          background:
            radial-gradient(circle at 58% 42%, rgba(255,120,52,0.52), transparent 20%),
            linear-gradient(145deg, #7f3d2f, color-mix(in srgb, var(--district-color), #150b13 56%));
        }

        .atlas-region-forge .region-structures i {
          width: 24px;
          height: var(--sh, 32px);
          clip-path: polygon(50% 0, 100% 100%, 0 100%);
          border-radius: 0;
          background: linear-gradient(160deg, #ffd29a, var(--district-color) 42%, #371012);
        }

        .atlas-region-green .region-plate {
          background:
            radial-gradient(circle at 28% 28%, rgba(219,255,199,0.34), transparent 16%),
            radial-gradient(circle at 68% 62%, rgba(15,56,74,0.72), transparent 36%),
            linear-gradient(150deg, color-mix(in srgb, var(--district-color), #6e8ea9 26%), #152d34);
        }

        .atlas-region-green .region-structures i {
          width: 24px;
          height: 24px;
          border-radius: 50% 50% 44% 48%;
          background:
            radial-gradient(circle at 32% 24%, rgba(255,255,255,0.22), transparent 24%),
            linear-gradient(145deg, color-mix(in srgb, var(--district-accent), white 8%), color-mix(in srgb, var(--district-color), black 34%));
        }

        .atlas-region-green .region-structures i::after,
        .atlas-region-water .region-structures i::after {
          content: "";
          position: absolute;
          left: 50%;
          bottom: -11px;
          width: 5px;
          height: 14px;
          border-radius: 99px;
          background: rgba(69,42,22,0.72);
          transform: translateX(-50%);
        }

        .atlas-region-signal .region-plate {
          background:
            radial-gradient(circle at 46% 45%, color-mix(in srgb, var(--district-accent), transparent 28%), transparent 26%),
            linear-gradient(145deg, color-mix(in srgb, var(--district-color), #2b3d72 20%), #141d36);
        }

        .atlas-region-signal .region-structures i {
          width: 17px;
          height: 30px;
          border-radius: 2px;
          clip-path: polygon(50% 0, 100% 42%, 62% 100%, 14% 78%, 0 26%);
          background: linear-gradient(160deg, rgba(255,255,255,0.82), var(--district-accent) 28%, var(--district-color) 80%);
          opacity: 0.86;
        }

        .atlas-region-water .region-plate {
          background:
            radial-gradient(ellipse at 55% 48%, rgba(119,214,224,0.4), transparent 32%),
            linear-gradient(145deg, color-mix(in srgb, var(--district-color), #43739a 22%), #142b3c);
        }

        .atlas-region-water .region-structures i {
          width: 28px;
          height: 10px;
          border-radius: 3px;
          background: linear-gradient(90deg, color-mix(in srgb, var(--district-accent), white 8%), color-mix(in srgb, var(--district-color), black 28%));
        }

        .atlas-region-field .region-structures i {
          width: 24px;
          height: 12px;
          border-radius: 50%;
          background: linear-gradient(145deg, color-mix(in srgb, var(--district-accent), white 5%), color-mix(in srgb, var(--district-color), black 30%));
        }

        .atlas-hotspots {
          position: fixed;
          inset: 0;
          z-index: 4;
          pointer-events: none;
          transform: translate3d(var(--atlas-pan-x, 0px), var(--atlas-pan-y, 0px), 0) scale(var(--atlas-scale, 1));
          transform-origin: 50% 50%;
          will-change: transform;
        }

        .atlas-hotspot {
          position: absolute;
          transform: translate(-50%, -50%);
          min-width: 132px;
          max-width: 180px;
          padding: 9px 11px 10px;
          border: 1px solid color-mix(in srgb, var(--district-accent), #7da1ff 42%);
          border-radius: 10px;
          background:
            linear-gradient(145deg, color-mix(in srgb, var(--district-color), #15253f 54%), rgba(10, 18, 43, 0.72)),
            rgba(7, 15, 32, 0.68);
          color: rgba(255,255,255,0.95);
          box-shadow: 0 14px 34px rgba(3, 8, 22, 0.48), inset 0 1px 0 rgba(255,255,255,0.18);
          text-align: left;
          pointer-events: auto;
          cursor: pointer;
          backdrop-filter: blur(9px) saturate(138%);
          -webkit-backdrop-filter: blur(9px) saturate(138%);
          transition: transform 140ms ease, border-color 140ms ease, background 140ms ease, opacity 140ms ease;
        }

        .atlas-hotspot:hover,
        .atlas-hotspot.is-active {
          transform: translate(-50%, -50%) scale(1.04);
          border-color: color-mix(in srgb, var(--district-accent), #d4ecff 18%);
          background:
            linear-gradient(145deg, color-mix(in srgb, var(--district-color), #1a325f 52%), rgba(14, 25, 58, 0.76)),
            rgba(10, 18, 44, 0.76);
        }

        .atlas-hotspot strong,
        .atlas-hotspot span {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .atlas-hotspot strong {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0;
        }

        .atlas-hotspot span {
          margin-top: 4px;
          color: rgba(224, 238, 255, 0.82);
          font-size: 10px;
        }

        .city-ui {
          z-index: 5;
        }

        .intro-layer {
          display: none;
        }

        .control-dock {
          top: 54px;
          left: 12px;
          width: 212px;
          grid-template-columns: 1fr;
          gap: 8px;
        }

        .tool-group,
        .mode-toggle,
        .guide-button,
        .network-dock,
        .repo-panel,
        .search-results,
        .repo-tooltip,
        .tutorial-card {
          border-radius: 12px;
          border-color: var(--sift-glass-border);
          background:
            linear-gradient(145deg, rgba(147, 184, 255, 0.16), rgba(255,255,255,0.04)),
            var(--sift-glass-surface);
          box-shadow: 0 20px 70px rgba(2, 7, 21, 0.42), inset 0 1px 0 rgba(255,255,255,0.18);
          backdrop-filter: blur(16px) saturate(136%);
          -webkit-backdrop-filter: blur(16px) saturate(136%);
        }

        .tool-group {
          grid-template-columns: 36px 1fr 36px 36px;
          padding: 8px;
        }

        .tool-group button,
        .mode-toggle button,
        .guide-button,
        .filter-chip,
        .repo-load-form button {
          border-radius: 8px;
          transition: transform 160ms ease, border-color 160ms ease, background 160ms ease, color 160ms ease;
        }

        .mode-toggle button.is-active {
          border-color: rgba(138, 186, 255, 0.62);
          background: linear-gradient(140deg, rgba(55, 105, 215, 0.36), rgba(50, 184, 255, 0.24));
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.2), 0 0 16px rgba(76, 157, 255, 0.16);
        }

        .sift-page.is-zoom-near .tool-group,
        .sift-page.is-zoom-near .mode-toggle,
        .sift-page.is-zoom-near .guide-button,
        .sift-page.is-zoom-near .network-dock,
        .sift-page.is-zoom-near .repo-panel,
        .sift-page.is-zoom-near .search-results,
        .sift-page.is-zoom-near .repo-tooltip,
        .sift-page.is-zoom-near .tutorial-card {
          border-color: rgba(133, 170, 218, 0.42);
          background:
            linear-gradient(145deg, rgba(61, 92, 134, 0.28), rgba(38, 64, 96, 0.18)),
            rgba(9, 18, 35, 0.68);
          box-shadow: 0 22px 78px rgba(2, 8, 21, 0.54), inset 0 1px 0 rgba(255,255,255,0.16), 0 0 28px rgba(82, 151, 213, 0.12);
        }

        .sift-page.is-zoom-hyper .tool-group,
        .sift-page.is-zoom-hyper .mode-toggle,
        .sift-page.is-zoom-hyper .guide-button,
        .sift-page.is-zoom-hyper .network-dock,
        .sift-page.is-zoom-hyper .repo-panel,
        .sift-page.is-zoom-hyper .search-results,
        .sift-page.is-zoom-hyper .repo-tooltip,
        .sift-page.is-zoom-hyper .tutorial-card {
          border-color: rgba(138, 179, 230, 0.5);
          background:
            linear-gradient(145deg, rgba(73, 105, 151, 0.34), rgba(43, 76, 112, 0.24)),
            rgba(8, 16, 34, 0.78);
          box-shadow: 0 24px 90px rgba(2, 8, 22, 0.62), inset 0 1px 0 rgba(255,255,255,0.18), 0 0 34px rgba(88, 158, 220, 0.14);
        }

        .sift-page.is-zoom-near .filter-chip.is-active,
        .sift-page.is-zoom-near .mode-toggle button.is-active,
        .sift-page.is-zoom-hyper .filter-chip.is-active,
        .sift-page.is-zoom-hyper .mode-toggle button.is-active {
          border-color: rgba(111, 180, 244, 0.68);
          background: linear-gradient(135deg, rgba(58, 131, 214, 0.46), rgba(70, 103, 170, 0.42));
          box-shadow: 0 0 24px rgba(93, 161, 230, 0.2);
        }

        .stat-bar {
          top: 10px;
          right: 116px;
          gap: 42px;
          padding: 5px 12px;
          border: 1px solid rgba(141, 177, 255, 0.3);
          border-top: 0;
          border-radius: 0 0 10px 10px;
          background: rgba(10, 20, 44, 0.52);
          backdrop-filter: blur(12px);
        }

        .stat-bar strong {
          font-size: 17px;
          color: rgba(255,255,255,0.96);
          text-shadow: 0 1px 18px rgba(52, 120, 255, 0.38);
        }

        .stat-bar span,
        .cinema-readout span {
          font-size: 7px;
          color: rgba(240, 249, 255, 0.68);
        }

        .network-dock {
          top: 42px;
          right: 22px;
          width: min(310px, calc(100vw - 44px));
          padding: 14px;
          gap: 12px;
        }

        .network-head span {
          font-size: 11px;
          color: rgba(249, 253, 255, 0.94);
        }

        .repo-load-form {
          grid-template-columns: minmax(0, 1fr) 78px;
          padding: 10px;
          border: 1px solid rgba(145, 177, 255, 0.3);
          border-radius: 10px;
          background: rgba(11, 23, 50, 0.44);
        }

        .repo-load-form input,
        .repo-load-form button {
          height: 36px;
        }

        .network-toggle {
          margin-top: -2px;
        }

        .network-status {
          padding: 12px;
          border-radius: 10px;
        }

        .network-lists {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .network-lists > div:first-child {
          grid-column: 1 / -1;
        }

        .network-lists button,
        .network-lists p {
          min-height: 48px;
          border-radius: 8px;
        }

        .search-cluster {
          bottom: 28px;
          width: min(760px, calc(100vw - 560px));
          opacity: 0.94;
        }

        .search-cluster:hover,
        .search-cluster:focus-within {
          opacity: 1;
        }

        .glass-search {
          min-height: 54px;
          border-radius: 12px;
          background:
            linear-gradient(145deg, rgba(132, 174, 255, 0.24), rgba(255,255,255,0.07)),
            rgba(9, 24, 55, 0.54);
          box-shadow: 0 18px 48px rgba(8, 14, 44, 0.34), inset 0 1px 0 rgba(255,255,255,0.18);
        }

        .glass-search::before,
        .glass-search::after {
          display: none;
        }

        .glass-search input {
          font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 14px;
          color: rgba(250, 254, 255, 0.96);
        }

        .glass-search button {
          height: 38px;
          border-radius: 8px;
          background: linear-gradient(135deg, rgba(96, 179, 255, 0.94), rgba(121, 122, 255, 0.9));
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.24), 0 0 16px rgba(110, 166, 255, 0.26);
        }

        .sift-page.is-zoom-near .glass-search,
        .sift-page.is-zoom-hyper .glass-search {
          background:
            linear-gradient(145deg, rgba(78, 117, 164, 0.36), rgba(44, 82, 122, 0.24)),
            rgba(10, 22, 48, 0.68);
          box-shadow: 0 18px 54px rgba(4, 10, 28, 0.46), inset 0 1px 0 rgba(255,255,255,0.18), 0 0 24px rgba(87, 171, 229, 0.12);
        }

        .sift-page.is-zoom-near .glass-search button,
        .sift-page.is-zoom-hyper .glass-search button {
          background: linear-gradient(135deg, rgba(118, 185, 255, 0.95), rgba(81, 129, 225, 0.92));
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.22), 0 0 20px rgba(106, 171, 240, 0.22);
        }

        .filter-row {
          opacity: 0.9;
        }

        .sift-page.is-zoom-near .filter-row,
        .sift-page.is-zoom-hyper .filter-row {
          opacity: 1;
        }

        .cinema-readout {
          left: 28px;
          bottom: 22px;
          opacity: 0.72;
        }

        .repo-panel {
          width: min(390px, calc(100vw - 20px));
          background:
            radial-gradient(circle at 18% 4%, color-mix(in srgb, var(--repo-color), transparent 72%), transparent 32%),
            linear-gradient(145deg, rgba(143, 175, 255, 0.2), rgba(255,255,255,0.05)),
            rgba(11, 21, 56, 0.8);
        }

        .repo-panel h2 {
          font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 32px;
          letter-spacing: -0.02em;
        }

        /* Rendered 2D atlas: art, labels, and hit targets share one transform. */
        .three-stage {
          z-index: 1;
          opacity: 0.01 !important;
          filter: none !important;
        }

        .rendered-atlas-layer {
          position: fixed;
          inset: 0;
          z-index: 2;
          overflow: hidden;
          --atlas-edge-color: #070d15;
          --atlas-edge-color-soft: #0a1420;
          --atlas-ground: #111a24;
          pointer-events: auto;
          cursor: grab;
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
          background:
            radial-gradient(ellipse at 28% 72%, rgba(48, 118, 86, 0.34), transparent 34%),
            radial-gradient(ellipse at 74% 22%, rgba(139, 70, 54, 0.32), transparent 32%),
            radial-gradient(ellipse at 50% 31%, rgba(72, 104, 126, 0.48), transparent 46%),
            repeating-linear-gradient(30deg, rgba(107, 168, 202, 0.08) 0 2px, transparent 2px 92px),
            repeating-linear-gradient(150deg, rgba(83, 208, 178, 0.06) 0 2px, transparent 2px 92px),
            radial-gradient(circle at 47% 17%, rgba(220, 233, 255, 0.1), transparent 19%),
            linear-gradient(180deg, var(--atlas-edge-color-soft) 0%, var(--atlas-edge-color) 100%);
        }

        .rendered-atlas-layer:active {
          cursor: grabbing;
        }

        .rendered-atlas-layer * {
          -webkit-user-drag: none;
        }

        .rendered-atlas-board {
          position: absolute;
          left: 50%;
          top: 50%;
          width: max(1458px, 122vw);
          aspect-ratio: 1458 / 778;
          transform: translate(-50%, -50%) translate3d(var(--atlas-pan-x, 0px), var(--atlas-pan-y, 0px), 0) scale(var(--atlas-scale, 1));
          transform-origin: 50% 50%;
          will-change: transform;
          isolation: isolate;
        }

        .rendered-atlas-board::before {
          content: "";
          position: absolute;
          inset: -82vh -88vw;
          z-index: -2;
          pointer-events: none;
          background:
            radial-gradient(ellipse at 26% 68%, rgba(53, 100, 78, 0.5), transparent 27%),
            radial-gradient(ellipse at 70% 28%, rgba(151, 66, 42, 0.34), transparent 24%),
            radial-gradient(ellipse at 58% 78%, rgba(60, 180, 210, 0.18), transparent 30%),
            repeating-linear-gradient(30deg, transparent 0 118px, rgba(102, 208, 230, 0.1) 118px 126px, transparent 126px 236px),
            repeating-linear-gradient(150deg, transparent 0 118px, rgba(122, 241, 190, 0.08) 118px 126px, transparent 126px 236px),
            radial-gradient(ellipse at 50% 50%, rgba(41, 61, 78, 0.7) 0%, rgba(16, 29, 43, 0.86) 28%, var(--atlas-edge-color) 70%),
            var(--atlas-edge-color);
          box-shadow: 0 0 0 180vmax var(--atlas-edge-color);
        }

        .rendered-atlas-board::after {
          content: "";
          position: absolute;
          inset: -2px;
          z-index: 2;
          pointer-events: none;
          background:
            radial-gradient(ellipse at 50% 48%, transparent 56%, rgba(7, 13, 21, 0.24) 76%, var(--atlas-edge-color) 100%),
            linear-gradient(90deg, var(--atlas-edge-color) 0%, transparent 10%, transparent 90%, var(--atlas-edge-color) 100%),
            linear-gradient(180deg, var(--atlas-edge-color-soft) 0%, transparent 13%, transparent 84%, var(--atlas-edge-color) 100%);
          mix-blend-mode: normal;
        }

        .atlas-skywash,
        .atlas-water-basin,
        .atlas-code-grid {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .atlas-skywash {
          z-index: -1;
          background:
            radial-gradient(ellipse at 34% 18%, rgba(128, 170, 220, 0.22), transparent 19%),
            radial-gradient(ellipse at 68% 38%, rgba(170, 83, 255, 0.14), transparent 22%),
            linear-gradient(180deg, rgba(47, 62, 78, 0.55), rgba(9, 15, 23, 0.78));
          filter: saturate(1.16);
        }

        .atlas-water-basin {
          z-index: 0;
          background:
            radial-gradient(ellipse at 33% 66%, rgba(43, 150, 170, 0.26), transparent 19%),
            radial-gradient(ellipse at 56% 64%, rgba(64, 184, 210, 0.2), transparent 20%),
            radial-gradient(ellipse at 73% 75%, rgba(51, 160, 190, 0.17), transparent 22%);
          mix-blend-mode: screen;
          opacity: 0.74;
        }

        .atlas-code-grid {
          z-index: 1;
          opacity: 0.07;
          background-image:
            linear-gradient(30deg, rgba(119, 161, 203, 0.1) 1px, transparent 1px),
            linear-gradient(150deg, rgba(119, 161, 203, 0.07) 1px, transparent 1px);
          background-size: 108px 62px;
          -webkit-mask-image: radial-gradient(ellipse at 50% 50%, #000 0 52%, transparent 83%);
          mask-image: radial-gradient(ellipse at 50% 50%, #000 0 52%, transparent 83%);
        }

        .atlas-tileable-city-grid {
          position: absolute;
          inset: -52% -60%;
          z-index: 1;
          pointer-events: none;
          background-image:
            url(/images/atlas-reference-assets/map-tile-city.svg),
            radial-gradient(ellipse at 26% 32%, rgba(83, 223, 255, 0.18), transparent 30%),
            radial-gradient(ellipse at 72% 74%, rgba(117, 255, 184, 0.14), transparent 34%),
            linear-gradient(180deg, rgba(13, 24, 34, 0.18), rgba(4, 10, 18, 0.56));
          background-repeat: repeat, no-repeat, no-repeat, no-repeat;
          background-size: 540px 540px, 920px 620px, 980px 720px, 100% 100%;
          background-position: 0 0, 16% 18%, 82% 84%, 0 0;
          mix-blend-mode: screen;
          opacity: 0.38;
          filter: saturate(1.14) brightness(1.04) contrast(1.04);
          transform: rotate(0.001deg);
          -webkit-mask-image: radial-gradient(ellipse at 50% 50%, #000 0 68%, rgba(0,0,0,0.72) 82%, transparent 98%);
          mask-image: radial-gradient(ellipse at 50% 50%, #000 0 68%, rgba(0,0,0,0.72) 82%, transparent 98%);
        }

        .atlas-tileable-city-grid::before,
        .atlas-tileable-city-grid::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-repeat: repeat;
          -webkit-mask-image: radial-gradient(ellipse at 50% 50%, #000 0 65%, rgba(0,0,0,0.7) 78%, transparent 96%);
          mask-image: radial-gradient(ellipse at 50% 50%, #000 0 65%, rgba(0,0,0,0.7) 78%, transparent 96%);
        }

        .atlas-tileable-city-grid::before {
          background-image:
            url(/images/atlas-reference-assets/map-tile-green.svg),
            url(/images/atlas-reference-assets/map-tile-water.svg),
            url(/images/atlas-reference-assets/map-tile-forge.svg),
            url(/images/atlas-reference-assets/map-tile-signal.svg);
          background-size: 680px 680px, 760px 760px, 720px 720px, 700px 700px;
          background-position: 120px 180px, 380px 420px, -80px 42px, 280px -132px;
          filter: saturate(1.12) brightness(1.03);
          opacity: 0.18;
          mix-blend-mode: screen;
        }

        .atlas-tileable-city-grid::after {
          opacity: 0.44;
          background:
            radial-gradient(circle at 18% 26%, rgba(109, 231, 255, 0.18) 0 8px, transparent 34px),
            radial-gradient(circle at 42% 58%, rgba(119, 255, 190, 0.16) 0 10px, transparent 42px),
            radial-gradient(circle at 73% 38%, rgba(255, 165, 88, 0.15) 0 9px, transparent 38px),
            radial-gradient(circle at 84% 76%, rgba(160, 122, 255, 0.14) 0 10px, transparent 44px);
          background-size: 540px 540px, 620px 620px, 700px 700px, 660px 660px;
          background-position: 0 0, 160px 80px, 60px 240px, 280px 12px;
          filter: blur(1.5px);
          mix-blend-mode: screen;
        }

        .atlas-city-plate {
          position: absolute;
          z-index: 2;
          width: var(--city-plate-size, 520px);
          aspect-ratio: 1;
          pointer-events: none;
          background-image: var(--city-plate-image);
          background-repeat: no-repeat;
          background-size: 100% 100%;
          opacity: var(--city-plate-opacity, 0.54);
          transform: translate(-50%, -50%) rotate(var(--city-plate-rotation, -18deg)) scale(var(--city-plate-scale, 1));
          transform-origin: 50% 50%;
          filter:
            saturate(1.22)
            brightness(1.06)
            contrast(1.04)
            drop-shadow(0 24px 30px rgba(0, 0, 0, 0.24));
          mix-blend-mode: screen;
          isolation: isolate;
          -webkit-mask-image: radial-gradient(ellipse at 50% 50%, #000 0 58%, rgba(0,0,0,0.86) 70%, transparent 92%);
          mask-image: radial-gradient(ellipse at 50% 50%, #000 0 58%, rgba(0,0,0,0.86) 70%, transparent 92%);
        }

        .atlas-city-plate::before,
        .atlas-city-plate::after {
          content: "";
          position: absolute;
          pointer-events: none;
          border-radius: 50%;
        }

        .atlas-city-plate::before {
          inset: 11% 8% 12%;
          z-index: -1;
          background:
            radial-gradient(ellipse at 50% 54%, color-mix(in srgb, var(--district-accent), transparent 52%), transparent 58%),
            radial-gradient(ellipse at 50% 52%, color-mix(in srgb, var(--district-color), transparent 62%), transparent 74%);
          filter: blur(18px);
          opacity: 0.78;
          mix-blend-mode: screen;
        }

        .atlas-city-plate::after {
          inset: 21% 18% 19%;
          background:
            radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.08), transparent 48%),
            radial-gradient(ellipse at 50% 58%, color-mix(in srgb, var(--district-accent), transparent 70%), transparent 66%);
          filter: blur(10px);
          opacity: 0.62;
          mix-blend-mode: screen;
        }

        .atlas-city-plate-city { --city-plate-image: url(/images/atlas-reference-assets/map-tile-city.svg); }
        .atlas-city-plate-forge { --city-plate-image: url(/images/atlas-reference-assets/map-tile-forge.svg); }
        .atlas-city-plate-green { --city-plate-image: url(/images/atlas-reference-assets/map-tile-green.svg); }
        .atlas-city-plate-signal { --city-plate-image: url(/images/atlas-reference-assets/map-tile-signal.svg); }
        .atlas-city-plate-water { --city-plate-image: url(/images/atlas-reference-assets/map-tile-water.svg); }

        .atlas-city-plate.is-muted {
          opacity: calc(var(--city-plate-opacity, 0.54) * 0.42);
          filter:
            saturate(0.6)
            brightness(0.8)
            contrast(0.94)
            drop-shadow(0 18px 22px rgba(0, 0, 0, 0.18));
        }

        .atlas-ground-tile {
          position: absolute;
          z-index: 2;
          width: 330px;
          height: 182px;
          pointer-events: none;
          background-image: var(--terrain-image);
          background-position: var(--terrain-x, 50%) var(--terrain-y, 50%);
          background-repeat: no-repeat;
          background-size: 520% auto;
          opacity: var(--terrain-opacity, 0.7);
          transform: translate(-50%, -50%) rotate(var(--terrain-rotation, -18deg)) scale(var(--terrain-scale, 1));
          transform-origin: 50% 50%;
          filter:
            drop-shadow(0 22px 24px rgba(0, 0, 0, 0.28))
            saturate(1.18)
            brightness(1.06);
          mix-blend-mode: soft-light;
          -webkit-mask-image: radial-gradient(ellipse at 50% 54%, #000 0 46%, rgba(0,0,0,0.72) 58%, transparent 78%);
          mask-image: radial-gradient(ellipse at 50% 54%, #000 0 46%, rgba(0,0,0,0.72) 58%, transparent 78%);
        }

        .atlas-ground-tile::after {
          content: "";
          position: absolute;
          inset: 18% 12% 10%;
          border-radius: 50%;
          background: radial-gradient(ellipse at 50% 50%, rgba(96, 214, 255, 0.18), transparent 64%);
          filter: blur(12px);
          mix-blend-mode: screen;
          pointer-events: none;
        }

        .atlas-ground-tile.is-accent {
          width: 220px;
          height: 122px;
          opacity: calc(var(--terrain-opacity, 0.56) * 0.84);
          filter:
            drop-shadow(0 18px 22px rgba(0, 0, 0, 0.26))
            saturate(1.18)
            brightness(1.04);
        }

        .atlas-ground-water {
          --terrain-image: url(/images/atlas-reference-assets/terrain-water-layer.png);
        }

        .atlas-ground-green {
          --terrain-image: url(/images/atlas-reference-assets/terrain-green-layer.png);
        }

        .atlas-ground-city {
          --terrain-image: url(/images/atlas-reference-assets/terrain-city-layer.png);
        }

        .atlas-ground-forge {
          --terrain-image: url(/images/atlas-reference-assets/terrain-forge-layer.png);
        }

        .atlas-ground-crystal {
          --terrain-image: url(/images/atlas-reference-assets/terrain-crystal-layer.png);
        }

        .atlas-ground-variant-0 { --terrain-x: 5%; --terrain-y: 22%; }
        .atlas-ground-variant-1 { --terrain-x: 27%; --terrain-y: 22%; }
        .atlas-ground-variant-2 { --terrain-x: 50%; --terrain-y: 22%; }
        .atlas-ground-variant-3 { --terrain-x: 73%; --terrain-y: 22%; }
        .atlas-ground-variant-4 { --terrain-x: 96%; --terrain-y: 22%; }
        .atlas-ground-variant-5 { --terrain-x: 5%; --terrain-y: 78%; }
        .atlas-ground-variant-6 { --terrain-x: 27%; --terrain-y: 78%; }
        .atlas-ground-variant-7 { --terrain-x: 50%; --terrain-y: 78%; }
        .atlas-ground-variant-8 { --terrain-x: 73%; --terrain-y: 78%; }
        .atlas-ground-variant-9 { --terrain-x: 96%; --terrain-y: 78%; }

        .rendered-atlas-shade {
          position: absolute;
          inset: 0;
          z-index: 3;
          background:
            radial-gradient(ellipse at 49% 43%, transparent 34%, rgba(3, 7, 15, 0.3) 79%),
            linear-gradient(90deg, rgba(2, 7, 16, 0.18), transparent 18%, transparent 78%, rgba(2, 7, 16, 0.34)),
            linear-gradient(180deg, rgba(6, 12, 24, 0.16), transparent 34%, rgba(4, 9, 17, 0.34));
          pointer-events: none;
        }

        .atlas-terrain-region {
          position: absolute;
          z-index: 2;
          width: calc(180px * var(--region-scale, 1));
          height: calc(104px * var(--region-scale, 1));
          transform: translate(-50%, -42%) rotate(-17deg);
          transform-origin: 50% 50%;
          pointer-events: none;
          border-radius: 50%;
          background:
            radial-gradient(ellipse at 48% 42%, color-mix(in srgb, var(--district-accent), transparent 62%), transparent 36%),
            radial-gradient(ellipse at 50% 56%, color-mix(in srgb, var(--district-color), #101827 22%), transparent 68%);
          filter: saturate(1.3) drop-shadow(0 26px 24px rgba(0, 0, 0, 0.34));
          opacity: 0.84;
        }

        .atlas-terrain-region::before,
        .atlas-terrain-region::after,
        .atlas-terrain-region i {
          content: "";
          position: absolute;
          display: block;
          inset: 16% 10%;
          border-radius: inherit;
          background:
            linear-gradient(135deg, rgba(255,255,255,0.16), transparent 28% 68%, rgba(0,0,0,0.2)),
            repeating-linear-gradient(90deg, transparent 0 18px, color-mix(in srgb, var(--district-accent), transparent 74%) 18px 20px);
          transform: rotate(17deg) skewX(-16deg);
          opacity: 0.54;
        }

        .atlas-terrain-region::after {
          inset: 55% 3% 10% 25%;
          opacity: 0.38;
          filter: blur(8px);
        }

        .atlas-terrain-green {
          border-radius: 58% 44% 50% 46%;
        }

        .atlas-terrain-forge {
          background:
            radial-gradient(ellipse at 55% 44%, rgba(255, 133, 52, 0.52), transparent 32%),
            radial-gradient(ellipse at 50% 58%, color-mix(in srgb, var(--district-color), #2b0705 26%), transparent 72%);
        }

        .atlas-terrain-signal {
          clip-path: polygon(8% 44%, 42% 4%, 88% 18%, 98% 66%, 58% 100%, 14% 82%);
        }

        .atlas-terrain-water {
          background:
            radial-gradient(ellipse at 50% 48%, rgba(128, 225, 255, 0.48), transparent 38%),
            radial-gradient(ellipse at 50% 58%, color-mix(in srgb, var(--district-color), #071827 28%), transparent 72%);
        }

        .atlas-repo-marker {
          position: absolute;
          z-index: 6;
          --repo-visual-width: clamp(36px, calc(var(--repo-width) * 3.2), 86px);
          --repo-visual-height: clamp(48px, calc(var(--repo-height) * 1.55 + 24px), 138px);
          --repo-sprite-x: 4%;
          --repo-sprite-y: 48%;
          --repo-sprite-size: 520% auto;
          width: calc(var(--repo-visual-width) + 24px);
          height: calc(var(--repo-visual-height) + 24px);
          padding: 0;
          border: 0;
          background: transparent;
          transform: translate(-50%, -100%) scale(var(--repo-marker-scale));
          transform-origin: 50% 100%;
          pointer-events: auto;
          cursor: pointer;
          isolation: isolate;
          opacity: var(--repo-marker-opacity);
        }

        .atlas-ambient-marker {
          z-index: 5;
          pointer-events: none;
          cursor: default;
        }

        .atlas-repo-marker.atlas-ambient-marker::before {
          opacity: 0.68;
          width: calc(var(--repo-visual-width) * 1.5);
          height: 20px;
        }

        .atlas-repo-marker.atlas-ambient-marker span {
          filter: contrast(1.04) saturate(1.34) brightness(1.12);
          opacity: 0.78;
        }

        .atlas-repo-marker.atlas-ambient-marker:nth-of-type(3n) span {
          transform: translateX(-50%) scaleX(0.92);
        }

        .atlas-repo-marker.atlas-ambient-marker:nth-of-type(5n) span {
          transform: translateX(-50%) scaleY(0.88);
        }

        .atlas-repo-marker::before {
          content: "";
          position: absolute;
          left: 50%;
          bottom: -6px;
          z-index: -1;
          width: calc(var(--repo-visual-width) * 1.2);
          height: 24px;
          border-radius: 50%;
          background:
            linear-gradient(30deg, rgba(8, 15, 23, 0.2), rgba(148, 238, 255, 0.16), rgba(8, 15, 23, 0.14)),
            radial-gradient(ellipse at 50% 50%, color-mix(in srgb, var(--repo-color), transparent 32%), transparent 72%);
          box-shadow:
            0 0 24px color-mix(in srgb, var(--repo-accent), transparent 52%),
            0 13px 18px rgba(0, 0, 0, 0.2);
          transform: translateX(-50%) rotate(-18deg);
        }

        .atlas-repo-marker span {
          position: absolute;
          left: 50%;
          bottom: 0;
          width: var(--repo-visual-width);
          height: var(--repo-visual-height);
          border-radius: 0;
          background-image: var(--repo-sprite-image);
          background-position: var(--repo-sprite-x) var(--repo-sprite-y);
          background-repeat: no-repeat;
          background-size: var(--repo-sprite-size);
          background-color: transparent;
          clip-path: none;
          filter:
            contrast(1.14)
            saturate(1.62)
            brightness(1.28);
          mix-blend-mode: screen;
          -webkit-mask-image: radial-gradient(ellipse at 50% 64%, #000 0 52%, rgba(0,0,0,0.88) 60%, transparent 82%);
          mask-image: radial-gradient(ellipse at 50% 64%, #000 0 52%, rgba(0,0,0,0.88) 60%, transparent 82%);
          transform: translateX(-50%);
          transition: transform 140ms ease, filter 140ms ease;
        }

        .atlas-repo-marker span::before,
        .atlas-repo-marker span::after {
          content: "";
          position: absolute;
          pointer-events: none;
        }

        .atlas-repo-marker span::before {
          inset: 8% 10% 18%;
          border-radius: 42% 42% 34% 34%;
          background:
            radial-gradient(circle at 50% 20%, rgba(255,255,255,0.28), transparent 18%),
            radial-gradient(circle at 48% 58%, color-mix(in srgb, var(--repo-accent), transparent 58%), transparent 44%),
            linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
          mix-blend-mode: screen;
          opacity: 0.38;
        }

        .atlas-repo-marker span::after {
          left: 50%;
          bottom: 4px;
          width: 86%;
          height: 13px;
          border-radius: 50%;
          background: color-mix(in srgb, var(--repo-color), transparent 46%);
          filter: blur(10px);
          mix-blend-mode: normal;
          opacity: 0.82;
          transform: translateX(-50%);
        }

        .atlas-repo-city span,
        .atlas-repo-field span {
          --repo-sprite-image: url(/images/atlas-reference-assets/biome-city-sprite.png);
          --repo-sprite-y: 48%;
        }

        .atlas-repo-green span {
          --repo-sprite-image: url(/images/atlas-reference-assets/biome-green-sprite.png);
          --repo-sprite-y: 50%;
        }

        .atlas-repo-forge span {
          --repo-sprite-image: url(/images/atlas-reference-assets/biome-forge-sprite.png);
          --repo-sprite-y: 48%;
        }

        .atlas-repo-signal span {
          --repo-sprite-image: url(/images/atlas-reference-assets/biome-crystal-sprite.png);
          --repo-sprite-y: 46%;
        }

        .atlas-repo-water span {
          --repo-sprite-image: url(/images/atlas-reference-assets/biome-water-sprite.png);
          --repo-sprite-y: 34%;
        }

        .atlas-repo-kind-standard span {
          --repo-sprite-x: 4%;
        }

        .atlas-repo-kind-safe span {
          --repo-sprite-x: 25%;
        }

        .atlas-repo-kind-activity span {
          --repo-sprite-x: 48%;
        }

        .atlas-repo-kind-community span {
          --repo-sprite-x: 72%;
        }

        .atlas-repo-kind-pr span {
          --repo-sprite-x: 72%;
          --repo-sprite-size: 535% auto;
        }

        .atlas-repo-kind-landmark span {
          --repo-sprite-x: 96%;
          --repo-sprite-size: 545% auto;
          -webkit-mask-image: radial-gradient(ellipse at 50% 64%, #000 0 60%, rgba(0,0,0,0.9) 68%, transparent 88%);
          mask-image: radial-gradient(ellipse at 50% 64%, #000 0 60%, rgba(0,0,0,0.9) 68%, transparent 88%);
        }

        .atlas-repo-kind-pr span {
          filter:
            contrast(1.08)
            saturate(1.58)
            brightness(1.24);
        }

        .atlas-repo-kind-safe span {
          filter:
            contrast(1.08)
            saturate(1.58)
            brightness(1.24);
        }

        .atlas-repo-kind-community span::before {
          background:
            radial-gradient(circle at 35% 30%, rgba(255,255,255,0.5) 0 2px, transparent 3px),
            radial-gradient(circle at 62% 56%, rgba(255,255,255,0.38) 0 2px, transparent 3px),
            repeating-linear-gradient(0deg, rgba(255,255,255,0.16) 0 2px, transparent 2px 7px);
        }

        .atlas-repo-kind-activity {
          animation-duration: 2.3s;
        }

        .atlas-repo-marker.is-muted {
          opacity: 0.22;
          filter: saturate(0.5);
        }

        .atlas-repo-marker:hover,
        .atlas-repo-marker.is-selected {
          z-index: 8;
          opacity: 1;
        }

        .atlas-repo-marker:hover span,
        .atlas-repo-marker.is-selected span {
          transform: translateX(-50%) translateY(-8px) scale(1.16);
          filter:
            drop-shadow(12px 18px 0 rgba(0, 0, 0, 0.2))
            drop-shadow(0 0 30px color-mix(in srgb, var(--repo-accent), transparent 28%))
            contrast(1.08)
            brightness(1.32)
            saturate(1.7);
        }

        @keyframes atlasRepoBreathe {
          0%, 100% { transform: translate(-50%, -100%) translateY(0) scale(var(--repo-marker-scale)); }
          50% { transform: translate(-50%, -100%) translateY(-2px) scale(var(--repo-marker-scale)); }
        }

        @keyframes atlasGroundDrift {
          0%, 100% { translate: 0 0; filter: drop-shadow(0 26px 30px rgba(0, 0, 0, 0.34)) saturate(1.18) brightness(1.04); }
          50% { translate: 0 -2px; filter: drop-shadow(0 28px 34px rgba(0, 0, 0, 0.38)) saturate(1.34) brightness(1.1); }
        }

        .rendered-district {
          position: absolute;
          z-index: 7;
          width: 170px;
          min-height: 86px;
          padding: 0;
          border: 0;
          background: transparent;
          color: inherit;
          text-align: left;
          transform: translate(-16px, -14px);
          transform-origin: 20px 20px;
          pointer-events: auto;
          cursor: pointer;
          isolation: isolate;
        }

        .rendered-district::before {
          content: "";
          position: absolute;
          left: 8px;
          top: 28px;
          width: calc(80px * var(--region-scale, 1));
          height: calc(44px * var(--region-scale, 1));
          border-radius: 50%;
          background: color-mix(in srgb, var(--district-color), transparent 48%);
          filter: blur(18px);
          opacity: 0.7;
          transform: rotate(-9deg);
          z-index: -1;
        }

        .rendered-district-art {
          position: absolute;
          left: 12px;
          top: 22px;
          width: calc(104px * var(--region-scale, 1));
          height: calc(68px * var(--region-scale, 1));
          transform: perspective(280px) rotateX(58deg) rotateZ(-18deg);
          transform-origin: 45% 58%;
          opacity: 0.42;
          filter: drop-shadow(0 18px 18px rgba(0, 0, 0, 0.46));
          transition: opacity 160ms ease, transform 160ms ease;
        }

        .rendered-district-art i {
          position: absolute;
          left: var(--sx, 50%);
          bottom: var(--sy, 20%);
          width: var(--sw, 9px);
          height: var(--sh, 34px);
          border-radius: 2px 2px 1px 1px;
          background:
            linear-gradient(90deg, color-mix(in srgb, var(--district-color), #111827 12%), color-mix(in srgb, var(--district-accent), white 10%));
          box-shadow:
            6px 8px 0 rgba(0, 0, 0, 0.22),
            inset 2px 0 0 rgba(255, 255, 255, 0.16),
            0 0 18px color-mix(in srgb, var(--district-accent), transparent 42%);
          transform: translate(-50%, 0) skewY(-10deg);
        }

        .rendered-district-art i:nth-child(1) { --sx: 19%; --sy: 20%; --sh: 30px; --sw: 10px; }
        .rendered-district-art i:nth-child(2) { --sx: 31%; --sy: 24%; --sh: 56px; --sw: 12px; }
        .rendered-district-art i:nth-child(3) { --sx: 43%; --sy: 18%; --sh: 42px; --sw: 10px; }
        .rendered-district-art i:nth-child(4) { --sx: 54%; --sy: 25%; --sh: 68px; --sw: 13px; }
        .rendered-district-art i:nth-child(5) { --sx: 66%; --sy: 15%; --sh: 36px; --sw: 12px; }
        .rendered-district-art i:nth-child(6) { --sx: 75%; --sy: 21%; --sh: 52px; --sw: 9px; }
        .rendered-district-art i:nth-child(7) { --sx: 83%; --sy: 12%; --sh: 28px; --sw: 11px; }
        .rendered-district-art i:nth-child(8) { --sx: 39%; --sy: 38%; --sh: 24px; --sw: 14px; }
        .rendered-district-art i:nth-child(9) { --sx: 59%; --sy: 39%; --sh: 31px; --sw: 13px; }

        .rendered-district-forge .rendered-district-art i {
          clip-path: polygon(50% 0, 100% 100%, 0 100%);
          background: linear-gradient(180deg, #ffd7a1, var(--district-color) 48%, #3b0a08);
          box-shadow: 0 0 26px rgba(255, 106, 33, 0.46);
        }

        .rendered-district-green .rendered-district-art i {
          width: var(--sw, 18px);
          height: var(--sh, 22px);
          border-radius: 50% 50% 42% 48%;
          background: radial-gradient(circle at 35% 28%, rgba(255,255,255,0.24), transparent 25%), linear-gradient(145deg, var(--district-accent), color-mix(in srgb, var(--district-color), #062013 42%));
        }

        .rendered-district-signal .rendered-district-art i {
          clip-path: polygon(50% 0, 90% 32%, 70% 100%, 18% 82%, 0 25%);
          background: linear-gradient(170deg, rgba(255,255,255,0.88), var(--district-accent) 26%, var(--district-color) 86%);
          box-shadow: 0 0 28px color-mix(in srgb, var(--district-accent), transparent 18%);
        }

        .rendered-district-water .rendered-district-art i {
          height: 12px;
          border-radius: 3px;
          background: linear-gradient(90deg, color-mix(in srgb, var(--district-accent), white 8%), color-mix(in srgb, var(--district-color), #071827 22%));
        }

        .rendered-district-label {
          position: relative;
          z-index: 2;
          display: block;
          width: max-content;
          max-width: 176px;
          padding: 10px 11px 9px;
          border: 1px solid color-mix(in srgb, var(--district-accent), transparent 78%);
          border-radius: 999px;
          background:
            radial-gradient(ellipse at 24% 50%, color-mix(in srgb, var(--district-color), transparent 52%), transparent 76%),
            linear-gradient(145deg, rgba(16, 25, 36, 0.72), rgba(8, 14, 24, 0.46));
          box-shadow: 0 0 34px color-mix(in srgb, var(--district-color), transparent 72%), 0 14px 28px rgba(0, 0, 0, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(12px) saturate(118%);
          -webkit-backdrop-filter: blur(12px) saturate(118%);
          transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
        }

        .rendered-district-label strong,
        .rendered-district-label span {
          display: block;
          overflow: hidden;
          max-width: 154px;
          text-overflow: ellipsis;
          white-space: nowrap;
          letter-spacing: 0;
        }

        .rendered-district-label strong {
          font-size: 12px;
          line-height: 1.18;
          font-weight: 780;
          color: rgba(255, 255, 255, 0.96);
        }

        .rendered-district-label span {
          margin-top: 4px;
          font-size: 10px;
          line-height: 1.25;
          color: rgba(205, 219, 235, 0.76);
        }

        .rendered-district:hover .rendered-district-label,
        .rendered-district.is-active .rendered-district-label {
          transform: translateY(-2px);
          border-color: color-mix(in srgb, var(--district-accent), rgba(255, 255, 255, 0.24) 38%);
          background:
            radial-gradient(ellipse at 24% 50%, color-mix(in srgb, var(--district-accent), transparent 45%), transparent 76%),
            linear-gradient(145deg, rgba(22, 33, 48, 0.84), rgba(9, 16, 27, 0.66));
        }

        .rendered-district:hover .rendered-district-art,
        .rendered-district.is-active .rendered-district-art {
          opacity: 0.66;
          transform: perspective(280px) rotateX(58deg) rotateZ(-18deg) translateY(-5px) scale(1.04);
        }

        .sift-page.is-zoom-near .rendered-district-label,
        .sift-page.is-zoom-hyper .rendered-district-label {
          box-shadow: 0 18px 44px rgba(0, 0, 0, 0.4), 0 0 26px color-mix(in srgb, var(--district-color), transparent 66%), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }

        @media (max-width: 1100px) {
          .rendered-atlas-board {
            width: max(1180px, 170vw);
          }

          .rendered-district {
            transform: translate(-12px, -12px) scale(0.92);
          }

          .search-cluster {
            width: min(720px, calc(100vw - 32px));
          }

          .network-dock {
            top: auto;
            right: 16px;
            bottom: 92px;
            width: min(360px, calc(100vw - 32px));
            max-height: 44vh;
            overflow-y: auto;
          }

          .stat-bar {
            right: 16px;
          }
        }
        /* 8-bit Loading Screen */
        .sift-loading-screen {
          position: absolute;
          inset: 0;
          z-index: 1000;
          background: #02040a;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Courier New', Courier, monospace;
          color: #39d353;
        }

        .sift-loading-content {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
        }

        .sift-loading-title {
          font-size: 48px;
          font-weight: 900;
          letter-spacing: 8px;
          margin: 0;
          text-shadow: 2px 2px 0px #000, 4px 4px 0px #238636;
        }

        .sift-spinner-8bit {
          width: 40px;
          height: 40px;
          border: 4px solid #238636;
          border-top: 4px solid #39d353;
          border-radius: 0;
          animation: spin8bit 1s steps(8) infinite;
        }

        @keyframes spin8bit {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .sift-loading-text {
          font-size: 16px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 2px;
          animation: blink8bit 1.5s steps(2) infinite;
        }

        @keyframes blink8bit {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </main>
  );
}


function createBuilding(repo: Repo, index: number, districtRepos: Repo[], heightScaleDriver: HeightScaleDriver) {
  const district = districtFor(repo);
  const group = new THREE.Group();
  const layout = createRepoLayout(repo, index, districtRepos, heightScaleDriver);
  group.position.copy(layout.position);

  const shape = buildingShapeFor(repo, district);
  const baseColor = new THREE.Color(district.color);
  const bodyColor = baseColor.clone().lerp(new THREE.Color('#030510'), 0.08);
  const accentColor = new THREE.Color(district.accent);
  const isHighDetail = repo.stars >= 1000 || index % 5 === 0;

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.42,
    metalness: 0.28,
    emissive: baseColor,
    emissiveIntensity: 0.052,
  });

  const topMaterial = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.28,
    metalness: 0.44,
    emissive: accentColor,
    emissiveIntensity: 0.16,
  });

  const glassMaterial = new THREE.MeshStandardMaterial({
    color: baseColor.clone().lerp(new THREE.Color('#dbeafe'), 0.18),
    roughness: 0.08,
    metalness: 0.86,
    transparent: true,
    opacity: 0.78,
    emissive: accentColor,
    emissiveIntensity: 0.26,
  });

  let body: THREE.Mesh;
  let top: THREE.Mesh;
  let visualHeight = layout.height;
  let bodyWidth = layout.width;
  let bodyDepth = layout.depth;

  // Core platform and frontend tower forms
  if (['spires', 'megatowers', 'vertical_arcology', 'skyline_core'].includes(shape)) {
    bodyWidth *= 0.6; bodyDepth *= 0.6; visualHeight *= 1.4;
    body = new THREE.Mesh(new THREE.CylinderGeometry(bodyWidth*0.4, bodyWidth*0.8, visualHeight, 8), bodyMaterial);
    top = new THREE.Mesh(new THREE.ConeGeometry(bodyWidth*0.4, visualHeight*0.3, 8), topMaterial);
    top.position.y = visualHeight / 2 + visualHeight*0.15;
    if (isHighDetail) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(bodyWidth, 0.1, 8, 16), topMaterial);
      ring.position.y = visualHeight * 0.3;
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
    }
  } 
  // Data platform low-block forms
  else if (['blocks', 'financial_district', 'data'].includes(shape)) {
    bodyWidth *= 1.2; bodyDepth *= 1.2; visualHeight *= 0.6;
    body = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth, visualHeight, bodyDepth), glassMaterial);
    top = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth*0.8, visualHeight*0.1, bodyDepth*0.8), topMaterial);
    top.position.y = visualHeight / 2 + visualHeight*0.05;
    if (isHighDetail) {
      const vent = new THREE.Mesh(new THREE.CylinderGeometry(bodyWidth*0.2, bodyWidth*0.2, visualHeight*0.2, 16), bodyMaterial);
      vent.position.y = visualHeight / 2 + visualHeight*0.1;
      vent.position.x = bodyWidth*0.2;
      group.add(vent);
    }
  }
  // Cloud infrastructure reactor forms
  else if (['lava_foundries', 'volcano_forge', 'reactors'].includes(shape)) {
    bodyWidth *= 1.3; bodyDepth *= 1.3; visualHeight *= 0.8;
    body = new THREE.Mesh(new THREE.ConeGeometry(bodyWidth*0.4, visualHeight, 6), bodyMaterial);
    top = new THREE.Mesh(new THREE.CylinderGeometry(bodyWidth*0.15, bodyWidth*0.15, visualHeight*0.4, 6), topMaterial);
    top.position.y = visualHeight / 2 + visualHeight*0.2;
    if (isHighDetail) {
      const lava = new THREE.Mesh(new THREE.CylinderGeometry(bodyWidth*0.16, bodyWidth*0.16, visualHeight*0.41, 6), new THREE.MeshBasicMaterial({color: '#ff2200', transparent: true, opacity: 0.8}));
      lava.position.copy(top.position);
      group.add(lava);
    }
  }
  // AI and distributed-system crystal forms
  else if (['caves', 'frozen_kingdom', 'crystal_fields', 'crystal_spires'].includes(shape)) {
    bodyWidth *= 0.8; bodyDepth *= 0.8; visualHeight *= 1.2;
    body = new THREE.Mesh(new THREE.OctahedronGeometry(bodyWidth, 0), glassMaterial);
    body.scale.set(1, visualHeight/bodyWidth, 1);
    top = new THREE.Mesh(new THREE.ConeGeometry(bodyWidth*0.3, visualHeight*0.4, 4), topMaterial);
    top.position.y = visualHeight / 2 + visualHeight*0.2;
    if (isHighDetail) {
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(bodyWidth*0.5, 0), glassMaterial);
      shard.position.set(bodyWidth*0.5, visualHeight*0.3, bodyDepth*0.5);
      shard.rotation.z = Math.PI / 4;
      group.add(shard);
    }
  }
  // Database, security, and natural cluster forms
  else if (['giant_trees', 'forest_repository', 'redwood_archive', 'redwood_towers'].includes(shape)) {
    bodyWidth *= 0.9; bodyDepth *= 0.9; visualHeight *= 1.1;
    body = new THREE.Mesh(new THREE.CylinderGeometry(bodyWidth*0.3, bodyWidth*0.6, visualHeight, 7), bodyMaterial);
    top = new THREE.Mesh(new THREE.DodecahedronGeometry(bodyWidth*0.8, 1), topMaterial);
    top.position.y = visualHeight / 2;
    if (isHighDetail) {
      const root = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.3, visualHeight*0.5, 5), bodyMaterial);
      root.position.set(bodyWidth*0.4, -visualHeight*0.25, 0);
      root.rotation.z = -Math.PI / 6;
      group.add(root);
    }
  }
  // Agent and network signal forms
  else if (['holographic', 'floating_stations', 'ether_realm', 'holographic_forms'].includes(shape)) {
    bodyWidth *= 0.9; bodyDepth *= 0.9; visualHeight *= 0.9;
    body = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth, visualHeight, bodyDepth), glassMaterial);
    body.position.y += visualHeight * 0.3; // Floating!
    top = new THREE.Mesh(new THREE.TetrahedronGeometry(bodyWidth*0.6, 0), topMaterial);
    top.position.y = visualHeight + visualHeight*0.3;
    if (isHighDetail) {
      const halo = new THREE.Mesh(new THREE.TorusGeometry(bodyWidth*0.8, 0.05, 16, 32), topMaterial);
      halo.position.y = visualHeight*0.5;
      halo.rotation.x = Math.PI / 2;
      group.add(halo);
    }
  }
  // Base default styles for everything else
  else {
    bodyWidth *= 0.8; bodyDepth *= 0.8; visualHeight *= 0.8;
    body = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth, visualHeight, bodyDepth), bodyMaterial);
    top = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth*0.9, visualHeight*0.1, bodyDepth*0.9), topMaterial);
    top.position.y = visualHeight / 2 + visualHeight*0.05;
  }

  // Adjust body Y position to sit on ground unless it was explicitly floated
  if (body.position.y === 0) {
    body.position.y = visualHeight / 2;
  }

  body.userData.repoId = repo.id;
  top.userData.repoId = repo.id;
  group.add(body);
  group.add(top);

  // Instanced Windows
  const showWindows = repo.stars >= 50 && !['lava_foundries', 'volcano_forge', 'giant_trees', 'caves'].includes(shape);
  let windows: THREE.InstancedMesh;
  if (showWindows) {
    const windowGeometry = new THREE.PlaneGeometry(0.2, 0.15);
    const windowMaterial = new THREE.MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0.4, depthWrite: false });
    const cols = Math.max(1, Math.floor(bodyWidth / 1.5));
    const rows = Math.max(1, Math.floor(visualHeight / 4));
    const litWindows = [];
    const dummy = new THREE.Object3D();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() > 0.4) {
          const wx = -bodyWidth/2 + 0.3 + c * (bodyWidth / cols);
          const wy = visualHeight*0.2 + r * (visualHeight*0.8 / rows);
          dummy.position.set(wx, wy, bodyDepth/2 + 0.05);
          dummy.updateMatrix();
          litWindows.push(dummy.matrix.clone());
        }
      }
    }
    windows = new THREE.InstancedMesh(windowGeometry, windowMaterial, Math.max(1, litWindows.length));
    litWindows.forEach((mat, i) => windows.setMatrixAt(i, mat));
  } else {
    windows = new THREE.InstancedMesh(new THREE.PlaneGeometry(0,0), new THREE.MeshBasicMaterial(), 1);
    windows.visible = false;
  }
  windows.userData.repoId = repo.id;
  group.add(windows);

  const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), new THREE.MeshBasicMaterial());
  const ring = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), new THREE.MeshBasicMaterial());
  beacon.visible = false; ring.visible = false;
  group.add(beacon, ring);

  return {
    repo,
    district,
    group,
    body: body as RepoBuildingMesh,
    top: top as RepoBuildingMesh,
    windows: windows as RepoWindowsMesh,
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
    flatShading: false,
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
  const geometry = new THREE.PlaneGeometry(1060, 1060, 84, 84);
  const positions = geometry.attributes.position as THREE.BufferAttribute;
  const hillAnchors = [
    { x: -210, z: -190, r: 180, h: 4.4 },
    { x: 225, z: -170, r: 170, h: 5.2 },
    { x: -255, z: 185, r: 190, h: 3.6 },
    { x: 245, z: 220, r: 210, h: 3.8 },
    { x: 0, z: -250, r: 150, h: 3.4 },
    { x: 20, z: 260, r: 170, h: 3.2 },
    { x: 85, z: 30, r: 210, h: 4.1 },
    { x: -320, z: 12, r: 135, h: 4.7 },
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
    positions.setZ(index, Math.max(0, y - cityBowl * 0.38));
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();

  const dayOpacity = 0;
  const nightOpacity = 0;
  const terrain = new THREE.Mesh(geometry, createTerrainMaterial('#2f8a4f', dayOpacity, nightOpacity));
  terrain.rotation.x = -Math.PI / 2;
  terrain.position.y = -0.07;
  terrain.renderOrder = -2;
  markLandscape(terrain, dayOpacity, nightOpacity);
  scene.add(terrain);
  return terrain;
}

function generateBiomeTexture(biomeType: string, size: number = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  if (biomeType === 'lava') {
    // Volcanic cracked rock with lava veins
    const bg = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    bg.addColorStop(0, '#1a0a05');
    bg.addColorStop(1, '#0d0503');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);
    // Lava cracks
    ctx.strokeStyle = '#ff3300';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 30; i++) {
      ctx.beginPath();
      let x = Math.random() * size;
      let y = Math.random() * size;
      ctx.moveTo(x, y);
      for (let s = 0; s < 6; s++) {
        x += (Math.random() - 0.5) * 60;
        y += (Math.random() - 0.5) * 60;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // Ember spots
    ctx.globalAlpha = 0.4;
    for (let i = 0; i < 20; i++) {
      const grad = ctx.createRadialGradient(Math.random()*size, Math.random()*size, 0, Math.random()*size, Math.random()*size, 15+Math.random()*25);
      grad.addColorStop(0, '#ff6600');
      grad.addColorStop(1, 'rgba(255,30,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    }
    ctx.globalAlpha = 1;
  } else if (biomeType === 'ice') {
    // Frozen tundra with cracks
    const bg = ctx.createLinearGradient(0, 0, size, size);
    bg.addColorStop(0, '#c8e6f0');
    bg.addColorStop(0.5, '#a8d4e8');
    bg.addColorStop(1, '#d0eaf5');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);
    // Ice fractures
    ctx.strokeStyle = '#e8f4f8';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      let x = Math.random() * size;
      let y = Math.random() * size;
      ctx.moveTo(x, y);
      for (let s = 0; s < 4; s++) {
        x += (Math.random() - 0.5) * 80;
        y += (Math.random() - 0.5) * 30;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // Snow drifts
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < 15; i++) {
      ctx.beginPath();
      ctx.arc(Math.random()*size, Math.random()*size, 20+Math.random()*40, 0, Math.PI*2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (biomeType === 'forest') {
    // Dense moss and undergrowth
    ctx.fillStyle = '#0a2e1a';
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 5 + Math.random() * 20;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, ['#166534','#14532d','#1a4731','#064e3b'][i%4]);
      grad.addColorStop(1, 'rgba(10,46,26,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Fallen leaves / debris
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = ['#854d0e','#713f12','#92400e','#065f46'][i%4];
      ctx.fillRect(Math.random()*size, Math.random()*size, 2+Math.random()*6, 1+Math.random()*3);
    }
    ctx.globalAlpha = 1;
  } else if (biomeType === 'crystal') {
    // Purple/cyan crystal cave floor
    ctx.fillStyle = '#0f0520';
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 0.4;
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, 15+Math.random()*30);
      grad.addColorStop(0, ['#a78bfa','#c084fc','#7c3aed','#06b6d4'][i%4]);
      grad.addColorStop(1, 'rgba(15,5,32,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, 15+Math.random()*30, 0, Math.PI*2);
      ctx.fill();
    }
    // Crystalline highlights
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = '#e9d5ff';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      const cx = Math.random() * size;
      const cy = Math.random() * size;
      for (let j = 0; j < 6; j++) {
        const angle = (j / 6) * Math.PI * 2;
        const len = 10 + Math.random() * 20;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (biomeType === 'desert') {
    // Sandy dunes
    const bg = ctx.createLinearGradient(0, 0, size, size);
    bg.addColorStop(0, '#78716c');
    bg.addColorStop(0.5, '#57534e');
    bg.addColorStop(1, '#44403c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);
    // Sand ripples
    ctx.strokeStyle = '#a8a29e';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 60; i++) {
      ctx.beginPath();
      const y = Math.random() * size;
      ctx.moveTo(0, y);
      for (let x = 0; x < size; x += 20) {
        ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 5);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (biomeType === 'cyber') {
    // Neon grid floor
    ctx.fillStyle = '#060e15';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < size; i += 32) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
    }
    // Glow nodes at intersections
    ctx.globalAlpha = 0.2;
    for (let i = 0; i < size; i += 64) {
      for (let j = 0; j < size; j += 64) {
        const grad = ctx.createRadialGradient(i, j, 0, i, j, 8);
        grad.addColorStop(0, '#38bdf8');
        grad.addColorStop(1, 'rgba(6,14,21,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(i-8, j-8, 16, 16);
      }
    }
    ctx.globalAlpha = 1;
  } else if (biomeType === 'wasteland') {
    // Corrupted toxic ground
    ctx.fillStyle = '#1a0a20';
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 0.4;
    for (let i = 0; i < 40; i++) {
      const grad = ctx.createRadialGradient(Math.random()*size, Math.random()*size, 0, Math.random()*size, Math.random()*size, 20+Math.random()*40);
      grad.addColorStop(0, ['#d946ef','#a855f7','#ec4899','#f43f5e'][i%4]);
      grad.addColorStop(1, 'rgba(26,10,32,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    }
    ctx.globalAlpha = 1;
  } else {
    // Default: industrial concrete
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 0.2;
    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#292524' : '#1c1917';
      ctx.fillRect(Math.random()*size, Math.random()*size, 4+Math.random()*16, 4+Math.random()*16);
    }
    ctx.globalAlpha = 1;
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function biomeTypeForDistrict(district: District): string {
  const k = district.key;
  if (k === 'volcano_forge') return 'lava';
  if (k === 'frozen_kingdom') return 'ice';
  if (['forest_repository', 'jungle_canopy', 'bamboo_valley', 'overgrown_ruins', 'redwood_archive'].includes(k)) return 'forest';
  if (['crystal_fields', 'ether_realm', 'floating_island'].includes(k)) return 'crystal';
  if (['ruined_empire', 'corruption_wasteland'].includes(k)) return 'wasteland';
  if (['nomad_camps', 'valley_villages', 'coastal_fishing'].includes(k)) return 'desert';
  if (['neon_alley', 'tech_suburbs', 'canyon_networks'].includes(k)) return 'cyber';
  return 'concrete';
}

function createDistrictLandscaping(scene: THREE.Scene, district: District, districtIndex: number) {
  const centerX = district.x;
  const centerZ = district.z + 2;
  const biome = biomeTypeForDistrict(district);

  // Soft, organic biome patch for this district.
  const groundTex = generateBiomeTexture(biome, 512);
  groundTex.repeat.set(2, 2);
  const groundSize = 100;
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(groundSize * 0.56, 56),
    new THREE.MeshStandardMaterial({
      map: groundTex,
      roughness: 0.9,
      metalness: biome === 'cyber' ? 0.3 : 0.05,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    }),
  );
  (ground.material as THREE.MeshStandardMaterial).userData.dayOpacity = 0.12;
  (ground.material as THREE.MeshStandardMaterial).userData.nightOpacity = 0.2;
  ground.rotation.x = -Math.PI / 2;
  ground.rotation.z = seededUnit(districtIndex + 5.91) * Math.PI;
  ground.scale.set(1.16 + seededUnit(districtIndex + 8.4) * 0.22, 0.82 + seededUnit(districtIndex + 11.2) * 0.18, 1);
  ground.position.set(centerX, -0.42, centerZ);
  ground.renderOrder = -1;
  ground.userData.role = 'landscape';
  ground.userData.dayOpacity = 0.12;
  ground.userData.nightOpacity = 0.2;
  scene.add(ground);

  // Soft biome edge shadow, kept subtle so districts feel like terrain rather than tokens.
  const fadeRing = new THREE.Mesh(
    new THREE.RingGeometry(groundSize * 0.48, groundSize * 0.56, 48),
    new THREE.MeshBasicMaterial({
      color: '#071019',
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    }),
  );
  (fadeRing.material as THREE.MeshBasicMaterial).userData.dayOpacity = 0.08;
  (fadeRing.material as THREE.MeshBasicMaterial).userData.nightOpacity = 0.16;
  fadeRing.rotation.x = -Math.PI / 2;
  fadeRing.scale.copy(ground.scale);
  fadeRing.position.set(centerX, -0.4, centerZ);
  fadeRing.userData.role = 'landscape';
  fadeRing.userData.dayOpacity = 0.08;
  fadeRing.userData.nightOpacity = 0.16;
  scene.add(fadeRing);

  // 3D Environmental props per biome
  if (biome === 'lava') {
    // Lava pools
    for (let i = 0; i < 6; i++) {
      const pool = new THREE.Mesh(
        new THREE.CircleGeometry(3 + Math.random() * 5, 16),
        new THREE.MeshBasicMaterial({ color: '#ff3300', transparent: true, opacity: 0.7 }),
      );
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(centerX + (Math.random()-0.5)*60, 0.05, centerZ + (Math.random()-0.5)*60);
      scene.add(pool);
    }
    // Rock pillars
    for (let i = 0; i < 8; i++) {
      const rock = new THREE.Mesh(
        new THREE.ConeGeometry(1.5 + Math.random()*2, 3 + Math.random()*5, 5),
        new THREE.MeshStandardMaterial({ color: '#292524', roughness: 0.95 }),
      );
      rock.position.set(centerX + (Math.random()-0.5)*70, 1.5, centerZ + (Math.random()-0.5)*70);
      scene.add(rock);
    }
  } else if (biome === 'ice') {
    // Ice shards sticking up
    for (let i = 0; i < 12; i++) {
      const shard = new THREE.Mesh(
        new THREE.ConeGeometry(0.8+Math.random()*1.5, 4+Math.random()*8, 4),
        new THREE.MeshStandardMaterial({ color: '#bae6fd', roughness: 0.15, metalness: 0.6, transparent: true, opacity: 0.7 }),
      );
      shard.position.set(centerX + (Math.random()-0.5)*80, 2, centerZ + (Math.random()-0.5)*80);
      shard.rotation.z = (Math.random()-0.5)*0.3;
      scene.add(shard);
    }
  } else if (biome === 'forest') {
    // Undergrowth mounds
    for (let i = 0; i < 10; i++) {
      const mound = new THREE.Mesh(
        new THREE.SphereGeometry(3+Math.random()*4, 8, 6),
        new THREE.MeshStandardMaterial({ color: ['#166534','#14532d','#064e3b'][i%3], roughness: 0.95 }),
      );
      mound.position.set(centerX + (Math.random()-0.5)*80, 0.5, centerZ + (Math.random()-0.5)*80);
      mound.scale.y = 0.4;
      scene.add(mound);
    }
    // Small mushroom/plant shapes
    for (let i = 0; i < 6; i++) {
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.3, 2+Math.random()*3, 6),
        new THREE.MeshStandardMaterial({ color: '#854d0e', roughness: 0.9 }),
      );
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(1+Math.random(), 8, 6),
        new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.8 }),
      );
      const x = centerX + (Math.random()-0.5)*70;
      const z = centerZ + (Math.random()-0.5)*70;
      stem.position.set(x, 1.5, z);
      cap.position.set(x, 3 + Math.random()*2, z);
      cap.scale.y = 0.5;
      scene.add(stem, cap);
    }
  } else if (biome === 'crystal') {
    // Floating crystal clusters
    for (let i = 0; i < 8; i++) {
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.5+Math.random()*2, 0),
        new THREE.MeshStandardMaterial({ color: ['#a78bfa','#c084fc','#06b6d4'][i%3], roughness: 0.1, metalness: 0.7, transparent: true, opacity: 0.8 }),
      );
      crystal.position.set(centerX + (Math.random()-0.5)*70, 1+Math.random()*4, centerZ + (Math.random()-0.5)*70);
      crystal.rotation.set(Math.random(), Math.random(), Math.random());
      scene.add(crystal);
    }
  } else if (biome === 'wasteland') {
    // Broken slabs
    for (let i = 0; i < 10; i++) {
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(4+Math.random()*6, 0.5+Math.random()*2, 3+Math.random()*5),
        new THREE.MeshStandardMaterial({ color: '#44403c', roughness: 0.9 }),
      );
      slab.position.set(centerX + (Math.random()-0.5)*70, 0.5, centerZ + (Math.random()-0.5)*70);
      slab.rotation.set((Math.random()-0.5)*0.4, Math.random()*Math.PI, (Math.random()-0.5)*0.3);
      scene.add(slab);
    }
  } else if (biome === 'cyber') {
    // Holographic panels
    for (let i = 0; i < 5; i++) {
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(3+Math.random()*4, 2+Math.random()*3),
        new THREE.MeshBasicMaterial({ color: ['#0ea5e9','#38bdf8','#06b6d4'][i%3], transparent: true, opacity: 0.15, side: THREE.DoubleSide }),
      );
      panel.position.set(centerX + (Math.random()-0.5)*60, 3+Math.random()*5, centerZ + (Math.random()-0.5)*60);
      panel.rotation.y = Math.random() * Math.PI;
      scene.add(panel);
    }
  }
}

function createGround(scene: THREE.Scene) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Painterly atlas terrain base
  const base = ctx.createLinearGradient(0, 0, 512, 512);
  base.addColorStop(0, '#23354b');
  base.addColorStop(0.38, '#223246');
  base.addColorStop(0.72, '#172637');
  base.addColorStop(1, '#0f1d2f');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);

  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 120; i += 1) {
    const x = seededUnit(i + 0.31) * 512;
    const y = seededUnit(i + 4.73) * 512;
    const width = 22 + seededUnit(i + 7.19) * 72;
    const height = 5 + seededUnit(i + 9.41) * 18;
    ctx.fillStyle = i % 3 === 0 ? '#314d68' : i % 3 === 1 ? '#253a52' : '#4f4538';
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((seededUnit(i + 12.4) - 0.5) * 0.9);
    roundRect(ctx, -width / 2, -height / 2, width, height, 8);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 0.035;
  ctx.strokeStyle = '#86a6cf';
  ctx.lineWidth = 1;
  for (let i = 0; i < 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 28, 512);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(10, 10);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 4000, 1, 1),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.56,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.5;
  ground.receiveShadow = true;
  ground.userData.role = 'ground';
  scene.add(ground);

  createRollingTerrain(scene);

  const grid = new THREE.GridHelper(4000, 180, '#4b97de', '#1d3251');
  grid.userData.role = 'grid';
  const gridMaterial = grid.material as THREE.Material;
  gridMaterial.transparent = true;
  gridMaterial.opacity = 0.045;
  grid.position.y = -0.75;
  scene.add(grid);

  DISTRICTS.forEach((district, districtIndex) => {
    const isNature = ['forest_repository', 'jungle_canopy', 'bamboo_valley', 'overgrown_ruins'].includes(district.key);
    const isLava = district.key === 'volcano_forge';
    const isIce = district.key === 'frozen_kingdom';

    let planeColor = district.color;
    if (isNature) planeColor = '#1f3a2f';
    if (isLava) planeColor = '#4a1810';
    if (isIce) planeColor = '#b8d6f2';

    const plane = new THREE.Mesh(
      new THREE.CircleGeometry(54, 48),
      new THREE.MeshBasicMaterial({
        color: planeColor,
        transparent: true,
        opacity: isNature ? 0.2 : 0.16,
        depthWrite: false,
      }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.rotation.z = seededUnit(districtIndex + 13.7) * Math.PI;
    plane.scale.set(1.2 + seededUnit(districtIndex + 15.1) * 0.25, 0.84 + seededUnit(districtIndex + 16.8) * 0.18, 1);
    plane.position.set(district.x, -0.2, district.z + 2);
    plane.userData.role = 'district-plane';
    scene.add(plane);

    createDistrictLandscaping(scene, district, districtIndex);
  });
}

function createMountainBackdrop(scene: THREE.Scene) {
  const group = new THREE.Group();
  const mountainMaterial = new THREE.MeshStandardMaterial({
    color: '#1c2a42',
    roughness: 0.82,
    metalness: 0.04,
    emissive: '#101a30',
    emissiveIntensity: 0.07,
  });
  const snowMaterial = new THREE.MeshStandardMaterial({
    color: '#e2edf9',
    roughness: 0.62,
    metalness: 0.02,
  });

  for (let i = 0; i < 22; i += 1) {
    const width = 26 + seededUnit(i + 0.2) * 42;
    const height = 18 + seededUnit(i + 1.8) * 48;
    const x = -650 + i * 62 + seededUnit(i + 3.6) * 28;
    const z = -900 - seededUnit(i + 4.4) * 170;
    const mountain = new THREE.Mesh(new THREE.ConeGeometry(width, height, 6), mountainMaterial);
    mountain.position.set(x, height / 2 - 20, z);
    mountain.rotation.y = seededUnit(i + 5.1) * Math.PI;
    group.add(mountain);

    const snow = new THREE.Mesh(new THREE.ConeGeometry(width * 0.24, height * 0.11, 6), snowMaterial);
    snow.position.set(x, height * 0.78 - 16, z);
    snow.rotation.y = mountain.rotation.y;
    group.add(snow);
  }

  group.userData.role = 'mountains';
  scene.add(group);
}

function createSky(scene: THREE.Scene) {
  // Stars
  const starGeometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  for (let i = 0; i < 800; i += 1) {
    const radius = 600 + Math.random() * 1200;
    const theta = Math.random() * Math.PI * 2;
    const y = 60 + Math.random() * 500;
    positions.push(Math.cos(theta) * radius, y, Math.sin(theta) * radius);
  }
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      color: '#dbeafe',
      size: 0.4,
      transparent: true,
      opacity: 0.52,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  stars.userData.role = 'stars';
  scene.add(stars);

  // Sky Dome with gradient
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 512;
  skyCanvas.height = 512;
  const skyCtx = skyCanvas.getContext('2d')!;
  const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 512);
  skyGrad.addColorStop(0, '#030814');
  skyGrad.addColorStop(0.28, '#0a1430');
  skyGrad.addColorStop(0.62, '#121f44');
  skyGrad.addColorStop(1, '#0a122a');
  skyCtx.fillStyle = skyGrad;
  skyCtx.fillRect(0, 0, 512, 512);
  // Nebula wisps
  skyCtx.globalAlpha = 0.08;
  for (let i = 0; i < 40; i++) {
    skyCtx.beginPath();
    skyCtx.arc(Math.random()*512, Math.random()*256, 30+Math.random()*80, 0, Math.PI*2);
    skyCtx.fillStyle = ['#3b82f6','#8b5cf6','#06b6d4','#fb7185'][i%4];
    skyCtx.fill();
  }
  skyCtx.globalAlpha = 1;
  const skyTexture = new THREE.CanvasTexture(skyCanvas);
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(2500, 32, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.BackSide, transparent: true, opacity: 1, depthWrite: false }),
  );
  skyDome.userData.role = 'sky-dome';
  scene.add(skyDome);

  // Cloud layers
  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = 1024;
  cloudCanvas.height = 1024;
  const cloudCtx = cloudCanvas.getContext('2d')!;
  cloudCtx.fillStyle = 'rgba(0,0,0,0)';
  cloudCtx.fillRect(0, 0, 1024, 1024);
  cloudCtx.globalAlpha = 0.08;
  for (let i = 0; i < 60; i++) {
    const cx = Math.random() * 1024;
    const cy = Math.random() * 1024;
    const radius = 40 + Math.random() * 120;
    const grad = cloudCtx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, 'rgba(180,200,220,0.6)');
    grad.addColorStop(0.5, 'rgba(140,160,180,0.3)');
    grad.addColorStop(1, 'rgba(100,120,140,0)');
    cloudCtx.fillStyle = grad;
    cloudCtx.beginPath();
    cloudCtx.arc(cx, cy, radius, 0, Math.PI * 2);
    cloudCtx.fill();
  }
  cloudCtx.globalAlpha = 1;
  const cloudTexture = new THREE.CanvasTexture(cloudCanvas);
  cloudTexture.wrapS = THREE.RepeatWrapping;
  cloudTexture.wrapT = THREE.RepeatWrapping;
  const cloudPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(3000, 3000),
    new THREE.MeshBasicMaterial({ map: cloudTexture, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  cloudPlane.rotation.x = -Math.PI / 2;
  cloudPlane.position.y = 350;
  cloudPlane.userData.role = 'clouds';
  scene.add(cloudPlane);

  // Lower cloud layer
  const cloud2 = cloudPlane.clone();
  cloud2.position.y = 220;
  cloud2.rotation.z = Math.PI / 3;
  (cloud2.material as THREE.MeshBasicMaterial).opacity = 0.2;
  cloud2.userData.role = 'clouds-low';
  scene.add(cloud2);
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
    if (distance < 5 || distance > (isDistrictTrunk ? 400 : 250)) return;

    roadPairs.add(pairKey);

    const openWork = Math.max(1, getOpenWorkItems(source.repo));
    const flowStrength = clamp(Math.log10(openWork + source.repo.prs.length * 40 + 8) / 3.25, 0.22, 1);
    const pathColor = flowColorFor(source);
    const baseOpacity = clamp(0.28 + flowStrength * 0.46, 0.34, 0.86);
    const radius = clamp(0.08 + flowStrength * 0.15, 0.1, 0.25);

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

    const packetCount = Math.max(3, Math.min(packetBudget, Math.round(4 + flowStrength * 8.0 + Math.min(5, source.repo.prs.length))));
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
        opacity: 0.96,
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
      speed: 0.15 + flowStrength * 0.15 + (source.repo.stars % 7) * 0.01,
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
