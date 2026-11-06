// صفحة التشخيص المؤسسي المستقلة: يفتحها حامل الرابط (الجمعية أو الخبير الزائر) أو عضو الفريق من حسابه.
// خفيفة بلا مكتبات: تحفظ تلقائياً، وتعمل على الجوال، وتعرض تقريراً بعد الإرسال والاعتماد.
import { score, SCALE, LEVELS } from './diagtool.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safe = (o) => JSON.stringify(o).replace(/</g, '\\u003c').replace(new RegExp('\\u2028', 'g'), '\\u2028').replace(new RegExp('\\u2029', 'g'), '\\u2029');

export function diagPage(state, base) {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><meta name="theme-color" content="#13205B">
<title>${esc(state.tool.title)} — ${esc(state.association)}</title>
<link rel="preload" href="/fonts/AvenirArabic-Medium.woff2" as="font" type="font/woff2" crossorigin>
<style>${CSS}</style></head><body>
<a class="skip" href="#main">تخطي إلى المحتوى</a>
<header class="top"><div class="tw"><div class="brand"><b>مجلس الجمعيات الأهلية بمنطقة عسير</b><span>${esc(state.tool.title)}</span></div>
<div class="who"><b id="aName">${esc(state.association)}</b><span><span class="kb">${esc(state.kindLabel)}</span> · ${esc(state.gov || '')}</span></div></div>
<div class="prog" aria-hidden="true"><i id="progBar"></i></div></header>
<main id="main" tabindex="-1"><div id="app" class="wrap"><p class="loading">جارٍ التحميل…</p></div></main>
<div id="toast" role="status" aria-live="polite"></div>
<script>window.D=${safe(state)};window.BASE=${safe(base)};window.SCALE=${safe(SCALE)};window.LEVELS=${safe(LEVELS)};
${score.toString()}
${JS}</script></body></html>`;
}

const CSS = `
@font-face{font-family:AvA;src:url(/fonts/AvenirArabic-Medium.woff2) format("woff2");font-weight:400 600;font-display:swap}
@font-face{font-family:AvA;src:url(/fonts/AvenirArabic-Heavy.woff2) format("woff2");font-weight:700 900;font-display:swap}
:root{--hd:#13205B;--p:#1249FF;--p2:#E8EEFF;--ice:#F4F6FA;--line:#E3E7EF;--mute:#5B6478;--ok:#0E7C5A;--okb:#E6F6EF;--warn:#8A4B00;--warnb:#FFF4E0;--bad:#B42318;--badb:#FDECEA;--sf:#fff;--r:16px}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%;scroll-padding-top:96px;scroll-padding-bottom:90px}
body{margin:0;font-family:AvA,system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;background:var(--ice);color:var(--hd);font-size:16px;line-height:1.75}
.skip{position:absolute;inset-inline-start:8px;top:8px;background:var(--hd);color:#fff;padding:8px 14px;border-radius:10px;z-index:9;transform:translateY(-200%)}.skip:focus{transform:none}
:focus-visible{outline:3px solid var(--p);outline-offset:2px}
button,input,textarea,select{font:inherit;color:inherit}
.top{position:sticky;top:0;z-index:5;background:var(--hd);color:#fff;box-shadow:0 6px 24px -14px #13205B}
.tw{max-width:860px;margin:auto;padding:12px 18px;display:flex;justify-content:space-between;gap:14px;align-items:center}
.brand b{display:block;font-size:13px;opacity:.75;font-weight:500}.brand span{font-size:15px;font-weight:800}
.who{text-align:left;min-width:0}.who b{display:block;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:46vw}.who span{font-size:12.5px;opacity:.8}
.kb{background:#ffffff26;border-radius:999px;padding:1px 9px}
.prog{height:4px;background:#ffffff1f}.prog i{display:block;height:100%;width:0;background:linear-gradient(90deg,#5B8CFF,#9FE3C8);transition:width .4s}
.wrap{max-width:860px;margin:auto;padding:20px 16px 120px}
.loading{text-align:center;color:var(--mute);padding:60px 0}
h1{font-size:24px;line-height:1.45;margin:6px 0 8px;font-weight:800}h2{font-size:20px;margin:0 0 4px;font-weight:800}
.lead{color:var(--mute);margin:0 0 18px}
.card{background:var(--sf);border:1px solid var(--line);border-radius:var(--r);padding:18px;margin:0 0 14px}
.steps{display:flex;gap:6px;overflow-x:auto;padding:2px 2px 10px;margin:0 -2px 6px;scrollbar-width:thin}
.steps button{position:relative;flex:none;border:1px solid var(--line);background:var(--sf);border-radius:999px;padding:6px 12px;font-size:13px;cursor:pointer;display:flex;gap:6px;align-items:center}
.steps button[aria-current=step]{background:var(--hd);color:#fff;border-color:var(--hd)}
.steps .dot{width:8px;height:8px;border-radius:50%;background:var(--line)}.steps .dot.part{background:#F5A524}.steps .dot.full{background:#1FB37A}
.axh{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin:4px 0 14px}.axh small{color:var(--mute);display:block}
.cnt{flex:none;background:var(--p2);color:var(--p);border-radius:999px;padding:3px 10px;font-size:13px;font-weight:700}
fieldset.q{border:1px solid var(--line);background:var(--sf);border-radius:var(--r);padding:16px;margin:0 0 12px;min-width:0}
fieldset.q.done{border-color:#C9D6FF}
fieldset.q legend{float:right;width:100%;padding:0;font-weight:600;font-size:16px;margin-bottom:10px}
.qn{color:var(--mute);font-size:13px;font-weight:500;margin-inline-end:6px}
.opts{clear:both;display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.opts.na{grid-template-columns:repeat(5,1fr)}
.opts label{position:relative;cursor:pointer}
.opts input{position:absolute;opacity:0;inset:0;margin:0;cursor:pointer}
.opts span{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;min-height:58px;border:1.5px solid var(--line);border-radius:12px;padding:6px 4px;font-size:13px;line-height:1.35;background:var(--sf);transition:.15s}
.opts span b{font-size:17px;font-weight:800;line-height:1}
.opts label:hover span{border-color:#B7C6F5}
.opts input:focus-visible+span{outline:3px solid var(--p);outline-offset:2px}
.opts input:checked+span{border-color:var(--p);background:var(--p2);color:var(--p);font-weight:700;box-shadow:0 0 0 1px var(--p) inset}
.opts input[value="0"]:checked+span{border-color:var(--bad);background:var(--badb);color:var(--bad);box-shadow:0 0 0 1px var(--bad) inset}
.opts input[value="1"]:checked+span{border-color:#C77700;background:var(--warnb);color:var(--warn);box-shadow:0 0 0 1px #C77700 inset}
.opts input[value="3"]:checked+span{border-color:var(--ok);background:var(--okb);color:var(--ok);box-shadow:0 0 0 1px var(--ok) inset}
.qx{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin-top:10px;font-size:13.5px;color:var(--mute)}
.lnk{background:none;border:0;padding:4px 0;color:var(--p);cursor:pointer;font-weight:600;font-size:13.5px}
.ev{background:var(--ice);border-radius:8px;padding:2px 8px}
.src{background:#EEF7F2;color:var(--ok);border-radius:8px;padding:2px 8px}
textarea,input[type=text],input[type=date],select{width:100%;border:1px solid #D7DCE6;border-radius:12px;padding:11px 12px;background:var(--sf);font-size:15px}
textarea{min-height:84px;resize:vertical}
label.f{display:block;font-weight:600;font-size:14.5px;margin:0 0 12px}label.f>span{display:block;margin-bottom:6px}label.f small{display:block;color:var(--mute);font-weight:500}
.chk{display:flex;gap:10px;align-items:flex-start;font-size:14.5px;margin:6px 0 12px}.chk input{width:20px;height:20px;margin-top:4px;flex:none}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}
.nav{position:fixed;bottom:0;inset-inline:0;background:#ffffffee;backdrop-filter:blur(8px);border-top:1px solid var(--line);z-index:4;padding:10px 16px calc(10px + env(safe-area-inset-bottom))}
.nav .in{max-width:860px;margin:auto;display:flex;gap:10px;align-items:center}
.btn{border:0;border-radius:12px;padding:12px 20px;font-weight:700;font-size:15px;cursor:pointer;background:var(--hd);color:#fff;display:inline-flex;gap:8px;align-items:center;justify-content:center;text-decoration:none}
.btn.o{background:var(--sf);color:var(--hd);border:1.5px solid var(--line)}.btn.p{background:var(--p)}.btn:disabled{opacity:.5;cursor:not-allowed}
.sv{font-size:12.5px;color:var(--mute);margin-inline-start:auto;text-align:center}.sv.err{color:var(--bad)}
.rec{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px}
.rec .btn{padding:9px 14px;font-size:14px}.rec .live{color:var(--bad);font-weight:700;display:flex;gap:6px;align-items:center}.rec .live:before{content:"";width:10px;height:10px;border-radius:50%;background:var(--bad);animation:bl 1s infinite}
@keyframes bl{50%{opacity:.25}}
.files{list-style:none;padding:0;margin:10px 0 0;display:grid;gap:8px}
.files li{display:flex;gap:10px;align-items:center;background:var(--ice);border-radius:12px;padding:8px 10px;font-size:13.5px}
.files audio{height:34px;max-width:220px;flex:1}.files .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.note{background:var(--warnb);color:var(--warn);border-radius:12px;padding:10px 14px;margin:0 0 14px;font-size:14.5px}
.ok{background:var(--okb);color:var(--ok)}
.sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:0 0 14px}
.sum div{background:var(--sf);border:1px solid var(--line);border-radius:14px;padding:12px 14px}.sum small{display:block;color:var(--mute);font-size:13px}.sum b{font-size:24px;font-weight:800}
.lv{display:inline-block;border-radius:999px;padding:2px 12px;font-size:13.5px;font-weight:700}
.lv-ok{background:var(--okb);color:var(--ok)}.lv-info{background:var(--p2);color:var(--p)}.lv-warn{background:var(--warnb);color:var(--warn)}.lv-bad{background:var(--badb);color:var(--bad)}
.bars{display:grid;gap:9px}.bar{display:grid;grid-template-columns:150px 1fr 44px;gap:10px;align-items:center;font-size:14px}
.bar i{display:block;height:10px;border-radius:99px;background:var(--line);overflow:hidden}.bar i em{display:block;height:100%;border-radius:99px}
.bar b{text-align:left;font-weight:800}
.radar{display:block;margin:auto;max-width:420px;width:100%;height:auto}
.gap{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--line)}.gap:first-child{border:0}
.gap .tag{flex:none;border-radius:8px;padding:1px 8px;font-size:12px;font-weight:700}
.chips{display:flex;flex-wrap:wrap;gap:8px}.chips button{border:1.5px solid var(--line);background:var(--sf);border-radius:999px;padding:7px 14px;cursor:pointer;font-size:14px}
.chips button[aria-pressed=true]{border-color:var(--p);background:var(--p2);color:var(--p);font-weight:700}
.rv{display:grid;gap:8px}.rv button{display:flex;justify-content:space-between;width:100%;text-align:right;border:1px solid var(--line);background:var(--sf);border-radius:12px;padding:10px 14px;cursor:pointer;font-size:14.5px}
.rv .miss{color:var(--bad);font-weight:700}.rv .full{color:var(--ok);font-weight:700}
#toast{position:fixed;bottom:86px;inset-inline:0;margin:auto;width:max-content;max-width:90vw;background:var(--hd);color:#fff;border-radius:12px;padding:10px 16px;font-size:14px;opacity:0;transform:translateY(8px);transition:.25s;pointer-events:none;z-index:9}
#toast.on{opacity:1;transform:none}
.hero{background:linear-gradient(135deg,#13205B,#1F3A9E);color:#fff;border-radius:20px;padding:22px;margin:0 0 14px}
.hero p{opacity:.85;margin:6px 0 0}.hero ul{margin:12px 0 0;padding-inline-start:20px;opacity:.92}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
@media(max-width:620px){.opts,.opts.na{grid-template-columns:repeat(2,1fr)}.opts.na label:last-child{grid-column:span 2}.g2{grid-template-columns:1fr}.bar{grid-template-columns:110px 1fr 40px}h1{font-size:21px}.who b{max-width:40vw}}
@media print{.top{position:static}.nav,.steps,.skip,#toast,.noprint{display:none!important}body{background:#fff}.card,.sum div{break-inside:avoid}.wrap{padding:0}}
@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;

const JS = String.raw`
(function(){
const T=D.tool,AX=T.axes,ITEMS={},$=s=>document.querySelector(s),app=$('#app');
AX.forEach(a=>a.items.forEach((it,i)=>{ITEMS[it.id]=Object.assign({ax:a.id,n:i+1},it)}));
const team=D.who==='team',field=D.kind!=='self',visit=D.kind==='field';let editable=['draft','sent'].includes(D.status);
const A=D.answers||{},INFO=D.info||{};INFO.open=INFO.open||{};INFO.axisNotes=INFO.axisNotes||{};
let FILES=D.files||[],step=0,dirty=false,saving=false,timer=null;
// اقتراحات التعبئة المكتبية تملأ ما لم يُجب عنه فقط
if(D.prefill&&editable)for(const k in D.prefill)if(!A[k]||A[k].v==null){A[k]=D.prefill[k];dirty=true}
const LS='asirDiag:'+D.id;
try{const l=JSON.parse(localStorage.getItem(LS)||'null');if(l&&editable&&l.at>Date.parse(D.updated||0)&&l.a){Object.assign(A,l.a);if(l.i)Object.assign(INFO,l.i);dirty=true}}catch(e){}
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast=(t,bad)=>{const e=$('#toast');e.textContent=t;e.style.background=bad?'#B42318':'';e.classList.add('on');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('on'),2600)};
const STEPS=[{k:'intro',t:visit?'بيانات الزيارة':'البداية'}].concat(AX.map(a=>({k:a.id,t:a.t})),[{k:'open',t:'أسئلة ختامية'},{k:'review',t:'المراجعة والإرسال'}]);
const axDone=a=>a.items.filter(it=>A[it.id]&&A[it.id].v!=null).length;
const SC=()=>score(T,A);
function lvl(s){if(s==null)return null;return LEVELS.find(l=>s>=l[0])}
function progress(){const n=Object.keys(ITEMS).length,d=Object.keys(ITEMS).filter(k=>A[k]&&A[k].v!=null).length;$('#progBar').style.width=Math.round(d*100/n)+'%';return [d,n]}
// ─── الحفظ ───
function mark(){dirty=true;try{localStorage.setItem(LS,JSON.stringify({at:Date.now(),a:A,i:INFO}))}catch(e){}setSv('تغييرات غير محفوظة…');clearTimeout(timer);timer=setTimeout(save,900);progress();stepsBar()}
function setSv(t,err){const e=$('#sv');if(e){e.textContent=t;e.classList.toggle('err',!!err)}}
async function save(){if(!editable||!dirty||saving)return;saving=true;setSv('جارٍ الحفظ…');
 try{const r=await fetch(BASE,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({answers:A,info:INFO})});const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j.error&&j.error.message||'تعذّر الحفظ');dirty=false;try{localStorage.removeItem(LS)}catch(e){}setSv('محفوظ ✓')}
 catch(e){setSv('لم يُحفظ — نعيد المحاولة',1);clearTimeout(timer);timer=setTimeout(save,6000)}finally{saving=false}}
addEventListener('beforeunload',e=>{if(dirty&&editable){save();e.preventDefault();e.returnValue=''}});
addEventListener('online',()=>dirty&&save());
// ─── الشريط والتنقل ───
function stepsBar(){const e=$('#steps');if(!e)return;e.innerHTML=STEPS.map((s,i)=>{const a=AX.find(x=>x.id==s.k);let d='';if(a){const n=axDone(a);d='<span class="dot '+(n==a.items.length?'full':n?'part':'')+'" aria-hidden="true"></span>'}
 return '<button type="button" data-s="'+i+'"'+(i==step?' aria-current="step"':'')+'>'+d+esc(s.t)+(a?'<span class="sr"> ('+axDone(a)+' من '+a.items.length+')</span>':'')+'</button>'}).join('');
 e.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>go(+b.dataset.s));const c=e.querySelector('[aria-current]');c&&c.scrollIntoView({block:'nearest',inline:'center'})}
function go(i){save();step=Math.max(0,Math.min(STEPS.length-1,i));render();scrollTo({top:0,behavior:'smooth'});const h=app.querySelector('h1,h2');h&&h.focus({preventScroll:true})}
function navBar(){return '<div class="nav noprint"><div class="in">'+(step>0?'<button class="btn o" type="button" id="prev">السابق</button>':'')+'<span class="sv" id="sv" aria-live="polite">'+(dirty?'تغييرات غير محفوظة…':'محفوظ ✓')+'</span>'+(step<STEPS.length-1?'<button class="btn p" type="button" id="next">'+(step==0?'ابدأ':'التالي')+'</button>':'')+'</div></div>'}
// ─── الملفات والتسجيل ───
function fileList(axis){const L=FILES.filter(f=>(f.axis||null)==(axis||null));if(!L.length)return '';
 return '<ul class="files">'+L.map(f=>'<li>'+(f.kind=='audio'?'<audio controls preload="none" src="'+BASE+'/files/'+f.id+'" aria-label="'+esc(f.name)+'"></audio>':'<span class="nm">'+(f.kind=='image'?'صورة: ':'مستند: ')+'<a href="'+BASE+'/files/'+f.id+'" target="_blank" rel="noopener">'+esc(f.name)+'</a></span>')+(editable?'<button class="lnk" type="button" data-del="'+f.id+'" aria-label="حذف '+esc(f.name)+'">حذف</button>':'')+'</li>').join('')+'</ul>'}
function attachUI(axis){if(!editable)return fileList(axis);const canRec=!!(navigator.mediaDevices&&window.MediaRecorder);
 return '<div class="rec" data-ax="'+(axis||'')+'">'+(canRec?'<button class="btn o" type="button" data-rec>🎙️ تسجيل صوتي</button>':'')+'<label class="btn o" style="cursor:pointer">📎 إرفاق ملف<input type="file" accept="audio/*,image/*,application/pdf" data-up hidden></label><small style="color:var(--mute)">صوت حتى 25 ميجابايت، صورة أو PDF حتى 10</small></div>'+fileList(axis)}
async function upload(blob,name,axis){const fd=new FormData();fd.append('file',blob,name);if(axis)fd.append('axis',axis);toast('جارٍ الرفع…');
 try{const r=await fetch(BASE+'/files',{method:'POST',body:fd});const j=await r.json();if(!r.ok)throw new Error(j.error&&j.error.message||'تعذّر الرفع');FILES.push(j);toast('أُرفق الملف');render()}catch(e){toast(e.message,1)}}
let REC=null;
function bindFiles(){app.querySelectorAll('[data-up]').forEach(inp=>inp.onchange=()=>{const f=inp.files[0];if(f)upload(f,f.name,inp.closest('.rec').dataset.ax)});
 app.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{if(!confirm('حذف هذا الملف؟'))return;const r=await fetch(BASE+'/files/'+b.dataset.del,{method:'DELETE'});if(r.ok){FILES=FILES.filter(f=>f.id!=b.dataset.del);render()}else toast('تعذّر الحذف',1)});
 app.querySelectorAll('[data-rec]').forEach(b=>b.onclick=async()=>{const box=b.closest('.rec'),axis=box.dataset.ax;
  if(REC){REC.stop();return}
  if(visit&&!INFO.consent){toast('سجّل موافقة الجمعية على التسجيل في بيانات الزيارة أولاً',1);return}
  try{const st=await navigator.mediaDevices.getUserMedia({audio:true});const mr=new MediaRecorder(st),ch=[];let t0=Date.now();REC=mr;
   b.textContent='⏹ إيقاف وحفظ';const live=document.createElement('span');live.className='live';box.appendChild(live);const iv=setInterval(()=>{const s=Math.round((Date.now()-t0)/1000);live.textContent=Math.floor(s/60)+':'+String(s%60).padStart(2,'0')},500);
   mr.ondataavailable=e=>e.data.size&&ch.push(e.data);
   mr.onstop=()=>{clearInterval(iv);st.getTracks().forEach(x=>x.stop());REC=null;const type=(mr.mimeType||'audio/webm').split(';')[0];const blob=new Blob(ch,{type});
    const ax=AX.find(a=>a.id==axis);upload(blob,'تسجيل'+(ax?' — '+ax.t:'')+' '+new Date().toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'})+'.'+(type.includes('mp4')?'m4a':'webm'),axis)};
   mr.start(1000)}catch(e){toast('لم يُسمح باستخدام الميكروفون',1)}})}
// ─── الشاشات ───
function intro(){const roles=T.roles.map(r=>'<button type="button" aria-pressed="'+(INFO.role==r)+'" data-role="'+esc(r)+'">'+esc(r)+'</button>').join('');
 let h='<div class="hero"><h1 tabindex="-1">'+(visit?'تقييم ميداني لـ«'+esc(D.association)+'»':field?'تعبئة مكتبية لـ«'+esc(D.association)+'»':'أهلاً بكم، نحن هنا لنساعد')+'</h1><p>'+(visit?'تُسجَّل ملاحظات الزيارة على عشرة محاور. الإجابة الجزئية مقبولة، وكل ما تكتبه يُحفظ تلقائياً.':field?'يُقيِّم الفريق ما يعرفه من بيانات اللوحة والتواصل مع الجمعية. العبارات المعلَّمة «من بيانات اللوحة» مقترحة ويمكن تعديلها.':'هذا التقييم يساعد مجلس الجمعيات على فهم وضع جمعيتكم وتحديد الدعم الأنسب لها من استشارات ومهام وخبراء متطوعين. ليس اختباراً ولا رقابة.')+'</p>'
 +'<ul><li>عشرة محاور، و'+Object.keys(ITEMS).length+' عبارة قصيرة، في 15 إلى 20 دقيقة تقريباً.</li><li>لكل عبارة اختر ما يصف الواقع اليوم، لا ما تطمحون إليه.</li><li>يُحفظ تلقائياً، ويمكنكم العودة للرابط نفسه وإكمال ما بقي.</li>'+(field?'':'<li>بعد الإرسال تظهر لكم قراءة أولية، ثم تقرير معتمد بعد مراجعة المجلس.</li>')+'</ul></div>';
 if(D.note&&editable)h+='<div class="note"><b>ملاحظة من فريق المجلس:</b> '+esc(D.note)+'</div>';
 h+='<div class="card"><h2>'+(visit?'بيانات الزيارة':field?'بيانات التعبئة':'من يعبّئ التقييم؟')+'</h2><p class="lead">'+(visit?'لا تُسجَّل أسماء أو أرقام الحاضرين، صفاتهم فقط.':field?'من قام بالتعبئة، وصفة من استُقيت منه المعلومات إن وُجد.':'اختر صفتكم في الجمعية (لا نطلب اسماً).')+'</p>';
 if(field&&!visit)h+='<label class="f"><span>اسم المُقيِّم</span><input type="text" id="iAss" maxlength="120" value="'+esc(INFO.assessor||'')+'"></label><p style="margin:0 0 6px;font-weight:600">صفة مصدر المعلومات (اختياري)</p>';
 if(visit)h+='<div class="g2"><label class="f"><span>اسم المُقيِّم أو جهته</span><input type="text" id="iAss" maxlength="120" value="'+esc(INFO.assessor||'')+'"></label><label class="f"><span>تاريخ الزيارة</span><input type="date" id="iDate" value="'+esc(INFO.visit_on||'')+'"></label></div><label class="f"><span>صفات من حضر من الجمعية</span><small>مثال: المدير التنفيذي، المحاسب، عضو مجلس الإدارة</small><input type="text" id="iAtt" maxlength="300" value="'+esc(INFO.attendees||'')+'"></label><p style="margin:0 0 6px;font-weight:600">صفة من أجاب عن أغلب العبارات</p>';
 h+='<div class="chips" role="group" aria-label="صفة المجيب">'+roles+'</div>';
 if(visit)h+='<label class="chk" style="margin-top:14px"><input type="checkbox" id="iCons" '+(INFO.consent?'checked':'')+'><span>وافقت الجمعية على التسجيل الصوتي والتصوير لأغراض التقييم فقط (لا يُنشر).</span></label>';
 h+='</div><div class="card"><h2 style="font-size:16px">مقياس الإجابة</h2><div class="bars" style="gap:6px">'+SCALE.map(s=>'<div><b>'+s[1]+'</b> <span style="color:var(--mute)">— '+s[2]+'</span></div>').join('')+'</div></div>';
 return h}
function axisScreen(a){const n=axDone(a);let h='<div class="axh"><div><h2 tabindex="-1">'+esc(a.t)+'</h2><small>'+esc(a.d)+'</small></div><span class="cnt">'+n+' / '+a.items.length+'</span></div>';
 a.items.forEach((it,i)=>{const x=A[it.id]||{},v=x.v;
  const opts=SCALE.map(s=>'<label><input type="radio" name="'+it.id+'" value="'+s[0]+'" '+(v===s[0]?'checked':'')+(editable?'':' disabled')+'><span><b>'+s[0]+'</b>'+s[1]+'</span></label>').join('')+(it.na?'<label><input type="radio" name="'+it.id+'" value="na" '+(v==='na'?'checked':'')+(editable?'':' disabled')+'><span><b>—</b>لا ينطبق</span></label>':'');
  h+='<fieldset class="q'+(v!=null?' done':'')+'" id="q-'+it.id+'"><legend><span class="qn">'+(i+1)+'</span>'+esc(it.t)+'</legend><div class="opts'+(it.na?' na':'')+'">'+opts+'</div><div class="qx">'
   +(x.src=='desk'?'<span class="src">من بيانات اللوحة</span>':'')+(it.ev?'<span class="ev">الدليل: '+esc(it.ev)+'</span>':'')
   +'<button type="button" class="lnk" data-nt="'+it.id+'" aria-expanded="'+(!!x.note)+'">'+(x.note?'ملاحظة':'+ إضافة ملاحظة')+'</button></div>'
   +'<div data-ntb="'+it.id+'" '+(x.note?'':'hidden')+'><label class="sr" for="n-'+it.id+'">ملاحظة على العبارة</label><textarea id="n-'+it.id+'" data-n="'+it.id+'" maxlength="600" style="margin-top:8px;min-height:64px" placeholder="مثال: توجد لائحة لكنها غير معتمدة"'+(editable?'':' readonly')+'>'+esc(x.note||'')+'</textarea></div></fieldset>'});
 h+='<div class="card"><label class="f"><span>تحديات هذا المحور بكلماتكم</span><small>ما الذي يعيقكم هنا؟ اكتب أو سجّل صوتياً.</small><textarea data-axn="'+a.id+'" maxlength="1000"'+(editable?'':' readonly')+'>'+esc(INFO.axisNotes[a.id]||'')+'</textarea></label>'+attachUI(a.id)+'</div>';
 return h}
function openScreen(){let h='<h2 tabindex="-1">أسئلة ختامية</h2><p class="lead">إجاباتكم المكتوبة تساعد فريق المجلس على فهم ما لا تقيسه العبارات.</p>';
 T.open.forEach(q=>{h+='<div class="card"><label class="f"><span>'+esc(q.t)+(q.req&&!field?' <small style="display:inline;color:var(--bad)">(مطلوب)</small>':'')+'</span><textarea data-op="'+q.id+'" maxlength="1500" rows="4"'+(editable?'':' readonly')+'>'+esc(INFO.open[q.id]||'')+'</textarea></label></div>'});
 h+='<div class="card"><h2 style="font-size:16px">مرفقات عامة</h2><p class="lead" style="margin:0 0 8px">'+(field?'صور من الزيارة، أو مستندات اطّلعت عليها، أو تسجيل لملخص اللقاء.':'يمكنكم إرفاق تقرير أو لائحة أو تسجيل صوتي يشرح وضع الجمعية.')+'</p>'+attachUI(null)+'</div>';return h}
function reviewScreen(){const sc=SC(),[d,n]=progress();let h='<h2 tabindex="-1">المراجعة والإرسال</h2><p class="lead">أُجيب عن '+d+' من '+n+' عبارة ('+sc.cov+'%).'+(field?' الإرسال الجزئي مقبول بعد 30%.':' يلزم الإجابة عن كل العبارات قبل الإرسال.')+'</p><div class="rv">';
 AX.forEach((a,i)=>{const k=axDone(a),full=k==a.items.length;h+='<button type="button" data-s="'+(i+1)+'"><span>'+esc(a.t)+'</span><span class="'+(full?'full':'miss')+'">'+(full?'مكتمل ✓':(a.items.length-k)+' بلا إجابة')+'</span></button>'});
 const top=(INFO.open.top||'').trim();h+='<button type="button" data-s="'+(AX.length+1)+'"><span>أسئلة ختامية</span><span class="'+(top||field?'full':'miss')+'">'+(top?'مكتمل ✓':field?'اختياري':'أكبر التحديات مطلوب')+'</span></button></div>';
 if(team&&sc.total!=null)h+='<div class="card" style="margin-top:14px"><h2 style="font-size:16px">القراءة الحالية</h2>'+results(sc,true)+'</div>';
 const can=field?sc.cov>=30:(sc.cov==100&&top&&INFO.role);
 h+='<div class="card" style="margin-top:14px"><label class="chk"><input type="checkbox" id="conf"><span>'+(field?'أؤكد أن ما سجّلته يعكس ما شاهدته واطّلعت عليه في الزيارة.':'نؤكد أن الإجابات تعكس واقع الجمعية بحسب علمنا.')+'</span></label><button class="btn p" type="button" id="send" '+(can?'':'disabled')+'>إرسال التقييم</button>'+(!can?'<p style="color:var(--bad);font-size:14px;margin:8px 0 0">'+(field?'أجب عن 30% من العبارات على الأقل.':!INFO.role?'اختر صفة من يعبّئ التقييم في الصفحة الأولى.':sc.cov<100?'أكمل العبارات المتبقية أعلاه.':'اكتب أكبر التحديات في الأسئلة الختامية.')+'</p>':'')+'<p style="color:var(--mute);font-size:13px;margin:10px 0 0">بعد الإرسال لا يمكن التعديل إلا إذا أعاده فريق المجلس.</p></div>';return h}
// ─── النتائج ───
const COL={ok:'#1FB37A',info:'#1249FF',warn:'#F5A524',bad:'#E5484D'};
function radar(sc){const N=AX.length,R=120,C=160,pt=(i,r)=>{const t=-Math.PI/2+i*2*Math.PI/N;return [C+r*Math.cos(t),C+r*Math.sin(t)]};
 let g='';[25,50,75,100].forEach(p=>{g+='<polygon points="'+AX.map((a,i)=>pt(i,R*p/100).join(',')).join(' ')+'" fill="none" stroke="#E3E7EF"/>'});
 AX.forEach((a,i)=>{const [x,y]=pt(i,R),[lx,ly]=pt(i,R+22);g+='<line x1="'+C+'" y1="'+C+'" x2="'+x+'" y2="'+y+'" stroke="#E3E7EF"/><text x="'+lx+'" y="'+ly+'" font-size="10.5" text-anchor="middle" dominant-baseline="middle" fill="#5B6478">'+esc(a.t.split(' ')[0]+(a.t.split(' ')[1]?' '+a.t.split(' ')[1]:''))+'</text>'});
 const poly=AX.map((a,i)=>{const s=(sc.axes.find(x=>x.id==a.id)||{}).s;return pt(i,R*((s||0)/100)).join(',')}).join(' ');
 g+='<polygon points="'+poly+'" fill="#1249FF33" stroke="#1249FF" stroke-width="2"/>';
 return '<svg class="radar" viewBox="0 0 320 320" role="img" aria-label="مخطط درجات المحاور">'+g+'</svg>'}
function results(sc,compact){const L=lvl(sc.total);let h='<div class="sum"><div><small>الدرجة العامة</small><b>'+(sc.total==null?'—':sc.total)+'</b>'+(L?' <span class="lv lv-'+L[2]+'">'+L[1]+'</span>':'')+'</div><div><small>تغطية الإجابات</small><b>'+sc.cov+'%</b></div><div><small>فجوات</small><b>'+sc.gaps.length+'</b>'+(sc.gaps.some(g=>g.crit)?' <span class="lv lv-bad">'+sc.gaps.filter(g=>g.crit).length+' حرجة</span>':'')+'</div></div>';
 if(!compact)h+=radar(sc);
 h+='<div class="bars" style="margin-top:12px">'+AX.map(a=>{const s=(sc.axes.find(x=>x.id==a.id)||{}).s,l=lvl(s);return '<div class="bar"><span>'+esc(a.t)+'</span><i><em style="width:'+(s||0)+'%;background:'+(l?COL[l[2]]:'#E3E7EF')+'"></em></i><b>'+(s==null?'—':s)+'</b></div>'}).join('')+'</div>';return h}
function gapsList(sc){if(!sc.gaps.length)return '<p class="lead">لا فجوات: كل العبارات المجابة في مستوى «مطبّق جزئياً» أو أعلى.</p>';
 return sc.gaps.slice(0,15).map(g=>{const it=ITEMS[g.id],a=AX.find(x=>x.id==g.ax);return '<div class="gap"><span class="tag" style="background:'+(g.crit?'var(--badb);color:var(--bad)':g.v==0?'var(--warnb);color:var(--warn)':'var(--ice);color:var(--mute)')+'">'+(g.crit?'حرجة':g.v==0?'غير موجود':'بداية')+'</span><div><b style="font-weight:600">'+esc(it.t)+'</b><div style="color:var(--mute);font-size:13px">'+esc(a.t)+((A[g.id]||{}).note?' · '+esc(A[g.id].note):'')+'</div></div></div>'}).join('')}
function detail(){const lab=v=>v==='na'?'لا ينطبق':v==null?'بلا إجابة':(SCALE.find(s=>s[0]===v)||[])[1];
 let h='<div class="card"><h2>الإجابات بالتفصيل</h2>';
 h+=(INFO.role||INFO.visit_on||INFO.assessor)?'<p class="lead">'+[INFO.assessor&&('المُقيِّم: '+esc(INFO.assessor)),INFO.visit_on&&('الزيارة: '+esc(INFO.visit_on)),INFO.attendees&&('الحضور: '+esc(INFO.attendees)),INFO.role&&('صفة المجيب: '+esc(INFO.role))].filter(Boolean).join(' · ')+'</p>':'';
 AX.forEach(a=>{const sc=(SC().axes.find(x=>x.id==a.id)||{}).s;h+='<details style="border-top:1px solid var(--line);padding:8px 0"><summary style="cursor:pointer;font-weight:700">'+esc(a.t)+' <span style="color:var(--mute);font-weight:500">'+(sc==null?'—':sc)+'</span></summary>'
  +a.items.map(it=>{const x=A[it.id]||{};return '<div style="padding:6px 0;font-size:14.5px"><div>'+esc(it.t)+'</div><div style="color:var(--mute);font-size:13.5px"><b style="color:var(--hd)">'+lab(x.v)+'</b>'+(x.src=='desk'?' · من بيانات اللوحة':'')+(x.note?' · '+esc(x.note):'')+'</div></div>'}).join('')
  +(INFO.axisNotes[a.id]?'<p style="background:var(--ice);border-radius:10px;padding:8px 12px;font-size:14px"><b>تحديات المحور:</b> '+esc(INFO.axisNotes[a.id])+'</p>':'')+fileList(a.id)+'</details>'});
 const op=T.open.filter(q=>INFO.open[q.id]);if(op.length)h+='<div style="border-top:1px solid var(--line);padding-top:10px">'+op.map(q=>'<p style="margin:0 0 10px"><b>'+esc(q.t)+'</b><br>'+esc(INFO.open[q.id]).replace(/\n/g,'<br>')+'</p>').join('')+'</div>';
 h+=fileList(null);return h+'</div>'}
function doneScreen(){const sc=D.scores||SC(),appr=D.status=='approved';
 if(D.status=='readonly'||D.status=='cancelled')return '<div class="hero"><h1 tabindex="-1">'+(D.status=='cancelled'?'تقييم ملغى':'معاينة: لم يُرسل التقييم بعد')+'</h1><p>'+(D.status=='cancelled'?'أُلغي هذا التقييم ولا يدخل في النتائج.':'يعبّئه حامل الرابط. تظهر هنا إجاباته المحفوظة حتى الآن للاطلاع فقط.')+'</p></div><div class="card"><h2>القراءة الحالية</h2>'+results(sc)+'</div>'+detail();
 let h='<div class="hero"><h1 tabindex="-1">'+(appr?'تقرير التشخيص المعتمد':'شكراً لكم، وصل التقييم ✓')+'</h1><p>'+(appr?'اعتمده فريق مجلس الجمعيات الأهلية بعسير.':field?'سيراجعه فريق المجلس ويعتمده، ثم يظهر في ملف الجمعية.':'سيراجعه فريق المجلس خلال أيام، ويتواصل معكم بشأن الدعم المناسب. هذه قراءة أولية من إجاباتكم.')+'</p></div>';
 if(appr&&D.note)h+='<div class="note ok"><b>ملاحظة المجلس:</b> '+esc(D.note)+'</div>';
 h+='<div class="card"><h2>'+(appr?'النتيجة':'القراءة الأولية')+'</h2>'+results(sc)+'</div><div class="card"><h2>أبرز الفجوات</h2><p class="lead">العبارات التي أُجيب عنها بـ«غير موجود» أو «بداية»، مرتبة حسب أهميتها.</p>'+gapsList(sc)+'</div>';
 if(!field)h+='<div class="card"><h2 style="font-size:16px">ماذا بعد؟</h2><p class="lead" style="margin:0">يحوّل فريق المجلس الفجوات إلى دعم: استشارة لسؤال محدد، أو مهمة تخصصية بمخرج واضح، أو مرافقة لعدة أشهر من خبراء متطوعين. يمكنكم أيضاً طلب الدعم مباشرة من صفحة «تطوّع بخبرتك» في موقع المجلس.</p></div>';
 h+=detail();h+='<p class="noprint" style="text-align:center"><button class="btn o" type="button" onclick="print()">طباعة أو حفظ PDF</button></p>';return h}
function render(){progress();
 if(!editable){app.innerHTML=doneScreen();return}
 const s=STEPS[step];let body=s.k=='intro'?intro():s.k=='open'?openScreen():s.k=='review'?reviewScreen():axisScreen(AX.find(a=>a.id==s.k));
 app.innerHTML='<nav class="steps noprint" id="steps" aria-label="مراحل التقييم"></nav>'+body+navBar();stepsBar();bind()}
function bind(){const p=$('#prev'),n=$('#next');p&&(p.onclick=()=>go(step-1));n&&(n.onclick=()=>go(step+1));
 app.querySelectorAll('.opts input').forEach(r=>r.onchange=()=>{const k=r.name,v=r.value=='na'?'na':+r.value;A[k]=Object.assign({},A[k]||{},{v});delete A[k].src;mark();const fs=r.closest('fieldset');fs.classList.add('done');const c=app.querySelector('.cnt');const a=AX.find(x=>x.id==ITEMS[k].ax);c&&(c.textContent=axDone(a)+' / '+a.items.length);fs.querySelector('.src')&&fs.querySelector('.src').remove()});
 app.querySelectorAll('[data-nt]').forEach(b=>b.onclick=()=>{const box=app.querySelector('[data-ntb="'+b.dataset.nt+'"]');box.hidden=!box.hidden;b.setAttribute('aria-expanded',!box.hidden);if(!box.hidden)box.querySelector('textarea').focus()});
 app.querySelectorAll('[data-n]').forEach(t=>t.oninput=()=>{const k=t.dataset.n;A[k]=Object.assign({},A[k]||{},{note:t.value});mark()});
 app.querySelectorAll('[data-axn]').forEach(t=>t.oninput=()=>{INFO.axisNotes[t.dataset.axn]=t.value;mark()});
 app.querySelectorAll('[data-op]').forEach(t=>t.oninput=()=>{INFO.open[t.dataset.op]=t.value;mark()});
 app.querySelectorAll('[data-role]').forEach(b=>b.onclick=()=>{INFO.role=b.dataset.role;app.querySelectorAll('[data-role]').forEach(x=>x.setAttribute('aria-pressed',x==b));mark()});
 const ia=$('#iAss'),idt=$('#iDate'),iat=$('#iAtt'),ic=$('#iCons');ia&&(ia.oninput=()=>{INFO.assessor=ia.value;mark()});idt&&(idt.onchange=()=>{INFO.visit_on=idt.value;mark()});iat&&(iat.oninput=()=>{INFO.attendees=iat.value;mark()});ic&&(ic.onchange=()=>{INFO.consent=ic.checked;mark()});
 app.querySelectorAll('.rv [data-s]').forEach(b=>b.onclick=()=>go(+b.dataset.s));
 const sd=$('#send');sd&&(sd.onclick=async()=>{if(!$('#conf').checked){toast('أكّد صحة الإجابات أولاً',1);$('#conf').focus();return}sd.disabled=true;dirty=true;await save();
  try{const r=await fetch(BASE+'/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const j=await r.json();if(!r.ok)throw new Error(j.error&&j.error.message||'تعذّر الإرسال');D.status='submitted';D.scores=j.scores;editable=false;dirty=false;try{localStorage.removeItem(LS)}catch(e){}location.hash='';app.innerHTML='';const nv=document.querySelector('.nav');nv&&nv.remove();render();scrollTo(0,0)}catch(e){toast(e.message,1);sd.disabled=false}});
 bindFiles()}
render();if(dirty&&editable)setTimeout(save,400);
})();`;
