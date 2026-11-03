const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});
await p.goto('file://'+require('path').resolve('dist/asir-council-site.html')+'#/');await p.waitForTimeout(900);
const t=await p.evaluate(()=>{const s=document.body.innerText;return ['البرك','الفرشة','الأمواه'].map(g=>g+':'+(s.split(g).length-1))});console.log('home text',t);
await p.evaluate(()=>{const e=document.querySelector('#homeMap,.hmap,[id*=home][id*=map]');e&&e.scrollIntoView()});await p.waitForTimeout(500);await p.screenshot({path:'tests/out/h_map.png'});
await p.goto('file://'+require('path').resolve('dist/asir-council-site.html')+'#/directory');await p.waitForTimeout(900);await p.evaluate(()=>$('#mapbox').scrollIntoView());await p.waitForTimeout(400);await p.screenshot({path:'tests/out/d_map.png'});
console.log(await p.evaluate(()=>$('#xgov').innerText));
await b.close()})();
