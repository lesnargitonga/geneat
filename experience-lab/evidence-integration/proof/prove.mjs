/* Phase 8 proof harness. Every claim in the review artifact that says
   "measured" is produced here. Run: node proof/prove.mjs  (serve on :8781) */
import { chromium } from 'playwright';
import fs from 'fs';
const O = 'http://127.0.0.1:8781', OUT = 'frames';
const log = [];
const R = (k, v) => { log.push([k, v]); console.log(('· ' + k).padEnd(50), typeof v === 'object' ? JSON.stringify(v) : v); };
const br = await chromium.launch();
async function P(o = {}) {
  const ctx = await br.newContext({
    viewport: o.vp || { width: 1440, height: 900 }, deviceScaleFactor: o.dsf || 2,
    colorScheme: o.dark ? 'dark' : 'light',
    reducedMotion: o.reduced ? 'reduce' : 'no-preference',
    javaScriptEnabled: !o.nojs, hasTouch: !!o.touch, isMobile: !!o.touch,
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => R('!! JS ERROR ' + (o.tag || ''), e.message));
  p.on('console', m => { if (m.type() === 'error') R('!! CONSOLE ' + (o.tag || ''), m.text()); });
  await p.goto(O + '/' + (o.file || 'index.html'), { waitUntil: 'networkidle' });
  return p;
}
const close = async p => { const c = p.context(); await p.close(); await c.close(); };
const shot = (p, n, el) => (el || p).screenshot({ path: `${OUT}/${n}.png` });
const step = async (p, n = 1) => { for (let i = 0; i < n; i++) { await p.locator('.ctl button', { hasText: /^Next$/ }).click(); await p.waitForTimeout(430); } };

/* ── menu ─────────────────────────────────────────────────────────────── */
{
  const p = await P({ tag: 'menu', vp: { width: 390, height: 844 }, touch: true });
  R('menu · control element', await p.evaluate(() => document.querySelector('.head-r .menu').tagName));
  R('menu · panel reachable by tab when shut', await p.evaluate(() => { const a = document.querySelector('#menu-panel a'); a.focus(); return document.activeElement === a; }));
  await p.locator('.head-r .menu').click(); await p.waitForTimeout(90); await shot(p, 'M-1-mid');
  await p.waitForTimeout(280); await shot(p, 'M-2-open');
  R('menu · aria-expanded when open', await p.locator('.head-r .menu').getAttribute('aria-expanded'));
  R('menu · panel reachable when open', await p.evaluate(() => { const a = document.querySelector('#menu-panel a'); a.focus(); return document.activeElement === a; }));
  const box = await p.evaluate(() => {
    const ul = document.querySelector('#menu-panel ul').getBoundingClientRect();
    const cl = document.querySelector('#menu-panel .close').getBoundingClientRect();
    return { listBottom: Math.round(ul.bottom), closeTop: Math.round(cl.top), listW: Math.round(ul.width), panelW: Math.round(document.querySelector('#menu-panel .w').clientWidth) };
  });
  R('menu · close sits below the list (not beside)', box.closeTop >= box.listBottom - 2);
  R('menu · list spans the panel width', Math.abs(box.listW - (box.panelW - 0)) < 40 ? 'yes' : `no (${box.listW}/${box.panelW})`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  R('menu · escape returns aria-expanded', await p.locator('.head-r .menu').getAttribute('aria-expanded'));
  R('menu · focus returned to the control', await p.evaluate(() => document.activeElement.className));
  await close(p);
}
/* ── form ─────────────────────────────────────────────────────────────── */
{
  const p = await P({ tag: 'form', file: 'start.html' });
  const f = p.locator('.form'); await f.scrollIntoViewIfNeeded();
  R('form · error state on arrival', await p.locator('.fld[data-err]').count());
  await shot(p, 'F-0-pristine', f);
  await p.locator('.form__act button').click(); await p.waitForTimeout(250);
  R('form · error after empty submit', await p.locator('.fld[data-err]').count());
  R('form · focus moved to the invalid field', await p.evaluate(() => document.activeElement.id));
  R('form · live region silent on failure (no echo)', (await p.locator('.form__state').textContent()).trim() === '');
  R('form · field describes its own error', await p.locator('#f-reply').getAttribute('aria-describedby'));
  await shot(p, 'F-1-error', f);
  await p.locator('#f-reply').fill('lesnar@example.co.ke'); await p.waitForTimeout(200);
  R('form · error clears while typing', await p.locator('.fld[data-err]').count());
  await p.locator('.form__act button').click(); await p.waitForTimeout(250);
  const st = (await p.locator('.form__state').textContent()).trim();
  R('form · outcome', st.slice(0, 74) + '…');
  R('form · claims a send (must be false)', /\b(sent|delivered|received|thank)\b/i.test(st.replace(/not sent/i, '')));
  await shot(p, 'F-3-checked', f);
  await close(p);
}
/* ── no script ────────────────────────────────────────────────────────── */
{
  const p = await P({ tag: 'nojs', nojs: true, vp: { width: 390, height: 844 } });
  R('nojs · focusable controls created', await p.locator('.ctl button').count());
  R('nojs · ownership labels present', await p.locator('.own').count());
  R('nojs · steps still listed / crossings drawn', `${await p.locator('.step').count()} / ${await p.locator('.bound').count()}`);
  R('nojs · menu is a link to a real page', await p.evaluate(() => { const m = document.querySelector('.head-r .menu'); return m.tagName + ' → ' + m.getAttribute('href'); }));
  await shot(p, 'N-0-home-nojs', p.locator('.op'));
  const q = await P({ tag: 'nojs2', nojs: true, vp: { width: 390, height: 844 }, file: 'menu-open.html' });
  R('nojs · menu-open serves the open panel', await q.locator('#menu-panel a').first().isVisible());
  await shot(q, 'N-1-menu-open-nojs');
  const g = await P({ tag: 'nojs3', nojs: true, file: 'start.html' });
  R('nojs · submit disabled and says why', `${await g.locator('.form__act button').isDisabled()} · "${(await g.locator('.form__act button').textContent()).trim()}"`);
  await close(p); await close(q); await close(g);
}
/* ── reduced motion: less motion, identical facts ─────────────────────── */
{
  const facts = {};
  for (const reduced of [false, true]) {
    const p = await P({ tag: 'rm' + reduced, reduced });
    await p.locator('.op').scrollIntoViewIfNeeded();
    const seen = [];
    for (let i = 1; i <= 5; i++) {
      await p.locator('.ctl button', { hasText: /^Next$/ }).click();
      await p.waitForTimeout(reduced ? 60 : 430);
      seen.push(await p.evaluate(() => {
        const s = [...document.querySelectorAll('.step')].map(x => (x.getAttribute('data-own') || '-') + '/' + (x.getAttribute('data-run') || '-') + ':' + (x.querySelector('.own') ? x.querySelector('.own').textContent : ''));
        const b = [...document.querySelectorAll('.bound')].map(x => x.hasAttribute('data-live') ? 'LIVE' : '-');
        return s.join('|') + ' // ' + b.join('|') + ' // ' + document.querySelector('.ctl__say').textContent.trim().slice(0, 30);
      }));
    }
    facts[reduced ? 'reduced' : 'full'] = seen;
    if (reduced) { await shot(p, 'RM-pos3', p.locator('.op')); }
    const d = await p.evaluate(() => getComputedStyle(document.querySelector('.step')).transitionDuration);
    R(`reduced=${reduced} · step transition-duration`, d);
    await close(p);
  }
  const same = JSON.stringify(facts.full) === JSON.stringify(facts.reduced);
  R('reduced motion · identical facts at every position', same);
  if (!same) facts.full.forEach((v, i) => { if (v !== facts.reduced[i]) R(`  DIFFERS at pos${i + 1}`, v + '  ≠  ' + facts.reduced[i]); });
}
/* ── the ownership invariant now lives in proof/vocab.mjs, which counts
      ACTORS rather than filled rows. Row counts are not a proxy for actors. */
/* ── CLS ──────────────────────────────────────────────────────────────── */
{
  for (const vp of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
    const p = await P({ tag: 'cls' + vp.width, vp });
    await p.evaluate(() => {
      window.__cls = 0;
      new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) window.__cls += e.value; })).observe({ type: 'layout-shift', buffered: true });
    });
    await p.locator('.op').scrollIntoViewIfNeeded();
    const beforeStep = await p.evaluate(() => window.__cls);
    for (let i = 0; i < 5; i++) await step(p);
    await p.waitForTimeout(400);
    const after = await p.evaluate(() => window.__cls);
    R(`CLS ${vp.width}px · on load / after stepping all 5`, `${beforeStep.toFixed(4)} / ${after.toFixed(4)}`);
    /* the narration reserve: does the text block change height between states? */
    const h = await p.evaluate(async () => {
      const say = document.querySelector('.ctl__say'), out = [];
      const btn = [...document.querySelectorAll('.ctl button')].find(b => /Back to overview/.test(b.textContent));
      btn.click(); await new Promise(r => setTimeout(r, 400));
      const next = [...document.querySelectorAll('.ctl button')].find(b => /^Next$/.test(b.textContent));
      out.push(Math.round(say.getBoundingClientRect().height));
      for (let i = 0; i < 5; i++) { next.click(); await new Promise(r => setTimeout(r, 380)); out.push(Math.round(say.getBoundingClientRect().height)); }
      return out;
    });
    R(`  narration block height per state (${vp.width}px)`, h.join(','));
    await close(p);
  }
}
/* ── the page at rest, every breakpoint, both themes ──────────────────── */
{
  for (const [tag, o] of [
    ['1440-light', { vp: { width: 1440, height: 900 } }],
    ['1440-dark', { vp: { width: 1440, height: 900 }, dark: true }],
    ['1024-light', { vp: { width: 1024, height: 768 } }],
    ['390-light', { vp: { width: 390, height: 844 } }],
    ['390-dark', { vp: { width: 390, height: 844 }, dark: true }],
  ]) {
    const p = await P({ tag, ...o });
    await p.locator('.op').scrollIntoViewIfNeeded();
    await shot(p, `S-rest-${tag}`, p.locator('.op'));
    await step(p, 3);
    await shot(p, `S-cross-${tag}`, p.locator('.op'));
    await close(p);
  }
  R('rest + crossing captured', '1440/1024/390 · light + dark');
}
fs.writeFileSync(`${OUT}/_proof.json`, JSON.stringify(log, null, 1));
await br.close();
