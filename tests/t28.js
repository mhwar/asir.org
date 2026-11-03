const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1440,height:900},acceptDownloads:true})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+path.resolve('dist/asir-council-site.html'));await p.waitForTimeout(500);
await p.evaluate(()=>{localStorage.clear();go('admin')});await p.click('#admGo');
await p.addStyleTag({content:'.toast,#toast{display:none!important}'});await p.evaluate(()=>goMod('reports'));await p.waitForTimeout(300);
for(const id of ['dir','dec','cov','govone','supone','exp','soon','qual','cons','pbetween']){const [d]=await Promise.all([p.waitForEvent('download',{timeout:8000}),p.click(`[data-rx="${id}"]`)]);await d.saveAs('tests/out/rep_'+id+'.xlsx');console.log('ok',id)}
await p.screenshot({path:'tests/out/rep.png',fullPage:true});await p.evaluate(()=>goMod('partners'));await p.click('[data-vv=cards]');await p.waitForTimeout(200);await p.screenshot({path:'tests/out/pt_cards.png'});
await p.click('[data-pt=between]');await p.click('[data-vv=list]');await p.waitForTimeout(200);await p.screenshot({path:'tests/out/pt_list.png'});
await p.click('#apNew');await p.waitForTimeout(200);await p.fill('#apQ','ابتسامة');await p.waitForTimeout(200);await p.click('#apRes [data-add]');await p.fill('#apQ','الأخلاقيات');await p.waitForTimeout(200);await p.click('#apRes [data-add]');
await p.fill('[name=t]','حملة توعية صحية مشتركة');await p.fill('[name=from]','2026-11-10');await p.waitForTimeout(200);await (await p.$('#adrawer')).screenshot({path:'tests/out/pt_form.png'});
await p.click('#apSave');await p.waitForTimeout(400);console.log('apart',await p.evaluate(()=>[APART.length,APART[0].t,APART[0].ids.length,APART[0].from]));
await p.click('tr[data-ap]');await p.waitForTimeout(300);await (await p.$('#adrawer')).screenshot({path:'tests/out/pt_view.png'});
console.log('errs',errs);await p.evaluate(()=>localStorage.clear());await b.close()})();
