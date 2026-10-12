// Sample N evenly spaced frames from a source recording, as PNGs.
//
// Frame i is the picture the browser presents at T0 + (T1 - T0) * i / (N - 1),
// seeked from a blob URL on a throwaway same-origin server. VP9 decoding is
// deterministic, so the same arguments always reproduce the same frames: this
// is how cuts of real product and operator recordings are taken.
//
// usage: node sample_frames.mjs <clip> <out_dir> <t0_s> <t1_s> <n> [prefix=o]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pw = await import(path.join(here, '../../study-b-webgl/node_modules/playwright/index.mjs'));
const [clip, outDir, t0s, t1s, nStr, prefix = 'o'] = process.argv.slice(2);
if (!clip || !outDir || !nStr) { console.error('usage: sample_frames.mjs <clip> <out_dir> <t0> <t1> <n> [prefix]'); process.exit(2); }
const T0 = Number(t0s), T1 = Number(t1s), N = Number(nStr);
fs.mkdirSync(outDir, { recursive: true });

const type = clip.endsWith('.mp4') ? 'video/mp4' : 'video/webm';
const server = http.createServer((req, res) => {
  if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<!doctype html><video id="v" muted></video><canvas id="c"></canvas>'); }
  if (req.url === '/clip') { res.writeHead(200, { 'content-type': type }); return fs.createReadStream(clip).pipe(res); }
  res.writeHead(404); res.end();
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const br = await pw.chromium.launch();
const page = await (await br.newContext()).newPage();
await page.goto(`http://127.0.0.1:${server.address().port}/`);
const ok = await page.evaluate(async () => {
  const v = document.getElementById('v');
  v.src = URL.createObjectURL(await (await fetch('/clip')).blob());
  return new Promise(res => { const t = setTimeout(() => res(false), 15000); v.addEventListener('loadeddata', () => { clearTimeout(t); res(true); }, { once: true }); });
});
if (!ok) { console.error('  FAIL: source never loaded'); process.exit(1); }
for (let i = 0; i < N; i++) {
  const t = N > 1 ? T0 + (T1 - T0) * (i / (N - 1)) : T0;
  const r = await page.evaluate(async t => {
    const v = document.getElementById('v'), c = document.getElementById('c');
    c.width = v.videoWidth; c.height = v.videoHeight;
    const done = await new Promise(res => { const to = setTimeout(() => res(false), 8000); v.addEventListener('seeked', () => { clearTimeout(to); res(true); }, { once: true }); v.currentTime = t; });
    await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    return { done, b64: c.toDataURL('image/png').split(',')[1] };
  }, t);
  if (!r.done) { console.error(`  FAIL: seek to ${t.toFixed(3)} s timed out`); process.exit(1); }
  fs.writeFileSync(path.join(outDir, `${prefix}${String(i).padStart(3, '0')}.png`), Buffer.from(r.b64, 'base64'));
}
console.log(`  sampled ${N} frames, t=${T0}s..${T1}s -> ${outDir}`);
await br.close(); server.close();
