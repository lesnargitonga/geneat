import * as pw from '/home/lesnar/Documents/ai model/experience-lab/study-b-webgl/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const RP = process.env.RP, S = `${RP}/out/stills`, V = `${RP}/out/video`;
const PY = process.env.HOME + '/workspace/LesnarAI/.venv/bin/python';
const shot = (p, n) => p.screenshot({ path: `${S}/${n}.png` });
const status = () => { try { return JSON.parse(fs.readFileSync(`${RP}/replay_status.json`,'utf8')); } catch { return null; } };

async function waitMission(page, t, label) {
  for (let i = 0; i < 600; i++) {
    const s = status();
    if (s && s.mission_elapsed_s >= t) {
      console.log(`  [${label}] t=${s.mission_elapsed_s}s alt=${s.altitude?.toFixed(2)}m spd=${s.speed} hdg=${s.heading} batt=${s.battery}`);
      return s;
    }
    await page.waitForTimeout(400);
  }
  return null;
}

const br = await pw.chromium.launch();

/* ---- Pass 1: sealed telemetry through the dashboard, live-flight states ---- */
const ctx1 = await br.newContext({
  viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2,
  recordVideo: { dir: V, size: { width: 1920, height: 1080 } },
});
const page = await ctx1.newPage();
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
await shot(page, '01-dashboard-establishing');
console.log('  dashboard assets:', (await page.locator('body').innerText()).includes('x500_0') ? 'x500_0 listed' : 'not listed yet');

await page.getByText('TACTICAL MAP', { exact: false }).first().click();
await page.waitForTimeout(4000);

// start the sealed replay only once the operator surface is up
const pub = spawn(PY, [`${RP}/replay_publish.py`, '--port', '6399'],
  { stdio: ['ignore', fs.openSync(`${RP}/replay.log`, 'w'), 'inherit'], env: { ...process.env, VIRTUAL_ENV: undefined } });
console.log('  sealed replay started, pid', pub.pid);

for (let i = 0; i < 60; i++) {
  if (await page.locator('.leaflet-marker-icon').count() > 0) break;
  await page.waitForTimeout(1000);
}
console.log('  markers on map:', await page.locator('.leaflet-marker-icon').count());
await page.waitForTimeout(3000);
await shot(page, '02-map-tiles-osm');

await waitMission(page, 30, 'early-flight');
await page.waitForTimeout(500);
await shot(page, '03-early-flight');

await waitMission(page, 62, 'mid-cruise');
await page.locator('.leaflet-marker-icon').first().click({ timeout: 5000 }).catch(() => {});
await page.waitForTimeout(1500);
await shot(page, '04-mid-cruise-readout');

await waitMission(page, 90, 'cruise-late');
await shot(page, '05-cruise-late');

await waitMission(page, 120, 'landing');
await page.waitForTimeout(500);
await shot(page, '06-landing');

await waitMission(page, 125.5, 'end');
await page.waitForTimeout(2500);
await ctx1.close();
const liveVideo = fs.readdirSync(V).filter(f => f.endsWith('.webm')).pop();
console.log('  pass-1 video:', liveVideo);
try { pub.kill('SIGTERM'); } catch {}

/* ---- Pass 2: after-action replay of the sealed history ---- */
await new Promise(r => setTimeout(r, 8000));   // let the live link lapse
const ctx2 = await br.newContext({
  viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2,
  recordVideo: { dir: V, size: { width: 1920, height: 1080 } },
});
const p2 = await ctx2.newPage();
await p2.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
await p2.waitForTimeout(5000);
await p2.getByText('TACTICAL MAP', { exact: false }).first().click();
await p2.waitForTimeout(4000);

// select the asset: marker click if present, else the product's quick-select hotkey
if (await p2.locator('.leaflet-marker-icon').count() > 0) {
  await p2.locator('.leaflet-marker-icon').first().click().catch(() => {});
} else {
  await p2.keyboard.press('1');
}
await p2.waitForTimeout(1500);
await p2.locator('[title="Replay telemetry history"]').click();
await p2.waitForTimeout(4000);

const slider = p2.locator('input[type="range"]');
const hasReplay = await slider.count() > 0;
console.log('  replay panel active:', hasReplay);
if (hasReplay) {
  const max = Number(await slider.getAttribute('max'));
  console.log('  history samples loaded:', max + 1);
  await slider.fill('0'); await p2.waitForTimeout(1200);
  await shot(p2, '07-replay-start');
  await slider.fill(String(Math.round(max * 0.5))); await p2.waitForTimeout(1200);
  await shot(p2, '08-replay-mid');
  await slider.fill(String(max)); await p2.waitForTimeout(1200);
  await shot(p2, '09-replay-end-path');
  // scrub the whole history for the movement recording
  for (let i = 0; i <= max; i += Math.max(1, Math.round(max / 90))) {
    await slider.fill(String(i));
    await p2.waitForTimeout(90);
  }
  await p2.waitForTimeout(1500);
  await shot(p2, '10-replay-full-path');
  console.log('  scrubber timestamp at end:', (await p2.locator('input[type="range"]').locator('xpath=following-sibling::span[1]').innerText().catch(() => '—')));
}
await ctx2.close();
const vids = fs.readdirSync(V).filter(f => f.endsWith('.webm'));
console.log('  videos:', vids.join(', '));
await br.close();
