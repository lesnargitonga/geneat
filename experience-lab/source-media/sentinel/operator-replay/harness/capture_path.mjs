import * as pw from '/home/lesnar/Documents/ai model/experience-lab/study-b-webgl/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const RP = process.env.RP, S = `${RP}/out/stills`, V = `${RP}/out/video3`;
fs.mkdirSync(V, { recursive: true });
const PY = process.env.HOME + '/workspace/LesnarAI/.venv/bin/python';
fs.rmSync(`${RP}/replay_status.json`, { force: true });
const status = () => { try { return JSON.parse(fs.readFileSync(`${RP}/replay_status.json`,'utf8')); } catch { return null; } };
const pathBox = (p) => p.evaluate(() => { const el=document.querySelector('path.leaflet-interactive');
  if(!el) return null; const b=el.getBoundingClientRect(); return {w:Math.round(b.width),h:Math.round(b.height)}; });

const br = await pw.chromium.launch();
const ctx = await br.newContext({ viewport:{width:1920,height:1080}, deviceScaleFactor:2,
  recordVideo:{ dir:V, size:{width:1920,height:1080} } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:3000/', { waitUntil:'domcontentloaded' });
await page.waitForTimeout(3500);
await page.getByText('TACTICAL MAP',{exact:false}).first().click();
await page.waitForTimeout(3000);

// briefly stream the sealed run so autoFollow centres the map on the real coordinates
const pub = spawn(PY, [`${RP}/replay_publish.py`,'--port','6399'],
  { stdio:['ignore', fs.openSync(`${RP}/replay.log`,'w'),'inherit'], env:{...process.env, VIRTUAL_ENV:undefined} });
for (let i=0;i<70;i++){ if(await page.locator('.leaflet-marker-icon').count()>0) break; await page.waitForTimeout(700); }
await page.waitForTimeout(6000);
console.log('  centred; tiles:', await page.locator('.leaflet-tile-loaded').count(), ' status:', JSON.stringify(status()));
await page.keyboard.press('1');
await page.waitForTimeout(1000);

// stop the stream: with no live fix, flyTo stops firing and the view holds still
try { pub.kill('SIGTERM'); } catch {}
await page.waitForTimeout(9000);

await page.locator('[title="Replay telemetry history"]').click();
await page.waitForTimeout(4500);
const slider = page.locator('input[type="range"]');
const max = Number(await slider.getAttribute('max'));
console.log('  replay active, history samples:', max+1);
await slider.fill(String(max)); await page.waitForTimeout(1200);

const bb = await page.locator('.leaflet-container').boundingBox();
const cx = bb.x+bb.width/2, cy = bb.y+bb.height/2;
for (let i=0;i<9;i++){
  const b = await pathBox(page);
  if (b && b.w > 520) break;
  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, -400);
  await page.waitForTimeout(1500);
}
console.log('  sealed path rendered size:', JSON.stringify(await pathBox(page)), 'px  tiles:', await page.locator('.leaflet-tile-loaded').count());

await slider.fill('0'); await page.waitForTimeout(1500);
await page.screenshot({ path:`${S}/16-path-replay-start.png` });
await slider.fill(String(Math.round(max*0.5))); await page.waitForTimeout(1500);
await page.screenshot({ path:`${S}/17-path-replay-mid.png` });
await slider.fill(String(max)); await page.waitForTimeout(1500);
await page.screenshot({ path:`${S}/18-path-replay-full.png` });
for (let i=0;i<=max;i+=Math.max(1,Math.round(max/120))) { await slider.fill(String(i)); await page.waitForTimeout(85); }
await page.waitForTimeout(1500);
console.log('  scrubber sealed timestamp:', await page.locator('input[type="range"] ~ span').last().innerText().catch(()=>'—'));
await ctx.close();
console.log('  videos:', fs.readdirSync(V).join(', '));
await br.close();
