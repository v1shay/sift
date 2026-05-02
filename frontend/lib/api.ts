import {
  ChatMessage,
  GraphData,
  GraphFacets,
  GraphOptions,
  PullRequestFlowResponse,
} from './types';

/**
 * Send a chat message to the graph API and get back the narrowed graph match.
 */
export async function sendChatMessage(
  messages: ChatMessage[],
): Promise<any> {
    const userMessage = messages.filter(m => m.role === 'user').pop()?.content;
    
  const response = await fetch('/api/py/graph-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: userMessage }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export async function fetchGraph(options: GraphOptions): Promise<GraphData> {
  const params = new URLSearchParams({
    groupBy: options.groupBy,
    sortBy: options.sortBy,
    limit: String(options.limit),
    minStars: String(options.minStars),
  });

  if (options.language) params.set('language', options.language);
  if (options.topic) params.set('topic', options.topic);
  if (options.org) params.set('org', options.org);

  const response = await fetch(`/api/py/graph-full?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Graph request failed with status ${response.status}`);
  }

  return response.json();
}

export async function fetchGraphFacets(): Promise<GraphFacets> {
  const response = await fetch('/api/py/graph-facets');

  if (!response.ok) {
    throw new Error(`Facet request failed with status ${response.status}`);
  }

  return response.json();
}

export async function fetchPullRequestFlow(
  repoIds: number[],
  days = 30,
): Promise<PullRequestFlowResponse> {
  const response = await fetch('/api/py/pr-flow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoIds, days }),
  });

  if (!response.ok) {
    throw new Error(`Pull request flow request failed with status ${response.status}`);
  }

  return response.json();
}
