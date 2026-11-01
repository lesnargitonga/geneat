/* ═══ TRANSFER AUDIT ═════════════════════════════════════════════════════
   What a page actually transfers, cold, per viewport: at rest (loaded, not
   scrolled) and after the visitor scrolls to the end, with the largest
   resources named. perf.mjs reports timings; this reports bytes and where
   they come from, so a budget can be checked against the real culprit.

     python3 -m http.server 8911 --bind 127.0.0.1    # serve first, from this dir
     node tools/transfer.mjs
     BASE=https://lesnarai.com ROUTES=/ node tools/transfer.mjs              */
import * as pw from '/home/lesnar/Documents/ai model/experience-lab/study-b-webgl/node_modules/playwright/index.mjs';

const BASE = process.env.BASE || 'http://127.0.0.1:8911';
const ROUTES = (process.env.ROUTES || '/').split(',');
const VIEWS = { desktop: [1440, 900], laptop: [1280, 800], phone: [390, 844] };
const kb = n => `${(n / 1024).toFixed(0)}k`;

const browser = await pw.chromium.launch();
try {
  for (const route of ROUTES) {
    for (const [name, [w, h]] of Object.entries(VIEWS)) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: name === 'phone', hasTouch: name === 'phone' });
      const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      const bytes = new Map();
      const urls = new Map();
      cdp.on('Network.responseReceived', e => urls.set(e.requestId, e.response.url));
      cdp.on('Network.loadingFinished', e => bytes.set(e.requestId, (bytes.get(e.requestId) || 0) + e.encodedDataLength));
      cdp.on('Network.dataReceived', e => { if (!bytes.has(e.requestId)) bytes.set(e.requestId, 0); });
      const total = () => [...bytes.values()].reduce((a, b) => a + b, 0);

      await page.goto(BASE + route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      const atRest = total();
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 300) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
      });
      await page.waitForTimeout(4000);
      const scrolled = total();
      const top = [...bytes.entries()].map(([id, n]) => [urls.get(id) || id, n]).sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([u, n]) => `${u.replace(BASE, '').replace(/^https?:\/\/[^/]+/, '').slice(0, 44)} ${kb(n)}`);
      console.log(`${route.padEnd(16)} ${name.padEnd(8)} at rest ${kb(atRest).padStart(6)}  scrolled ${kb(scrolled).padStart(6)}  largest: ${top.join(' · ')}`);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
