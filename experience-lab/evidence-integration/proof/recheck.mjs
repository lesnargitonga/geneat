import { chromium } from 'playwright';
const O='http://127.0.0.1:8783';
const R=(k,v)=>console.log(('· '+k).padEnd(52), typeof v==='object'?JSON.stringify(v):v);
const br=await chromium.launch();
const ctx=await br.newContext({viewport:{width:1440,height:900},deviceScaleFactor:2});
const p=await ctx.newPage();
/* PRESIDENT: scaffolding gone, Home defensible */
await p.goto(`${O}/index.html`,{waitUntil:'networkidle'});
const home=await p.evaluate(()=>document.body.innerText.replace(/\s+/g,' '));
R('PRES · "BEAT nn" scaffolding on Home', (home.match(/BEAT \d/gi)||[]).length);
R('PRES · section labels kept', await p.evaluate(()=>[...document.querySelectorAll('main .k')].map(x=>x.textContent.trim()).join(' · ')));
/* CEO: CarePro zero in context; BizMtaani followable; index representative */
R('CEO · Home names the gate beside the zero', /alongside a four-stage verification process ending in clinical sign-off/.test(home));
R('CEO · zero still visible', /0 approved for assignments/.test(home));
R('CEO · no invented cause for the zero', !/because|therefore|as a result|which is why/i.test(home.slice(home.indexOf('20 nurses'), home.indexOf('20 nurses')+320)));
await p.locator('a[href="record-bizmtaani.html"]').first().scrollIntoViewIfNeeded();
R('CEO · BizMtaani followable from Home register', await p.locator('a[href="record-bizmtaani.html"]').count());
await p.goto(`${O}/capabilities.html`,{waitUntil:'networkidle'});
const caps=await p.evaluate(()=>({
  idx:[...document.querySelectorAll('.capidx em')].map(e=>e.textContent.trim()),
  detail:[...document.querySelectorAll('.cap__e')].map(e=>e.textContent.trim())}));
R('CEO · index semantics', caps.idx[0]);
R('CEO · detail remains exhaustive', caps.detail[0]);
R('CEO · index says "Evidenced by" (must be 0)', caps.idx.filter(x=>/Evidenced by/.test(x)).length);
/* CTO: Aerial strength, engineering claim */
await p.goto(`${O}/record-aerial.html`,{waitUntil:'networkidle'});
const ae=await p.evaluate(()=>document.body.innerText.replace(/\s+/g,' '));
R('CTO · Aerial states evidence strength', /Evidence strength Structural/.test(ae));
R('CTO · Aerial qualifier', /the simulation source exists; nothing was measured/i.test(ae));
R('CTO · Aerial still imageless', await p.locator('main img').count());
R('CTO · "Nothing has been flown." still prominent', await p.locator('h2', {hasText:'Nothing has been flown'}).count());
/* every record now states a strength — the Engineering universal claim */
const strengths={};
for (const f of ['record-carepro.html','record-sentinelcore.html','record-bizmtaani.html','record-aerial.html']) {
  await p.goto(`${O}/${f}`,{waitUntil:'networkidle'});
  const t=await p.evaluate(()=>document.body.innerText);
  strengths[f.replace('record-','').replace('.html','')]=(t.match(/(Measured|Published|Structural)/)||['—'])[0];
}
R('CTO · every record states a strength', JSON.stringify(strengths));
await br.close();
