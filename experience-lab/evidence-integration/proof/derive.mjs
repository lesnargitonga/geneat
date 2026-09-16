import { chromium } from 'playwright';
import fs from 'fs'; import crypto from 'crypto';
/* Web derivatives. Crop to the application's own edge — no device frames, no
   perspective, no compositing, no invented content. READ-ONLY throughout. */
const br = await chromium.launch();
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const rec = [];

async function grab(id, url, sel, label) {
  const ctx = await br.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  await p.waitForTimeout(1800);
  const el = sel ? p.locator(sel).first() : null;
  const path = `evidence/web/${id}.png`;
  if (el && await el.count()) { await el.screenshot({ path }); }
  else { await p.screenshot({ path }); }
  const txt = el && await el.count() ? (await el.innerText()).replace(/\s+/g,' ').trim() : '';
  rec.push({ id, url, label, sel: sel || '(viewport)', sha256: sha(path),
             bytes: fs.statSync(path).size, visible_text: txt.slice(0, 420) });
  console.log(`${id.padEnd(30)} ${String(fs.statSync(path).size).padStart(8)}B  ${txt.slice(0,80)}`);
  await ctx.close();
}

/* CarePro: the published verification sequence, and the published counters */
await grab('carepro-verification-2026-09-16', 'https://carepro.co.ke/',
  'div.rounded-3xl:has-text("WHAT “VERIFIED” ACTUALLY MEANS")',
  'CarePro published verification sequence');
await grab('carepro-counts-2026-09-16', 'https://carepro.co.ke/',
  'div.grid.grid-cols-2:has-text("Nurses joined CarePro")', 'CarePro published counters');
/* BizMtaani: the published roles and flow behind the Home signature */
await grab('bizmtaani-roles-2026-09-16', 'https://bizmtaani.com/',
  'footer', 'BizMtaani published role structure');
await grab('bizmtaani-hero-2026-09-16', 'https://bizmtaani.com/',
  'header, .hero, main > :first-child', 'BizMtaani published flow statement');
fs.writeFileSync('evidence/web/_derivatives.json', JSON.stringify(rec, null, 1));
await br.close();
