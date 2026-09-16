import { chromium } from 'playwright';
const br = await chromium.launch();
const R = (k,v)=>console.log(('· '+k).padEnd(52), typeof v==='object'?JSON.stringify(v):v);
async function P(o={}){const ctx=await br.newContext({viewport:o.vp||{width:1440,height:900},deviceScaleFactor:2,
  colorScheme:o.dark?'dark':'light',reducedMotion:o.reduced?'reduce':'no-preference',javaScriptEnabled:!o.nojs});
  const p=await ctx.newPage(); p.on('pageerror',e=>R('!! JS ERROR',e.message));
  await p.goto('http://127.0.0.1:8781/'+(o.file||'index.html'),{waitUntil:'networkidle'}); return p;}
const close=async p=>{const c=p.context();await p.close();await c.close();};

/* ── accessibility: what is announced, and how ────────────────────────── */
{
  const p = await P();
  await p.locator('.op').scrollIntoViewIfNeeded();
  R('live region · role/atomic', await p.evaluate(()=>{const s=document.querySelector('.ctl__say');
    return s.getAttribute('aria-live')+' / atomic='+s.getAttribute('aria-atomic');}));
  await p.locator('.ctl button',{hasText: /^Next$/}).click(); await p.waitForTimeout(400);
  const t1 = await p.locator('.ctl__say').textContent();
  await p.locator('.ctl button',{hasText: /^Next$/}).click(); await p.waitForTimeout(400);
  const t2 = await p.locator('.ctl__say').textContent();
  R('announcement changes per step', t1.trim()!==t2.trim());
  R('announcement names the holder', /customer|shop|rider/i.test(t2));
  const names = await p.locator('.ctl').getByRole('button').evaluateAll(
    bs => bs.map(b => `${b.textContent.trim()}${b.disabled ? '(disabled)' : ''}`));
  R('control group exposes buttons', names.join(' · '));
  R('every control has a text name', names.every(n => n.replace('(disabled)','').length > 2));
  /* keyboard: arrows inside the group, and nothing hijacked outside it */
  await p.locator('.ctl button',{hasText: /^Next$/}).focus();
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(400);
  R('arrow-right advances when focus is in the group', await p.locator('.ctl__pos').textContent());
  const yBefore = await p.evaluate(()=>window.scrollY);
  await p.locator('h1').click({position:{x:5,y:5}});
  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(200);
  R('arrow keys outside the group still scroll', (await p.evaluate(()=>window.scrollY))!==yBefore);
  await close(p);
}
/* ── MOTION-REMOVAL TEST · every duration forced to zero ──────────────── */
{
  const facts=[];
  for (const zero of [false,true]) {
    const p = await P();
    if (zero) await p.addStyleTag({content:'*{transition-duration:0s!important;animation-duration:0s!important}'});
    await p.locator('.op').scrollIntoViewIfNeeded();
    const seen=[];
    for (let i=1;i<=5;i++){ await p.locator('.ctl button',{hasText: /^Next$/}).click(); await p.waitForTimeout(420);   /* settle fully in both runs */
      seen.push(await p.evaluate(()=>{
        const s=[...document.querySelectorAll('.step')].map(x=>(x.getAttribute('data-own')||'-')+'/'+(x.getAttribute('data-run')||'-')+':'+(x.querySelector('.own') ? x.querySelector('.own').textContent : ''));
        const b=[...document.querySelectorAll('.bound')].map(x=>x.hasAttribute('data-live')?'LIVE':'-');
        return s.join('|')+' // '+b.join('|')+' // '+document.querySelector('.ctl__say').textContent.trim();}));}
    facts.push(seen); await close(p);
  }
  R('motion removed · identical facts at all 5 positions', JSON.stringify(facts[0])===JSON.stringify(facts[1]));
}
/* ── SIGNATURE-REMOVAL TEST · what the page loses without the stepper ── */
{
  const p = await P();
  const before = await p.evaluate(()=>document.body.innerText.replace(/\s+/g,' ').trim().length);
  await p.evaluate(()=>{const o=document.querySelector('.op'); o.parentNode.removeChild(o);});
  const after = await p.evaluate(()=>document.body.innerText.replace(/\s+/g,' ').trim().length);
  R('signature removed · page text lost', `${before-after} of ${before} chars (${(100*(before-after)/before).toFixed(1)}%)`);
  R('signature removed · other beats intact', await p.locator('section').count());
  await p.screenshot({path:'frames/X-signature-removed.png', fullPage:false});
  await close(p);
}
/* ── reduced motion captured at the crossing, correctly ───────────────── */
{
  const p = await P({reduced:true});
  await p.locator('.op').scrollIntoViewIfNeeded();
  for (let i=0;i<3;i++){ await p.locator('.ctl button',{hasText: /^Next$/}).click(); await p.waitForTimeout(80); }
  R('reduced motion · position captured', await p.locator('.ctl__pos').textContent());
  await p.locator('.op').screenshot({path:'frames/RM-cross.png'});
  await close(p);
}
/* ── red team · things motion could break ─────────────────────────────── */
{
  const p = await P();
  await p.locator('.op').scrollIntoViewIfNeeded();
  /* leave mid-transition and come back */
  await p.locator('.ctl button',{hasText: /^Next$/}).click();
  await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  await p.waitForTimeout(500);
  R('red team · state after a mid-transition interruption', await p.locator('.ctl__pos').textContent());
  R('red team · data-moving stuck', await p.locator('.op[data-moving]').count());
  /* resize across the breakpoint while the menu is open */
  const m = await P({vp:{width:390,height:844}});
  await m.locator('.head-r .menu').click(); await m.waitForTimeout(280);
  await m.setViewportSize({width:1200,height:900}); await m.waitForTimeout(350);
  R('red team · menu after crossing to desktop', await m.evaluate(()=>document.body.getAttribute('data-menu')||'closed'));
  R('red team · panel visible at desktop', await m.locator('#menu-panel').isVisible());
  await m.setViewportSize({width:390,height:844}); await m.waitForTimeout(300);
  R('red team · panel still shut on return to phone', await m.evaluate(()=>document.body.getAttribute('data-menu')||'closed'));
  /* double-click the disclosure fast */
  await m.locator('.head-r .menu').dblclick(); await m.waitForTimeout(350);
  R('red team · double-click leaves a consistent state',
    (await m.locator('.head-r .menu').getAttribute('aria-expanded'))+' / body='+(await m.evaluate(()=>document.body.getAttribute('data-menu')||'closed')));
  await close(p); await close(m);
}
await br.close();
