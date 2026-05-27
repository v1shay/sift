import { chromium } from 'playwright';

const targetUrl = process.env.SIFT_TEST_URL ?? 'http://127.0.0.1:3000/';

const fail = (message, details = {}) => {
  const detailText = Object.keys(details).length ? `\n${JSON.stringify(details, null, 2)}` : '';
  throw new Error(`${message}${detailText}`);
};

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
  'nestjs/nest',
  'vitejs/vite',
  'storybookjs/storybook',
  'tailwindlabs/tailwindcss',
  'prisma/prisma',
  'redis/redis',
  'apache/airflow',
  'ansible/ansible',
  'prometheus/prometheus',
  'opentelemetry/opentelemetry-js',
  'ollama/ollama',
  'langchain-ai/langchain',
  'huggingface/transformers',
  'apache/spark',
  'duckdb/duckdb',
  'mui/material-ui',
  'sveltejs/svelte',
  'remix-run/remix',
  'vuejs/core',
  'electron/electron',
  'docker/compose',
  'helm/helm',
  'nginx/nginx',
  'vitest-dev/vitest',
  'playwright-community/playwright',
  ...Array.from({ length: 120 }, (_, index) => `codex-marker/repo-${String(index + 1).padStart(3, '0')}`),
];

const graphFixture = {
  nodes: repoNames.map((fullName, index) => ({
    id: `repo_${index + 1}`,
    group: 'repository',
    fullName,
    owner: fullName.split('/')[0],
    name: fullName.split('/')[1],
    description: `${fullName} repository used for camera focus smoke testing.`,
    language: ['TypeScript', 'Go', 'Rust', 'Python', 'JavaScript'][index % 5],
    stars: Math.max(3, 120_000 - index * 1_900),
    forks: Math.max(1, 18_000 - index * 180),
    openIssues: 40 + index * 7,
    openPRs: 8 + (index % 9),
    contributorsCount: 220 + index * 5,
    topics: index % 4 === 0 ? ['frontend', 'good-first-issue'] : index % 4 === 1 ? ['cloud', 'infrastructure'] : index % 4 === 2 ? ['ai', 'developer-tools'] : ['security', 'database'],
    license: 'MIT',
    isBeginnerFriendly: index % 3 === 0,
    pushedAt: new Date(Date.now() - index * 86_400_000).toISOString(),
    safetyScore: 62 + (index % 30),
  })),
};

const vectorMagnitude = ({ x, y, z }) => Math.sqrt(x * x + y * y + z * z);

const sampleCamera = async (page, label, count = 8) => {
  const samples = [];
  for (let index = 0; index < count; index += 1) {
    await page.waitForTimeout(170);
    samples.push(await page.evaluate(() => window.__siftCameraProbe?.() ?? null));
  }

  const missingProbe = samples.some((sample) => !sample);
  if (missingProbe) fail(`${label}: camera probe was unavailable`, { samples });

  const maxHeight = Math.max(...samples.map((sample) => sample.camera.y));
  const maxMagnitude = Math.max(...samples.map((sample) => vectorMagnitude(sample.camera)));
  if (maxHeight > 720 || maxMagnitude > 1250) {
    fail(`${label}: camera focus traveled too far`, { maxHeight, maxMagnitude, samples });
  }

  return { samples, maxHeight, maxMagnitude };
};

const findClickableBuilding = async (page) => page.evaluate(() => {
  const probe = window.__siftSceneProbe;
  if (typeof probe !== 'function') return null;

  return probe().find((building) => {
    const safeViewport =
      building.visible &&
      building.hitRepoId === building.id &&
      building.x > 235 &&
      building.y > 70 &&
      building.x < window.innerWidth - 420 &&
      building.y < window.innerHeight - 120;
    if (!safeViewport) return false;

    const hit = document.elementFromPoint(building.x, building.y);
    return hit?.tagName.toLowerCase() === 'canvas';
  }) ?? null;
});

const findClickableMarker = async (page) => page.evaluate(() => {
  const probe = window.__siftMarkerProbe;
  if (typeof probe !== 'function') return null;

  return probe().find((marker) => {
    const safeViewport =
      marker.visible &&
      marker.hitRepoId === marker.id &&
      marker.x > 80 &&
      marker.y > 70 &&
      marker.x < window.innerWidth - 80 &&
      marker.y < window.innerHeight - 120;
    if (!safeViewport) return false;

    const hit = document.elementFromPoint(marker.x, marker.y);
    return hit?.tagName.toLowerCase() === 'canvas';
  }) ?? null;
});

const waitForOpenPanel = async (page, label, details = {}) => {
  await page.waitForTimeout(900);
  const openedTitle = await page.evaluate(() => document.querySelector('.repo-panel.is-open h2')?.textContent?.trim() ?? '');
  if (openedTitle) return;

  try {
    await page.waitForSelector('.repo-panel.is-open', { state: 'attached', timeout: 8_000 });
    const attachedTitle = await page.evaluate(() => document.querySelector('.repo-panel.is-open h2')?.textContent?.trim() ?? '');
    if (attachedTitle) return;
    throw new Error('Repo panel opened without a title');
  } catch (error) {
    const state = await page.evaluate(() => ({
      panelClass: document.querySelector('.repo-panel')?.className ?? null,
      panelTitle: document.querySelector('.repo-panel h2')?.textContent ?? null,
      camera: window.__siftCameraProbe?.() ?? null,
      buttons: Array.from(document.querySelectorAll('.network-lists button')).map((button) => button.textContent?.trim()).slice(0, 8),
      bodyText: document.body.innerText.slice(0, 500),
    }));
    fail(`${label}: repo panel did not open`, { details, state, error: String(error) });
  }
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 768 }, deviceScaleFactor: 1 });
const consoleMessages = [];
const failedRequests = [];

page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') {
    consoleMessages.push(`${message.type()}: ${message.text()}`);
  }
});

page.on('pageerror', (error) => {
  consoleMessages.push(`pageerror: ${error.message}`);
});

page.on('requestfailed', (request) => {
  failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`);
});

try {
  await page.addInitScript(() => localStorage.setItem('sift.cityIntroSeen', 'true'));
  await page.route('**/api/py/graph-full?**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(graphFixture) });
  });
  await page.route('**/api/py/pr-flow', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ summaries: {} }) });
  });
  await page.route('**/api/py/safety-score', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ profiles: {} }) });
  });

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForFunction(
    () => !document.querySelector('.sift-loading-screen') && document.querySelector('.three-stage canvas') && window.__siftCameraProbe,
    null,
    { timeout: 60_000 },
  );

  const baseline = await page.evaluate(() => ({
    title: document.title,
    overlayText: Array.from(document.querySelectorAll('[data-nextjs-dialog-overlay], nextjs-portal'))
      .map((element) => element.textContent?.trim() ?? '')
      .find(Boolean) ?? '',
    bodyText: document.body.innerText.slice(0, 300),
  }));

  if (!baseline.title.includes('Sift')) fail('Wrong page loaded', baseline);
  if (baseline.overlayText) fail('Framework error overlay is visible', baseline);

  await page.waitForFunction(() => document.querySelectorAll('.network-lists button').length > 0, null, { timeout: 30_000 });
  const firstNetworkRepo = page.locator('.network-lists button').first();
  const networkButtonText = await firstNetworkRepo.innerText();
  await firstNetworkRepo.click({ force: true, noWaitAfter: true });
  await waitForOpenPanel(page, 'network repo click', { networkButtonText });
  const networkPanelTitle = (await page.locator('.repo-panel.is-open h2').innerText()).trim();
  const networkFocus = await sampleCamera(page, 'network repo click');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => !document.querySelector('.sift-loading-screen') && document.querySelector('.three-stage canvas') && window.__siftMarkerProbe,
    null,
    { timeout: 60_000 },
  );
  await page.waitForTimeout(1_200);

  let clickableBuilding = await findClickableBuilding(page);
  if (!clickableBuilding) {
    await page.waitForTimeout(1_000);
    clickableBuilding = await findClickableBuilding(page);
  }
  if (!clickableBuilding) fail('No clickable 3D repo building found for camera smoke test');

  await page.mouse.move(clickableBuilding.x, clickableBuilding.y);
  await page.waitForTimeout(80);
  clickableBuilding = await findClickableBuilding(page) ?? clickableBuilding;
  await page.mouse.click(clickableBuilding.x, clickableBuilding.y);
  await waitForOpenPanel(page, '3D building click', { clickableBuilding });
  const buildingPanelTitle = (await page.locator('.repo-panel.is-open h2').innerText()).trim();
  if (!buildingPanelTitle) fail('3D building click opened an unnamed repo panel', { clickableBuilding });
  const buildingFocus = await sampleCamera(page, '3D building click');

  await page.evaluate(() => {
    document.querySelector('button[aria-label="Reset camera"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(4_200);

  const clickableMarker = await findClickableMarker(page);
  if (!clickableMarker) fail('No clickable lightweight repo marker found for camera smoke test');
  await page.mouse.click(clickableMarker.x, clickableMarker.y);
  await waitForOpenPanel(page, 'lightweight marker click', { clickableMarker });
  const markerPanelTitle = (await page.locator('.repo-panel.is-open h2').innerText()).trim();
  if (!markerPanelTitle) fail('Lightweight marker click opened an unnamed repo panel', { clickableMarker });

  const relevantMessages = consoleMessages.filter((message) => (
    !message.includes('[webpack.cache.PackFileCacheStrategy]') &&
    !message.includes('Download the React DevTools') &&
    !message.includes('GL Driver Message') &&
    !message.includes('GPU stall due to ReadPixels')
  ));
  if (relevantMessages.length) fail('Console warnings/errors found during camera focus smoke test', { relevantMessages, failedRequests });

  console.log(JSON.stringify({
    ok: true,
    url: targetUrl,
    networkButtonText,
    networkPanelTitle,
    networkMaxHeight: Number(networkFocus.maxHeight.toFixed(2)),
    networkMaxMagnitude: Number(networkFocus.maxMagnitude.toFixed(2)),
    clickedBuilding: clickableBuilding.hitRepoName,
    buildingPanelTitle,
    buildingMaxHeight: Number(buildingFocus.maxHeight.toFixed(2)),
    buildingMaxMagnitude: Number(buildingFocus.maxMagnitude.toFixed(2)),
    clickedMarker: clickableMarker.hitRepoName,
    markerPanelTitle,
  }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
