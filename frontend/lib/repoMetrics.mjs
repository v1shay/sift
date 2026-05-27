export const CLUSTER_MODES = ['stack', 'stars', 'trending', 'response'];
export const HEIGHT_SCALE_DRIVERS = ['stars', 'activity', 'contributors'];

const INTENT_TERMS = {
  beginner: ['beginner', 'starter', 'good first', 'good-first', 'new contributor', 'easy', 'friendly'],
  popular: ['popular', 'stars', 'starred', 'famous', 'landmark', 'big'],
  underrated: ['underrated', 'hidden gem', 'low star', 'low-star', 'small', 'overlooked'],
  active: ['active', 'trending', 'busy', 'recent', 'alive', 'velocity', 'maintained'],
  safe: ['safe', 'trusted', 'secure', 'stable', 'reliable', 'low risk', 'low-risk'],
  fast: ['fast maintainer', 'fast maintainers', 'quick response', 'responsive', 'response', 'maintainers'],
  ai: ['ai', 'ml', 'llm', 'rag', 'model', 'inference', 'vector'],
  infra: ['infra', 'infrastructure', 'cloud', 'devops', 'deploy', 'kubernetes', 'container'],
  frontend: ['frontend', 'front-end', 'ui', 'react', 'css', 'component', 'web'],
  backend: ['backend', 'back-end', 'api', 'server', 'database', 'service'],
  systems: ['systems', 'runtime', 'compiler', 'kernel', 'os', 'language'],
  docs: ['docs', 'documentation', 'guide', 'tutorial', 'examples'],
};

const DOMAIN_PATTERNS = {
  ai: /\b(ai|ml|llm|rag|model|models|inference|vector|embedding|transformer|neural)\b/,
  infra: /\b(infra|infrastructure|cloud|devops|deploy|kubernetes|container|docker|terraform|helm|platform)\b/,
  frontend: /\b(frontend|front-end|ui|react|css|component|web|design|browser)\b/,
  backend: /\b(backend|back-end|api|server|database|service|worker|queue|cache)\b/,
  systems: /\b(system|systems|runtime|compiler|kernel|os|language|rust|go|memory)\b/,
  docs: /\b(doc|docs|documentation|guide|tutorial|example|examples|starter)\b/,
};

export function normalizeRepoNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : fallback;
}

export function scoreActivity(repo) {
  return normalizeRepoNumber(repo?.commitsPerWeek) * 2.2
    + normalizeRepoNumber(repo?.openPRs) * 1.8
    + normalizeRepoNumber(repo?.openIssues) * 0.18
    + normalizeRepoNumber(repo?.goodFirstIssues) * 1.6;
}

export function estimateResponseHealth(repo) {
  const hours = Math.max(1, normalizeRepoNumber(repo?.responseHours, 168));
  return Math.round(clamp(112 - Math.log2(hours + 1) * 14, 0, 100));
}

export function scoreContributionSafety(repo) {
  return Math.round(clamp(
    normalizeRepoNumber(repo?.safetyScore, 60) * 0.48
    + estimateResponseHealth(repo) * 0.22
    + Math.min(22, normalizeRepoNumber(repo?.goodFirstIssues) * 1.4)
    + (repo?.branchProtection ? 5 : 0)
    + (repo?.verifiedMaintainers ? 5 : 0)
    + (repo?.contributionGuide || repo?.issueTemplates ? 4 : 0)
    + (repo?.smallScopedIssues ? 3 : 0),
    0,
    100,
  ));
}

export function scoreTrending(repo) {
  return Math.round(
    scoreActivity(repo)
    + Math.log10(normalizeRepoNumber(repo?.stars) + 1) * 12
    + estimateResponseHealth(repo) * 0.18
    + scoreContributionSafety(repo) * 0.1,
  );
}

export function clusterRank(repo, mode = 'stack') {
  if (mode === 'stars') {
    return Math.log10(normalizeRepoNumber(repo?.stars) + 1) * 100
      + normalizeRepoNumber(repo?.contributors) * 0.08;
  }

  if (mode === 'trending') return scoreTrending(repo);

  if (mode === 'response') {
    return estimateResponseHealth(repo) * 2
      + scoreContributionSafety(repo)
      + normalizeRepoNumber(repo?.goodFirstIssues);
  }

  return normalizeRepoNumber(repo?.stars)
    + scoreActivity(repo) * 18
    + normalizeRepoNumber(repo?.contributors) * 0.8;
}

export function rankReposForCluster(repos, mode = 'stack') {
  return [...(repos ?? [])].sort(
    (a, b) => clusterRank(b, mode) - clusterRank(a, mode)
      || normalizeRepoNumber(b?.stars) - normalizeRepoNumber(a?.stars)
      || String(a?.id ?? '').localeCompare(String(b?.id ?? '')),
  );
}

export function rankReposForIntent(query, repos) {
  const cleanQuery = normalizeText(query);
  if (!cleanQuery) return [];

  const tokens = tokenize(cleanQuery);
  const intents = buildIntentMap(cleanQuery, tokens);

  return [...(repos ?? [])]
    .map((repo) => scoreIntentResult(repo, cleanQuery, tokens, intents))
    .filter(Boolean)
    .sort(
      (a, b) => b.score - a.score
        || scoreContributionSafety(b.repo) - scoreContributionSafety(a.repo)
        || normalizeRepoNumber(b.repo?.stars) - normalizeRepoNumber(a.repo?.stars)
        || String(a.repo?.id ?? '').localeCompare(String(b.repo?.id ?? '')),
    )
    .slice(0, 6);
}

function scoreIntentResult(repo, cleanQuery, tokens, intents) {
  const pings = [];
  const text = repoSearchText(repo);
  const addPing = (label, detail, weight) => {
    if (weight <= 0) return;
    const existing = pings.find((ping) => ping.label === label && ping.detail === detail);
    if (existing) existing.weight = Math.max(existing.weight, Math.round(weight));
    else pings.push({ label, detail, weight: Math.round(weight) });
  };

  if (normalizeText(repo?.name) === cleanQuery || normalizeText(`${repo?.owner ?? ''}/${repo?.name ?? ''}`) === cleanQuery) {
    addPing('name', `exact repo match: ${repo?.owner ?? 'unknown'}/${repo?.name ?? repo?.id ?? 'repo'}`, 150);
  }

  tokens.forEach((token) => {
    if (token.length >= 2 && text.includes(token)) addPing('match', `matches "${token}"`, token.length > 4 ? 24 : 14);
  });

  scoreDomainIntents(repo, text, intents, addPing);

  if (intents.beginner) {
    addPing(
      'intent',
      `${normalizeRepoNumber(repo?.goodFirstIssues)} good-first issues`,
      Math.min(86, normalizeRepoNumber(repo?.goodFirstIssues) * 4 + scoreContributionSafety(repo) * 0.42),
    );
  }

  if (intents.popular) {
    addPing(
      'popularity',
      `${formatCompact(normalizeRepoNumber(repo?.stars))} stars`,
      Math.log10(normalizeRepoNumber(repo?.stars) + 1) * 20,
    );
  }

  if (intents.underrated) {
    const lowStarBoost = Math.max(0, 98 - Math.log10(normalizeRepoNumber(repo?.stars) + 1) * 17);
    addPing(
      'underrated',
      `${formatCompact(normalizeRepoNumber(repo?.stars))} stars, ${normalizeRepoNumber(repo?.commitsPerWeek)} commits/week`,
      lowStarBoost + scoreActivity(repo) * 0.24 + scoreContributionSafety(repo) * 0.12,
    );
  }

  if (intents.active) {
    addPing(
      'activity',
      `${normalizeRepoNumber(repo?.commitsPerWeek)} commits/week and ${normalizeRepoNumber(repo?.openPRs) + normalizeRepoNumber(repo?.openIssues)} open items`,
      scoreTrending(repo) * 0.48,
    );
  }

  if (intents.safe) {
    addPing(
      'safety',
      `${normalizeRepoNumber(repo?.safetyScore)}% contribution-ready`,
      scoreContributionSafety(repo),
    );
  }

  if (intents.fast) {
    addPing(
      'response',
      `${normalizeRepoNumber(repo?.responseHours, 168)}h response estimate`,
      estimateResponseHealth(repo),
    );
  }

  const score = pings.reduce((total, ping) => total + ping.weight, 0);
  if (score <= 0) return null;

  return {
    repo,
    score: Math.round(score),
    pings: pings.sort((a, b) => b.weight - a.weight).slice(0, 4),
  };
}

function scoreDomainIntents(repo, text, intents, addPing) {
  const topics = (repo?.topics ?? []).map((topic) => normalizeText(topic)).filter(Boolean);
  const topicText = topics.join(', ');

  Object.entries(DOMAIN_PATTERNS).forEach(([intent, pattern]) => {
    if (!intents[intent]) return;
    const topicMatch = topics.some((topic) => pattern.test(topic));
    const textMatch = pattern.test(text);
    if (!topicMatch && !textMatch) return;

    const label = intent === 'ai'
      ? 'AI/ML stack match'
      : intent === 'infra'
        ? 'infrastructure stack match'
        : intent === 'frontend'
          ? 'frontend stack match'
          : intent === 'backend'
            ? 'backend stack match'
            : intent === 'systems'
              ? 'systems stack match'
              : 'documentation match';
    addPing('intent', topicMatch && topicText ? `${label}: ${topicText}` : label, topicMatch ? 76 : 62);
  });
}

function buildIntentMap(cleanQuery, tokens) {
  return Object.fromEntries(
    Object.entries(INTENT_TERMS).map(([intent, terms]) => [
      intent,
      terms.some((term) => cleanQuery.includes(term) || tokens.includes(term)),
    ]),
  );
}

function repoSearchText(repo) {
  return normalizeText([
    repo?.id,
    repo?.owner,
    repo?.name,
    repo?.language,
    repo?.district,
    repo?.description,
    ...(repo?.topics ?? []),
    ...(repo?.prs ?? []).map((pull) => pull?.title ?? ''),
  ].join(' '));
}

function normalizeText(value) {
  return String(value ?? '').toLowerCase().trim();
}

function tokenize(value) {
  return normalizeText(value).split(/[^a-z0-9+#.-]+/).filter(Boolean);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatCompact(value) {
  if (value >= 1_000_000) return `${Math.round(value / 100_000) / 10}m`;
  if (value >= 1_000) return `${Math.round(value / 100) / 10}k`;
  return String(Math.round(value));
}
