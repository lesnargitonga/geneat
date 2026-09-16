import { chromium } from 'playwright';
import fs from 'fs';
/* Verify the Home signature's SOURCE FACT: does BizMtaani still publish the
   five actions and the three roles in its own navigation? READ-ONLY. */
const br = await chromium.launch();
const ctx = await br.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.goto('https://bizmtaani.com/', { waitUntil: 'networkidle', timeout: 45000 });
await p.waitForTimeout(2000);
const t = await p.evaluate(() => document.body.innerText.replace(/\n{2,}/g,'\n').trim());
console.log('─── FULL VISIBLE TEXT, bizmtaani.com ───');
console.log(t);
console.log('─── links ───');
console.log((await p.evaluate(() => [...document.querySelectorAll('a')].map(a => `${a.textContent.trim()} → ${a.getAttribute('href')}`).filter(x=>x.length>3))).join('\n'));
const roles = ['customer','merchant','shop','rider','vendor','seller','buyer'];
const found = roles.filter(r => new RegExp(r,'i').test(t));
console.log('\nrole words present in visible text:', found.length ? found.join(', ') : 'NONE');
await p.screenshot({ path: 'evidence/originals/bizmtaani-home-1440.png', fullPage: true });
await br.close();
