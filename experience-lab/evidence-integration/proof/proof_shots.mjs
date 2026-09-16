import { chromium } from 'playwright';
const br=await chromium.launch();
for (const [tag,vp,dark] of [['1440-light',{width:1440,height:900},false],
                             ['1440-dark',{width:1440,height:900},true],
                             ['1024-light',{width:1024,height:768},false],
                             ['390-dark',{width:390,height:844},true]]) {
  const ctx=await br.newContext({viewport:vp,deviceScaleFactor:2,colorScheme:dark?'dark':'light'});
  const p=await ctx.newPage();
  await p.goto('http://127.0.0.1:8783/record-carepro.html',{waitUntil:'networkidle'});
  const ev=p.locator('.ev'); await ev.scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
  await ev.screenshot({path:`evidence/web/_proof-carepro-${tag}.png`});
  const m=await p.evaluate(()=>{const i=document.querySelector('.ev__fig img');
    const r=i.getBoundingClientRect(); return {w:Math.round(r.width),f:getComputedStyle(i).filter};});
  console.log(`carepro evidence ${tag.padEnd(12)} image ${String(m.w).padStart(4)}px  filter:${m.f}`);
  await ctx.close();
}
// SentinelCore measured block
for (const [tag,vp] of [['1440',{width:1440,height:900}],['390',{width:390,height:844}]]) {
  const ctx=await br.newContext({viewport:vp,deviceScaleFactor:2});
  const p=await ctx.newPage();
  await p.goto('http://127.0.0.1:8783/record-sentinelcore.html',{waitUntil:'networkidle'});
  const s=p.locator('section:has-text("The suite, run and recorded")').first();
  await s.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  await s.screenshot({path:`evidence/web/_proof-sentinel-${tag}.png`});
  console.log(`sentinel measured block ${tag} captured`);
  await ctx.close();
}
await br.close();
