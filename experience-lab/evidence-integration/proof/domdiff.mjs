import { chromium } from 'playwright';
/* FREEZE TEST, done on the document rather than on pixels. With scripting off,
   what does Phase 8 add to, remove from, or change in the Phase 7 page? */
const br = await chromium.launch();
async function dom(port) {
  const ctx = await br.newContext({ javaScriptEnabled: false });
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  const d = await p.evaluate(() => {
    const walk = el => [...el.querySelectorAll('*')].map(n =>
      n.tagName.toLowerCase() + (n.className && typeof n.className === 'string' ? '.' + n.className.trim().replace(/\s+/g, '.') : ''));
    return {
      nodes: walk(document.body),
      text: document.body.innerText.replace(/\s+/g, ' ').trim(),
    };
  });
  await ctx.close();
  return d;
}
const A = await dom(8782), B = await dom(8781);
const ca = {}, cb = {};
A.nodes.forEach(n => ca[n] = (ca[n] || 0) + 1);
B.nodes.forEach(n => cb[n] = (cb[n] || 0) + 1);
const keys = [...new Set([...Object.keys(ca), ...Object.keys(cb)])].sort();
const added = [], removed = [];
keys.forEach(k => { const d = (cb[k] || 0) - (ca[k] || 0); if (d > 0) added.push(`+${d} ${k}`); if (d < 0) removed.push(`${d} ${k}`); });
console.log('nodes  phase7', A.nodes.length, ' phase8 no-script', B.nodes.length);
console.log('ADDED   :', added.length ? added.join('  ') : 'none');
console.log('REMOVED :', removed.length ? removed.join('  ') : 'none');
/* text delta */
const wa = A.text.split(' '), wb = B.text.split(' ');
const setA = new Set(wa);
const newWords = wb.filter(w => !setA.has(w));
console.log('text length', A.text.length, '→', B.text.length, `(+${B.text.length - A.text.length})`);
const i = [...B.text].findIndex((c, n) => c !== A.text[n]);
console.log('first textual divergence at char', i);
console.log('  phase7:', JSON.stringify(A.text.slice(i - 40, i + 130)));
console.log('  phase8:', JSON.stringify(B.text.slice(i - 40, i + 130)));
await br.close();
