/* LESNAR AI site — claims gate.
   The evidence layer decides what each route may assert. This binds the chain
   explicitly and refuses to accept a looser reading of it:

     route -> claim_id -> evidence_ids -> evidence object -> source artifact

   A figure is registered for a route only when it appears in an evidence object
   bound to a claim ON THAT ROUTE. The same number existing somewhere else in
   registry.json is a coincidence, not a source.

     node tools/claims-gate.mjs            gate + coverage
     node tools/claims-gate.mjs --contract print the full chain per route

   Exits non-zero on a broken chain, a dangling reference, a route that does not
   exist, or a figure the published claim carries that the page no longer does.
   A conclusion drawn from internal-only evidence is a note, not a failure: the
   conclusion may be public, the detail must not be. */
import fs from 'node:fs'; import path from 'node:path';

const ROOT=path.resolve(import.meta.dirname,'..');
const EV=path.resolve(ROOT,'../experience-lab/evidence-integration/evidence');
if(!fs.existsSync(EV)){ console.error('evidence layer not found at',EV); process.exit(2); }
const claims=JSON.parse(fs.readFileSync(path.join(EV,'claims.json'),'utf8')).claims;
const evRaw=JSON.parse(fs.readFileSync(path.join(EV,'registry.json'),'utf8')).evidence;
const evList=Array.isArray(evRaw)?evRaw:Object.values(evRaw);
const byId=new Map(evList.map(e=>[e.evidence_id,e]));
const CONTRACT=process.argv.includes('--contract');

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
  .replace(/<[^>]+>/g,' ')
  .replace(/&middot;/g,'·').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&')
  .replace(/&ldquo;|&rdquo;|&quot;/g,'"').replace(/&rsquo;|&apos;/g,"'")
  .replace(/&hellip;/g,'…').replace(/&mdash;/g,'—').replace(/&ndash;/g,'–')
  /* numeric entities decode to characters, not to their own digits */
  .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(+n))
  .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCharCode(parseInt(n,16)))
  .replace(/\s+/g,' ');

/* Figures are what go stale and what carry weight. Single digits and bare years
   are too common to be diagnostic. Contact details and a 404 page naming its own
   status code are not claims. */
const strip=s=>s.replace(/\+?\s*254[\d\s]{6,}/g,' ').replace(/\b404\b/g,' ')
  /* identifiers label a thing; they do not measure it */
  .replace(/\b(?:sprint|version|v|phase|commit|issue|no\.?)\s*#?\d[\d.]*/gi,' ')
  /* dates are when, not how much: ISO dates, day-month pairs, and the
     zero-padded ordinals of a numbered list (01 Credentials, 02 Registry) */
  .replace(/\b\d{4}-\d{2}-\d{2}\b/g,' ')
  .replace(/\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/gi,' ')
  .replace(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}\b/gi,' ')
  .replace(/\b0\d\b/g,' ');
const figures=s=>[...new Set((s.match(/\b\d[\d,]*\.?\d*\s*%|\b\d[\d,]{1,}\b|\b\d+\.\d+\b/g)||[])
  .map(x=>x.replace(/\s+/g,'')))]
  .filter(x=>{ const bare=x.replace(/,/g,'');
    if(/^(19|20)\d\d$/.test(bare)) return false;
    /* two digits is enough to be diagnostic once years and identifiers are
       filtered out; requiring three let a stale "19 nurses joined" through */
    return bare.replace(/[^0-9]/g,'').length>=2; });
const norm=x=>x.replace(/,/g,'');

const FAIL=[],WARN=[],DETAIL=[];

/* ── referential integrity of the chain itself ───────────────────────────── */
const claimIds=new Set(claims.map(c=>c.claim_id));
for(const c of claims){
  for(const id of c.evidence_ids||[])
    if(!byId.has(id)) FAIL.push(`${c.claim_id}  cites evidence ${id}, which is not in registry.json`);
  if(!(c.evidence_ids||[]).length && !/NOT ON THE SITE/i.test(String(c.public_status||'')))
    WARN.push(`${c.claim_id}  is published with no evidence object cited`);
}
for(const e of evList)
  for(const id of e.claim_ids||[])
    if(!claimIds.has(id)) FAIL.push(`${e.evidence_id}  cites claim ${id}, which is not in claims.json`);

/* ── per route: the claims that belong to it and the evidence behind them ── */
const routes=new Map();
for(const c of claims){
  if(!c.route) continue;
  if(!routes.has(c.route)) routes.set(c.route,[]);
  routes.get(c.route).push(c);
}

let boundFigures=0;
for(const [route,rcs] of [...routes].sort()){
  const f=fileFor(route);
  if(!f){ FAIL.push(`route ${route} is claimed by ${rcs.map(c=>c.claim_id).join(', ')} but does not exist`); continue; }
  const body=strip(text(f));

  for(const c of rcs){
    const ev=(c.evidence_ids||[]).map(id=>byId.get(id)).filter(Boolean);

    /* a publicly asserted claim must not rest only on evidence marked
       internal-only: that is how confidential material leaks into copy */
    if(ev.length && ev.every(e=>e.public_safe===false))
      WARN.push(`${c.claim_id} on ${route} publishes a conclusion drawn only from internal-only evidence (${ev.map(e=>e.evidence_id).join(', ')}) — the conclusion may be public, the detail must not be`);

    /* What the page publishes is the claim, so the claim's own figures are
       binding. An evidence object's `shows` describes the artifact, which may
       carry detail the page never prints — reported, never enforced. */
    for(const fig of figures(strip(String(c.claim||'')))){
      boundFigures++;
      if(!body.includes(norm(fig)) && !body.includes(fig))
        FAIL.push(`${route}  ${c.claim_id}: the published claim carries "${fig}" but the page no longer does`);
    }
    for(const e of ev)
      for(const fig of figures(strip(String(e.shows||''))))
        if(!body.includes(norm(fig)) && !body.includes(fig))
          DETAIL.push(`${route}  ${e.evidence_id} records "${fig}"; the page does not print it (usually correct)`);
    const status=String(c.public_status||c.status||'');
    if(/^UNSUPPORTED/.test(status) && !/owner-report|openly labelled/i.test(status))
      WARN.push(`${c.claim_id}  registry says ${status.slice(0,48)} — confirm ${route} still qualifies it`);
  }
}

/* ── coverage: a figure counts only against its own route's evidence ─────── */
const pages=[];
(function walk(d){ for(const e of fs.readdirSync(d,{withFileTypes:true})){
  if(e.name==='node_modules'||e.name.startsWith('.')||e.name==='tools') continue;
  const p=path.join(d,e.name);
  if(e.isDirectory()) walk(p); else if(e.name.endsWith('.html')) pages.push(p); } })(ROOT);

const rows=[];
for(const f of pages.sort()){
  const route='/'+path.relative(ROOT,f).replace(/\\/g,'/')
    .replace(/\/index\.html$/,'/').replace(/^index\.html$/,'');
  /* a page that canonicalises elsewhere is that page: /menu/ is capabilities
     with the panel open, so it answers to the same claims */
  const raw=fs.readFileSync(f,'utf8');
  const canon=(raw.match(/<link rel="canonical" href="([^"]+)"/)||[])[1];
  const owner=canon?(canon.replace(/^https?:\/\/[^/]+/,'')||'/'):route;
  const rcs=routes.get(route)||routes.get(owner)||[];
  /* the evidence this route is actually entitled to cite */
  const pool=new Set();
  for(const c of rcs){
    pool.add(strip(String(c.claim||'')));
    for(const id of c.evidence_ids||[]){
      const e=byId.get(id); if(!e) continue;
      pool.add([e.shows,e.does_not_show,e.limitations,e.source_location].filter(Boolean).join(' '));
    }
  }
  const poolText=norm([...pool].join(' '));
  const found=figures(strip(text(f)));
  if(!found.length) continue;
  const un=found.filter(x=>!poolText.includes(norm(x)));
  rows.push({route,total:found.length,un,claims:rcs.length,
             pct:Math.round(100*(found.length-un.length)/found.length)});
}

if(CONTRACT){
  console.log('evidence contract · route -> claim -> evidence -> source\n');
  for(const [route,rcs] of [...routes].sort()){
    console.log(`── ${route}`);
    for(const c of rcs){
      console.log(`   ${c.claim_id}  [${c.public_status||c.status}]`);
      console.log(`      claim: ${String(c.claim).slice(0,96)}`);
      const ev=(c.evidence_ids||[]).map(id=>byId.get(id)).filter(Boolean);
      if(!ev.length) console.log('      evidence: NONE CITED');
      for(const e of ev){
        console.log(`      ${e.evidence_id} · ${e.evidence_strength} · ${e.source_type} · public_safe=${e.public_safe}`);
        console.log(`         source:  ${e.source_location}  (captured ${e.captured_at})`);
        console.log(`         shows:   ${String(e.shows).slice(0,110)}`);
        console.log(`         not:     ${String(e.does_not_show).slice(0,110)}`);
      }
    }
    console.log('');
  }
}

console.log(`claims gate · ${claims.length} claims · ${evList.length} evidence objects · ${boundFigures} bound figures checked`);
console.log('\nfigure coverage — a figure counts only against evidence bound to its own route');
console.log('  route                              claims  figures  sourced  unsourced');
for(const r of rows.sort((a,b)=>b.un.length-a.un.length||a.route.localeCompare(b.route))){
  console.log(`  ${r.route.padEnd(34)}${String(r.claims).padStart(6)}${String(r.total).padStart(9)}${String(r.pct+'%').padStart(9)}${String(r.un.length).padStart(11)}`);
  if(r.un.length) console.log(`      unsourced: ${r.un.slice(0,12).join('  ')}`);
}
if(process.env.VERBOSE&&DETAIL.length){ console.log(`\n${DETAIL.length} artifact detail(s) not printed on the page:`);
  DETAIL.forEach(d=>console.log('  · '+d)); }
if(WARN.length){ console.log(`\n${WARN.length} note(s):`); WARN.forEach(w=>console.log('  note '+w)); }
if(FAIL.length){ console.log(`\n${FAIL.length} failure(s):`); FAIL.forEach(x=>console.log('  FAIL '+x)); }
else console.log('\n=== CLAIMS GATE PASSES ===');
process.exit(FAIL.length?1:0);
