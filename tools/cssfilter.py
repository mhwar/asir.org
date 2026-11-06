"""تنقية الأنماط لحزمة الزائر: تُحذف القاعدة متى ذكر محددها صنفاً (class) أو معرّفاً (id)
لا يظهر في أي مكان من كود الزائر أو HTML الصفحة، فلا يمكن أن تنطبق عنده.

آمنة بالتصميم:
- القاعدة تبقى إن ظهر الاسم في أي نص من المصادر (حتى داخل نص أو قالب).
- الأصناف المبنية ديناميكياً (مثل 't-'+نوع أو `p-${x}`) تُحفظ ببادئاتها.
- ما داخل :not( ) و:is( ) وأمثالها لا يُعد شرطاً (قد ينطبق المحدد بغيابه).
- القواعد التي بلا أصناف أو معرّفات (مثل body أو a:hover) تبقى دائماً، وكذلك @font-face و@keyframes.
"""
import re

_CLS = re.compile(r'[.#](-?[A-Za-z_][\w-]*)')


def _strip_pseudo_fn(sel):
    out, depth = [], 0
    for ch in sel:
        if ch == '(':
            depth += 1
            continue
        if ch == ')':
            depth -= 1
            continue
        if depth == 0:
            out.append(ch)
    return ''.join(out)


def _split_list(sel):
    parts, depth, cur = [], 0, []
    for ch in sel:
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
        if ch == ',' and depth == 0:
            parts.append(''.join(cur)); cur = []
        else:
            cur.append(ch)
    parts.append(''.join(cur))
    return [p.strip() for p in parts if p.strip()]


def vocabulary(*sources):
    """كل الكلمات الممكنة كأسماء أصناف/معرّفات، والبادئات الديناميكية"""
    text = '\n'.join(sources)
    words = set(re.findall(r'[A-Za-z_][\w-]*', text))
    prefixes = set(re.findall(r'([A-Za-z_][\w-]*-)(?:\$\{|[\'"`]\s*\+)', text))
    return words, tuple(sorted(prefixes))


def _needed(sel, words, prefixes):
    for name in _CLS.findall(_strip_pseudo_fn(sel)):
        if name in words:
            continue
        if prefixes and name.startswith(prefixes):
            continue
        return False
    return True


def _rules(css):
    """يقسّم CSS إلى (رأس، جسم) على المستوى الأعلى؛ الجسم نص كما هو"""
    i, n = 0, len(css)
    while i < n:
        j = css.find('{', i)
        if j < 0:
            break
        head = css[i:j]
        depth, k = 1, j + 1
        while k < n and depth:
            c = css[k]
            if c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
            elif c in '"\'':
                k = css.index(c, k + 1)
            k += 1
        yield head, css[j + 1:k - 1]
        i = k


def _filter(css, words, prefixes, stats):
    out = []
    for head, body in _rules(css):
        h = re.sub(r'/\*.*?\*/', '', head, flags=re.S).strip()
        if not h:
            continue
        if h.startswith('@media') or h.startswith('@supports'):
            inner = _filter(body, words, prefixes, stats)
            if inner:
                out.append(f'{h}{{{inner}}}')
            continue
        if h.startswith('@'):
            out.append(f'{h}{{{body}}}')
            continue
        keep = [p for p in _split_list(h) if _needed(p, words, prefixes)]
        stats[0] += 1
        if keep:
            out.append(f'{",".join(keep)}{{{body}}}')
        else:
            stats[1] += 1
    return ''.join(out)


def filter_css(css, *sources):
    words, prefixes = vocabulary(*sources)
    stats = [0, 0]
    out = _filter(css, words, prefixes, stats)
    return out, stats
