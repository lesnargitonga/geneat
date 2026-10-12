// Render a deterministic HTML scene frame by frame: window.renderFrame(n), screenshot #stage.
// usage: node render_page.mjs <dir containing page> <page.html> <out_dir>
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const pw = await import('/home/lesnar/Documents/ai model/experience-lab/study-b-webgl/node_modules/playwright/index.mjs');
const [dir, pageName, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const T = { '.html': 'text/html', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((q, r) => { const f = path.join(dir, decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(dir) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const br = await pw.chromium.launch();
const page = await (await br.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://127.0.0.1:${server.address().port}/${pageName}`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
await page.evaluate(() => document.fonts.ready);
const NF = await page.evaluate(() => window.NF);
const stage = page.locator('#stage');
for (let n = 0; n < NF; n++) {
  await page.evaluate(n => window.renderFrame(n), n);
  await page.waitForTimeout(8);
  await stage.screenshot({ path: `${outDir}/f${String(n).padStart(3, '0')}.png` });
}
console.log(`  ${pageName}: ${NF} frames; page errors: ${errs.length ? errs.slice(0, 3).join(' | ') : 'none'}`);
await br.close(); server.close();
