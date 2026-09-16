import { chromium } from 'playwright';
const br = await chromium.launch();
for (const [tag,o] of [
  ['1440-dark',{vp:{width:1440,height:950},dark:true}],
  ['390-dark', {vp:{width:390,height:844},dark:true}],
  ['390-light',{vp:{width:390,height:844}}],
  ['rm-1440',  {vp:{width:1440,height:950},reduced:true}],
]) {
  const ctx = await br.newContext({viewport:o.vp,deviceScaleFactor:2,
    colorScheme:o.dark?'dark':'light', reducedMotion:o.reduced?'reduce':'no-preference'});
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8781/index.html',{waitUntil:'networkidle'});
  await p.locator('.op').scrollIntoViewIfNeeded();
  for (let i=0;i<2;i++){ await p.locator('.ctl button',{hasText:/^Next$/}).click(); await p.waitForTimeout(o.reduced?80:430); }
  console.log(tag, '· position', await p.locator('.ctl__pos').textContent(),
    '· parted boundaries', await p.locator('.bound[data-live]').count(),
    '· held rows', await p.locator('.step[data-own="held"]').count());
  await p.locator('.op').screenshot({path:`frames/Y-cross-${tag}.png`});
  await ctx.close();
}
await br.close();
