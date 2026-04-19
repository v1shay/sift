// ─── GitHub Project Types ───────────────────────────────────────────

export interface GitHubProject {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  homepage: string | null;
  language: string | null;
  topics: string[];
  stars: number;
  forks: number;
  openIssues: number;
  watchers: number;
  license: string | null;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  owner: {
    login: string;
    avatarUrl: string;
    url: string;
  };
  /** Calculated match score from 0-100 based on relevance to user query */
  matchScore?: number;
  /** Human-readable reason why this project matches the query */
  matchReason?: string;
}

// ─── Search Parameters (extracted by LLM) ───────────────────────────

export interface SearchParameters {
  /** Main search query string for GitHub */
  query: string;
  /** Programming language filter (e.g., "python", "typescript") */
  language?: string;
  /** Topic/tag filter (e.g., "machine-learning", "web") */
  topic?: string;
  /** Minimum star count */
  minStars?: number;
  /** Maximum star count — useful for finding smaller/newer projects */
  maxStars?: number;
  /** Sort field: "stars", "forks", "help-wanted-issues", "updated" */
  sort?: 'stars' | 'forks' | 'help-wanted-issues' | 'updated';
  /** Sort order */
  order?: 'asc' | 'desc';
  /** Whether the user wants beginner-friendly projects (good-first-issue label) */
  beginnerFriendly?: boolean;
  /** Specific license type (e.g., "mit", "apache-2.0") */
  license?: string;
  /** Created after this date (ISO 8601 format) */
  createdAfter?: string;
  /** Pushed/updated after this date (ISO 8601 format) */
  pushedAfter?: string;
}

// ─── GitHub API Raw Response Types ──────────────────────────────────

export interface GitHubSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubRepoRaw[];
}

export interface GitHubRepoRaw {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  topics?: string[];
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  watchers_count: number;
  license: { spdx_id: string; name: string } | null;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  owner: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
}

// ─── Chat Types ─────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  role: 'assistant';
  content: string;
  projects?: GitHubProject[];
  searchParameters?: SearchParameters;
}

// ─── API Request/Response ───────────────────────────────────────────

export interface ChatRequest {
  messages: ChatMessage[];
}

// ─── Graph Explorer Types ──────────────────────────────────────────

export type GraphGroupBy = 'domain' | 'language' | 'topic' | 'org' | 'stars' | 'raw';
export type GraphSortBy = 'stars' | 'forks' | 'issues' | 'updated' | 'name';

export interface GraphOptions {
  groupBy: GraphGroupBy;
  sortBy: GraphSortBy;
  limit: number;
  minStars: number;
  language?: string;
  topic?: string;
  org?: string;
}

export interface GraphFacet {
  name: string;
  count: number;
}

export interface GraphFacets {
  languages: GraphFacet[];
  topics: GraphFacet[];
  orgs: GraphFacet[];
  totalProjects: number;
}

export interface GraphNode {
  id: string;
  name: string;
  group: string;
  nodeType: 'cluster' | 'repository' | 'topic' | 'user';
  val: number;
  color: string;
  language?: string;
  stars?: number;
  forks?: number;
  openIssues?: number;
  owner?: string;
  topics?: string[];
  repoCount?: number;
  url?: string;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  meta?: {
    groupBy: GraphGroupBy;
    sortBy: GraphSortBy;
    projectCount: number;
    clusterCount: number;
  };
}
