'use client';

import * as THREE from 'three';
import { Activity, Github, GitPullRequest, HelpCircle, Moon, RotateCcw, ShieldCheck, SlidersHorizontal, Sparkles, Star, Sun, TrendingUp, Users, X, ZoomIn, ZoomOut } from 'lucide-react';
import { FormEvent, MouseEvent, type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { Z } from '@/lib/constants';

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

type CameraPose = {
  position: THREE.Vector3;
  target: THREE.Vector3;
};

type CameraFocusTransition = {
  repoId: string;
  startedAt: number;
  duration: number;
  from: CameraPose;
  to: CameraPose;
};

type SceneRefs = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  ambient: THREE.HemisphereLight;
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
  siftText: THREE.Group;
  activeFocusRepoId: string | null;
  focusTransition: CameraFocusTransition | null;
};

const DISTRICTS: District[] = [
  // Functional districts laid out as a fixed-perspective contribution atlas.
  { key: 'skyline_core', label: 'Core Platforms', color: '#5d8dff', accent: '#c7ddff', x: -390, z: -560, shape: 'spires', parent: 'systems' },
  { key: 'vertical_arcology', label: 'Frontend Frameworks', color: '#8fba70', accent: '#f4ffd2', x: 40, z: -595, shape: 'megatowers', parent: 'web' },
  { key: 'volcano_forge', label: 'Cloud Infrastructure', color: '#f97316', accent: '#ffd2a0', x: 520, z: -520, shape: 'lava_foundries', parent: 'infra' },
  { key: 'redwood_archive', label: 'Security + Auth', color: '#4f9b67', accent: '#d6f9c9', x: -720, z: -190, shape: 'redwood_towers', parent: 'infra' },
  { key: 'financial_district', label: 'Data Platforms', color: '#e6bd63', accent: '#fff1c2', x: -310, z: -95, shape: 'blocks', parent: 'infra' },
  { key: 'forest_repository', label: 'Databases + Cache', color: '#3fbf84', accent: '#c9ffd9', x: 60, z: -80, shape: 'giant_trees', parent: 'infra' },
  { key: 'crystal_fields', label: 'AI + ML', color: '#a076ff', accent: '#f4dbff', x: 410, z: -130, shape: 'crystal_spires', parent: 'ai' },
  { key: 'frozen_kingdom', label: 'Distributed Systems', color: '#8bd3ff', accent: '#f2fbff', x: 735, z: 160, shape: 'caves', parent: 'infra' },
  { key: 'nomad_camps', label: 'Testing + QA', color: '#d6aa70', accent: '#fff0c8', x: -740, z: 230, shape: 'tents', parent: 'devtools' },
  { key: 'floating_island', label: 'DevOps + Delivery', color: '#62c8a4', accent: '#e1fff1', x: -300, z: 380, shape: 'floating_stations', parent: 'devtools' },
  { key: 'ruined_empire', label: 'Kernels + OS', color: '#9d5cff', accent: '#efd7ff', x: 80, z: 610, shape: 'ruins', parent: 'systems' },
  { key: 'canyon_networks', label: 'APIs + Networking', color: '#42d8ff', accent: '#d7fbff', x: 520, z: 520, shape: 'holographic', parent: 'infra' },
  { key: 'clockwork_empire', label: 'Rust + Runtimes', color: '#ff6b8b', accent: '#ffd0da', x: -625, z: -470, shape: 'factories', parent: 'systems' },
  { key: 'mountain_citadel', label: 'Compilers + Languages', color: '#f43f5e', accent: '#ffd1dc', x: -80, z: -305, shape: 'citadel', parent: 'systems' },
  { key: 'brick_boroughs', label: 'UI Libraries', color: '#60a5fa', accent: '#d7e9ff', x: -485, z: 110, shape: 'apartments', parent: 'web' },
  { key: 'neon_alley', label: 'Web Apps + SaaS', color: '#06b6d4', accent: '#c7fbff', x: 230, z: -345, shape: 'glass', parent: 'web' },
  { key: 'tech_suburbs', label: 'CSS + Design Systems', color: '#0ea5e9', accent: '#bfeeff', x: -610, z: 45, shape: 'suburbs', parent: 'web' },
  { key: 'coastal_fishing', label: 'Static Sites', color: '#2563eb', accent: '#d7e7ff', x: -560, z: 610, shape: 'fishing_docks', parent: 'web' },
  { key: 'ether_realm', label: 'Agents + LLMs', color: '#a78bfa', accent: '#efe7ff', x: 315, z: -690, shape: 'holographic', parent: 'ai' },
  { key: 'bamboo_valley', label: 'Developer Tools', color: '#10b981', accent: '#d4fff0', x: 760, z: -130, shape: 'bamboo_pagodas', parent: 'devtools' },
  { key: 'valley_villages', label: 'Starter Projects', color: '#34d399', accent: '#e1fff3', x: -40, z: 245, shape: 'valley_villages', parent: 'devtools' },
  { key: 'corruption_wasteland', color: '#d946ef', accent: '#f5d0fe', label: 'Code Security', x: 345, z: 270, shape: 'decayed', parent: 'security' },
  { key: 'overgrown_ruins', label: 'Embedded + IoT', color: '#22c55e', accent: '#dbffdf', x: -855, z: 30, shape: 'overgrown', parent: 'systems' },
  { key: 'jungle_canopy', label: 'Cloud Platforms', color: '#44b36a', accent: '#edffe6', x: -170, z: 760, shape: 'mushroom_colonies', parent: 'infra' },
  { key: 'vector_lab', label: 'Vector + RAG', color: '#c084fc', accent: '#fae8ff', x: 635, z: -705, shape: 'crystal_spires', parent: 'ai' },
  { key: 'model_foundry', label: 'Models + Inference', color: '#7c3aed', accent: '#ddd6fe', x: 815, z: -420, shape: 'holographic', parent: 'ai' },
  { key: 'data_lake', label: 'Analytics + BI', color: '#14b8a6', accent: '#ccfbf1', x: -60, z: 85, shape: 'blocks', parent: 'infra' },
  { key: 'observability_array', label: 'Monitoring + Observability', color: '#38bdf8', accent: '#e0f2fe', x: 805, z: 420, shape: 'holographic', parent: 'infra' },
  { key: 'identity_gate', label: 'Identity + OAuth', color: '#84cc16', accent: '#ecfccb', x: -845, z: -405, shape: 'redwood_towers', parent: 'security' },
  { key: 'privacy_vault', label: 'Crypto + Privacy', color: '#22d3ee', accent: '#cffafe', x: -885, z: -705, shape: 'caves', parent: 'security' },
  { key: 'mobile_harbor', label: 'Mobile Apps', color: '#0f766e', accent: '#99f6e4', x: -845, z: 520, shape: 'fishing_docks', parent: 'mobile' },
  { key: 'game_arcade', label: 'Games + Graphics', color: '#f59e0b', accent: '#fef3c7', x: 860, z: 690, shape: 'crystal_spires', parent: 'media' },
  { key: 'media_studio', label: 'Audio + Video', color: '#ec4899', accent: '#fce7f3', x: 470, z: 805, shape: 'glass', parent: 'media' },
  { key: 'docs_academy', label: 'Docs + Learning', color: '#facc15', accent: '#fef9c3', x: -350, z: 830, shape: 'valley_villages', parent: 'learning' },
  { key: 'package_ports', label: 'Packages + Registries', color: '#fb7185', accent: '#ffe4e6', x: 205, z: 830, shape: 'apartments', parent: 'devtools' },
  { key: 'shell_workshop', label: 'CLI + Shell', color: '#2dd4bf', accent: '#ccfbf1', x: 790, z: 40, shape: 'factories', parent: 'devtools' },
  { key: 'browser_lab', label: 'Browser + Automation', color: '#3b82f6', accent: '#dbeafe', x: -235, z: -805, shape: 'glass', parent: 'web' },
  { key: 'robotics_yard', label: 'Robotics + Hardware', color: '#65a30d', accent: '#d9f99d', x: -1020, z: 275, shape: 'overgrown', parent: 'systems' },
  { key: 'science_quarry', label: 'Science + Simulation', color: '#a16207', accent: '#fde68a', x: 1000, z: 245, shape: 'caves', parent: 'systems' },
  { key: 'protocol_marshes', label: 'Protocols + P2P', color: '#0891b2', accent: '#cffafe', x: 1020, z: -235, shape: 'holographic', parent: 'infra' },
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
  const hasTopic = (needles: string[]) => topics.some((topic) => needles.some((needle) => topic.includes(needle)));
  const hasText = (needles: string[]) => needles.some((needle) => text.includes(needle));

  if (hasTopic(['oauth', 'openid', 'sso', 'identity', 'auth', 'casbin', 'jwt']) || hasText(['authentication', 'authorization', 'oauth', 'openid'])) return 'identity_gate';
  if (hasTopic(['cryptography', 'crypto', 'privacy', 'encryption', 'zero-knowledge', 'zk']) || hasText(['cryptography', 'privacy', 'encryption'])) return 'privacy_vault';
  if (hasTopic(['security', 'vulnerability', 'malware', 'pentest', 'hacking', 'ctf']) || hasText(['security', 'vulnerability', 'threat'])) return 'corruption_wasteland';
  if (hasTopic(['rag', 'vector', 'embedding', 'semantic-search', 'retrieval']) || hasText(['vector database', 'semantic search', 'retrieval augmented'])) return 'vector_lab';
  if (hasTopic(['llm', 'agent', 'agents', 'openai', 'anthropic', 'inference', 'model']) || hasText(['large language model', 'inference', 'agent'])) return 'model_foundry';
  if (hasTopic(['machine-learning', 'deep-learning', 'ml', 'ai', 'pytorch', 'tensorflow']) || hasText(['machine learning', 'deep learning'])) return 'crystal_fields';
  if (hasTopic(['observability', 'monitoring', 'metrics', 'tracing', 'logging', 'prometheus', 'grafana'])) return 'observability_array';
  if (hasTopic(['api', 'networking', 'proxy', 'gateway', 'protocol', 'p2p', 'websocket', 'grpc']) || hasText(['peer-to-peer', 'network protocol'])) return hasTopic(['p2p', 'protocol']) ? 'protocol_marshes' : 'canyon_networks';
  if (hasTopic(['analytics', 'data-science', 'business-intelligence', 'bi', 'data-engineering', 'etl', 'warehouse']) || hasText(['analytics', 'business intelligence'])) return 'data_lake';
  if (hasTopic(['database', 'sql', 'postgres', 'mysql', 'sqlite', 'nosql', 'redis', 'cache', 'queue'])) return 'forest_repository';
  if (hasTopic(['kubernetes', 'docker', 'terraform', 'devops', 'ci-cd', 'deployment', 'infrastructure'])) return 'volcano_forge';
  if (hasTopic(['cloud', 'serverless', 'platform', 'hosting'])) return 'jungle_canopy';
  if (hasTopic(['android', 'ios', 'mobile', 'flutter', 'react-native', 'swiftui']) || ['swift', 'kotlin', 'dart'].includes(language)) return 'mobile_harbor';
  if (hasTopic(['game', 'game-engine', 'graphics', 'rendering', 'opengl', 'vulkan', 'webgl'])) return 'game_arcade';
  if (hasTopic(['audio', 'video', 'media', 'streaming', 'image', 'ffmpeg', 'computer-vision'])) return 'media_studio';
  if (hasTopic(['docs', 'documentation', 'tutorial', 'course', 'learning', 'awesome', 'book', 'roadmap', 'interview'])) return 'docs_academy';
  if (hasTopic(['package-manager', 'registry', 'packages', 'homebrew', 'npm', 'pip', 'dependency'])) return 'package_ports';
  if (hasTopic(['cli', 'shell', 'terminal', 'command-line', 'zsh', 'bash'])) return 'shell_workshop';
  if (hasTopic(['browser', 'automation', 'playwright', 'puppeteer', 'selenium', 'extension'])) return 'browser_lab';
  if (hasTopic(['robotics', 'hardware', 'embedded', 'iot', 'arduino', 'esp32', 'raspberry-pi']) || hasText(['robotics', 'embedded'])) return hasTopic(['robotics', 'hardware']) ? 'robotics_yard' : 'overgrown_ruins';
  if (hasTopic(['science', 'simulation', 'physics', 'math', 'bioinformatics', 'astronomy'])) return 'science_quarry';
  if (topics.some((topic) => ['finance', 'fintech', 'payment'].includes(topic))) return 'financial_district';
  if (language === 'rust') return 'clockwork_empire';
  if (language === 'c' || language === 'c++' || language === 'cpp') return 'mountain_citadel';
  if (language === 'go') return 'floating_island';
  if (hasTopic(['css', 'tailwind', 'design-system', 'storybook'])) return 'tech_suburbs';
  if (hasTopic(['react', 'vue', 'svelte', 'frontend', 'components', 'ui'])) return 'brick_boroughs';
  if (['typescript', 'javascript'].includes(language)) return 'neon_alley';
  if (language === 'python') return 'ether_realm';
  if (hasTopic(['blockchain', 'web3', 'ethereum', 'solidity'])) return 'crystal_fields';
  if (hasTopic(['compiler', 'parser', 'interpreter', 'language'])) return 'frozen_kingdom';
  if (hasTopic(['linux', 'kernel', 'operating-system', 'os'])) return 'ruined_empire';
  if (stars > 120000) return 'skyline_core';
  if (stars > 45000) return 'vertical_arcology';
  if (stars < 50) return 'valley_villages';
  if (stars < 250) return 'nomad_camps';
  if (stars < 1000) return 'coastal_fishing';

  const infraBiomes = ['overgrown_ruins', 'forest_repository', 'jungle_canopy', 'bamboo_valley', 'package_ports', 'science_quarry'];
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

const GRAPH_REPO_LIMIT = 5000;
const GRAPH_FETCH_ATTEMPTS = 5;
const GRAPH_FETCH_RETRY_DELAY_MS = 550;
const LOADING_STAGES = [
  'Opening graph socket',
  'Talking to SQLite',
  'Fetching repository nodes',
  'Joining topics and owners',
  'Classifying ecosystem districts',
  'Scoring contribution safety',
  'Laying terrain chunks',
  'Warming WebGL materials',
  'Plotting PR traffic',
  'Finalizing camera sweep',
];

const INTRO_MS = 2400;
const ENTRY_MS = 1000;

function createSiftText(scene: THREE.Scene) {
  const group = new THREE.Group();
  const letters = ['S', 'I', 'F', 'T'];
  letters.forEach((char, i) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 512;
    if (ctx) {
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.clearRect(0, 0, 512, 512);
      ctx.font = '900 450px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 12;
      ctx.strokeText(char, 256, 256);
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(char, 256, 256);
    }
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(120, 120, 1);
    sprite.position.set(-200 + i * 140, 1200, -800);
    sprite.userData.baseX = sprite.position.x;
    sprite.userData.baseY = sprite.position.y;
    group.add(sprite);
  });
  scene.add(group);
  return group;
}
const CAMERA_HOME = new THREE.Vector3(0, 285, 1080);
const TARGET_HOME = new THREE.Vector3(0, 35, 20);
const MIN_ZOOM = 0.58;
const MAX_ZOOM = 1.42;
const REPO_FOCUS_ZOOM = 0.9;
const REPO_FOCUS_TRANSITION_MS = 820;
const REPO_FOCUS_LONG_TRAVEL_DISTANCE = 980;
const SCENE_PIXEL_RATIO = 1.15;
const VISUAL_REPOS_PER_DISTRICT = 38;
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
  const seed = repo.id.split('').reduce((total, char) => total + char.charCodeAt(0), 0) + index * 17.7;
  const angle = index * 2.399963 + seededUnit(seed) * 0.55;
  
  // Restore original radius logic for better spacing/breathing room
  const radius = 13 + Math.sqrt(index + 1) * 12.8 + seededUnit(seed + 2) * 10.5;
  const laneOffset = Math.floor(index / 11) * 3.8;
  const x = district.x + Math.cos(angle) * (radius + laneOffset) * 1.42;
  const z = district.z + Math.sin(angle) * (radius + laneOffset) * 1.14 + Math.cos(index * 1.13) * 5.5;

  let scaleDriver = scale.stars;
  if (heightScaleDriver === 'activity') {
    scaleDriver = scale.activity;
  } else if (heightScaleDriver === 'contributors') {
    scaleDriver = scale.community;
  }

  // Refined Sigmoid: equitable distribution (min presence ~40-50% of max)
  const sigmoid = (v: number) => 1 / (1 + Math.exp(-4 * (v - 0.5)));
  const compressedDriver = 0.5 + sigmoid(scaleDriver) * 0.5;

  const heightBias =
    district.shape === 'spires' || district.shape === 'megatowers' || district.shape === 'vertical_arcology' ? 1.2 :
    district.shape === 'suburbs' || district.shape === 'tents' || district.shape === 'fishing_docks' ? 0.75 :
    district.shape === 'blocks' || district.shape === 'lava_foundries' ? 0.85 :
    0.95;
  const districtHeroBoost = FEATURED_DISTRICT_KEYS.has(district.key) ? 1.15 : 0.92;
  
  // Rebalanced Height: Min 30, Max ~95. Prominent but not claustrophobic.
  const height = clamp(12.5 + compressedDriver * 75 * heightBias * districtHeroBoost, 30, 95);
  
  const widthBias =
    district.shape === 'blocks' || district.shape === 'apartments' || district.shape === 'valley_villages' ? 1.2 :
    district.shape === 'glass' || district.shape === 'crystal_spires' ? 0.9 :
    1;
  const width = clamp(3.5 + compressedDriver * 4.5 * widthBias, 4.5, 9.5);
  const depth = clamp(3.5 + compressedDriver * 4.5 * (district.shape === 'blocks' ? 1.1 : 1), 4.5, 9.5);

  return {
    position: new THREE.Vector3(x, 0, z),
    height,
    width,
    depth,
  };
}

function createSiftRenderer() {
  const rendererOptions: THREE.WebGLRendererParameters[] = [
    { antialias: false, alpha: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true },
    { antialias: false, alpha: true, powerPreference: 'default', logarithmicDepthBuffer: true },
    { antialias: false, alpha: true, powerPreference: 'low-power', logarithmicDepthBuffer: true },
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
  refs.scene.background = null;
  refs.renderer.setClearColor(0x000000, 0);
  refs.scene.fog = new THREE.FogExp2(isDay ? '#9eb8a8' : '#08142a', isDay ? 0.000028 : 0.00022);
  refs.renderer.toneMappingExposure = isDay ? 1.28 : 1.16;
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

    if (role === 'ground' || role === 'terrain') {
      const groundMaterial = (Array.isArray(material) ? material[0] : material) as THREE.MeshStandardMaterial;
      groundMaterial.color.set(isDay ? '#f2f6f0' : '#8fa0b0');
      groundMaterial.emissiveIntensity = isDay ? 0.04 : 0.08;
      groundMaterial.transparent = false;
      groundMaterial.opacity = 1;
      groundMaterial.depthWrite = true;
    }

    if (role === 'grid') setMaterialOpacity(material, isDay ? 0.04 : 0.02);
    if (role === 'stars') setMaterialOpacity(material, isDay ? 0.02 : 0.24);
    if (role === 'moon') setMaterialOpacity(material, isDay ? 0.025 : 0.08);
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

function repoFocusPose(building: BuildingObject, zoom: number): CameraPose {
  const targetLift = clamp(building.height * 0.46, 18, 76);
  const focusDistance = clamp(92 + building.height * 0.58, 118, 210) * zoom;
  const focusHeight = clamp(54 + building.height * 0.42, 76, 154) * Math.sqrt(zoom);
  const focusSide = clamp(34 + building.width * 2.6, 44, 112) * zoom;

  return {
    position: building.position.clone().add(new THREE.Vector3(focusSide, focusHeight, focusDistance)),
    target: building.position.clone().add(new THREE.Vector3(0, targetLift, 0)),
  };
}

function repoFocusApproachPose(building: BuildingObject): CameraPose {
  const targetLift = clamp(building.height * 0.38, 16, 64);
  return {
    position: building.position.clone().add(new THREE.Vector3(190, clamp(142 + building.height * 0.32, 164, 238), 360)),
    target: building.position.clone().add(new THREE.Vector3(0, targetLift, 0)),
  };
}

function resetFocusTransition(refs: SceneRefs) {
  refs.activeFocusRepoId = null;
  refs.focusTransition = null;
}

function atlasPositionForDistrict(district: District) {
  return {
    left: clamp(50 + district.x / 19, 5, 76),
    top: clamp(48 + district.z / 20, 10, 88),
  };
}

function atlasViewForDistrict(district: District) {
  return {
    x: clamp(-district.x * 0.52, -620, 620),
    y: clamp(-district.z * 0.36, -460, 460),
    scale: 1.1,
  };
}

function atlasBiomeForDistrict(district: District) {
  if (['spires', 'megatowers', 'citadel', 'glass', 'apartments'].includes(district.shape)) return 'city';
  if (['lava_foundries', 'factories', 'decayed'].includes(district.shape)) return 'forge';
  if (['giant_trees', 'redwood_towers', 'overgrown', 'mushroom_colonies', 'bamboo_pagodas'].includes(district.shape)) return 'green';
  if (['crystal_spires', 'caves', 'holographic'].includes(district.shape) || district.parent === 'ai') return 'signal';
  if (['fishing_docks', 'floating_stations', 'canyon_forts'].includes(district.shape)) return 'water';
  return 'field';
}

function atlasRegionScale(repoCount: number) {
  return clamp(0.72 + Math.log10(repoCount + 1) * 0.28, 0.78, 1.42);
}

function atlasStructureCount(repoCount: number) {
  return clamp(Math.ceil(Math.log2(repoCount + 2)) + 1, 4, 9);
}

export default function Home() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [loadingStageIndex, setLoadingStageIndex] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(6);
  const [loadingDetail, setLoadingDetail] = useState('Preparing graph request');
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
          setLoadingStageIndex(0);
          setLoadingProgress(8);
          setLoadingDetail(`Attempt ${attempt}: opening graph endpoint`);
          const response = await fetch(`/api/py/graph-full?limit=${GRAPH_REPO_LIMIT}`, { cache: 'no-store' });
          if (!response.ok) throw new Error(`Graph request failed with ${response.status}`);

          setLoadingStageIndex(2);
          setLoadingProgress(34);
          setLoadingDetail('Parsing graph payload from backend');
          const data = await response.json() as GraphFullResponse;
          setLoadingStageIndex(4);
          setLoadingProgress(58);
          setLoadingDetail(`Classifying ${(data.nodes ?? []).length.toLocaleString()} graph nodes`);
          const mappedRepos = (data.nodes ?? [])
            .filter(isGraphRepositoryNode)
            .map(buildRepoFromGraphNode);

          if (!mappedRepos.length) throw new Error('Graph response contained no repositories');
          if (!cancelled) {
            setLoadingStageIndex(7);
            setLoadingProgress(84);
            setLoadingDetail(`Hydrating ${mappedRepos.length.toLocaleString()} repositories`);
            setRepos(mappedRepos);
            setLoadingStageIndex(9);
            setLoadingProgress(100);
            setLoadingDetail('Handing off to WebGL renderer');
            setLoadingRepos(false);
          }
          return;
        } catch (error) {
          lastError = error;
          if (attempt < GRAPH_FETCH_ATTEMPTS) {
            setLoadingStageIndex(1);
            setLoadingProgress(18);
            setLoadingDetail(`Retrying graph endpoint in ${(GRAPH_FETCH_RETRY_DELAY_MS * attempt / 1000).toFixed(1)}s`);
            await wait(GRAPH_FETCH_RETRY_DELAY_MS * attempt);
          }
        }
      }

      console.error('[SIFT graph] Failed to fetch local graph; using demo repositories:', lastError);
      if (!cancelled) {
        setLoadingStageIndex(4);
        setLoadingProgress(72);
        setLoadingDetail('Backend unavailable; falling back to bundled demo graph');
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
    if (!loadingRepos) return undefined;
    const started = performance.now();
    const interval = window.setInterval(() => {
      const elapsed = performance.now() - started;
      setLoadingStageIndex((current) => Math.min(LOADING_STAGES.length - 1, Math.max(current, Math.floor(elapsed / 1200) % LOADING_STAGES.length)));
      setLoadingProgress((current) => Math.min(92, current + 2 + Math.round(seededUnit(elapsed * 0.01) * 3)));
    }, 900);
    return () => window.clearInterval(interval);
  }, [loadingRepos]);

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
  const appearanceRef = useRef<Appearance>('day');
  const selectedRef = useRef<Repo | null>(null);
  const hoverRef = useRef<Repo | null>(null);
  const similarDistrictRef = useRef<DistrictKey | null>(null);
  const similarUntilRef = useRef(0);
  const introHasRunRef = useRef(false);

  const [entered, setEntered] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [appearance, setAppearance] = useState<Appearance>('day');
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

  const reposByDistrict = useMemo(() => {
    return DISTRICTS.map((district) => ({
      district,
      repos: effectiveRepos.filter((repo) => repo.district === district.key),
    }));
  }, [effectiveRepos]);
  const sceneReposByDistrict = useMemo(() => {
    return DISTRICTS.map((district) => ({
      district,
      repos: allRepos.filter((repo) => repo.district === district.key),
    }));
  }, [allRepos]);
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
    return sceneReposByDistrict.map(({ district, repos }) => {
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
  }, [loadedRepos, sceneReposByDistrict, selectedRepo]);
  const sceneReady = !loadingRepos && allRepos.length > 0;
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
    if (!sceneReady) return undefined;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#040606');
    scene.fog = new THREE.FogExp2('#0c1514', 0.002);

    const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 0.1, 8000);
    const now = performance.now();
    const introStart = introHasRunRef.current ? now - INTRO_MS : now;
    camera.position.set(-620, 250, -420);

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

    const ambient = new THREE.HemisphereLight('#c0e8e0', '#020617', 1.2);
    scene.add(ambient);

    const key = new THREE.DirectionalLight('#dbe8ff', 4.5);
    key.position.set(-80, 120, 50);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    scene.add(key);

    const rim = new THREE.PointLight('#4fb7c5', 85, 250, 1.8);
    rim.position.set(20, 45, -60);
    scene.add(rim);

    scene.fog = new THREE.FogExp2('#0c1514', 0.0018);

    createGround(scene);
    createSky(scene);
    const siftText = createSiftText(scene);

    const buildings: BuildingObject[] = [];
    visualReposByDistrict.forEach(({ repos }) => {
      repos.forEach((repo, index) => {
        const building = createBuilding(repo, index, repos, heightScaleDriver);
        const surfaceY = getTerrainSurfaceY(building.position.x, building.position.z);
        building.group.position.y = surfaceY;
        building.position.y = surfaceY;
        buildings.push(building);
        scene.add(building.group);
      });
    });
    const hitTargets = buildings.flatMap((building) => (
      building.group.children.filter((child) => typeof child.userData.repoId === 'string')
    ));

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
      startedAt: introStart,
      enteredAt: null,
      cameraPosition: camera.position.clone(),
      cameraTarget: new THREE.Vector3(-12, 5, -1),
      zoom: 1,
      targetZoom: 1,
      siftText,
      activeFocusRepoId: null,
      focusTransition: null,
    };
    sceneRef.current = refs;
    applyAppearance(refs, appearanceRef.current);

    const findBuilding = (repoId: string | undefined) => buildings.find((building) => building.repo.id === repoId) ?? null;
    const siftWindow = window as typeof window & {
      __siftCameraProbe?: () => {
        selectedRepo: string | null;
        hoveredRepo: string | null;
        transitionActive: boolean;
        camera: { x: number; y: number; z: number };
        target: { x: number; y: number; z: number };
        zoom: number;
      };
      __siftSceneProbe?: () => Array<{ id: string; name: string; x: number; y: number; visible: boolean; hitRepoId: string; hitRepoName: string }>;
    };

    if (process.env.NODE_ENV !== 'production') {
      siftWindow.__siftCameraProbe = () => ({
        selectedRepo: selectedRef.current?.name ?? null,
        hoveredRepo: hoverRef.current?.name ?? null,
        transitionActive: Boolean(refs.focusTransition),
        camera: {
          x: Number(camera.position.x.toFixed(2)),
          y: Number(camera.position.y.toFixed(2)),
          z: Number(camera.position.z.toFixed(2)),
        },
        target: {
          x: Number(refs.cameraTarget.x.toFixed(2)),
          y: Number(refs.cameraTarget.y.toFixed(2)),
          z: Number(refs.cameraTarget.z.toFixed(2)),
        },
        zoom: Number(refs.zoom.toFixed(3)),
      });

      siftWindow.__siftSceneProbe = () => buildings.flatMap((building) => {
        const rect = renderer.domElement.getBoundingClientRect();
        const probeRaycaster = new THREE.Raycaster();
        const samplePoints = [
          new THREE.Vector3(building.position.x, building.position.y + building.height * 0.38, building.position.z),
          new THREE.Vector3(building.position.x, building.position.y + building.height * 0.72, building.position.z),
          new THREE.Vector3(building.position.x, building.position.y + building.height + 3, building.position.z),
        ];

        return samplePoints.map((samplePoint) => {
          const vector = samplePoint.project(camera);
          const x = Math.round(rect.left + (vector.x * 0.5 + 0.5) * rect.width);
          const y = Math.round(rect.top + (-vector.y * 0.5 + 0.5) * rect.height);
          const pointer = new THREE.Vector2(
            ((x - rect.left) / rect.width) * 2 - 1,
            -(((y - rect.top) / rect.height) * 2 - 1),
          );
          probeRaycaster.setFromCamera(pointer, camera);
          const hitRepoId = probeRaycaster.intersectObjects(hitTargets, false)[0]?.object.userData.repoId ?? '';
          const hitRepo = findBuilding(hitRepoId)?.repo ?? null;

          return {
            id: building.repo.id,
            name: building.repo.name,
            x,
            y,
            visible: vector.z > -1 && vector.z < 1 && x > rect.left && y > rect.top && x < rect.right && y < rect.bottom,
            hitRepoId,
            hitRepoName: hitRepo?.name ?? '',
          };
        });
      });
    }

    const skipCinematicSweep = () => {
      if (performance.now() - refs.startedAt < INTRO_MS) {
        refs.startedAt = performance.now() - INTRO_MS;
        refs.cameraPosition.copy(camera.position);
        refs.cameraTarget.set(0, 60, 0);
      }
      if (!refs.enteredAt) refs.enteredAt = performance.now();
    };

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
      freeNavX = clamp(freeNavX, -950, 950);
      freeNavY = clamp(freeNavY, -260, 760);
      freeNavZ = clamp(freeNavZ, -950, 950);
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
      resetFocusTransition(refs);
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
        setFilter('all');
        similarDistrictRef.current = null;
        similarUntilRef.current = 0;
        resetFocusTransition(refs);
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
        skipCinematicSweep();
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

    const repoAtClientPoint = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      refs.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      refs.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      refs.raycaster.setFromCamera(refs.pointer, camera);
      const intersection = refs.raycaster.intersectObjects(hitTargets, false)[0];
      return findBuilding(intersection?.object.userData.repoId)?.repo ?? null;
    };

    const focusSceneRepo = (repo: Repo) => {
      skipCinematicSweep();
      resetFocusTransition(refs);
      targetDistrictCenterRef.current = null;
      setEntered(true);
      setSelectedRepo(repo);
      setFilter(repo.district);
      similarDistrictRef.current = repo.district;
      similarUntilRef.current = performance.now() + 3600;
      setAtlasView(atlasViewForDistrict(districtFor(repo)));
    };

    const handlePointerUp = (event: PointerEvent) => {
      const shouldFocusRepo = isDragging && !didDrag && event.button === 0;
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

      if (shouldFocusRepo) {
        const repo = hoverRef.current ?? repoAtClientPoint(event.clientX, event.clientY);
        if (repo) focusSceneRepo(repo);
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
          setFilter('all');
          similarDistrictRef.current = null;
          similarUntilRef.current = 0;
          resetFocusTransition(refs);
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

    const handleClick = (event: globalThis.MouseEvent) => {
      if (didDrag || performance.now() - lastDragAt < 140) return;
      const repo = hoverRef.current ?? repoAtClientPoint(event.clientX, event.clientY);
      if (repo) focusSceneRepo(repo);
    };

    let hoverFrame = 0;
    const animate = () => {
      const now = performance.now();
      const selected = selectedRef.current;
      const elapsed = (now - refs.startedAt) / 1000;
      const introProgress = Math.min(1, (now - refs.startedAt) / INTRO_MS);
      const introT = easeInOutCubic(introProgress);
      const entryT = refs.enteredAt ? easeOutCubic((now - refs.enteredAt) / ENTRY_MS) : 0;
      const selectedBuilding = selected ? findBuilding(selected.id) : null;
      const hasInteractiveCameraRequest = Boolean(selectedBuilding || targetDistrictCenterRef.current);

      let desiredPosition = new THREE.Vector3();
      let desiredTarget = new THREE.Vector3();

      // --- 1. Cinematic Opening Sweep (Priority) ---
      if (introProgress < 1 && !hasInteractiveCameraRequest) {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-620, 250, -420),
          new THREE.Vector3(-260, 190, 190),
          new THREE.Vector3(240, 180, -170),
          new THREE.Vector3(560, 230, 320),
          CAMERA_HOME.clone(),
        ]);
        
        const pos = curve.getPointAt(introT);
        camera.position.copy(pos);
        const sweepTarget = TARGET_HOME.clone().lerp(new THREE.Vector3(0, 70, 0), 1 - introT);
        camera.lookAt(sweepTarget);

        // Reveal SIFT letters cinematicaly
        if (introProgress > 0.55) {
          const textT = easeOutCubic((introProgress - 0.55) / 0.45);
          refs.siftText.children.forEach((child, i) => {
            const sprite = child as THREE.Sprite;
            sprite.material.opacity = textT;
            sprite.position.y = sprite.userData.baseY + Math.sin(now * 0.001 + i) * 35 * textT;
            sprite.scale.setScalar(120 + 60 * textT);
          });
        }
        
        refs.cameraPosition.copy(pos);
        refs.cameraTarget.copy(sweepTarget);
      } 
      // --- 2. Interactive States ---
      else {
        const mouseParallax = new THREE.Vector2(0, 0); // Simplified for refactor

        if (selectedBuilding) {
          refs.targetZoom = THREE.MathUtils.lerp(refs.targetZoom, REPO_FOCUS_ZOOM, 0.18);
          refs.zoom = THREE.MathUtils.lerp(refs.zoom, refs.targetZoom, 0.18);
          const focusPose = repoFocusPose(selectedBuilding, refs.zoom);

          if (refs.activeFocusRepoId !== selectedBuilding.repo.id) {
            const currentPose = {
              position: refs.cameraPosition.clone(),
              target: refs.cameraTarget.clone(),
            };
            const startsTooFar =
              refs.cameraPosition.distanceTo(focusPose.position) > REPO_FOCUS_LONG_TRAVEL_DISTANCE ||
              introProgress < 1;
            const fromPose = startsTooFar ? repoFocusApproachPose(selectedBuilding) : currentPose;
            if (startsTooFar) {
              refs.cameraPosition.copy(fromPose.position);
              refs.cameraTarget.copy(fromPose.target);
            }
            refs.activeFocusRepoId = selectedBuilding.repo.id;
            refs.focusTransition = {
              repoId: selectedBuilding.repo.id,
              startedAt: now,
              duration: REPO_FOCUS_TRANSITION_MS,
              from: fromPose,
              to: focusPose,
            };
          }

          if (refs.focusTransition?.repoId === selectedBuilding.repo.id) {
            const progress = clamp((now - refs.focusTransition.startedAt) / refs.focusTransition.duration, 0, 1);
            const eased = easeOutCubic(progress);
            desiredPosition = refs.focusTransition.from.position.clone().lerp(refs.focusTransition.to.position, eased);
            desiredTarget = refs.focusTransition.from.target.clone().lerp(refs.focusTransition.to.target, eased);
            if (progress >= 1) refs.focusTransition = null;
          } else {
            desiredPosition = focusPose.position;
            desiredTarget = focusPose.target;
          }
        } else if (targetDistrictCenterRef.current) {
          resetFocusTransition(refs);
          const targetCenter = targetDistrictCenterRef.current;
          freeNavX += (targetCenter.x - freeNavX) * 0.08;
          freeNavZ += (targetCenter.z - freeNavZ) * 0.08;
          freeNavY += (0 - freeNavY) * 0.08;
          refs.targetZoom = THREE.MathUtils.lerp(refs.targetZoom, 0.78, 0.08);
          
          desiredPosition = CAMERA_HOME.clone().add(new THREE.Vector3(freeNavX, freeNavY, freeNavZ));
          desiredTarget = TARGET_HOME.clone().add(new THREE.Vector3(freeNavX, 0, freeNavZ));
        } else {
          resetFocusTransition(refs);
          const freeOffset = new THREE.Vector3(freeNavX, freeNavY, freeNavZ);
          desiredPosition = CAMERA_HOME.clone().add(freeOffset);
          desiredTarget = TARGET_HOME.clone().add(new THREE.Vector3(freeNavX, 0, freeNavZ));
        }

        if (!selectedBuilding) {
          refs.zoom = THREE.MathUtils.lerp(refs.zoom, refs.targetZoom, 0.08);
          const offset = desiredPosition.clone().sub(desiredTarget).multiplyScalar(refs.zoom);
          desiredPosition = desiredTarget.clone().add(offset);
        }

        refs.cameraPosition.lerp(desiredPosition, 0.06);
        refs.cameraTarget.lerp(desiredTarget, 0.07);
        camera.position.copy(refs.cameraPosition);
        camera.lookAt(refs.cameraTarget);
      }

      if (introProgress >= 1 && !introHasRunRef.current) {
        introHasRunRef.current = true;
      }

      hoverFrame += 1;
      if (!isDragging && enteredRef.current && hoverFrame % 2 === 0) {
        refs.raycaster.setFromCamera(refs.pointer, camera);
        const intersection = refs.raycaster.intersectObjects(hitTargets, false)[0];
        const nextHovered = findBuilding(intersection?.object.userData.repoId)?.repo ?? null;
        if (hoverRef.current?.id !== nextHovered?.id) {
          hoverRef.current = nextHovered;
          setHoveredRepo(nextHovered);
          renderer.domElement.style.cursor = nextHovered ? 'pointer' : 'grab';
        }
      }

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
          car.position.y += road.flowStrength * 0.08 + Math.sin(elapsed * 8 + carIndex) * 0.035;
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
      if (process.env.NODE_ENV !== 'production') {
        delete siftWindow.__siftCameraProbe;
        delete siftWindow.__siftSceneProbe;
      }
      sceneRef.current = null;
    };
  }, [heightScaleDriver, rendererRetryToken, sceneReady, visualReposByDistrict]);

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
    if (sceneRef.current) resetFocusTransition(sceneRef.current);
    targetDistrictCenterRef.current = null;
    similarDistrictRef.current = null;
    similarUntilRef.current = 0;
  };

  const handleCloseRepoPanel = () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setSelectedRepo(null);
    setFilter('all');
    setAtlasView({ x: 0, y: 0, scale: 1 });
    targetDistrictCenterRef.current = null;
    similarDistrictRef.current = null;
    similarUntilRef.current = 0;
    if (sceneRef.current) {
      resetFocusTransition(sceneRef.current);
      sceneRef.current.targetZoom = 1;
    }
    setZoomValue(1);
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
    const refs = sceneRef.current;
    if (refs) {
      if (performance.now() - refs.startedAt < INTRO_MS) {
        refs.startedAt = performance.now() - INTRO_MS;
      }
      if (!refs.enteredAt) refs.enteredAt = performance.now();
      refs.targetZoom = REPO_FOCUS_ZOOM;
      resetFocusTransition(refs);
    }
    setEntered(true);
    setSelectedRepo(repo);
    setFilter(repo.district);
    targetDistrictCenterRef.current = null;
    similarDistrictRef.current = repo.district;
    similarUntilRef.current = performance.now() + 3600;
    setAtlasView(atlasViewForDistrict(districtFor(repo)));
  };

  const focusDistrict = (district: District) => {
    if (sceneRef.current) resetFocusTransition(sceneRef.current);
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
      setImportStatus(`${imported.owner}/${imported.name} loaded into ${districtFor(imported).label}.`);
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

  const loadingStage = LOADING_STAGES[loadingStageIndex] ?? LOADING_STAGES[0];
  const visibleLoadingProgress = clamp(loadingProgress, 0, 100);

  return (
    <main
      className={`sift-page ${appearance === 'day' ? 'is-day' : 'is-night'} ${selectedRepo ? 'is-repo-focus' : ''}`}
      aria-label="SIFT 3D open-source city"
      style={{
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
            <p className="sift-loading-text">{loadingStage}</p>
            <div className="sift-loading-progress" aria-label={`Loading progress ${visibleLoadingProgress}%`}>
              <span style={{ width: `${visibleLoadingProgress}%` }} />
            </div>
            <ol className="sift-loading-log" aria-label="Loading status">
              {LOADING_STAGES.slice(0, Math.min(LOADING_STAGES.length, loadingStageIndex + 3)).map((stage, index) => (
                <li key={stage} className={index < loadingStageIndex ? 'is-complete' : index === loadingStageIndex ? 'is-active' : ''}>
                  <span>{index < loadingStageIndex ? 'ok' : index === loadingStageIndex ? 'run' : 'next'}</span>
                  {stage}
                </li>
              ))}
            </ol>
            <small className="sift-loading-detail">{loadingDetail}</small>
          </div>
        </div>
      )}

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
            <button className="panel-close" type="button" onClick={handleCloseRepoPanel} aria-label="Close repository panel">
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

        /* Code-native atlas pass */
        .sift-page {
          --sift-bg-deep: #07101b;
          --sift-glass-surface: rgba(7, 15, 25, 0.62);
          --sift-glass-border: rgba(206, 226, 255, 0.14);
          font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background:
            linear-gradient(180deg, rgba(6,12,22,0.02), rgba(6,12,22,0.32)),
            linear-gradient(180deg, #13233a 0%, #263d49 34%, #17261d 100%);
        }

        .sift-page.is-day {
          --sift-glass-surface: rgba(7, 15, 25, 0.56);
          --sift-glass-border: rgba(224, 238, 255, 0.18);
          --sift-text-primary: rgba(255,255,255,0.94);
          --sift-text-secondary: rgba(222,232,245,0.68);
          background:
            linear-gradient(180deg, rgba(10,18,31,0.02), rgba(10,18,31,0.26)),
            linear-gradient(180deg, #b9d7f2 0%, #779296 34%, #132118 100%);
        }

        .three-stage {
          z-index: 2;
          background: transparent;
          opacity: 1;
        }

        .sift-page.is-day .three-stage {
          opacity: 1;
        }

        .sift-page::before,
        .sift-page.is-day::before {
          z-index: 3;
          opacity: 1;
          background:
            radial-gradient(circle at 50% 42%, transparent 24%, rgba(2,6,12,0.2) 74%),
            linear-gradient(180deg, rgba(3,8,15,0.04) 0%, transparent 52%, rgba(3,8,15,0.26) 100%),
            linear-gradient(90deg, rgba(2,6,12,0.3), transparent 18%, transparent 72%, rgba(2,6,12,0.38));
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
            radial-gradient(circle at 18% 76%, rgba(214,170,112,0.26), transparent 18%),
            radial-gradient(circle at 66% 26%, rgba(80,142,90,0.24), transparent 21%),
            radial-gradient(circle at 72% 70%, rgba(66,216,255,0.14), transparent 19%),
            linear-gradient(180deg, rgba(124,161,143,0.74), rgba(27,52,38,0.96));
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
            radial-gradient(ellipse at 31% 26%, rgba(80,104,83,0.92), transparent 27%),
            radial-gradient(ellipse at 72% 32%, rgba(96,88,62,0.86), transparent 25%),
            radial-gradient(ellipse at 38% 70%, rgba(37,88,71,0.92), transparent 24%),
            radial-gradient(ellipse at 73% 73%, rgba(41,71,84,0.88), transparent 27%),
            linear-gradient(140deg, #5b765c 0%, #2e5945 38%, #283c35 66%, #17281f 100%);
          box-shadow:
            0 70px 120px rgba(1,5,9,0.38),
            inset 0 2px 0 rgba(255,255,255,0.16),
            inset 0 -38px 70px rgba(2,8,11,0.34);
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
            repeating-linear-gradient(18deg, rgba(255,255,255,0.055) 0 1px, transparent 1px 38px),
            repeating-linear-gradient(105deg, rgba(5,16,15,0.12) 0 1px, transparent 1px 52px);
          opacity: 0.48;
          mask-image: radial-gradient(ellipse at center, black 34%, transparent 75%);
        }

        .atlas-map-base::after {
          inset: 13% 11%;
          border: 1px solid rgba(255,255,255,0.06);
          box-shadow:
            0 0 0 18px rgba(255,255,255,0.018),
            inset 0 0 60px rgba(2,8,12,0.24);
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
            linear-gradient(90deg, rgba(117,210,223,0.06), rgba(128,218,231,0.5), rgba(117,210,223,0.08));
          box-shadow: 0 0 18px rgba(96,205,220,0.18), inset 0 1px 0 rgba(255,255,255,0.2);
          filter: blur(0.2px);
          opacity: 0.7;
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
            repeating-linear-gradient(90deg, rgba(241,211,150,0.62) 0 20px, rgba(241,211,150,0.1) 20px 32px);
          box-shadow: 0 0 11px rgba(236,196,107,0.16);
          opacity: 0.44;
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
          filter: drop-shadow(18px 25px 28px rgba(1,8,10,0.32));
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
          background: rgba(1,8,12,0.3);
          filter: blur(16px);
          transform: translate(12px, 18px);
        }

        .region-plate {
          border-radius: 46% 54% 48% 52% / 56% 44% 58% 42%;
          background:
            radial-gradient(circle at 30% 24%, color-mix(in srgb, var(--district-accent), white 14%), transparent 12%),
            radial-gradient(circle at 62% 70%, color-mix(in srgb, var(--district-color), black 18%), transparent 30%),
            linear-gradient(145deg, color-mix(in srgb, var(--district-color), #d5e9bb 24%), color-mix(in srgb, var(--district-color), #07110f 42%));
          clip-path: polygon(11% 17%, 35% 4%, 72% 8%, 93% 28%, 88% 71%, 63% 96%, 22% 87%, 5% 54%);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.2),
            inset 0 -14px 30px rgba(2,9,9,0.25);
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
            linear-gradient(145deg, #7a4534, color-mix(in srgb, var(--district-color), #141011 54%));
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
            radial-gradient(circle at 28% 28%, rgba(219,255,199,0.4), transparent 14%),
            radial-gradient(circle at 68% 62%, rgba(17,73,42,0.8), transparent 34%),
            linear-gradient(150deg, color-mix(in srgb, var(--district-color), #b8d88f 28%), #173622);
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
            linear-gradient(145deg, color-mix(in srgb, var(--district-color), #233852 20%), #152133);
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
            linear-gradient(145deg, color-mix(in srgb, var(--district-color), #4d806d 22%), #16333a);
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
          border: 1px solid color-mix(in srgb, var(--district-accent), transparent 44%);
          border-radius: 8px;
          background:
            linear-gradient(145deg, color-mix(in srgb, var(--district-color), transparent 68%), rgba(4,10,18,0.76)),
            rgba(5, 12, 22, 0.78);
          color: rgba(255,255,255,0.9);
          box-shadow: 0 16px 38px rgba(1,5,12,0.34), inset 0 1px 0 rgba(255,255,255,0.12);
          text-align: left;
          pointer-events: auto;
          cursor: pointer;
          backdrop-filter: blur(14px) saturate(130%);
          -webkit-backdrop-filter: blur(14px) saturate(130%);
          transition: transform 140ms ease, border-color 140ms ease, background 140ms ease, opacity 140ms ease;
        }

        .atlas-hotspot:hover,
        .atlas-hotspot.is-active {
          transform: translate(-50%, -50%) scale(1.04);
          border-color: color-mix(in srgb, var(--district-accent), white 18%);
          background:
            linear-gradient(145deg, color-mix(in srgb, var(--district-color), transparent 46%), rgba(4,10,18,0.82)),
            rgba(5, 12, 22, 0.84);
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
          color: rgba(232,241,255,0.68);
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
            linear-gradient(145deg, rgba(255,255,255,0.09), rgba(255,255,255,0.025)),
            var(--sift-glass-surface);
          box-shadow: 0 20px 70px rgba(2,7,14,0.28), inset 0 1px 0 rgba(255,255,255,0.12);
          backdrop-filter: blur(22px) saturate(130%);
          -webkit-backdrop-filter: blur(22px) saturate(130%);
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
          border-color: rgba(154, 189, 255, 0.5);
          background: rgba(72, 108, 196, 0.32);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.16);
        }

        .stat-bar {
          top: 10px;
          right: 116px;
          gap: 42px;
          padding: 5px 12px;
          border: 1px solid rgba(255,255,255,0.08);
          border-top: 0;
          border-radius: 0 0 10px 10px;
          background: rgba(4, 10, 18, 0.18);
          backdrop-filter: blur(14px);
        }

        .stat-bar strong {
          font-size: 17px;
          color: rgba(255,255,255,0.9);
          text-shadow: 0 1px 22px rgba(78,128,210,0.32);
        }

        .stat-bar span,
        .cinema-readout span {
          font-size: 7px;
          color: rgba(232, 239, 247, 0.5);
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
          color: rgba(238,246,255,0.86);
        }

        .repo-load-form {
          grid-template-columns: minmax(0, 1fr) 78px;
          padding: 10px;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          background: rgba(255,255,255,0.035);
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
          opacity: 0.78;
        }

        .search-cluster:hover,
        .search-cluster:focus-within {
          opacity: 1;
        }

        .glass-search {
          min-height: 54px;
          border-radius: 12px;
          background:
            linear-gradient(145deg, rgba(255,255,255,0.11), rgba(255,255,255,0.03)),
            rgba(7,15,25,0.58);
          box-shadow: 0 20px 60px rgba(2,7,14,0.32), inset 0 1px 0 rgba(255,255,255,0.13);
        }

        .glass-search::before,
        .glass-search::after {
          display: none;
        }

        .glass-search input {
          font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 14px;
        }

        .glass-search button {
          height: 38px;
          border-radius: 8px;
          background: linear-gradient(135deg, rgba(132,172,203,0.92), rgba(135,120,92,0.72));
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.2);
        }

        .filter-row {
          opacity: 0.76;
        }

        .cinema-readout {
          left: 28px;
          bottom: 22px;
          opacity: 0.72;
        }

        .repo-panel {
          width: min(390px, calc(100vw - 20px));
          background:
            radial-gradient(circle at 18% 4%, color-mix(in srgb, var(--repo-color), transparent 78%), transparent 32%),
            linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03)),
            rgba(7, 15, 25, 0.72);
        }

        .repo-panel h2 {
          font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 32px;
          letter-spacing: -0.02em;
        }

        @media (max-width: 1100px) {
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
          background:
            linear-gradient(rgba(57, 211, 83, 0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(57, 211, 83, 0.025) 1px, transparent 1px),
            radial-gradient(circle at 50% 36%, rgba(34, 197, 94, 0.12), transparent 34%),
            #02040a;
          background-size: 28px 28px, 28px 28px, auto, auto;
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
          gap: 18px;
          width: min(520px, calc(100vw - 40px));
          padding: 32px;
          border: 1px solid rgba(57, 211, 83, 0.24);
          background: rgba(2, 6, 12, 0.74);
          box-shadow: 0 0 0 1px rgba(57, 211, 83, 0.08), 0 28px 90px rgba(0,0,0,0.45);
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
          margin: 0;
          min-height: 20px;
        }

        @keyframes blink8bit {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        .sift-loading-progress {
          width: 100%;
          height: 14px;
          border: 2px solid rgba(57, 211, 83, 0.54);
          padding: 2px;
          background: rgba(57, 211, 83, 0.05);
        }

        .sift-loading-progress span {
          display: block;
          height: 100%;
          background: linear-gradient(90deg, #238636, #39d353, #b7ffbf);
          transition: width 360ms steps(6);
          box-shadow: 0 0 18px rgba(57, 211, 83, 0.5);
        }

        .sift-loading-log {
          width: 100%;
          display: grid;
          gap: 8px;
          margin: 0;
          padding: 0;
          list-style: none;
          text-align: left;
          color: rgba(214, 255, 221, 0.74);
          font-size: 12px;
          line-height: 1.25;
        }

        .sift-loading-log li {
          display: grid;
          grid-template-columns: 44px 1fr;
          gap: 10px;
          align-items: center;
          min-width: 0;
        }

        .sift-loading-log span {
          color: #02040a;
          background: rgba(57, 211, 83, 0.72);
          text-align: center;
          padding: 2px 0;
          font-weight: 900;
          text-transform: uppercase;
        }

        .sift-loading-log li.is-active {
          color: #f0fff2;
        }

        .sift-loading-log li.is-active span {
          background: #39d353;
        }

        .sift-loading-log li.is-complete {
          color: rgba(214, 255, 221, 0.5);
        }

        .sift-loading-detail {
          width: 100%;
          color: rgba(214, 255, 221, 0.62);
          text-align: left;
          font-size: 11px;
          line-height: 1.35;
          min-height: 16px;
        }
      `}</style>
    </main>
  );
}


function createBuilding(repo: Repo, index: number, districtRepos: Repo[], heightScaleDriver: HeightScaleDriver) {
  const district = districtFor(repo);
  const biome = biomeTypeForDistrict(district);
  const group = new THREE.Group();
  const layout = createRepoLayout(repo, index, districtRepos, heightScaleDriver);
  group.position.copy(layout.position);

  // Restore Color-Coded Palettes (District-driven)
  const baseColor = new THREE.Color(district.color);
  const bodyColor = baseColor.clone().lerp(new THREE.Color('#020617'), 0.25);
  const accentColor = new THREE.Color(district.accent);
  const isHighDetail = repo.stars >= 1200 || index % 6 === 0;

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.65,
    metalness: 0.42,
    emissive: bodyColor,
    emissiveIntensity: 0.05,
  });

  const topMaterial = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.35,
    metalness: 0.75,
    emissive: accentColor,
    emissiveIntensity: 0.25,
  });

  const glassMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.1,
    metalness: 0.95,
    transparent: true,
    opacity: 0.75,
    emissive: accentColor,
    emissiveIntensity: 0.35,
  });

  let visualHeight = layout.height;
  let bodyWidth = layout.width;
  let bodyDepth = layout.depth;

  // --- Architectural Variety: Layered & Stepped Forms ---
  
  // Base Plate (Grounding)
  const basePlate = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth * 1.35, 1.2, bodyDepth * 1.35),
    new THREE.MeshStandardMaterial({ color: '#1c1917', roughness: 0.9, metalness: 0.15 })
  );
  basePlate.position.y = Z.buildingBase;
  basePlate.receiveShadow = true;
  group.add(basePlate);

  // Layered Tower Body
  const layerCount = 3;
  for (let i = 0; i < layerCount; i++) {
    const t = i / (layerCount - 1);
    const layerHeight = (visualHeight * 0.8) / layerCount;
    const taper = 1 - t * 0.25;
    const lWidth = bodyWidth * taper;
    const lDepth = bodyDepth * taper;
    
    let layer: THREE.Mesh;
    if (biome === 'city' || biome === 'arcology' || biome === 'holographic') {
      layer = new THREE.Mesh(new THREE.BoxGeometry(lWidth, layerHeight, lDepth), i % 2 === 0 ? bodyMaterial : glassMaterial);
    } else if (biome === 'forest' || biome === 'volcano') {
      layer = new THREE.Mesh(new THREE.CylinderGeometry(lWidth * 0.45, lWidth * 0.55, layerHeight, 8), bodyMaterial);
    } else {
      layer = new THREE.Mesh(new THREE.BoxGeometry(lWidth, layerHeight, lDepth), bodyMaterial);
    }
    
    layer.position.y = Z.buildings + layerHeight / 2 + (i * layerHeight);
    layer.receiveShadow = true;
    layer.castShadow = true;
    layer.userData.repoId = repo.id;
    group.add(layer);
  }

  // Roof / Top Landmark
  let top: THREE.Mesh;
  const topY = Z.buildings + visualHeight * 0.8 + 1.5;
  if (biome === 'city') {
    top = new THREE.Mesh(new THREE.CylinderGeometry(0.1, bodyWidth * 0.3, 4, 4), topMaterial);
  } else if (biome === 'forest') {
    top = new THREE.Mesh(new THREE.DodecahedronGeometry(bodyWidth * 0.65, 1), topMaterial);
  } else if (biome === 'volcano') {
    top = new THREE.Mesh(new THREE.ConeGeometry(bodyWidth * 0.4, 6, 6), topMaterial);
  } else if (biome === 'crystal' || biome === 'snow') {
    top = new THREE.Mesh(new THREE.OctahedronGeometry(bodyWidth * 0.5, 0), topMaterial);
  } else {
    top = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth * 0.5, 1, bodyDepth * 0.5), topMaterial);
  }
  
  top.position.y = topY;
  top.userData.repoId = repo.id;
  group.add(top);

  // Instanced Windows (City/Arcology only)
  const showWindows = repo.stars >= 50 && (biome === 'city' || biome === 'arcology');
  let windows: THREE.InstancedMesh;
  if (showWindows) {
    const windowGeometry = new THREE.PlaneGeometry(0.25, 0.18);
    const windowMaterial = new THREE.MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0.45, depthWrite: false });
    const cols = Math.max(1, Math.floor(bodyWidth / 1.4));
    const rows = Math.max(1, Math.floor(visualHeight / 3.5));
    const litWindows = [];
    const dummy = new THREE.Object3D();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (seededUnit(index + r * 7 + c) > 0.45) {
          const wx = -bodyWidth/2 + 0.4 + c * (bodyWidth / cols);
          const wy = Z.buildings + 2 + r * (visualHeight*0.75 / rows);
          dummy.position.set(wx, wy, bodyDepth/2 + 0.08);
          dummy.updateMatrix();
          litWindows.push(dummy.matrix.clone());
        }
      }
    }
    windows = new THREE.InstancedMesh(windowGeometry, windowMaterial, Math.max(1, litWindows.length));
    litWindows.forEach((mat, i) => windows.setMatrixAt(i, mat));
  } else {
    windows = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.01,0.01), new THREE.MeshBasicMaterial(), 1);
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
    body: group.children[1] as RepoBuildingMesh, // Use first layer as 'body' reference
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

  const grassTexture = generateBiomeTexture('forest', 512);
  grassTexture.repeat.set(10, 10);
  const dayOpacity = 0.94;
  const nightOpacity = 0.8;
  const terrainMaterial = new THREE.MeshStandardMaterial({
    map: grassTexture,
    color: '#3f7a54',
    roughness: 0.96,
    metalness: 0,
    transparent: true,
    opacity: dayOpacity,
    depthWrite: true,
  });
  terrainMaterial.userData.dayOpacity = dayOpacity;
  terrainMaterial.userData.nightOpacity = nightOpacity;
  const terrain = new THREE.Mesh(geometry, terrainMaterial);
  terrain.rotation.x = -Math.PI / 2;
  terrain.position.y = -0.14;
  terrain.renderOrder = -8;
  markLandscape(terrain, dayOpacity, nightOpacity);
  scene.add(terrain);
  return terrain;
}

function generateBiomeTexture(
  biomeType: string,
  size: number = 512,
  targetCtx?: CanvasRenderingContext2D | null,
): THREE.CanvasTexture {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  if (targetCtx) {
    canvas = targetCtx.canvas as HTMLCanvasElement;
    if (canvas.width !== size || canvas.height !== size) {
      canvas.width = size;
      canvas.height = size;
    }
    ctx = targetCtx;
    ctx.clearRect(0, 0, size, size);
  } else {
    canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    ctx = canvas.getContext('2d')!;
  }

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
  } else if (biomeType === 'rock') {
    const bed = ctx.createLinearGradient(0, 0, size, size);
    bed.addColorStop(0, '#7a848f');
    bed.addColorStop(0.45, '#5c646c');
    bed.addColorStop(1, '#3f454b');
    ctx.fillStyle = bed;
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 0.62;
    for (let i = 0; i < 240; i += 1) {
      const x = seededUnit(i + 130.2) * size;
      const y = seededUnit(i + 131.4) * size;
      const w = 10 + seededUnit(i + 132.1) * 42;
      const h = 8 + seededUnit(i + 133.2) * 34;
      ctx.fillStyle = ['#9ca3af', '#78716c', '#6b7280', '#57534e', '#a8a29e'][i % 5];
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((seededUnit(i + 134.3) - 0.5) * 0.8);
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    }
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = '#2f3439';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 90; i += 1) {
      let x = seededUnit(i + 140.1) * size;
      let y = seededUnit(i + 141.3) * size;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let step = 0; step < 5; step += 1) {
        x += (seededUnit(i + step + 142.1) - 0.5) * 28;
        y += (seededUnit(i + step + 143.2) - 0.5) * 22;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 0.28;
    for (let i = 0; i < 60; i += 1) {
      const x = seededUnit(i + 150.1) * size;
      const y = seededUnit(i + 151.2) * size;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, 8 + seededUnit(i + 152.3) * 18);
      grad.addColorStop(0, 'rgba(212, 218, 224, 0.5)');
      grad.addColorStop(1, 'rgba(55, 60, 66, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x - 20, y - 20, 40, 40);
    }
    ctx.globalAlpha = 1;
  } else {
    // Urban asphalt / concrete with worn road lanes
    const asphalt = ctx.createLinearGradient(0, 0, size, size);
    asphalt.addColorStop(0, '#3d4248');
    asphalt.addColorStop(0.5, '#2a2e33');
    asphalt.addColorStop(1, '#353a40');
    ctx.fillStyle = asphalt;
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 120; i += 1) {
      const x = seededUnit(i + 0.4) * size;
      const y = seededUnit(i + 1.7) * size;
      const w = 6 + seededUnit(i + 2.3) * 28;
      const h = 4 + seededUnit(i + 3.1) * 14;
      ctx.fillStyle = seededUnit(i + 4.2) > 0.5 ? '#4b5563' : '#1f2937';
      ctx.fillRect(x, y, w, h);
    }
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 2;
    for (let lane = 0; lane < 4; lane += 1) {
      const y = size * (0.18 + lane * 0.2);
      ctx.setLineDash([18, 14]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y + seededUnit(lane + 8.1) * 12);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.18;
    for (let i = 0; i < 24; i += 1) {
      const x = seededUnit(i + 20.1) * size;
      const y = seededUnit(i + 21.4) * size;
      ctx.fillStyle = '#6b7280';
      ctx.fillRect(x, y, 3 + seededUnit(i + 22.2) * 8, 2 + seededUnit(i + 23.1) * 6);
    }
    ctx.globalAlpha = 1;
  }

  return configureTerrainTexture(new THREE.CanvasTexture(canvas), true);
}

function configureTerrainTexture(texture: THREE.CanvasTexture, repeat = true) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 4;
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
  } else {
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
  }
  return texture;
}

const BIOME_LANDSCAPE_TINTS: Record<string, { inner: string; mid: string; outer: string }> = {
  forest: { inner: 'rgba(52, 150, 96, 0.42)', mid: 'rgba(30, 100, 62, 0.18)', outer: 'rgba(18, 58, 38, 0)' },
  lava: { inner: 'rgba(220, 90, 32, 0.38)', mid: 'rgba(110, 38, 16, 0.16)', outer: 'rgba(40, 16, 8, 0)' },
  ice: { inner: 'rgba(200, 232, 255, 0.45)', mid: 'rgba(130, 188, 228, 0.18)', outer: 'rgba(70, 120, 150, 0)' },
  crystal: { inner: 'rgba(167, 130, 236, 0.36)', mid: 'rgba(100, 62, 190, 0.14)', outer: 'rgba(40, 24, 80, 0)' },
  concrete: { inner: 'rgba(118, 126, 142, 0.48)', mid: 'rgba(72, 78, 90, 0.2)', outer: 'rgba(36, 40, 48, 0)' },
  cyber: { inner: 'rgba(56, 189, 248, 0.38)', mid: 'rgba(14, 116, 178, 0.16)', outer: 'rgba(4, 40, 64, 0)' },
  desert: { inner: 'rgba(210, 178, 120, 0.44)', mid: 'rgba(150, 120, 78, 0.18)', outer: 'rgba(72, 58, 40, 0)' },
  wasteland: { inner: 'rgba(192, 88, 200, 0.3)', mid: 'rgba(100, 42, 110, 0.12)', outer: 'rgba(32, 12, 40, 0)' },
};

function worldUvForDistrict(district: District, size: number, worldSpan = 720) {
  return {
    x: ((district.x + worldSpan / 2) / worldSpan) * size,
    y: ((district.z + worldSpan / 2) / worldSpan) * size,
  };
}

function createSoftRadialMask(maskSize: number) {
  const canvas = document.createElement('canvas');
  canvas.width = maskSize;
  canvas.height = maskSize;
  const ctx = canvas.getContext('2d')!;
  const center = maskSize / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.2, 'rgba(255,255,255,0.95)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.62)');
  gradient.addColorStop(0.68, 'rgba(255,255,255,0.22)');
  gradient.addColorStop(0.86, 'rgba(255,255,255,0.06)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, maskSize, maskSize);
  return canvas;
}

function paintDistantHorizonScapes(ctx: CanvasRenderingContext2D, size: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, size * 0.52);
  sky.addColorStop(0, '#8eb8c8');
  sky.addColorStop(0.18, '#9ec4a8');
  sky.addColorStop(0.42, '#7faa72');
  sky.addColorStop(1, 'rgba(90, 128, 88, 0)');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, size, size * 0.55);

  const ridges = [
    { y: size * 0.14, h: size * 0.1, color: 'rgba(42, 62, 78, 0.55)' },
    { y: size * 0.2, h: size * 0.12, color: 'rgba(52, 78, 62, 0.48)' },
    { y: size * 0.28, h: size * 0.14, color: 'rgba(68, 92, 72, 0.38)' },
  ];
  ridges.forEach((ridge, index) => {
    ctx.fillStyle = ridge.color;
    ctx.beginPath();
    ctx.moveTo(0, ridge.y + ridge.h);
    for (let x = 0; x <= size; x += 48) {
      const wave = Math.sin((x / size) * Math.PI * 4 + index * 1.4) * ridge.h * 0.35;
      ctx.lineTo(x, ridge.y + wave);
    }
    ctx.lineTo(size, size * 0.55);
    ctx.lineTo(0, size * 0.55);
    ctx.closePath();
    ctx.fill();
  });

  ctx.globalAlpha = 0.55;
  for (let i = 0; i < 14; i += 1) {
    const x = seededUnit(i + 90.1) * size;
    const y = seededUnit(i + 91.3) * size * 0.38;
    const radius = size * (0.08 + seededUnit(i + 92.2) * 0.12);
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, ['rgba(220,236,255,0.5)', 'rgba(186,230,253,0.42)', 'rgba(167,243,208,0.38)', 'rgba(196,181,253,0.35)'][i % 4]);
    glow.addColorStop(0.55, 'rgba(120,160,180,0.12)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  ctx.globalAlpha = 1;
}

function paintVariedLandscapeBase(ctx: CanvasRenderingContext2D, size: number) {
  const field = ctx.createLinearGradient(0, size * 0.35, 0, size);
  field.addColorStop(0, '#6d9a62');
  field.addColorStop(0.35, '#5f8f54');
  field.addColorStop(0.65, '#7a8e52');
  field.addColorStop(1, '#425c40');
  ctx.fillStyle = field;
  ctx.fillRect(0, size * 0.32, size, size * 0.68);

  const regions = [
    { x: size * 0.24, y: size * 0.58, r: size * 0.34, inner: 'rgba(48, 110, 68, 0.5)', mid: 'rgba(32, 78, 52, 0.15)' },
    { x: size * 0.76, y: size * 0.52, r: size * 0.32, inner: 'rgba(92, 98, 112, 0.48)', mid: 'rgba(58, 64, 74, 0.14)' },
    { x: size * 0.5, y: size * 0.78, r: size * 0.38, inner: 'rgba(108, 128, 68, 0.42)', mid: 'rgba(64, 84, 48, 0.12)' },
    { x: size * 0.16, y: size * 0.72, r: size * 0.28, inner: 'rgba(88, 128, 148, 0.36)', mid: 'rgba(48, 78, 98, 0.1)' },
    { x: size * 0.84, y: size * 0.74, r: size * 0.3, inner: 'rgba(188, 148, 92, 0.4)', mid: 'rgba(128, 98, 58, 0.12)' },
  ];
  regions.forEach((region) => {
    const wash = ctx.createRadialGradient(region.x, region.y, 0, region.x, region.y, region.r);
    wash.addColorStop(0, region.inner);
    wash.addColorStop(0.6, region.mid);
    wash.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, size, size);
  });
}

function paintBiomeTextureBlends(ctx: CanvasRenderingContext2D, size: number) {
  const worldSpan = 2100;
  DISTRICTS.forEach((district, index) => {
    const biome = biomeTypeForDistrict(district);
    const patchSize = 448;
    const patch = document.createElement('canvas');
    patch.width = patchSize;
    patch.height = patchSize;
    generateBiomeTexture(biome, patchSize, patch.getContext('2d')!);

    const mask = createSoftRadialMask(patchSize);
    const masked = document.createElement('canvas');
    masked.width = patchSize;
    masked.height = patchSize;
    const maskedCtx = masked.getContext('2d')!;
    maskedCtx.drawImage(patch, 0, 0);
    maskedCtx.globalCompositeOperation = 'destination-in';
    maskedCtx.drawImage(mask, 0, 0);

    const { x, y } = worldUvForDistrict(district, size, worldSpan);
    const drawSize = size * (0.19 + seededUnit(index + 80.1) * 0.07);
    const blendMode = biome === 'lava' || biome === 'cyber' ? 'screen' : 'multiply';

    ctx.save();
    ctx.globalAlpha = biome === 'ice' ? 0.58 : biome === 'crystal' ? 0.52 : 0.72;
    ctx.globalCompositeOperation = blendMode;
    ctx.drawImage(masked, x - drawSize / 2, y - drawSize / 2, drawSize, drawSize);
    ctx.restore();
  });
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

function paintSoftBiomeWashes(ctx: CanvasRenderingContext2D, size: number) {
  const worldSpan = 2100;
  DISTRICTS.forEach((district, index) => {
    const biome = biomeTypeForDistrict(district);
    const tint = BIOME_LANDSCAPE_TINTS[biome] ?? BIOME_LANDSCAPE_TINTS.concrete;
    const { x, y } = worldUvForDistrict(district, size, worldSpan);
    const radius = size * (0.14 + seededUnit(index + 70.4) * 0.06);
    const stretch = 0.78 + seededUnit(index + 71.8) * 0.34;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, stretch);
    ctx.rotate(seededUnit(index + 72.5) * Math.PI * 0.35 - Math.PI * 0.175);
    const wash = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    wash.addColorStop(0, tint.inner);
    wash.addColorStop(0.35, tint.mid);
    wash.addColorStop(0.72, 'rgba(255,255,255,0.04)');
    wash.addColorStop(1, tint.outer);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = wash;
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    ctx.restore();
  });
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

function paintMacroTerrainDetail(ctx: CanvasRenderingContext2D, size: number) {
  ctx.globalAlpha = 0.38;
  for (let i = 0; i < 280; i += 1) {
    const x = seededUnit(i + 0.9) * size;
    const y = size * 0.38 + seededUnit(i + 1.4) * size * 0.58;
    const radius = 2 + seededUnit(i + 2.1) * 12;
    const blade = ctx.createRadialGradient(x, y, 0, x, y, radius);
    blade.addColorStop(0, ['rgba(134,239,172,0.55)', 'rgba(74,222,128,0.45)', 'rgba(52,211,153,0.38)'][i % 3]);
    blade.addColorStop(1, 'rgba(47,99,64,0)');
    ctx.fillStyle = blade;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 0.42;
  for (let i = 0; i < 160; i += 1) {
    const x = seededUnit(i + 40.3) * size;
    const y = size * 0.4 + seededUnit(i + 41.6) * size * 0.55;
    const radius = 2 + seededUnit(i + 42.4) * 14;
    const rock = ctx.createRadialGradient(x, y, 0, x, y, radius);
    rock.addColorStop(0, ['#d1d5db', '#9ca3af', '#78716c', '#57534e'][i % 4]);
    rock.addColorStop(0.55, 'rgba(68,64,60,0.45)');
    rock.addColorStop(1, 'rgba(47,99,64,0)');
    ctx.fillStyle = rock;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = 'rgba(55,65,81,0.35)';
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 80; i += 1) {
    let x = seededUnit(i + 50.1) * size;
    let y = size * 0.42 + seededUnit(i + 51.3) * size * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let step = 0; step < 5; step += 1) {
      x += (seededUnit(i + step + 52.1) - 0.5) * 18;
      y += (seededUnit(i + step + 53.2) - 0.5) * 12;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function paintTerrainGrain(ctx: CanvasRenderingContext2D, size: number) {
  ctx.globalAlpha = 0.08;
  for (let i = 0; i < 6000; i += 1) {
    const x = seededUnit(i + 110.2) * size;
    const y = seededUnit(i + 111.4) * size;
    const shade = seededUnit(i + 112.1) > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${shade},${shade},${shade},0.35)`;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;
}

function paintHorizonFade(ctx: CanvasRenderingContext2D, size: number) {
  const mist = ctx.createLinearGradient(0, 0, 0, size * 0.45);
  mist.addColorStop(0, 'rgba(186, 214, 228, 0.42)');
  mist.addColorStop(0.55, 'rgba(140, 180, 160, 0.18)');
  mist.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = mist;
  ctx.fillRect(0, 0, size, size * 0.48);

  const vignette = ctx.createRadialGradient(size / 2, size * 0.55, size * 0.2, size / 2, size * 0.55, size * 0.72);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(12,24,18,0.22)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, size, size);
}

function generateWorldFloorTexture() {
  const size = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  paintDistantHorizonScapes(ctx, size);
  paintVariedLandscapeBase(ctx, size);
  paintBiomeTextureBlends(ctx, size);
  paintSoftBiomeWashes(ctx, size);
  paintMacroTerrainDetail(ctx, size);
  paintTerrainGrain(ctx, size);
  paintHorizonFade(ctx, size);

  return configureTerrainTexture(new THREE.CanvasTexture(canvas), false);
}

function biomeTypeForDistrict(district: District): string {
  const k = district.key;
  if (k === 'volcano_forge') return 'volcano';
  if (['frozen_kingdom', 'privacy_vault'].includes(k)) return 'snow';
  if (['forest_repository', 'jungle_canopy', 'bamboo_valley', 'overgrown_ruins', 'redwood_archive', 'identity_gate', 'robotics_yard'].includes(k)) return 'forest';
  if (['crystal_fields', 'ether_realm', 'vector_lab', 'model_foundry', 'game_arcade'].includes(k)) return 'crystal';
  if (k === 'floating_island') return 'floating';
  if (['nomad_camps', 'valley_villages', 'coastal_fishing', 'docs_academy', 'science_quarry'].includes(k)) return 'desert';
  if (['neon_alley', 'tech_suburbs', 'canyon_networks', 'corruption_wasteland', 'observability_array', 'browser_lab', 'protocol_marshes'].includes(k)) return 'holographic';
  if (['vertical_arcology', 'package_ports'].includes(k)) return 'arcology';
  if (['skyline_core', 'data_lake', 'financial_district', 'media_studio', 'shell_workshop'].includes(k)) return 'city';
  return 'city';
}

function placeOnTerrain(x: number, z: number, lift = 0) {
  return getTerrainSurfaceY(x, z) + lift;
}

function createDistrictLabel(scene: THREE.Scene, district: District) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const width = 512;
  const height = 128;
  canvas.width = width;
  canvas.height = height;

  if (context) {
    context.clearRect(0, 0, width, height);
    context.fillStyle = 'rgba(2, 6, 23, 0.88)';
    context.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    context.lineWidth = 4;
    context.roundRect(10, 10, width - 20, height - 20, 24);
    context.fill();
    context.stroke();
    
    context.font = 'bold 38px Inter, sans-serif';
    context.fillStyle = '#f8fafc';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(district.label.toUpperCase(), width / 2, height / 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  
  const x = district.x;
  const z = district.z;
  const h = sampleTerrainHeight(x, z);
  const y = TERRAIN_BASE_Y + h + 50 + Z.labels;
  
  sprite.position.set(x, y, z);
  sprite.scale.set(32, 8, 1);
  sprite.renderOrder = 10;
  scene.add(sprite);
  return sprite;
}

function createDistrictLandscaping(scene: THREE.Scene, district: District, districtIndex: number) {
  const centerX = district.x;
  const centerZ = district.z;
  const biome = biomeTypeForDistrict(district);
  const propSeed = districtIndex * 23.4;

  createDistrictLabel(scene, district);

  // Procedural Clutter Layers
  const clutterCount = 24 + (districtIndex % 5) * 8;
  for (let i = 0; i < clutterCount; i++) {
    const angle = (i / clutterCount) * Math.PI * 2 + seededUnit(propSeed + i) * 0.5;
    const dist = 40 + seededUnit(propSeed + i + 10) * 85;
    const px = centerX + Math.cos(angle) * dist;
    const pz = centerZ + Math.sin(angle) * dist;
    const baseY = placeOnTerrain(px, pz);

    if (biome === 'volcano') {
      // Lava vents and scorched rocks
      if (i % 6 === 0) {
        const vent = new THREE.Mesh(
          new THREE.CylinderGeometry(0.8, 1.5, 1.2, 6),
          new THREE.MeshStandardMaterial({ color: '#1a0a05', roughness: 0.9 })
        );
        vent.position.set(px, baseY + 0.6, pz);
        scene.add(vent);
        const glow = new THREE.Mesh(
          new THREE.CircleGeometry(0.6, 8),
          new THREE.MeshBasicMaterial({ color: '#ff4400', transparent: true, opacity: 0.8 })
        );
        glow.rotation.x = -Math.PI / 2;
        glow.position.set(px, baseY + 1.25, pz);
        scene.add(glow);
      } else {
        const rock = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.5 + seededUnit(propSeed + i) * 1.5, 0),
          new THREE.MeshStandardMaterial({ color: '#2d1a10', roughness: 0.95 })
        );
        rock.position.set(px, baseY + 0.2, pz);
        rock.rotation.set(seededUnit(i), seededUnit(i+1), seededUnit(i+2));
        scene.add(rock);
      }
    } else if (biome === 'snow') {
      // Ice shards and frozen rubble
      const shard = new THREE.Mesh(
        new THREE.ConeGeometry(0.4 + seededUnit(i) * 0.8, 2 + seededUnit(i+1) * 4, 4),
        new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.1, metalness: 0.5, transparent: true, opacity: 0.6 })
      );
      shard.position.set(px, baseY + 1, pz);
      shard.rotation.z = (seededUnit(i+2) - 0.5) * 1.5;
      scene.add(shard);
    } else if (biome === 'forest') {
      // Roots and mossy boulders
      if (i % 4 === 0) {
        const root = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.4, 8, 5),
          new THREE.MeshStandardMaterial({ color: '#2d1a10', roughness: 0.9 })
        );
        root.position.set(px, baseY, pz);
        root.rotation.set(Math.PI / 2, seededUnit(i) * Math.PI, (seededUnit(i+1) - 0.5) * 0.4);
        scene.add(root);
      } else {
        const boulder = new THREE.Mesh(
          new THREE.DodecahedronGeometry(1 + seededUnit(i) * 2, 1),
          new THREE.MeshStandardMaterial({ color: '#166534', roughness: 0.98 })
        );
        boulder.position.set(px, baseY + 0.5, pz);
        scene.add(boulder);
      }
    } else if (biome === 'crystal') {
      // Floating crystal fragments
      const fragment = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.3 + seededUnit(i) * 0.7, 0),
        new THREE.MeshStandardMaterial({ color: '#a78bfa', roughness: 0, metalness: 0.9, transparent: true, opacity: 0.8 })
      );
      fragment.position.set(px, baseY + 2 + seededUnit(i+1) * 6, pz);
      fragment.rotation.set(seededUnit(i+2), seededUnit(i+3), seededUnit(i+4));
      scene.add(fragment);
    } else if (biome === 'city' || biome === 'arcology') {
      // Industrial debris and urban clutter
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(2 + seededUnit(i) * 4, 0.2, 1.5 + seededUnit(i+1) * 3),
        new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.8 })
      );
      slab.position.set(px, baseY + 0.1, pz);
      slab.rotation.y = seededUnit(i+2) * Math.PI;
      scene.add(slab);
    }
  }

  // Environmental Storytelling: Collapsed structures
  if (districtIndex % 3 === 0) {
    const px = centerX + 110;
    const pz = centerZ - 40;
    const baseY = placeOnTerrain(px, pz);
    const ruin = new THREE.Mesh(
      new THREE.BoxGeometry(12, 4, 8),
      new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.9 })
    );
    ruin.position.set(px, baseY + 1, pz);
    ruin.rotation.set(0.4, 0.2, 0.1);
    scene.add(ruin);
  }
}
    const TERRAIN_BASE_Y = -1.5;

const TERRAIN_PLAY_EXTENT = 3600;

function noise2D(x: number, z: number) {
  const i = Math.floor(x);
  const j = Math.floor(z);
  const fx = x - i;
  const fz = z - j;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const a = seededUnit(i + j * 57);
  const b = seededUnit(i + 1 + j * 57);
  const c = seededUnit(i + (j + 1) * 57);
  const d = seededUnit(i + 1 + (j + 1) * 57);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, z: number, octaves = 3) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 0.008;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise2D(x * frequency, z * frequency);
    frequency *= 2.1;
    amplitude *= 0.45;
  }
  return value;
}

function sampleTerrainHeight(worldX: number, worldZ: number) {
  // 1. Macro-scale foundational geography (Global mountains & valleys)
  let height = fbm(worldX * 0.7, worldZ * 0.7, 5) * 12;
  
  // Massive ridge line across the world
  const ridge = Math.abs(noise2D(worldX * 0.003, worldZ * 0.003) - 0.5) * 45;
  height += Math.pow(Math.max(0, 1 - ridge / 10), 2) * 25;

  // 2. Biome-specific hand-crafted features
  DISTRICTS.forEach((district, index) => {
    const biome = biomeTypeForDistrict(district);
    const centerX = district.x;
    const centerZ = district.z;
    const dx = worldX - centerX;
    const dz = worldZ - centerZ;
    const dist = Math.sqrt(dx * dx + dz * dz);
    
    if (biome === 'volcano') {
      const radius = 230;
      if (dist < radius) {
        const t = 1 - dist / radius;
        // Massive Caldera: high rim, depressed center
        const rim = Math.pow(Math.sin(t * Math.PI), 1.2) * 45;
        const crater = (dist < 45) ? -15 * (1 - dist / 45) : 0;
        height += (rim + crater) * t;
        // Lava channels
        const angle = Math.atan2(dz, dx);
        const channel = Math.sin(angle * 4 + fbm(worldX * 0.05, worldZ * 0.05) * 3);
        if (channel > 0.88) height -= 4 * t;
      }
    } else if (biome === 'snow') {
      const radius = 245;
      if (dist < radius) {
        const t = 1 - dist / radius;
        // Glacial shelves: stepped terraces
        const steps = Math.floor(t * 8) / 8;
        height += steps * 42 + fbm(worldX * 0.1, worldZ * 0.1) * 6 * t;
        // Icy cliffs
        if (Math.sin(dist * 0.12) > 0.94) height += 18 * t;
      }
    } else if (biome === 'city') {
      const radius = 205;
      if (dist < radius) {
        const t = 1 - dist / radius;
        // Urban Plateaus: flat raised areas
        const plateau = Math.pow(t, 0.4) * 15;
        const grid = (Math.abs(Math.sin(worldX * 0.12)) > 0.9 || Math.abs(Math.sin(worldZ * 0.12)) > 0.9) ? 1.5 : 0;
        height += plateau + grid;
      }
    } else if (biome === 'crystal') {
      const radius = 220;
      if (dist < radius) {
        const t = 1 - dist / radius;
        // Fractured Crater: jagged spikes and depressions
        const spikes = Math.pow(noise2D(worldX * 0.2, worldZ * 0.2), 3) * 22;
        const crater = Math.pow(t, 2) * 8;
        height += (spikes - crater) * t;
      }
    } else if (biome === 'forest') {
      const radius = 235;
      if (dist < radius) {
        const t = 1 - dist / radius;
        // Organic uneven topology: knolls and roots
        const roots = fbm(worldX * 0.15, worldZ * 0.15, 4) * 12;
        const knolls = Math.pow(Math.sin(dist * 0.08), 2) * 8;
        height += (roots + knolls) * t;
      }
    } else if (biome === 'floating') {
      const radius = 190;
      if (dist < radius) {
        const t = 1 - dist / radius;
        // Depressions in terrain below floating islands
        height -= Math.pow(t, 1.5) * 12;
      }
    } else {
      const radius = 170;
      if (dist < radius) {
        const t = 1 - dist / radius;
        height += Math.pow(t, 1.8) * 12;
      }
    }
  });

  // 3. Medium-scale detail (Erosion, paths, riverbeds)
  const erosion = fbm(worldX * 0.04, worldZ * 0.04, 2) * 4;
  height += erosion;

  // 4. Micro-scale grain
  const grain = (seededUnit(Math.floor(worldX * 8.5 + worldZ * 5.2)) - 0.5) * 0.25;
  height += grain;

  return Math.max(0, height);
}

function getTerrainSurfaceY(worldX: number, worldZ: number) {
  return TERRAIN_BASE_Y + sampleTerrainHeight(worldX, worldZ);
}

function getTerrainColor(x: number, z: number, h: number) {
  let nearestDist = Infinity;
  let secondNearestDist = Infinity;
  let nearestDistrict = DISTRICTS[0];
  let secondNearestDistrict = DISTRICTS[0];

  DISTRICTS.forEach((d) => {
    const dx = x - d.x;
    const dz = z - d.z;
    const dist = dx * dx + dz * dz;
    if (dist < nearestDist) {
      secondNearestDist = nearestDist;
      secondNearestDistrict = nearestDistrict;
      nearestDist = dist;
      nearestDistrict = d;
    } else if (dist < secondNearestDist) {
      secondNearestDist = dist;
      secondNearestDistrict = d;
    }
  });

  const biome1 = biomeTypeForDistrict(nearestDistrict);
  const biome2 = biomeTypeForDistrict(secondNearestDistrict);
  
  const blend = clamp(1 - nearestDist / (nearestDist + secondNearestDist + 0.1), 0, 1);
  const mixFactor = Math.pow(blend, 2) * (3 - 2 * blend);

  const getColorForBiome = (biome: string) => {
    const slate = new THREE.Color('#475569');
    const concrete = new THREE.Color('#94a3b8');
    const earth = new THREE.Color('#71717a');

    if (biome === 'volcano') {
      const lavaFlow = Math.sin(x * 0.12 + z * 0.08 + fbm(x * 0.1, z * 0.1) * 4);
      if (lavaFlow > 0.85) return new THREE.Color('#b91c1c').lerp(new THREE.Color('#450a0a'), 0.2); // Grounded ember
      return new THREE.Color('#1c1917'); // Obsidian / Ash
    }
    if (biome === 'snow') {
      const rockMelt = fbm(x * 0.2, z * 0.2, 3);
      if (rockMelt > 0.72) return slate.clone().lerp(new THREE.Color('#1e293b'), 0.5); // Slate rock
      return new THREE.Color('#f1f5f9').lerp(new THREE.Color('#cbd5e1'), 0.15); // Icy white
    }
    if (biome === 'forest') {
      const moss = fbm(x * 0.3, z * 0.3, 2);
      return new THREE.Color(moss > 0.6 ? '#14532d' : '#365314').lerp(earth, 0.4); // Deep moss/pine
    }
    if (biome === 'crystal') {
      const fracture = Math.abs(noise2D(x * 0.2, z * 0.2) - 0.5);
      if (fracture < 0.04) return new THREE.Color('#4c1d95'); // Deep mineral purple
      return new THREE.Color('#0f172a'); // Quartz slate
    }
    if (biome === 'desert') {
      return new THREE.Color('#d97706').lerp(new THREE.Color('#92400e'), 0.3).lerp(concrete, 0.4); // Sandstone/clay
    }
    if (biome === 'holographic') {
      return new THREE.Color('#082f49'); // Steel blue/glass
    }
    return concrete.clone().lerp(earth, 0.3); // City concrete
  };

  const color1 = getColorForBiome(biome1);
  const color2 = getColorForBiome(biome2);
  const finalColor = color1.lerp(color2, mixFactor);

  const shade = clamp(h * 0.038, 0, 0.42);
  finalColor.multiplyScalar(1 - shade);

  return finalColor;
}

function createBiomeTerrain(scene: THREE.Scene) {
  const extent = TERRAIN_PLAY_EXTENT;
  const res = 320;
  const geometry = new THREE.PlaneGeometry(extent, extent, res, res);
  const positions = geometry.attributes.position as THREE.BufferAttribute;
  const colors = new THREE.BufferAttribute(new Float32Array(positions.count * 3), 3);
  geometry.setAttribute('color', colors);

  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const z = positions.getY(i);
    const h = sampleTerrainHeight(x, z);
    positions.setZ(i, h);

    const color = getTerrainColor(x, z, h);
    colors.setXYZ(i, color.r, color.g, color.b);
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();

  const terrain = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.12,
      emissive: '#05080a',
      emissiveIntensity: 0.05,
    }),
  );
  terrain.rotation.x = -Math.PI / 2;
  terrain.position.y = TERRAIN_BASE_Y + Z.terrain;
  terrain.receiveShadow = true;
  terrain.renderOrder = -8;
  terrain.userData.role = 'terrain';
  scene.add(terrain);
  return terrain;
}

function createGround(scene: THREE.Scene) {
  // Main organic terrain
  createBiomeTerrain(scene);

  // Far distant floor for horizon
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(8000, 8000, 1, 1),
    new THREE.MeshStandardMaterial({ color: '#040606', roughness: 1, metalness: 0 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = TERRAIN_BASE_Y - 5;
  floor.renderOrder = -10;
  scene.add(floor);

  DISTRICTS.forEach((district, districtIndex) => {
    createDistrictLandscaping(scene, district, districtIndex);
  });
}


function createMountainBackdrop(scene: THREE.Scene) {
  const group = new THREE.Group();
  const mountainMaterial = new THREE.MeshStandardMaterial({
    color: '#0f172a',
    roughness: 0.9,
    metalness: 0.1,
    emissive: '#020617',
    emissiveIntensity: 0.05,
  });
  const snowMaterial = new THREE.MeshStandardMaterial({
    color: '#f8fafc',
    roughness: 0.5,
  });

  for (let i = 0; i < 32; i += 1) {
    const seed = i * 14.7;
    const width = 120 + seededUnit(seed) * 250;
    const height = 80 + seededUnit(seed + 1) * 320;
    const x = -1500 + i * 100 + seededUnit(seed + 2) * 50;
    const z = -1800 - seededUnit(seed + 3) * 400;
    
    const mountain = new THREE.Mesh(
      new THREE.ConeGeometry(width, height, 4 + Math.floor(seededUnit(seed+4)*3)),
      mountainMaterial
    );
    mountain.position.set(x, height / 2 - 50, z);
    mountain.rotation.y = seededUnit(seed + 5) * Math.PI;
    group.add(mountain);

    if (height > 200) {
      const snow = new THREE.Mesh(
        new THREE.ConeGeometry(width * 0.3, height * 0.15, 4),
        snowMaterial
      );
      snow.position.set(x, height * 0.82 - 50, z);
      snow.rotation.y = mountain.rotation.y;
      group.add(snow);
    }
  }

  group.userData.role = 'mountains';
  scene.add(group);
}

function createSky(scene: THREE.Scene) {
  // The atlas backdrop carries the mountain range; the live 3D layer stays focused on repos and PR roads.

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
      color: '#ffffff',
      size: 0.35,
      transparent: true,
      opacity: 0.4,
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
  skyGrad.addColorStop(0, '#020812');
  skyGrad.addColorStop(0.3, '#0a1628');
  skyGrad.addColorStop(0.6, '#101e3a');
  skyGrad.addColorStop(1, '#0c1825');
  skyCtx.fillStyle = skyGrad;
  skyCtx.fillRect(0, 0, 512, 512);
  // Nebula wisps
  skyCtx.globalAlpha = 0.06;
  for (let i = 0; i < 40; i++) {
    skyCtx.beginPath();
    skyCtx.arc(Math.random()*512, Math.random()*256, 30+Math.random()*80, 0, Math.PI*2);
    skyCtx.fillStyle = ['#3b82f6','#8b5cf6','#06b6d4','#ec4899'][i%4];
    skyCtx.fill();
  }
  skyCtx.globalAlpha = 1;
  const skyTexture = new THREE.CanvasTexture(skyCanvas);
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(2500, 32, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false }),
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
    new THREE.MeshBasicMaterial({ map: cloudTexture, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  cloudPlane.rotation.x = -Math.PI / 2;
  cloudPlane.position.y = 350;
  cloudPlane.userData.role = 'clouds';
  scene.add(cloudPlane);

  // Lower cloud layer
  const cloud2 = cloudPlane.clone();
  cloud2.position.y = 220;
  cloud2.rotation.z = Math.PI / 3;
  (cloud2.material as THREE.MeshBasicMaterial).opacity = 0;
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
    const baseOpacity = clamp(0.25 + flowStrength * 0.4, 0.3, 0.8);
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
    const startY = getTerrainSurfaceY(p1.x, p1.z) + 0.22;
    const endY = getTerrainSurfaceY(p2.x, p2.z) + 0.22;
    const midY = getTerrainSurfaceY(midX, midZ) + 0.35 + flowStrength * 0.15;
    const start = new THREE.Vector3(p1.x, startY + Z.roads, p1.z);
    const end = new THREE.Vector3(p2.x, endY + Z.roads, p2.z);
    const curve = new THREE.CatmullRomCurve3([
      start,
      new THREE.Vector3(p1.x * 0.72 + midX * 0.28, startY + flowStrength * 0.12 + Z.roads, p1.z * 0.72 + midZ * 0.28),
      new THREE.Vector3(midX, midY + Z.roads, midZ),
      new THREE.Vector3(p2.x * 0.72 + midX * 0.28, endY + flowStrength * 0.12 + Z.roads, p2.z * 0.72 + midZ * 0.28),
      end,
    ]);

    const roadMaterial = new THREE.MeshBasicMaterial({
      color: pathColor,
      transparent: true,
      opacity: baseOpacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
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
    label.position.set(labelPoint.x, 3.2 + flowStrength * 0.8 + Z.labels, labelPoint.z);
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
