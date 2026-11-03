const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1440,height:900}});const pg=await ctx.newPage();
const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()=='error')errs.push(m.text())});
const url='file://'+path.resolve('dist/asir-council-site.html');
await pg.goto(url);await pg.waitForTimeout(800);
await pg.screenshot({path:'tests/out/v17_home.png',fullPage:false});
// header on directory at scroll 0
await pg.goto(url+'#/directory');await pg.waitForTimeout(600);
console.log('dir solid:',await pg.$eval('#top',e=>e.classList.contains('solid')));
console.log('fGov opts:',await pg.$eval('#fGov',e=>e.options.length),'sort:',await pg.$eval('#fSort',e=>e.value));
await pg.selectOption('#fGov','بيشة');await pg.waitForTimeout(300);
console.log('after gov select:',await pg.$eval('#govLabel',e=>e.textContent));
await pg.selectOption('#fSort','y');await pg.waitForTimeout(200);
console.log('first item:',await pg.$eval('#list .as b',e=>e.textContent));
await pg.screenshot({path:'tests/out/v17_dir.png'});
await pg.goto(url+'#/association/'+await pg.$eval('#list .as',e=>e.dataset.id));await pg.waitForTimeout(400);
// go to association via list click
await pg.goto(url+'#/directory');await pg.waitForTimeout(400);await pg.click('#list .as');await pg.waitForTimeout(500);
console.log('after assoc click hash:',await pg.evaluate(()=>location.hash),'solid:',await pg.$eval('#top',e=>e.classList.contains('solid')));
// gaps: contact lines hidden when empty
await pg.goto(url+'#/contact');await pg.waitForTimeout(400);
console.log('phone hidden:',await pg.$eval('[data-gap-wrap=phone].cline',e=>e.hidden),'email text:',await pg.$eval('#contact [data-gap=email]',e=>e.textContent));
// admin: login then gaps
await pg.evaluate(()=>go('admin'));await pg.waitForTimeout(500);console.log('adminRoot len',await pg.$eval('#adminRoot',e=>e.innerHTML.length));
await pg.click('#admGo');await pg.waitForTimeout(500);
console.log('gaps alert on home:',await pg.evaluate(()=>!!document.body.textContent.includes('معلومات ناقصة في الموقع')));
await pg.evaluate(()=>goMod('gaps'));await pg.waitForTimeout(400);
await pg.screenshot({path:'tests/out/v17_gaps.png',fullPage:true});
await pg.fill('[data-gk=phone]','0172345678');await pg.press('[data-gk=phone]','Tab');await pg.waitForTimeout(300);
await pg.fill('[data-gk=term2]','12 محرم 1446هـ');await pg.press('[data-gk=term2]','Tab');await pg.waitForTimeout(300);
console.log('open after:',await pg.$eval('.gcount',e=>e.textContent));
await pg.evaluate(()=>goMod('board'));await pg.waitForTimeout(300);
console.log('board panel has gaps:',await pg.$$eval('.panel.gaps',l=>l.length));
await pg.goto(url+'#/about');await pg.waitForTimeout(500);
console.log('term2 on site:',await pg.$eval('[data-gap=term2]',e=>e.textContent),'wrap hidden:',await pg.$eval('[data-gap-wrap=term2]',e=>e.hidden));
console.log('gapmark:',await pg.evaluate(()=>document.body.classList.contains('gapmark')));
await pg.screenshot({path:'tests/out/v17_about_mark.png'});
await pg.goto(url+'#/contact');await pg.waitForTimeout(400);
console.log('phone href:',await pg.$eval('[data-gap-wrap=phone].cline',e=>e.getAttribute('href')+' hidden='+e.hidden));
// persistence
await pg.reload();await pg.waitForTimeout(600);console.log('persist phone:',await pg.$eval('#contact [data-gap=phone]',e=>e.textContent));
await pg.evaluate(()=>localStorage.removeItem('asirGaps'));
// mobile
const m=await b.newPage({viewport:{width:390,height:844}});m.on('pageerror',e=>errs.push('M '+e.message));
await m.goto(url);await m.waitForTimeout(800);await m.screenshot({path:'tests/out/v17_m_home.png',fullPage:true});
await m.goto(url+'#/directory');await m.waitForTimeout(600);console.log('mobile list items:',await m.$$eval('#list .as',l=>l.length),'more:',await m.$('#more')!==null);
console.log('ERRORS:',errs);await b.close()})();
