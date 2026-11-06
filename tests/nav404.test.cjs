// v0.64: unknown routes show a 404 page; Escape closes nav menus and syncs aria-expanded; consult links to pro
const {chromium}=require('playwright');
const BASE=process.env.BASE||'http://localhost:8788';
let ok=0,bad=0;const t=(n,c)=>{c?ok++:(bad++,console.log('FAIL',n))};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:800}});
await p.goto(BASE+'/#/');await p.waitForTimeout(800);
await p.click('.ndt >> nth=2');
t('menu opens',await p.$eval('.ndt >> nth=2',e=>e.getAttribute('aria-expanded'))==='true');
await p.click('.ndt >> nth=0');
const ex=await p.$$eval('.ndt',a=>a.map(e=>e.getAttribute('aria-expanded')));
t('only one menu open',ex.filter(x=>x==='true').length===1);
await p.mouse.move(5,300);await p.click('.ndt >> nth=1');await p.hover('.ndt >> nth=2');await p.waitForTimeout(400);
const vis=await p.$$eval('.ndm',a=>a.filter(e=>{const c=getComputedStyle(e);return c.visibility!=='hidden'&&+c.opacity>0.5}).length);
t('click one + hover another shows a single menu ('+vis+')',vis===1);
await p.keyboard.press('Escape');
const ex2=await p.$$eval('.ndt',a=>a.map(e=>e.getAttribute('aria-expanded')));
t('escape closes and syncs aria',ex2.every(x=>x==='false'));
for(const r of ['contact','found','portal']){await p.goto(BASE+'/#/'+r);await p.waitForTimeout(500);t(r+' is not 404',!(await p.$eval('.page[data-page=nf]',e=>e.classList.contains('on'))))}
await p.goto(BASE+'/#/xyz-missing');await p.waitForTimeout(500);
t('unknown route -> 404',await p.$eval('.page[data-page=nf]',e=>e.classList.contains('on')));
t('404 title',(await p.title()).includes('غير موجودة'));
await p.click('.page[data-page=nf] a.btn.p');await p.waitForTimeout(500);
t('404 back to home',await p.$eval('.page[data-page=home]',e=>e.classList.contains('on')));
await p.goto(BASE+'/#/consult');await p.waitForTimeout(500);
t('consult has link to pro',await p.$$eval('.page[data-page=consult] a[href="#/pro"]',a=>a.length)>0);
console.log(ok+' passed, '+bad+' failed');await b.close();process.exit(bad?1:0)})();
