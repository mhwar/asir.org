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
assets = {'hero': 'hero.jpg', 'ksa': 'ksa.jpg', 'wave': 'wave.jpg', 'box': 'box.webp', 'logo_white': 'logo_white.png',
          'logo_dark': 'logo_dark.png', 'lg_ibtisama': 'lg_ibtisama.webp',
          **{f'bp{i}': f'bp{i}.webp' for i in range(1, 8)},
          **{f'b_{k}': f'b_{k}.jpg' for k in ['chair', 'vice', 'm1', 'm2', 'm3', 'm4', 'm5']}}
mime = {'jpg': 'image/jpeg', 'png': 'image/png', 'webp': 'image/webp'}
for k, f in assets.items():
    d = base64.b64encode(open(P('src', 'assets', f), 'rb').read()).decode()
    src = src.replace('{{' + k + '}}', f'data:{mime[f.rsplit(".", 1)[1]]};base64,{d}')
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
out = P('dist', 'site', 'index.html') if DEPLOY else P('dist', 'asir-council-site.html')
os.makedirs(os.path.dirname(out), exist_ok=True)
open(out, 'w', encoding='utf8').write(src)
if DEPLOY:  # صور الأخبار تُخدم ملفات ثابتة من /news/
    import shutil
    for d in ('news', 'plogo', 'alogo', 'brand-kit'):  # ملفات ثابتة: صور الأخبار وشعارات مستخرجة من تقرير الدورة الأولى
        shutil.copytree(P('src', d), P('dist', 'site', d), dirs_exist_ok=True)
print(f'{len(src)//1024} KB  ->  {out}  (data: {"injected at runtime from D1" if DEPLOY else os.path.basename(internal_path)})')
