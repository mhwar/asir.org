const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+require('path').resolve('dist/asir-council-site.html')+'#/directory');await p.waitForTimeout(800);
for(const v of ['tiles','cards','table','stats']){await p.click(`#vtabs [data-v="${v}"]`);await p.waitForTimeout(200);await p.evaluate(()=>$('#vtabs').scrollIntoView());await p.waitForTimeout(150);await p.screenshot({path:`src/r/v_${v}.png`,fullPage:false})}
await p.click('#vtabs [data-v="tiles"]');await p.click('.gcd[data-g="الفرشة"]');await p.waitForTimeout(200);
console.log('sel',await p.evaluate(()=>selGov+' '+$('#altInfo').textContent));
await p.selectOption('#fGrp',{index:2});await p.waitForTimeout(200);await p.click('#vtabs [data-v="stats"]');await p.waitForTimeout(200);console.log(await p.evaluate(()=>$('#altInfo').textContent));
await p.evaluate(()=>{select(null);setTheme&&setTheme('light')});await p.click('#vtabs [data-v="cards"]');await p.waitForTimeout(200);await p.evaluate(()=>$('#vtabs').scrollIntoView());await p.screenshot({path:'tests/out/v_light.png'});
await p.click('#vtabs [data-v="map"]');await p.waitForTimeout(300);console.log('map visible',await p.evaluate(()=>!$('.mapgrid').hidden));
const m=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});m.on('pageerror',e=>errs.push('M:'+e.message));
await m.goto('file://'+require('path').resolve('dist/asir-council-site.html')+'#/directory');await m.waitForTimeout(700);await m.tap('#vtabs [data-v="tiles"]');await m.waitForTimeout(200);await m.evaluate(()=>$('#vtabs').scrollIntoView());await m.screenshot({path:'tests/out/vm_tiles.png'});
console.log(errs);await b.close()})();
