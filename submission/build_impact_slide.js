const pptxgen = require("pptxgenjs");
const { applyTheme } = require("/sessions/serene-happy-turing/mnt/.claude/skills/pptx/scripts/apply_theme.js");

const OUT = process.argv[2] || "SOW_Atlas_Impact_Summary.pptx";
const THEME = {
  name: "SOW Atlas",
  headFontFace: "Arial",
  bodyFontFace: "Arial",
  colors: {
    dk1: "17222D", lt1: "FFFFFF", dk2: "25374A", lt2: "EDF0EF",
    accent1: "F1C21B", accent2: "0F62FE", accent3: "8A3FFC", accent4: "007D79",
    accent5: "D02670", accent6: "198038", hlink: "0043CE", folHlink: "6929C4",
  },
};
const MUTED = "C9D3DA", DIM = "9AA9B6", PANEL = "25374A", NAVY = "17222D";

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
  pres.title = "SOW Atlas: business impact summary";
  pres.author = "Anubhav Sen";
  pres.company = "IBM Consulting";
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  const C = pres.SchemeColor;

  pres.defineSlideMaster({
    title: "Impact summary",
    background: { color: C.text1 },
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.7, w: 7.6, h: 0.7, fontSize: 40, bold: true, color: C.background1, margin: 0, valign: "top", align: "left" }, text: "" } },
    ],
  });

  pres.addSection({ title: "Impact summary" });
  const s = pres.addSlide({ masterName: "Impact summary", sectionTitle: "Impact summary" });

  const T = (text, o) => s.addText(text, Object.assign({ isTextBox: true, margin: 0, valign: "top", color: C.background1 }, o));
  const line = (x, y, w, color, width, extra = {}) => s.addShape(pres.shapes.LINE, Object.assign({ x, y, w, h: 0, line: Object.assign({ color, width }, extra.line || {}) }, extra.o || {}));
  const dot = (x, y, d, fill, border, bw, name) => s.addShape(pres.shapes.OVAL, { x: x - d / 2, y: y - d / 2, w: d, h: d, fill: { color: fill }, line: { color: border, width: bw }, objectName: name });

  /* ---------- header ---------- */
  T("Process Studio Skillathon, November 2026", { x: 0.6, y: 0.42, w: 7.6, h: 0.25, fontSize: 12, color: DIM, objectName: "Event" });
  s.addText("SOW Atlas", { placeholder: "title" });
  T("The whole engagement on one page", { x: 0.6, y: 1.38, w: 7.6, h: 0.4, fontSize: 22, bold: true, objectName: "Tagline" });
  T("Reads a Statement of Work and turns it into an interactive map of the plan, the client, the money and who owes what. Every claim links back to the clause it came from.",
    { x: 0.6, y: 1.84, w: 7.6, h: 0.6, fontSize: 14, color: MUTED, objectName: "Subtitle" });

  /* ---------- mini route map (the product's own motif) ---------- */
  const mx0 = 8.75, mx1 = 12.7, lines = [
    { y: 0.62, c: C.accent3, st: [0.15, 0.5, 0.85] },
    { y: 0.95, c: C.accent2, st: [0.3, 0.72, 0.93] },
    { y: 1.28, c: C.accent4, st: [0.42, 0.66, 0.8] },
    { y: 1.61, c: C.accent5, st: [0.38, 0.62, 0.88] },
  ];
  const mark = mx0 + (mx1 - mx0) * 0.3;
  lines.forEach((L, i) => {
    line(mx0, L.y, mx1 - mx0, L.c, 5, { line: { transparency: 62, endArrowType: "none" }, o: { objectName: `Route line ${i + 1} future` } });
    line(mx0, L.y, mark - mx0, L.c, 5, { o: { objectName: `Route line ${i + 1} done` } });
    L.st.forEach((f, k) => { const x = mx0 + (mx1 - mx0) * f; const done = x < mark; dot(x, L.y, 0.17, done ? L.c : NAVY, L.c, 2.25, `Station ${i + 1}.${k + 1}`); });
  });
  [0.4, 0.76].forEach((f, i) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: mx0 + (mx1 - mx0) * f - 0.09, y: 0.46, w: 0.18, h: 1.32, rectRadius: 0.09, fill: { color: NAVY }, line: { color: C.background1, width: 2 }, objectName: `Gate ${i + 1}` }));
  s.addShape(pres.shapes.LINE, { x: mark, y: 0.36, w: 0, h: 1.52, line: { color: C.accent1, width: 2.5 }, objectName: "You are here line" });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: mark - 0.38, y: 0.2, w: 0.76, h: 0.24, rectRadius: 0.12, fill: { color: C.accent1 }, line: { color: C.accent1, width: 0 }, objectName: "You are here pill" });
  T("Week 9", { x: mark - 0.38, y: 0.2, w: 0.76, h: 0.24, fontSize: 10, bold: true, color: C.text1, align: "center", valign: "middle", objectName: "You are here label" });
  T("The route map: workstreams as lines, deliverables as stops, decisions as gates", { x: mx0, y: 1.9, w: mx1 - mx0, h: 0.3, fontSize: 10, color: DIM, objectName: "Route map caption" });

  /* ---------- three stations: problem, what it does, impact ---------- */
  const cols = [
    { x: 0.6, head: "The problem", fill: NAVY, border: C.background1, items: [
      "A SOW is the most important document on an engagement and the one people read least.",
      "What decides a go-live is scattered across sections, so both sides work from memory.",
      "Conflicts between clauses surface months later, when they are expensive to fix.",
    ] },
    { x: 4.75, head: "What SOW Atlas does", fill: NAVY, border: C.accent1, items: [
      "Ten linked views of the plan, client org, process, people, scope, risks, money and obligations.",
      "A slip simulator shows what one late item does to go-lives, payments and the term.",
      "Reads clauses against each other to flag contradictions.",
    ] },
    { x: 8.9, head: "The impact", fill: C.accent1, border: C.accent1, items: [
      "Kickoffs and steering committees start from one shared picture of the deal.",
      "Clients see exactly what they owe and when, so dependencies arrive on time.",
      "Every number traces to a quoted clause, so people trust it and act on it.",
    ] },
  ];
  const ry = 2.72;
  line(0.68, ry, 12.0, MUTED, 3, { o: { objectName: "Story route line" } });
  cols.forEach((c, i) => {
    dot(c.x + 0.16, ry, 0.34, c.fill, c.border, 3, `Story station ${i + 1}`);
    T(c.head, { x: c.x, y: 2.98, w: 3.85, h: 0.36, fontSize: 20, bold: true, objectName: `${c.head} heading` });
    T(c.items.map((t, k) => ({ text: t, options: { bullet: { indent: 14 }, breakLine: k < c.items.length - 1, paraSpaceAfter: 6 } })),
      { x: c.x, y: 3.4, w: 3.85, h: 1.75, fontSize: 13, color: MUTED, objectName: `${c.head} points` });
  });

  /* ---------- impact evidence ---------- */
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 5.32, w: 4.95, h: 1.55, rectRadius: 0.08, fill: { color: PANEL }, line: { color: PANEL, width: 0 }, objectName: "Demo callout card" });
  T("Caught in the demo SOW before kickoff", { x: 0.85, y: 5.45, w: 4.5, h: 0.25, fontSize: 11, color: DIM, objectName: "Demo callout label" });
  T("$3.65M", { x: 0.85, y: 5.72, w: 2.05, h: 0.7, fontSize: 38, bold: true, color: C.accent1, objectName: "Demo callout number" });
  T("of payments slip, and Final Acceptance lands after the contract ends, if one client security review takes the 15 days the SOW allows.",
    { x: 2.95, y: 5.72, w: 2.45, h: 1.05, fontSize: 11.5, color: MUTED, objectName: "Demo callout text" });

  const stats = [
    ["128", "clauses quoted and checked word for word"],
    ["4", "contradictions flagged before kickoff"],
    ["27", "dated obligations on one timeline"],
    ["0", "client data: fictional demo SOW, works offline"],
  ];
  stats.forEach(([n, l], i) => {
    const x = 5.8 + i * 1.75;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 5.32, w: 1.6, h: 1.55, rectRadius: 0.08, fill: { color: PANEL }, line: { color: PANEL, width: 0 }, objectName: `Stat card ${i + 1}` });
    T(n, { x: x + 0.15, y: 5.45, w: 1.3, h: 0.6, fontSize: 32, bold: true, objectName: `Stat ${i + 1} number` });
    T(l, { x: x + 0.15, y: 6.08, w: 1.32, h: 0.72, fontSize: 11, color: MUTED, objectName: `Stat ${i + 1} label` });
  });

  T("Reusable on any SOW (SKILL.md v1.0.0). The build stops if a clause is misquoted, a dependency breaks or payments miss the fee.     Anubhav Sen, IBM Consulting",
    { x: 0.6, y: 7.0, w: 12.15, h: 0.3, fontSize: 10, color: DIM, objectName: "Footer" });

  s.addNotes("SOW Atlas turns a Statement of Work into an interactive, offline map that both IBM and the client can read in minutes. " +
    "The problem: SOWs are long, rarely reread after signature, and their conflicts surface late. " +
    "What it does: ten linked views, a slip simulator, and a check that reads clauses against each other. " +
    "The proof point: in the demo SOW it found that a security review the contract allows to run 15 business days would delay $3.65M of payments and push Final Acceptance past the end of the term. " +
    "Every figure on this slide comes from the Project Clearpath demo, a fictional SOW, so no client data is used.");

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})();
