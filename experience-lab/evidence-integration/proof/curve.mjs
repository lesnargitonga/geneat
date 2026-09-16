import { chromium } from 'playwright';
const br = await chromium.launch();
const CURVES = {
  'current .4,0,.25,1':      'cubic-bezier(.4,0,.25,1)',
  'even   .4,.1,.4,.9':      'cubic-bezier(.4,.1,.4,.9)',
  'gentle .25,.15,.35,.85':  'cubic-bezier(.25,.15,.35,.85)',
  'linear':                  'linear',
};
const INK = 110, GROUND = 175;
console.log('curve                       dur    frames of visible change   settle');
for (const [name, fn] of Object.entries(CURVES)) {
  for (const d of [260, 340, 420]) {
    const ctx = await br.newContext({ viewport: { width: 1180, height: 700 } });
    const p = await ctx.newPage();
    await p.goto('http://127.0.0.1:8781/index.html', { waitUntil: 'networkidle' });
    await p.addStyleTag({ content: `:root{--t-sig:${d}ms!important;--e-struct:${fn}!important}` });
    await p.locator('.op').scrollIntoViewIfNeeded();
    for (let i = 0; i < 2; i++) { await p.locator('.ctl button', { hasText: 'Next step' }).click(); await p.waitForTimeout(d + 200); }
    const tr = await p.evaluate(async (dur) => {
      const step = document.querySelectorAll('.step')[0];
      const g = getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number);
      const L = el => { const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g).map(Number);
        const a = m.length > 3 ? m[3] : 1;
        return [0,1,2].map(i => a*m[i] + (1-a)*g[i]).reduce((x,y)=>x+y)/3; };
      const out = [], t0 = performance.now();
      document.querySelectorAll('.ctl button')[1].click();
      while (performance.now() - t0 < dur + 200) { out.push({ t: Math.round(performance.now()-t0), l: L(step) }); await new Promise(r => requestAnimationFrame(r)); }
      return out;
    }, d);
    const n = tr.filter(f => f.l > INK && f.l < GROUND).length;
    const settled = tr.find(f => f.l >= GROUND)?.t ?? d;
    console.log(`${name.padEnd(26)} ${String(d).padStart(4)}ms   ${String(n).padStart(3)} (${String(Math.round(n*16.7)).padStart(3)}ms)  ${String(Math.round(100*settled/d)).padStart(3)}% of declared   ${String(settled).padStart(4)}ms`);
    await ctx.close();
  }
}
await br.close();
