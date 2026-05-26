import { chromium } from 'playwright';

const targetUrl = process.env.SIFT_TEST_URL ?? 'http://127.0.0.1:3000/';

const repoNames = [
  'microsoft/vscode',
  'kubernetes/kubernetes',
  'facebook/react',
  'vercel/next.js',
  'openai/openai-node',
  'supabase/supabase',
  'rust-lang/rust',
  'denoland/deno',
  'grafana/grafana',
  'hashicorp/terraform',
  'elastic/elasticsearch',
  'pytorch/pytorch',
  'tensorflow/tensorflow',
  'golang/go',
  'nodejs/node',
  'vitejs/vite',
  'storybookjs/storybook',
  'tailwindlabs/tailwindcss',
  'redis/redis',
  'apache/airflow',
  'prometheus/prometheus',
  'ollama/ollama',
  'langchain-ai/langchain',
  'huggingface/transformers',
];

let imported = false;

const graphFixture = () => {
  const names = imported ? ['codex-smoke/sift-loaded-repo', ...repoNames] : repoNames;
  return {
    nodes: names.map((fullName, index) => {
      const isImported = index === 0 && imported;
      const isIntentHero = fullName === 'openai/openai-node';
      const isLandmark = fullName === 'microsoft/vscode' || fullName === 'kubernetes/kubernetes';

      return {
        id: `repo_${index + 1}`,
        group: 'repository',
        nodeType: 'repository',
        fullName,
        owner: fullName.split('/')[0],
        name: fullName.split('/')[1],
        description: isIntentHero
          ? 'Beginner friendly AI SDK with fast maintainers, LLM examples, and starter issues.'
          : `${fullName} repository used for SIFT regression testing.`,
        language: isIntentHero ? 'TypeScript' : ['TypeScript', 'Go', 'Rust', 'Python', 'JavaScript'][index % 5],
        stars: isImported ? 4321 : isIntentHero ? 860 : isLandmark ? 120_000 - index * 1_900 : 18_000 - index * 420,
        forks: isImported ? 210 : isIntentHero ? 120 : 18_000 - index * 180,
        openIssues: isImported ? 17 : isIntentHero ? 34 : 40 + index * 7,
        openPRs: isImported ? 2 : isIntentHero ? 12 : 8 + (index % 9),
        contributorsCount: isIntentHero ? 72 : 220 + index * 5,
        topics: isImported
          ? ['developer-tools', 'visualization', 'good-first-issue']
          : isIntentHero
            ? ['ai', 'llm', 'developer-tools', 'good-first-issue', 'typescript']
            : ['frontend', 'good-first-issue'],
        license: 'MIT',
        isBeginnerFriendly: true,
        pushedAt: new Date(Date.now() - (isIntentHero ? 0 : index * 86_400_000)).toISOString(),
        safetyScore: isIntentHero ? 92 : 78,
        recentPullRequests: isImported
        ? [
          { number: 12, title: 'Improve import smoke coverage', state: 'open' },
          { number: 13, title: 'Keep city load responsive', state: 'open' },
        ]
        : [],
      };
    }),
    links: [],
    meta: {
      groupBy: 'domain',
      sortBy: 'stars',
      projectCount: names.length,
      clusterCount: 6,
    },
  };
};

const fail = (message, details = {}) => {
  throw new Error(`${message}\n${JSON.stringify(details, null, 2)}`);
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 768 }, deviceScaleFactor: 1 });
const consoleProblems = [];

page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') {
    const text = message.text();
    const recoverableSiftFallback = text.includes('[SIFT PR flow]') || text.includes('[Safety scoring]');
    if (!recoverableSiftFallback && !text.includes('GL Driver Message') && !text.includes('React DevTools')) {
      consoleProblems.push(`${message.type()}: ${text}`);
    }
  }
});

page.on('pageerror', (error) => {
  consoleProblems.push(`pageerror: ${error.message}`);
});

await page.route('**/api/py/graph-full?**', async (route) => {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(graphFixture()) });
});

await page.route('**/api/py/pr-flow**', async (route) => {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ summaries: {}, aggregate: {} }) });
});

await page.route('**/api/py/safety-score**', async (route) => {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ profiles: {} }) });
});

await page.route('**/api/py/repos/import**', async (route) => {
  imported = true;
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      repo: graphFixture().nodes[0],
      meta: { fullName: 'codex-smoke/sift-loaded-repo', created: true },
    }),
  });
});

try {
  await page.addInitScript(() => localStorage.removeItem('sift.cityIntroSeen'));
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForFunction(() => !document.querySelector('.sift-loading-screen') && window.__siftCameraProbe, null, { timeout: 60_000 });

  await page.waitForTimeout(2_900);
  const introProbe = await page.evaluate(() => window.__siftCameraProbe?.());
  if (!introProbe) fail('Camera probe unavailable during intro');

  const search = page.getByPlaceholder('try: safe ai, observability, rust runtime...');
  await search.fill('wasd safe');
  const beforeTyping = await page.evaluate(() => window.__siftCameraProbe?.());
  await page.waitForTimeout(260);
  const passiveTypingDrift = await page.evaluate(() => window.__siftCameraProbe?.());
  await page.keyboard.press('w');
  await page.keyboard.press('a');
  await page.keyboard.press('s');
  await page.keyboard.press('d');
  await page.waitForTimeout(260);
  const afterTyping = await page.evaluate(() => window.__siftCameraProbe?.());
  const passiveDrift = Math.abs(passiveTypingDrift.camera.x - beforeTyping.camera.x) + Math.abs(passiveTypingDrift.camera.z - beforeTyping.camera.z);
  const keyDrift = Math.abs(afterTyping.camera.x - passiveTypingDrift.camera.x) + Math.abs(afterTyping.camera.z - passiveTypingDrift.camera.z);
  if (keyDrift > passiveDrift + 2) {
    fail('Typing WASD moved the camera', { beforeTyping, passiveTypingDrift, afterTyping, passiveDrift, keyDrift });
  }

  await search.blur();
  await page.keyboard.down('w');
  await page.waitForTimeout(220);
  await page.keyboard.up('w');
  const afterMovement = await page.evaluate(() => window.__siftCameraProbe?.());
  if (Math.abs(afterMovement.camera.z - afterTyping.camera.z) < 1) {
    fail('WASD did not move camera after input blur', { afterTyping, afterMovement });
  }

  await page.getByRole('button', { name: 'Night appearance' }).click();
  await page.getByRole('button', { name: 'Day appearance' }).click();
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByRole('button', { name: 'Reset camera' }).click();
  await page.getByRole('button', { name: /Walkthrough/ }).click();
  await page.getByRole('button', { name: 'Close walkthrough' }).click();

  await page.getByRole('button', { name: /^Activity$/ }).click();
  await page.getByRole('button', { name: /^Trending$/ }).click();
  await page.getByRole('button', { name: /^View Encoding$/ }).click();
  await page.waitForFunction(() => document.body.innerText.includes('Height maps to Activity'), null, { timeout: 8_000 });
  await page.getByRole('button', { name: 'Close view encoding' }).click();

  await search.fill('beginner friendly ai repo with fast maintainers');
  await page.waitForFunction(() => {
    const text = document.body.innerText;
    return text.includes('openai-node') && (text.includes('intent:') || text.includes('response:'));
  }, null, { timeout: 12_000 });
  const firstIntentResult = await page.locator('.search-result').first().innerText();
  if (!firstIntentResult.includes('openai-node')) {
    fail('Intent search did not rank the beginner-friendly AI repo first', { firstIntentResult });
  }

  await page.getByPlaceholder('owner/repo').fill('codex-smoke/sift-loaded-repo');
  await page.getByRole('button', { name: /^Load$/ }).click();
  await page.waitForFunction(() => document.body.innerText.includes('sift-loaded-repo'), null, { timeout: 15_000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.querySelector('.sift-loading-screen') && document.body.innerText.includes('sift-loaded-repo'), null, { timeout: 60_000 });

  if (consoleProblems.length) fail('Console problems in regression smoke', { consoleProblems });

  console.log(JSON.stringify({ ok: true, importedVisibleAfterReload: imported }, null, 2));
} finally {
  await browser.close();
}
