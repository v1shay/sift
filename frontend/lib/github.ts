import {
  GitHubProject,
  GitHubSearchResponse,
  SearchParameters,
} from './types';
import {
  GITHUB_SEARCH_REPOS_URL,
  DEFAULT_RESULTS_PER_PAGE,
} from './constants';

// ─── Build GitHub Search Query ──────────────────────────────────────

/**
 * Converts our structured SearchParameters into the GitHub search query
 * string format: https://docs.github.com/en/search-github/searching-on-github/searching-for-repositories
 */
export function buildSearchQuery(params: SearchParameters): string {
  const parts: string[] = [];

  // Main query text
  if (params.query) {
    parts.push(params.query);
  }

  // Language qualifier
  if (params.language) {
    parts.push(`language:${params.language}`);
  }

  // Topic qualifier
  if (params.topic) {
    parts.push(`topic:${params.topic}`);
  }

  // Star range
  if (params.minStars !== undefined && params.maxStars !== undefined) {
    parts.push(`stars:${params.minStars}..${params.maxStars}`);
  } else if (params.minStars !== undefined) {
    parts.push(`stars:>=${params.minStars}`);
  } else if (params.maxStars !== undefined) {
    parts.push(`stars:<=${params.maxStars}`);
  }

  // License
  if (params.license) {
    parts.push(`license:${params.license}`);
  }

  // Created after
  if (params.createdAfter) {
    parts.push(`created:>${params.createdAfter}`);
  }

  // Pushed/updated after
  if (params.pushedAfter) {
    parts.push(`pushed:>${params.pushedAfter}`);
  }

  // Beginner-friendly: look for repos with "good-first-issues" label count > 0
  if (params.beginnerFriendly) {
    parts.push('good-first-issues:>0');
  }

  return parts.join(' ');
}

// ─── Search GitHub Repositories ─────────────────────────────────────

export async function searchGitHubRepos(
  params: SearchParameters,
  perPage: number = DEFAULT_RESULTS_PER_PAGE,
): Promise<{ projects: GitHubProject[]; totalCount: number }> {
  const query = buildSearchQuery(params);

  const url = new URL(GITHUB_SEARCH_REPOS_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('per_page', String(perPage));

  if (params.sort) {
    url.searchParams.set('sort', params.sort);
  }
  if (params.order) {
    url.searchParams.set('order', params.order);
  }

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  // Use GitHub token if available (higher rate limits)
  const githubToken = process.env.GITHUB_TOKEN;
  if (githubToken) {
    headers['Authorization'] = `Bearer ${githubToken}`;
  }

  console.log(`[GitHub Search] Query: "${query}" | URL: ${url.toString()}`);

  const response = await fetch(url.toString(), { headers });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[GitHub Search] Error ${response.status}: ${errorBody}`);
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const data: GitHubSearchResponse = await response.json();

  const projects: GitHubProject[] = data.items.map((repo) => ({
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description,
    url: repo.html_url,
    homepage: repo.homepage,
    language: repo.language,
    topics: repo.topics ?? [],
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    openIssues: repo.open_issues_count,
    watchers: repo.watchers_count,
    license: repo.license?.spdx_id ?? null,
    createdAt: repo.created_at,
    updatedAt: repo.updated_at,
    pushedAt: repo.pushed_at,
    owner: {
      login: repo.owner.login,
      avatarUrl: repo.owner.avatar_url,
      url: repo.owner.html_url,
    },
  }));

  return { projects, totalCount: data.total_count };
}
