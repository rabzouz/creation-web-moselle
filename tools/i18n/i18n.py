#!/usr/bin/env python3
"""Extraction des segments FR et génération des pages traduites (EN / LB) pour creation-web-moselle.fr.

Usage :
  python3 i18n.py extract REPO            -> segments.json (id -> texte FR)
  python3 i18n.py build REPO LANG          -> écrit les pages traduites dans REPO/LANG/...
"""
import json, re, sys, os, html

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = 'https://creation-web-moselle.fr'

# page FR (chemin URL) -> slug par langue ; None = page déjà existante gérée à part
PAGES = {
    '/': {'en': '/en/', 'lb': '/lb/'},
    '/pack-site-internet-tout-compris/': {'en': '/en/all-inclusive-website-package/', 'lb': '/lb/komplett-pak-websait/'},
    '/demande-de-projet/': {'en': '/en/project-request/', 'lb': '/lb/projet-ufro/'},
    '/site-vitrine-moselle/': {'en': '/en/business-website-moselle/', 'lb': '/lb/firmewebsait-musel/'},
    '/prix-site-internet-moselle/': {'en': '/en/website-cost-moselle/', 'lb': '/lb/praisser-websait/'},
    '/referencement-seo-moselle/': {'en': '/en/seo-moselle/', 'lb': '/lb/seo-referenzement/'},
    '/creation-site-internet-metz/': {'en': '/en/website-design-metz/', 'lb': '/lb/websait-metz/'},
    '/creation-site-internet-thionville/': {'en': '/en/website-design-thionville/', 'lb': '/lb/websait-diddenuewen/'},
    '/creation-site-internet-nancy/': {'en': '/en/website-design-nancy/', 'lb': '/lb/websait-nancy/'},
    '/creation-site-internet-grand-est/': {'en': '/en/website-design-grand-est/', 'lb': '/lb/websait-grand-est/'},
    '/mentions-legales/': {'en': '/en/legal-notice/', 'lb': '/lb/impressum/'},
    '/politique-confidentialite/': {'en': '/en/privacy-policy/', 'lb': '/lb/dateschutz/'},
}
# pages déjà traduites (pas regénérées, seulement reliées)
EXISTING = {
    '/creation-site-internet-luxembourg/': {'en': '/en/website-design-luxembourg/', 'lb': '/lb/websait-letzebuerg/', 'de': '/de/webdesign-luxemburg/'},
}
ALL_MAP = {**PAGES, **{k: {l: v[l] for l in ('en', 'lb')} for k, v in EXISTING.items()}}

LANG_META = {
    'fr': {'html': 'fr', 'locale': 'fr_FR', 'label': 'FR', 'name': 'Français'},
    'en': {'html': 'en', 'locale': 'en_GB', 'label': 'EN', 'name': 'English'},
    'lb': {'html': 'lb', 'locale': 'lb_LU', 'label': 'LB', 'name': 'Lëtzebuergesch'},
}

INLINE = {'span', 'em', 'strong', 'b', 'i', 'a', 'br', 'small', 'abbr', 'sup', 'sub', 'code', 'mark', 'u'}
TOKEN = re.compile(r'(<!--.*?-->|<script\b[^>]*>.*?</script\s*>|<style\b[^>]*>.*?</style\s*>|<[^>]+>)', re.S | re.I)
TAGNAME = re.compile(r'^</?\s*([a-zA-Z0-9]+)')
LETTER = re.compile(r'[A-Za-zÀ-ÿ]')

META_TRANSLATE = {'description', 'og:title', 'og:description', 'twitter:title', 'twitter:description', 'og:image:alt', 'twitter:image:alt'}
ATTR_TRANSLATE = ('alt', 'placeholder', 'aria-label', 'title')
JSON_KEYS = {'name', 'description', 'headline', 'text', 'serviceType', 'alternateName', 'slogan', 'disambiguatingDescription', 'caption'}


def fr_files(repo):
    for url in list(PAGES):
        yield url, os.path.join(repo, url.strip('/'), 'index.html') if url != '/' else os.path.join(repo, 'index.html')


def tag_name(tok):
    m = TAGNAME.match(tok)
    return m.group(1).lower() if m else ''


def split_runs(src):
    """Découpe le HTML en morceaux : ('raw', str) ou ('run', str) — un run = texte + balises inline."""
    parts = TOKEN.split(src)
    out, run = [], []

    def flush():
        if run:
            out.append(('run', ''.join(run)))
            run.clear()
    for p in parts:
        if not p:
            continue
        if p.startswith('<'):
            low = p[:8].lower()
            if p.startswith('<!--') or low.startswith('<script') or low.startswith('<style'):
                flush(); out.append(('raw', p)); continue
            if tag_name(p) in INLINE:
                run.append(p); continue
            flush(); out.append(('raw', p))
        else:
            run.append(p)
    flush()
    return out


def run_core(run):
    """Retourne (prefixe, coeur, suffixe) : on retire espaces et balises orphelines aux extrémités."""
    toks = [t for t in TOKEN.split(run) if t != '']
    def is_ws(t): return not t.startswith('<') and not t.strip()
    def is_close(t): return t.startswith('</')
    def is_open(t): return t.startswith('<') and not t.startswith('</') and tag_name(t) != 'br'
    i, j = 0, len(toks)
    changed = True
    while changed and i < j:
        changed = False
        while i < j and (is_ws(toks[i]) or is_close(toks[i]) or tag_name(toks[i]) == 'br'):
            i += 1; changed = True
        while j > i and (is_ws(toks[j - 1]) or is_open(toks[j - 1]) or tag_name(toks[j - 1]) == 'br'):
            j -= 1; changed = True
    if i >= j:
        return run, '', ''
    pre, core, suf = ''.join(toks[:i]), ''.join(toks[i:j]), ''.join(toks[j:])
    # garder les espaces de bord du texte dans pre/suf
    lead = len(core) - len(core.lstrip()); trail = len(core) - len(core.rstrip())
    pre += core[:lead]; suf = core[len(core) - trail:] + suf if trail else suf
    core = core.strip()
    return pre, core, suf


def norm(s):
    return re.sub(r'\s+', ' ', s).strip()


def translatable(s):
    s2 = re.sub(r'<[^>]+>', '', s)
    s2 = html.unescape(s2)
    return bool(LETTER.search(s2))


class Collector:
    def __init__(self):
        self.ids = {}
        self.order = []
        p = os.path.join(HERE, 'segments.json')
        if os.path.exists(p):  # garder les numéros existants
            for k, v in json.load(open(p, encoding='utf-8')).items():
                self.ids[v] = k
                self.order.append(v)

    def add(self, s):
        s = norm(s)
        if not s or not translatable(s):
            return
        if s not in self.ids:
            self.ids[s] = str(len(self.order) + 1)
            self.order.append(s)


ATTR_RE = re.compile(r'(\s)([a-zA-Z:-]+)(\s*=\s*)("([^"]*)"|\'([^\']*)\')')


def tag_attrs(tok):
    return {m.group(2).lower(): (m.group(5) if m.group(5) is not None else m.group(6)) for m in ATTR_RE.finditer(tok)}


def attr_targets(tok):
    """Liste des noms d'attributs à traduire dans cette balise."""
    name = tag_name(tok)
    a = tag_attrs(tok)
    names = [n for n in ATTR_TRANSLATE if n in a]
    if name == 'meta' and (a.get('name') in META_TRANSLATE or a.get('property') in META_TRANSLATE):
        names.append('content')
    if name == 'input' and a.get('type', '').lower() in ('radio', 'checkbox') and 'value' in a:
        names.append('value')
    if name == 'input' and a.get('type', '').lower() in ('text', 'email', 'tel', 'url') and a.get('value'):
        names.append('value')
    if name == 'option' and 'value' in a:
        names.append('value')
    return names


JS_STR = re.compile(r"'((?:[^'\\\n]|\\.)*)'|\"((?:[^\"\\\n]|\\.)*)\"")


def js_candidate(s):
    raw = s
    if len(raw) < 2 or not LETTER.search(raw):
        return False
    if re.fullmatch(r'[\w#.\-\[\]=^"\'/:?&%+,*]+', raw) and ' ' not in raw:
        # identifiants, sélecteurs, URL… sauf mots FR simples avec accent
        return bool(re.search(r'[À-ÿ]', raw)) and not raw.startswith(('#', '.', '/', 'http', 'input', 'mailto'))
    if raw.startswith(('http', 'mailto:', 'tel:', '/', 'input[', '#', '.')):
        return False
    return True


def walk_json(obj, fn, key=None):
    if isinstance(obj, dict):
        return {k: walk_json(v, fn, k) for k, v in obj.items()}
    if isinstance(obj, list):
        return [walk_json(v, fn, key) for v in obj]
    if isinstance(obj, str) and key in JSON_KEYS:
        return fn(obj)
    return obj


def process(src, fn, js_fn=None):
    """Applique fn() à chaque segment traduisible ; renvoie le HTML transformé."""
    out = []
    for kind, chunk in split_runs(src):
        if kind == 'run':
            pre, core, suf = run_core(chunk)
            pre, suf = attr_tr(pre, fn), attr_tr(suf, fn)
            if core and translatable(core):
                out.append(pre + fn(norm(core)) + suf)
            else:
                out.append(pre + core + suf if core else chunk if not (pre or suf) else pre + core + suf)
            continue
        low = chunk[:60].lower()
        if low.startswith('<script'):
            m = re.match(r'(<script\b[^>]*>)(.*?)(</script\s*>)', chunk, re.S | re.I)
            open_t, body, close_t = m.groups()
            if 'ld+json' in open_t:
                try:
                    data = json.loads(body)
                    data = walk_json(data, fn)
                    body = '\n' + json.dumps(data, ensure_ascii=False, indent=1) + '\n  '
                except Exception as e:
                    print('JSON-LD illisible', e, file=sys.stderr)
            elif js_fn is not None and 'src=' not in open_t:
                body = js_fn(body)
            out.append(open_t + body + close_t)
            continue
        if chunk.startswith('<') and not chunk.startswith('<!--') and not low.startswith('<style'):
            chunk = attr_tr(chunk, fn)
        out.append(chunk)
    return ''.join(out)


def attr_tr(chunk, fn):
    """Traduit les attributs (alt, aria-label…) des balises contenues dans chunk."""
    def one(m0):
        tag = m0.group(0)
        if tag.startswith('<!--') or tag.startswith('</'):
            return tag
        targets = attr_targets(tag)
        if not targets:
            return tag
        def rep(m):
            n = m.group(2).lower()
            if n in targets:
                val = m.group(5) if m.group(5) is not None else m.group(6)
                if translatable(val):
                    q = '"' if m.group(5) is not None else "'"
                    nv = fn(norm(html.unescape(val)))
                    nv = html.escape(nv, quote=True) if q == '"' else nv.replace("'", '&#39;')
                    return f'{m.group(1)}{m.group(2)}{m.group(3)}{q}{nv}{q}'
            return m.group(0)
        return ATTR_RE.sub(rep, tag)
    return re.sub(r'<[^<>]+>', one, chunk)


def js_process(body, fn, known=None):
    def rep(m):
        s = m.group(1) if m.group(1) is not None else m.group(2)
        q = "'" if m.group(1) is not None else '"'
        if not (js_candidate(s) or (known is not None and s in known)):
            return m.group(0)
        unesc = s.replace("\\'", "'").replace('\\"', '"')
        t = fn(norm(unesc))
        if t == norm(unesc):
            return m.group(0)
        lead = unesc[:len(unesc) - len(unesc.lstrip())]; trail = unesc[len(unesc.rstrip()):]
        t = lead + t + trail
        t = t.replace('\\', '\\\\').replace(q, '\\' + q)
        return q + t + q
    return JS_STR.sub(rep, body)


def extract(repo):
    col = Collector()
    for url, path in fr_files(repo):
        src = open(path, encoding='utf-8').read()
        process(src, lambda s: (col.add(s), s)[1], js_fn=lambda b: js_process(b, lambda s: (col.add(s), s)[1]))
    data = {col.ids[s]: s for s in col.order}
    json.dump(data, open(os.path.join(HERE, 'segments.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print(len(data), 'segments,', sum(len(s.split()) for s in data.values()), 'mots')


# ---------------- build ----------------
def load_tr(lang):
    seg = json.load(open(os.path.join(HERE, 'segments.json'), encoding='utf-8'))
    tr = {}
    p = os.path.join(HERE, f'{lang}.json')
    if os.path.exists(p):
        tr = json.load(open(p, encoding='utf-8'))
    return {fr: tr.get(i) for i, fr in seg.items()}


def url_for(path, lang):
    """Convertit un lien interne FR (/page/ ou /page/#ancre) vers la langue cible."""
    m = re.match(r'^(/[^#?]*)([?#].*)?$', path)
    if not m:
        return path
    base, tail = m.group(1), m.group(2) or ''
    if not base.endswith('/') and '.' not in base.rsplit('/', 1)[-1]:
        base += '/'
    if base in ALL_MAP:
        return ALL_MAP[base][lang] + tail
    return path


def switcher(cur_lang, urls):
    items = []
    for l in ('fr', 'en', 'lb'):
        lab = LANG_META[l]['label']
        if l == cur_lang:
            items.append(f'<strong aria-current="true" style="padding:.1rem .45rem;border-radius:999px;background:rgba(36,18,4,.85);color:#ffc15c">{lab}</strong>')
        else:
            items.append(f'<a href="{urls[l]}" hreflang="{l}" lang="{l}" style="padding:.1rem .45rem;border-radius:999px;text-decoration:none">{lab}</a>')
    return ('<nav class="lang-switch" aria-label="Langue / Language / Sprooch" style="display:inline-flex;gap:.25rem;'
            'margin-left:.8rem;padding:.12rem .25rem;border-radius:999px;background:rgba(36,18,4,.12);font-size:.78rem;vertical-align:middle">'
            + ''.join(items) + '</nav>')


def add_i18n_head(src, fr_url, lang):
    urls = {'fr': fr_url, 'en': ALL_MAP[fr_url]['en'], 'lb': ALL_MAP[fr_url]['lb']}
    src = re.sub(r'\s*<link rel="alternate" hreflang="[^"]*" href="[^"]*">', '', src)
    links = ''.join(f'\n  <link rel="alternate" hreflang="{l}" href="{SITE}{urls[l]}">' for l in ('fr', 'en', 'lb'))
    links += f'\n  <link rel="alternate" hreflang="x-default" href="{SITE}{fr_url}">'
    src = re.sub(r'(<link rel="canonical"[^>]*>)', lambda m: m.group(1) + links, src, count=1)
    # sélecteur de langue dans le bandeau du haut
    src = re.sub(r'\s*<nav class="lang-switch".*?</nav>', '', src, flags=re.S)
    sw = switcher(lang, urls)
    src, n = re.subn(r'(<div class="topbar[^"]*"[^>]*>.*?)(</div>)', lambda m: m.group(1) + sw + m.group(2), src, count=1, flags=re.S)
    if not n:
        src = re.sub(r'(<body[^>]*>)', lambda m: m.group(1) + f'<div style="text-align:right;padding:.3rem 1rem">{sw}</div>', src, count=1)
    return src


def localize_paths(src, fr_url, lang):
    depth_fr = 0 if fr_url == '/' else fr_url.strip('/').count('/') + 1
    new_url = ALL_MAP[fr_url][lang]
    depth_new = new_url.strip('/').count('/') + 1
    up = '../' * depth_new

    def fix_rel(val):
        if re.match(r'^(https?:|mailto:|tel:|data:|#|/|javascript:)', val) or val == '':
            return val
        # chemin relatif : on le rend relatif à la racine puis on remonte
        v = val
        for _ in range(depth_fr):
            if v.startswith('../'):
                v = v[3:]
        return up + v

    def rep(m):
        n = m.group(2).lower()
        val = m.group(5) if m.group(5) is not None else m.group(6)
        q = '"' if m.group(5) is not None else "'"
        if n in ('href', 'src', 'action', 'srcset', 'poster', 'data-src'):
            if n == 'href' and val.startswith('/'):
                val = url_for(val, lang)
            elif n == 'href' and val.startswith(SITE + '/'):
                val = SITE + url_for(val[len(SITE):], lang)
            elif n == 'srcset':
                val = ', '.join(fix_rel(p.strip().split(' ')[0]) + (' ' + ' '.join(p.strip().split(' ')[1:]) if len(p.strip().split(' ')) > 1 else '') for p in val.split(','))
            else:
                val = fix_rel(val)
        return f'{m.group(1)}{m.group(2)}{m.group(3)}{q}{val}{q}'
    out = []
    for kind, chunk in split_runs(src):
        if chunk.startswith('<') and not chunk.startswith('<!--') and not chunk[:7].lower() in ('<script', '<style') and not chunk[:7].lower().startswith('<script') and not chunk[:6].lower().startswith('<style'):
            chunk = ATTR_RE.sub(rep, chunk)
        elif kind == 'run' and '<a' in chunk:
            chunk = re.sub(r'(<a\b[^>]*>)', lambda m: ATTR_RE.sub(rep, m.group(1)), chunk)
        out.append(chunk)
    src = ''.join(out)
    # url() relatives dans les styles inline
    src = re.sub(r"url\((['\"]?)(?!https?:|data:|/)([^)'\"]+)\1\)", lambda m: f"url({m.group(1)}{fix_rel(m.group(2))}{m.group(1)})", src)
    # canonical, og:url, JSON-LD : URL absolues de la page
    src = src.replace(f'"{SITE}{fr_url}', f'"{SITE}{new_url}')
    for fu, langs in ALL_MAP.items():
        if fu == '/':
            continue
        src = src.replace(f'"{SITE}{fu}', f'"{SITE}{langs[lang]}')
    src = src.replace(f'"{SITE}/#', f'"{SITE}{ALL_MAP["/"][lang]}#') if fr_url == '/' else src
    return src


def build(repo, lang):
    tr = load_tr(lang)
    missing = set()

    def fn(s):
        t = tr.get(s)
        if t is None:
            missing.add(s)
            return s
        return t
    for fr_url, path in fr_files(repo):
        src = open(path, encoding='utf-8').read()
        out = process(src, fn, js_fn=lambda b: js_process(b, fn, known=set(k for k, v in tr.items() if v)))
        meta = LANG_META[lang]
        out = re.sub(r'<html lang="[^"]*"', f'<html lang="{meta["html"]}"', out, count=1)
        out = re.sub(r'(<meta property="og:locale" content=")[^"]*', lambda m: m.group(1) + meta['locale'], out)
        out = out.replace('"inLanguage":"fr-FR"', f'"inLanguage":"{lang}"').replace('"inLanguage": "fr-FR"', f'"inLanguage": "{lang}"')
        out = localize_paths(out, fr_url, lang)
        out = add_i18n_head(out, fr_url, lang)
        if fr_url == '/demande-de-projet/':
            out = out.replace('name="site_web_confirm"', f'name="site_web_confirm" data-lang="{lang}"')
            out = out.replace("var d={};", f"var d={{lang:'{lang}'}};")
        dest = os.path.join(repo, ALL_MAP[fr_url][lang].strip('/'), 'index.html')
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        open(dest, 'w', encoding='utf-8').write(out)
    if missing:
        print(f'[{lang}] {len(missing)} segments sans traduction :', file=sys.stderr)
        for s in list(missing)[:40]:
            print('   -', s[:120], file=sys.stderr)
    print(f'[{lang}] pages générées')


def add_switch_fr(repo):
    """Ajoute hreflang + sélecteur de langue aux pages FR (et aux pages Luxembourg existantes)."""
    for fr_url, path in list(fr_files(repo)) + [('/creation-site-internet-luxembourg/', os.path.join(repo, 'creation-site-internet-luxembourg/index.html'))]:
        src = open(path, encoding='utf-8').read()
        if fr_url in EXISTING:
            # page FR Luxembourg : garde son sélecteur existant (avec DE), ajoute juste rien
            continue
        src = add_i18n_head(src, fr_url, 'fr')
        open(path, 'w', encoding='utf-8').write(src)


if __name__ == '__main__':
    cmd, repo = sys.argv[1], sys.argv[2]
    if cmd == 'extract':
        extract(repo)
    elif cmd == 'build':
        build(repo, sys.argv[3])
    elif cmd == 'frswitch':
        add_switch_fr(repo)
