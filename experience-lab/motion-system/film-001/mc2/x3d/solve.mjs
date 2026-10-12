// Fit the aircraft's pose at frame 0321 to the real frame's matte, from the real camera.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)); const REPO = '/home/lesnar/Documents/ai model';
const pw = await import(path.join(REPO, 'experience-lab/study-b-webgl/node_modules/playwright/index.mjs'));
const ROOTS = { '/three/': path.join(REPO, 'experience-lab/study-b-webgl/node_modules/three/'), '/px4/': '/home/lesnar/PX4-Autopilot/Tools/simulation/gz/models/x500_base/', '/': here + '/' };
const server = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const root = Object.keys(ROOTS).find(k => u.startsWith(k));
  const f = path.join(ROOTS[root], u.slice(root.length)); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const br = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await br.newContext({ viewport: { width: 960, height: 540 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.goto(`http://127.0.0.1:${server.address().port}/scene.html?w=${process.argv[3] || 960}&h=${process.argv[4] || 540}`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 300000 });
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const t = Date.now();
const r = await page.evaluate(([s, fn]) => window[fn](s), [spec, process.env.FN || "solvePose"]);
console.log(JSON.stringify({ ...r, seconds: (Date.now() - t) / 1000, errors: errs }));
await br.close(); server.close();
