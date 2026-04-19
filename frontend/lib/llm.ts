import { SearchParameters, ChatMessage } from './types';
import {
  OPENROUTER_API_URL,
  OPENROUTER_MODEL,
  SYSTEM_PROMPT_EXTRACT_PARAMS,
  SYSTEM_PROMPT_SUMMARIZE,
} from './constants';
import { GitHubProject } from './types';

// ─── Helpers ────────────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY; // Reuse the OpenRouter key from .env.local
  if (!key) {
    throw new Error('OpenRouter API key not configured (ANTHROPIC_API_KEY)');
  }
  return key;
}

async function callLLM(messages: ChatMessage[]): Promise<string> {
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://sift.ai',
      'X-Title': 'Sift',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('[LLM] Error:', data);
    throw new Error(data.error?.message || 'LLM request failed');
  }

  return data.choices[0].message.content;
}

// ─── Extract Search Parameters ──────────────────────────────────────

/**
 * Uses the LLM to extract structured search parameters from the user's
 * natural language query.
 */
export async function extractSearchParameters(
  userMessage: string,
): Promise<SearchParameters> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT_EXTRACT_PARAMS },
    { role: 'user', content: userMessage },
  ];

  const raw = await callLLM(messages);
  console.log('[LLM] Raw extraction response:', raw);

  try {
    // Strip markdown fences if the model wraps the JSON
    const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return parsed as SearchParameters;
  } catch (err) {
    console.error('[LLM] Failed to parse search parameters:', raw);
    // Fallback: use the raw message as the query
    return { query: userMessage };
  }
}

// ─── Summarize Results ──────────────────────────────────────────────

/**
 * Uses the LLM to generate a friendly, conversational summary of the
 * GitHub search results for the user.
 */
export async function summarizeResults(
  userMessage: string,
  projects: GitHubProject[],
  searchParams: SearchParameters,
): Promise<string> {
  const projectSummaries = projects.map((p) => ({
    name: p.fullName,
    description: p.description,
    language: p.language,
    stars: p.stars,
    forks: p.forks,
    openIssues: p.openIssues,
    topics: p.topics.slice(0, 5),
    url: p.url,
    license: p.license,
    pushedAt: p.pushedAt,
  }));

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT_SUMMARIZE },
    {
      role: 'user',
      content: `The user asked: "${userMessage}"

Search parameters used: ${JSON.stringify(searchParams)}

Here are the top ${projects.length} results:
${JSON.stringify(projectSummaries, null, 2)}

Please present these results to the user in a helpful, conversational way.`,
    },
  ];

  return await callLLM(messages);
}
