#!/usr/bin/env python3
"""
extract_sow.py  -  part of the SOW Atlas skill

Turns a Statement of Work (.docx, .pdf, .md, .txt) into numbered sections so the
SOW can be read carefully and every claim in the atlas can be traced to a clause.

Usage:
    python3 extract_sow.py <sow file> --out sections.json [--print]

Output (sections.json):
    {
      "source_file": "LVH_Clearpath_SOW.docx",
      "sections": [
        {"id": "1", "title": "Background and Client Environment", "level": 1, "text": "..."},
        {"id": "1.1", "title": "About the Client", "level": 2, "text": "..."},
        ...
      ]
    }

Sections are detected from Word heading styles, markdown headings, or numbered
heading lines such as "6.2 Data, Systems and Environments". Text that appears
before the first numbered heading is stored as section "0" (Preamble).
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

HEADING_RE = re.compile(r"^(?:section\s+)?(\d+(?:\.\d+){0,3})\.?\s+([A-Z][^\n]{1,110})$", re.I)


def read_docx(path):
    try:
        import docx  # python-docx
    except ImportError:
        sys.exit("python-docx is required for .docx files: pip install python-docx")
    d = docx.Document(str(path))
    fmts = _numbering_formats(d)
    lines = []
    counters = {}
    for p in d.paragraphs:
        t = p.text.strip()
        if not t:
            continue
        style = (p.style.name or "").lower() if p.style is not None else ""
        m = re.match(r"heading\s*(\d)", style)
        if m:
            counters = {}
            lines.append(("#" * int(m.group(1))) + " " + t)
            continue
        # Word auto-numbered lists lose their "(a)" markers in p.text; rebuild them
        num = _num_of(p)
        if num:
            num_id, lvl = num
            key = (num_id, lvl)
            counters[key] = counters.get(key, 0) + 1
            fmt, txt = fmts.get(key, ("lowerLetter", "(%1)"))
            label = _format_marker(fmt, txt, counters[key])
            if label and not t.startswith(label):
                t = f"{label} {t}"
        lines.append(t)
    # tables: flatten row by row so fee tables and RACI tables are not lost
    for table in d.tables:
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells]
            if any(cells):
                lines.append(" | ".join(cells))
    return lines


W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def _num_of(p):
    ppr = p._p.pPr
    if ppr is None or ppr.numPr is None:
        return None
    try:
        return int(ppr.numPr.numId.val), int(ppr.numPr.ilvl.val if ppr.numPr.ilvl is not None else 0)
    except Exception:
        return None


def _numbering_formats(d):
    """Map (numId, ilvl) -> (numFmt, lvlText) from the numbering part, if present."""
    out = {}
    try:
        root = d.part.numbering_part.element
    except Exception:
        return out
    abstract = {}
    for an in root.iter(W_NS + "abstractNum"):
        aid = an.get(W_NS + "abstractNumId")
        for lvl in an.iter(W_NS + "lvl"):
            il = int(lvl.get(W_NS + "ilvl"))
            f = lvl.find(W_NS + "numFmt")
            tx = lvl.find(W_NS + "lvlText")
            abstract[(aid, il)] = (f.get(W_NS + "val") if f is not None else "decimal",
                                   tx.get(W_NS + "val") if tx is not None else "%1.")
    for num in root.iter(W_NS + "num"):
        nid = int(num.get(W_NS + "numId"))
        a = num.find(W_NS + "abstractNumId")
        if a is None:
            continue
        aid = a.get(W_NS + "val")
        for (k_aid, il), v in abstract.items():
            if k_aid == aid:
                out[(nid, il)] = v
    return out


def _format_marker(fmt, txt, n):
    if fmt == "bullet":
        return ""
    if fmt == "lowerLetter":
        s = chr(ord("a") + n - 1)
    elif fmt == "upperLetter":
        s = chr(ord("A") + n - 1)
    elif fmt == "lowerRoman":
        s = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii"][n - 1]
    else:
        s = str(n)
    return txt.replace("%1", s)


def read_pdf(path):
    text = None
    try:
        out = subprocess.run(["pdftotext", "-layout", str(path), "-"], capture_output=True, text=True, check=True)
        text = out.stdout
    except Exception:
        try:
            import pdfplumber
            with pdfplumber.open(str(path)) as pdf:
                text = "\n".join((pg.extract_text() or "") for pg in pdf.pages)
        except Exception as e:  # pragma: no cover
            sys.exit(f"Could not read PDF ({e}). If it is scanned, OCR it first.")
    if not text or len(text.strip()) < 200:
        sys.exit("The PDF has almost no extractable text. It is probably scanned; OCR it first.")
    # re-join hard-wrapped lines into paragraphs
    lines, buf = [], []
    for raw in text.splitlines():
        s = raw.strip()
        if not s:
            if buf:
                lines.append(" ".join(buf)); buf = []
            continue
        if HEADING_RE.match(s) and len(s) < 120:
            if buf:
                lines.append(" ".join(buf)); buf = []
            lines.append(s)
        else:
            buf.append(s)
    if buf:
        lines.append(" ".join(buf))
    return lines


def read_text(path):
    raw = Path(path).read_text(encoding="utf-8", errors="replace")
    raw = re.sub(r"^---\n.*?\n---\n", "", raw, flags=re.S)  # yaml front matter
    lines, buf = [], []
    for s in raw.splitlines():
        s = s.rstrip()
        if not s.strip():
            if buf:
                lines.append(" ".join(buf)); buf = []
            continue
        if s.lstrip().startswith("#"):
            if buf:
                lines.append(" ".join(buf)); buf = []
            lines.append(s.strip())
        else:
            buf.append(s.strip())
    if buf:
        lines.append(" ".join(buf))
    return lines


def clean_inline(t):
    t = re.sub(r"\*\*(.+?)\*\*", r"\1", t)
    t = re.sub(r"(?<!\w)\*(.+?)\*(?!\w)", r"\1", t)
    t = t.replace(" ", " ")
    return t.strip()


def sectionize(lines):
    sections = [{"id": "0", "title": "Preamble", "level": 1, "paras": []}]
    for line in lines:
        md = re.match(r"^(#{1,6})\s+(.*)$", line)
        cand = md.group(2).strip() if md else line.strip()
        m = HEADING_RE.match(clean_inline(cand))
        if m and (md or len(cand) < 90):
            sid, title = m.group(1), m.group(2).strip()
            sections.append({"id": sid, "title": clean_inline(title), "level": sid.count(".") + 1, "paras": []})
        elif md and not m:
            # unnumbered markdown heading: keep as bold paragraph in current section
            sections[-1]["paras"].append(clean_inline(cand))
        else:
            sections[-1]["paras"].append(clean_inline(line))
    out = []
    for s in sections:
        text = "\n\n".join(p for p in s["paras"] if p)
        if s["id"] == "0" and not text:
            continue
        out.append({"id": s["id"], "title": s["title"], "level": s["level"], "text": text})
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("sow")
    ap.add_argument("--out", required=True)
    ap.add_argument("--print", action="store_true", help="print full text of every section")
    a = ap.parse_args()
    p = Path(a.sow)
    ext = p.suffix.lower()
    if ext == ".docx":
        lines = read_docx(p)
    elif ext == ".pdf":
        lines = read_pdf(p)
    elif ext in (".md", ".txt", ".markdown"):
        lines = read_text(p)
    else:
        sys.exit(f"Unsupported file type {ext}. Use .docx, .pdf, .md or .txt.")
    secs = sectionize(lines)
    Path(a.out).write_text(json.dumps({"source_file": p.name, "sections": secs}, indent=2, ensure_ascii=False), encoding="utf-8")
    words = sum(len(s["text"].split()) for s in secs)
    print(f"{p.name}: {len(secs)} sections, about {words:,} words. Wrote {a.out}\n")
    for s in secs:
        indent = "  " * (s["level"] - 1)
        print(f"{indent}{s['id']:<6} {s['title']}  ({len(s['text'].split())} words)")
        if a.print:
            print(s["text"] + "\n")
    if len(secs) < 4:
        print("\nWarning: very few sections were detected. Check that headings are numbered "
              "(for example '6.2 Data and Systems') or use Word heading styles.")


if __name__ == "__main__":
    main()
