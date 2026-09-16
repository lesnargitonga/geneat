import { chromium } from 'playwright';
/* READ-ONLY. No sign-up, no order, no form submission, no state change. */
const br=await chromium.launch();
const S=[['carepro','https://carepro.co.ke/'],['bizmtaani','https://bizmtaani.com/'],
         ['jamii','https://jamii.lesnarai.co.ke/'],['geneat','https://geneat.lesnarai.co.ke/'],
         ['hazina','https://hazina.lesnarai.co.ke/']];
for (const [id,url] of S){
  const ctx=await br.newContext({viewport:{width:1440,height:900}});
  const p=await ctx.newPage();
  try{ await p.goto(url,{waitUntil:'networkidle',timeout:40000}); }catch(e){ console.log(id,'timeout'); await ctx.close(); continue; }
  const links=await p.evaluate(()=>[...new Set([...document.querySelectorAll('a[href]')]
    .map(a=>a.getAttribute('href'))
    .filter(h=>h&&h.startsWith('/')&&!/login|signin|sign-in|register|account|admin|apply|cart|checkout|logout/i.test(h)))]
    .slice(0,14));
  console.log(`${id.padEnd(10)} ${links.join(' ')}`);
  await ctx.close();
}
await br.close();
