import { chromium } from 'playwright';
const O='http://127.0.0.1:8783';
const R=(k,v)=>console.log(('· '+k).padEnd(50), typeof v==='object'?JSON.stringify(v):v);
const br=await chromium.launch();
/* BizMtaani record structure + reachability from Work */
{
  const ctx=await br.newContext({viewport:{width:1440,height:900}});
  const p=await ctx.newPage();
  p.on('pageerror',e=>R('!! JS ERROR',e.message));
  await p.goto(`${O}/work.html`,{waitUntil:'networkidle'});
  await p.locator('a[href="record-bizmtaani.html"]').first().click();
  await p.waitForLoadState('networkidle');
  R('reachable from Work · landed on', (await p.url()).split('/').pop());
  const h=await p.evaluate(()=>[...document.querySelectorAll('main h1,main h2,main h3')].map(x=>x.tagName+':'+x.textContent.trim().slice(0,42)));
  R('h1 count', h.filter(x=>x.startsWith('H1')).length);
  let prev=1, skip=[];
  h.forEach(x=>{const l=+x[1]; if(l>prev+1) skip.push(x); prev=l;});
  R('heading skips', skip.length?skip.join(' | '):0);
  R('headings', h.join('  '));
  R('images on the record (expect 0)', await p.locator('main img').count());
  /* evidence / limit adjacency: every .limit must follow content in the same section */
  const adj=await p.evaluate(()=>[...document.querySelectorAll('main .limit')].map(l=>({
    label:l.querySelector('b').textContent.trim(),
    prevTag:l.previousElementSibling?l.previousElementSibling.tagName:'(section start)'})));
  R('limits and what precedes them', adj.map(a=>`${a.label}←${a.prevTag}`).join(' | '));
  R('maturity and evidence-strength rows', await p.evaluate(()=>
    [...document.querySelectorAll('.rows b')].map(b=>b.textContent.trim()).join(' · ')));
  /* scale-implication scan on the new record */
  const t=await p.evaluate(()=>document.body.innerText);
  const bad=['many merchants','traction','thousands','customers use','growing','at scale','adoption'];
  R('scale implications (must be 0)', bad.filter(b=>new RegExp(b,'i').test(t)).join(',')||0);
  R('states Live is maturity not scale', /Live is how far the system has got, not how much it carries/.test(t));
  await ctx.close();
}
/* mobile + dark */
for (const [w,dark,tag] of [[390,false,'390'],[1440,true,'dark']]) {
  const ctx=await br.newContext({viewport:{width:w,height:900},deviceScaleFactor:2,colorScheme:dark?'dark':'light'});
  const p=await ctx.newPage();
  await p.goto(`${O}/record-bizmtaani.html`,{waitUntil:'networkidle'});
  const ox=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  R(`bizmtaani ${tag} · horizontal overflow`, ox);
  await p.screenshot({path:`../executive-review/evidence/f04-bizmtaani-${tag}.png`,fullPage:false});
  await ctx.close();
}
/* Engineering claim must match the registry exactly */
{
  const ctx=await br.newContext({viewport:{width:1440,height:900}});
  const p=await ctx.newPage();
  await p.goto(`${O}/engineering.html`,{waitUntil:'networkidle'});
  const t=await p.evaluate(()=>document.body.innerText.replace(/\s+/g,' '));
  R('eng · no universal db/service claim', !/own service, database and domain|their own database/.test(t));
  R('eng · states the two documented', /Gen-Eat and Hazina additionally have documented dedicated service and data-store separation/.test(t));
  R('eng · carries the gap as a limit', /has not been independently documented for every live system/.test(t));
  await ctx.close();
}
await br.close();
