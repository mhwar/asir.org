const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const e=[];
for(const [mode,suf] of [['dark','d'],['light','l']]){
 const ctx=await b.newContext({viewport:{width:1440,height:900},colorScheme:mode});const p=await ctx.newPage();p.on('pageerror',x=>e.push(x.message));p.on('console',m=>{if(m.type()=='error'&&!m.text().includes('Failed to load'))e.push(m.text())});
 for(const r of ['','about','directory','consult','news','communities']){await p.goto('file://'+require('path').resolve('dist/asir-council-site.html')+'#/'+r);await p.waitForTimeout(r==''?1800:900);await p.addStyleTag({content:'.reveal{opacity:1!important;transform:none!important}'});await p.waitForTimeout(200);await p.screenshot({path:`src/r/th_${suf}_${r||'home'}.png`,fullPage:true})}
 console.log(mode,await p.evaluate(()=>[document.documentElement.dataset.theme,document.documentElement.dataset.pref,THEME]));
 await ctx.close()}
// toggle test
const ctx=await b.newContext({viewport:{width:1440,height:900},colorScheme:'light'});const p=await ctx.newPage();await p.goto('file://'+require('path').resolve('dist/asir-council-site.html')+'#/directory');await p.waitForTimeout(800);
await p.click('#thBtn');await p.click('#thm [data-p="dark"]');await p.waitForTimeout(300);console.log('after toggle',await p.evaluate(()=>[document.documentElement.dataset.theme,THEME,document.body.classList.contains('maplight')]));
await p.reload();await p.waitForTimeout(600);console.log('persist',await p.evaluate(()=>document.documentElement.dataset.theme));
await p.evaluate(()=>go('admin'));await p.click('#admGo');await p.waitForTimeout(300);await p.screenshot({path:'tests/out/th_admin_dark.png'});
const m=await b.newContext({viewport:{width:390,height:844},isMobile:true,colorScheme:'dark'});const mp=await m.newPage();await mp.goto('file://'+require('path').resolve('dist/asir-council-site.html')+'#/');await mp.waitForTimeout(1500);await mp.addStyleTag({content:'.reveal{opacity:1!important;transform:none!important}'});await mp.screenshot({path:'tests/out/th_m.png',fullPage:true});
console.log(e);await b.close()})();
