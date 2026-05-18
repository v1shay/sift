'use client';

import * as THREE from 'three';
import { HelpCircle, Moon, RotateCcw, Sun, X, ZoomIn, ZoomOut } from 'lucide-react';
import { FormEvent, MouseEvent, type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';

type DistrictKey = 'systems' | 'web' | 'ai' | 'devtools' | 'infra';
type FilterKey = DistrictKey | 'stars' | 'safe' | 'all';
type Priority = 'hot' | 'normal' | 'quiet';
type Appearance = 'night' | 'day';

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
  shape: 'spires' | 'glass' | 'clusters' | 'wide' | 'blocks';
};

type BuildingStyleKey =
  | 'kernel-spire'
  | 'orchestrator-core'
  | 'runtime-stack'
  | 'framework-glass'
  | 'compiler-lattice'
  | 'ai-lab'
  | 'model-serving'
  | 'tool-forge'
  | 'editor-megablock'
  | 'testing-rig'
  | 'infra-plant'
  | 'observability-array'
  | 'data-vault';

type BuildingStyle = {
  key: BuildingStyleKey;
  label: string;
  heightBias: number;
  widthBias: number;
  depthBias: number;
  roof: 'spire' | 'cap' | 'dish' | 'dome' | 'deck' | 'mast';
  geometry: 'box' | 'cylinder' | 'hex' | 'octagon';
  bodyColor: string;
  windowDensity: number;
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
};

type BuildingObject = {
  repo: Repo;
  district: District;
  style: BuildingStyle;
  group: THREE.Group;
  body: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  top: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  windows: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  beacon: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  details: THREE.Object3D[];
  animatedParts: THREE.Object3D[];
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
  { key: 'systems', label: 'Systems', color: '#ff6b6b', accent: '#ff9f80', x: -52, z: -10, shape: 'spires' },
  { key: 'web', label: 'Web', color: '#4f8cff', accent: '#8fc2ff', x: -24, z: 9, shape: 'glass' },
  { key: 'ai', label: 'AI/ML', color: '#a78bfa', accent: '#d0bcff', x: 4, z: -6, shape: 'clusters' },
  { key: 'devtools', label: 'DevTools', color: '#34d399', accent: '#8ff5ca', x: 30, z: 11, shape: 'wide' },
  { key: 'infra', label: 'Infra', color: '#fbbf24', accent: '#ffe08a', x: 55, z: -7, shape: 'blocks' },
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

const REPOS: Repo[] = [
  {
    id: 'linux',
    name: 'linux',
    owner: 'torvalds',
    district: 'systems',
    language: 'C',
    description: 'The operating-system kernel tower that anchors the systems district.',
    stars: 184000,
    forks: 56000,
    openPRs: 19,
    commitsPerWeek: 420,
    contributors: 5200,
    goodFirstIssues: 11,
    safetyScore: 84,
    verifiedMaintainers: true,
    branchProtection: true,
    signedReleases: true,
    responseHours: 18,
    topics: ['kernel', 'drivers', 'systems'],
    prs: [
      { number: 9041, title: 'harden scheduler instrumentation', priority: 'hot' },
      { number: 8810, title: 'document new contributor patch path', priority: 'normal' },
      { number: 8732, title: 'repair architecture-specific warning', priority: 'quiet' },
    ],
  },
  {
    id: 'kubernetes',
    name: 'kubernetes',
    owner: 'kubernetes',
    district: 'systems',
    language: 'Go',
    description: 'Container orchestration megatower with dense contributor traffic.',
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
    topics: ['containers', 'orchestration', 'cloud'],
    prs: [
      { number: 9822, title: 'stabilize node lifecycle controller', priority: 'hot' },
      { number: 9641, title: 'clarify good-first-issue labels', priority: 'normal' },
      { number: 9519, title: 'reduce watch cache churn', priority: 'normal' },
    ],
  },
  {
    id: 'rust',
    name: 'rust',
    owner: 'rust-lang',
    district: 'systems',
    language: 'Rust',
    description: 'Language infrastructure tower with careful review gates.',
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
    topics: ['compiler', 'language', 'safety'],
    prs: [
      { number: 7781, title: 'improve diagnostics for trait bounds', priority: 'hot' },
      { number: 7462, title: 'add beginner compiler walkthrough', priority: 'normal' },
      { number: 7425, title: 'tighten cargo test snapshots', priority: 'quiet' },
    ],
  },
  {
    id: 'tokio',
    name: 'tokio',
    owner: 'tokio-rs',
    district: 'systems',
    language: 'Rust',
    description: 'Async runtime tower with strong docs and issue hygiene.',
    stars: 29000,
    forks: 2700,
    openPRs: 34,
    commitsPerWeek: 54,
    contributors: 530,
    goodFirstIssues: 17,
    safetyScore: 86,
    verifiedMaintainers: true,
    branchProtection: true,
    signedReleases: false,
    responseHours: 22,
    topics: ['async', 'runtime', 'networking'],
    prs: [
      { number: 6112, title: 'simplify task budget docs', priority: 'normal' },
      { number: 6087, title: 'add runtime metrics fixture', priority: 'quiet' },
      { number: 6004, title: 'patch socket readiness edge case', priority: 'hot' },
    ],
  },
  {
    id: 'redis',
    name: 'redis',
    owner: 'redis',
    district: 'systems',
    language: 'C',
    description: 'Fast in-memory data structure tower with active releases.',
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
    prs: [
      { number: 6934, title: 'improve cluster failover trace', priority: 'normal' },
      { number: 6902, title: 'refresh command table generator', priority: 'quiet' },
      { number: 6840, title: 'fix stream trimming regression', priority: 'hot' },
    ],
  },
  {
    id: 'nextjs',
    name: 'next.js',
    owner: 'vercel',
    district: 'web',
    language: 'TypeScript',
    description: 'Application framework tower with heavy web traffic.',
    stars: 132000,
    forks: 28000,
    openPRs: 301,
    commitsPerWeek: 244,
    contributors: 3300,
    goodFirstIssues: 53,
    safetyScore: 87,
    verifiedMaintainers: true,
    branchProtection: true,
    signedReleases: true,
    responseHours: 11,
    topics: ['react', 'framework', 'server-components'],
    prs: [
      { number: 8122, title: 'smooth app router cache invalidation', priority: 'hot' },
      { number: 8070, title: 'document route handler streaming', priority: 'normal' },
      { number: 7994, title: 'improve dev overlay copy', priority: 'quiet' },
    ],
  },
  {
    id: 'react',
    name: 'react',
    owner: 'facebook',
    district: 'web',
    language: 'JavaScript',
    description: 'Core UI tower that glows with ecosystem dependencies.',
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
    topics: ['ui', 'components', 'javascript'],
    prs: [
      { number: 9711, title: 'refine transition tracing hook', priority: 'hot' },
      { number: 9634, title: 'update reconciler fixture names', priority: 'quiet' },
      { number: 9586, title: 'clarify compiler docs', priority: 'normal' },
    ],
  },
  {
    id: 'vite',
    name: 'vite',
    owner: 'vitejs',
    district: 'web',
    language: 'TypeScript',
    description: 'Fast build-tool tower with strong maintainer response.',
    stars: 74000,
    forks: 6800,
    openPRs: 111,
    commitsPerWeek: 92,
    contributors: 1100,
    goodFirstIssues: 38,
    safetyScore: 90,
    verifiedMaintainers: true,
    branchProtection: true,
    signedReleases: true,
    responseHours: 8,
    topics: ['build-tool', 'frontend', 'hmr'],
    prs: [
      { number: 7390, title: 'speed up dependency optimizer', priority: 'hot' },
      { number: 7338, title: 'add plugin author guide', priority: 'normal' },
      { number: 7288, title: 'fix sourcemap warning', priority: 'quiet' },
    ],
  },
  {
    id: 'svelte',
    name: 'svelte',
    owner: 'sveltejs',
    district: 'web',
    language: 'TypeScript',
    description: 'Compiler-driven UI tower with elegant contribution lanes.',
    stars: 84000,
    forks: 4600,
    openPRs: 89,
    commitsPerWeek: 73,
    contributors: 860,
    goodFirstIssues: 31,
    safetyScore: 83,
    verifiedMaintainers: true,
    branchProtection: true,
    signedReleases: false,
    responseHours: 19,
    topics: ['compiler', 'frontend', 'ui'],
    prs: [
      { number: 6580, title: 'tighten transition fallback tests', priority: 'normal' },
      { number: 6514, title: 'improve migration warnings', priority: 'hot' },
      { number: 6481, title: 'document snippet lifecycle', priority: 'quiet' },
    ],
  },
  {
    id: 'tailwind',
    name: 'tailwindcss',
    owner: 'tailwindlabs',
    district: 'web',
    language: 'CSS',
    description: 'Utility CSS tower with wide adoption and polished docs.',
    stars: 91000,
    forks: 4600,
    openPRs: 57,
    commitsPerWeek: 48,
    contributors: 540,
    goodFirstIssues: 18,
    safetyScore: 80,
    verifiedMaintainers: true,
    branchProtection: true,
    signedReleases: false,
    responseHours: 26,
    topics: ['css', 'design-system', 'frontend'],
    prs: [
      { number: 7012, title: 'expand color token fixtures', priority: 'normal' },
      { number: 6955, title: 'repair container query example', priority: 'quiet' },
      { number: 6901, title: 'optimize class scanner hot path', priority: 'hot' },
    ],
  },
  {
    id: 'pytorch',
    name: 'pytorch',
    owner: 'pytorch',
    district: 'ai',
    language: 'Python',
    description: 'Deep learning tower with research-heavy road traffic.',
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
    topics: ['ml', 'tensor', 'gpu'],
    prs: [
      { number: 8891, title: 'optimize attention kernel dispatch', priority: 'hot' },
      { number: 8703, title: 'refresh contributor build matrix', priority: 'normal' },
      { number: 8611, title: 'fix sparse tensor docs', priority: 'quiet' },
    ],
  },
  {
    id: 'transformers',
    name: 'transformers',
    owner: 'huggingface',
    district: 'ai',
    language: 'Python',
    description: 'Model ecosystem tower with constant activity traffic.',
    stars: 148000,
    forks: 30000,
    openPRs: 533,
    commitsPerWeek: 260,
    contributors: 2600,
    goodFirstIssues: 74,
    safetyScore: 85,
    verifiedMaintainers: true,
    branchProtection: true,
    signedReleases: true,
    responseHours: 16,
    topics: ['llm', 'models', 'nlp'],
    prs: [
      { number: 9920, title: 'add quantization recipe guardrails', priority: 'hot' },
      { number: 9812, title: 'improve beginner model card flow', priority: 'normal' },
      { number: 9754, title: 'normalize tokenizer fixture names', priority: 'quiet' },
    ],
  },
  {
    id: 'langchain',
    name: 'langchain',
    owner: 'langchain-ai',
    district: 'ai',
    language: 'Python',
    description: 'Agent framework tower with fast-moving integration streets.',
    stars: 104000,
    forks: 17000,
    openPRs: 246,
    commitsPerWeek: 180,
    contributors: 1900,
    goodFirstIssues: 91,
    safetyScore: 74,
    verifiedMaintainers: true,
    branchProtection: true,
    signedReleases: false,
    responseHours: 30,
    topics: ['agents', 'rag', 'llm-apps'],
    prs: [
      { number: 8341, title: 'isolate tool-calling sandbox docs', priority: 'hot' },
      { number: 8208, title: 'add integration template checks', priority: 'normal' },
      { number: 8166, title: 'remove stale vectorstore example', priority: 'quiet' },
    ],
  },
  {
    id: 'llamacpp',
    name: 'llama.cpp',
    owner: 'ggml-org',
    district: 'ai',
    language: 'C++',
    description: 'Local inference tower with dense systems-meets-AI traffic.',
    stars: 89000,
    forks: 13000,
    openPRs: 182,
    commitsPerWeek: 150,
    contributors: 980,
    goodFirstIssues: 19,
    safetyScore: 78,
    verifiedMaintainers: true,
    branchProtection: true,
    signedReleases: false,
    responseHours: 24,
    topics: ['inference', 'local-llm', 'quantization'],
    prs: [
      { number: 7441, title: 'smooth metal backend fallback', priority: 'hot' },
      { number: 7399, title: 'document quantization profiles', priority: 'normal' },
      { number: 7317, title: 'repair benchmark output parser', priority: 'quiet' },
    ],
  },
  {
    id: 'vllm',
    name: 'vllm',
    owner: 'vllm-project',
    district: 'ai',
    language: 'Python',
    description: 'Inference serving tower with high-throughput streets.',
    stars: 52000,
    forks: 8500,
    openPRs: 221,
    commitsPerWeek: 205,
    contributors: 820,
    goodFirstIssues: 37,
    safetyScore: 81,
    verifiedMaintainers: true,
    branchProtection: true,
    signedReleases: true,
    responseHours: 17,
    topics: ['serving', 'inference', 'gpu'],
    prs: [
      { number: 6280, title: 'improve scheduler admission policy', priority: 'hot' },
      { number: 6214, title: 'add deployment smoke test', priority: 'normal' },
      { number: 6143, title: 'clean up docs table overflow', priority: 'quiet' },
    ],
  },
  {
    id: 'vscode',
    name: 'vscode',
    owner: 'microsoft',
    district: 'devtools',
    language: 'TypeScript',
    description: 'Editor megablock with a huge extension ecosystem.',
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
    topics: ['editor', 'extensions', 'developer-tools'],
    prs: [
      { number: 9003, title: 'tighten extension host telemetry', priority: 'hot' },
      { number: 8890, title: 'improve first issue labels', priority: 'normal' },
      { number: 8755, title: 'repair theme snapshot drift', priority: 'quiet' },
    ],
  },
  {
    id: 'deno',
    name: 'deno',
    owner: 'denoland',
    district: 'devtools',
    language: 'Rust',
    description: 'Runtime block with secure-by-default contribution lanes.',
    stars: 98000,
    forks: 5300,
    openPRs: 74,
    commitsPerWeek: 86,
    contributors: 780,
    goodFirstIssues: 29,
    safetyScore: 86,
    verifiedMaintainers: true,
    branchProtection: true,
    signedReleases: true,
    responseHours: 15,
    topics: ['runtime', 'typescript', 'security'],
    prs: [
      { number: 7784, title: 'harden permission prompt fixture', priority: 'hot' },
      { number: 7712, title: 'improve npm compat docs', priority: 'normal' },
      { number: 7660, title: 'clean lint rule edge case', priority: 'quiet' },
    ],
  },
  {
    id: 'eslint',
    name: 'eslint',
    owner: 'eslint',
    district: 'devtools',
    language: 'JavaScript',
    description: 'Linting block with clear contributor pathways.',
    stars: 26000,
    forks: 4600,
    openPRs: 61,
    commitsPerWeek: 40,
    contributors: 940,
    goodFirstIssues: 34,
    safetyScore: 92,
    verifiedMaintainers: true,
    branchProtection: true,
    signedReleases: true,
    responseHours: 7,
    topics: ['linting', 'javascript', 'static-analysis'],
    prs: [
      { number: 6188, title: 'add rule author migration note', priority: 'normal' },
      { number: 6124, title: 'fix flat config message copy', priority: 'quiet' },
      { number: 6011, title: 'tighten parser service checks', priority: 'hot' },
    ],
  },
  {
    id: 'prettier',
    name: 'prettier',
    owner: 'prettier',
    district: 'devtools',
    language: 'JavaScript',
    description: 'Formatter block with opinionated roads and active docs.',
    stars: 51000,
    forks: 4200,
    openPRs: 48,
    commitsPerWeek: 32,
    contributors: 720,
    goodFirstIssues: 23,
    safetyScore: 83,
    verifiedMaintainers: true,
    branchProtection: true,
    signedReleases: false,
    responseHours: 20,
    topics: ['formatting', 'javascript', 'tooling'],
    prs: [
      { number: 5520, title: 'normalize markdown table fixture', priority: 'normal' },
      { number: 5488, title: 'improve plugin test harness', priority: 'quiet' },
      { number: 5421, title: 'fix trailing comment regression', priority: 'hot' },
    ],
  },
  {
    id: 'playwright',
    name: 'playwright',
    owner: 'microsoft',
    district: 'devtools',
    language: 'TypeScript',
    description: 'Testing tower with reliable automation routes.',
    stars: 76000,
    forks: 4300,
    openPRs: 96,
    commitsPerWeek: 91,
    contributors: 650,
    goodFirstIssues: 22,
    safetyScore: 88,
    verifiedMaintainers: true,
    branchProtection: true,
    signedReleases: true,
    responseHours: 13,
    topics: ['testing', 'browser', 'automation'],
    prs: [
      { number: 6014, title: 'stabilize trace viewer markers', priority: 'hot' },
      { number: 5971, title: 'document component test setup', priority: 'normal' },
      { number: 5902, title: 'repair firefox fixture cleanup', priority: 'quiet' },
    ],
  },
  {
    id: 'terraform',
    name: 'terraform',
    owner: 'hashicorp',
    district: 'infra',
    language: 'Go',
    description: 'Infrastructure-as-code block with strong policy signals.',
    stars: 46000,
    forks: 9700,
    openPRs: 122,
    commitsPerWeek: 64,
    contributors: 870,
    goodFirstIssues: 13,
    safetyScore: 76,
    verifiedMaintainers: true,
    branchProtection: true,
    signedReleases: true,
    responseHours: 32,
    topics: ['iac', 'cloud', 'providers'],
    prs: [
      { number: 7761, title: 'clarify provider mirror fallback', priority: 'normal' },
      { number: 7690, title: 'improve plan JSON diagnostics', priority: 'hot' },
      { number: 7608, title: 'trim stale backend docs', priority: 'quiet' },
    ],
  },
  {
    id: 'prometheus',
    name: 'prometheus',
    owner: 'prometheus',
    district: 'infra',
    language: 'Go',
    description: 'Monitoring tower with visible health and alerting traffic.',
    stars: 61000,
    forks: 9400,
    openPRs: 84,
    commitsPerWeek: 58,
    contributors: 780,
    goodFirstIssues: 26,
    safetyScore: 87,
    verifiedMaintainers: true,
    branchProtection: true,
    signedReleases: true,
    responseHours: 14,
    topics: ['monitoring', 'metrics', 'observability'],
    prs: [
      { number: 6658, title: 'add native histogram guardrail', priority: 'hot' },
      { number: 6601, title: 'improve scrape config examples', priority: 'normal' },
      { number: 6530, title: 'repair parser golden file', priority: 'quiet' },
    ],
  },
  {
    id: 'grafana',
    name: 'grafana',
    owner: 'grafana',
    district: 'infra',
    language: 'TypeScript',
    description: 'Visualization tower with busy dashboard contribution routes.',
    stars: 70000,
    forks: 13000,
    openPRs: 214,
    commitsPerWeek: 140,
    contributors: 2100,
    goodFirstIssues: 47,
    safetyScore: 82,
    verifiedMaintainers: true,
    branchProtection: true,
    signedReleases: true,
    responseHours: 21,
    topics: ['dashboards', 'observability', 'visualization'],
    prs: [
      { number: 7402, title: 'smooth dashboard variable migration', priority: 'hot' },
      { number: 7364, title: 'add panel plugin fixture', priority: 'normal' },
      { number: 7280, title: 'fix table density snapshot', priority: 'quiet' },
    ],
  },
  {
    id: 'nginx',
    name: 'nginx',
    owner: 'nginx',
    district: 'infra',
    language: 'C',
    description: 'Web server block with durable infrastructure roads.',
    stars: 27000,
    forks: 7900,
    openPRs: 39,
    commitsPerWeek: 25,
    contributors: 420,
    goodFirstIssues: 5,
    safetyScore: 68,
    verifiedMaintainers: true,
    branchProtection: false,
    signedReleases: true,
    responseHours: 48,
    topics: ['server', 'proxy', 'networking'],
    prs: [
      { number: 5011, title: 'refresh module build notes', priority: 'quiet' },
      { number: 4990, title: 'fix proxy header example', priority: 'normal' },
      { number: 4920, title: 'patch tls config warning', priority: 'hot' },
    ],
  },
  {
    id: 'opentelemetry',
    name: 'opentelemetry',
    owner: 'open-telemetry',
    district: 'infra',
    language: 'Go',
    description: 'Observability network hub with cross-language roads.',
    stars: 62000,
    forks: 8800,
    openPRs: 185,
    commitsPerWeek: 128,
    contributors: 1500,
    goodFirstIssues: 66,
    safetyScore: 90,
    verifiedMaintainers: true,
    branchProtection: true,
    signedReleases: true,
    responseHours: 10,
    topics: ['tracing', 'metrics', 'observability'],
    prs: [
      { number: 6804, title: 'align semantic convention docs', priority: 'hot' },
      { number: 6751, title: 'add beginner collector recipe', priority: 'normal' },
      { number: 6699, title: 'repair exporter timeout fixture', priority: 'quiet' },
    ],
  },
].map(enrichRepoSafety);

const ROAD_PAIRS: Array<[string, string, number, string]> = [
  ['linux', 'kubernetes', 9041, 'kernel primitives for orchestration'],
  ['kubernetes', 'prometheus', 9822, 'cluster metrics handshake'],
  ['prometheus', 'grafana', 6658, 'native histogram panel path'],
  ['grafana', 'opentelemetry', 7402, 'telemetry dashboard sync'],
  ['opentelemetry', 'vllm', 6804, 'model serving trace route'],
  ['vllm', 'pytorch', 6280, 'scheduler to tensor runtime'],
  ['pytorch', 'transformers', 8891, 'attention kernel bridge'],
  ['transformers', 'langchain', 9920, 'agent model adapter'],
  ['langchain', 'llamacpp', 8341, 'local inference tool lane'],
  ['nextjs', 'react', 8122, 'framework compiler exchange'],
  ['react', 'vite', 9711, 'fast refresh contract'],
  ['vite', 'svelte', 7390, 'compiler dev server path'],
  ['svelte', 'tailwind', 6580, 'style transition fixtures'],
  ['vscode', 'eslint', 9003, 'diagnostics extension loop'],
  ['eslint', 'prettier', 6188, 'formatting rule treaty'],
  ['playwright', 'nextjs', 6014, 'app router test lane'],
  ['deno', 'rust', 7784, 'runtime safety primitives'],
  ['terraform', 'kubernetes', 7761, 'cloud resource bridge'],
  ['nginx', 'redis', 5011, 'edge cache routing'],
  ['opentelemetry', 'prometheus', 6751, 'metrics collector highway'],
  ['playwright', 'vscode', 5971, 'test authoring loop'],
  ['terraform', 'grafana', 7690, 'infra dashboard handoff'],
];

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

const BUILDING_STYLES: Record<BuildingStyleKey, BuildingStyle> = {
  'kernel-spire': {
    key: 'kernel-spire',
    label: 'systems spire',
    heightBias: 1.32,
    widthBias: 0.82,
    depthBias: 0.92,
    roof: 'spire',
    geometry: 'hex',
    bodyColor: '#101923',
    windowDensity: 0.82,
  },
  'orchestrator-core': {
    key: 'orchestrator-core',
    label: 'orchestrator core',
    heightBias: 1.14,
    widthBias: 1.18,
    depthBias: 1.18,
    roof: 'mast',
    geometry: 'octagon',
    bodyColor: '#0d1722',
    windowDensity: 0.72,
  },
  'runtime-stack': {
    key: 'runtime-stack',
    label: 'runtime stack',
    heightBias: 1.05,
    widthBias: 0.98,
    depthBias: 1.02,
    roof: 'cap',
    geometry: 'box',
    bodyColor: '#0b1822',
    windowDensity: 0.68,
  },
  'framework-glass': {
    key: 'framework-glass',
    label: 'framework glass',
    heightBias: 1.18,
    widthBias: 0.86,
    depthBias: 1,
    roof: 'deck',
    geometry: 'box',
    bodyColor: '#081827',
    windowDensity: 0.9,
  },
  'compiler-lattice': {
    key: 'compiler-lattice',
    label: 'compiler lattice',
    heightBias: 1.04,
    widthBias: 0.94,
    depthBias: 0.96,
    roof: 'spire',
    geometry: 'hex',
    bodyColor: '#101622',
    windowDensity: 0.62,
  },
  'ai-lab': {
    key: 'ai-lab',
    label: 'ai lab',
    heightBias: 1.02,
    widthBias: 1.06,
    depthBias: 1.06,
    roof: 'dome',
    geometry: 'cylinder',
    bodyColor: '#15142a',
    windowDensity: 0.74,
  },
  'model-serving': {
    key: 'model-serving',
    label: 'serving tower',
    heightBias: 1.18,
    widthBias: 0.98,
    depthBias: 1.08,
    roof: 'mast',
    geometry: 'octagon',
    bodyColor: '#11182a',
    windowDensity: 0.8,
  },
  'tool-forge': {
    key: 'tool-forge',
    label: 'tool forge',
    heightBias: 0.82,
    widthBias: 1.36,
    depthBias: 1.06,
    roof: 'deck',
    geometry: 'box',
    bodyColor: '#0c1d1a',
    windowDensity: 0.58,
  },
  'editor-megablock': {
    key: 'editor-megablock',
    label: 'editor megablock',
    heightBias: 0.96,
    widthBias: 1.48,
    depthBias: 1.18,
    roof: 'cap',
    geometry: 'box',
    bodyColor: '#0e1a22',
    windowDensity: 0.7,
  },
  'testing-rig': {
    key: 'testing-rig',
    label: 'testing rig',
    heightBias: 0.92,
    widthBias: 1.18,
    depthBias: 1.14,
    roof: 'mast',
    geometry: 'box',
    bodyColor: '#111a1d',
    windowDensity: 0.66,
  },
  'infra-plant': {
    key: 'infra-plant',
    label: 'infra plant',
    heightBias: 0.72,
    widthBias: 1.55,
    depthBias: 1.42,
    roof: 'dish',
    geometry: 'box',
    bodyColor: '#1a1720',
    windowDensity: 0.48,
  },
  'observability-array': {
    key: 'observability-array',
    label: 'observability array',
    heightBias: 0.9,
    widthBias: 1.32,
    depthBias: 1.24,
    roof: 'dish',
    geometry: 'octagon',
    bodyColor: '#151822',
    windowDensity: 0.82,
  },
  'data-vault': {
    key: 'data-vault',
    label: 'data vault',
    heightBias: 0.88,
    widthBias: 1.22,
    depthBias: 1.34,
    roof: 'dome',
    geometry: 'cylinder',
    bodyColor: '#17151b',
    windowDensity: 0.54,
  },
};

function repoHas(repo: Repo, terms: string[]) {
  const text = `${repo.id} ${repo.name} ${repo.owner} ${repo.language} ${repo.description} ${repo.topics.join(' ')}`.toLowerCase();
  return terms.some((term) => text.includes(term));
}

function buildingStyleFor(repo: Repo): BuildingStyle {
  if (repoHas(repo, ['kernel', 'linux', 'systems'])) return BUILDING_STYLES['kernel-spire'];
  if (repoHas(repo, ['kubernetes', 'orchestration', 'containers'])) return BUILDING_STYLES['orchestrator-core'];
  if (repoHas(repo, ['runtime', 'deno', 'tokio', 'server-components'])) return BUILDING_STYLES['runtime-stack'];
  if (repoHas(repo, ['framework', 'react', 'frontend', 'ui', 'css', 'svelte', 'next.js', 'tailwind'])) return BUILDING_STYLES['framework-glass'];
  if (repoHas(repo, ['compiler', 'language', 'parser'])) return BUILDING_STYLES['compiler-lattice'];
  if (repoHas(repo, ['serving', 'inference', 'gpu', 'local-llm', 'quantization'])) return BUILDING_STYLES['model-serving'];
  if (repo.district === 'ai' || repoHas(repo, ['llm', 'models', 'ml', 'nlp', 'tensor', 'agents', 'rag'])) return BUILDING_STYLES['ai-lab'];
  if (repoHas(repo, ['editor', 'extensions', 'vscode'])) return BUILDING_STYLES['editor-megablock'];
  if (repoHas(repo, ['testing', 'browser', 'automation', 'playwright'])) return BUILDING_STYLES['testing-rig'];
  if (repoHas(repo, ['monitoring', 'observability', 'metrics', 'tracing', 'dashboards', 'visualization'])) return BUILDING_STYLES['observability-array'];
  if (repoHas(repo, ['database', 'cache', 'redis'])) return BUILDING_STYLES['data-vault'];
  if (repo.district === 'infra' || repoHas(repo, ['cloud', 'iac', 'server', 'proxy', 'providers'])) return BUILDING_STYLES['infra-plant'];
  return repo.district === 'devtools' ? BUILDING_STYLES['tool-forge'] : BUILDING_STYLES['runtime-stack'];
}

function repoScale(repo: Repo) {
  const stars = clamp((Math.log10(repo.stars) - 4.05) / 1.35, 0.16, 1);
  const forks = clamp(Math.log10(repo.forks + 1) / 5, 0.2, 1);
  const activity = clamp((repo.commitsPerWeek * 0.65 + repo.openPRs * 0.35) / 360, 0.08, 1);
  const community = clamp(Math.log10(repo.contributors + 20) / 3.75, 0.22, 1);
  const beginnerSurface = clamp(repo.goodFirstIssues / 90, 0.05, 1);
  return { stars, forks, activity, community, beginnerSurface };
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
    if (alias.districts?.includes(repo.district)) {
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

function createRepoLayout(repo: Repo, index: number, districtRepos: Repo[]) {
  const district = districtFor(repo);
  const style = buildingStyleFor(repo);
  const scale = repoScale(repo);
  const column = index % 3;
  const row = Math.floor(index / 3);
  const stagger = district.shape === 'clusters' ? Math.sin(index * 1.7) * 2.4 : 0;
  const x = district.x + (column - 1) * 9.8 + stagger + Math.sin((repo.stars % 37) * 0.2) * 1.2;
  const z = district.z + (row - 0.8) * 10.5 + (column % 2) * 2.6 + Math.cos((repo.forks % 43) * 0.16) * 1.1;
  const districtHeightBias = district.shape === 'spires' ? 1.12 : district.shape === 'wide' ? 0.84 : district.shape === 'blocks' ? 0.9 : 1;
  const height = clamp(6 + Math.pow(scale.stars, 1.22) * 40 * style.heightBias * districtHeightBias + scale.activity * 7, 7, 52);
  const width = clamp(2.5 + scale.forks * 5.7 + scale.activity * 1.8, 3, 9.2) * style.widthBias;
  const depth = clamp(2.9 + scale.community * 4.8 + scale.beginnerSurface * 1.2, 3.2, 9.8) * style.depthBias;

  return {
    position: new THREE.Vector3(x, 0, z + (districtRepos.length === 4 ? 2 : 0)),
    height,
    width,
    depth,
    style,
    scale,
  };
}

function createBodyGeometry(style: BuildingStyle, width: number, height: number, depth: number) {
  if (style.geometry === 'cylinder') {
    return new THREE.CylinderGeometry(width * 0.5, width * 0.62, height, 24);
  }
  if (style.geometry === 'hex') {
    return new THREE.CylinderGeometry(width * 0.5, width * 0.66, height, 6);
  }
  if (style.geometry === 'octagon') {
    return new THREE.CylinderGeometry(width * 0.55, width * 0.7, height, 8);
  }
  return new THREE.BoxGeometry(width, height, depth);
}

function createRoofGeometry(style: BuildingStyle, width: number, depth: number) {
  const radius = Math.max(width, depth) * 0.42;
  if (style.roof === 'spire') return new THREE.ConeGeometry(radius * 0.72, Math.max(2.5, radius * 1.1), style.geometry === 'hex' ? 6 : 8);
  if (style.roof === 'dome') return new THREE.SphereGeometry(radius, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  if (style.roof === 'dish') return new THREE.CylinderGeometry(radius * 0.92, radius * 1.12, 0.32, 28);
  if (style.roof === 'mast') return new THREE.CylinderGeometry(radius * 0.22, radius * 0.32, 1.9, 10);
  return new THREE.BoxGeometry(width + 0.42, 0.32, depth + 0.42);
}

function setObjectMaterialOpacity(object: THREE.Object3D, opacity: number) {
  const mesh = object as THREE.Mesh;
  const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
  if (!material) return;
  const materials = Array.isArray(material) ? material : [material];
  materials.forEach((item) => {
    item.transparent = true;
    item.opacity = opacity;
  });
}

function addDetail(details: THREE.Object3D[], group: THREE.Group, object: THREE.Object3D, baseOpacity = 1) {
  object.userData.baseOpacity = baseOpacity;
  details.push(object);
  group.add(object);
  return object;
}

function createFacadePanel(width: number, height: number, color: string, opacity: number) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(width, height, 0.08),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
}

function addBuildingDetails(group: THREE.Group, layout: ReturnType<typeof createRepoLayout>, repo: Repo, district: District) {
  const { width, height, depth, style, scale } = layout;
  const details: THREE.Object3D[] = [];
  const animatedParts: THREE.Object3D[] = [];
  const accent = district.accent;
  const color = district.color;

  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(width * 1.32, 0.42, depth * 1.28),
    new THREE.MeshStandardMaterial({
      color: '#11151a',
      roughness: 0.72,
      metalness: 0.22,
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.025,
      transparent: true,
      opacity: 0.96,
    }),
  );
  plinth.position.y = 0.21;
  addDetail(details, group, plinth, 0.96);

  if (style.key === 'framework-glass') {
    [-1, 1].forEach((side) => {
      const fin = createFacadePanel(width * 0.18, height * 0.92, accent, 0.24);
      fin.position.set(side * (width * 0.55), height * 0.52, depth * 0.24);
      fin.rotation.y = side * 0.08;
      addDetail(details, group, fin, 0.24);
    });
    const skybridge = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.92, 0.16, depth * 1.22),
      new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.36, blending: THREE.AdditiveBlending }),
    );
    skybridge.position.y = height * 0.72;
    addDetail(details, group, skybridge, 0.36);
  }

  if (style.key === 'ai-lab' || style.key === 'model-serving') {
    [0.62, 0.82].forEach((radiusScale, ringIndex) => {
      const orbit = new THREE.Mesh(
        new THREE.TorusGeometry(Math.max(width, depth) * radiusScale, 0.035, 8, 92),
        new THREE.MeshBasicMaterial({ color: ringIndex === 0 ? accent : '#f6e7ff', transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending }),
      );
      orbit.rotation.x = Math.PI * 0.5;
      orbit.rotation.z = ringIndex * 0.72;
      orbit.position.y = height * (0.5 + ringIndex * 0.13);
      addDetail(details, group, orbit, 0.28);
      animatedParts.push(orbit);
    });
    const labCore = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(0.35, width * 0.11), 18, 18),
      new THREE.MeshBasicMaterial({ color: '#f8f7ff', transparent: true, opacity: 0.62, blending: THREE.AdditiveBlending }),
    );
    labCore.position.set(width * 0.24, height * 0.62, depth * 0.52);
    addDetail(details, group, labCore, 0.62);
  }

  if (style.key === 'tool-forge' || style.key === 'editor-megablock' || style.key === 'testing-rig') {
    const moduleCount = style.key === 'editor-megablock' ? 4 : 3;
    for (let i = 0; i < moduleCount; i += 1) {
      const module = new THREE.Mesh(
        new THREE.BoxGeometry(width * (0.32 + scale.activity * 0.14), height * (0.22 + i * 0.02), depth * 0.28),
        new THREE.MeshStandardMaterial({
          color: '#111c1d',
          roughness: 0.54,
          metalness: 0.28,
          emissive: new THREE.Color(color),
          emissiveIntensity: 0.08,
          transparent: true,
          opacity: 0.9,
        }),
      );
      module.position.set((i - (moduleCount - 1) / 2) * width * 0.3, height * (0.18 + i * 0.12), -depth * 0.62);
      addDetail(details, group, module, 0.9);
    }
    const rail = createFacadePanel(width * 1.08, 0.12, accent, 0.42);
    rail.position.set(0, height * 0.52, depth * 0.52);
    addDetail(details, group, rail, 0.42);
  }

  if (style.key === 'infra-plant' || style.key === 'observability-array' || style.key === 'data-vault') {
    const stackCount = style.key === 'infra-plant' ? 3 : 2;
    for (let i = 0; i < stackCount; i += 1) {
      const stack = new THREE.Mesh(
        new THREE.CylinderGeometry(width * 0.08, width * 0.1, height * (0.45 + scale.activity * 0.22), 12),
        new THREE.MeshStandardMaterial({
          color: '#1d1c20',
          roughness: 0.5,
          metalness: 0.34,
          emissive: new THREE.Color(color),
          emissiveIntensity: 0.12,
          transparent: true,
          opacity: 0.92,
        }),
      );
      stack.position.set((i - (stackCount - 1) / 2) * width * 0.32, height * 0.27, depth * 0.62);
      addDetail(details, group, stack, 0.92);
    }
    const dish = new THREE.Mesh(
      new THREE.TorusGeometry(Math.max(width, depth) * 0.24, 0.035, 8, 48),
      new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.36, blending: THREE.AdditiveBlending }),
    );
    dish.rotation.x = Math.PI * 0.66;
    dish.position.set(width * 0.22, height + 0.86, depth * 0.06);
    addDetail(details, group, dish, 0.36);
    animatedParts.push(dish);
  }

  if (style.key === 'kernel-spire' || style.key === 'compiler-lattice' || style.key === 'orchestrator-core') {
    const ribCount = style.key === 'orchestrator-core' ? 8 : 6;
    for (let i = 0; i < ribCount; i += 1) {
      const angle = (i / ribCount) * Math.PI * 2;
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, height * 0.88, 0.08),
        new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending }),
      );
      rib.position.set(Math.cos(angle) * width * 0.43, height * 0.5, Math.sin(angle) * depth * 0.43);
      rib.rotation.y = -angle;
      addDetail(details, group, rib, 0.22);
    }
  }

  return { details, animatedParts };
}

function createBuilding(repo: Repo, index: number, districtRepos: Repo[]) {
  const district = districtFor(repo);
  const layout = createRepoLayout(repo, index, districtRepos);
  const { style } = layout;
  const group = new THREE.Group();
  group.position.copy(layout.position);

  const bodyGeometry = createBodyGeometry(style, layout.width, layout.height, layout.depth);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(style.bodyColor),
    roughness: style.geometry === 'box' ? 0.36 : 0.46,
    metalness: style.key === 'framework-glass' ? 0.42 : 0.26,
    emissive: new THREE.Color(district.color),
    emissiveIntensity: style.key === 'framework-glass' ? 0.055 : 0.04,
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = layout.height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  body.userData.repoId = repo.id;
  group.add(body);

  const topMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(district.accent),
    roughness: 0.32,
    metalness: 0.36,
    emissive: new THREE.Color(district.color),
    emissiveIntensity: 0.35,
  });
  const top = new THREE.Mesh(createRoofGeometry(style, layout.width, layout.depth), topMaterial);
  top.position.y = layout.height + (style.roof === 'spire' ? Math.max(1.4, Math.max(layout.width, layout.depth) * 0.28) : style.roof === 'dome' ? Math.max(layout.width, layout.depth) * 0.2 : 0.22);
  if (style.roof === 'dish') top.rotation.x = Math.PI * 0.08;
  top.userData.repoId = repo.id;
  group.add(top);

  const edgeGeometry = new THREE.EdgesGeometry(bodyGeometry);
  const edgeMaterial = new THREE.LineBasicMaterial({ color: district.color, transparent: true, opacity: 0.12 });
  const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
  edges.position.copy(body.position);
  group.add(edges);

  const windowGeometry = new THREE.PlaneGeometry(0.32, 0.18);
  const windowMaterial = new THREE.MeshBasicMaterial({
    color: district.color,
    transparent: true,
    opacity: 0.76,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const cols = Math.max(2, Math.floor(layout.width / 0.72));
  const rows = Math.max(3, Math.floor(layout.height / (style.key === 'infra-plant' ? 1.35 : 0.96)));
  const litWindows: THREE.Matrix4[] = [];
  const dummy = new THREE.Object3D();
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const litSeed = Math.sin((row + 1) * 12.9898 + (col + 1) * 78.233 + repo.stars * 0.0001);
      if (litSeed - Math.floor(litSeed) < 1 - style.windowDensity) continue;
      const wx = -layout.width / 2 + 0.58 + col * ((layout.width - 1.16) / Math.max(1, cols - 1));
      const wy = 0.8 + row * ((layout.height - 1.6) / rows);
      dummy.position.set(wx, wy, layout.depth / 2 + 0.012);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      litWindows.push(dummy.matrix.clone());
    }
  }

  const windows = new THREE.InstancedMesh(windowGeometry, windowMaterial, Math.max(1, litWindows.length));
  litWindows.forEach((matrix, matrixIndex) => windows.setMatrixAt(matrixIndex, matrix));
  windows.userData.repoId = repo.id;
  group.add(windows);

  const antennaHeight = 1.7 + (repo.openPRs % 9) * 0.18;
  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, antennaHeight, 8),
    new THREE.MeshBasicMaterial({ color: '#dbe8ff', transparent: true, opacity: 0.42 }),
  );
  antenna.position.set(layout.width * 0.18, layout.height + antennaHeight / 2 + 0.18, layout.depth * 0.08);
  group.add(antenna);

  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 14, 14),
    new THREE.MeshBasicMaterial({ color: district.accent, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending }),
  );
  beacon.position.set(layout.width * 0.18, layout.height + antennaHeight + 0.24, layout.depth * 0.08);
  group.add(beacon);

  const architecture = addBuildingDetails(group, layout, repo, district);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(Math.max(layout.width, layout.depth) * 0.78, 0.045, 10, 84),
    new THREE.MeshBasicMaterial({ color: district.color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.08;
  group.add(ring);

  return {
    repo,
    district,
    style,
    group,
    body,
    top,
    windows,
    beacon,
    ring,
    details: architecture.details,
    animatedParts: architecture.animatedParts,
    position: layout.position.clone(),
    height: layout.height,
    width: layout.width,
    depth: layout.depth,
    phase: (repo.stars % 997) / 997,
  };
}

function createGround(scene: THREE.Scene) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(150, 110, 1, 1),
    new THREE.MeshStandardMaterial({
      color: '#071020',
      roughness: 0.88,
      metalness: 0.18,
      emissive: '#071a32',
      emissiveIntensity: 0.12,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  ground.userData.role = 'ground';
  scene.add(ground);

  const grid = new THREE.GridHelper(150, 40, '#4f8cff', '#16345f');
  grid.userData.role = 'grid';
  const gridMaterial = grid.material as THREE.Material | THREE.Material[];
  if (Array.isArray(gridMaterial)) {
    gridMaterial.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.23;
    });
  } else {
    gridMaterial.transparent = true;
    gridMaterial.opacity = 0.23;
  }
  grid.position.y = 0.015;
  scene.add(grid);

  DISTRICTS.forEach((district) => {
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 25),
      new THREE.MeshBasicMaterial({
        color: district.color,
        transparent: true,
        opacity: 0.055,
        depthWrite: false,
      }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(district.x, 0.025, district.z + 2);
    plane.userData.role = 'district-plane';
    scene.add(plane);

    const labelTexture = makeSpriteTexture(district.label.toUpperCase(), 'semantic district', district.color, 520, 130);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, transparent: true, opacity: 0.78, depthWrite: false }));
    label.position.set(district.x, 1.4, district.z + 17);
    label.scale.set(10, 2.5, 1);
    scene.add(label);
  });
}

function createSky(scene: THREE.Scene) {
  const starGeometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  for (let i = 0; i < 900; i += 1) {
    const radius = 70 + Math.random() * 120;
    const theta = Math.random() * Math.PI * 2;
    const y = 26 + Math.random() * 75;
    positions.push(Math.cos(theta) * radius, y, Math.sin(theta) * radius - 22);
  }
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      color: '#dce8ff',
      size: 0.22,
      transparent: true,
      opacity: 0.64,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  stars.userData.role = 'stars';
  scene.add(stars);

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(5.4, 32, 32),
    new THREE.MeshBasicMaterial({ color: '#dce8ff', transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending }),
  );
  moon.position.set(48, 46, -72);
  moon.userData.role = 'moon';
  scene.add(moon);
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
      const groundMaterial = material as THREE.MeshStandardMaterial;
      groundMaterial.color.set(isDay ? '#20324a' : '#071020');
      groundMaterial.emissive.set(isDay ? '#14243a' : '#071a32');
      groundMaterial.emissiveIntensity = isDay ? 0.05 : 0.12;
    }

    if (role === 'grid') setMaterialOpacity(material, isDay ? 0.16 : 0.23);
    if (role === 'stars') setMaterialOpacity(material, isDay ? 0.12 : 0.64);
    if (role === 'moon') setMaterialOpacity(material, isDay ? 0.025 : 0.08);
    if (role === 'district-plane') setMaterialOpacity(material, isDay ? 0.075 : 0.055);
  });
}

function createRoads(scene: THREE.Scene, buildings: BuildingObject[]) {
  const byId = new Map(buildings.map((building) => [building.repo.id, building]));
  const roadMaterial = new THREE.MeshBasicMaterial({
    color: '#ff8c3c',
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const carGeometry = new THREE.SphereGeometry(0.27, 14, 14);
  const carMaterial = new THREE.MeshBasicMaterial({
    color: '#ffc06b',
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
  });

  return ROAD_PAIRS.flatMap(([sourceId, targetId, number, title], index) => {
    const source = byId.get(sourceId);
    const target = byId.get(targetId);
    if (!source || !target) return [];

    const start = new THREE.Vector3(source.position.x, 0.22, source.position.z);
    const end = new THREE.Vector3(target.position.x, 0.22, target.position.z);
    const mid = start.clone().lerp(end, 0.5);
    const distance = start.distanceTo(end);
    mid.y = 0.4 + Math.min(4.2, distance * 0.045);
    mid.z += Math.sin(index * 1.8) * 5.2;
    const curve = new THREE.CatmullRomCurve3([start, mid, end], false, 'catmullrom', 0.28);
    const tube = new THREE.TubeGeometry(curve, 72, 0.055, 8, false);
    const mesh = new THREE.Mesh(tube, roadMaterial.clone());
    scene.add(mesh);

    const cars = Array.from({ length: 3 }, (_, carIndex) => {
      const car = new THREE.Mesh(carGeometry, carMaterial.clone());
      car.userData.offset = carIndex / 3;
      car.userData.repoId = source.repo.id;
      scene.add(car);
      return car;
    });

    const labelTexture = makeSpriteTexture(`PR #${number}`, title.slice(0, 30), '#ff8c3c', 460, 142);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, transparent: true, opacity: 0.68, depthWrite: false }));
    label.position.copy(mid);
    label.position.y += 2.9;
    label.scale.set(7.4, 2.28, 1);
    scene.add(label);

    return [
      {
        id: `${sourceId}-${targetId}`,
        source: source.repo,
        target: target.repo,
        curve,
        mesh,
        cars,
        label,
        speed: 0.035 + (index % 5) * 0.006,
        phase: (index % 7) / 7,
      },
    ];
  });
}

function applyFilter(objects: BuildingObject[], roads: RoadObject[], filter: FilterKey) {
  for (const building of objects) {
    const active =
      filter === 'all' ||
      building.repo.district === filter ||
      (filter === 'stars' && building.repo.stars >= 10000) ||
      (filter === 'safe' && isGreenSafety(building.repo.safetyScore));
    const opacity = active ? 1 : 0.22;
    building.body.material.opacity = opacity;
    building.body.material.transparent = opacity < 1;
    building.top.material.opacity = active ? 1 : 0.28;
    building.top.material.transparent = !active;
    building.windows.material.opacity = active ? 0.76 : 0.12;
    building.details.forEach((detail) => {
      const baseOpacity = typeof detail.userData.baseOpacity === 'number' ? detail.userData.baseOpacity : 0.78;
      setObjectMaterialOpacity(detail, active ? baseOpacity : Math.min(0.18, baseOpacity * 0.32));
    });
  }

  for (const road of roads) {
    const sourceActive =
      filter === 'all' ||
      road.source.district === filter ||
      (filter === 'stars' && road.source.stars >= 10000) ||
      (filter === 'safe' && isGreenSafety(road.source.safetyScore));
    const targetActive =
      filter === 'all' ||
      road.target.district === filter ||
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
  const [appearance, setAppearance] = useState<Appearance>('night');
  const [zoomValue, setZoomValue] = useState(1);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [query, setQuery] = useState('');
  const [hoveredRepo, setHoveredRepo] = useState<Repo | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [stats, setStats] = useState({ repos: 0, prs: 0, safe: 0 });
  const [safetyProfiles, setSafetyProfiles] = useState<Record<string, SafetyProfile>>({});

  const effectiveRepos = useMemo(() => {
    return REPOS.map((repo) => applySafetyProfile(repo, safetyProfiles[repo.id] ?? repo.safetyProfile));
  }, [safetyProfiles]);

  const reposByDistrict = useMemo(() => {
    return DISTRICTS.map((district) => ({
      district,
      repos: effectiveRepos.filter((repo) => repo.district === district.key),
    }));
  }, [effectiveRepos]);
  const searchResults = useMemo(() => searchRepos(query, effectiveRepos), [query, effectiveRepos]);
  const safetyReasons = useMemo(() => (selectedRepo ? getSafetyReasons(selectedRepo) : []), [selectedRepo]);

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
    let cancelled = false;
    fetch('/api/py/safety-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repos: REPOS }),
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
    scene.background = new THREE.Color('#020408');
    scene.fog = new THREE.FogExp2('#071126', 0.012);

    const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 0.1, 500);
    camera.position.set(-84, 28, 68);

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

    const ambient = new THREE.AmbientLight('#7c9edb', 0.7);
    scene.add(ambient);

    const key = new THREE.DirectionalLight('#dbe8ff', 2.4);
    key.position.set(-22, 48, 20);
    key.castShadow = true;
    key.shadow.mapSize.width = 2048;
    key.shadow.mapSize.height = 2048;
    scene.add(key);

    const rim = new THREE.PointLight('#4f8cff', 68, 120, 1.6);
    rim.position.set(0, 18, -32);
    scene.add(rim);

    createGround(scene);
    createSky(scene);

    const buildings: BuildingObject[] = [];
    reposByDistrict.forEach(({ repos }) => {
      repos.forEach((repo, index) => {
        const building = createBuilding(repo, index, repos);
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

    const handlePointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      refs.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      refs.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
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
      const mouseParallax = enteredRef.current
        ? new THREE.Vector3(refs.pointer.x * 2.6, refs.pointer.y * 0.9, refs.pointer.x * 1.2)
        : new THREE.Vector3(0, 0, 0);

      const introPosition = new THREE.Vector3(
        THREE.MathUtils.lerp(-92, 44, introT),
        THREE.MathUtils.lerp(30, 24, introT),
        THREE.MathUtils.lerp(76, 48, introT),
      );
      const introTarget = new THREE.Vector3(THREE.MathUtils.lerp(-30, 10, introT), 6.5, THREE.MathUtils.lerp(2, -2, introT));

      let desiredPosition = introPosition;
      let desiredTarget = introTarget;

      if (enteredRef.current) {
        desiredPosition = CAMERA_HOME.clone().add(mouseParallax);
        desiredTarget = TARGET_HOME.clone();
      }

      if (selectedBuilding && enteredRef.current) {
        const focusDistance = clamp(selectedBuilding.height * 0.9 + Math.max(selectedBuilding.width, selectedBuilding.depth) * 1.2, 24, 48);
        desiredPosition = selectedBuilding.position.clone().add(new THREE.Vector3(focusDistance * 0.72, focusDistance * 0.82, focusDistance));
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
        const isSimilar = similarActive && similarDistrictRef.current === building.repo.district;
        const pulse = 0.5 + Math.sin(elapsed * 2.5 + building.phase * 8) * 0.5;
        building.body.material.emissiveIntensity = isSelected ? 0.36 : isHovered ? 0.28 : isSimilar ? 0.22 + pulse * 0.16 : 0.035;
        building.top.material.emissiveIntensity = isSelected || isHovered ? 0.75 : 0.35 + pulse * 0.08;
        building.windows.material.opacity = isHovered || isSelected ? 0.98 : filterRef.current === 'all' ? 0.76 : building.windows.material.opacity;
        building.beacon.scale.setScalar(1 + pulse * 0.9);
        building.beacon.material.opacity = 0.32 + pulse * 0.62;
        building.ring.material.opacity = isSimilar || isSelected ? 0.22 + pulse * 0.42 : 0;
        building.ring.scale.setScalar(1 + pulse * 0.12);
        building.animatedParts.forEach((part, partIndex) => {
          part.rotation.y += 0.0024 + partIndex * 0.0008;
          if (part instanceof THREE.Mesh && part.geometry instanceof THREE.TorusGeometry) {
            part.rotation.z += 0.0012;
          }
        });
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

    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerleave', handlePointerLeave);
    renderer.domElement.addEventListener('click', handleClick);
    renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('resize', handleResize);
    refs.frame = requestAnimationFrame(animate);

    return () => {
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
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
  }, [reposByDistrict]);

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
    if (district) {
      setFilter(district.key);
      similarDistrictRef.current = district.key;
      similarUntilRef.current = performance.now() + 5200;
    }
  };

  const selectSearchResult = (result: SearchResult) => {
    setEntered(true);
    setSelectedRepo(result.repo);
    setFilter(result.repo.district);
    similarDistrictRef.current = result.repo.district;
    similarUntilRef.current = performance.now() + 3600;
  };

  const handleFilter = (next: FilterKey) => {
    setFilter(filter === next ? 'all' : next);
    if (next !== 'all' && next !== 'stars' && next !== 'safe') {
      similarDistrictRef.current = next;
      similarUntilRef.current = performance.now() + 2800;
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
            <small>{buildingStyleFor(hoveredRepo).label} · {formatMetric(hoveredRepo.stars)} stars · {hoveredRepo.openPRs} PRs</small>
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
          <div className="filter-row" aria-label="City filters">
            {DISTRICTS.map((district) => (
              <button
                key={district.key}
                className={`filter-chip ${filter === district.key ? 'is-active' : ''}`}
                style={{ '--chip-color': district.color } as CSSProperties}
                type="button"
                onClick={() => handleFilter(district.key)}
              >
                {district.label}
              </button>
            ))}
            <button className={`filter-chip star-chip ${filter === 'stars' ? 'is-active' : ''}`} type="button" onClick={() => handleFilter('stars')}>
              ★ 10k+
            </button>
            <button className={`filter-chip safe-chip ${filter === 'safe' ? 'is-active' : ''}`} type="button" onClick={() => handleFilter('safe')}>
              safe
            </button>
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
          <strong>height: repo size · footprint: community · silhouette: function</strong>
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
              <span>{buildingStyleFor(selectedRepo).label}</span>
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
          --sift-bg-deep: #050607;
          --sift-bg-mid: #0b1113;
          --sift-bg-surface: #12191b;
          --sift-glass-surface: rgba(230,246,242,0.055);
          --sift-glass-border: rgba(230,246,242,0.13);
          --sift-primary-blue: #5bc0be;
          --sift-accent-warm: #f4b860;
          --sift-text-primary: rgba(255,255,255,0.92);
          --sift-text-secondary: rgba(236,244,241,0.56);
          --sift-text-tertiary: rgba(236,244,241,0.28);
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
            radial-gradient(circle at 78% 16%, rgba(244,184,96,0.16), transparent 30%),
            radial-gradient(circle at 18% 70%, rgba(91,192,190,0.14), transparent 30%),
            radial-gradient(circle at 50% 105%, rgba(52,211,153,0.1), transparent 42%),
            linear-gradient(180deg, #050607 0%, #0b1113 52%, #12191b 100%);
          font-family: Inter, system-ui, sans-serif;
          isolation: isolate;
        }

        .sift-page.is-day {
          --sift-glass-surface: rgba(12,24,45,0.13);
          --sift-glass-border: rgba(255,255,255,0.28);
          --sift-text-primary: rgba(255,255,255,0.95);
          background:
            radial-gradient(circle at 76% 16%, rgba(255,244,207,0.32), transparent 28%),
            radial-gradient(circle at 22% 72%, rgba(91,192,190,0.18), transparent 30%),
            linear-gradient(180deg, #bfd5e8 0%, #7fa8b2 48%, #24323a 100%);
        }

        .sift-page::before {
          content: "";
          position: fixed;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background:
            linear-gradient(90deg, rgba(5,6,7,0.38), transparent 22%, transparent 76%, rgba(5,6,7,0.4)),
            radial-gradient(circle at 50% 72%, transparent 22%, rgba(5,6,7,0.2) 78%);
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
          text-shadow: 0 0 54px rgba(91,192,190,0.28), 0 20px 84px rgba(0,0,0,0.88);
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
          text-shadow: 0 0 24px rgba(91,192,190,0.48);
          animation: enterIn 900ms cubic-bezier(.16,1,.3,1) 3s forwards;
        }

        .enter-city:hover {
          color: #fff;
          text-shadow: 0 0 32px rgba(244,184,96,0.7);
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
          border: 1px solid rgba(230,246,242,0.12);
          background:
            linear-gradient(135deg, rgba(230,246,242,0.075), rgba(230,246,242,0.026)),
            rgba(6,11,12,0.64);
          box-shadow: 0 12px 34px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.08);
          backdrop-filter: blur(24px) saturate(160%);
          -webkit-backdrop-filter: blur(24px) saturate(160%);
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
          border: 1px solid rgba(230,246,242,0.1);
          border-radius: 8px;
          color: rgba(255,255,255,0.72);
          background: rgba(230,246,242,0.035);
          cursor: pointer;
          transition: transform 160ms ease, color 160ms ease, border-color 160ms ease, background 160ms ease;
        }

        .tool-group button:hover,
        .mode-toggle button:hover,
        .guide-button:hover {
          transform: translateY(-1px);
          color: rgba(255,255,255,0.96);
          border-color: rgba(91,192,190,0.48);
          background: rgba(91,192,190,0.13);
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
          border-color: rgba(91,192,190,0.58);
          background: rgba(91,192,190,0.22);
          box-shadow: 0 0 22px rgba(91,192,190,0.16), inset 0 1px 0 rgba(255,255,255,0.16);
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
        .sift-page.is-day .tutorial-card {
          background:
            linear-gradient(135deg, rgba(8,20,42,0.52), rgba(8,20,42,0.22)),
            rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.22);
        }

        .search-cluster {
          position: absolute;
          left: 50%;
          bottom: 38px;
          width: min(760px, calc(100vw - 32px));
          transform: translateX(-50%);
          display: grid;
          gap: 13px;
          pointer-events: auto;
        }

        .search-cluster.has-panel {
          left: calc(50% - 205px);
          width: min(620px, calc(100vw - 470px));
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
          border-radius: 14px;
          background:
            radial-gradient(circle at var(--mx) var(--my), rgba(244,184,96,0.09), rgba(230,246,242,0.026) 32%, rgba(230,246,242,0.012) 62%),
            linear-gradient(135deg, rgba(230,246,242,0.065), rgba(230,246,242,0.026) 38%, rgba(91,192,190,0.04));
          box-shadow: 0 12px 38px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.12);
          backdrop-filter: blur(34px) saturate(180%);
          -webkit-backdrop-filter: blur(34px) saturate(180%);
          overflow: hidden;
        }

        .glass-search::before {
          content: "";
          position: absolute;
          inset: -2px;
          border-radius: inherit;
          padding: 1px;
          background: conic-gradient(from 0deg, rgba(255,255,255,0), rgba(236,244,241,0.24), rgba(91,192,190,0.62), rgba(255,255,255,0), rgba(244,184,96,0.35), rgba(255,255,255,0));
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
          border: 1px solid rgba(91,192,190,0.34);
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
          border-radius: 9px;
          color: rgba(255,255,255,0.94);
          background: linear-gradient(135deg, rgba(91,192,190,0.78), rgba(244,184,96,0.34)), rgba(255,255,255,0.04);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.16), 0 10px 28px rgba(91,192,190,0.2);
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
          border-radius: 12px;
          background:
            linear-gradient(145deg, rgba(230,246,242,0.07), rgba(230,246,242,0.024)),
            rgba(6,11,12,0.68);
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
          border-radius: 8px;
          background: rgba(230,246,242,0.035);
          text-align: left;
          cursor: pointer;
          transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
        }

        .search-result:hover {
          transform: translateY(-1px);
          border-color: color-mix(in srgb, var(--repo-color, #4f8cff), transparent 42%);
          background: rgba(91,192,190,0.1);
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
          border-radius: 8px;
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

        .star-chip {
          --chip-color: #fbbf24;
        }

        .safe-chip {
          --chip-color: #34d399;
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
          text-shadow: 0 0 24px rgba(91,192,190,0.22);
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
          background: radial-gradient(circle at 50% 52%, rgba(91,192,190,0.12), rgba(5,6,7,0.44) 58%, rgba(5,6,7,0.7));
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
          border-radius: 12px;
          background:
            radial-gradient(circle at 15% 0%, rgba(91,192,190,0.16), transparent 36%),
            linear-gradient(145deg, rgba(230,246,242,0.08), rgba(230,246,242,0.026)),
            rgba(6,11,12,0.8);
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
          border-radius: 8px;
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
          background: #5bc0be;
          box-shadow: 0 0 18px rgba(91,192,190,0.58);
        }

        .tutorial-kicker {
          display: block;
          color: #5bc0be;
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
          border: 1px solid rgba(91,192,190,0.24);
          border-radius: 8px;
          background: rgba(91,192,190,0.075);
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
          border-radius: 8px;
          color: rgba(255,255,255,0.86);
          background: rgba(255,255,255,0.045);
          cursor: pointer;
          font-size: 11px;
        }

        .tutorial-nav button:last-child {
          background: linear-gradient(135deg, rgba(91,192,190,0.66), rgba(244,184,96,0.26));
          box-shadow: 0 12px 32px rgba(91,192,190,0.18), inset 0 1px 0 rgba(255,255,255,0.14);
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
          border-radius: 8px;
          background: rgba(6,11,12,0.78);
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
          width: min(410px, calc(100vw - 20px));
          height: 100vh;
          padding: 34px 28px 28px;
          border-left: 1px solid rgba(255,255,255,0.13);
          background:
            radial-gradient(circle at 20% 5%, color-mix(in srgb, var(--repo-color), transparent 82%), rgba(255,255,255,0) 32%),
            linear-gradient(145deg, rgba(230,246,242,0.075), rgba(230,246,242,0.028)),
            rgba(6,11,12,0.78);
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
          border-radius: 8px;
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
          border-radius: 6px;
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
          border-radius: 8px;
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
          border-radius: 6px;
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
          border-radius: 8px;
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
