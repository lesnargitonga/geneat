import { chromium } from 'playwright';
/* CarePro full live record. READ-ONLY: no sign-up, no booking, no submission.
   Verifying the Phase 7 evidence caption: "19 nurses joined, 0 approved". */
const br = await chromium.launch();
const ctx = await br.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.goto('https://carepro.co.ke/', { waitUntil: 'networkidle', timeout: 45000 });
await p.waitForTimeout(2000);
const t = await p.evaluate(() => document.body.innerText.replace(/\n{2,}/g,'\n').trim());
console.log('─── carepro.co.ke visible text ───');
console.log(t.slice(0, 2600));
console.log('\n─── numbers published on the page ───');
console.log((t.match(/\b\d[\d,]*\s*(?:nurses?|approved|joined|verified|families|patients|counties|bookings?)\b/gi) || ['none']).join(' | '));
console.log('\n─── public routes ───');
console.log((await p.evaluate(() => [...new Set([...document.querySelectorAll('a')].map(a => a.getAttribute('href')).filter(h => h && h.startsWith('/')))].slice(0,22))).join(' '));
await br.close();
