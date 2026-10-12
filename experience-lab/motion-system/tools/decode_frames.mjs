// Decode an encoded clip the way a viewer's browser does, frame by frame.
//
// Serves the clip from a throwaway local server (same origin, so the canvas is
// readable), loads it from a blob URL (seeking needs no HTTP Range support),
// then for every frame i seeks to (i + 0.5) / fps and saves what the browser
// presents. Also probes real playback and seeking, and decodes the audio track
// to mono float32 PCM. Every wait has a timeout: a file that stalls the media
// pipeline must fail loudly, not hang.
//
// usage: node decode_frames.mjs <clip> <out_dir> <frame_count> [fps] [chromium|firefox]
// writes <out_dir>/f000.png..., <out_dir>/audio.f32 (if the clip has audio), <out_dir>/probe.json
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pw = await import(path.join(here, '../../study-b-webgl/node_modules/playwright/index.mjs'));
const [clip, outDir, nStr, fpsStr, engine = 'chromium'] = process.argv.slice(2);
if (!clip || !outDir || !nStr) { console.error('usage: decode_frames.mjs <clip> <out_dir> <frames> [fps] [engine]'); process.exit(2); }
const N = Number(nStr), FPS = Number(fpsStr || 24);
fs.mkdirSync(outDir, { recursive: true });

const type = clip.endsWith('.mp4') ? 'video/mp4' : 'video/webm';
const page_html = '<!doctype html><meta charset="utf-8"><video id="v" muted playsinline></video><canvas id="c"></canvas>';
const server = http.createServer((req, res) => {
  if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(page_html); }
  if (req.url === '/clip') { res.writeHead(200, { 'content-type': type }); return fs.createReadStream(clip).pipe(res); }
  res.writeHead(404); res.end();
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const launch = engine === 'firefox'
  ? pw.firefox.launch({ firefoxUserPrefs: { 'media.autoplay.default': 0 } })
  : pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const br = await launch;
const page = await (await br.newContext()).newPage();
await page.goto(`${base}/`);

const meta = await page.evaluate(async () => {
  const v = document.getElementById('v');
  const blob = await (await fetch('/clip')).blob();
  v.src = URL.createObjectURL(blob);
  const ok = await new Promise(res => {
    const t = setTimeout(() => res(false), 15000);
    v.addEventListener('loadeddata', () => { clearTimeout(t); res(true); }, { once: true });
  });
  return { ok, duration: v.duration, w: v.videoWidth, h: v.videoHeight, err: v.error && v.error.message };
});
if (!meta.ok) { console.error(`  FAIL: clip never reached loadeddata (${meta.err || 'no error reported'})`); await br.close(); server.close(); process.exit(1); }

let timeouts = 0;
for (let i = 0; i < N; i++) {
  const r = await page.evaluate(async ({ t }) => {
    const v = document.getElementById('v'), c = document.getElementById('c');
    c.width = v.videoWidth; c.height = v.videoHeight;
    const done = await new Promise(res => {
      const to = setTimeout(() => res(false), 8000);
      v.addEventListener('seeked', () => { clearTimeout(to); res(true); }, { once: true });
      v.currentTime = t;
    });
    await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    return { done, b64: c.toDataURL('image/png').split(',')[1] };
  }, { t: (i + 0.5) / FPS });
  if (!r.done) timeouts++;
  fs.writeFileSync(path.join(outDir, `f${String(i).padStart(3, '0')}.png`), Buffer.from(r.b64, 'base64'));
}

// real playback from the start, and audio decoded by the engine's own decoder
const probe = await page.evaluate(async () => {
  const v = document.getElementById('v');
  await new Promise(res => { const to = setTimeout(res, 8000); v.addEventListener('seeked', () => { clearTimeout(to); res(); }, { once: true }); v.currentTime = 0; });
  const t0 = performance.now(); let playErr = null;
  try { await Promise.race([v.play(), new Promise((_, rej) => setTimeout(() => rej(new Error('play() never resolved')), 8000))]); }
  catch (e) { playErr = String(e); }
  await new Promise(res => setTimeout(res, 1500));
  const played = v.currentTime, wall = (performance.now() - t0) / 1000; v.pause();
  let audio = null;
  try {
    const buf = await (await fetch('/clip')).arrayBuffer();
    const ab = await new OfflineAudioContext(1, 48000, 48000).decodeAudioData(buf);
    const mono = new Float32Array(ab.length);
    for (let ch = 0; ch < ab.numberOfChannels; ch++) { const d = ab.getChannelData(ch); for (let i = 0; i < d.length; i++) mono[i] += d[i] / ab.numberOfChannels; }
    let s = ''; const u = new Uint8Array(mono.buffer);
    for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
    audio = { rate: ab.sampleRate, b64: btoa(s) };
  } catch (e) { audio = null; }
  return { playErr, played, wall, audio };
});
if (probe.audio) fs.writeFileSync(path.join(outDir, 'audio.f32'), Buffer.from(probe.audio.b64, 'base64'));
const report = { engine, clip: path.basename(clip), duration: meta.duration, size: [meta.w, meta.h], frames: N,
                 seek_timeouts: timeouts, play_error: probe.playErr,
                 played_s: +probe.played.toFixed(2), wall_s: +probe.wall.toFixed(2),
                 audio_rate: probe.audio ? probe.audio.rate : null };
fs.writeFileSync(path.join(outDir, 'probe.json'), JSON.stringify(report, null, 1));
console.log(`  ${engine}: ${report.clip} ${meta.w}x${meta.h} ${meta.duration.toFixed(3)} s, ${N} frames decoded, seek timeouts ${timeouts}, ` +
            `playback ${report.played_s}s in ${report.wall_s}s${probe.playErr ? ' PLAY ERROR ' + probe.playErr : ''}, audio ${report.audio_rate ? 'decoded' : 'none'}`);
await br.close(); server.close();
