import { chromium } from 'playwright';
/* PHASE 8A · the locked Phase 5 vocabulary, checked at ACTOR level.
   Row counts are never used as a proxy for actor counts.                    */
const br = await chromium.launch();
const ctx = await br.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('!! JS ERROR', e.message));
await p.goto('http://127.0.0.1:8781/index.html', { waitUntil: 'networkidle' });
await p.locator('.op').scrollIntoViewIfNeeded();

const read = () => p.evaluate(() => {
  const sig = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const toRgb = h => { const m = h.replace('#','').match(/../g).map(x=>parseInt(x,16)); return `rgb(${m.join(', ')})`; };
  const banned = ['--sig','--ok','--down'].map(n => toRgb(sig(n)));
  const steps = [...document.querySelectorAll('.op .step')];
  const held = steps.filter(s => s.getAttribute('data-own') === 'held');
  const rel  = steps.filter(s => s.getAttribute('data-own') === 'released');
  const watch= steps.filter(s => s.getAttribute('data-own') === 'watch');
  const plainBg = getComputedStyle(steps.find(s => !s.hasAttribute('data-own')) || steps[0]).backgroundColor;
  /* ownership is communicated by a region, so count DISTINCT regions & actors */
  const uniq = a => [...new Set(a)];
  const heldRegions = uniq(held.map(s => s.dataset.region));
  const heldActors  = uniq(held.map(s => s.dataset.actor));
  const relRegions  = uniq(rel.map(s => s.dataset.region));
  /* does any element inside .op paint itself with a semantic/brand colour? */
  const colourLeak = [...document.querySelectorAll('.op .step, .op .bound')].filter(el => {
    const cs = getComputedStyle(el);
    return banned.includes(cs.backgroundColor) || banned.includes(cs.borderTopColor);
  }).length;
  return {
    state: document.querySelector('.op').getAttribute('data-state'),
    holder_actor_count: heldActors.length,
    holder_region_count: heldRegions.length,
    released_region_count: relRegions.length,
    active_parted_boundary_count: document.querySelectorAll('.op .bound[data-live]').length,
    /* WATCHING must carry no ownership treatment at all */
    watch_has_ownership_paint: watch.some(s => {
      const cs = getComputedStyle(s);
      return cs.backgroundColor !== plainBg || cs.boxShadow !== 'none' || s.hasAttribute('data-run');
    }),
    /* PARTED must not be painted like a holder fill */
    parted_uses_holder_fill: [...document.querySelectorAll('.op .bound[data-live]')].some(b => {
      const bg = getComputedStyle(b).backgroundColor;
      const ink = getComputedStyle(document.querySelector('.op .step[data-own="held"]') || document.body).backgroundColor;
      return bg === ink && bg !== 'rgba(0, 0, 0, 0)';
    }),
    parted_border_px: (() => { const b = document.querySelector('.op .bound[data-live]');
      return b ? Math.round(parseFloat(getComputedStyle(b).borderTopWidth)) : 0; })(),
    parted_centre_is_ground: (() => { const b = document.querySelector('.op .bound[data-live]');
      if (!b) return null;
      return getComputedStyle(b).backgroundColor === getComputedStyle(document.body).backgroundColor
          || getComputedStyle(b).backgroundColor === 'rgba(0, 0, 0, 0)'; })(),
    colour_leak: colourLeak,
    labels: [...document.querySelectorAll('.op .own')].map(w => w.textContent).filter(Boolean),
  };
});

const rows = [];
rows.push({ pos: 'overview', ...(await read()) });
for (let i = 1; i <= 5; i++) {
  await p.locator('.ctl button', { hasText: /^Next$/ }).click();
  await p.waitForTimeout(430);
  rows.push({ pos: String(i), ...(await read()) });
  await p.locator('.op').screenshot({ path: `frames/V-${i}.png` });
}
await p.locator('.ctl button', { hasText: 'Back to overview' }).click();
await p.waitForTimeout(430);
await p.locator('.op').screenshot({ path: 'frames/V-0.png' });

let fail = 0;
const bad = (c, m) => { if (c) { fail++; console.log('   *** FAIL:', m); } };
console.log('pos       holder_actors  holder_regions  released  parted  labels');
for (const r of rows) {
  console.log(`${r.pos.padEnd(9)} ${String(r.holder_actor_count).padStart(9)} ` +
    `${String(r.holder_region_count).padStart(15)} ${String(r.released_region_count).padStart(9)} ` +
    `${String(r.active_parted_boundary_count).padStart(7)}   ${r.labels.join(' / ')}`);
  const crossing = r.active_parted_boundary_count === 1;
  if (r.pos === 'overview') {
    bad(r.holder_actor_count !== 0, 'overview must have zero holder actors');
    bad(crossing, 'overview must have no live boundary');
  } else if (crossing) {
    bad(r.holder_actor_count !== 0, `crossing ${r.pos}: holder_actor_count must be 0`);
    bad(r.released_region_count !== 1, `crossing ${r.pos}: exactly one region must be OUTLINED`);
  } else {
    bad(r.holder_actor_count !== 1, `settled ${r.pos}: holder_actor_count must be 1`);
    bad(r.holder_region_count !== 1, `settled ${r.pos}: two regions communicate ownership`);
    bad(r.active_parted_boundary_count !== 0, `settled ${r.pos}: no boundary may be live`);
  }
  bad(r.watch_has_ownership_paint, `${r.pos}: watching communicates ownership`);
  bad(r.parted_uses_holder_fill, `${r.pos}: PARTED is painted as a holder fill`);
  bad(crossing && !r.parted_centre_is_ground, `${r.pos}: PARTED centre is not open ground`);
  bad(r.colour_leak > 0, `${r.pos}: brand or semantic colour participates in ownership`);
}
console.log('\nPARTED slab weight at a crossing:', rows.find(r => r.active_parted_boundary_count)?.parted_border_px + 'px');
console.log('centre of PARTED is page ground   :', rows.find(r => r.active_parted_boundary_count)?.parted_centre_is_ground);
console.log(fail === 0 ? '\nALL VOCABULARY INVARIANTS HOLD' : `\n${fail} INVARIANT FAILURES`);
await br.close();
