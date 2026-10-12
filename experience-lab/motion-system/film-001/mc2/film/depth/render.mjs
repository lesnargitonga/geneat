// Renders the depth scene with sub-frame accumulation: each output frame is the
// average of several camera samples along the motion (see accumulate.py).
// usage: node render.mjs <out_dir> <duration_s> <samples>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const pw = await import('/home/lesnar/Documents/ai model/experience-lab/study-b-webgl/node_modules/playwright/index.mjs');
const [outDir, durS, subS] = process.argv.slice(2);
const SUB = Number(subS || 1);
fs.mkdirSync(outDir, { recursive: true });
const server = http.createServer((q, r) => { const f = path.join(here, decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(here) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : 'image/png' }); fs.createReadStream(f).pipe(r); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const br = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await br.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 140)));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); });
await page.goto(`http://127.0.0.1:${server.address().port}/scene.html?dur=${durS}`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
const NF = await page.evaluate(() => window.NF);
console.log(`  rendering ${NF} frames x ${SUB} sub-samples`);
for (let n = 0; n < NF; n++) {
  const shots = [];
  for (let s = 0; s < SUB; s++) {
    const off = SUB > 1 ? (s / (SUB - 1) - 0.5) * 0.5 : 0;      // samples across the frame interval (shutter ~180deg)
    shots.push(await page.evaluate(([n, off]) => { window.renderFrame(n + off); return document.querySelector('canvas').toDataURL('image/png').split(',')[1]; }, [n, off]));
  }
  fs.writeFileSync(`${outDir}/r${String(n).padStart(3, '0')}.json`, JSON.stringify(shots));
}
console.log(`  page errors: ${errs.length ? errs.slice(0, 3).join(' | ') : 'none'}`);
await br.close(); server.close();
