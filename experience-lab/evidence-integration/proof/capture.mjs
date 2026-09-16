import { chromium } from 'playwright';
import fs from 'fs'; import crypto from 'crypto';
/* PHASE 9 · public-surface capture. STRICTLY READ-ONLY:
   no sign-ups, no form submission, no ordering, no payment, no writes.
   Navigation and screenshots only.                                          */
const TARGETS = [
  ['carepro',   'https://carepro.co.ke/'],
  ['bizmtaani', 'https://bizmtaani.com/'],
  ['jamii',     'https://jamii.lesnarai.co.ke/'],
  ['geneat',    'https://geneat.lesnarai.co.ke/'],
  ['hazina',    'https://hazina.lesnarai.co.ke/'],
];
const br = await chromium.launch();
const out = [];
for (const [id, url] of TARGETS) {
  const ctx = await br.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  let status = null;
  try {
    const r = await p.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    status = r && r.status();
  } catch (e) { out.push({ id, url, error: String(e).slice(0,90) }); await ctx.close(); continue; }
  await p.waitForTimeout(1500);
  const path = `evidence/originals/${id}-home-1440.png`;
  await p.screenshot({ path, fullPage: false });
  const buf = fs.readFileSync(path);
  const info = await p.evaluate(() => ({
    title: document.title,
    h1: [...document.querySelectorAll('h1')].map(h => h.textContent.trim()).slice(0,3),
    nav: [...document.querySelectorAll('nav a, header a')].map(a => a.textContent.trim()).filter(Boolean).slice(0,14),
    words: document.body.innerText.replace(/\s+/g,' ').trim().length,
    forms: document.querySelectorAll('form').length,
  }));
  out.push({ id, url, status, ...info, errs: errs.length,
             sha256: crypto.createHash('sha256').update(buf).digest('hex').slice(0,16),
             bytes: buf.length });
  await ctx.close();
}
fs.writeFileSync('evidence/originals/_capture-meta.json', JSON.stringify(out, null, 1));
for (const o of out) console.log(
  `${(o.id||'').padEnd(10)} ${String(o.status||o.error).padEnd(6)} text=${String(o.words||'-').padEnd(6)} "${(o.title||'').slice(0,54)}"\n   nav: ${(o.nav||[]).join(' · ').slice(0,150)}`);
await br.close();
