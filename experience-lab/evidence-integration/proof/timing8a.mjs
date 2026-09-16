import { chromium } from 'playwright';
/* PHASE 8A · the animated object has changed. It is no longer a background
   fading between ink and ground; it is a boundary PARTING — border weight
   4→13px and padding 18→32px — while an ownership region hands its fill off.
   The Phase 8 timing evidence therefore does not carry over.

   Frames are captured at fixed WALL-CLOCK instants, not at percentages of
   each candidate, so the candidates are actually comparable.                */
const br = await chromium.launch();
const INSTANTS = [0, 85, 170, 255, 340, 425];
for (const d of [340, 380, 420]) {
  const ctx = await br.newContext({ viewport: { width: 1150, height: 620 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8781/index.html', { waitUntil: 'networkidle' });
  await p.addStyleTag({ content: `:root{--t-sig:${d}ms!important}` });
  await p.locator('.op').scrollIntoViewIfNeeded();
  await p.locator('.ctl button', { hasText: /^Next$/ }).click();      /* to holder 1 */
  await p.waitForTimeout(d + 200);

  /* numeric trace of the real, un-paused transition into the crossing */
  const tr = await p.evaluate(async (dur) => {
    const b = document.querySelectorAll('.op .bound')[0];
    const st = document.querySelectorAll('.op .step')[0];
    const g = getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number);
    const L = el => { const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g).map(Number);
      const a = m.length > 3 ? m[3] : 1;
      return [0,1,2].map(i => a*m[i] + (1-a)*g[i]).reduce((x,y)=>x+y)/3; };
    const out = [], t0 = performance.now();
    [...document.querySelectorAll('.ctl button')].find(x => /^Next$/.test(x.textContent)).click();
    while (performance.now() - t0 < dur + 160) {
      out.push({ t: Math.round(performance.now()-t0),
                 w: +parseFloat(getComputedStyle(b).borderTopWidth).toFixed(1),
                 l: Math.round(L(st)) });
      await new Promise(r => requestAnimationFrame(r));
    }
    return out;
  }, d);
  const parting = tr.filter(f => f.w > 4.4 && f.w < 12.6).length;
  const fading  = tr.filter(f => f.l > 110 && f.l < 175).length;
  const settled = tr.find(f => f.w >= 12.6)?.t ?? d;
  console.log(`${d}ms linear · boundary parting visible in ${String(parting).padStart(2)} frames ` +
              `(${String(Math.round(parting*16.7)).padStart(3)}ms) · region fade ${String(fading).padStart(2)} frames · ` +
              `slabs fully apart at ${String(settled).padStart(3)}ms`);

  /* frames at shared wall-clock instants */
  await p.locator('.ctl button', { hasText: 'Back to overview' }).click(); await p.waitForTimeout(d + 200);
  await p.locator('.ctl button', { hasText: /^Next$/ }).click(); await p.waitForTimeout(d + 200);
  await p.locator('.ctl button', { hasText: /^Next$/ }).click();
  await p.evaluate(() => { window.__an = document.getAnimations().filter(a => a.effect && a.effect.getTiming().duration > 0); window.__an.forEach(a => a.pause()); });
  for (const T of INSTANTS) {
    await p.evaluate(ms => window.__an.forEach(a => { a.currentTime = Math.min(ms, a.effect.getTiming().duration); }), T);
    await p.waitForTimeout(45);
    await p.locator('.steps').screenshot({ path: `frames/W-${d}-${String(T).padStart(3,'0')}.png` });
  }
  await ctx.close();
}
await br.close();
