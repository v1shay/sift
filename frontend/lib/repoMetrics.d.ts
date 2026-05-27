export type ClusterMode = 'stack' | 'stars' | 'trending' | 'response';
export type HeightScaleDriver = 'stars' | 'activity' | 'contributors';

export type RepoMetricInput = {
  id?: string;
  name?: string;
  owner?: string;
  district?: string;
  language?: string;
  description?: string;
  stars?: number;
  openPRs?: number;
  openIssues?: number;
  commitsPerWeek?: number;
  contributors?: number;
  goodFirstIssues?: number;
  safetyScore?: number;
  verifiedMaintainers?: boolean;
  branchProtection?: boolean;
  signedReleases?: boolean;
  responseHours?: number;
  topics?: string[];
  prs?: Array<{ title?: string }>;
  contributionGuide?: boolean;
  issueTemplates?: boolean;
  smallScopedIssues?: boolean;
};

export type IntentPing = {
  label: string;
  detail: string;
  weight: number;
};

export type IntentSearchResult<TRepo extends RepoMetricInput = RepoMetricInput> = {
  repo: TRepo;
  score: number;
  pings: IntentPing[];
};

export const CLUSTER_MODES: ClusterMode[];
export const HEIGHT_SCALE_DRIVERS: HeightScaleDriver[];
export function normalizeRepoNumber(value: unknown, fallback?: number): number;
export function scoreActivity(repo: RepoMetricInput): number;
export function estimateResponseHealth(repo: RepoMetricInput): number;
export function scoreContributionSafety(repo: RepoMetricInput): number;
export function scoreTrending(repo: RepoMetricInput): number;
export function clusterRank(repo: RepoMetricInput, mode?: ClusterMode): number;
export function rankReposForCluster<TRepo extends RepoMetricInput>(repos: TRepo[], mode?: ClusterMode): TRepo[];
export function rankReposForIntent<TRepo extends RepoMetricInput>(query: string, repos: TRepo[]): IntentSearchResult<TRepo>[];
