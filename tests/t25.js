const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+path.resolve('dist/asir-council-site.html'));await p.waitForTimeout(500);
await p.evaluate(()=>{localStorage.clear();go('admin')});await p.click('#admGo');await p.waitForTimeout(300);
const mods=await p.evaluate(()=>MODS.map(m=>m[0]));const bad=[];
for(const m of mods){await p.evaluate(x=>goMod(x),m);await p.waitForTimeout(150);const ok=await p.evaluate(()=>document.querySelector('#acontent').innerHTML.length);if(ok<50)bad.push(m)}
console.log('mods',mods.length,'empty',bad,'errs',errs);
await p.evaluate(()=>goMod('bysup'));await p.click('.segr:nth-child(3)');await p.waitForTimeout(300);await p.screenshot({path:'tests/out/a_bysup.png',fullPage:true});
await p.evaluate(()=>goMod('bygov'));await p.waitForTimeout(200);await p.screenshot({path:'tests/out/a_bygov.png',fullPage:true});
await p.click('.segr:nth-child(1)');await p.waitForTimeout(300);await p.screenshot({path:'tests/out/a_bygov2.png',fullPage:true});
await p.evaluate(()=>goMod('partners'));await p.waitForTimeout(200);await p.screenshot({path:'tests/out/a_part.png',fullPage:true});
await p.click('[data-pt=between]');await p.waitForTimeout(200);await p.screenshot({path:'tests/out/a_part2.png',fullPage:true});
await p.evaluate(()=>goMod('projects'));await p.waitForTimeout(200);await p.screenshot({path:'tests/out/a_proj.png',fullPage:true});
await p.evaluate(()=>goMod('apps'));await p.waitForTimeout(200);await p.screenshot({path:'tests/out/a_apps.png',fullPage:true});
await p.evaluate(()=>goMod('launch'));await p.waitForTimeout(200);await p.screenshot({path:'tests/out/a_launch.png',fullPage:true});
// partner toggle reflects on site
await p.evaluate(()=>goMod('partners'));await p.click('[data-pt=council]');await p.click('[data-ps="0"]');await p.waitForTimeout(200);
console.log('strip count',await p.evaluate(()=>document.querySelectorAll('#ptiles em').length));
// launch close hides group
await p.evaluate(()=>{window.__noConfirm=1;goMod('launch')});await p.click('#lOff');await p.waitForTimeout(300);
console.log('launch hidden',await p.evaluate(()=>!document.querySelector('.jrail .jr.tmp')),'mod',await p.evaluate(()=>ADM.mod));
console.log('errs',errs);await p.evaluate(()=>localStorage.clear());await b.close()})();
