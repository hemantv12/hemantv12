"""Removes CSS rules whose classes or ids appear nowhere in the site's HTML or JavaScript.

    python tools/site/prune-css.py              report only
    python tools/site/prune-css.py --write      rewrite the stylesheets

A selector is dropped only when one of its class/id names is missing from every page and
script. Names inside :not() / :is() / :where() / :has() are ignored, so those selectors are
kept. Unused @keyframes are dropped afterwards. Verify visually after running with --write.
"""
import pathlib, re, sys

SITE = pathlib.Path(__file__).resolve().parents[2] / "rti-growth-studio"
SHEETS = ["assets/aa-studio.css", "assets/motion-system.css", "assets/conversion-system.css", "assets/cms-blog.css"]

corpus = set()
for f in list(SITE.rglob("*.html")) + list(SITE.rglob("*.js")):
    corpus.update(re.findall(r"[A-Za-z_][\w-]*", f.read_text(encoding="utf-8", errors="ignore")))

FUNC = re.compile(r":(?:not|is|where|has)\((?:[^()]|\([^()]*\))*\)")
def selector_alive(sel):
    names = re.findall(r"[.#](-?[A-Za-z_][\w-]*)", FUNC.sub("", sel))
    return all(n in corpus for n in names)

def parse(css, i=0):
    """Returns a list of nodes: ('comment', text) | ('at', prelude, children|None, raw) | ('rule', selector, body)."""
    nodes = []
    while i < len(css):
        if css.startswith("/*", i):
            j = css.index("*/", i) + 2; nodes.append(("comment", css[i:j])); i = j; continue
        if css[i] == "}":
            return nodes, i + 1
        if css[i].isspace():
            j = i
            while j < len(css) and css[j].isspace(): j += 1
            nodes.append(("ws", css[i:j])); i = j; continue
        j = i
        while j < len(css) and css[j] not in "{;}":
            if css.startswith("/*", j): j = css.index("*/", j) + 2
            else: j += 1
        prelude = css[i:j]
        if j < len(css) and css[j] == ";":
            nodes.append(("at", prelude + ";", None, None)); i = j + 1; continue
        if prelude.lstrip().startswith("@") and re.match(r"\s*@(media|supports|layer|container)\b", prelude):
            children, i = parse(css, j + 1); nodes.append(("at", prelude, children, None)); continue
        depth, k = 1, j + 1
        while depth:
            depth += {"{": 1, "}": -1}.get(css[k], 0); k += 1
        nodes.append(("rule", prelude, css[j + 1:k - 1])); i = k
    return nodes, i

def split_top_level(selector):
    """Splits a selector list on commas outside parentheses, so :is(a,b) stays whole."""
    parts, depth, start = [], 0, 0
    for i, ch in enumerate(selector):
        depth += (ch == "(") - (ch == ")")
        if ch == "," and depth == 0:
            parts.append(selector[start:i]); start = i + 1
    return parts + [selector[start:]]

def prune(nodes, stats):
    out = []
    for n in nodes:
        if n[0] == "rule" and not n[1].lstrip().startswith("@"):
            parts = split_top_level(n[1])
            alive = [s for s in parts if selector_alive(s)]
            stats["selectors"] += len(parts) - len(alive)
            if not alive: stats["rules"] += 1; continue
            out.append(("rule", ",".join(alive), n[2]))
        elif n[0] == "at" and n[2] is not None:
            kids = prune(n[2], stats)
            if any(k[0] in ("rule", "at") for k in kids): out.append(("at", n[1], kids, None))
            else: stats["rules"] += 1
        else:
            out.append(n)
    return out

def emit(nodes):
    s = []
    for n in nodes:
        if n[0] in ("comment", "ws"): s.append(n[1])
        elif n[0] == "rule": s.append(f"{n[1]}{{{n[2]}}}")
        elif n[2] is None: s.append(n[1])
        else: s.append(f"{n[1]}{{{emit(n[2])}}}")
    return "".join(s)

def drop_unused_keyframes(css):
    used = set(re.findall(r"animation(?:-name)?\s*:[^;}]*", css))
    names = " ".join(used)
    out, i = [], 0
    for m in re.finditer(r"@(?:-webkit-)?keyframes\s+([\w-]+)\s*\{", css):
        if m.start() < i: continue
        depth, k = 1, m.end()
        while depth:
            depth += {"{": 1, "}": -1}.get(css[k], 0); k += 1
        block = css[m.start():k]
        out.append(css[i:m.start()])
        out.append(block if re.search(rf"\b{re.escape(m.group(1))}\b", names) else "")
        i = k
    out.append(css[i:])
    return "".join(out)

write = "--write" in sys.argv
for rel in SHEETS:
    f = SITE / rel; css = f.read_text(encoding="utf-8")
    stats = {"selectors": 0, "rules": 0}
    nodes, _ = parse(css)
    new = drop_unused_keyframes(emit(prune(nodes, stats)))
    new = re.sub(r"\n{3,}", "\n\n", new)
    print(f"{rel:30} {len(css)//1024:4} KB -> {len(new)//1024:4} KB   removed {stats['rules']} rules, {stats['selectors']} dead selectors")
    if write: f.write_text(new, encoding="utf-8")
