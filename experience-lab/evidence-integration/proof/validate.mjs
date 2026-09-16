import { chromium } from 'playwright';
const O='http://127.0.0.1:8783';
const R=(k,v)=>console.log(('· '+k).padEnd(54), typeof v==='object'?JSON.stringify(v):v);
const PAGES=['index.html','work.html','capabilities.html','engineering.html','company.html',
             'start.html','record-carepro.html','record-sentinelcore.html','record-bizmtaani.html','record-aerial.html','menu-open.html'];
const PRODUCT=/carepro\.co\.ke|bizmtaani\.com|jamii\.|geneat\.|hazina\.|api\.lesnarai/;
const br=await chromium.launch();

/* console errors, product-origin calls, broken images, alt text, overflow */
let errs=0, prod=[], broken=[], noalt=[], overflow=[];
for (const vp of [{width:1440,height:900},{width:1024,height:768},{width:390,height:844}]) {
  for (const f of PAGES) {
    const ctx=await br.newContext({viewport:vp,deviceScaleFactor:1});
    const p=await ctx.newPage();
    p.on('pageerror',e=>{errs++;R('!! JS ERROR '+f,e.message);});
    p.on('console',m=>{if(m.type()==='error'){errs++;R('!! CONSOLE '+f,m.text().slice(0,90));}});
    p.on('request',r=>{ if(PRODUCT.test(r.url())) prod.push(`${f} → ${r.url().slice(0,60)}`); });
    await p.goto(`${O}/${f}`,{waitUntil:'networkidle'});
    const d=await p.evaluate(()=>({
      imgs:[...document.images].map(i=>({src:i.getAttribute('src'),ok:i.complete&&i.naturalWidth>0,
            alt:i.getAttribute('alt')||'',w:i.naturalWidth})),
      ox: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    d.imgs.forEach(i=>{ if(!i.ok) broken.push(`${f}:${i.src}`);
      if(i.alt.trim().length<25) noalt.push(`${f}:${i.src} alt="${i.alt}"`); });
    if (d.ox>1) overflow.push(`${f}@${vp.width} +${d.ox}px`);
    await ctx.close();
  }
}
R('console / page errors across 10 pages × 3 widths', errs);
R('network calls to product origins (must be 0)', prod.length ? prod.join(' | ') : 0);
R('broken images', broken.length ? [...new Set(broken)].join(' | ') : 0);
R('images with thin alt text', noalt.length ? [...new Set(noalt)].join(' | ') : 0);
R('horizontal overflow', overflow.length ? [...new Set(overflow)].join(' | ') : 0);

/* evidence image legibility at 390 + dark-mode honesty */
for (const dark of [false,true]) {
  const ctx=await br.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,
    colorScheme:dark?'dark':'light'});
  const p=await ctx.newPage();
  await p.goto(`${O}/record-carepro.html`,{waitUntil:'networkidle'});
  const im=p.locator('.ev__fig img');
  await im.scrollIntoViewIfNeeded();
  const m=await p.evaluate(()=>{const i=document.querySelector('.ev__fig img');
    const r=i.getBoundingClientRect(); const cs=getComputedStyle(i);
    return {w:Math.round(r.width),h:Math.round(r.height),filter:cs.filter,opacity:cs.opacity,
            mix:cs.mixBlendMode, natural:i.naturalWidth};});
  R(`evidence at 390px · ${dark?'dark':'light'}`,
    `rendered ${m.w}×${m.h} from ${m.natural}px source · filter:${m.filter} opacity:${m.opacity} blend:${m.mix}`);
  await p.screenshot({path:`evidence/web/_check-390-${dark?'dark':'light'}.png`, fullPage:false});
  await ctx.close();
}

/* Phase 8 regression: nothing about motion may have changed */
{
  const ctx=await br.newContext({viewport:{width:1440,height:950}});
  const p=await ctx.newPage();
  await p.goto(`${O}/index.html`,{waitUntil:'networkidle'});
  await p.locator('.op').scrollIntoViewIfNeeded();
  const seen=[];
  for(let i=1;i<=5;i++){ await p.locator('.ctl button',{hasText:/^Next$/}).click(); await p.waitForTimeout(430);
    seen.push(await p.evaluate(()=>{
      const held=[...document.querySelectorAll('.step[data-own="held"]')];
      return {a:[...new Set(held.map(s=>s.dataset.actor))].length,
              parted:document.querySelectorAll('.bound[data-live]').length};}));}
  const ok = seen.every(x=> (x.parted===1 ? x.a===0 : x.a===1));
  R('handoff semantics unchanged (actor invariant)', ok ? 'holds at all 5' : JSON.stringify(seen));
  await ctx.close();
}
{
  const ctx=await br.newContext({viewport:{width:390,height:844},javaScriptEnabled:false});
  const p=await ctx.newPage();
  await p.goto(`${O}/start.html`,{waitUntil:'networkidle'});
  R('JS-off: submit still disabled', await p.locator('.form__act button').isDisabled());
  R('JS-off: no dead controls', await p.locator('.ctl button').count());
  await ctx.close();
}
await br.close();
