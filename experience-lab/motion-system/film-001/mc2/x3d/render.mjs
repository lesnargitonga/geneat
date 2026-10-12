// Render shots of the reconstruction offline.
// usage: node render.mjs <jobs.json> <out_dir> [query-string for scene.html]
// jobs.json: [{ "name": "f000", "states": [ { "camera": {...}, "aircraft": {...} }, ... ] }, ...]
// Each job's states are rendered and averaged in linear light into <out_dir>/<name>.png.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = '/home/lesnar/Documents/ai model';
const pw = await import(path.join(REPO, 'experience-lab/study-b-webgl/node_modules/playwright/index.mjs'));
const ROOTS = {
  '/three/': path.join(REPO, 'experience-lab/study-b-webgl/node_modules/three/'),
  '/px4/': process.env.X500_BASE || '/home/lesnar/PX4-Autopilot/Tools/simulation/gz/models/x500_base/',
  '/': here + '/',
};
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.dae': 'model/vnd.collada+xml', '.stl': 'model/stl' };
const [jobsPath, outDir, query = ''] = process.argv.slice(2);
const jobs = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const root = Object.keys(ROOTS).find(r => url.startsWith(r));
  const file = path.join(ROOTS[root], url.slice(root.length));
  if (!file.startsWith(ROOTS[root]) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const br = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await br.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${server.address().port}/scene.html?${query}`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 600000 }).catch(e => { console.error('  scene never became ready:', errs.join(' | ')); process.exit(1); });
console.log(`  scene ready in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
for (const job of jobs) {
  const t = Date.now();
  const b64 = await page.evaluate(states => window.renderStates(states), job.states);
  fs.writeFileSync(path.join(outDir, `${job.name}.png`), Buffer.from(b64, 'base64'));
  if (process.env.VERBOSE) console.log(`  ${job.name}: ${job.states.length} samples, ${((Date.now() - t) / 1000).toFixed(2)} s`);
}
console.log(`  rendered ${jobs.length} images in ${((Date.now() - t0) / 1000).toFixed(1)} s; page errors: ${errs.length ? errs.slice(0, 3).join(' | ') : 'none'}`);
await br.close(); server.close();
