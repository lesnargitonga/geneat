import { chromium } from 'playwright';
/* Duration derivation. The ambiguity window turned out not to discriminate:
   the outgoing and incoming fills overlap, so at every candidate duration
   there is at most one frame where neither object reads as ink. What does
   discriminate is how many rendered frames actually SHOW the change, and how
   long the reader must wait before the sequence will accept the next step. */
const br = await chromium.launch();
const INK = 110, GROUND = 175;
console.log('  dur   frames showing change   settle   verdict');
for (const d of [110, 180, 260, 340, 420, 520, 700]) {
  const ctx = await br.newContext({ viewport: { width: 1180, height: 700 } });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8781/index.html', { waitUntil: 'networkidle' });
  await p.addStyleTag({ content: `:root{--t-sig:${d}ms!important}` });
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
    while (performance.now() - t0 < dur + 200) {
      out.push({ t: Math.round(performance.now() - t0), l: L(step) });
      await new Promise(r => requestAnimationFrame(r));
    }
    return out;
  }, d);
  const moving = tr.filter(f => f.l > INK && f.l < GROUND);
  const settled = tr.find(f => f.l >= GROUND)?.t ?? d;
  const n = moving.length;
  console.log(`${String(d).padStart(5)}ms   ${String(n).padStart(3)} frames (${String(Math.round(n*16.7)).padStart(3)}ms)   ${String(settled).padStart(4)}ms   ` +
    (n <= 3 ? 'a cut — the eye is given nothing to follow'
     : n <= 6 ? 'a flicker; the move is glimpsed, not followed'
     : n <= 12 ? 'the move is followable and the wait is short'
     : 'followable, but the reader now waits on the animation'));
  await ctx.close();
}
await br.close();
