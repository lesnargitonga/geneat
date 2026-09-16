import { chromium } from 'playwright';
/* one fresh browser per measurement, so the font cache is genuinely cold */
for (const [tag, block] of [['fonts allowed (cold)', false], ['fonts blocked', true]]) {
  for (const w of [1440, 390]) {
    const br = await chromium.launch();
    const ctx = await br.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
    const p = await ctx.newPage();
    if (block) await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await p.addInitScript(() => { window.__cls = 0; new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) window.__cls += e.value; })).observe({ type: 'layout-shift', buffered: true }); });
    await p.goto('http://127.0.0.1:8781/index.html', { waitUntil: 'networkidle' });
    await p.waitForTimeout(1200);
    console.log(`${String(w).padStart(5)}px  ${tag.padEnd(22)} CLS ${(await p.evaluate(() => window.__cls)).toFixed(4)}`);
    await br.close();
  }
}
