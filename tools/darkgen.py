"""Generate dark-mode overrides (site + team dashboard) from the site's own CSS.

The dashboard CSS uses many hard-coded light colours. Instead of hand-writing a dark rule for each,
build.py calls gen(css) at build time: every declaration that uses a light surface/border colour or a
dark text colour gets a mirrored rule under `:where(html[data-theme=dark])` (zero specificity, emitted last, so it
beats the base rule but never a hand-written `html[data-theme=dark] …` rule), with the colour
mapped to the graphite palette variables (--bg/--sf/--sf2/--line/--hd/--text/--mute) or to a
lighter/tinted version of the same hue for status colours. Pure Python (no dependencies) so the
Cloudflare build can run it.
"""
import colorsys, re

PRE = ':where(html[data-theme=dark])'  # zero specificity: hand-written dark rules still win, base rules lose (we come last)
HEX = re.compile(r'#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b')
SKIP_SEL = re.compile(r'img|logo|\blg\b|\.lg|qr|print|::selection|#rptDoc'
                      r'|\.(?:rpd|rpdefs|rpcov|rpcl|rpct|rpey|rpsc|rpdt|rpch|rptoc|rpcf|rps|rpi|rb2|rbh|rbk|rbr|rch|rf|rk|rkc|rmx|rs|rsb|rsl|rt)(?![\w-])'
                      r'|\.rpd |\.rpd\b')  # report pages stay light: they are an A4 print preview


def _rgb(h):
    h = h[1:]
    if len(h) == 3: h = ''.join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def _hsl(h):
    r, g, b = _rgb(h); hh, l, s = colorsys.rgb_to_hls(r, g, b); return hh * 360, s, l


def _rgba(hue, s, l, a):
    r, g, b = colorsys.hls_to_rgb(hue / 360, l, s); return f'rgba({round(r*255)},{round(g*255)},{round(b*255)},{a})'


def _hexstr(hue, s, l):
    r, g, b = colorsys.hls_to_rgb(hue / 360, l, s); return '#%02X%02X%02X' % (round(r*255), round(g*255), round(b*255))


def map_bg(h):
    hue, s, l = _hsl(h)
    if l < .85: return None
    if s > .45 and l < .985:  # light tint (green/amber/red/violet/blue) -> translucent tint of the hue
        return _rgba(hue, .7, .55, .16)
    if l >= .99: return 'var(--sf)'
    if l >= .962: return 'var(--bg)'
    return 'var(--sf2)'


def map_border(h):
    hue, s, l = _hsl(h)
    if l < .78: return None
    if s > .45 and l < .985: return _rgba(hue, .7, .55, .35)
    return 'var(--line)'


def map_text(h):
    hue, s, l = _hsl(h)
    if l > .62: return None
    if 215 <= hue <= 260 and l < .36: return 'var(--hd)'       # navy headings
    if s > .4 and l > .2: return _hexstr(hue, min(1, s), .74)    # status / accent colours -> lighter same hue
    if l < .2: return 'var(--hd)'
    if l < .36: return 'var(--text)'
    return 'var(--mute)'


def map_value(prop, v):
    p = prop.lower()
    if p.startswith('--'): return v
    kind = ('bg' if p.startswith('background') else
            'border' if p.startswith('border') or p.startswith('outline') or p == 'column-rule' else
            'text' if p in ('color', 'caret-color', '-webkit-text-fill-color') else
            'shadow' if p == 'box-shadow' else None)
    if not kind: return v
    def sub(m):
        h = m.group(0)
        r = {'bg': map_bg, 'border': map_border, 'text': map_text, 'shadow': map_bg}[kind](h)
        return r or h
    out = HEX.sub(sub, v)
    if kind == 'bg':
        out = re.sub(r'\bwhite\b', 'var(--sf)', out)
        def rg(m):
            r, g, b, a = (float(x) for x in m.groups())
            l = (max(r, g, b) + min(r, g, b)) / 510
            if l < .9 or a < .5: return m.group(0)
            return f'rgba(22,27,34,{m.group(4)})' if l >= .99 else f'rgba(13,17,23,{m.group(4)})'
        out = re.sub(r'rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)', rg, out)
    if kind == 'text':
        out = re.sub(r'var\(--(navy|deep|ink)\)', 'var(--hd)', out)
    return out


def _split_top(s, ch):
    out, depth, cur, q = [], 0, '', None
    for c in s:
        if q:
            cur += c
            if c == q: q = None
            continue
        if c in '"\'': q = c
        elif c in '([': depth += 1
        elif c in ')]': depth -= 1
        if c == ch and depth == 0: out.append(cur); cur = ''
        else: cur += c
    out.append(cur); return out


def _blocks(css):
    """yield (prelude, body) pairs at top level, respecting strings."""
    i, n = 0, len(css)
    while i < n:
        j = i; q = None
        while j < n and (q or css[j] != '{'):
            if q:
                if css[j] == q: q = None
            elif css[j] in '"\'': q = css[j]
            elif css[j] == '}': i = j + 1  # stray
            j += 1
        if j >= n: return
        pre = css[i:j].strip(); depth = 1; k = j + 1; q = None
        while k < n and depth:
            c = css[k]
            if q:
                if c == q: q = None
            elif c in '"\'': q = c
            elif c == '{': depth += 1
            elif c == '}': depth -= 1
            k += 1
        yield pre, css[j + 1:k - 1]; i = k


def _sel(sel):
    sel = sel.strip()
    if not sel or SKIP_SEL.search(sel) or sel.startswith(('html', ':root', '@', 'from', 'to')) or re.match(r'^\d', sel): return None
    return PRE + ' ' + sel


def _rules(css, out):
    for pre, body in _blocks(css):
        if pre.startswith('@media'):
            if 'print' in pre: continue
            sub = []; _rules(body, sub)
            if sub: out.append(pre + '{' + ''.join(sub) + '}')
            continue
        if pre.startswith('@'): continue
        sels = [x for x in (_sel(s) for s in _split_top(pre, ',')) if x]
        if not sels: continue
        decls = []
        bright = False  # a bright accent background stays bright -> keep its dark text as is
        for d in _split_top(body, ';'):
            if ':' in d and d.split(':', 1)[0].strip().startswith('background'):
                v = d.split(':', 1)[1]
                if re.search(r'var\(--(cyan|sky|blue)\)', v) or any(_hsl(h)[2] >= .55 and not map_bg(h) for h in HEX.findall(v)): bright = True
        for d in _split_top(body, ';'):
            if ':' not in d: continue
            p, v = d.split(':', 1); p = p.strip()
            if bright and p in ('color', 'caret-color'): continue
            nv = map_value(p, v.strip())
            if nv != v.strip(): decls.append(f'{p}:{nv}')
        if decls: out.append(','.join(sels) + '{' + ';'.join(decls) + '}')


def gen(css):
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    out = []; _rules(css, out)
    D = 'html[data-theme=dark]'
    base = (D + ' .jlogo.d{display:none}' + D + ' .jlogo.w{display:block}' + D + ' .rpd{color-scheme:light}')
    return '/* generated by tools/darkgen.py */' + base + ''.join(out)


if __name__ == '__main__':
    import sys
    s = open(sys.argv[1], encoding='utf8').read()
    a = s.index('<style>') + 7; b = s.index('</style>')
    g = gen(s[a:b]); print(len(g), 'bytes'); print(g[:3000])
