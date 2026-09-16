import { chromium } from 'playwright';
import fs from 'fs';
/* FREEZE TEST · the page with nothing moving must be the page.
   Phase 7 (static) and Phase 8 at rest are captured at the same widths and
   compared pixel by pixel. Any difference must be a control that was
   deliberately added, not a change to the document. */
const br = await chromium.launch();
async function grab(port, w, nojs) {
  const ctx = await br.newContext({ viewport: { width: w, height: 900 }, javaScriptEnabled: !nojs });
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle' });
  await p.evaluate(() => new Promise(r => document.fonts.ready.then(r)));
  await p.waitForTimeout(400);
  const b = await p.screenshot({ fullPage: true });
  const h = await p.evaluate(() => document.documentElement.scrollHeight);
  await ctx.close();
  return { b, h };
}
for (const w of [1440, 390]) {
  const p7 = await grab(8782, w, false);
  const p8 = await grab(8781, w, false);
  const p8n = await grab(8781, w, true);
  fs.writeFileSync(`frames/FZ-${w}-phase7.png`, p7.b);
  fs.writeFileSync(`frames/FZ-${w}-phase8-rest.png`, p8.b);
  fs.writeFileSync(`frames/FZ-${w}-phase8-nojs.png`, p8n.b);
  console.log(`${w}px  page height — phase7 ${p7.h}  ·  phase8 at rest ${p8.h} (+${p8.h - p7.h})  ·  phase8 no-script ${p8n.h} (+${p8n.h - p7.h})`);
}
await br.close();
