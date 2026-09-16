import { chromium } from 'playwright';
const br = await chromium.launch();
for (const w of [1440, 1024, 768, 390, 320]) {
  const ctx = await br.newContext({ viewport: { width: w, height: 900 } });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8781/index.html', { waitUntil: 'networkidle' });
  await p.locator('.op').scrollIntoViewIfNeeded();
  const h = await p.evaluate(async () => {
    const say = document.querySelector('.ctl__say'), out = [];
    const next = [...document.querySelectorAll('.ctl button')].find(b => /^Next$/.test(b.textContent));
    out.push(Math.round(say.getBoundingClientRect().height));
    for (let i = 0; i < 5; i++) { next.click(); await new Promise(r => setTimeout(r, 380)); out.push(Math.round(say.getBoundingClientRect().height)); }
    return out;
  });
  const flat = new Set(h).size === 1;
  console.log(`${String(w).padStart(5)}px  heights ${h.join(',').padEnd(34)} ${flat ? 'STABLE' : '*** SHIFTS ***'}`);
  await ctx.close();
}
/* attribute the load-time CLS */
for (const [tag, block] of [['fonts allowed', false], ['fonts blocked', true]]) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  if (block) await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await p.addInitScript(() => { window.__cls = 0; new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) window.__cls += e.value; })).observe({ type: 'layout-shift', buffered: true }); });
  await p.goto('http://127.0.0.1:8781/index.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  console.log(`CLS at 390px, ${tag}: ${(await p.evaluate(() => window.__cls)).toFixed(4)}`);
  await ctx.close();
}
await br.close();
