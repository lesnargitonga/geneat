import { chromium } from 'playwright';
const br = await chromium.launch();
const ctx = await br.newContext({ viewport: { width: 1440, height: 1000 } });
const p = await ctx.newPage();
await p.goto('https://carepro.co.ke/', { waitUntil: 'networkidle', timeout: 45000 });
await p.waitForTimeout(1800);
const r = await p.evaluate(() => {
  const out = [];
  document.querySelectorAll('section,div').forEach(el => {
    const t = (el.innerText||'').replace(/\s+/g,' ').trim();
    const b = el.getBoundingClientRect();
    if (/Nurses joined CarePro/.test(t) && t.length < 260)
      out.push({ kind:'counts', tag:el.tagName, cls:(el.className||'').toString().slice(0,60), len:t.length, h:Math.round(b.height), txt:t.slice(0,150) });
    if (/Credentials/.test(t) && /Clinical sign/.test(t) && t.length < 900)
      out.push({ kind:'verify', tag:el.tagName, cls:(el.className||'').toString().slice(0,60), len:t.length, h:Math.round(b.height), txt:t.slice(0,90) });
  });
  return out.slice(0, 8);
});
r.forEach(x => console.log(`${x.kind.padEnd(7)} ${x.tag} .${x.cls} len=${x.len} h=${x.h}px  ${x.txt}`));
await br.close();
