#!/usr/bin/env python3
"""Build the site.

  python3 build.py            -> dist/asir-council-site.html  (standalone file, data embedded)
  python3 build.py --deploy   -> dist/site/index.html         (for the Worker: data blocks left empty,
                                                               the Worker injects live data from D1)

Standalone build uses data/internal.json when present (real council file — never committed),
otherwise data/internal.redacted.json (same records, personal fields removed).
"""
import base64, json, os, sys
DEPLOY = '--deploy' in sys.argv
ROOT = os.path.dirname(os.path.abspath(__file__))
P = lambda *a: os.path.join(ROOT, *a)
src = open(P('src', 'site.src.html'), encoding='utf8').read()
assets = {'hero': 'hero.webp', 'ksa': 'ksa.webp', 'wave': 'wave.webp', 'box': 'box.webp', 'logo_white': 'logo_white.png',
          'logo_dark': 'logo_dark.png', 'lg_ibtisama': 'lg_ibtisama.webp',
          **{f'bp{i}': f'bp{i}.webp' for i in range(1, 8)},
          **{f'b_{k}': f'b_{k}.jpg' for k in ['chair', 'vice', 'm1', 'm2', 'm3', 'm4', 'm5']}}
mime = {'jpg': 'image/jpeg', 'png': 'image/png', 'webp': 'image/webp'}
import hashlib, re, shutil
_hash = lambda b: hashlib.sha256(b).hexdigest()[:10]
ASSET_DIR = P('dist', 'site', 'assets')
if DEPLOY:  # ملفات ثابتة ببصمة المحتوى: تُحفظ في جهاز الزائر سنة، ويتغير اسمها تلقائياً مع أي تحديث
    shutil.rmtree(ASSET_DIR, ignore_errors=True); os.makedirs(os.path.join(ASSET_DIR, 'img'))
for k, f in assets.items():
    raw = open(P('src', 'assets', f), 'rb').read()
    if DEPLOY:
        name = f'{k}.{_hash(raw)}.{f.rsplit(".", 1)[1]}'
        open(os.path.join(ASSET_DIR, 'img', name), 'wb').write(raw)
        src = src.replace('{{' + k + '}}', f'/assets/img/{name}')
    else:
        src = src.replace('{{' + k + '}}', f'data:{mime[f.rsplit(".", 1)[1]]};base64,{base64.b64encode(raw).decode()}')
real = P('data', 'internal.json')
internal_path = real if os.path.exists(real) else P('data', 'internal.redacted.json')
if DEPLOY:
    src = src.replace('{{internal}}', '[]').replace('{{public}}', '[]')
else:
    src = src.replace('{{internal}}', json.dumps(json.load(open(internal_path, encoding='utf8'))['internal'], ensure_ascii=False, separators=(',', ':')))
    src = src.replace('{{public}}', open(P('data', 'public.json'), encoding='utf8').read())
# النمط الداكن للوحة التحكم يُولَّد من CSS الموقع نفسه (tools/darkgen.py)
sys.path.insert(0, P('tools')); import darkgen
_a = src.index('<style>') + 7; _b = src.index('</style>')
src = src.replace('/*{{darkadmin}}*/', darkgen.gen(src[_a:_b]), 1)
src = src.replace('{{suplogos}}', open(P('data', 'suplogos.json'), encoding='utf8').read())
src = src.replace('{{geo}}', open(P('data', 'geo.json'), encoding='utf8').read())
if DEPLOY:
    # 1) الأنماط ← /assets/app.<بصمة>.css
    a = src.index('<style>'); b = src.index('</style>', a)
    css = src[a + 7:b].encode()
    cname = f'app.{_hash(css)}.css'; open(os.path.join(ASSET_DIR, cname), 'wb').write(css)
    src = src[:a] + f'<link rel="stylesheet" href="/assets/{cname}">' + src[b + 8:]
    # 2) الكود الرئيسي ← /assets/app.<بصمة>.js ؛ تبقى متغيرات البيانات التي يحقنها الخادم في سطر داخلي قبله
    m = src.index('const RAW=/*@RAW*/'); a = src.rindex('<script>', 0, m); b = src.index('</script>', m)
    body = src[a + 8:b]
    DECL = re.compile(r'^const (assoc|RAW|SESSION|PORTAL)=/\*@[A-Z]+\*/.*?/\*@END\*/;$', re.M)
    decls = DECL.findall(body); keep = [x.group(0) for x in DECL.finditer(body)]
    assert sorted(decls) == ['PORTAL', 'RAW', 'SESSION', 'assoc'], decls
    body = DECL.sub('', body).encode()
    jname = f'app.{_hash(body)}.js'; open(os.path.join(ASSET_DIR, jname), 'wb').write(body)
    src = src[:a] + '<script>' + '\n'.join(keep) + '</script>\n<script src="/assets/' + jname + '"></script>' + src[b + 9:]
out = P('dist', 'site', 'index.html') if DEPLOY else P('dist', 'asir-council-site.html')
os.makedirs(os.path.dirname(out), exist_ok=True)
open(out, 'w', encoding='utf8').write(src)
if DEPLOY:  # صور الأخبار تُخدم ملفات ثابتة من /news/
    import shutil
    for d in ('news', 'plogo', 'alogo', 'brand-kit', 'pwa'):  # ملفات ثابتة: صور الأخبار وشعارات مستخرجة من تقرير الدورة الأولى
        shutil.copytree(P('src', d), P('dist', 'site', d), dirs_exist_ok=True)
print(f'{len(src)//1024} KB  ->  {out}  (data: {"injected at runtime from D1" if DEPLOY else os.path.basename(internal_path)})')
