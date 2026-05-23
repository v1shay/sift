import { chromium } from 'playwright';

const targetUrl = process.env.SIFT_TEST_URL ?? 'http://127.0.0.1:3000/';
const graphUrl = process.env.SIFT_GRAPH_URL ?? 'http://127.0.0.1:8000/api/py/graph-full?limit=120';

const fail = (message, details = {}) => {
  const detailText = Object.keys(details).length ? `\n${JSON.stringify(details, null, 2)}` : '';
  throw new Error(`${message}${detailText}`);
};

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 20_000);
const graphResponse = await fetch(graphUrl, { signal: controller.signal }).catch((error) => {
  fail('Could not fetch backend graph fixture for atlas smoke test', { graphUrl, error: String(error) });
});
clearTimeout(timeout);

if (!graphResponse?.ok) {
  fail('Backend graph fixture returned a non-OK response', { graphUrl, status: graphResponse?.status });
}

const graphBody = await graphResponse.text();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 768 }, deviceScaleFactor: 1 });
const consoleMessages = [];
const failedRequests = [];
const apiResponses = [];
const badResponses = [];

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

page.on('response', (response) => {
  if (response.url().includes('/api/py/')) {
    apiResponses.push(`${response.status()} ${response.url()}`);
  }
  if (response.status() >= 400) {
    badResponses.push(`${response.status()} ${response.url()}`);
  }
});

const readPan = async () => page.locator('.sift-page').evaluate((element) => {
  const style = getComputedStyle(element);
  return {
    x: style.getPropertyValue('--atlas-pan-x').trim(),
    y: style.getPropertyValue('--atlas-pan-y').trim(),
  };
});

try {
  await page.route('**/api/py/graph-full?**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: graphBody });
  });
  await page.route('**/api/py/pr-flow', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ summaries: {} }) });
  });
  await page.route('**/api/py/safety-score', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ profiles: {} }) });
  });

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForSelector('.rendered-atlas-layer', { state: 'visible', timeout: 20_000 });
  try {
    await page.waitForFunction(
      () => !document.querySelector('.sift-loading-screen') && document.querySelectorAll('.atlas-repo-marker').length >= 25,
      null,
      { timeout: 60_000 },
    );
  } catch (error) {
    const loadingState = await page.evaluate(() => ({
      loading: Boolean(document.querySelector('.sift-loading-screen')),
      markers: document.querySelectorAll('.atlas-repo-marker').length,
      districts: document.querySelectorAll('.rendered-district').length,
      bodyText: document.body.innerText.slice(0, 500),
      scripts: Array.from(document.scripts).map((script) => script.src).filter(Boolean).slice(0, 12),
    }));
    fail('Atlas did not finish loading repo markers', { loadingState, apiResponses, failedRequests, consoleMessages, error: String(error) });
  }

  const baseline = await page.evaluate(() => {
    const layer = document.querySelector('.rendered-atlas-layer');
    const layerStyle = layer ? getComputedStyle(layer) : null;
    const forbiddenLabels = [
      'Forest Repository',
      'Skyline Core',
      'Vertical Arcology',
      'Volcano Forge',
      'Crystal Fields',
      'Frozen Kingdom',
      'Redwood Archive',
      'Holographic Gridlands',
      'Desert Expanse',
      'Floating Island Systems',
      'Fractured Realms',
    ];
    const bodyText = document.body.innerText;

    return {
      title: document.title,
      markers: document.querySelectorAll('.atlas-repo-marker').length,
      districts: document.querySelectorAll('.rendered-district').length,
      terrains: document.querySelectorAll('.atlas-terrain-region').length,
      terrainSprites: document.querySelectorAll('.atlas-ground-tile').length,
      connectors: document.querySelectorAll('.atlas-connector').length,
      pathBeds: document.querySelectorAll('.atlas-path-bed').length,
      overlay: Boolean(document.querySelector('[data-nextjs-dialog-overlay], nextjs-portal')),
      atlasImages: document.querySelectorAll('.rendered-atlas-layer img').length,
      spriteBackgrounds: Array.from(document.querySelectorAll('.atlas-repo-marker span')).filter((element) => getComputedStyle(element).backgroundImage.includes('/images/atlas-reference-assets/')).length,
      screenshotReferences: Array.from(document.querySelectorAll('[src], [style]')).filter((element) => `${element.getAttribute('src') ?? ''} ${element.getAttribute('style') ?? ''}`.includes('sift-reference-atlas')).length,
      forbiddenLabels: forbiddenLabels.filter((label) => bodyText.includes(label)),
      layerBackground: layerStyle?.backgroundImage ?? '',
    };
  });

  if (!baseline.title.includes('Sift')) fail('Wrong page loaded', baseline);
  if (baseline.overlay) fail('Framework error overlay is visible', baseline);
  if (baseline.markers < 25) fail('Repo building markers did not render', baseline);
  if (baseline.districts < 2) fail('District labels did not render', baseline);
  if (baseline.terrains < baseline.districts) fail('Code-native terrain regions did not render for district labels', baseline);
  if (baseline.terrainSprites < baseline.districts) fail('Generated terrain sprite layers did not render for district labels', baseline);
  if (baseline.connectors < 1) fail('Backend-derived atlas connectors did not render', baseline);
  if (baseline.pathBeds < baseline.connectors) fail('Connector terrain beds did not render under backend-derived connectors', baseline);
  if (baseline.atlasImages !== 0) fail('Atlas still contains bitmap img elements', baseline);
  if (baseline.spriteBackgrounds < 1) fail('Generated biome sprite backgrounds did not attach to repo buildings', baseline);
  if (baseline.screenshotReferences !== 0) fail('Atlas still references the old screenshot asset', baseline);
  if (baseline.forbiddenLabels.length) fail('Old Claude screenshot labels are still visible', baseline);
  if (!baseline.layerBackground.includes('radial-gradient')) fail('Atlas infinite backdrop blend is missing', baseline);

  const beforePan = await readPan();
  await page.mouse.move(640, 350);
  await page.mouse.down();
  await page.mouse.move(700, 380, { steps: 5 });
  await page.mouse.move(790, 420, { steps: 5 });
  await page.mouse.move(880, 470, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  const afterPan = await readPan();

  if (beforePan.x === afterPan.x && beforePan.y === afterPan.y) {
    fail('Atlas did not pan after drag', { beforePan, afterPan });
  }

  const clickableMarker = await page.evaluate(() => {
    for (const element of Array.from(document.querySelectorAll('.atlas-repo-marker'))) {
      const rect = element.getBoundingClientRect();
      const x = Math.round(rect.left + rect.width / 2);
      const y = Math.round(rect.top + rect.height / 2);
      const safeViewport =
        rect.width > 0 &&
        rect.height > 0 &&
        x > 230 &&
        y > 40 &&
        x < window.innerWidth - 410 &&
        y < window.innerHeight - 120;

      if (!safeViewport) continue;

      const hit = document.elementFromPoint(x, y);
      if (hit === element || element.contains(hit)) {
        return { x, y, title: element.getAttribute('title') };
      }
    }

    return null;
  });

  if (!clickableMarker) fail('No user-clickable repo marker found after panning', { beforePan, afterPan });

  await page.mouse.click(clickableMarker.x, clickableMarker.y);
  await page.waitForSelector('.repo-panel.is-open h2', { state: 'visible', timeout: 8_000 });
  const panelTitle = await page.locator('.repo-panel.is-open h2').innerText();

  if (!panelTitle.trim()) fail('Repo marker click did not open a named repo panel', { clickableMarker });

  const relevantMessages = consoleMessages.filter((message) => (
    !message.includes('[webpack.cache.PackFileCacheStrategy]') &&
    !message.includes('Download the React DevTools')
  ));

  if (relevantMessages.length) fail('Console warnings/errors found during atlas smoke test', { relevantMessages, badResponses, failedRequests });

  console.log(JSON.stringify({
    ok: true,
    url: targetUrl,
    markers: baseline.markers,
    districts: baseline.districts,
    beforePan,
    afterPan,
    clicked: clickableMarker.title,
    panelTitle,
  }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
