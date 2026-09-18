import { chromium } from 'playwright';
const O='http://127.0.0.1:8899';
const br=await chromium.launch();
const ctx=await br.newContext({viewport:{width:1440,height:900}});
const p=await ctx.newPage();

console.log('=== HEADER BEHAVIOUR ON SCROLL ===');
await p.goto(O+'/',{waitUntil:'networkidle'});
const h=await p.evaluate(()=>{const e=document.querySelector('.site-head');const cs=getComputedStyle(e);
  return {position:cs.position,top:cs.top,zIndex:cs.zIndex};});
console.log('  .site-head position:',JSON.stringify(h));
await p.evaluate(()=>window.scrollTo(0,1500)); await p.waitForTimeout(500);
const after=await p.evaluate(()=>{const r=document.querySelector('.site-head').getBoundingClientRect();
  return {top:Math.round(r.top),visible:r.bottom>0};});
console.log('  after scrolling 1500px → header top:',after.top,'· still on screen:',after.visible);
console.log('  VERDICT:', after.visible?'sticky':'scrolls away with the page');

console.log('\n=== BACK NAVIGATION ON RECORDS ===');
for (const r of ['/work/carepro/','/work/gen-eat/','/work/sensing-and-radar/']){
  await p.goto(O+r,{waitUntil:'networkidle'});
  const b=await p.evaluate(()=>{const a=document.querySelector('.parent a');
    return a?{text:a.textContent.trim(),href:a.getAttribute('href')}:null;});
  console.log(`  ${r.padEnd(28)}`, b?`"${b.text}" → ${b.href}`:'NO BACK LINK');
}

console.log('\n=== WHAT ACTUALLY MOVES ===');
await p.goto(O+'/',{waitUntil:'networkidle'});
const motion=await p.evaluate(()=>{
  const out={};
  const check=(sel,label)=>{const e=document.querySelector(sel); if(!e)return out[label]='(absent)';
    const cs=getComputedStyle(e); out[label]=cs.transitionProperty+' '+cs.transitionDuration;};
  check('.site-nav a','nav link');
  check('.act','forward link');
  check('.reg__row','register row');
  check('.theme button','theme button');
  check('.step','handoff step');
  check('.bound','handoff boundary');
  check('.head-r .menu','menu button');
  out.anyKeyframes=[...document.styleSheets].some(s=>{try{return [...s.cssRules].some(r=>r.type===7)}catch(e){return false}});
  return out;});
for (const [k,v] of Object.entries(motion)) console.log(`  ${k.padEnd(18)} ${v}`);

console.log('\n=== EVERY PAGE: DOES IT SHOW WHAT IT SHOULD? ===');
const routes=['/','/work/','/capabilities/','/engineering/','/company/','/start/',
 '/work/carepro/','/work/bizmtaani/','/work/jamii-projects-hub/','/work/gen-eat/',
 '/work/hazina-nomads/','/work/greenhouse-controller/','/work/sentinelcore/','/work/cypher/',
 '/work/gold-trader/','/work/aerial-systems/','/work/sensing-and-radar/','/404.html'];
for (const r of routes){
  await p.goto(O+r,{waitUntil:'networkidle'});
  const d=await p.evaluate(()=>({h1:(document.querySelector('h1')||{}).textContent||'(none)',
    sections:document.querySelectorAll('main section').length,
    words:document.body.innerText.trim().split(/\s+/).length,
    links:document.querySelectorAll('main a').length}));
  console.log(`  ${r.padEnd(32)} h1:"${d.h1.slice(0,34)}" sections:${String(d.sections).padStart(2)} words:${String(d.words).padStart(4)} links:${d.links}`);
}
await br.close();
