import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.SIFT_BASE_URL || 'http://127.0.0.1:3000';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.__siftFlowProbe === 'function', null, { timeout: 45_000 });

  const opening = await page.evaluate(() => window.__siftFlowProbe());
  assert.equal(opening.introVisible, true, 'GitHub SIFT intro should be visible while the scene opens');
  await page.waitForFunction(() => {
    const flow = window.__siftFlowProbe?.();
    return flow && flow.introProgress >= 0.57 && flow.introProgress <= 0.72;
  }, null, { timeout: 10_000 });
  await page.screenshot({ path: '/tmp/sift-github-intro.png' });

  await page.waitForTimeout(2200);

  const flowing = await page.evaluate(() => window.__siftFlowProbe());
  assert.ok(flowing.roads > 0, 'expected synthetic PR roads');
  assert.ok(flowing.packets > 0, 'expected moving PR packets');
  assert.ok(flowing.crossClusterRoads > 0, 'expected cross-cluster PR roads');
  assert.equal(flowing.gradients, flowing.roads, 'every PR road should use a repository-color gradient');

  await page.waitForTimeout(3600);
  const settled = await page.evaluate(() => ({
    flow: window.__siftFlowProbe(),
    camera: window.__siftCameraProbe(),
  }));
  await page.screenshot({ path: '/tmp/sift-github-settled.png' });

  assert.equal(settled.flow.introVisible, false, 'intro should clear after the final camera settle');
  assert.equal(settled.flow.introProgress, 1);
  assert.ok(settled.camera.camera.z > 760 && settled.camera.camera.z < 1080, 'camera should settle into the repository viewing angle');
  assert.ok(settled.camera.camera.x > 120, 'final angle should favor the strongly lit side of the map');

  console.log(JSON.stringify({ ok: true, opening, flowing, settled }, null, 2));
} finally {
  await browser.close();
}
