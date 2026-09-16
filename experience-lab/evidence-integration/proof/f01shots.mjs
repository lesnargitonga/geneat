import { chromium } from 'playwright';
const br=await chromium.launch();
for (const [w,dark,tag] of [[390,false,'390-light'],[390,true,'390-dark'],[320,false,'320-light']]) {
  const ctx=await br.newContext({viewport:{width:w,height:900},deviceScaleFactor:2,colorScheme:dark?'dark':'light'});
  const p=await ctx.newPage();
  await p.goto('http://127.0.0.1:8783/index.html',{waitUntil:'networkidle'});
  const op=p.locator('.op'); await op.scrollIntoViewIfNeeded();
  for (let i=1;i<=3;i++){
    await p.locator('.ctl button',{hasText:/^Next$/}).click(); await p.waitForTimeout(430);
    if(i<=3) await op.screenshot({path:`../executive-review/evidence/f01-${tag}-${i}.png`});
  }
  await ctx.close();
}
await br.close();
