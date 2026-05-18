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
  beacon: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
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
  cars: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>[];
  label: THREE.Sprite;
  speed: number;
  phase: number;
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
  add('PR review cadence', repo.openPRs > 0 ? 'Open PR activity is visible.' : 'PR activity is not visible.', SAFETY_WEIGHTS.prCadence, repo.openPRs > 0 ? 3 : 0);
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

function buildRepoFromGithub(payload: GitHubRepoPayload, wantsContributions: boolean): Repo {
  const owner = payload.owner?.login || (payload.full_name?.split('/')[0] ?? 'github');
  const name = payload.name;
  const topics = payload.topics ?? [];
  const stars = payload.stargazers_count ?? 0;
  const openIssues = payload.open_issues_count ?? 0;
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
    openPRs: openIssues,
    commitsPerWeek,
    contributors: clamp(Math.round(Math.sqrt(Math.max(1, stars)) * 4), 8, 1200),
    goodFirstIssues: hasStarterSignals ? Math.max(3, Math.min(24, Math.round(openIssues * 0.18))) : 0,
    safetyScore: 80,
    verifiedMaintainers: !payload.archived,
    branchProtection: stars >= 100,
    signedReleases: false,
    responseHours: daysSincePush <= 7 ? 18 : daysSincePush <= 30 ? 36 : 72,
    topics,
    prs: [],
    contributionGuide: wantsContributions,
    issueTemplates: hasStarterSignals,
    smallScopedIssues: hasStarterSignals || openIssues > 0,
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
  const openIssues = node.openIssues ?? 0;
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
    openPRs: openIssues,
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
const CAMERA_HOME = new THREE.Vector3(4, 58, 54);
const TARGET_HOME = new THREE.Vector3(2, 1.8, -1);
const MIN_ZOOM = 0.62;
const MAX_ZOOM = 1.55;

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
    body: 'Hover a building to preview its safety score, stars, and open PRs. Click a tower to fly closer and open the repo detail panel.',
    action: 'Try clicking a tower with a bright roof beacon.',
  },
  {
    title: 'Follow PR Traffic',
    body: 'Glowing roads are pull-request relationships. Moving cars are activity pulses, so busy collaboration paths feel alive instead of sitting as static lines.',
    action: 'Look for roads with multiple cars crossing districts.',
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
  const activity = clamp((repo.commitsPerWeek * 0.7 + repo.openPRs * 0.45) / 260, 0.08, 1);
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

function includesAny(haystack: string, terms: string[]) {
  return terms.some((term) => haystack.includes(term.toLowerCase()));
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
  if (haystacks.district.includes(cleanQuery) || tokens.some((token) => haystacks.district.includes(token))) {
    addPing('type', `${district.label} district`, 78);
  }

  const matchedTopics = repo.topics.filter((topic) => tokens.some((token) => topic.toLowerCase().includes(token)) || cleanQuery.includes(topic.toLowerCase()));
  if (matchedTopics.length) addPing('topic', matchedTopics.slice(0, 3).join(', '), 58 + matchedTopics.length * 8);

  if (tokens.some((token) => haystacks.description.includes(token)) || haystacks.description.includes(cleanQuery)) {
    addPing('function', repo.description, 42);
  }

  const matchedPr = repo.prs.find((pr) => tokens.some((token) => pr.title.toLowerCase().includes(token)) || pr.title.toLowerCase().includes(cleanQuery));
  if (matchedPr) addPing('PR activity', `PR #${matchedPr.number}: ${matchedPr.title}`, 38);

  FUNCTION_ALIASES.forEach((alias) => {
    if (!includesAny(cleanQuery, alias.terms)) return;
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

  if (includesAny(cleanQuery, ['safe', 'trusted', 'secure', 'beginner', 'contribute', 'good first'])) {
    const topReason = repo.safetyProfile?.reasons[0]?.label ?? `${repo.goodFirstIssues} good-first issues`;
    addPing('safety', `${repo.safetyScore}% contribution-ready · ${topReason}`, Math.round(repo.safetyScore * 0.72 + repo.goodFirstIssues * 0.35));
  }

  if (includesAny(cleanQuery, ['popular', 'stars', 'big', 'famous'])) {
    addPing('popularity', `${formatMetric(repo.stars)} stars`, Math.min(86, Math.log10(repo.stars) * 16));
  }

  if (includesAny(cleanQuery, ['active', 'activity', 'prs', 'commits', 'traffic', 'busy'])) {
    addPing('activity', `${repo.commitsPerWeek} commits/week and ${repo.openPRs} open PRs`, Math.min(90, repo.commitsPerWeek / 4 + repo.openPRs / 12));
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
  const x = district.x + (column - (gridWidth - 1) / 2) * 9.2 + stagger + Math.sin((repo.stars % 41) * 0.18) * 0.9;
  const z = district.z + (row - (gridWidth - 1) / 2) * 9.9 + (column % 2) * 2.1 + Math.cos((repo.forks % 37) * 0.15) * 0.9;

  let scaleDriver = scale.stars;
  if (heightScaleDriver === 'activity') {
    scaleDriver = scale.activity;
  } else if (heightScaleDriver === 'contributors') {
    scaleDriver = scale.community;
  }

  const heightBias =
    district.shape === 'spires' || district.shape === 'megatowers' || district.shape === 'vertical_arcology' ? 1.18 :
    district.shape === 'suburbs' || district.shape === 'tents' || district.shape === 'fishing_docks' ? 0.72 :
    district.shape === 'blocks' || district.shape === 'lava_foundries' ? 0.9 :
    1;
  const height = clamp(6 + Math.pow(scaleDriver, 1.16) * 38 * heightBias + scale.activity * 5, 7, 48);
  const widthBias =
    district.shape === 'blocks' || district.shape === 'apartments' || district.shape === 'valley_villages' ? 1.28 :
    district.shape === 'glass' || district.shape === 'crystal_spires' ? 0.92 :
    district.shape === 'spires' || district.shape === 'citadel' ? 0.84 :
    1;
  const width = clamp(2.8 + scale.forks * 5.3 + scale.activity * 1.7, 3, 8.8) * widthBias;
  const depth = clamp(3 + scale.community * 4.9 + scale.beginnerSurface * 1.2, 3.2, 9.4) * (district.shape === 'blocks' ? 1.18 : 1);

  return {
    position: new THREE.Vector3(x, 0, z),
    height,
    width,
    depth,
  };
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
  refs.scene.background = new THREE.Color(isDay ? '#bcd7ff' : '#020408');
  refs.scene.fog = new THREE.FogExp2(isDay ? '#9dbce7' : '#071126', isDay ? 0.008 : 0.012);
  refs.renderer.toneMappingExposure = isDay ? 1.18 : 1.05;
  refs.ambient.color.set(isDay ? '#dbeafe' : '#7c9edb');
  refs.ambient.intensity = isDay ? 1.3 : 0.7;
  refs.key.color.set(isDay ? '#fff4cf' : '#dbe8ff');
  refs.key.intensity = isDay ? 3.2 : 2.4;
  refs.rim.color.set(isDay ? '#7bbcff' : '#4f8cff');
  refs.rim.intensity = isDay ? 38 : 68;

  refs.scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    const role = mesh.userData.role;
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (!material) return;

    if (role === 'ground') {
      const groundMaterial = material as THREE.MeshBasicMaterial;
      groundMaterial.color.set(isDay ? '#ffffff' : '#6688aa');
    }

    if (role === 'grid') setMaterialOpacity(material, isDay ? 0.16 : 0.23);
    if (role === 'stars') setMaterialOpacity(material, isDay ? 0.12 : 0.64);
    if (role === 'moon') setMaterialOpacity(material, isDay ? 0.025 : 0.08);
    if (role === 'district-plane') setMaterialOpacity(material, isDay ? 0.075 : 0.055);
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
    road.mesh.material.opacity = sourceActive || targetActive ? 0.5 : 0.08;
    road.label.material.opacity = sourceActive || targetActive ? 0.68 : 0.1;
    road.cars.forEach((car) => {
      (car.material as THREE.MeshBasicMaterial).opacity = sourceActive || targetActive ? 0.95 : 0.16;
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
  const appearanceRef = useRef<Appearance>('night');
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
      .sort((a, b) => (b.goodFirstIssues * 12 + b.safetyScore + b.openPRs * 0.4) - (a.goodFirstIssues * 12 + a.safetyScore + a.openPRs * 0.4))
      .slice(0, 3);
  }, [effectiveRepos]);

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
    fetch('/api/py/safety-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repos: allRepos }),
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Safety scoring failed with ${response.status}`);
        return response.json();
      })
      .then((payload: { profiles?: Record<string, SafetyProfile> }) => {
        if (!cancelled && payload.profiles) {
          setSafetyProfiles(payload.profiles);
        }
      })
      .catch((error) => {
        console.warn('[Safety scoring] Using local fallback formula:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [allRepos]);

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

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight('#9fcfc0', 0.7);
    scene.add(ambient);

    const key = new THREE.DirectionalLight('#dbe8ff', 2.4);
    key.position.set(-22, 48, 20);
    key.castShadow = true;
    key.shadow.mapSize.width = 2048;
    key.shadow.mapSize.height = 2048;
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
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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
    let prevMouseX = 0;
    let prevMouseY = 0;
    const keysPressed: Record<string, boolean> = {};

    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed[e.key.toLowerCase()] = true;
      if (['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
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
        isDragging = true;
        prevMouseX = event.clientX;
        prevMouseY = event.clientY;
      }
    };
    const handlePointerUp = () => {
      isDragging = false;
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
          setSelectedRepo(null);
        }

        // Pan the camera based on delta movement (scaled by zoom)
        const panScale = 0.42 * refs.zoom;
        if (event.shiftKey) {
          // Adjust vertical angle/height when holding Shift
          freeNavY -= deltaY * panScale * 1.5;
          freeNavY = clamp(freeNavY, -165, 350);
        } else {
          // Normal panning
          freeNavX -= deltaX * panScale;
          freeNavZ -= deltaY * panScale;
        }
      }
    };

    const handlePointerLeave = () => {
      refs.pointer.set(9, 9);
      setHoveredRepo(null);
      renderer.domElement.style.cursor = 'default';
      if (tooltipRef.current) tooltipRef.current.style.opacity = '0';
    };

    const handleClick = () => {
      if (!hoverRef.current) return;
      setSelectedRepo(hoverRef.current);
    };

    const animate = () => {
      const now = performance.now();
      const elapsed = (now - refs.startedAt) / 1000;
      const introT = easeInOutCubic((now - refs.startedAt) / INTRO_MS);
      const entryT = refs.enteredAt ? easeOutCubic((now - refs.enteredAt) / ENTRY_MS) : 0;

      refs.raycaster.setFromCamera(refs.pointer, camera);
      const intersections = refs.raycaster.intersectObjects(
        buildings.flatMap((building) => [building.body, building.top, building.windows]),
        false,
      );
      const hovered = intersections.length ? findBuilding(intersections[0].object.userData.repoId as string | undefined) : null;
      if (hovered?.repo.id !== hoverRef.current?.id) {
        setHoveredRepo(hovered?.repo ?? null);
        renderer.domElement.style.cursor = hovered ? 'pointer' : 'default';
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
        freeNavY = clamp(freeNavY, -165, 350);

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
        THREE.MathUtils.lerp(-92, 44, introT),
        THREE.MathUtils.lerp(30, 24, introT),
        THREE.MathUtils.lerp(76, 48, introT),
      );
      const introTarget = new THREE.Vector3(THREE.MathUtils.lerp(-30, 10, introT), 6.5, THREE.MathUtils.lerp(2, -2, introT));

      let desiredPosition = introPosition;
      let desiredTarget = introTarget;

      if (enteredRef.current) {
        const freeOffset = new THREE.Vector3(freeNavX, freeNavY, freeNavZ);
        desiredPosition = CAMERA_HOME.clone().add(mouseParallax).add(freeOffset);
        desiredTarget = TARGET_HOME.clone().add(new THREE.Vector3(freeNavX, 0, freeNavZ));
      }

      if (selectedBuilding && enteredRef.current) {
        desiredPosition = selectedBuilding.position.clone().add(new THREE.Vector3(13, 17, 18));
        desiredTarget = selectedBuilding.position.clone().add(new THREE.Vector3(0, selectedBuilding.height * 0.52, 0));
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
        building.body.material.emissiveIntensity = isSelected ? 0.36 : isHovered ? 0.28 : isSimilar ? 0.22 + pulse * 0.16 : 0.035;
        building.top.material.emissiveIntensity = isSelected || isHovered ? 0.75 : 0.35 + pulse * 0.08;
        building.windows.material.opacity = isHovered || isSelected ? 0.98 : filterRef.current === 'all' ? 0.76 : building.windows.material.opacity;
        building.beacon.scale.setScalar(1 + pulse * 0.9);
        building.beacon.material.opacity = 0.32 + pulse * 0.62;
        building.ring.material.opacity = isSimilar || isSelected ? 0.22 + pulse * 0.42 : 0;
        building.ring.scale.setScalar(1 + pulse * 0.12);
      }

      for (const road of roads) {
        road.label.quaternion.copy(camera.quaternion);
        road.cars.forEach((car, carIndex) => {
          const t = (road.phase + elapsed * road.speed + carIndex / road.cars.length) % 1;
          const point = road.curve.getPointAt(t);
          car.position.copy(point);
          car.position.y += 0.22 + Math.sin(elapsed * 8 + carIndex) * 0.04;
          car.scale.setScalar(0.86 + Math.sin(elapsed * 6 + carIndex) * 0.18);
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
  }, [reposByDistrict, heightScaleDriver]);

  useEffect(() => {
    if (!entered) return undefined;
    const started = performance.now();
    let frame = 0;
    const safeRepos = effectiveRepos.filter((repo) => isGreenSafety(repo.safetyScore)).length;

    const tick = () => {
      const progress = easeOutCubic((performance.now() - started) / 1600);
      setStats({
        repos: Math.round(effectiveRepos.length * progress),
        prs: Math.round(effectiveRepos.reduce((total, repo) => total + repo.openPRs, 0) * progress),
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
    const district = DISTRICTS.find(
      (item) => lower.includes(item.label.toLowerCase()) || lower.includes(item.key) || lower.includes(item.label.split('/')[0].toLowerCase()),
    );
    const parentDistrict = DISTRICTS.map((item) => item.parent).find((parent) => lower.includes(parent));
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
      const imported = buildRepoFromGithub(payload, wantsContributions);
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
    <main className={`sift-page ${appearance === 'day' ? 'is-day' : 'is-night'}`} aria-label="SIFT 3D open-source city">
      <div ref={mountRef} className="three-stage" aria-label="Interactive 3D city of open-source repositories" />

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
            <small>{contributionStyleFor(hoveredRepo)} · {formatMetric(hoveredRepo.stars)} stars · {hoveredRepo.openPRs} PRs</small>
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
            <span>open PRs</span>
          </div>
          <div>
            <strong>{stats.safe}</strong>
            <span>safe routes</span>
          </div>
        </div>

        <div className="cinema-readout">
          <span>3D contribution atlas</span>
          <strong>height: {heightScaleDriver} · footprint: community · sectors: contribution intent</strong>
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
                <span>{repo.goodFirstIssues || repo.openPRs} starter signals</span>
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
              <span>{selectedRepo.openPRs} PRs</span>
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
          --sift-glass-surface: rgba(12,24,45,0.13);
          --sift-glass-border: rgba(255,255,255,0.28);
          --sift-text-primary: rgba(255,255,255,0.95);
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
            linear-gradient(90deg, rgba(8,20,42,0.16), transparent 22%, transparent 76%, rgba(8,20,42,0.18)),
            radial-gradient(circle at 50% 72%, transparent 24%, rgba(8,20,42,0.14) 80%);
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
            linear-gradient(135deg, rgba(8,20,42,0.52), rgba(8,20,42,0.22)),
            rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.22);
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
          transition: left 260ms ease, width 260ms ease;
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

        .stat-bar span,
        .cinema-readout span {
          font-family: "Space Mono", monospace;
          font-size: 9px;
          letter-spacing: 0;
          text-transform: uppercase;
          color: rgba(255,255,255,0.42);
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

  let baseGeo: THREE.BufferGeometry;
  let topGeo: THREE.BufferGeometry;
  let topHeightVal = 0.5;
  const subMeshes: THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>[] = [];

  // Choose geometry based on shape
  if (['spires', 'skyline_core'].includes(shape)) {
    // Stepped Spire skyscraper
    baseGeo = new THREE.CylinderGeometry(layout.width * 0.45, layout.width * 0.6, layout.height * 0.6, 16);

    const tierGeo = new THREE.CylinderGeometry(layout.width * 0.3, layout.width * 0.45, layout.height * 0.3, 16);
    const tier = new THREE.Mesh(tierGeo);
    tier.position.y = layout.height * 0.35; // relative offset
    subMeshes.push(tier);

    topGeo = new THREE.ConeGeometry(layout.width * 0.18, layout.height * 0.3, 16);
    topHeightVal = layout.height * 0.3;
  } else if (['megatowers', 'vertical_arcology'].includes(shape)) {
    // Hexagonal Megatower core with floating structural struts
    baseGeo = new THREE.BoxGeometry(layout.width * 0.5, layout.height, layout.depth * 0.5);

    const strutMat1 = new THREE.BoxGeometry(layout.width * 0.15, layout.height * 0.95, layout.depth * 1.15);
    const strut1 = new THREE.Mesh(strutMat1);
    subMeshes.push(strut1);

    const strutMat2 = new THREE.BoxGeometry(layout.width * 1.15, layout.height * 0.95, layout.depth * 0.15);
    const strut2 = new THREE.Mesh(strutMat2);
    subMeshes.push(strut2);

    topGeo = new THREE.TorusGeometry(layout.width * 0.72, 0.12, 8, 24);
    topGeo.rotateX(Math.PI / 2);
    topHeightVal = 0.25;
  } else if (['apartments', 'brick_boroughs'].includes(shape)) {
    // Dynamic contemporary Jenga apartments
    baseGeo = new THREE.BoxGeometry(layout.width * 0.85, layout.height * 0.28, layout.depth * 0.85);

    const block1 = new THREE.Mesh(new THREE.BoxGeometry(layout.width * 0.85, layout.height * 0.28, layout.depth * 0.85));
    block1.position.y = layout.height * 0.32;
    block1.rotateY(Math.PI / 4); // rotated 45 deg
    subMeshes.push(block1);

    const block2 = new THREE.Mesh(new THREE.BoxGeometry(layout.width * 0.85, layout.height * 0.28, layout.depth * 0.85));
    block2.position.y = layout.height * 0.64;
    block2.rotateY(Math.PI / 2); // rotated 90 deg
    subMeshes.push(block2);

    topGeo = new THREE.CylinderGeometry(layout.width * 0.45, layout.width * 0.45, 0.1, 16);
    topHeightVal = 0.1;
  } else if (['suburban_homes', 'rooftop_villages', 'suburbs', 'valley_villages', 'tents', 'nomad_camps'].includes(shape)) {
    // Beautiful triangular prism wedges representing tech tents!
    baseGeo = new THREE.CylinderGeometry(layout.width * 0.48, layout.width * 0.48, layout.height * 0.45, 3);
    baseGeo.rotateX(Math.PI / 2);

    topGeo = new THREE.ConeGeometry(layout.width * 0.48, layout.height * 0.45, 4);
    topHeightVal = layout.height * 0.45;
  } else if (['glass', 'neon_alley'].includes(shape)) {
    // Tech-SaaS Tri-Disc Core
    baseGeo = new THREE.CylinderGeometry(layout.width * 0.15, layout.width * 0.15, layout.height, 12);

    const disc1 = new THREE.Mesh(new THREE.CylinderGeometry(layout.width * 0.95, layout.width * 0.95, layout.height * 0.08, 16));
    disc1.position.y = -layout.height * 0.3;
    subMeshes.push(disc1);

    const disc2 = new THREE.Mesh(new THREE.CylinderGeometry(layout.width * 0.85, layout.width * 0.85, layout.height * 0.08, 16));
    disc2.position.y = 0;
    subMeshes.push(disc2);

    const disc3 = new THREE.Mesh(new THREE.CylinderGeometry(layout.width * 0.75, layout.width * 0.75, layout.height * 0.08, 16));
    disc3.position.y = layout.height * 0.3;
    subMeshes.push(disc3);

    topGeo = new THREE.SphereGeometry(layout.width * 0.42, 24, 24);
    topHeightVal = layout.width * 0.84;
  } else if (['blocks', 'financial_district'].includes(shape)) {
    // Nested floating microservice data blocks
    baseGeo = new THREE.BoxGeometry(layout.width * 0.85, layout.height * 0.25, layout.depth * 0.85);

    const block1 = new THREE.Mesh(new THREE.BoxGeometry(layout.width * 0.65, layout.height * 0.25, layout.depth * 0.65));
    block1.position.y = layout.height * 0.35;
    subMeshes.push(block1);

    const block2 = new THREE.Mesh(new THREE.BoxGeometry(layout.width * 0.45, layout.height * 0.25, layout.depth * 0.45));
    block2.position.y = layout.height * 0.7;
    subMeshes.push(block2);

    topGeo = new THREE.OctahedronGeometry(layout.width * 0.25);
    topHeightVal = layout.width * 0.5;
  } else if (['giant_trees', 'forest_repository', 'redwood_archive', 'redwood_towers', 'mushroom_colonies'].includes(shape)) {
    // Branching organic natural tree canopy with geodesic leaf clusters
    baseGeo = new THREE.CylinderGeometry(layout.width * 0.18, layout.width * 0.32, layout.height, 12);

    const leaf1 = new THREE.Mesh(new THREE.IcosahedronGeometry(layout.width * 0.72, 1));
    leaf1.position.set(-layout.width * 0.3, layout.height * 0.25, -layout.width * 0.2);
    subMeshes.push(leaf1);

    const leaf2 = new THREE.Mesh(new THREE.IcosahedronGeometry(layout.width * 0.64, 1));
    leaf2.position.set(layout.width * 0.3, layout.height * 0.32, layout.width * 0.2);
    subMeshes.push(leaf2);

    const leaf3 = new THREE.Mesh(new THREE.IcosahedronGeometry(layout.width * 0.58, 1));
    leaf3.position.set(-layout.width * 0.2, layout.height * 0.15, layout.width * 0.3);
    subMeshes.push(leaf3);

    topGeo = new THREE.IcosahedronGeometry(layout.width * 0.85, 2);
    topHeightVal = layout.width * 1.7;
  } else if (['bamboo_pagodas', 'bamboo_valley'].includes(shape)) {
    // Realistic Asian pagoda with stacked flared eave roofs
    baseGeo = new THREE.CylinderGeometry(layout.width * 0.25, layout.width * 0.25, layout.height, 8);

    const roof1 = new THREE.Mesh(new THREE.ConeGeometry(layout.width * 1.15, layout.height * 0.15, 8));
    roof1.position.y = -layout.height * 0.2;
    subMeshes.push(roof1);

    const roof2 = new THREE.Mesh(new THREE.ConeGeometry(layout.width * 0.95, layout.height * 0.15, 8));
    roof2.position.y = layout.height * 0.12;
    subMeshes.push(roof2);

    const roof3 = new THREE.Mesh(new THREE.ConeGeometry(layout.width * 0.75, layout.height * 0.15, 8));
    roof3.position.y = layout.height * 0.4;
    subMeshes.push(roof3);

    topGeo = new THREE.CylinderGeometry(0, layout.width * 0.18, layout.height * 0.2, 8);
    topHeightVal = layout.height * 0.2;
  } else if (['crystal_spires', 'crystal_fields'].includes(shape)) {
    // Overlapping crystalline double-pyramid cluster
    const crystalBase = new THREE.OctahedronGeometry(layout.width * 0.5, 0);
    crystalBase.scale(1, 2, 1);
    baseGeo = crystalBase;

    const crystalGeo1 = new THREE.OctahedronGeometry(layout.width * 0.38, 0);
    crystalGeo1.scale(1, 1.8, 1);
    const cry1 = new THREE.Mesh(crystalGeo1);
    cry1.position.set(-layout.width * 0.25, 0, -layout.width * 0.1);
    cry1.rotateZ(0.3);
    subMeshes.push(cry1);

    const crystalGeo2 = new THREE.OctahedronGeometry(layout.width * 0.32, 0);
    crystalGeo2.scale(1, 1.8, 1);
    const cry2 = new THREE.Mesh(crystalGeo2);
    cry2.position.set(layout.width * 0.25, 0, layout.width * 0.1);
    cry2.rotateZ(-0.3);
    subMeshes.push(cry2);

    topGeo = new THREE.RingGeometry(layout.width * 1.1, layout.width * 1.3, 16);
    topGeo.rotateX(Math.PI / 2);
    topHeightVal = 0.1;
  } else if (['citadel', 'fortresses', 'castles', 'canyon_forts'].includes(shape)) {
    // Stepped setback tower.
    baseGeo = new THREE.CylinderGeometry(layout.width * 0.52, layout.width * 0.72, layout.height * 0.42, 6);

    const setback1 = new THREE.Mesh(new THREE.CylinderGeometry(layout.width * 0.38, layout.width * 0.52, layout.height * 0.32, 6));
    setback1.position.y = layout.height * 0.28;
    subMeshes.push(setback1);

    const setback2 = new THREE.Mesh(new THREE.CylinderGeometry(layout.width * 0.22, layout.width * 0.38, layout.height * 0.22, 6));
    setback2.position.y = layout.height * 0.5;
    subMeshes.push(setback2);

    topGeo = new THREE.ConeGeometry(layout.width * 0.12, layout.height * 0.25, 6);
    topHeightVal = layout.height * 0.25;
  } else if (['reactors', 'refineries', 'factories', 'lava_foundries'].includes(shape)) {
    // Industrial forge with a glowing crater core.
    baseGeo = new THREE.CylinderGeometry(layout.width * 0.28, layout.width * 0.95, layout.height, 16);

    const lavaCollar = new THREE.Mesh(new THREE.TorusGeometry(layout.width * 0.28, 0.15, 8, 16));
    lavaCollar.position.y = layout.height * 0.46;
    lavaCollar.rotateX(Math.PI / 2);
    subMeshes.push(lavaCollar);

    topGeo = new THREE.TorusGeometry(layout.width * 0.28, 0.08, 6, 12);
    topGeo.rotateX(Math.PI / 2);
    topHeightVal = 0.1;
  } else if (['caves', 'stone_villages'].includes(shape)) {
    // Textured crystalline geode.
    baseGeo = new THREE.IcosahedronGeometry(layout.width, 2);
    baseGeo.scale(1, layout.height / layout.width, 1);
    topGeo = new THREE.BoxGeometry(0.01, 0.01, 0.01);
    topHeightVal = 0.01;
  } else if (['observatories'].includes(shape)) {
    // Capsule observatory base with nested sphere dome.
    baseGeo = new THREE.CapsuleGeometry(layout.width * 0.38, layout.height * 0.42, 8, 16);
    topGeo = new THREE.SphereGeometry(layout.width * 0.55, 24, 24);
    topHeightVal = layout.width * 1.1;
  } else if (['floating_stations', 'holographic_forms', 'holographic', 'ether_realm', 'skyline_core'].includes(shape)) {
    // Floating knot form for agent and AI repositories.
    baseGeo = new THREE.TorusKnotGeometry(layout.width * 0.48, layout.width * 0.16, 64, 10, 3, 5);
    topGeo = new THREE.RingGeometry(layout.width * 1.1, layout.width * 1.35, 24);
    topGeo.rotateX(Math.PI / 2);
    group.position.y += 6 + (repo.stars % 10) * 0.5;
    topHeightVal = 0.15;
  } else if (['shipyards', 'fishing_docks'].includes(shape)) {
    // Curved bridge dock arches!
    baseGeo = new THREE.TorusGeometry(layout.width * 0.95, 0.22, 12, 24, Math.PI);
    topGeo = new THREE.CylinderGeometry(0.12, 0.12, layout.height * 0.8, 8);
    topHeightVal = layout.height * 0.8;
  } else if (['ruins', 'decayed', 'overgrown'].includes(shape)) {
    // Organic split column structure!
    baseGeo = new THREE.CylinderGeometry(layout.width * 0.45, layout.width * 0.65, layout.height * 0.72, 5);
    topGeo = new THREE.TorusKnotGeometry(layout.width * 0.32, 0.1, 24, 6, 2, 3);
    topHeightVal = layout.width * 0.64;
  } else {
    // Organic rounded fluted pillar fallback
    baseGeo = new THREE.CylinderGeometry(layout.width * 0.45, layout.width * 0.52, layout.height, 12);
    topGeo = new THREE.SphereGeometry(layout.width * 0.55, 12, 12);
    topHeightVal = layout.width * 1.1;
  }

  const isHolo = ['holographic_forms', 'holographic', 'floating_stations', 'crystal_spires', 'crystal_fields', 'ether_realm'].includes(shape);

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(district.color),
    roughness: isHolo ? 0.1 : 0.15,
    metalness: isHolo ? 0.9 : 0.85,
    emissive: new THREE.Color(district.color),
    emissiveIntensity: isHolo ? 0.8 : 0.38,
    wireframe: isHolo,
    transparent: isHolo,
    opacity: isHolo ? 0.5 : 1,
  });

  const body: RepoBuildingMesh = new THREE.Mesh(baseGeo, bodyMaterial);
  body.position.y = layout.height / 2;
  body.castShadow = !isHolo;
  body.receiveShadow = !isHolo;
  body.userData.repoId = repo.id;

  subMeshes.forEach((sub) => {
    sub.material = bodyMaterial;
    sub.castShadow = !isHolo;
    sub.receiveShadow = !isHolo;
    sub.userData.repoId = repo.id;
    body.add(sub);
  });

  group.add(body);

  const topMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(district.accent),
    roughness: 0.3,
    metalness: 0.5,
    emissive: new THREE.Color(district.color),
    emissiveIntensity: 0.3,
    wireframe: isHolo,
  });
  const top: RepoBuildingMesh = new THREE.Mesh(topGeo, topMaterial);
  top.position.y = layout.height + topHeightVal / 2;
  top.userData.repoId = repo.id;
  group.add(top);

  // Edges only for boxy shapes
  if (['spires', 'megatowers', 'apartments', 'glass'].includes(shape)) {
    const edgeGeometry = new THREE.EdgesGeometry(baseGeo);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: district.color, transparent: true, opacity: 0.15 });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    edges.position.copy(body.position);
    group.add(edges);
  }

  let windows: RepoWindowsMesh;

  // Windows for residential/industrial/office
  if (['spires', 'megatowers', 'apartments', 'glass', 'factories'].includes(shape)) {
    const windowGeometry = new THREE.PlaneGeometry(0.3, 0.2);
    const windowMaterial = new THREE.MeshBasicMaterial({
      color: district.color,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const cols = Math.max(2, Math.floor(layout.width / 0.8));
    const rows = Math.max(3, Math.floor(layout.height / 1.1));
    const litWindows: THREE.Matrix4[] = [];
    const dummy = new THREE.Object3D();
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const litSeed = Math.sin((row + 1) * 12.9 + (col + 1) * 78.2 + repo.stars * 0.001);
        if (litSeed - Math.floor(litSeed) < 0.4) continue;
        const wx = -layout.width / 2 + 0.5 + col * ((layout.width - 1.0) / Math.max(1, cols - 1));
        const wy = 0.8 + row * ((layout.height - 1.6) / rows);
        dummy.position.set(wx, wy, layout.depth / 2 + 0.02);
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

  const antennaHeight = 1.5 + (repo.openPRs % 10) * 0.2;
  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, antennaHeight, 8),
    new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0.5 }),
  );
  antenna.position.set(0, top.position.y + antennaHeight / 2, 0);
  if (!['caves', 'giant_trees', 'mushroom_colonies'].includes(shape)) {
    group.add(antenna);
  }

  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 12, 12),
    new THREE.MeshBasicMaterial({ color: district.accent, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }),
  );
  beacon.position.set(0, antenna.position.y + antennaHeight / 2 + 0.2, 0);
  if (!['caves', 'giant_trees', 'mushroom_colonies'].includes(shape)) {
    group.add(beacon);
  }

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(Math.max(layout.width, layout.depth) * 0.8, 0.05, 8, 32),
    new THREE.MeshBasicMaterial({ color: district.color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.1;
  group.add(ring);

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
    height: layout.height,
    width: layout.width,
    depth: layout.depth,
    phase: (repo.stars % 1000) / 1000,
  };
}

function createGround(scene: THREE.Scene) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Muted civic grid background
  ctx.fillStyle = '#050807';
  ctx.fillRect(0, 0, 512, 512);

  // Tech grid lines
  ctx.strokeStyle = '#14231f';
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

  // Cyber circuit patterns
  ctx.strokeStyle = '#20352e';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#356859';
  for (let i = 0; i < 15; i += 1) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const size = 30 + Math.random() * 50;
    ctx.beginPath();
    ctx.moveTo(x, y);
    if (Math.random() > 0.5) {
      ctx.lineTo(x + size, y);
      ctx.lineTo(x + size + 15, y + 15);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + size + 15, y + 15, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.lineTo(x, y + size);
      ctx.lineTo(x + 15, y + size + 15);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + 15, y + size + 15, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

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

  const grid = new THREE.GridHelper(1000, 200, '#4fb7c5', '#204d45');
  grid.userData.role = 'grid';
  const gridMaterial = grid.material as THREE.Material;
  gridMaterial.transparent = true;
  gridMaterial.opacity = 0.1;
  grid.position.y = 0.01;
  scene.add(grid);

  DISTRICTS.forEach((district) => {
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
        opacity: isNature ? 0.2 : 0.08,
        depthWrite: false,
      }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(district.x, 0.02, district.z + 2);
    plane.userData.role = 'district-plane';
    scene.add(plane);

    const labelTexture = makeSpriteTexture(district.label.toUpperCase(), 'semantic district', district.color, 520, 130);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, transparent: true, opacity: 0.8, depthWrite: false }));
    label.position.set(district.x, 1.4, district.z + 22);
    label.scale.set(12, 3, 1);
    scene.add(label);
  });
}

function createSky(scene: THREE.Scene) {
  const starGeometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  for (let i = 0; i < 2000; i += 1) {
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
      size: 0.3,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  stars.userData.role = 'stars';
  scene.add(stars);

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(15, 32, 32),
    new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending }),
  );
  moon.position.set(120, 80, -150);
  moon.userData.role = 'moon';
  scene.add(moon);
}

function createRoads(scene: THREE.Scene, buildings: BuildingObject[]) {
  const roads: RoadObject[] = [];
  buildings.forEach((building, index) => {
    if (building.repo.prs.length === 0 && index % 3 !== 0) return;

    // connect to 1-3 random buildings to show flow
    const connections = 1 + (building.repo.stars % 3);
    for(let i=0; i<connections; i++) {
        const target = buildings[(index + i * 17) % buildings.length];
        if (target === building) continue;

        const dist = building.position.distanceTo(target.position);
        if (dist > 150 || dist < 2) continue; // Only connect local-ish nodes

        const isNature = ['forest_repository', 'jungle_canopy', 'bamboo_valley'].includes(building.district.key);
        const isLava = building.district.key === 'volcano_forge';
        const isIce = building.district.key === 'frozen_kingdom';

        let pathColor = building.district.color;
        if(isNature) pathColor = '#22c55e'; // vine paths
        if(isLava) pathColor = '#ef4444'; // lava paths
        if(isIce) pathColor = '#bae6fd'; // ice paths

        const p1 = building.position.clone();
        const p2 = target.position.clone();

        const midY = (isNature || building.district.shape === 'floating_stations') ? 10 : 0.5;

        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(p1.x, 0.2, p1.z),
          new THREE.Vector3((p1.x + p2.x) / 2, midY + (dist * 0.1), (p1.z + p2.z) / 2),
          new THREE.Vector3(p2.x, 0.2, p2.z),
        ]);

        const mesh = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 20, 0.24, 6, false),
          new THREE.MeshBasicMaterial({ color: pathColor, transparent: true, opacity: 0.52, blending: THREE.AdditiveBlending })
        );
        scene.add(mesh);

        const cars: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>[] = [];
        for (let c = 0; c < 3; c += 1) {
          const car = new THREE.Mesh(
            new THREE.SphereGeometry(0.45, 8, 8),
            new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0.95 })
          );
          scene.add(car);
          cars.push(car);
        }

        const labelTexture = makeSpriteTexture(`${building.repo.prs.length || 1} PRs`, 'flow', pathColor, 200, 60);
        const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, transparent: true, opacity: 0, depthWrite: false }));
        scene.add(label);

        roads.push({
          id: `${building.repo.id}-${target.repo.id}-${i}`,
          source: building.repo,
          target: target.repo,
          curve,
          mesh,
          cars,
          label,
          speed: 0.1 + (building.repo.stars % 5) * 0.02,
          phase: Math.random(),
        });
    }
  });
  return roads;
}
