#!/usr/bin/env python3
"""
build_atlas.py  -  part of the SOW Atlas skill

Validates sow.json, checks every source excerpt against the SOW text, and writes
the interactive atlas HTML (and optionally a one-page markdown brief).

Usage:
    python3 build_atlas.py --data sow.json --sections sections.json \
        --template ../assets/atlas_template.html --out Project_SOW_Atlas.html \
        [--brief Project_brief.md] [--strict]

Exit code is 1 if there are errors. Warnings are printed but do not stop the build
unless --strict is passed.
"""
import argparse
import json
import re
import sys
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

PLACEHOLDER_DATA = "/*__SOW_DATA__*/null"
PLACEHOLDER_SECTIONS = "/*__SOW_SECTIONS__*/null"


def norm(t):
    t = t.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")
    t = t.replace("–", "-").replace("—", "-").replace(" ", " ")
    t = re.sub(r"\*\*|__", "", t)
    return re.sub(r"\s+", " ", t).strip().lower()


class Report:
    def __init__(self):
        self.errors, self.warnings = [], []

    def err(self, m):
        self.errors.append(m)

    def warn(self, m):
        self.warnings.append(m)


def walk_src(obj, path, found):
    """Collect every src key used anywhere in the data."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "src" and isinstance(v, list):
                for key in v:
                    found.append((key, path))
            else:
                walk_src(v, f"{path}.{k}", found)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            walk_src(v, f"{path}[{i}]", found)


def find_cycle(graph):
    state, stack = {}, []

    def dfs(n):
        state[n] = 1
        stack.append(n)
        for m in graph.get(n, []):
            if state.get(m) == 1:
                return stack[stack.index(m):] + [m]
            if state.get(m) is None:
                c = dfs(m)
                if c:
                    return c
        state[n] = 2
        stack.pop()
        return None

    for n in graph:
        if state.get(n) is None:
            c = dfs(n)
            if c:
                return c
    return None


def validate(d, sections, r):
    for block in ["meta", "deliverables", "workstreams", "sources"]:
        if block not in d:
            r.err(f"Missing required block '{block}'.")
    if r.errors:
        return
    m = d["meta"]
    for f in ["project", "client", "start_date", "weeks", "headline"]:
        if not m.get(f):
            r.err(f"meta.{f} is required.")

    ws_ids = {w["id"] for w in d["workstreams"]}
    dl = {x["id"]: x for x in d["deliverables"]}
    cd = {x["id"]: x for x in d.get("client_deps", [])}
    weeks = int(m.get("weeks") or 0)

    if len(dl) != len(d["deliverables"]):
        r.err("Duplicate deliverable ids.")
    for x in d["deliverables"]:
        if x.get("ws") not in ws_ids:
            r.err(f"{x['id']}: workstream '{x.get('ws')}' does not exist.")
        if x.get("type") not in ("document", "build", "golive", "gate"):
            r.err(f"{x['id']}: type must be document, build, golive or gate.")
        if not isinstance(x.get("week"), int) or not (0 <= x["week"] <= weeks + 4):
            r.err(f"{x['id']}: week {x.get('week')} is outside the plan (0 to {weeks}).")
        for dep in x.get("depends", []):
            if dep not in dl:
                r.err(f"{x['id']}: depends on unknown deliverable {dep}.")
            elif dl[dep]["week"] > x["week"]:
                r.warn(f"{x['id']} (week {x['week']}) depends on {dep}, which is planned later (week {dl[dep]['week']}).")
        for n in x.get("needs", []):
            if n not in cd:
                r.err(f"{x['id']}: needs unknown client dependency {n}.")
        if not x.get("src"):
            r.warn(f"{x['id']}: no source clause cited.")
    cyc = find_cycle({k: v.get("depends", []) for k, v in dl.items()})
    if cyc:
        r.err("Dependency cycle: " + " -> ".join(cyc))
    for c in cd.values():
        for f in c.get("feeds", []):
            if f not in dl:
                r.err(f"client dependency {c['id']}: feeds unknown deliverable {f}.")
            elif c["id"] not in dl[f].get("needs", []):
                r.warn(f"client dependency {c['id']} feeds {f}, but {f}.needs does not list it.")

    # payments
    fees = d.get("fees", {})
    pays = d.get("payments", [])
    for p in pays:
        if p.get("trigger") not in dl:
            r.err(f"payment {p.get('id')}: trigger {p.get('trigger')} is not a deliverable.")
    if fees.get("model", "fixed") == "fixed" and fees.get("fixed"):
        total = sum(p.get("amount", 0) for p in pays)
        if abs(total - fees["fixed"]) > 1:
            r.err(f"Payment milestones add up to {total:,.0f}, but the fixed fee is {fees['fixed']:,.0f}.")
        pct = sum(p.get("pct", 0) for p in pays)
        if pays and abs(pct - 100) > 0.01:
            r.err(f"Payment percentages add up to {pct}%, not 100%.")

    # measures
    for ms in d.get("measures", []):
        for f in ["id", "label", "baseline", "target", "better"]:
            if f not in ms:
                r.err(f"measure {ms.get('id','?')}: missing {f}.")
        if ms.get("better") == "down" and ms.get("target", 0) > ms.get("baseline", 0):
            r.warn(f"measure {ms['id']}: 'better' is down but target is above baseline.")
        if ms.get("better") == "up" and ms.get("target", 0) < ms.get("baseline", 0):
            r.warn(f"measure {ms['id']}: 'better' is up but target is below baseline.")

    # people references
    ppl = d.get("people", {})
    pid = {p["id"] for p in ppl.get("ibm", []) + ppl.get("client", [])}
    for pr in ppl.get("pairs", []):
        for i in pr.get("ibm", []) + pr.get("client", []):
            if i not in pid:
                r.err(f"people.pairs '{pr.get('area')}': unknown person id {i}.")

    # risk links
    for rk in d.get("risks", []):
        for l in rk.get("links", []):
            if l not in dl and l not in cd:
                r.err(f"risk {rk['id']}: link {l} is not a deliverable or client dependency.")
        for f in ("likelihood", "impact"):
            if not (1 <= int(rk.get(f, 0)) <= 5):
                r.err(f"risk {rk['id']}: {f} must be 1 to 5.")

    # process mapping
    proc = d.get("process", {})
    cur_ids = {s["id"] for s in proc.get("current", [])}
    for s in proc.get("future", []):
        for t in s.get("maps_to", []):
            if t not in cur_ids:
                r.err(f"process.future {s['id']}: maps_to unknown current step {t}.")

    # sources: every key exists, every excerpt is verbatim
    used = []
    walk_src(d, "$", used)
    srcs = d["sources"]
    for key, path in used:
        if key not in srcs:
            r.err(f"{path}: source key '{key}' is not defined in sources.")
    full = norm(" ".join(s["text"] for s in sections))
    for key, s in srcs.items():
        if not s.get("text"):
            r.err(f"source {key}: empty text.")
            continue
        if norm(s["text"]) not in full:
            r.err(f"source {key} ({s.get('sec')}): excerpt not found verbatim in the SOW: \"{s['text'][:90]}...\"")
    unused = set(srcs) - {k for k, _ in used}
    for k in sorted(unused):
        r.warn(f"source {k} is defined but never cited.")

    # coverage: which numbered sections are cited
    cited_tops = set()
    for s in srcs.values():
        sec = str(s.get("sec", ""))
        mm = re.match(r"(\d+(?:\.\d+)?)", sec)
        if mm:
            cited_tops.add(mm.group(1))
            cited_tops.add(mm.group(1).split(".")[0])
    missing = []
    for s in sections:
        if s["id"] == "0" or len(s["text"].split()) < 25:
            continue
        if s["id"] not in cited_tops and s["id"].split(".")[0] not in cited_tops:
            missing.append(f"{s['id']} {s['title']}")
        elif "." in s["id"] and s["id"] not in cited_tops:
            missing.append(f"{s['id']} {s['title']} (parent cited)")
    for mi in missing:
        r.warn(f"SOW section {mi} is not cited by any source. Check nothing was missed.")
    return len(sections), len(missing)


def font_css(font_dir):
    """Embed the bundled fonts (TeX Gyre Heros, GUST Font License) as data URLs so the page works offline."""
    import base64
    faces = [("Heros", "heros-regular.woff", 400), ("Heros", "heros-bold.woff", 700),
             ("Heros Cn", "heroscn-regular.woff", 400), ("Heros Cn", "heroscn-bold.woff", 700)]
    css = []
    for fam, fn, wt in faces:
        p = font_dir / fn
        if p.exists():
            b64 = base64.b64encode(p.read_bytes()).decode()
            css.append(f"@font-face{{font-family:'{fam}';src:url(data:font/woff;base64,{b64}) format('woff');font-weight:{wt};font-style:normal;font-display:swap}}")
    return "\n".join(css)


def money(v):
    return f"${v:,.0f}"


def wk_date(start, w, kind="document"):
    """Go-lives fall on the Monday of their week; everything else is due on the Friday."""
    s = date.fromisoformat(start)
    return s + timedelta(weeks=w - 1, days=0 if kind == "golive" else 4)


def brief(d):
    m, fees = d["meta"], d.get("fees", {})
    dl = {x["id"]: x for x in d["deliverables"]}
    lines = [f"# {m['project']} in one page", ""]
    if m.get("fictional"):
        lines += ["_Fictional SOW used for demonstration. No client data._", ""]
    lines += [f"**{m['headline']}**", "", m.get("summary", ""), ""]
    lines += ["## The deal", ""]
    for x in d.get("deal", []):
        note = f" ({x['note']})" if x.get("note") else ""
        lines.append(f"- {x['label']}: {x['value']}{note}")
    if d.get("measures"):
        lines += ["", "## What success looks like", ""]
        for ms in d["measures"]:
            base = ms.get("baseline_label") or f"{ms['baseline']}{ms.get('unit','')}"
            lines.append(f"- {ms['label']}: {base} today, target {ms['target']}{ms.get('unit','')}")
        if d.get("measures_note"):
            lines += ["", f"_{d['measures_note']['text']}_"]
    gates = [x for x in d["deliverables"] if x["type"] in ("gate", "golive") or x.get("milestone")]
    lines += ["", "## Key dates", ""]
    for x in sorted(gates, key=lambda x: x["week"]):
        lines.append(f"- Week {x['week']} ({wk_date(m['start_date'], x['week'], x['type']).strftime('%b %d, %Y')}): {x['name']}")
    cl = [o for o in d.get("obligations", []) if o.get("party") in ("client", "both")]
    if cl:
        cs = m.get("client_short", "the client")
        lines += ["", f"## What {cs} has to do", ""]
        for o in sorted([o for o in cl if not o.get("until")], key=lambda o: o.get("week", 0)):
            when = "Before the start" if o["week"] <= 0 else f"By week {o['week']}"
            lines.append(f"- {when}: {o['text']}")
        spans = [o for o in cl if o.get("until")]
        if spans:
            lines += ["", "Ongoing:", ""]
            for o in sorted(spans, key=lambda o: o.get("week", 0)):
                lines.append(f"- Weeks {o['week']} to {o['until']}: {o['text']}")
    if fees.get("fixed"):
        lines += ["", "## Money", "", f"Fixed fee of {money(fees['fixed'])}, paid on these milestones:", ""]
        for p in d.get("payments", []):
            w = dl[p["trigger"]]["week"]
            lines.append(f"- {p['label']} (week {w}): {money(p['amount'])}")
    out = d.get("scope", {}).get("out", [])
    if out:
        lines += ["", "## Not included", ""]
        for o in out:
            owner = f" (owner: {o['owner']})" if o.get("owner") else ""
            lines.append(f"- {o['text']}{owner}")
    top = sorted(d.get("risks", []), key=lambda r: -(r["likelihood"] * r["impact"]))[:4]
    if top:
        lines += ["", "## Risks to watch", ""]
        for rk in top:
            lines.append(f"- {rk['title']}. Watch for: {rk['signal']}")
    lines += ["", f"_Built with SOW Atlas from {m.get('sow_number','the SOW')}. Open the atlas for the full interactive view and clause references._", ""]
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--sections", required=True)
    ap.add_argument("--template", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--brief")
    ap.add_argument("--strict", action="store_true")
    a = ap.parse_args()

    d = json.loads(Path(a.data).read_text(encoding="utf-8"))
    sj = json.loads(Path(a.sections).read_text(encoding="utf-8"))
    sections = sj["sections"]
    r = Report()
    res = validate(d, sections, r)

    for w in r.warnings:
        print("warning:", w)
    for e in r.errors:
        print("ERROR:  ", e)
    if r.errors or (a.strict and r.warnings):
        print(f"\nBuild stopped: {len(r.errors)} errors, {len(r.warnings)} warnings.")
        sys.exit(1)

    tpl_path = Path(a.template)
    tpl = tpl_path.read_text(encoding="utf-8")
    if PLACEHOLDER_DATA not in tpl or PLACEHOLDER_SECTIONS not in tpl:
        sys.exit("Template is missing the data placeholders.")
    js_path = tpl_path.parent / "atlas.js"
    if "/*__JS__*/" in tpl:
        if not js_path.exists():
            sys.exit(f"Renderer not found at {js_path}.")
        tpl = tpl.replace("/*__JS__*/", js_path.read_text(encoding="utf-8").replace("</script", "<\\/script"))
    if "/*__FONTS__*/" in tpl:
        tpl = tpl.replace("/*__FONTS__*/", font_css(tpl_path.parent / "fonts"))
    payload = json.dumps(d, ensure_ascii=False).replace("</", "<\\/")
    secs = json.dumps([{"id": s["id"], "title": s["title"], "text": s["text"]} for s in sections], ensure_ascii=False).replace("</", "<\\/")
    html = tpl.replace(PLACEHOLDER_DATA, payload).replace(PLACEHOLDER_SECTIONS, secs)
    html = html.replace("{{TITLE}}", f"{d['meta']['project']} SOW Atlas")
    Path(a.out).write_text(html, encoding="utf-8")

    n_src = len(d["sources"])
    total, missing = res if res else (0, 0)
    print(f"\nBuilt {a.out}")
    print(f"  {len(d['deliverables'])} deliverables, {len(d.get('client_deps', []))} client dependencies, "
          f"{len(d.get('risks', []))} risks, {len(d.get('obligations', []))} obligations")
    print(f"  {n_src} verbatim source excerpts checked against {total} SOW sections ({missing} uncited)")
    if a.brief:
        Path(a.brief).write_text(brief(d), encoding="utf-8")
        print(f"  Brief written to {a.brief}")


if __name__ == "__main__":
    main()
