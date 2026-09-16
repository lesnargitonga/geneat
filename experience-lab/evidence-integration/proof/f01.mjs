import { chromium } from 'playwright';
const br=await chromium.launch();
for (const w of [320,360,390,820,1440]) {
  const ctx=await br.newContext({viewport:{width:w,height:900}});
  const p=await ctx.newPage();
  await p.goto('http://127.0.0.1:8783/index.html',{waitUntil:'networkidle'});
  await p.locator('.op').scrollIntoViewIfNeeded();
  await p.locator('.ctl button',{hasText:/^Next$/}).click(); await p.waitForTimeout(430);
  const m=await p.evaluate(()=>{
    const s=document.querySelector('.op .step');
    const span=s.querySelector('span'), own=s.querySelector('.own'), b=s.querySelector('b');
    const R=e=>e?e.getBoundingClientRect():null;
    const rs=R(s), ra=R(span), ro=R(own), rb=R(b);
    return {row:Math.round(rs.width), act:Math.round(ra.width), actH:Math.round(ra.height),
            ownTop:ro?Math.round(ro.top-rs.top):null, actTop:Math.round(ra.top-rs.top),
            bTop:Math.round(rb.top-rs.top),
            sameLine: ro? Math.abs(ro.top-ra.top)<6 : null,
            domOrder:[...s.children].map(x=>x.tagName.toLowerCase()).join('>')};
  });
  const lines=Math.round(m.actH/22);
  console.log(`${String(w).padStart(5)}px  row ${String(m.row).padStart(4)} · action ${String(m.act).padStart(4)}px (${Math.round(100*m.act/m.row)}%) ~${lines} line(s) · own on same line as action: ${m.sameLine} · dom ${m.domOrder}`);
  await ctx.close();
}
await br.close();
