/* LESNAR AI site — static gate. No browser: structure, links, metadata.
   node tools/static-gate.mjs     Exits non-zero on any failure. */
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const ROOT=path.resolve(import.meta.dirname,'..');
const files=[];
(function walk(d){ for(const e of fs.readdirSync(d,{withFileTypes:true})){
  if(e.name==='node_modules'||e.name.startsWith('.')) continue;
  const f=path.join(d,e.name);
  if(e.isDirectory()) walk(f); else if(e.name.endsWith('.html')) files.push(f); } })(ROOT);

const routeOf=f=>{ const r='/'+path.relative(ROOT,f).replace(/\\/g,'/');
  return r.replace(/\/index\.html$/,'/').replace(/^\/index\.html$/,'/'); };
const FAIL=[]; const fail=(f,m)=>FAIL.push(`${routeOf(f)}  ${m}`);

/* cleanUrls: /a/b resolves to a/b/index.html or a/b.html */
const resolves=href=>{
  const clean=href.split('#')[0].split('?')[0];
  if(!clean||clean==='/') return fs.existsSync(path.join(ROOT,'index.html'));
  const rel=clean.replace(/^\//,'');
  return fs.existsSync(path.join(ROOT,rel))
      || fs.existsSync(path.join(ROOT,rel,'index.html'))
      || fs.existsSync(path.join(ROOT,rel.replace(/\/$/,'')+'.html'));
};

const pages=files.filter(f=>path.basename(f)!=='home-candidate.html');
for(const f of pages){
  const s=fs.readFileSync(f,'utf8');
  const route=routeOf(f);

  /* metadata */
  const titles=[...s.matchAll(/<title>([^<]*)<\/title>/g)].map(m=>m[1]);
  if(titles.length!==1) fail(f,`expected exactly one <title>, found ${titles.length}`);
  else if(!titles[0].trim()) fail(f,'empty <title>');
  const canon=s.match(/<link rel="canonical" href="([^"]+)"/);
  if(!canon) fail(f,'no canonical link');
  const desc=s.match(/<meta name="description" content="([^"]*)"/);
  if(!desc) fail(f,'no meta description');
  else if(desc[1].trim().length<50) fail(f,`meta description too short (${desc[1].trim().length} chars)`);
  if(!/<html lang="[a-z]{2}/.test(s)) fail(f,'no lang on <html>');

  /* A canonical may legitimately point elsewhere: /menu/ is the no-script
     fallback for the menu panel and is capabilities with the panel open, so
     it canonicalises to /capabilities/. What is never right is a canonical
     that points at a route which does not exist. */
  if(canon){
    const got=canon[1].replace(/^https?:\/\/[^/]+/,'')||'/';
    if(!resolves(got)) fail(f,`canonical points at a route that does not exist: ${got}`);
  }

  /* duplicate ids */
  const ids=[...s.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
  const dup=ids.filter((v,i)=>ids.indexOf(v)!==i);
  if(dup.length) fail(f,`duplicate id: ${[...new Set(dup)].join(', ')}`);

  /* images */
  for(const m of s.matchAll(/<img\b[^>]*>/g)){
    const tag=m[0];
    if(!/\salt=/.test(tag)) fail(f,`img without alt: ${tag.slice(0,70)}`);
    if(!/\swidth=/.test(tag)||!/\sheight=/.test(tag))
      fail(f,`img without explicit width/height (layout shift): ${(tag.match(/src="([^"]+)"/)||[,'?'])[1]}`);
    const src=(tag.match(/src="([^"]+)"/)||[])[1];
    if(src && src.startsWith('/') && !fs.existsSync(path.join(ROOT,src.replace(/^\//,''))))
      fail(f,`img src missing on disk: ${src}`);
  }

  /* Every <picture> needs its fallback <img>, and a heavy raster that is
     referenced without a webp alternative is weight nobody chose to spend. */
  for(const m of s.matchAll(/<picture>[\s\S]*?<\/picture>/g)){
    const imgs=(m[0].match(/<img\b/g)||[]).length;
    if(imgs!==1) fail(f,`<picture> holds ${imgs} <img> fallbacks, expected exactly 1`);
    if(m[0].includes('<picture>',1)) fail(f,'nested <picture>');
  }
  for(const m of s.matchAll(/<img\b[^>]*src="(\/[^"]+\.(?:jpg|jpeg|png))"[^>]*>/g)){
    const src=m[1], disk=path.join(ROOT,src.replace(/^\//,''));
    if(!fs.existsSync(disk)) continue;
    const kb=fs.statSync(disk).size/1024;
    if(kb<60) continue;
    const webp=src.replace(/\.(jpg|jpeg|png)$/,'.webp');
    if(!fs.existsSync(path.join(ROOT,webp.replace(/^\//,''))))
      fail(f,`${src} is ${kb.toFixed(0)}KB with no webp sibling`);
    else if(!s.includes(`srcset="${webp}"`))
      fail(f,`${src} is ${kb.toFixed(0)}KB and a webp exists, but nothing offers it`);
  }

  /* internal links */
  for(const m of s.matchAll(/<a\b[^>]*href="([^"]+)"/g)){
    const href=m[1];
    if(/^(https?:|mailto:|tel:|#)/.test(href)) continue;
    if(!resolves(href)) fail(f,`dead internal link: ${href}`);
  }

  /* stylesheet and script refs */
  for(const m of s.matchAll(/(?:href|src)="(\/[^"]+\.(?:css|js|json|svg|png|jpg|webp))"/g))
    if(!fs.existsSync(path.join(ROOT,m[1].replace(/^\//,'')))) fail(f,`missing asset: ${m[1]}`);

  /* heading order: no level skipped on the way down */
  const hs=[...s.matchAll(/<h([1-6])\b/g)].map(m=>+m[1]);
  if(hs.length){
    if(hs[0]!==1) fail(f,`first heading is h${hs[0]}, not h1`);
    const h1s=hs.filter(h=>h===1).length;
    if(h1s!==1) fail(f,`expected exactly one h1, found ${h1s}`);
    for(let i=1;i<hs.length;i++)
      if(hs[i]>hs[i-1]+1){ fail(f,`heading order skips h${hs[i-1]} -> h${hs[i]}`); break; }
  } else fail(f,'no headings at all');

  /* one main landmark */
  const mains=(s.match(/<main\b/g)||[]).length;
  if(mains!==1) fail(f,`expected exactly one <main>, found ${mains}`);
}

/* sitemap covers the public routes */
const sm=path.join(ROOT,'sitemap.xml');
if(fs.existsSync(sm)){
  const xml=fs.readFileSync(sm,'utf8');
  const listed=new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map(m=>m[1].replace(/^https?:\/\/[^/]+/,'')||'/'));
  const publicRoutes=pages.map(routeOf)
    .filter(r=>r!=='/404.html'&&r!=='/menu/');
  for(const r of publicRoutes) if(!listed.has(r)) FAIL.push(`sitemap.xml  missing route ${r}`);
  for(const l of listed) if(!resolves(l)) FAIL.push(`sitemap.xml  lists dead route ${l}`);
} else FAIL.push('sitemap.xml  absent');

/* The CSP pins every inline script by hash. If the theme bootstrap is ever
   edited, the hash stops matching and the script is silently blocked in
   production while every local check still passes. The gate owns that link. */
const vjPath=path.join(ROOT,'vercel.json');
if(fs.existsSync(vjPath)){
  const v=JSON.parse(fs.readFileSync(vjPath,'utf8'));
  const csp=(v.headers||[]).flatMap(b=>b.headers||[])
    .find(h=>h.key.toLowerCase()==='content-security-policy');
  if(csp){
    const pinned=new Set([...csp.value.matchAll(/'sha256-([A-Za-z0-9+/=]+)'/g)].map(m=>m[1]));
    const seen=new Set();
    for(const f of pages){
      const s=fs.readFileSync(f,'utf8');
      for(const m of s.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)){
        const h=crypto.createHash('sha256').update(m[1]).digest('base64');
        seen.add(h);
        if(!pinned.has(h)) fail(f,`inline script is not pinned in the CSP (sha256-${h})`);
      }
    }
    for(const h of pinned)
      if(!seen.has(h)) FAIL.push(`vercel.json  CSP pins sha256-${h} but no page carries that script`);
    for(const need of ["default-src","script-src","style-src","frame-ancestors","base-uri","object-src"])
      if(!csp.value.includes(need)) FAIL.push(`vercel.json  CSP has no ${need} directive`);
  } else FAIL.push('vercel.json  no Content-Security-Policy header');
  const keys=new Set((v.headers||[]).flatMap(b=>b.headers||[]).map(h=>h.key.toLowerCase()));
  for(const h of ['strict-transport-security','x-content-type-options','x-frame-options',
                  'referrer-policy','permissions-policy'])
    if(!keys.has(h)) FAIL.push(`vercel.json  missing security header: ${h}`);
}

/* vercel redirects must land somewhere real */
const vj=path.join(ROOT,'vercel.json');
if(fs.existsSync(vj)){
  const v=JSON.parse(fs.readFileSync(vj,'utf8'));
  for(const r of v.redirects||[])
    if(r.destination && r.destination.startsWith('/') && !resolves(r.destination))
      FAIL.push(`vercel.json  redirect ${r.source} -> ${r.destination} (destination does not exist)`);
}

console.log(`static gate · ${pages.length} pages`);
if(FAIL.length){ console.log(`\n${FAIL.length} failure(s):`); FAIL.forEach(x=>console.log('  FAIL '+x)); }
else console.log('\n=== STATIC GATE PASSES ===');
process.exit(FAIL.length?1:0);
