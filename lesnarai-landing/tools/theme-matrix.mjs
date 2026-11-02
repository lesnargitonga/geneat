/* ═══ THEME MATRIX ═════════════════════════════════════════════════════════
   Measures what each engine actually paints, not what CSS computes: every cell
   is sampled from a screenshot and compared with its expected sRGB value.

     python3 -m http.server 8911 --bind 127.0.0.1     # serve first, from this dir
     node tools/theme-matrix.mjs                      # full matrix
     PORT=8912 ENGINES=chromium,chromium-fd node tools/theme-matrix.mjs
   Inside the VS Code snap, strip its GIO_/GTK_/GDK_ and LOCPATH variables first
   (env -u ...): they make WPE WebKit's network process load snap libraries and die.

   Configurations: site theme {system, light, dark} x device scheme {light, dark}
   x engine {chromium, firefox, webkit, chromium-fd}. chromium-fd is desktop
   Chromium launched with --blink-settings=forceDarkModeEnabled=true: Blink's own
   forced darkening, the engine feature behind Chrome Android's "darken websites".
   It is NOT Chrome Android and NOT Samsung Internet. Each chromium-fd run first
   proves darkening is live by painting a page that declares no color-scheme.

   Pages: the probe (/lab/theme-probe/, cells from tools/theme-matrix/cells.json)
   and Home, /work/medimatch/, /start/ at 390 px.
   Writes docs/lesnarai/forced-dark-matrix.json, the generated table inside
   docs/lesnarai/FORCED_DARK_MATRIX.md, and tools/theme-matrix/probe-layout.json
   (the geometry analyse_screenshot.py uses on phone screenshots).
   Exits non-zero if any judged cell fails in a configuration expected to pass. */
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import * as pw from '/home/lesnar/Documents/ai model/experience-lab/study-b-webgl/node_modules/playwright/index.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DOCS = path.resolve(ROOT, '../docs/lesnarai');
const BASE = 'http://127.0.0.1:' + (process.env.PORT || 8911);
const SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/theme-matrix/cells.json'), 'utf8'));
const TOL = SPEC.tolerance;
const ENGINES = (process.env.ENGINES || 'chromium,firefox,webkit,chromium-fd').split(',');
const THEMES = ['system', 'light', 'dark'];
const SCHEMES = ['light', 'dark'];
const FD_ARGS = ['--blink-settings=forceDarkModeEnabled=true'];
/* Phone density by default. It matters: Blink's forced darkening leaves raster images
   alone at DPR 1 but inverts them at DPR 2 and above (measured 2026-11-01), so a
   desktop-density run under-reports what a phone shows. */
const DPR = Number(process.env.DPR || 2.625);
const CELL = Object.fromEntries(SPEC.grids.flatMap(g => g.cells).map(c => [c.id, c]));
const GROUPS = {
  Surfaces: ['paper', 'sheet', 'film'], Text: ['ink', 'ink-2', 'ink-3', 'signal', 'link', 'caption'],
  'Icons and SVG': ['stage', 'svg-land', 'svg-ink'], Media: ['photo-light', 'photo-dark', 'raster-white', 'raster-black'],
  Forms: ['input', 'button', 'button-off'], 'Overlay and focus': ['scrim', 'focus'],
  Candidates: ['cand-raster', 'cand-gradient', 'cand-text'], Native: ['native-select', 'native-check'],
};

/* ── PNG decoding: 8-bit RGB/RGBA, non-interlaced (what the engines write) ── */
function decodePNG(buf) {
  let off = 8, w, h, bpp; const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      if (data[8] !== 8 || ![2, 6].includes(data[9]) || data[12]) throw new Error('unsupported PNG layout');
      bpp = data[9] === 6 ? 4 : 3;
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(h * stride);
  for (let y = 0, p = 0; y < h; y++) {
    const f = raw[p++];
    for (let x = 0; x < stride; x++, p++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0, b = y ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
      let v = raw[p];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[y * stride + x] = v & 255;
    }
  }
  return { w, h, at: (x, y) => { const i = y * stride + x * bpp; return [out[i], out[i + 1], out[i + 2]]; } };
}

/* ── sampling ─────────────────────────────────────────────────────────────── */
const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const median = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
function pixels(img, r) {
  /* keep off the edges: one CSS px in device px, since engines round fractional clips
     outward differently (Firefox picked up a sliver of the page around a swatch) */
  const e = Math.ceil(DPR), inset = r.w > 4 * e && r.h > 4 * e ? e : r.w > 6 && r.h > 6 ? 1 : 0, out = [];
  for (let y = Math.ceil(r.y) + inset; y < Math.floor(r.y + r.h) - inset; y++)
    for (let x = Math.ceil(r.x) + inset; x < Math.floor(r.x + r.w) - inset; x++)
      if (x >= 0 && y >= 0 && x < img.w && y < img.h) out.push(img.at(x, y));
  return out;
}
function sample(img, r, method) {
  const px = pixels(img, r);
  if (!px.length) return null;
  if (method === 'mean') return [0, 1, 2].map(i => px.reduce((s, p) => s + p[i], 0) / px.length);
  const bg = [0, 1, 2].map(i => median(px.map(p => p[i])));
  if (method !== 'ink') return bg;
  /* the glyph colour: the pixels farthest from the background, then their median */
  const d = p => Math.abs(p[0] - bg[0]) + Math.abs(p[1] - bg[1]) + Math.abs(p[2] - bg[2]);
  const far = px.reduce((m, p) => Math.max(m, d(p)), 0); // no spread: large h1 regions overflow the stack
  if (far < 24) return bg; // no glyph distinguishable from the background: report what is there
  const core = px.filter(p => d(p) >= far * 0.92);
  return [0, 1, 2].map(i => median(core.map(p => p[i])));
}
const delta = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));

/* ── page regions ─────────────────────────────────────────────────────────── */
const PROBE_REGIONS = () => [...document.querySelectorAll('[data-cell]')].map(el => {
  const s = el.querySelector('[data-sample]') || el, r = s.getBoundingClientRect();
  return { id: el.dataset.cell, method: el.dataset.method, light: el.dataset.light, dark: el.dataset.dark,
           x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height };
});
/* Real pages: blank paper in the gutter, the h1's glyphs, and the page's own
   surfaces where present. The Start button is enabled by script, so its state is read. */
const PAGE_REGIONS = () => {
  const out = [], box = (el, f) => { if (!el) return; const r = el.getBoundingClientRect(); out.push(f(r.x + scrollX, r.y + scrollY, r.width, r.height)); };
  const h1 = document.querySelector('main h1');
  /* the page gutter (18 px at 390) beside the h1: never covered by content */
  box(h1, (x, y, w, h) => ({ id: 'paper', method: 'fill', x: 2, y: y + h / 2 - 10, w: 12, h: 20 }));
  box(h1, (x, y, w, h) => ({ id: 'ink', method: 'ink', x, y, w, h }));
  box(document.querySelector('.sheet'), (x, y) => ({ id: 'sheet', method: 'fill', x: x + 3, y: y + 3, w: 10, h: 10 }));
  box(document.querySelector('.strip'), (x, y) => ({ id: 'film', method: 'fill', x: x + 4, y: y + 19, w: 10, h: 5 }));
  box(document.querySelector('.fld input'), (x, y, w, h) => ({ id: 'input', method: 'fill', x: x + w - 30, y: y + h / 2 - 4, w: 20, h: 8 }));
  const btn = document.querySelector('.form__act button');
  box(btn, (x, y) => ({ id: btn.disabled ? 'button-off' : 'button', method: 'fill', x: x + 3, y: y + 3, w: 6, h: 6 }));
  return out;
};

/* ── one configuration ────────────────────────────────────────────────────── */
async function control(browser, scheme) {
  /* proof that forced darkening is live: a white page with no color-scheme */
  const ctx = await browser.newContext({ viewport: { width: 200, height: 120 }, colorScheme: scheme });
  const p = await ctx.newPage();
  await p.setContent('<!doctype html><body style="margin:0;background:#fff"><div style="height:120px"></div>');
  const img = decodePNG(await p.screenshot());
  await ctx.close();
  return hex(img.at(100, 60));
}

async function measure(browser, scheme, theme, route, width, regionsFn) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: DPR, colorScheme: scheme, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.addInitScript(t => { try { t === 'system' ? localStorage.removeItem('lesnarai-theme') : localStorage.setItem('lesnarai-theme', t); } catch (e) {} }, theme);
  await p.goto(BASE + route, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(150);
  const regions = await p.evaluate(regionsFn);
  const want = theme === 'system' ? scheme : theme;
  const out = [];
  for (const r of regions) {
    /* each region is scrolled into view and captured on its own, in device pixels.
       (Full-page clips came back a few pixels off at fractional densities.) */
    const top = await p.evaluate(y => { scrollTo(0, Math.max(0, y - 200)); return scrollY; }, r.y);
    await p.waitForTimeout(30);
    const img = decodePNG(await p.screenshot({ clip: { x: r.x, y: r.y - top, width: r.w, height: r.h } }));
    const got = sample(img, { x: 0, y: 0, w: img.w, h: img.h }, r.method);
    const spec = { ...CELL[r.id], ...(r[want] ? { [want]: r[want] } : {}) };
    const expect = r.method === 'observe' ? null : spec[want];
    const d = got && expect ? delta(got, rgb(expect)) : null;
    out.push({ id: r.id, method: r.method, got: got && hex(got), expect, delta: d,
               pass: r.method === 'observe' ? null : d !== null && d <= TOL[r.method] });
  }
  await ctx.close();
  return out;
}

/* geometry for analyse_screenshot.py, measured in Chromium at 360 px */
async function layout(browser) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, colorScheme: 'light' });
  const p = await ctx.newPage();
  await p.goto(BASE + '/lab/theme-probe/', { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  const grids = await p.evaluate(() => [...document.querySelectorAll('[data-grid]')].map(g => {
    const c = el => { const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; };
    const [tl, br] = [g.querySelector('.fid--tl'), g.querySelector('.fid--br')].map(c);
    const fid = g.dataset.fid.split(',');
    const cells = [...g.querySelectorAll('[data-cell]')].map(el => {
      const s = el.querySelector('[data-sample]') || el, r = s.getBoundingClientRect();
      return { id: el.dataset.cell, method: el.dataset.method, light: el.dataset.light || null, dark: el.dataset.dark || null,
               x: r.x + r.width / 2 - tl[0], y: r.y + r.height / 2 - tl[1], w: r.width, h: r.height };
    });
    return { id: g.dataset.grid, fid_tl: fid[0], fid_br: fid[1], span: [br[0] - tl[0], br[1] - tl[1]], fid_size: 20, cells };
  }));
  await ctx.close();
  fs.writeFileSync(path.join(ROOT, 'tools/theme-matrix/probe-layout.json'),
    JSON.stringify({ about: 'Written by tools/theme-matrix.mjs. CSS px relative to each grid\'s top-left fiducial centre; span is the vector to the bottom-right fiducial centre.', tolerance: TOL, grids }, null, 1) + '\n');
}

/* ── run ──────────────────────────────────────────────────────────────────── */
const PAGES = [['/lab/theme-probe/', 360, PROBE_REGIONS], ['/', 390, PAGE_REGIONS], ['/work/medimatch/', 390, PAGE_REGIONS], ['/start/', 390, PAGE_REGIONS]];
const results = []; let unexpected = 0;
for (const engine of ENGINES) {
  const fd = engine === 'chromium-fd', type = fd ? 'chromium' : engine;
  const browser = await pw[type].launch(fd ? { args: FD_ARGS } : {});
  if (engine === ENGINES[0] && type === 'chromium') await layout(browser);
  for (const scheme of SCHEMES) {
    const ctl = fd ? await control(browser, scheme) : null;
    if (fd && ctl === '#FFFFFF') throw new Error('forced dark is not active in this Chromium build: control page stayed white');
    for (const theme of THEMES) {
      const row = { engine, scheme, theme, control: ctl, pages: {} };
      for (const [route, width, fn] of PAGES) row.pages[route] = await measure(browser, scheme, theme, route, width, fn);
      /* Blink force-dark with a light device preference is WebView's FORCE_DARK_ONLY
         path, where Chromium ignores 'only' by design (computed_style.cc). It is
         recorded, not required. Every other configuration must pass. */
      row.expected_to_pass = !(fd && scheme === 'light');
      const fails = Object.values(row.pages).flat().filter(c => c.pass === false);
      row.fails = fails.length;
      if (row.expected_to_pass) unexpected += fails.length;
      results.push(row);
      console.log(`${engine.padEnd(12)} device ${scheme.padEnd(5)} theme ${theme.padEnd(6)} ${fails.length ? 'FAIL ' + fails.length + ': ' + [...new Set(fails.map(f => f.id))].join(' ') : 'pass'}${ctl ? '  (control page painted ' + ctl + ')' : ''}`);
    }
  }
  await browser.close();
}

/* ── report ───────────────────────────────────────────────────────────────── */
fs.writeFileSync(path.join(DOCS, 'forced-dark-matrix.json'), JSON.stringify({ generated: new Date().toISOString(), base: BASE, dpr: DPR, tolerance: TOL, results }, null, 1) + '\n');
const label = { chromium: 'Chromium', firefox: 'Firefox', webkit: 'WebKit', 'chromium-fd': 'Chromium + Blink force-dark' };
const groupCell = (row, ids) => {
  const cells = Object.values(row.pages).flat().filter(c => ids.includes(c.id));
  if (!cells.length) return '–';
  if (cells.every(c => c.pass === null)) return 'observed';
  const bad = cells.filter(c => c.pass === false);
  return bad.length ? `**FAIL ${bad.length}**` : 'pass';
};
const head = ['Engine', 'Device', 'Theme', ...Object.keys(GROUPS).filter(g => g !== 'Native'), 'Native controls (observed)'];
const lines = [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`];
for (const r of results) {
  const native = Object.values(r.pages).flat().filter(c => c.method === 'observe').map(c => `${c.id.replace('native-', '')} ${c.got}`).join(', ');
  lines.push(`| ${label[r.engine]}${r.expected_to_pass ? '' : ' †'} | ${r.scheme} | ${r.theme} | ${Object.entries(GROUPS).filter(([g]) => g !== 'Native').map(([, ids]) => groupCell(r, ids)).join(' | ')} | ${native} |`);
}
const failing = results.flatMap(r => Object.entries(r.pages).flatMap(([route, cells]) => cells.filter(c => c.pass === false)
  .map(c => `| ${label[r.engine]} | ${r.scheme} | ${r.theme} | ${route} | ${c.id} | ${c.expect} | ${c.got} | ${c.delta} |`)));
const block = ['<!-- matrix:begin (generated by tools/theme-matrix.mjs; do not edit by hand) -->',
  `Run ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC against ${BASE}, at ${DPR} device px per CSS px. Tolerance per channel: fill ${TOL.fill}, glyph ${TOL.ink}, image mean ${TOL.mean}.`,
  '† Blink force-dark with a light device preference: WebView\'s FORCE_DARK_ONLY path, where Chromium overrides even `only light` by design (computed_style.cc). Recorded, not required. Chrome documents Auto Dark Theme as applying "when the user has opted into dark themes in the operating system" (developer.chrome.com/blog/auto-dark-theme), so Chrome Android should not take this path. That is Chrome\'s documentation, not traced in Chrome Android\'s code.', '',
  ...lines, '', failing.length ? '**Failing cells**' : 'No failing cells.', '',
  ...(failing.length ? ['| Engine | Device | Theme | Page | Cell | Expected | Painted | Δ |', '|---|---|---|---|---|---|---|---|', ...failing] : []),
  '<!-- matrix:end -->'].join('\n');
const mdPath = path.join(DOCS, 'FORCED_DARK_MATRIX.md');
if (fs.existsSync(mdPath)) {
  const md = fs.readFileSync(mdPath, 'utf8');
  fs.writeFileSync(mdPath, md.replace(/<!-- matrix:begin[\s\S]*?<!-- matrix:end -->/, block));
} else fs.writeFileSync(path.join(DOCS, 'forced-dark-matrix-table.md'), block + '\n');
console.log(`\n${results.length} configurations · ${unexpected ? unexpected + ' unexpected failure(s)' : 'all required configurations pass'}`);
process.exit(unexpected ? 1 : 0);
