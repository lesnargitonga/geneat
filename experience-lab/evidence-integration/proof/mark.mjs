import { chromium } from 'playwright';
const br = await chromium.launch();
{
  const ctx = await br.newContext({viewport:{width:1440,height:900},deviceScaleFactor:2});
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8781/work.html',{waitUntil:'networkidle'});
  const reg = p.locator('.reg').first();
  await reg.scrollIntoViewIfNeeded();
  await p.locator('.reg__row').nth(1).hover(); await p.waitForTimeout(220);
  await reg.screenshot({path:'frames/R-0-hover.png'});
  await p.evaluate(()=>{document.querySelectorAll('.reg__row')[1].focus()});
  await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Tab');
  await p.waitForTimeout(220);
  await reg.screenshot({path:'frames/R-1-focus.png'});
  await ctx.close();
}
{
  const ctx = await br.newContext({viewport:{width:1440,height:900},deviceScaleFactor:2});
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8781/capabilities.html',{waitUntil:'networkidle'});
  await p.locator('.capidx a').nth(3).click(); await p.waitForTimeout(450);
  await p.locator('.cap:target').screenshot({path:'frames/C-0-target.png'});
  const n = await p.locator('.cap:target').count();
  console.log('capability marked after jump:', n, '· url', (await p.url()).split('#')[1]);
  await ctx.close();
}
await br.close();
