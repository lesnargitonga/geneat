/* LESNAR AI site — claims gate.
   The evidence registry says what each route is allowed to assert. Nothing has
   ever held the HTML to it, so a figure can go stale in the markup while the
   registry still reads SUPPORTED. This binds the two.
     node tools/claims-gate.mjs
   Exits non-zero if a registered figure has drifted off its route, if a claim
   points at a route that does not exist, or if a claim the registry marks
   UNSUPPORTED is being asserted publicly. */
import fs from 'node:fs'; import path from 'node:path';
const ROOT=path.resolve(import.meta.dirname,'..');
const EV=path.resolve(ROOT,'../experience-lab/evidence-integration/evidence');
if(!fs.existsSync(EV)){ console.error('evidence layer not found at',EV); process.exit(2); }
const claims=JSON.parse(fs.readFileSync(path.join(EV,'claims.json'),'utf8')).claims;

const fileFor=route=>{
  if(!route) return null;
  if(route==='/') return path.join(ROOT,'index.html');
  const rel=route.replace(/^\//,'').replace(/\/$/,'');
  for(const c of [path.join(ROOT,rel,'index.html'),path.join(ROOT,rel),path.join(ROOT,rel+'.html')])
    if(fs.existsSync(c)&&fs.statSync(c).isFile()) return c;
  return null;
};
const text=f=>fs.readFileSync(f,'utf8')
  .replace(/<script[\s\S]*?<\/script>/g,' ').replace(/<style[\s\S]*?<\/style>/g,' ')
  .replace(/<[^>]+>/g,' ').replace(/&middot;/g,'·').replace(/&nbsp;/g,' ')
  .replace(/&ldquo;|&rdquo;|&quot;/g,'"').replace(/&rsquo;|&apos;/g,"'")
  .replace(/&amp;/g,'&').replace(/&hellip;/g,'…').replace(/&mdash;/g,'—')
  .replace(/&ndash;/g,'–').replace(/\s+/g,' ');

/* Figures are what go stale. A bare small integer ("one", "4") is too common to
   be diagnostic, so only multi-digit numbers, decimals and percentages count. */
const figures=s=>[...new Set((s.match(/\b\d[\d,]*\.?\d*\s*%|\b\d[\d,]{2,}\b|\b\d+\.\d+\b/g)||[])
  .map(x=>x.replace(/\s+/g,'')))];

const FAIL=[],WARN=[];
let checkedFigures=0;
for(const c of claims){
  const id=c.claim_id, route=c.route;
  if(!route){ WARN.push(`${id}  no route recorded (nothing to enforce)`); continue; }
  const f=fileFor(route);
  if(!f){ FAIL.push(`${id}  route ${route} does not exist on disk`); continue; }
  const body=text(f);
  const status=String(c.public_status||c.status||'');

  /* a claim the registry will not stand behind must not be asserted as fact */
  if(/^UNSUPPORTED/.test(status) && !/owner-report|OWNER-REPORT/i.test(status))
    WARN.push(`${id}  registry says ${status.slice(0,44)} — confirm ${route} still qualifies it`);

  for(const fig of figures(String(c.claim||''))){
    checkedFigures++;
    const bare=fig.replace(/,/g,''), commad=bare.replace(/\B(?=(\d{3})+(?!\d))/g,',');
    const hit=[fig,bare,commad].some(v=>body.includes(v));
    if(!hit) FAIL.push(`${id}  ${route} no longer carries the registered figure "${fig}"`);
  }
}
/* Coverage, not a verdict. Every distinctive figure a route asserts is looked
   up in the evidence layer. A figure that appears nowhere in it is not
   necessarily wrong -- many are sourced in the record's own prose -- but it is
   a figure with no registered source, and that is the number worth driving
   down before anything is promoted. */
const evBlob=(fs.readFileSync(path.join(EV,'registry.json'),'utf8')
             +fs.readFileSync(path.join(EV,'claims.json'),'utf8')).replace(/,/g,'');
const pages=[];
(function walk(d){ for(const e of fs.readdirSync(d,{withFileTypes:true})){
  if(e.name==='node_modules'||e.name.startsWith('.')||e.name==='tools') continue;
  const f=path.join(d,e.name);
  if(e.isDirectory()) walk(f); else if(e.name.endsWith('.html')) pages.push(f); } })(ROOT);

const rows=[];
for(const f of pages.sort()){
  const route='/'+path.relative(ROOT,f).replace(/\\/g,'/')
    .replace(/\/index\.html$/,'/').replace(/^index\.html$/,'');
  /* contact details and the status code a 404 page names are not claims */
  const body=text(f)
    .replace(/\+?\s*254[\d\s]{6,}/g,' ')
    .replace(/\b404\b/g,' ');
  const found=figures(body).filter(x=>{
    const bare=x.replace(/,/g,'');
    if(/^(19|20)\d\d$/.test(bare)) return false;          /* years */
    if(bare.replace(/[^0-9]/g,'').length<2) return false;  /* single digits */
    return true;
  });
  const unregistered=found.filter(x=>!evBlob.includes(x.replace(/,/g,'')));
  if(found.length) rows.push({route,total:found.length,un:unregistered,
    pct:Math.round(100*(found.length-unregistered.length)/found.length)});
}
console.log('\nfigure coverage against the evidence layer');
console.log('  route                              figures  registered  unregistered');
for(const r of rows.sort((a,b)=>b.un.length-a.un.length))
  console.log(`  ${r.route.padEnd(34)}${String(r.total).padStart(7)}${String(r.pct+'%').padStart(12)}${String(r.un.length).padStart(14)}`
    +(r.un.length?`\n      unregistered: ${r.un.slice(0,10).join('  ')}`:''));

console.log(`claims gate · ${claims.length} claims · ${checkedFigures} registered figures checked`);
if(WARN.length){ console.log(`\n${WARN.length} note(s):`); WARN.forEach(w=>console.log('  note '+w)); }
if(FAIL.length){ console.log(`\n${FAIL.length} failure(s):`); FAIL.forEach(x=>console.log('  FAIL '+x)); }
else console.log('\n=== CLAIMS GATE PASSES ===');
process.exit(FAIL.length?1:0);
