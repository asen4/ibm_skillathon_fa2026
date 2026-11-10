"use strict";
/* SOW Atlas renderer. Reads D (sow.json) and SECTIONS (sections.json) and draws every view.
   No external libraries, no network, no browser storage. */
(function () {
window.addEventListener("error", e => { const b = document.getElementById("err"); b.textContent = "Atlas error: " + e.message; b.style.display = "block"; });
if (!D) { document.getElementById("view").innerHTML = '<div class="empty">No SOW data was injected. Build this page with scripts/build_atlas.py.</div>'; return; }

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const M = D.meta, WEEKS = M.weeks;
const WS = D.workstreams, WSM = Object.fromEntries(WS.map(w => [w.id, w]));
const DL = D.deliverables, DLM = Object.fromEntries(DL.map(d => [d.id, d]));
const CD = D.client_deps || [], CDM = Object.fromEntries(CD.map(c => [c.id, c]));
const PAY = D.payments || [], FEES = D.fees || {};
const PEOPLE = D.people || {}, ORG = D.org || {}, PROC = D.process || {}, SCOPE = D.scope || {};
const RISKS = D.risks || [], OBL = D.obligations || [], FAQ = D.faq || [], SRC = D.sources || {};
const CS = M.client_short || "Client";
const parseISO = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtD = (d, yr) => MON[d.getMonth()] + " " + d.getDate() + (yr ? ", " + d.getFullYear() : "");
const START = parseISO(M.start_date);
const weekMon = w => addDays(START, (w - 1) * 7);
const weekFri = w => addDays(START, (w - 1) * 7 + 4);
const dateE = d => (d - START) / (7 * 864e5);               // elapsed weeks since start (week w spans e in [w-1, w))
const dDate = (d, w) => (d.type === "golive" ? weekMon(w) : weekFri(w));
const money = (v, short) => {
  if (short) { if (v >= 1e6) return "$" + (v / 1e6).toFixed(2).replace(/0$/, "").replace(/\.0$/, "") + "M"; if (v >= 1e3) return "$" + Math.round(v / 1e3) + "K"; }
  return "$" + Math.round(v).toLocaleString("en-US");
};
const fmtK = v => v >= 1000 ? Math.round(v / 1000) + "K" : String(v);
const tw = (s, size) => String(s).length * size * 0.5 + 4;   // rough text width for condensed face
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const plural = (n, a, b) => n + " " + (n === 1 ? a : (b || a + "s"));

/* source chips */
function chips(keys) {
  if (!keys || !keys.length) return "";
  const g = new Map(); keys.filter(k => SRC[k]).forEach(k => { const s = SRC[k].sec; if (!g.has(s)) g.set(s, []); if (!g.get(s).includes(k)) g.get(s).push(k); });
  return [...g].map(([sec, ks]) => `<button class="src" data-src="${esc(ks.join(","))}" title="Open clause ${esc(sec)}">${esc(sec)}</button>`).join("");
}
const infTag = (o) => (o && (o.origin === "inferred" || o.dep_origin === "inferred")) ? ` <span class="tag inf" title="Not stated in the SOW. Worked out by the atlas.">Atlas inference</span>` : "";

/* icons */
const IC = {
  brief: '<path d="M5 3h7l4 4v10H5z"/><path d="M12 3v4h4M8 10h5M8 13h5"/>',
  route: '<circle cx="4" cy="15" r="2"/><circle cx="10" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><path d="M5.5 13.5 8.6 7.6M11.6 7.3l3 3.4"/>',
  org: '<rect x="7.5" y="2.5" width="5" height="4" rx="1"/><rect x="2.5" y="13.5" width="5" height="4" rx="1"/><rect x="12.5" y="13.5" width="5" height="4" rx="1"/><path d="M10 6.5v3.5M5 13.5V10h10v3.5"/>',
  process: '<rect x="2" y="7" width="5" height="6" rx="1"/><rect x="13" y="7" width="5" height="6" rx="1"/><path d="M7 10h6M11 8l2 2-2 2"/>',
  people: '<circle cx="7" cy="7" r="2.5"/><circle cx="14" cy="8" r="2"/><path d="M2.5 16c.5-3 2.4-4.5 4.5-4.5s4 1.5 4.5 4.5M12 12.2c2.4-.4 4.6.9 5 3.8"/>',
  scope: '<path d="M3 17V6l2-2 2 2v11M13 17V6l2-2 2 2v11M3 9h14M3 14h14"/>',
  risks: '<path d="M10 3 18 17H2z"/><path d="M10 8v4M10 14.5v.5"/>',
  money: '<circle cx="10" cy="10" r="7.5"/><path d="M12.5 7.3c-.5-.8-1.5-1.2-2.5-1.2-1.4 0-2.5.8-2.5 1.9 0 2.6 5 1.4 5 4 0 1.1-1.1 1.9-2.5 1.9-1.1 0-2.1-.5-2.6-1.3M10 4.8v1.3M10 13.9v1.3"/>',
  owes: '<rect x="3" y="3" width="14" height="14" rx="2"/><path d="m6 7 1.3 1.3L10 5.8M6 13l1.3 1.3L10 11.8M12 7h3M12 13h3"/>',
  faq: '<circle cx="10" cy="10" r="7.5"/><path d="M7.8 7.8c.2-1.3 1.1-2 2.3-2 1.3 0 2.3.9 2.3 2 0 1.8-2.4 1.8-2.4 3.7M10 14.3v.4"/>',
  eye: '<path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z"/><circle cx="10" cy="10" r="2.5"/>',
  shield: '<path d="M10 2.5 16 5v4.5c0 4-2.7 6.7-6 8-3.3-1.3-6-4-6-8V5z"/><path d="m7.3 10 1.9 1.9 3.6-3.8"/>',
  user: '<circle cx="10" cy="7" r="3"/><path d="M4 17c.7-3.3 3-5 6-5s5.3 1.7 6 5"/>',
  link: '<path d="M8.5 11.5 11.5 8.5M7 9.5 5.3 11.2a2.5 2.5 0 0 0 3.5 3.5L10.5 13M13 10.5l1.7-1.7a2.5 2.5 0 0 0-3.5-3.5L9.5 7"/>',
  clock: '<circle cx="10" cy="10" r="7.5"/><path d="M10 5.5V10l3 2"/>',
  up: '<path d="M10 16V4M5 9l5-5 5 5"/>',
  warn: '<path d="M10 3 18 17H2z"/><path d="M10 8v4M10 14.5v.5"/>',
  ok: '<circle cx="10" cy="10" r="7.5"/><path d="m6.5 10 2.3 2.3 4.7-4.8"/>',
  coin: '<circle cx="10" cy="10" r="7.5"/><path d="M10 6v8M7.5 8.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/>',
  chev: '<path d="m8 5 5 5-5 5"/>',
  slip: '<path d="M3 10h10M10 6l4 4-4 4"/><path d="M17 4v12"/>',
  flag: '<path d="M5 17V3M5 4h9l-2 3.5 2 3.5H5"/>',
  doc: '<path d="M5 3h7l4 4v10H5z"/><path d="M12 3v4h4"/>',
  gear: '<circle cx="10" cy="10" r="2.6"/><path d="M10 2.5v2.2M10 15.3v2.2M2.5 10h2.2M15.3 10h2.2M4.7 4.7l1.6 1.6M13.7 13.7l1.6 1.6M4.7 15.3l1.6-1.6M13.7 6.3l1.6-1.6"/>',
  gate: '<rect x="6" y="2.5" width="8" height="15" rx="4"/><path d="M10 7v6"/>',
  handshake: '<path d="M2 9l4-4 4 2 4-2 4 4M6 5l4 7 4-7M4 11l3 3M13 14l3-3"/>',
  nodeny: '<circle cx="10" cy="10" r="7.5"/><path d="M5 15 15 5"/>',
  person: '<circle cx="10" cy="6.5" r="3"/><path d="M4.5 17c.6-3.1 2.8-4.8 5.5-4.8s4.9 1.7 5.5 4.8"/><path d="m12.8 3.8 1.2 1.2 2.4-2.4"/>',
  trace: '<circle cx="4.5" cy="15.5" r="2"/><circle cx="15.5" cy="4.5" r="2"/><path d="M6.5 15.5h4a2.5 2.5 0 0 0 0-5h-1a2.5 2.5 0 0 1 0-5h4"/>'
};
const ic = (n, sz = 20, sw = 1.6) => `<svg width="${sz}" height="${sz}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || ""}</svg>`;

/* ---------- state ---------- */
function initialWeek() {
  if (M.as_of_week != null) return M.as_of_week;
  return clamp(Math.floor(dateE(new Date())) + 1, 0, WEEKS);
}
const S = {
  view: "brief", week: initialWeek(), lens: "both", sel: null, wsFocus: null,
  slip: { target: "", weeks: 0 }, orgSel: null, orgFold: new Set(), rel: null,
  procSel: null, flow: "today", flowT: 0, riskSel: null, broken: new Set(),
  done: new Set(), missed: new Set(), oweFilter: "all", faqQ: "", faqOpen: new Set(), tour: -1
};
if (ORG.levels) { const lv = ORG.levels.filter(l => l.node); S.orgSel = lv.length ? lv[lv.length - 1].node : (ORG.tree && ORG.tree.id); }

/* ---------- schedule engine ---------- */
const TOPO = (() => { const out = [], seen = {}; const v = id => { if (seen[id]) return; seen[id] = 1; (DLM[id].depends || []).forEach(v); out.push(id); }; DL.forEach(d => v(d.id)); return out; })();
const CHILDREN = {}; DL.forEach(d => (d.depends || []).forEach(p => (CHILDREN[p] = CHILDREN[p] || []).push(d.id)));
function schedule() {
  const { target, weeks } = S.slip; const sh = {}, cdShift = {};
  CD.forEach(c => { cdShift[c.id] = c.id === target ? Math.max(0, weeks - (c.slack || 0)) : 0; });
  let all = 0; CD.forEach(c => { if (c.shifts_all && cdShift[c.id]) all = Math.max(all, cdShift[c.id]); });
  TOPO.forEach(id => {
    const d = DLM[id]; let s = id === target ? weeks : 0; s = Math.max(s, all);
    (d.depends || []).forEach(p => (s = Math.max(s, sh[p])));
    (d.needs || []).forEach(n => (s = Math.max(s, cdShift[n] || 0)));
    sh[id] = s;
  });
  const cdW = {}; CD.forEach(c => (cdW[c.id] = c.week + (c.id === target ? weeks : (c.shifts_all ? 0 : all))));
  return { sh, cdShift, all, W: id => DLM[id].week + sh[id], cdW };
}
const status = (sc, id) => { const w = sc.W(id); return w < S.week ? "done" : w === S.week ? "now" : "next"; };
function ancestors(id, acc = new Set()) {
  const d = DLM[id]; if (!d) return acc;
  (d.depends || []).forEach(p => { if (!acc.has(p)) { acc.add(p); ancestors(p, acc); } });
  (d.needs || []).forEach(n => acc.add(n));
  return acc;
}
function descendants(id, acc = new Set()) {
  const kids = CDM[id] ? (CDM[id].feeds || []) : (CHILDREN[id] || []);
  kids.forEach(k => { if (!acc.has(k)) { acc.add(k); descendants(k, acc); } });
  return acc;
}
function chainOf(id) { if (!id) return null; const s = new Set([id]); ancestors(id).forEach(x => s.add(x)); descendants(id).forEach(x => s.add(x)); return s; }
const PAYBY = Object.fromEntries(PAY.map(p => [p.trigger, p]));
const phasesAt = w => (D.phases || []).filter(p => w >= p.start && w <= p.end);

/* ---------- reverse index: where each clause is used ---------- */
const USES = {};
const VIEW_OF = { meta: "brief", deal: "brief", why: "brief", measures: "brief", measures_note: "brief", principles: "brief", watchouts: "brief", findings: "brief", workstreams: "route", phases: "route", deliverables: "route", client_deps: "route", deadlines: "route", contingency_terms: "route", slip_rules: "route", payments: "money", fees: "money", org: "org", process: "process", people: "people", scope: "scope", risks: "risks", obligations: "owes", faq: "faq" };
(function walk(o, top, ctx) {
  if (Array.isArray(o)) { o.forEach(v => walk(v, top, ctx)); return; }
  if (!o || typeof o !== "object") return;
  let c = ctx;
  const nm = o.name || o.label || o.title || o.q || o.decision || o.area || o.trigger;
  if (nm && typeof nm === "string") c = (o.id && !/^[a-z_]+$/.test(o.id) ? o.id + " " : "") + nm;
  else if (o.text && typeof o.text === "string") c = o.text.slice(0, 60);
  Object.keys(o).forEach(k => {
    if (k === "src" && Array.isArray(o.src)) o.src.forEach(key => { (USES[key] = USES[key] || []).push({ label: c, view: VIEW_OF[top] || "brief", id: o.id }); });
    else if (top === null) walk(o[k], k, c); else walk(o[k], top, c);
  });
})(Object.fromEntries(Object.entries(D).filter(([k]) => k !== "sources")), null, "");

/* ---------- frame ---------- */
const VIEWS = [
  ["brief", "Brief", "brief"], ["route", "Route map", "route"], ["org", "Client org", "org"], ["process", "Process", "process"],
  ["people", "People", "people"], ["scope", "Scope", "scope"], ["risks", "Risks", "risks"], ["money", "Money", "money"],
  ["owes", "Who owes what", "owes"], ["faq", "Questions", "faq"]
];
function frame() {
  if (M.fictional) $("#fict").hidden = false;
  $("#brandsub").textContent = `${M.project}, ${M.client_short || M.client}`;
  $("#lensClient").textContent = CS + " view";
  $("#rail").innerHTML = VIEWS.map((v, i) => `<button data-view="${v[0]}"><span class="k">${(i + 1) % 10}</span>${ic(v[2])}<span>${v[1]}</span></button>`).join("") +
    `<div class="foot"><div class="lg"><span class="src lg-src">2.2</span> opens the SOW clause</div><div class="lg"><span class="lg-inf"></span> worked out by the atlas, not stated in the SOW</div><div style="margin-top:8px">Keys: 1 to 0 switch views, [ and ] move the week, Ctrl K searches.</div></div>`;
  const wk = $("#wk"); wk.max = WEEKS + 2; wk.value = S.week;
  wk.addEventListener("input", () => setWeek(+wk.value));
  $$(".seg [data-lens]").forEach(b => b.addEventListener("click", () => { S.lens = b.dataset.lens; $$(".seg [data-lens]").forEach(x => x.setAttribute("aria-pressed", x === b)); render(); }));
  $("#rail").addEventListener("click", e => { const b = e.target.closest("[data-view]"); if (b) nav(b.dataset.view); });
  $("#openSearch").addEventListener("click", openPalette);
  $("#startTour").addEventListener("click", () => tour(0));
  $("#dClose").addEventListener("click", closeDrawer);
  $("#scrim").addEventListener("click", () => { closeDrawer(); closePalette(); });
  document.addEventListener("click", globalClick);
  document.addEventListener("keydown", keys);
  let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { if (S.view === "process") drawProcLinks(); if (S.view === "route") drawMap(); }, 120); });
  updateWeekOut();
}
function updateWeekOut() {
  const w = S.week;
  $("#wkout").textContent = w <= 0 ? "Before the start" : w > WEEKS ? `Week ${w}, after plan end` : `Week ${w} (${fmtD(weekMon(w))})`;
  $("#wk").value = w;
}
function setWeek(w, opts = {}) {
  S.week = clamp(Math.round(w), 0, WEEKS + 2); updateWeekOut();
  if (S.view === "route" && !opts.full) { drawMap(); drawDetail(); return; }
  render();
}
function nav(view, focus) {
  S.view = view; render(focus);
  $$("#rail [data-view]").forEach(b => b.setAttribute("aria-current", b.dataset.view === view ? "page" : "false"));
  try { history.replaceState(null, "", "#" + view); } catch (e) { /* sandboxed previews block history */ }
  if (!focus) window.scrollTo({ top: 0 });
}
function render(focus) {
  const v = $("#view");
  v.innerHTML = (VIEW_FN[S.view] || VIEW_FN.brief)();
  (AFTER[S.view] || (() => {}))();
  if (focus) applyFocus(focus);
}
function go(target) {
  if (!target) return;
  const [view, f] = target.split(":");
  if (view === "route" && f) { S.sel = f; S.wsFocus = null; }
  if (view === "risks" && f) S.riskSel = f;
  if (view === "org" && f) S.orgSel = f;
  nav(view, f ? (view === "brief" || view === "scope" ? f : null) : null);
  if (view === "route" && f) setTimeout(() => centerInMap(f), 30);
}
function applyFocus(f) {
  const el = document.getElementById(f);
  if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }
}
function globalClick(e) {
  const s = e.target.closest("[data-src]"); if (s) { e.preventDefault(); openSrc(s.dataset.src); return; }
  const g = e.target.closest("[data-go]"); if (g) { e.preventDefault(); if (g.dataset.ws) { S.wsFocus = g.dataset.ws; S.sel = null; nav("route"); } else go(g.dataset.go); return; }
}
function keys(e) {
  const typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && document.activeElement.type !== "range" && document.activeElement.type !== "checkbox";
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); return; }
  if (e.key === "Escape") { if ($("#palette").classList.contains("on")) closePalette(); else if ($("#drawer").classList.contains("on")) closeDrawer(); else if (S.tour >= 0) endTour(); else if (S.sel) { S.sel = null; render(); } return; }
  if (typing) return;
  if (S.tour >= 0 && (e.key === "ArrowRight" || e.key === "ArrowLeft")) { e.preventDefault(); tour(S.tour + (e.key === "ArrowRight" ? 1 : -1)); return; }
  if (e.key === "/") { e.preventDefault(); openPalette(); return; }
  if (e.key === "[" || e.key === "]") { setWeek(S.week + (e.key === "]" ? 1 : -1)); return; }
  if (/^[0-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) { const i = (+e.key + 9) % 10; if (VIEWS[i]) nav(VIEWS[i][0]); }
}

/* ---------- source drawer ---------- */
const normq = s => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
function secFor(sec) {
  const m = String(sec).match(/^(\d+(?:\.\d+)?)/); if (!m) return null;
  return SECTIONS.find(s => s.id === m[1]) || SECTIONS.find(s => s.id === m[1].split(".")[0]);
}
function openSrc(keyList) {
  const keys = String(keyList).split(",").filter(k => SRC[k]); if (!keys.length) return;
  const s = SRC[keys[0]];
  const sec = secFor(s.sec);
  let ctx = "";
  if (sec) {
    const flat = normq(sec.text).replace(/[ \t]+/g, " ");
    const spans = [];
    keys.forEach(k => { const x = normq(SRC[k].text).replace(/\s+/g, " ").trim(); const i = flat.indexOf(x); if (i >= 0) spans.push([i, i + x.length]); });
    spans.sort((a, b) => a[0] - b[0]);
    let pos = 0; ctx = "";
    spans.forEach(([a, b]) => { if (a < pos) { if (b > pos) { ctx += "<mark>" + esc(flat.slice(pos, b)) + "</mark>"; pos = b; } return; } ctx += esc(flat.slice(pos, a)) + "<mark>" + esc(flat.slice(a, b)) + "</mark>"; pos = b; });
    ctx += esc(flat.slice(pos));
  }
  const uses = keys.flatMap(k => USES[k] || []).filter((u, i, a) => a.findIndex(v => v.label === u.label) === i).slice(0, 14);
  $("#dTitle").textContent = "Section " + s.sec;
  $("#dBody").innerHTML = `${keys.map(k => `<blockquote>${esc(SRC[k].text)}</blockquote>`).join("")}
    ${sec ? `<h3>${esc(sec.id)} ${esc(sec.title)}</h3><p class="tiny">The full section, with the quoted text highlighted.</p><div class="ctx">${ctx}</div>` : ""}
    ${uses.length ? `<h3 style="margin-top:20px">Where the atlas uses this clause</h3><div class="others">${uses.map(u => `<button class="pill" data-go="${u.view}${u.id && (DLM[u.id] || CDM[u.id] || RISKS.find(r => r.id === u.id)) ? ":" + u.id : ""}">${esc(u.label.length > 60 ? u.label.slice(0, 58) + "..." : u.label)}</button>`).join("")}</div>` : ""}
    <p class="tiny" style="margin-top:20px">Quoted word for word from ${esc(M.sow_number || "the SOW")}. The build checks every quote against the source document.</p>`;
  $("#drawer").classList.add("on"); $("#drawer").setAttribute("aria-hidden", "false"); $("#scrim").classList.add("on");
  const mk = $("#dBody mark"); if (mk) setTimeout(() => mk.scrollIntoView({ block: "center" }), 260);
  $("#dClose").focus();
}
function closeDrawer() { $("#drawer").classList.remove("on"); $("#drawer").setAttribute("aria-hidden", "true"); if (!$("#palette").classList.contains("on")) $("#scrim").classList.remove("on"); }
$("#drawer").addEventListener("click", e => { if (e.target.closest("[data-go]")) closeDrawer(); });

/* ---------- search palette ---------- */
let PIDX = null, pSel = 0, pRes = [];
function buildIndex() {
  const I = [];
  DL.forEach(d => I.push({ ty: d.type === "gate" ? "Decision gate" : d.type === "golive" ? "Go-live" : "Deliverable", t: `${d.id} ${d.name}`, s: d.summary, go: "route:" + d.id }));
  CD.forEach(c => I.push({ ty: CS + " provides", t: c.label, s: c.detail, go: "route:" + c.id }));
  (PEOPLE.ibm || []).forEach(p => I.push({ ty: "IBM person", t: p.name, s: p.role, go: "people" }));
  (PEOPLE.client || []).forEach(p => I.push({ ty: CS + " person", t: p.name, s: p.role + (p.title ? ", " + p.title : ""), go: "people" }));
  (PEOPLE.forums || []).forEach(f => I.push({ ty: "Forum", t: f.name, s: f.decides, go: "people" }));
  RISKS.forEach(r => I.push({ ty: "Risk", t: `${r.id} ${r.title}`, s: r.signal, go: "risks:" + r.id }));
  OBL.forEach(o => I.push({ ty: o.party === "ibm" ? "IBM owes" : CS + " owes", t: o.text, s: "Week " + o.week, go: "owes" }));
  FAQ.forEach((f, i) => I.push({ ty: "Question", t: f.q, s: f.a, go: "faq", faq: i }));
  (SCOPE.out || []).forEach(o => I.push({ ty: "Out of scope", t: o.text, s: o.owner, go: "scope" }));
  (SCOPE.assumptions || []).forEach(a => I.push({ ty: "Assumption", t: a.text, s: a.if_wrong, go: "scope" }));
  (D.measures || []).forEach(m => I.push({ ty: "Success measure", t: m.label, s: `${m.baseline_label || m.baseline}${m.unit} today, target ${m.target}${m.unit}`, go: "brief" }));
  (function w(n) { if (!n) return; I.push({ ty: "Org unit", t: n.name, s: n.does, go: "org:" + n.id }); (n.children || []).forEach(w); })(ORG.tree);
  Object.entries(SRC).forEach(([k, s]) => I.push({ ty: "Clause " + s.sec, t: s.text.slice(0, 90), s: s.text, src: k }));
  SECTIONS.forEach(s => { if (s.text) I.push({ ty: "Section " + s.id, t: s.title, s: s.text.slice(0, 160), sec: s }); });
  return I;
}
function openPalette() {
  PIDX = PIDX || buildIndex();
  $("#palette").classList.add("on"); $("#scrim").classList.add("on");
  const inp = $("#pIn"); inp.value = ""; paletteSearch(""); inp.focus();
}
function closePalette() { $("#palette").classList.remove("on"); if (!$("#drawer").classList.contains("on")) $("#scrim").classList.remove("on"); }
function paletteSearch(q) {
  const toks = q.toLowerCase().split(/\s+/).filter(Boolean);
  pRes = !toks.length ? PIDX.filter(x => /Deliverable|Go-live|gate|provides/.test(x.ty)).slice(0, 12)
    : PIDX.map(x => { const h = (x.t + " " + x.ty + " " + (x.s || "")).toLowerCase(); if (!toks.every(t => h.includes(t))) return null; const sc = toks.reduce((a, t) => a + (x.t.toLowerCase().includes(t) ? 3 : 1), 0) - (x.sec ? 2 : 0) - (x.src ? 1 : 0); return [sc, x]; }).filter(Boolean).sort((a, b) => b[0] - a[0]).slice(0, 40).map(a => a[1]);
  pSel = 0;
  $("#pList").innerHTML = pRes.length ? pRes.map((x, i) => `<li><button role="option" data-i="${i}" aria-selected="${i === 0}"><span class="ty">${esc(x.ty)}</span><span>${esc(x.t)}<span class="sb">${esc(x.s || "")}</span></span></button></li>`).join("")
    : `<li class="ph">Nothing in the SOW matches "${esc(q)}". Try a deliverable number, a person's name or a word from the contract.</li>`;
  if (!toks.length) $("#pList").insertAdjacentHTML("afterbegin", `<li class="ph">Type to search every deliverable, person, risk, obligation and clause. Here are the stops on the route.</li>`);
}
function pick(i) {
  const x = pRes[i]; if (!x) return; closePalette();
  if (x.src) { openSrc(x.src); return; }
  if (x.sec) { const k = Object.keys(SRC).find(k => secFor(SRC[k].sec) === x.sec); if (k) openSrc(k); return; }
  if (x.faq != null) S.faqOpen.add(x.faq);
  go(x.go);
}
$("#pIn").addEventListener("input", e => paletteSearch(e.target.value));
$("#pIn").addEventListener("keydown", e => {
  const bs = $$("#pList button");
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); pSel = clamp(pSel + (e.key === "ArrowDown" ? 1 : -1), 0, bs.length - 1); bs.forEach((b, i) => b.setAttribute("aria-selected", i === pSel)); if (bs[pSel]) bs[pSel].scrollIntoView({ block: "nearest" }); }
  if (e.key === "Enter") { e.preventDefault(); pick(pSel); }
});
$("#pList").addEventListener("click", e => { const b = e.target.closest("[data-i]"); if (b) pick(+b.dataset.i); });

/* =====================================================================
   ROUTE MAP (transit map)
   ===================================================================== */
function packLabels(items, lanes) {   // items: {x, w}; lanes: array of y offsets. returns lane index per item
  const ends = lanes.map(() => -1e9);
  return items.map(it => {
    for (let i = 0; i < lanes.length; i++) if (ends[i] + 6 < it.x - it.w / 2) { ends[i] = it.x + it.w / 2; return i; }
    let best = 0; ends.forEach((e, i) => { if (e < ends[best]) best = i; }); ends[best] = it.x + it.w / 2; return best;
  });
}
function routeSVG(opt = {}) {
  const compact = !!opt.compact, sc = schedule(), cur = S.week;
  const VW = opt.width || 1400, x0 = 196, E0 = -1.2, E1 = WEEKS + 3, cw = (VW - x0 - 24) / (E1 - E0);
  const X = e => x0 + (e - E0) * cw, XW = w => X(w - 0.5);
  const LY = {}; WS.forEach((w, i) => (LY[w.id] = 176 + i * 62));
  const yTop = 176 - 18, yBot = 176 + (WS.length - 1) * 62 + 18, yMid = (yTop + yBot) / 2;
  const cdY = yBot + 62, payY = cdY + 104, H = payY + 58;
  const chain = chainOf(S.sel);
  const inChain = id => !chain || chain.has(id);
  const wsOn = id => !S.wsFocus || S.wsFocus === id;
  const out = [];
  const gates = DL.filter(d => d.type === "gate");
  const posOf = (id, otherY) => {
    if (CDM[id]) return [XW(sc.cdW[id]) + (cdJit[id] || 0), cdY];
    const d = DLM[id]; const x = XW(sc.W(id));
    if (d.type === "gate") return [x, otherY != null ? clamp(otherY, yTop + 8, yBot - 8) : yMid];
    return [x, LY[d.ws]];
  };
  const cdJit = {}; { const byW = {}; CD.forEach(c => { const w = sc.cdW[c.id]; byW[w] = (byW[w] || 0); cdJit[c.id] = byW[w] * 15; byW[w]++; }); }

  out.push(`<defs>
    <marker id="arw" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#17222D"/></marker>
    <marker id="arwR" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#DA1E28"/></marker>
    <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#fff"/><path d="M0 0V6" stroke="#CFD7DB" stroke-width="2"/></pattern>
  </defs>`);
  out.push(`<rect x="0" y="0" width="${VW}" height="${H}" fill="#fff"/>`);
  // week grid + month labels
  if (!compact) {
    for (let w = 1; w <= WEEKS + 2; w++) { const x = X(w - 1); out.push(`<line x1="${x}" x2="${x}" y1="58" y2="${H - 26}" stroke="${w % 4 === 1 ? "#E3E8EA" : "#F2F4F5"}"/>`); }
    for (let w = 1; w <= WEEKS + 2; w += (WEEKS > 40 ? 4 : 2)) out.push(`<text class="lbl sm" x="${XW(w)}" y="70" text-anchor="middle">${w}</text>`);
    let d = new Date(START.getFullYear(), START.getMonth(), 1);
    const endD = weekFri(WEEKS + 3);
    while (d <= endD) { const e = dateE(d); if (e >= E0) { const x = X(e); out.push(`<line x1="${x}" x2="${x}" y1="38" y2="58" stroke="#7A8793"/><text class="lbl" x="${x + 5}" y="52" style="font-weight:700">${MON[d.getMonth()]}${d.getMonth() === 0 ? " " + d.getFullYear() : ""}</text>`); } d = new Date(d.getFullYear(), d.getMonth() + 1, 1); }
    out.push(`<text class="lbl sm" x="${x0 - 12}" y="70" text-anchor="end">week</text>`);
    // phases (lane packed)
    const ph = D.phases || []; const lanesEnd = [-1e9, -1e9, -1e9];
    ph.forEach(p => {
      const xa = X(p.start - 1), xb = X(p.end); let ln = lanesEnd.findIndex(e => e < xa - 1); if (ln < 0) ln = 0; lanesEnd[ln] = xb;
      const y = 82 + ln * 22, act = cur >= p.start && cur <= p.end;
      out.push(`<g><title>${esc(p.name)}: weeks ${p.start} to ${p.end}. ${esc(p.summary || "")}</title><rect x="${xa + 1}" y="${y}" width="${xb - xa - 2}" height="18" rx="3" fill="${act ? "#17222D" : "#EDF0EF"}" stroke="${act ? "#17222D" : "#CFD7DB"}"/><text class="lbl" x="${xa + 8}" y="${y + 13}" style="font-size:12px;fill:${act ? "#fff" : "#4A5865"}">${esc(p.name)}</text></g>`);
    });
  }
  // deadlines
  (D.deadlines || []).forEach(dl => {
    const e = dl.date ? dateE(parseISO(dl.date)) : dl.week - 0.5; if (e > E1 || e < E0) return; const x = X(e);
    out.push(`<g><title>${esc(dl.label)}${dl.date ? ": " + fmtD(parseISO(dl.date), true) : ""}</title><line x1="${x}" x2="${x}" y1="${compact ? yTop - 10 : 38}" y2="${compact ? yBot + 10 : H - 18}" stroke="#DA1E28" stroke-width="1.6" stroke-dasharray="5 4"/>${compact ? "" : `<text class="lbl" x="${x + 5}" y="${H - 8}" style="fill:#DA1E28;font-size:12px">${esc(dl.label)} ${dl.date ? fmtD(parseISO(dl.date)) : ""}</text>`}</g>`);
  });
  // workstream badges + lines
  WS.forEach(w => {
    const y = LY[w.id], st = DL.filter(d => d.ws === w.id && d.type !== "gate");
    const last = Math.max(...DL.filter(d => d.ws === w.id).map(d => sc.W(d.id)));
    const xa = XW(1) - 10, xb = XW(last);
    const dimL = (S.wsFocus && !wsOn(w.id)) || (chain && !st.some(d => chain.has(d.id)));
    out.push(`<g class="${dimL ? "dim" : ""}" style="transition:opacity .2s">
      <rect x="14" y="${y - 13}" width="${x0 - 40}" height="26" rx="13" fill="${w.color}"/>
      <text x="28" y="${y + 5}" style="font-family:var(--cn);font-size:13.5px;font-weight:700;fill:#fff">${esc(w.short || w.name)}</text>
      <line x1="${x0 - 26}" x2="${xa}" y1="${y}" y2="${y}" stroke="${w.color}" stroke-width="2" stroke-dasharray="2 4"/>
      <line x1="${xa}" x2="${xb}" y1="${y}" y2="${y}" stroke="${w.color}" stroke-opacity=".28" stroke-width="8" stroke-linecap="round"/>
      ${cur >= 1 ? `<line x1="${xa}" x2="${Math.min(xb, XW(cur))}" y1="${y}" y2="${y}" stroke="${w.color}" stroke-width="8" stroke-linecap="round"/>` : ""}
    </g>`);
  });
  // dependency edges for the selection
  if (chain && !compact) {
    const edges = [];
    DL.forEach(d => { if (!chain.has(d.id)) return; (d.depends || []).forEach(p => { if (chain.has(p)) edges.push([p, d.id]); }); (d.needs || []).forEach(n => { if (chain.has(n)) edges.push([n, d.id]); }); });
    edges.forEach(([a, b]) => {
      const pa0 = posOf(a), pb0 = posOf(b);
      const pa = posOf(a, pb0[1]), pb = posOf(b, pa0[1]);
      let [x1, y1] = pa, [x2, y2] = pb; const isCD = !!CDM[a];
      if (isCD) { y1 -= 10; y2 += 10; }
      const dx = Math.max(30, (x2 - x1) * 0.5);
      const dpath = Math.abs(y1 - y2) < 2 ? `M${x1 + 8} ${y1}Q${(x1 + x2) / 2} ${y1 - 34} ${x2 - 9} ${y2}` : isCD ? `M${x1} ${y1}C${x1} ${y1 - 60} ${x2} ${y2 + 60} ${x2} ${y2}` : `M${x1 + 8} ${y1}C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2 - 10} ${y2}`;
      out.push(`<path d="${dpath}" fill="none" stroke="#17222D" stroke-width="1.6" ${isCD ? 'stroke-dasharray="3 3"' : ""} marker-end="url(#arw)" opacity="${isCD ? 0.45 : 0.85}"/>`);
    });
  }
  // slip ghosts
  const ghosts = [];
  if (S.slip.target && S.slip.weeks) {
    DL.forEach(d => {
      const s = sc.sh[d.id]; if (!s) return;
      const xp = XW(d.week), xn = XW(d.week + s), y = d.type === "gate" ? yTop - 2 : LY[d.ws];
      ghosts.push(`<g opacity=".9"><circle cx="${xp}" cy="${y}" r="7" fill="#fff" stroke="#7A8793" stroke-width="1.5" stroke-dasharray="2 2"/><line x1="${xp + 8}" x2="${xn - 12}" y1="${y}" y2="${y}" stroke="#DA1E28" stroke-width="1.6" marker-end="url(#arwR)"/></g>`);
    });
  }
  // gates (interchange capsules)
  const gateLab = [];
  gates.forEach(d => {
    const w = sc.W(d.id), x = XW(w), stt = status(sc, d.id), moved = sc.sh[d.id] > 0;
    const dim = (chain && !chain.has(d.id)) || (S.wsFocus && S.wsFocus !== d.ws);
    out.push(`<g class="st ${dim ? "dim" : ""}" data-id="${d.id}" tabindex="0" role="button" aria-label="${esc(d.id + " " + d.name + ", week " + w)}"><title>${esc(d.id)} ${esc(d.name)}, week ${w}${moved ? " (moved " + sc.sh[d.id] + " weeks)" : ""}</title>
      <rect class="ring" x="${x - 11}" y="${yTop}" width="22" height="${yBot - yTop}" rx="11" fill="${stt === "done" ? "#17222D" : "#fff"}" stroke="${moved ? "#DA1E28" : "#17222D"}" stroke-width="${S.sel === d.id ? 4 : 2.5}"/>
      ${stt === "done" ? `<path d="M${x - 5} ${yMid}l3.5 3.5 6.5-7" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/>` : `<path d="M${x} ${yTop + 10}v${yBot - yTop - 20}" stroke="#CFD7DB" stroke-width="2" stroke-dasharray="1 5" stroke-linecap="round"/>`}
    </g>`);
    gateLab.push({ d, x, w: tw(d.short, 12.5), dim, moved });
  });
  // stations
  const labs = [];
  DL.filter(d => d.type !== "gate").forEach(d => {
    const w = sc.W(d.id), x = XW(w), y = LY[d.ws], col = WSM[d.ws].color, stt = status(sc, d.id), moved = sc.sh[d.id] > 0;
    const dim = (chain && !chain.has(d.id)) || (S.wsFocus && S.wsFocus !== d.ws), isSel = S.sel === d.id;
    const strokeC = moved ? "#DA1E28" : col;
    let shape;
    if (d.type === "golive") shape = `<circle class="ring" cx="${x}" cy="${y}" r="12.5" fill="#fff" stroke="${strokeC}" stroke-width="3"/><circle cx="${x}" cy="${y}" r="7.5" fill="${stt === "done" ? "#17222D" : col}"/>`;
    else shape = `<circle class="ring" cx="${x}" cy="${y}" r="8" fill="${stt === "done" ? col : "#fff"}" stroke="${strokeC}" stroke-width="3"/>${d.type === "build" && stt !== "done" ? `<rect x="${x - 3}" y="${y - 3}" width="6" height="6" fill="${col}"/>` : ""}`;
    if (stt === "done" && d.type !== "golive") shape += `<path d="M${x - 3.6} ${y}l2.4 2.4 4.6-4.8" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    if (stt === "now") shape = `<circle class="pulse" cx="${x}" cy="${y}" r="9" fill="none" stroke="#F1C21B" stroke-width="3"/>` + shape;
    if (isSel) shape = `<circle cx="${x}" cy="${y}" r="17" fill="none" stroke="#17222D" stroke-width="2"/>` + shape;
    out.push(`<g class="st ${dim ? "dim" : ""}" data-id="${d.id}" tabindex="0" role="button" aria-label="${esc(d.id + " " + d.name + ", week " + w)}"><title>${esc(d.id)} ${esc(d.name)}, week ${w}${moved ? " (moved " + sc.sh[d.id] + " weeks)" : ""}</title>${shape}<circle cx="${x}" cy="${y}" r="16" fill="transparent"/></g>`);
    labs.push({ d, x, y, w: tw(d.short, 12.5), dim, moved });
  });
  out.push(ghosts.join(""));
  if (!compact) {
    WS.forEach(wsx => {
      const L = labs.filter(l => l.d.ws === wsx.id).sort((a, b) => a.x - b.x);
      const lanes = [-15, 25, -29, 39], idx = packLabels(L, lanes);
      L.forEach((l, i) => out.push(`<text class="lbl ${l.dim ? "dim" : ""}" x="${l.x}" y="${l.y + lanes[idx[i]]}" text-anchor="middle" style="paint-order:stroke;stroke:#fff;stroke-width:4px;stroke-linejoin:round;${l.moved ? "fill:#DA1E28;" : ""}${S.sel === l.d.id ? "font-weight:700;" : ""}">${esc(l.d.short)}</text>`));
    });
    const gl = gateLab.sort((a, b) => a.x - b.x), gidx = packLabels(gl, [146, 130]);
    gl.forEach((l, i) => { const y = [146, 130][gidx[i]]; out.push(`<g class="${l.dim ? "dim" : ""}"><line x1="${l.x}" x2="${l.x}" y1="${y + 3}" y2="${yTop}" stroke="#17222D" stroke-width="1"/><text class="lbl" x="${l.x}" y="${y}" text-anchor="middle" style="font-weight:700;paint-order:stroke;stroke:#fff;stroke-width:4px;${l.moved ? "fill:#DA1E28" : ""}">${esc(l.d.short)}</text></g>`); });
    // client dependencies row
    out.push(`<text x="20" y="${cdY + 5}" style="font-family:var(--cn);font-size:13.5px;font-weight:700;fill:#A15C07">${esc(CS)} provides</text><line x1="${XW(0) - 14}" x2="${XW(WEEKS) + 10}" y1="${cdY}" y2="${cdY}" stroke="#A15C07" stroke-width="1.4" stroke-dasharray="1 5" stroke-linecap="round"/>`);
    const cl = CD.map(c => ({ c, x: XW(sc.cdW[c.id]) + cdJit[c.id], w: tw(c.short || c.label, 12) })).sort((a, b) => a.x - b.x);
    const cLanes = [26, 41, 56, 71], cidx = packLabels(cl, cLanes);
    cl.forEach((it, i) => {
      const c = it.c, x = it.x, y = cdY, dim = chain && !chain.has(c.id), isSel = S.sel === c.id, moved = c.id === S.slip.target && S.slip.weeks;
      const met = sc.cdW[c.id] < cur;
      out.push(`<g class="st ${dim ? "dim" : ""}" data-id="${c.id}" tabindex="0" role="button" aria-label="${esc(CS + " provides " + c.label + ", week " + sc.cdW[c.id])}"><title>${esc(c.label)}: week ${sc.cdW[c.id]}. ${esc(c.detail || "")}</title>
        ${isSel ? `<rect x="${x - 14}" y="${y - 14}" width="28" height="28" rx="4" transform="rotate(45 ${x} ${y})" fill="none" stroke="#17222D" stroke-width="2"/>` : ""}
        <rect class="ring" x="${x - 7.5}" y="${y - 7.5}" width="15" height="15" rx="2" transform="rotate(45 ${x} ${y})" fill="${met ? "#A15C07" : "#fff"}" stroke="${moved ? "#DA1E28" : "#A15C07"}" stroke-width="2.6"/>
        <rect x="${x - 14}" y="${y - 14}" width="28" height="28" fill="transparent"/></g>
        <text class="lbl ${dim ? "dim" : ""}" x="${x}" y="${y + cLanes[cidx[i]]}" text-anchor="middle" style="font-size:12px;fill:${moved ? "#DA1E28" : "#7A4605"};paint-order:stroke;stroke:#fff;stroke-width:4px">${esc(c.short || c.label)}</text>`);
    });
    // payments row
    out.push(`<text x="20" y="${payY + 5}" style="font-family:var(--cn);font-size:13.5px;font-weight:700;fill:#198038">Payments</text><line x1="${XW(0) - 14}" x2="${XW(WEEKS) + 10}" y1="${payY}" y2="${payY}" stroke="#198038" stroke-width="1.4" stroke-dasharray="1 5" stroke-linecap="round"/>`);
    const pl = PAY.map(p => ({ p, x: XW(sc.W(p.trigger)), w: Math.max(tw(money(p.amount, true), 13), tw(p.label, 11.5)) })).sort((a, b) => a.x - b.x);
    const pidx = packLabels(pl, [0, 1]);
    pl.forEach((it, i) => {
      const p = it.p, x = it.x, d = DLM[p.trigger], dim = chain && !chain.has(p.trigger), moved = sc.sh[p.trigger] > 0, paid = sc.W(p.trigger) < cur;
      const ty = d.type === "gate" ? yBot : LY[d.ws] + 12;
      const ly = payY + 30 + pidx[i] * 0;
      out.push(`<g class="st ${dim ? "dim" : ""}" data-id="${p.trigger}"><title>${esc(p.label)}: ${money(p.amount)} (${p.pct}%) on ${esc(d.id)}, week ${sc.W(p.trigger)}</title>
        <line x1="${x}" x2="${x}" y1="${ty}" y2="${payY - 13}" stroke="#198038" stroke-width="1" stroke-dasharray="2 3" opacity=".55"/>
        <circle class="ring" cx="${x}" cy="${payY}" r="12" fill="${paid ? "#198038" : "#fff"}" stroke="${moved ? "#DA1E28" : "#198038"}" stroke-width="2.5"/>
        <text x="${x}" y="${payY + 4.5}" text-anchor="middle" style="font-family:var(--cn);font-weight:700;font-size:13px;fill:${paid ? "#fff" : "#198038"}">$</text>
        <text class="lbl" x="${x}" y="${ly}" text-anchor="middle" style="font-weight:700;font-size:13px;${moved ? "fill:#DA1E28" : ""}">${money(p.amount, true)}</text>
        <text class="lbl sm" x="${x}" y="${ly + 14}" text-anchor="middle">${esc(p.label)}</text></g>`);
    });
  }
  // you-are-here marker
  const mx = XW(clamp(cur, 0, WEEKS + 2));
  if (compact) out.push(`<line x1="${mx}" x2="${mx}" y1="${yTop - 14}" y2="${yBot + 14}" stroke="#F1C21B" stroke-width="3"/>`);
  else out.push(`<g class="marker-h" id="marker"><line x1="${mx}" x2="${mx}" y1="30" y2="${H - 30}" stroke="#F1C21B" stroke-width="3"/><rect x="${mx - 40}" y="4" width="80" height="24" rx="12" fill="#F1C21B"/><text x="${mx}" y="21" text-anchor="middle" style="font-family:var(--cn);font-weight:700;font-size:13.5px;fill:#17222D">${cur <= 0 ? "Pre-start" : "Week " + cur}</text><rect x="${mx - 40}" y="0" width="80" height="${H}" fill="transparent"/></g>`);
  const vb = compact ? `0 ${yTop - 22} ${VW} ${yBot - yTop + 44}` : `0 0 ${VW} ${H}`;
  return { svg: `<svg viewBox="${vb}" role="img" aria-label="Route map of the plan">${out.join("")}</svg>`, X, E0, cw, x0, VW };
}

VIEW_FN_route = () => `
  <div class="view-h"><div><h1>Route map</h1><p>Each colored line is a workstream and each stop is a deliverable. The capsules that cross every line are decision gates. What ${esc(CS)} must provide runs underneath, and payments sit at the bottom. Drag the yellow marker to move through time.</p></div></div>
  <div class="maptools">
    ${S.sel || S.wsFocus ? `<button class="btn" id="clearSel">Show the whole map</button>` : `<span class="tiny">Pick any stop to trace what it needs and what waits on it.</span>`}
    <div class="legend">
      <span><svg width="18" height="18"><circle cx="9" cy="9" r="6" fill="#fff" stroke="#525252" stroke-width="2.5"/></svg>document</span>
      <span><svg width="18" height="18"><circle cx="9" cy="9" r="6" fill="#fff" stroke="#525252" stroke-width="2.5"/><rect x="6.5" y="6.5" width="5" height="5" fill="#525252"/></svg>build</span>
      <span><svg width="22" height="22"><circle cx="11" cy="11" r="9" fill="#fff" stroke="#525252" stroke-width="2.5"/><circle cx="11" cy="11" r="5" fill="#525252"/></svg>go-live</span>
      <span><svg width="14" height="22"><rect x="2" y="1" width="10" height="20" rx="5" fill="#fff" stroke="#17222D" stroke-width="2"/></svg>decision gate</span>
      <span><svg width="18" height="18"><rect x="4" y="4" width="10" height="10" rx="1.5" transform="rotate(45 9 9)" fill="#fff" stroke="#A15C07" stroke-width="2.2"/></svg>${esc(CS)} provides</span>
      <span><svg width="18" height="18"><circle cx="9" cy="9" r="6" fill="#525252"/><path d="M6.3 9l1.9 1.9 3.6-3.8" stroke="#fff" stroke-width="1.8" fill="none"/></svg>done</span>
      <span><svg width="26" height="10"><line x1="0" x2="26" y1="5" y2="5" stroke="#DA1E28" stroke-width="1.6" stroke-dasharray="5 4"/></svg>deadline</span>
    </div>
  </div>
  <div class="mapwrap" id="map"></div>
  <div class="under">
    <section class="panel pad detail" id="detail"></section>
    <section class="panel pad slip" id="slip"></section>
  </div>`;
let MAPGEO = null;
function centerInMap(id) {
  const m = $("#map"), el = m && m.querySelector(`[data-id="${id}"]`); if (!el) return;
  const r = el.getBoundingClientRect(), mr = m.getBoundingClientRect();
  m.scrollTo({ left: m.scrollLeft + (r.left + r.width / 2) - (mr.left + mr.width / 2), behavior: "smooth" });
}
function drawMap() {
  const m = $("#map"); if (!m) return;
  const r = routeSVG({ width: Math.max(1120, Math.round(m.clientWidth)) }); MAPGEO = r;
  const sl = m.scrollLeft; m.innerHTML = r.svg; m.scrollLeft = sl;
  const s = m.querySelector("svg"); s.style.width = r.VW + "px"; s.style.minWidth = "0";
}
function mapWeekFromEvent(e) {
  const svg = $("#map svg"); const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  return Math.round((p.x - MAPGEO.x0) / MAPGEO.cw + MAPGEO.E0 + 0.5);
}
AFTER_route = () => {
  drawMap(); drawDetail(); drawSlip();
  const m = $("#map"); let drag = false;
  m.addEventListener("pointerdown", e => { if (e.target.closest("#marker")) { drag = true; m.setPointerCapture(e.pointerId); e.preventDefault(); } });
  m.addEventListener("pointermove", e => { if (!drag) return; const w = clamp(mapWeekFromEvent(e), 0, WEEKS + 2); if (w !== S.week) setWeek(w); });
  m.addEventListener("pointerup", () => { drag = false; });
  m.addEventListener("click", e => {
    if (drag) return; const st = e.target.closest(".st"); if (!st) return;
    const id = st.dataset.id; S.sel = S.sel === id ? null : id; S.wsFocus = null;
    const y = window.scrollY, sl = m.scrollLeft; render(); window.scrollTo(0, y); const nm = $("#map"); if (nm) nm.scrollLeft = sl;
  });
  m.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.closest(".st")) { e.preventDefault(); S.sel = e.target.closest(".st").dataset.id; render(); setTimeout(() => { const el = $(`#map [data-id="${S.sel}"]`); if (el) el.focus(); }, 0); } });
  const c = $("#clearSel"); if (c) c.addEventListener("click", () => { S.sel = null; S.wsFocus = null; render(); });
};
function pillFor(id, sc) {
  if (CDM[id]) return `<button class="pill" data-go="route:${id}"><i style="background:#A15C07;border-radius:2px;transform:rotate(45deg)"></i>${esc(CDM[id].short || CDM[id].label)}, wk ${sc.cdW[id]}</button>`;
  const d = DLM[id]; return `<button class="pill" data-go="route:${id}"><i style="background:${d.type === "gate" ? "#17222D" : WSM[d.ws].color}"></i>${esc(d.id)} ${esc(d.short)}, wk ${sc.W(id)}</button>`;
}
function drawDetail() {
  const el = $("#detail"); if (!el) return; const sc = schedule();
  const id = S.sel;
  if (!id) {
    const ms = DL.filter(d => d.milestone || d.type === "golive").sort((a, b) => sc.W(a.id) - sc.W(b.id));
    el.innerHTML = `<h2>${ic("flag", 22)} Key milestones</h2><p class="small muted">The dates the SOW names as milestones. Pick one, or any stop on the map, for the details.</p>
      <ul class="impacts">${ms.map(d => { const w = sc.W(d.id), stt = status(sc, d.id); return `<li class="${stt === "done" ? "good" : ""}">${ic(stt === "done" ? "ok" : d.type === "gate" ? "gate" : d.type === "golive" ? "flag" : "doc", 18)}<span><button class="linkish" style="color:inherit;font-size:14px;text-align:left" data-go="route:${d.id}">${esc(d.milestone || d.name)}</button> <span class="tiny">${esc(d.id)}</span></span><span class="w">Week ${w}, ${fmtD(dDate(d, w))}${sc.sh[d.id] ? ` <span class="tag red">+${sc.sh[d.id]} wk</span>` : ""}</span></li>`; }).join("")}</ul>`;
    return;
  }
  if (CDM[id]) {
    const c = CDM[id], w = sc.cdW[id];
    el.innerHTML = `<h2><svg width="22" height="22"><rect x="5" y="5" width="12" height="12" rx="2" transform="rotate(45 11 11)" fill="#fff" stroke="#A15C07" stroke-width="2.4"/></svg>${esc(c.label)}</h2>
      <div class="pillist" style="margin:6px 0"><span class="tag client">${esc(CS)} provides</span>${w < S.week ? '<span class="tag ok">due date passed</span>' : ""}</div>
      <p>${esc(c.detail)} ${chips(c.src)}</p>
      <dl class="kv"><dt>Due</dt><dd>Week ${w}${w > 0 ? ", " + fmtD(weekMon(w), true) : ", before the start date"}</dd>
      <dt>Room to slip</dt><dd>${c.shifts_all ? "None. Every week of the plan moves with it." : c.slack ? plural(c.slack, "week") + " before the plan moves" : "None. It is on the critical path."} <span class="tag inf">Atlas estimate</span></dd>
      <dt>Waiting on it</dt><dd><div class="pillist">${(c.feeds || []).map(f => pillFor(f, sc)).join("")}</div></dd>
      <dt>Downstream</dt><dd>${plural(descendants(id).size, "deliverable")} depend on this, directly or further down the line.</dd></dl>
      ${c.recovery ? `<h3>If it runs late <span class="tag inf">Atlas suggestion</span></h3><ul class="recov">${c.recovery.map(r => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
      <p style="margin-top:14px"><button class="btn" data-slip="${id}">${ic("slip", 16)} Simulate a slip here</button></p>`;
  } else {
    const d = DLM[id], w = sc.W(id), stt = status(sc, id), ws = WSM[d.ws], pay = PAYBY[id];
    const ty = { document: "Document", build: "Build", golive: "Go-live", gate: "Decision gate" }[d.type];
    el.innerHTML = `<h2><span class="tag" style="background:${d.type === "gate" ? "#17222D" : ws.color};color:#fff;border:0;font-size:13px">${esc(d.id)}</span>${esc(d.name)}</h2>
      <div class="pillist" style="margin:6px 0"><span class="tag">${ty}</span>${d.type !== "gate" ? `<span class="tag">${esc(ws.name)}</span>` : ""}${d.milestone ? `<span class="tag amber">${esc(d.milestone)}</span>` : ""}<span class="tag ${stt === "done" ? "ok" : stt === "now" ? "amber" : ""}">${stt === "done" ? "Done" : stt === "now" ? "This week" : "In " + plural(w - S.week, "week")}</span>${sc.sh[id] ? `<span class="tag red">Moved ${plural(sc.sh[id], "week")}</span>` : ""}</div>
      <p>${esc(d.summary)} ${chips(d.src)}</p>
      <dl class="kv"><dt>Due</dt><dd>Week ${w}, ${fmtD(dDate(d, w), true)}${sc.sh[id] ? ` <span class="tiny">(planned week ${d.week})</span>` : ""}</dd>
      <dt>Accepted when</dt><dd>${esc(d.acceptance || "General acceptance terms apply.")}</dd>
      ${pay ? `<dt>Pays</dt><dd><b>${money(pay.amount)}</b> (${pay.pct}% of the fee) ${chips(pay.src)}</dd>` : ""}
      <dt>Needs first</dt><dd>${(d.depends || []).length || (d.needs || []).length ? `<div class="pillist">${(d.depends || []).map(p => pillFor(p, sc)).join("")}${(d.needs || []).map(n => pillFor(n, sc)).join("")}</div>` : '<span class="muted">Nothing. It can start right away.</span>'}${d.dep_origin === "inferred" ? ' <span class="tag inf">Atlas inference</span>' : d.needs_origin === "inferred" && (d.needs || []).length ? ' <span class="tag inf" title="The deliverable links come from the SOW. Some of the client links are worked out by the atlas from Section 6.">client links partly inferred</span>' : ""}</dd>
      <dt>Feeds</dt><dd>${(CHILDREN[id] || []).length ? `<div class="pillist">${CHILDREN[id].map(k => pillFor(k, sc)).join("")}</div>` : '<span class="muted">End of the line.</span>'}</dd>
      <dt>Chain</dt><dd>${plural(ancestors(id).size, "item")} upstream, ${plural(descendants(id).size, "deliverable")} downstream.</dd></dl>
      ${d.recovery ? `<h3>If it slips <span class="tag inf">Atlas suggestion</span></h3><ul class="recov">${d.recovery.map(r => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
      <p style="margin-top:14px"><button class="btn" data-slip="${id}">${ic("slip", 16)} Simulate a slip here</button></p>`;
  }
  $$("[data-slip]", el).forEach(b => b.addEventListener("click", () => { S.slip = { target: b.dataset.slip, weeks: Math.max(S.slip.weeks, 2) }; drawMap(); drawSlip(); drawDetail(); $("#slip").scrollIntoView({ behavior: "smooth", block: "nearest" }); }));
}
function slipImpacts(sc) {
  const out = []; const { target, weeks } = S.slip; if (!target || !weeks) return null;
  const c = CDM[target];
  if (c && !c.shifts_all && sc.cdShift[target] === 0) return { absorbed: true, slack: c.slack };
  const moved = DL.filter(d => sc.sh[d.id] > 0);
  const key = moved.filter(d => d.milestone || d.type === "golive").sort((a, b) => a.week - b.week);
  key.forEach(d => out.push({ cls: d.type === "golive" ? "bad" : "", ic: d.type === "golive" ? "flag" : d.type === "gate" ? "gate" : "doc", t: `${d.milestone || d.name}`, w: `Wk ${d.week} to ${sc.W(d.id)}, ${fmtD(dDate(d, sc.W(d.id)))}` }));
  const others = moved.length - key.length;
  if (others > 0) out.push({ ic: "link", t: `${plural(others, "other deliverable")} move with them`, w: "" });
  const pm = PAY.filter(p => sc.sh[p.trigger] > 0); const amt = pm.reduce((a, p) => a + p.amount, 0);
  if (pm.length) out.push({ cls: "bad", ic: "coin", t: `${money(amt, true)} of payments arrive later (${plural(pm.length, "milestone")})`, w: `up to ${plural(Math.max(...pm.map(p => sc.sh[p.trigger])), "week")}` });
  (D.deadlines || []).forEach(dl => {
    if (!dl.check || !DLM[dl.check]) return; const d = DLM[dl.check], nd = dDate(d, sc.W(d.id)), lim = parseISO(dl.date);
    const days = Math.round((lim - nd) / 864e5);
    if (sc.sh[d.id] > 0) out.push(days < 0 ? { cls: "bad", ic: "warn", t: `${d.milestone || d.short} on ${fmtD(nd, true)} misses the deadline: ${dl.label}, ${fmtD(lim)}`, w: `${-days} days over`, breach: true } : { cls: "good", ic: "ok", t: `${d.milestone || d.short} on ${fmtD(nd)} still makes it: ${dl.label}, ${fmtD(lim)}`, w: `${days} days to spare` });
  });
  return { list: out, golive: key.some(d => d.type === "golive"), breach: out.some(o => o.breach) };
}
function drawSlip() {
  const el = $("#slip"); if (!el) return; const sc = schedule(); const { target, weeks } = S.slip;
  const im = slipImpacts(sc);
  const opts = `<option value="">Pick something that could run late</option><optgroup label="${esc(CS)} provides">${CD.map(c => `<option value="${c.id}" ${c.id === target ? "selected" : ""}>${esc(c.label)} (week ${c.week})</option>`).join("")}</optgroup><optgroup label="Deliverables">${DL.map(d => `<option value="${d.id}" ${d.id === target ? "selected" : ""}>${esc(d.id)} ${esc(d.name)} (week ${d.week})</option>`).join("")}</optgroup>`;
  const rules = (D.slip_rules || []).filter(r => im && !im.absorbed && (r.when === "any" || (r.when === "golive_moves" && im.golive) || (r.when === "term_breach" && im.breach)));
  const tgt = DLM[target] || CDM[target];
  el.innerHTML = `<h2>${ic("slip", 22)} What if something slips?</h2>
    <p class="small muted" style="margin:2px 0 10px">Pick something that could run late and drag the slider. The plan moves the way the SOW's dependencies say it would, assuming no float.</p>
    <div class="presets">${(D.slip_presets || []).map(p => `<button class="pill" data-preset="${p.target}:${p.weeks}" ${p.target === target && p.weeks === weeks ? 'style="border-color:#17222D;box-shadow:inset 0 0 0 1px #17222D"' : ""}>${esc(p.label)}</button>`).join("")}</div>
    <div class="slipctl"><select id="slipT" aria-label="What slips">${opts}</select><span></span>
      <input id="slipW" type="range" min="0" max="8" step="1" value="${weeks}" aria-label="Weeks late" ${target ? "" : "disabled"}><output>${weeks ? "+" + plural(weeks, "week") : "on time"}</output></div>
    ${!target || !weeks ? `<div class="empty">Nothing is slipping. Try one of the scenarios above.</div>`
      : im.absorbed ? `<ul class="impacts"><li class="good">${ic("ok", 18)}<span>Absorbed. ${esc(tgt.label)} has about ${plural(im.slack, "week")} of room before anything downstream moves.</span><span class="w"></span></li></ul>`
      : `<ul class="impacts">${im.list.map(o => `<li class="${o.cls || ""}">${ic(o.ic, 18)}<span>${esc(o.t)}</span><span class="w">${esc(o.w)}</span></li>`).join("")}</ul>`}
    ${rules.length ? `<h3 style="margin-top:16px">What the SOW says happens</h3><ul class="terms">${rules.map(r => `<li>${esc(r.text)} ${chips(r.src)}</li>`).join("")}</ul>` : ""}
    ${tgt && tgt.recovery && weeks ? `<h3 style="margin-top:14px">Ways to recover <span class="tag inf">Atlas suggestion</span></h3><ul class="recov">${tgt.recovery.map(r => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
    ${weeks ? `<p style="margin-top:12px"><button class="btn" id="slipReset">Put the plan back</button></p>` : ""}`;
  $("#slipT").addEventListener("change", e => { S.slip.target = e.target.value; if (!S.slip.weeks && S.slip.target) S.slip.weeks = 2; drawMap(); drawSlip(); drawDetail(); });
  $("#slipW").addEventListener("input", e => { S.slip.weeks = +e.target.value; drawMap(); drawSlip(); drawDetail(); const w = $("#slipW"); if (w) w.focus(); });
  $$("[data-preset]", el).forEach(b => b.addEventListener("click", () => { const [t, w] = b.dataset.preset.split(":"); S.slip = { target: t, weeks: +w }; S.sel = t; drawMap(); drawSlip(); drawDetail(); }));
  const rs = $("#slipReset"); if (rs) rs.addEventListener("click", () => { S.slip = { target: "", weeks: 0 }; drawMap(); drawSlip(); drawDetail(); });
}

/* =====================================================================
   BRIEF
   ===================================================================== */
function measureRow(m) {
  const pc = v => ((v - m.min) / (m.max - m.min) * 100).toFixed(2);
  const b = +pc(m.baseline), t = +pc(m.target), lo = Math.min(b, t), hi = Math.max(b, t), dir = t > b ? "r" : "l";
  const fmt = v => (m.format === "pct" ? v + "%" : m.format === "days" ? v.toFixed(1) + " days" : m.format === "min" ? v + " min" : m.format === "score" ? v.toFixed(1) : v + (m.unit || ""));
  return `<div class="mrow"><div class="ml">${esc(m.label)} ${chips(m.src)}</div>
    <div class="bar" aria-hidden="true"><i class="trk"></i><i class="grow ${dir}" style="left:${lo}%;width:${hi - lo}%"></i><i class="db" style="left:${b}%"></i><i class="dt ${dir}" style="left:${t}%"></i></div>
    <div class="mv"><span class="muted">${esc(m.baseline_label || fmt(m.baseline))}</span> to <b style="color:#198038">${fmt(m.target)}</b></div></div>`;
}
VIEW_FN_brief = () => {
  const sc = schedule(), cur = S.week;
  const doneN = DL.filter(d => sc.W(d.id) < cur).length;
  const inv = PAY.filter(p => sc.W(p.trigger) < cur).reduce((a, p) => a + p.amount, 0);
  const next = DL.filter(d => sc.W(d.id) >= cur).sort((a, b) => sc.W(a.id) - sc.W(b.id)).slice(0, 3);
  const owes = OBL.filter(o => o.party !== "ibm" && !o.until && o.week >= cur).sort((a, b) => a.week - b.week).slice(0, 3);
  const late = OBL.filter(o => o.party !== "ibm" && (o.until || o.week) < cur && S.missed.has(o.id));
  const ph = phasesAt(cur);
  const wo = (D.watchouts || []).filter(w => S.lens === "both" || w.lens === S.lens || w.lens === "both");
  const woCol = (lens, title, cls) => { const L = wo.filter(w => w.lens === lens); return L.length ? `<div class="col"><h3><span class="tag ${cls}">${title}</span></h3>${L.map(w => `<div class="item"><b>${esc(w.title)}</b><p>${esc(w.text)} ${chips(w.src)}</p>${w.go ? `<button class="linkish" data-go="${w.go}">Show me</button>` : ""}</div>`).join("")}</div>` : ""; };
  const prIcons = ["nodeny", "person", "trace", "shield", "eye"];
  return `
  <section class="sign">
    <div class="who"><span>${esc(M.client)}</span><span>${esc(M.sow_number)}</span><span>${esc(M.project)}: ${esc(M.title)}</span></div>
    <h1>${esc(M.headline)}</h1>
    <p>${esc(M.summary)}</p>
    <div class="bullets">${WS.map(w => `<button class="bullet" data-go="route" data-ws="${w.id}"><i style="background:${w.color}">${esc(w.id.replace(/\D/g, ""))}</i><span>${esc(w.name)}</span></button>`).join("")}</div>
  </section>
  <div class="deal">${(D.deal || []).map(x => `<div><div class="l">${esc(x.label)}</div><div class="v">${esc(x.value)}</div><div class="n">${esc(x.note || "")} ${chips(x.src)}</div></div>`).join("")}</div>

  <div class="grid-brief sec" style="margin-top:22px">
    <section class="panel pad" id="measures">
      <div class="sec-h"><div><h2>What success looks like</h2><p>The SOW's success measures, from today's baseline to target.</p></div></div>
      <div class="meas"><div class="mrow mhead"><span class="hd">Measure</span><span class="hd"><svg width="12" height="12" style="vertical-align:-1px"><circle cx="6" cy="6" r="4.5" fill="#fff" stroke="#17222D" stroke-width="2"/></svg> today <svg width="12" height="12" style="vertical-align:-1px;margin-left:8px"><circle cx="6" cy="6" r="5" fill="#198038"/></svg> target</span><span class="hd" style="text-align:right">Today to target</span></div>
      ${(D.measures || []).map(measureRow).join("")}</div>
      ${D.measures_note ? `<div class="note">${esc(D.measures_note.text)} ${chips(D.measures_note.src)}</div>` : ""}
      ${!(D.measures || []).length ? `<div class="empty">The SOW has no measurable success targets. Worth raising before signature.</div>` : ""}
    </section>
    <div style="display:flex;flex-direction:column;gap:22px;min-width:0">
      <section class="panel pad now">
        <h3>${cur <= 0 ? "Before the start date" : cur > WEEKS ? "After the planned finish" : `Week ${cur}: ${fmtD(weekMon(cur))} to ${fmtD(weekFri(cur), true)}`}</h3>
        <div class="phase">${ph.map(p => `<span class="tag amber">${esc(p.name)}</span>`).join("") || '<span class="tag">No phase active</span>'}<span class="tiny" style="align-self:center">Drag "You are here" at the top to move.</span></div>
        <dl>
          <dt>Plan</dt><dd>${doneN} of ${DL.length} deliverables done<div class="prog"><i style="width:${doneN / DL.length * 100}%"></i></div></dd>
          ${FEES.fixed ? `<dt>Invoiced</dt><dd>${money(inv, true)} of ${money(FEES.fixed, true)}<div class="prog cash"><i style="width:${inv / FEES.fixed * 100}%"></i></div></dd>` : ""}
          <dt>Next up</dt><dd>${next.map(d => `<div><button data-go="route:${d.id}">${esc(d.id)} ${esc(d.name)}</button> <span class="tiny">week ${sc.W(d.id)}</span></div>`).join("") || "Nothing left."}</dd>
          <dt>${esc(CS)} owes next</dt><dd>${owes.map(o => `<div>${esc(o.text)} <span class="tiny">week ${o.week}</span></div>`).join("") || "Nothing due."}</dd>
          ${late.length ? `<dt style="color:var(--alert)">Missed</dt><dd><button data-go="owes" style="color:var(--alert)">${plural(late.length, "client obligation")} marked as missed</button></dd>` : ""}
        </dl>
      </section>
      <button class="mini" data-go="route" aria-label="Open the route map">${routeSVG({ compact: true }).svg}<span class="tiny" style="display:block;margin-top:6px;text-align:left">The whole plan in one picture. Open the route map to explore it.</span></button>
    </div>
  </div>

  ${(D.findings || []).length ? `<section class="sec" id="findings"><div class="sec-h"><div><h2>Settle these before kickoff</h2><p>Places where the SOW contradicts itself or leaves a gap that will hurt later. Found by reading the clauses against each other.</p></div></div>
    <div class="finds">${D.findings.map(f => `<article class="find ${f.severity}"><div class="pillist"><span class="tag ${f.severity === "high" ? "red" : "amber"}">${f.severity === "high" ? "High" : "Medium"}</span><span class="tag inf">Atlas finding</span></div><h3>${esc(f.title)}</h3><p>${esc(f.text)} ${chips(f.src)}</p><div class="ask"><b>Settle it:</b> ${esc(f.ask)}</div>${f.go ? `<button class="linkish" data-go="${f.go}" style="text-align:left">See it on the map</button>` : ""}</article>`).join("")}</div></section>` : ""}

  <section class="sec"><div class="sec-h"><div><h2>Why this project exists</h2></div></div>
    <div class="chain panel">${(D.why || []).map(w => `<div class="lk"><b>${esc(w.label)}</b><p>${esc(w.text)} ${chips(w.src)}</p></div>`).join("")}</div></section>

  ${(D.principles || []).length ? `<section class="sec"><div class="sec-h"><div><h2>Rules the solution must follow</h2><p>Agreed in the SOW. Only the Steering Committee can change them.</p></div></div>
    <div class="rules">${D.principles.map((p, i) => `<div class="rule">${ic(prIcons[i % prIcons.length], 44, 1.3)}<div><b>${esc(p.title)}</b><p>${esc(p.text)} ${chips(p.src)}</p></div></div>`).join("")}</div></section>` : ""}

  <section class="sec"><div class="sec-h"><div><h2>What each side should watch</h2><p>${S.lens === "both" ? "Switch the lens at the top to see one side at a time." : "Showing the " + (S.lens === "ibm" ? "IBM" : CS) + " lens."}</p></div></div>
    <div class="wo">${S.lens !== "client" ? woCol("ibm", "For IBM", "ibm") : ""}${S.lens !== "ibm" ? woCol("client", "For " + CS, "client") : ""}</div></section>`;
};
AFTER_brief = () => {
  if (!AFTER_brief.played && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    AFTER_brief.played = true;
    $$(".meas .grow").forEach((l, i) => { l.style.animationDelay = (0.15 + i * 0.07) + "s"; l.classList.add("anim"); });
  }
};

/* =====================================================================
   ORG
   ===================================================================== */
const REL = {
  sponsor: { label: "Sponsor's home", fill: "#17222D", stroke: "#17222D", text: "#fff", sub: "#C9D3DA" },
  in_scope: { label: "Where the change lands", fill: "#F1C21B", stroke: "#B28600", text: "#17222D", sub: "#5C4700" },
  pilot: { label: "Pilot partner", fill: "#EAF6EC", stroke: "#198038", text: "#0E4F22", sub: "#198038" },
  involved: { label: "Involved", fill: "#EDF4FF", stroke: "#0043CE", text: "#0A2E7A", sub: "#3D5FA8" },
  out: { label: "Out of scope", fill: "url(#ohatch)", stroke: "#7A8793", text: "#4A5865", sub: "#7A8793", dash: "4 3" },
  context: { label: "Context only", fill: "#fff", stroke: "#CFD7DB", text: "#4A5865", sub: "#7A8793" }
};
const ORGIDX = {}; (function w(n, p) { if (!n) return; ORGIDX[n.id] = n; n._p = p; (n.children || []).forEach(c => w(c, n)); })(ORG.tree, null);
function orgSVG() {
  const T = ORG.tree; if (!T) return "";
  const NW = 184, NH = 40, GX = 40, GY = 10; let leaf = 0; const pos = {};
  (function lay(n, depth) {
    const kids = S.orgFold.has(n.id) ? [] : (n.children || []);
    if (!kids.length) { pos[n.id] = { x: 10 + depth * (NW + GX), y: 10 + leaf * (NH + GY) }; leaf++; }
    else { kids.forEach(k => lay(k, depth + 1)); const ys = kids.map(k => pos[k.id].y); pos[n.id] = { x: 10 + depth * (NW + GX), y: (Math.min(...ys) + Math.max(...ys)) / 2 }; }
  })(T, 0);
  const H = leaf * (NH + GY) + 14, W = Math.max(...Object.values(pos).map(p => p.x)) + NW + 30;
  const parts = [`<defs><pattern id="ohatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="#F4F6F7"/><path d="M0 0V7" stroke="#DCE2E5" stroke-width="3"/></pattern></defs>`];
  const sel = S.orgSel, path = new Set(); { let n = ORGIDX[sel]; while (n) { path.add(n.id); n = n._p; } }
  (function links(n) {
    const kids = S.orgFold.has(n.id) ? [] : (n.children || []);
    kids.forEach(k => {
      const a = pos[n.id], b = pos[k.id], mx = a.x + NW + GX / 2, on = path.has(k.id);
      parts.push(`<path d="M${a.x + NW} ${a.y + NH / 2}H${mx}V${b.y + NH / 2}H${b.x}" fill="none" stroke="${on ? "#17222D" : "#CFD7DB"}" stroke-width="${on ? 2.5 : 1.5}"/>`);
      links(k);
    });
  })(T);
  Object.entries(pos).forEach(([id, p]) => {
    const n = ORGIDX[id], r = REL[n.relation] || REL.context, isSel = id === sel, hasK = (n.children || []).length, fold = S.orgFold.has(id);
    const dim = S.rel && n.relation !== S.rel;
    const name = n.name.length > 25 ? n.name.slice(0, 24) + "..." : n.name;
    parts.push(`<g class="onode" data-org="${id}" tabindex="0" role="button" aria-label="${esc(n.name)}" style="opacity:${dim ? 0.25 : 1};transition:opacity .2s"><title>${esc(n.name)}: ${esc(n.does || "")}</title>
      ${isSel ? `<rect x="${p.x - 5}" y="${p.y - 5}" width="${NW + 10}" height="${NH + 10}" rx="9" fill="none" stroke="#17222D" stroke-width="2"/>` : ""}
      <rect class="box" x="${p.x}" y="${p.y}" width="${NW}" height="${NH}" rx="5" fill="${r.fill}" stroke="${r.stroke}" stroke-width="1.6" ${r.dash ? `stroke-dasharray="${r.dash}"` : ""} ${n.origin === "inferred" ? 'stroke-dasharray="4 3"' : ""}/>
      <text x="${p.x + 10}" y="${p.y + 17}" style="font-size:13px;font-weight:700;fill:${r.text}">${esc(name)}</text>
      <text x="${p.x + 10}" y="${p.y + 32}" style="font-size:11.5px;fill:${r.sub}">${esc([n.kind, n.size].filter(Boolean).join(", "))}</text></g>`);
    if (hasK) parts.push(`<g class="onode" data-fold="${id}" role="button" tabindex="0" aria-label="${fold ? "Expand" : "Collapse"} ${esc(n.name)}"><title>${fold ? "Show" : "Hide"} the units inside</title><circle cx="${p.x + NW}" cy="${p.y + NH / 2}" r="9" fill="#fff" stroke="#17222D" stroke-width="1.5"/><path d="M${p.x + NW - 4} ${p.y + NH / 2}h8${fold ? `M${p.x + NW} ${p.y + NH / 2 - 4}v8` : ""}" stroke="#17222D" stroke-width="1.8"/></g>`);
  });
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;min-width:760px;max-width:${W}px" role="img" aria-label="Organization chart">${parts.join("")}</svg>`;
}
function orgDetail() {
  const n = ORGIDX[S.orgSel] || ORG.tree; if (!n) return "";
  const r = REL[n.relation] || REL.context; const crumbs = []; { let x = n; while (x) { crumbs.unshift(x); x = x._p; } }
  return `<div class="tiny">${crumbs.map(c => `<button class="linkish" data-orgsel="${c.id}" style="font-size:12px">${esc(c.name)}</button>`).join(" / ")}</div>
    <h2 style="margin-top:6px">${esc(n.name)}</h2>
    <div class="pillist" style="margin:6px 0 10px"><span class="tag" style="background:${r.fill.startsWith("url") ? "#F4F6F7" : r.fill};color:${r.text};border-color:${r.stroke}">${r.label}</span>${n.kind ? `<span class="tag">${esc(n.kind)}</span>` : ""}${n.size ? `<span class="tag">${esc(n.size)}</span>` : ""}${infTag(n)}</div>
    <dl class="kv"><dt>What it does</dt><dd>${esc(n.does || "Not described in the SOW.")}</dd>
    <dt>How ${esc(M.project)} touches it</dt><dd>${esc(n.touch || "Not described in the SOW.")}</dd>
    ${n.people && n.people.length ? `<dt>People</dt><dd>${n.people.map(p => `<div>${esc(p)}</div>`).join("")}</dd>` : ""}
    ${(n.children || []).length ? `<dt>Inside</dt><dd><div class="pillist">${n.children.map(c => `<button class="pill" data-orgsel="${c.id}"><i style="background:${(REL[c.relation] || REL.context).stroke}"></i>${esc(c.name)}</button>`).join("")}</div></dd>` : ""}
    </dl><div>${chips(n.src)}</div>`;
}
VIEW_FN_org = () => {
  const L = ORG.levels || [];
  return `<div class="view-h"><div><h1>Client organization</h1><p>From the whole of ${esc(M.client)} down to the work this SOW changes. Pick any unit to see what it does and how the project touches it.</p></div></div>
  <div class="orgtop">
    <section class="panel pad"><h2>Zoom in</h2><p class="small muted" style="margin:0 0 12px">Each step down is a smaller part of the company. The highlighted bottom step is what IBM is changing.</p>
      <div class="funnel">${L.map((l, i) => `${i ? '<div class="ar"></div>' : ""}<div style="width:${100 - i * (36 / Math.max(1, L.length - 1))}%" class="lvl ${l.node && l.node === S.orgSel ? "on" : ""} ${i === L.length - 1 ? "target" : ""} ${l.origin === "inferred" ? "inf" : ""} ${l.node ? "click" : ""}" ${l.node ? `data-orgsel="${l.node}" role="button" tabindex="0"` : ""}><span class="lv">${esc(l.label)}</span><span><b>${esc(l.name)}</b><span class="f">${esc(l.fact)} ${chips(l.src)}</span></span></div>`).join("")}</div>
    </section>
    <section class="panel pad" id="orgdetail">${orgDetail()}</section>
  </div>
  <section class="sec"><div class="sec-h"><div><h2>Org chart</h2><p>Colored by how each unit relates to the project. Pick a color to isolate it, and use the + and − to fold branches.</p></div>
    <div class="rel-legend">${Object.entries(REL).map(([k, r]) => `<button data-rel="${k}" aria-pressed="${S.rel === k}"><i style="background:${r.fill.startsWith("url") ? "repeating-linear-gradient(45deg,#DCE2E5 0 3px,#F4F6F7 3px 6px)" : r.fill};border:1.5px ${r.dash ? "dashed" : "solid"} ${r.stroke}"></i>${r.label}</button>`).join("")}</div></div>
    <div class="orgtree" id="orgtree">${orgSVG()}</div></section>
  ${(ORG.external || []).length ? `<section class="sec"><div class="sec-h"><div><h2>Outside parties the project depends on</h2><p>Not part of ${esc(CS)}, but the plan needs them or has to stay clear of them.</p></div></div>
    <div class="ext">${ORG.external.map(x => `<div class="${x.relation}"><b>${esc(x.name)}</b><span class="tag ${x.relation === "out" ? "" : x.relation === "boundary" ? "inf" : "ibm"}" style="margin:4px 0;display:inline-block">${x.relation === "out" ? "Out of scope" : x.relation === "boundary" ? "On the boundary" : "Involved"}</span><div class="muted">${esc(x.text)} ${chips(x.src)}</div></div>`).join("")}</div></section>` : ""}`;
};
AFTER_org = () => {
  const v = $("#view");
  const pickOrg = id => { S.orgSel = id; $("#orgdetail").innerHTML = orgDetail(); $("#orgtree").innerHTML = orgSVG(); $$(".funnel .lvl").forEach(b => b.classList.toggle("on", !!b.dataset.orgsel && b.dataset.orgsel === id)); };
  v.addEventListener("click", e => {
    if (e.target.closest("[data-src]")) return;
    const f = e.target.closest("[data-fold]"); if (f) { const id = f.dataset.fold; S.orgFold.has(id) ? S.orgFold.delete(id) : S.orgFold.add(id); $("#orgtree").innerHTML = orgSVG(); return; }
    const o = e.target.closest("[data-org]"); if (o) { pickOrg(o.dataset.org); return; }
    const s = e.target.closest("[data-orgsel]"); if (s) { pickOrg(s.dataset.orgsel); return; }
    const r = e.target.closest("[data-rel]"); if (r) { S.rel = S.rel === r.dataset.rel ? null : r.dataset.rel; $$("[data-rel]").forEach(b => b.setAttribute("aria-pressed", b.dataset.rel === S.rel)); $("#orgtree").innerHTML = orgSVG(); }
  });
  v.addEventListener("keydown", e => { if (e.key !== "Enter" && e.key !== " ") return; const t = e.target.closest("[data-org],[data-fold],.lvl[data-orgsel]"); if (t) { e.preventDefault(); t.dispatchEvent(new MouseEvent("click", { bubbles: true })); } });
};

/* =====================================================================
   PROCESS
   ===================================================================== */
const stepHTML = (s, i, cls) => `<div class="step ${cls}" data-step="${s.id}" tabindex="0" role="button" aria-label="${esc(s.label)}">
  <span class="n">${cls === "cur" ? "Today" : "Target"}, step ${i + 1}</span><b>${esc(s.label)}</b><span class="a">${esc(s.actor || "")}</span>
  ${s.pain ? `<span class="pain">${ic("warn", 13, 2)}${esc(s.pain)}</span>` : ""}
  <div class="stats">${(s.stats || []).map(x => `<div><strong>${esc(x.value)}</strong><span>${esc(x.label)}</span></div>`).join("")}</div></div>`;
VIEW_FN_process = () => {
  const C = PROC.current || [], F = PROC.future || [], n = Math.max(C.length, F.length);
  const fl = PROC.flow;
  return `<div class="view-h"><div><h1>Process: today and target</h1><p>The steps a request goes through now, where time is lost, and what each new capability replaces. Pick any step to see what it connects to.</p></div></div>
  <div class="lanes" id="lanes">
    <div class="lane-h" style="margin-bottom:${C.some(s => s.loop) ? 36 : 10}px">Today <span class="tag">from the SOW's current state</span></div>
    <div class="lane" style="grid-template-columns:repeat(${n},minmax(0,1fr));gap:18px">${C.map((s, i) => stepHTML(s, i, "cur")).join("")}</div>
    <div class="gap"></div>
    <div class="lane-h">Target <span class="tag">from the scope and design principles</span></div>
    <div class="lane" style="grid-template-columns:repeat(${n},minmax(0,1fr));gap:18px">${F.map((s, i) => stepHTML(s, i, "fut")).join("")}</div>
    <svg class="over" id="procover"></svg>
  </div>
  <section class="panel pad stepdetail" id="stepdetail"><span class="muted small">Pick a step above. Lines between the rows show which of today's steps each new step replaces.</span></section>
  ${fl ? `<section class="sec"><div class="sec-h"><div><h2>Where ${fmtK(fl.total)} ${esc(fl.unit)} go</h2><p>How requests arrive, what happens to them first, and who ends up deciding.</p></div>
      <div class="flowctl"><div class="seg" role="group" aria-label="Flow view"><button data-flow="today" aria-pressed="${S.flow === "today"}">Today</button><button data-flow="target" aria-pressed="${S.flow === "target"}">At target</button></div><button class="btn" id="flowPlay">Play the change</button></div></div>
    <div class="sankey" id="sankey"></div>
    <div class="kpis" id="kpis"></div>
    <div class="note" style="border-left-color:var(--ink3);background:#F4F6F7"><span class="tag inf">Atlas inference</span> ${esc(fl.note)} ${chips(fl.src)}</div></section>` : ""}`;
};
function drawProcLinks() {
  const L = $("#lanes"), svg = $("#procover"); if (!L || !svg) return;
  const R = L.getBoundingClientRect(); const box = id => { const e = $(`[data-step="${id}"]`, L); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left - R.left + L.scrollLeft, r: r.right - R.left + L.scrollLeft, t: r.top - R.top, b: r.bottom - R.top, cx: (r.left + r.right) / 2 - R.left + L.scrollLeft }; };
  svg.setAttribute("viewBox", `0 0 ${L.scrollWidth} ${L.scrollHeight}`); svg.style.width = L.scrollWidth + "px"; svg.style.height = L.scrollHeight + "px";
  const sel = S.procSel, parts = [`<defs><marker id="pa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#7A8793"/></marker><marker id="pg" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#198038"/></marker><marker id="pr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#DA1E28"/></marker></defs>`];
  [PROC.current || [], PROC.future || []].forEach(row => row.forEach((s, i) => { if (!row[i + 1]) return; const a = box(s.id), b = box(row[i + 1].id); if (!a || !b) return; const y = a.t + 26; parts.push(`<line x1="${a.r + 3}" x2="${b.l - 3}" y1="${y}" y2="${y}" stroke="#7A8793" stroke-width="1.6" marker-end="url(#pa)"/>`); }));
  (PROC.current || []).forEach(s => { if (!s.loop) return; const a = box(s.id), b = box(s.loop.to); if (!a || !b) return; const y = a.t - 22; const on = !sel || sel === s.id || sel === s.loop.to;
    parts.push(`<path d="M${a.cx} ${a.t - 2}V${y + 8}Q${a.cx} ${y} ${a.cx - 8} ${y}H${b.cx + 8}Q${b.cx} ${y} ${b.cx} ${y + 8}V${b.t - 3}" fill="none" stroke="#DA1E28" stroke-width="1.8" stroke-dasharray="5 4" marker-end="url(#pr)" opacity="${on ? 1 : 0.25}"/><text x="${(a.cx + b.cx) / 2}" y="${y - 5}" text-anchor="middle" style="font-size:12px;fill:#DA1E28;paint-order:stroke;stroke:#fff;stroke-width:4px">${esc(s.loop.label)}</text>`); });
  (PROC.future || []).forEach(f => (f.maps_to || []).forEach(cid => {
    const a = box(cid), b = box(f.id); if (!a || !b) return; const on = !sel || sel === f.id || sel === cid;
    const y1 = a.b + 2, y2 = b.t - 30, my = (y1 + y2) / 2;
    parts.push(`<path d="M${a.cx} ${y1}C${a.cx} ${my} ${b.cx} ${my} ${b.cx} ${y2}" fill="none" stroke="${on ? "#198038" : "#CFD7DB"}" stroke-width="${on && sel ? 2.6 : 1.8}" marker-end="url(#pg)" opacity="${on ? 1 : 0.5}"/>`);
  }));
  svg.innerHTML = parts.join("");
}
function procPick(id) {
  if (!$("#stepdetail")) return;
  S.procSel = S.procSel === id ? null : id;
  const C = PROC.current || [], F = PROC.future || [];
  const rel = new Set(); if (S.procSel) { rel.add(S.procSel); F.forEach(f => { if (f.id === S.procSel) (f.maps_to || []).forEach(x => rel.add(x)); if ((f.maps_to || []).includes(S.procSel)) rel.add(f.id); }); }
  $$("[data-step]").forEach(e => { e.classList.toggle("dimmed", !!S.procSel && !rel.has(e.dataset.step)); e.classList.toggle("hl", e.dataset.step === S.procSel); });
  drawProcLinks();
  const s = C.find(x => x.id === S.procSel) || F.find(x => x.id === S.procSel), isF = F.includes(s);
  $("#stepdetail").innerHTML = !s ? `<span class="muted small">Pick a step above. Lines between the rows show which of today's steps each new step replaces.</span>`
    : `<h3>${esc(s.label)} <span class="tag ${isF ? "ok" : ""}">${isF ? "Target" : "Today"}</span></h3><p style="margin:4px 0">${esc(s.detail)} ${chips(s.src)}</p>
      ${isF ? `<p class="small muted" style="margin:0">Replaces or changes: ${(s.maps_to || []).map(x => esc((C.find(c => c.id === x) || {}).label)).join(", ") || "nothing directly"}.</p>`
      : `<p class="small muted" style="margin:0">Changed by: ${F.filter(f => (f.maps_to || []).includes(s.id)).map(f => esc(f.label)).join(", ") || "nothing in scope"}.</p>`}`;
}
/* sankey */
function sankeyLayout(vals) {
  const fl = PROC.flow, W = 960, Hh = 330, NW = 16, PADY = 14, colX = [150, 470, 790];
  const nodes = {}; fl.columns.forEach((c, ci) => c.nodes.forEach((n, ni) => (nodes[n.id] = { ...n, ci, ni, in: 0, out: 0 })));
  const keys = Object.keys(vals);
  keys.forEach(k => { const [f, t] = k.split(">"); nodes[f].out += vals[k]; nodes[t].in += vals[k]; });
  Object.values(nodes).forEach(n => (n.v = Math.max(n.in, n.out)));
  const tot = Math.max(...fl.columns.map((c, ci) => c.nodes.reduce((a, n) => a + nodes[n.id].v, 0)));
  const maxN = Math.max(...fl.columns.map(c => c.nodes.length));
  const k = (Hh - PADY * (maxN - 1)) / tot;
  fl.columns.forEach((c, ci) => { let y = 10; c.nodes.forEach(n => { const N = nodes[n.id]; N.x = colX[ci]; N.y = y; N.h = N.v * k; y += N.h + (N.v > 0 ? PADY : 0); }); });
  const so = {}, ti = {}; const links = keys.map(key => { const [f, t] = key.split(">"); return { key, f, t, v: vals[key] }; });
  links.sort((a, b) => nodes[a.f].ni - nodes[b.f].ni || nodes[a.t].ni - nodes[b.t].ni);
  const byS = [...links].sort((a, b) => nodes[a.f].ci - nodes[b.f].ci || nodes[a.f].ni - nodes[b.f].ni || nodes[a.t].ni - nodes[b.t].ni);
  byS.forEach(l => { so[l.f] = so[l.f] || 0; l.sy = nodes[l.f].y + so[l.f]; so[l.f] += l.v * k; });
  const byT = [...links].sort((a, b) => nodes[a.t].ni - nodes[b.t].ni || nodes[a.f].ci - nodes[b.f].ci || nodes[a.f].ni - nodes[b.f].ni);
  byT.forEach(l => { ti[l.t] = ti[l.t] || 0; l.ty = nodes[l.t].y + ti[l.t]; ti[l.t] += l.v * k; });
  links.forEach(l => { l.w = l.v * k; const x1 = nodes[l.f].x + NW, x2 = nodes[l.t].x, y1 = l.sy + l.w / 2, y2 = l.ty + l.w / 2, mx = (x1 + x2) / 2; l.d = `M${x1} ${y1}C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`; });
  return { nodes, links, W, H: Hh + 30, NW };
}
const SK_COL = { fax: "#4A5865", phone: "#7A8793", portal: "#0043CE", notreq: "#B28600", manual: "#DA1E28", ai: "#8A3FFC", direct: "#0043CE", auto: "#198038", nurse: "#0072C3", md: "#6929C4", stop: "#B28600" };
function flowVals(t) {
  const fl = PROC.flow, a = {}, b = {}; fl.today.forEach(l => (a[l.from + ">" + l.to] = l.value)); fl.target.forEach(l => (b[l.from + ">" + l.to] = l.value));
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])]; const v = {}; keys.forEach(k => (v[k] = (a[k] || 0) * (1 - t) + (b[k] || 0) * t)); return v;
}
function drawSankey(t) {
  const el = $("#sankey"); if (!el) return; const L = sankeyLayout(flowVals(t));
  const parts = [];
  PROC.flow.columns.forEach((c, ci) => { const x = Object.values(L.nodes).find(n => n.ci === ci).x; parts.push(`<text x="${x + (ci === 0 ? L.NW : ci === 2 ? 0 : L.NW / 2)}" y="${L.H - 2}" text-anchor="${ci === 0 ? "end" : ci === 2 ? "start" : "middle"}" style="font-size:12px;fill:#7A8793">${esc(c.label)}</text>`); });
  L.links.forEach(l => { const col = L.nodes[l.f].ci === 0 ? SK_COL[l.f] : SK_COL[l.t]; parts.push(`<path d="${l.d}" fill="none" stroke="${col}" stroke-opacity="${l.w > 0.5 ? 0.32 : 0}" stroke-width="${Math.max(0, l.w)}"><title>${esc(L.nodes[l.f].label)} to ${esc(L.nodes[l.t].label)}: ${Math.round(l.v).toLocaleString()}</title></path>`); });
  Object.values(L.nodes).forEach(n => {
    if (n.h < 0.5) return; const left = n.ci === 0;
    parts.push(`<rect x="${n.x}" y="${n.y}" width="${L.NW}" height="${n.h}" rx="2" fill="${SK_COL[n.id] || "#17222D"}"/>`);
    const tx = left ? n.x - 8 : n.x + L.NW + 8, anchor = left ? "end" : "start";
    if (n.h > 9) parts.push(`<text x="${tx}" y="${n.y + n.h / 2 + 4}" text-anchor="${anchor}" style="font-size:13px;fill:#17222D"><tspan style="font-weight:700">${esc(n.label)}</tspan> <tspan style="fill:#4A5865">${fmtK(Math.round(n.v))}</tspan></text>`);
  });
  el.innerHTML = `<svg viewBox="0 0 ${L.W + 160} ${L.H}" role="img" aria-label="Flow of requests">${parts.join("")}</svg>`;
  const v = flowVals(t), sumTo = id => Object.entries(v).filter(([k]) => k.endsWith(">" + id)).reduce((a, [, x]) => a + x, 0);
  const v0 = flowVals(0), v1 = flowVals(1), s0 = id => Object.entries(v0).filter(([k]) => k.endsWith(">" + id)).reduce((a, [, x]) => a + x, 0), s1 = id => Object.entries(v1).filter(([k]) => k.endsWith(">" + id)).reduce((a, [, x]) => a + x, 0);
  const kp = PROC.flow.kpis || [];
  const k2 = $("#kpis"); if (k2) k2.innerHTML = kp.map(k => { const id = k.node, d = s1(id) - s0(id), good = k.better === "up" ? d > 0 : d < 0; return `<div class="kpi"><b>${fmtK(Math.round(sumTo(id)))}<em style="color:${good ? "#198038" : "#4A5865"}">${t > 0.99 ? (Math.abs(d) < 500 ? "same as today" : (d > 0 ? "+" : "−") + fmtK(Math.abs(Math.round(d))) + " vs today") : ""}</em></b><span>requests a year ${esc(k.label)}</span></div>`; }).join("");
}
function animateFlow(to) {
  const from = S.flowT, t0 = performance.now(), dur = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 900;
  S.flow = to > 0.5 ? "target" : "today"; $$("[data-flow]").forEach(b => b.setAttribute("aria-pressed", b.dataset.flow === S.flow));
  const step = now => { const p = dur ? clamp((now - t0) / dur, 0, 1) : 1; const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; S.flowT = from + (to - from) * e; drawSankey(S.flowT); if (p < 1) requestAnimationFrame(step); };
  const raf = f => { let done = false; requestAnimationFrame(t => { done = true; f(t); }); setTimeout(() => { if (!done) f(performance.now()); }, 40); };
  const step2 = now => { const p = dur ? clamp((now - t0) / dur, 0, 1) : 1; const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; S.flowT = from + (to - from) * e; drawSankey(S.flowT); if (p < 1) raf(step2); };
  raf(step2);
}
AFTER_process = () => {
  setTimeout(() => { if (!$("#lanes")) return; drawProcLinks(); if (S.procSel) { const id = S.procSel; S.procSel = null; procPick(id); } }, 0);
  $("#lanes").addEventListener("click", e => { const s = e.target.closest("[data-step]"); if (s && !e.target.closest("[data-src]")) procPick(s.dataset.step); });
  $("#lanes").addEventListener("keydown", e => { const s = e.target.closest("[data-step]"); if (s && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); procPick(s.dataset.step); } });
  $("#lanes").addEventListener("scroll", drawProcLinks);
  if (PROC.flow) {
    S.flowT = S.flow === "target" ? 1 : 0; drawSankey(S.flowT);
    $$("[data-flow]").forEach(b => b.addEventListener("click", () => animateFlow(b.dataset.flow === "target" ? 1 : 0)));
    $("#flowPlay").addEventListener("click", () => { S.flowT = 0; drawSankey(0); setTimeout(() => animateFlow(1), 250); });
  }
};

/* =====================================================================
   PEOPLE
   ===================================================================== */
const PID = Object.fromEntries([...(PEOPLE.ibm || []), ...(PEOPLE.client || [])].map(p => [p.id, p]));
function forumStrip(f) {
  const W = 640, sx = w => (w - 0.5) / (WEEKS + 1) * (W - 20) + 10, sc = schedule(); const p = [];
  p.push(`<line x1="10" x2="${W - 10}" y1="18" y2="18" stroke="#E3E8EA" stroke-width="2"/>`);
  const [a, b] = f.active || [1, WEEKS];
  p.push(`<rect x="${sx(a) - 4}" y="12" width="${sx(b) - sx(a) + 8}" height="12" rx="6" fill="#EDF0EF"/>`);
  if (f.every_weeks && f.every_weeks < 1) p.push(`<rect x="${sx(a) - 4}" y="12" width="${sx(b) - sx(a) + 8}" height="12" rx="6" fill="url(#dense)"/>`);
  else if (f.every_weeks) for (let w = a; w <= b; w += f.every_weeks) p.push(`<rect x="${sx(w) - 1.5}" y="11" width="3" height="14" rx="1" fill="#17222D"><title>Week ${w}</title></rect>`);
  if (f.at_gates) DL.filter(d => d.type === "gate").forEach(d => { const x = sx(sc.W(d.id)); p.push(`<rect x="${x - 6}" y="12" width="12" height="12" rx="2" transform="rotate(45 ${x} 18)" fill="#F1C21B" stroke="#17222D" stroke-width="1.4"><title>${esc(d.name)}, week ${sc.W(d.id)}</title></rect>`); });
  const cx = sx(S.week); p.push(`<line x1="${cx}" x2="${cx}" y1="2" y2="34" stroke="#F1C21B" stroke-width="2.5"/>`);
  p.push(`<text x="10" y="35" style="font-size:10.5px;fill:#7A8793">Week 1</text><text x="${W - 10}" y="35" text-anchor="end" style="font-size:10.5px;fill:#7A8793">Week ${WEEKS}</text>`);
  return `<svg viewBox="0 0 ${W} 38" preserveAspectRatio="none" aria-hidden="true"><defs><pattern id="dense" width="4" height="12" patternUnits="userSpaceOnUse"><rect width="2" height="12" fill="#4A5865"/></pattern></defs>${p.join("")}</svg>`;
}
VIEW_FN_people = () => {
  const card = (id, side) => { const p = PID[id]; if (!p) return ""; return `<div class="pcard ${side} ${p.tbd ? "tbd" : ""}"><b>${esc(p.name)}</b>${esc(p.role)}${p.title ? `<div class="nt">${esc(p.title)}</div>` : ""}${p.note ? `<div class="nt">${esc(p.note)}</div>` : ""}</div>`; };
  const esc_ = PEOPLE.escalation || [];
  const ladder = `<div class="steps">${[...esc_].reverse().map((s, ri) => { const i = esc_.length - 1 - ri; return `<div class="stp" style="margin-left:${i * 9}%;background:${i === esc_.length - 1 ? "#4A5865" : i === esc_.length - 2 ? "#17222D" : i === 0 ? "#fff" : "#EDF0EF"};color:${i >= esc_.length - 2 ? "#fff" : "#17222D"}"><b>${esc(s.level)}</b><span>${esc(s.who)}</span></div>${i > 0 ? `<div class="clk" style="margin-left:${i * 9}%">${ic("up", 15, 2.2)}<span>after ${esc(esc_[i - 1].within)}</span></div>` : ""}`; }).join("")}</div>`;
  return `<div class="view-h"><div><h1>People and governance</h1><p>Who leads each area on each side, where decisions get made, and how a stuck issue climbs.</p></div></div>
  <section class="panel pad"><div class="bridge">
    <div class="hd"><span class="tag ibm">IBM</span></div><div></div><div class="hd r"><span class="tag client">${esc(CS)}</span></div>
    ${(PEOPLE.pairs || []).map(pr => `<div class="pstack ${pr.ibm.length ? "" : "empty"}">${pr.ibm.length ? pr.ibm.map(i => card(i, "ibm")).join("") : "No named counterpart"}</div>
      <div class="area ${pr.origin === "inferred" ? "inf" : ""}" title="${pr.origin === "inferred" ? "Pairing worked out by the atlas" : "Pairing stated in the SOW"}"><span>${esc(pr.area)}</span>${pr.note ? `<div class="tiny" style="position:relative;margin-top:4px">${esc(pr.note)}</div>` : ""}</div>
      <div class="pstack">${pr.client.map(i => card(i, "client")).join("")}</div>`).join("")}
  </div><p class="tiny" style="margin:12px 0 0">Solid connectors are pairings the SOW states. Dashed ones are worked out by the atlas from roles. ${chips(["s8_1", "s8_2a"].filter(k => SRC[k]))}</p></section>
  <section class="sec"><div class="sec-h"><div><h2>Forums and their rhythm</h2><p>Each mark is a meeting. Yellow diamonds are decision gates. The yellow line is where you are.</p></div></div>
    <div class="panel pad">${(PEOPLE.forums || []).map(f => `<div class="forum"><div><b>${esc(f.name)}</b> ${chips(f.src)}<div class="c">${esc(f.cadence)}. Chair: ${esc(f.chair)}</div><div class="c">Decides: ${esc(f.decides)}</div></div>${forumStrip(f)}</div>`).join("")}</div></section>
  <div class="grid2 sec">
    <section class="panel pad"><h2>Who decides what</h2><table class="dm"><tbody>${(PEOPLE.decisions || []).map(d => `<tr><td>${esc(d.decision)} ${chips(d.src)}</td><td>${esc(d.by)}${d.flag ? ` <button class="tag red" data-go="brief:findings" style="cursor:pointer">see ${esc(d.flag)}</button>` : ""}</td></tr>`).join("")}</tbody></table></section>
    <section class="panel pad ladder"><h2>When an issue gets stuck</h2><p class="small muted" style="margin:0 0 10px">Issues start at the bottom. Each level has a clock, shown in red, before the issue moves up. ${chips([...new Set(esc_.flatMap(s => s.src || []))])}</p>${ladder}</section>
  </div>`;
};

/* =====================================================================
   SCOPE
   ===================================================================== */
VIEW_FN_scope = () => {
  const ins = SCOPE.in || [], A = SCOPE.assumptions || [];
  const broken = A.filter(a => S.broken.has(a.id));
  const tilt = Math.min(4, broken.length * 1.1);
  return `<div class="view-h"><div><h1>Scope</h1><p>What IBM is doing, what it touches but does not own, and what is somebody else's job. Anything outside the fence can be added only through change control.</p></div></div>
  <div class="fence">
    <div class="zone"><h2>Inside the fence</h2><p class="small muted" style="margin:0">IBM delivers these.</p>
      ${WS.map(w => { const L = ins.filter(i => i.ws === w.id); return L.length ? `<div class="wsgroup"><div class="wh"><i style="background:${w.color}"></i>${esc(w.name)}</div><ul>${L.map(i => `<li>${esc(i.text)} ${chips(i.src)}</li>`).join("")}</ul></div>` : ""; }).join("")}
      ${ins.filter(i => !i.ws).map(i => `<div>${esc(i.text)} ${chips(i.src)}</div>`).join("")}</div>
    <div class="post" aria-hidden="true"></div>
    <div class="zone"><h2>On the fence</h2><p class="small muted" style="margin:0">IBM has a limited role. Disputes usually start here.</p>
      ${(SCOPE.boundary || []).map(b => `<div class="bnd"><b>${esc(b.text)}</b><div class="r"><span>IBM</span><span>${esc(b.ibm_role)}</span><span>Owner</span><span>${esc(b.owner)}</span></div><div style="margin-top:4px">${chips(b.src)}</div></div>`).join("")}</div>
    <div class="post" aria-hidden="true"></div>
    <div class="zone out"><h2>Outside the fence</h2><p class="small muted" style="margin:0 0 6px">Not in this SOW. The owner is named where the SOW says.</p>
      ${(SCOPE.out || []).map(o => `<div class="outi">${esc(o.text)} ${chips(o.src)}<span class="o">${o.owner ? "Owner: " + esc(o.owner) : ""}</span></div>`).join("")}</div>
  </div>
  ${A.length ? `<section class="sec" id="assumptions"><div class="sec-h"><div><h2>What the price stands on</h2><p>The SOW's assumptions hold up the fee and the schedule. Knock one out to see what breaks. If any turns out to be wrong, either side can ask for a change.</p></div>${broken.length ? `<button class="btn" id="fixAll">Put them all back</button>` : ""}</div>
    <div class="slab ${broken.length ? "broken" : ""}">
      <div class="top" style="transform:rotate(${-tilt}deg)"><div><b>${FEES.fixed ? money(FEES.fixed) + " fixed fee" : "Price and schedule"}</b><br><span>${plural(WEEKS, "week")}, ${plural(DL.length, "deliverable")}</span></div><span>${broken.length ? plural(broken.length, "assumption") + " broken. Time for a PCR." : "All assumptions holding"}</span></div>
      <div class="pillars">${A.map(a => `<button class="pillar" data-pillar="${a.id}" aria-pressed="${S.broken.has(a.id)}"><span class="id">${esc(a.id)}</span>${esc(a.text)}<span class="crack">${ic("warn", 16, 2)}</span></button>`).join("")}</div>
    </div>
    <div class="broke">${broken.map(a => `<div class="bi"><b>${esc(a.id)} is wrong:</b> ${esc(a.text)}.<br>${esc(a.if_wrong)} <span class="tag inf">Atlas inference</span> ${chips(a.src)}</div>`).join("")}
      ${broken.length && D.contingency_terms ? (() => { const t = D.contingency_terms.find(x => /assumption/i.test(x.trigger)); return t ? `<div class="note">${esc(t.rule)} ${chips(t.src)}</div>` : ""; })() : ""}</div>
  </section>` : ""}`;
};
AFTER_scope = () => {
  $$("[data-pillar]").forEach(b => b.addEventListener("click", () => { const id = b.dataset.pillar; S.broken.has(id) ? S.broken.delete(id) : S.broken.add(id); const y = window.scrollY; render(); window.scrollTo(0, y); const nb = $(`[data-pillar="${id}"]`); if (nb) nb.focus(); }));
  const f = $("#fixAll"); if (f) f.addEventListener("click", () => { S.broken.clear(); const y = window.scrollY; render(); window.scrollTo(0, y); });
};

/* =====================================================================
   RISKS
   ===================================================================== */
const lensOK = o => S.lens === "both" || !o.lens || o.lens === "both" || o.lens === S.lens;
VIEW_FN_risks = () => {
  const R = [...RISKS].sort((a, b) => b.likelihood * b.impact - a.likelihood * a.impact);
  const sel = RISKS.find(r => r.id === S.riskSel) || R[0];
  const cellCol = s => (s >= 15 ? "#FFD7D9" : s >= 8 ? "#FCF0C2" : "#E4F2E7");
  let grid = "";
  for (let L = 5; L >= 1; L--) {
    grid += `<div class="ax">${L}</div>`;
    for (let I = 1; I <= 5; I++) { const here = RISKS.filter(r => r.likelihood === L && r.impact === I); grid += `<div class="cell" style="background:${cellCol(L * I)}">${here.map(r => `<button class="tok ${r.origin === "inferred" ? "inf" : ""} ${sel && sel.id === r.id ? "sel" : ""} ${lensOK(r) ? "" : "dim"}" data-risk="${r.id}" title="${esc(r.title)}">${esc(r.id.replace(/^R/, ""))}</button>`).join("")}</div>`; }
  }
  grid += `<div></div>${[1, 2, 3, 4, 5].map(i => `<div class="ax">${i}</div>`).join("")}`;
  const sc = schedule();
  return `<div class="view-h"><div><h1>Risks</h1><p>What could knock the plan off course, the first sign you would see, and what to do about it. Solid tokens come from the SOW. Dashed ones are risks the atlas adds from experience.</p></div></div>
  <div class="riskgrid">
    <section class="panel pad"><div style="display:grid;grid-template-columns:22px 1fr;gap:6px"><div class="ax axl tiny" style="display:grid;place-items:center">Likelihood</div><div class="heat">${grid}</div></div><div class="tiny" style="text-align:center;margin-top:4px">Impact</div></section>
    <section class="panel pad rdetail" id="rdetail">${sel ? `<div class="pillist"><span class="tag">${esc(sel.id)}</span><span class="tag ${sel.likelihood * sel.impact >= 15 ? "red" : sel.likelihood * sel.impact >= 8 ? "amber" : "ok"}">Score ${sel.likelihood * sel.impact} of 25</span>${sel.origin === "inferred" ? '<span class="tag inf">Atlas inference</span>' : '<span class="tag">From the SOW</span>'}${sel.lens && sel.lens !== "both" ? `<span class="tag ${sel.lens}">${sel.lens === "ibm" ? "Mostly IBM's concern" : "Mostly " + esc(CS) + "'s concern"}</span>` : ""}</div>
      <h2 style="margin:10px 0 6px">${esc(sel.title)}</h2><div>${chips(sel.src)}</div>
      <div class="row">${ic("eye", 22)}<div><b>Early warning</b>${esc(sel.signal)}</div></div>
      <div class="row">${ic("shield", 22)}<div><b>Contingency</b>${esc(sel.contingency)}</div></div>
      <div class="row">${ic("user", 22)}<div><b>Owner</b>${esc(sel.owner)}</div></div>
      ${(sel.links || []).length ? `<div class="row">${ic("route", 22)}<div><b>On the route map</b><div class="pillist" style="margin-top:4px">${sel.links.map(l => pillFor(l, sc)).join("")}</div></div></div>` : ""}` : `<div class="empty">The SOW lists no risks.</div>`}</section>
  </div>
  <section class="sec"><div class="sec-h"><div><h2>All risks, highest first</h2></div></div>
    <ul class="rlist panel" style="padding:0 14px">${R.map(r => `<li><button data-risk="${r.id}" aria-current="${sel && sel.id === r.id}" style="${lensOK(r) ? "" : "opacity:.4"}"><span class="sc" style="color:${r.likelihood * r.impact >= 15 ? "#DA1E28" : "#17222D"}">${r.likelihood * r.impact}</span><span><b>${esc(r.title)}</b><br><span class="tiny">Watch for: ${esc(r.signal)}</span></span><span class="tag ${r.origin === "inferred" ? "inf" : ""}">${r.origin === "inferred" ? "Atlas" : "SOW"}</span></button></li>`).join("")}</ul></section>`;
};
AFTER_risks = () => { $("#view").addEventListener("click", e => { const b = e.target.closest("[data-risk]"); if (b) { S.riskSel = b.dataset.risk; const y = window.scrollY; render(); window.scrollTo(0, y); } }); };

/* =====================================================================
   MONEY
   ===================================================================== */
VIEW_FN_money = () => {
  const sc = schedule(), F = FEES;
  if (!F.fixed) return `<div class="view-h"><div><h1>Money</h1></div></div><div class="empty">This SOW is not fixed fee. ${esc((F.invoicing || []).map(i => i.text).join(" "))}</div>`;
  const W = 1100, H = 330, x0 = 80, E0 = -0.5, lag = (F.payment_terms_days || 0) / 7, E1 = WEEKS + Math.ceil(lag) + 2;
  const X = e => x0 + (e - E0) / (E1 - E0) * (W - x0 - 30), Y = v => 290 - v / F.fixed * 250;
  const steps = (shift, add) => { const P = PAY.map(p => ({ p, e: (shift ? sc.W(p.trigger) : DLM[p.trigger].week) - 0.5 + add })).sort((a, b) => a.e - b.e); let acc = 0, d = `M${X(E0)} ${Y(0)}`; P.forEach(q => { d += `H${X(q.e)}`; acc += q.p.amount; d += `V${Y(acc)}`; }); d += `H${X(E1)}`; return { d, P }; };
  const inv = steps(true, 0), cash = steps(true, lag), plan = steps(false, 0);
  const slipped = PAY.some(p => sc.sh[p.trigger] > 0);
  const nowInv = PAY.filter(p => sc.W(p.trigger) < S.week).reduce((a, p) => a + p.amount, 0);
  const nowCash = PAY.filter(p => sc.W(p.trigger) - 0.5 + lag < S.week - 0.5).reduce((a, p) => a + p.amount, 0);
  const parts = [];
  for (let v = 0; v <= F.fixed + 1; v += 1e6) parts.push(`<line x1="${x0}" x2="${W - 30}" y1="${Y(v)}" y2="${Y(v)}" stroke="#EDF0EF"/><text x="${x0 - 8}" y="${Y(v) + 4}" text-anchor="end" style="font-size:12px;fill:#7A8793">${money(v, true).replace("$0K", "$0")}</text>`);
  parts.push(`<line x1="${x0}" x2="${W - 30}" y1="${Y(F.fixed)}" y2="${Y(F.fixed)}" stroke="#17222D" stroke-dasharray="3 3"/><text x="${W - 30}" y="${Y(F.fixed) - 6}" text-anchor="end" style="font-size:12px;font-weight:700">${money(F.fixed)} fixed fee</text>`);
  for (let w = 1; w <= E1; w += 4) parts.push(`<text x="${X(w - 0.5)}" y="${H - 14}" text-anchor="middle" style="font-size:11px;fill:#7A8793">wk ${w}</text>`);
  if (slipped) parts.push(`<path d="${plan.d}" fill="none" stroke="#7A8793" stroke-width="2" stroke-dasharray="4 4"/>`);
  parts.push(`<path d="${cash.d}" fill="none" stroke="#198038" stroke-width="2.5" stroke-dasharray="${S.lens === "client" ? "0" : "0"}"/><path d="${inv.d}" fill="none" stroke="${slipped ? "#DA1E28" : "#17222D"}" stroke-width="3"/>`);
  let acc = 0; const P = inv.P, labs = packLabels(P.map(q => ({ x: X(q.e), w: tw(q.p.label, 12) + 10 })), [0, 1]);
  P.forEach((q, i) => { acc += q.p.amount; const x = X(q.e), y = Y(acc), paid = sc.W(q.p.trigger) < S.week; parts.push(`<g><title>${esc(q.p.label)}: ${money(q.p.amount)} (${q.p.pct}%)</title><circle cx="${x}" cy="${y}" r="7" fill="${paid ? "#17222D" : "#fff"}" stroke="#17222D" stroke-width="2"/><text x="${x - 10}" y="${y - 12 - labs[i] * 15}" text-anchor="end" style="font-family:var(--cn);font-size:13px;font-weight:700;paint-order:stroke;stroke:#fff;stroke-width:5px;stroke-linejoin:round">${money(q.p.amount, true)}<tspan style="font-weight:400;fill:#4A5865"> ${esc(q.p.label)}</tspan></text></g>`); });
  const mx = X(S.week - 0.5); parts.push(`<line x1="${mx}" x2="${mx}" y1="30" y2="${H - 30}" stroke="#F1C21B" stroke-width="3"/><rect x="${mx - 34}" y="12" width="68" height="20" rx="10" fill="#F1C21B"/><text x="${mx}" y="26" text-anchor="middle" style="font-family:var(--cn);font-size:12.5px;font-weight:700">Week ${S.week}</text>`);
  const ex = F.expenses, opt = F.options || [];
  return `<div class="view-h"><div><h1>Money</h1><p>${S.lens === "client" ? `When ${esc(CS)} pays, what for, and what costs sit outside the fee.` : "When the fee is earned, when the cash actually arrives, and what sits outside the fee."} The staircase reacts to the slip simulator on the route map.</p></div></div>
  <section class="panel pad stair">
    <div class="sec-h" style="margin:0"><div><h2>${money(nowInv, true)} invoiced, ${money(nowCash, true)} collected by week ${S.week}</h2><p>Black steps are invoices at each payment milestone. The green line is cash arriving ${F.payment_terms_days} days later. ${slipped ? '<b style="color:#DA1E28">Red shows the slipped plan; grey dashes are the original.</b>' : ""}</p></div></div>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cumulative payments">${parts.join("")}</svg>
    <div class="split">${PAY.map(p => `<div style="flex:${p.amount};background:${sc.W(p.trigger) < S.week ? "#198038" : "#5B6B78"}" title="${esc(p.label)}"><b>${p.pct}%</b>${esc(p.label)}</div>`).join("")}</div>
    <p class="tiny" style="margin:6px 0 0">${chips(PAY.flatMap(p => p.src || []))}</p>
  </section>
  <div class="mcols sec">
    ${ex ? `<div class="mcol"><h3>Expenses</h3><span class="big">up to ${money(ex.cap, true)}</span><div class="gauge"><i style="width:${ex.cap / F.fixed * 100}%"></i></div><p>${esc(ex.text)} ${chips(ex.src)}</p></div>` : ""}
    ${opt.map(o => `<div class="mcol"><h3>${esc(o.label)}</h3><span class="big">up to ${money(o.amount, true)}</span><p>${esc(o.text)} ${chips(o.src)}</p></div>`).join("")}
    ${(F.excluded || []).length ? `<div class="mcol"><h3>Not in the fee</h3><ul>${F.excluded.map(x => `<li>${esc(x.text)} ${chips(x.src)}</li>`).join("")}</ul></div>` : ""}
    ${(F.invoicing || []).length ? `<div class="mcol"><h3>Invoicing</h3>${F.invoicing.map(x => `<p><b style="color:var(--ink)">${esc(x.label)}.</b> ${esc(x.text)} ${chips(x.src)}</p>`).join("")}</div>` : ""}
  </div>`;
};

/* =====================================================================
   WHO OWES WHAT
   ===================================================================== */
VIEW_FN_owes = () => {
  const cur = S.week;
  const show = o => S.lens === "both" || o.party === "both" || o.party === S.lens;
  const isDone = o => S.done.has(o.id) || ((o.until || o.week) < cur && !S.missed.has(o.id));
  const isLate = o => (o.until || o.week) < cur && S.missed.has(o.id);
  const isOn = o => o.until && o.week <= cur && o.until >= cur;
  const flt = o => S.oweFilter === "all" || (S.oweFilter === "soon" && o.week >= cur && o.week <= cur + 4) || (S.oweFilter === "late" && isLate(o)) || (S.oweFilter === "now" && (isOn(o) || o.week === cur));
  const L = OBL.filter(show);
  // timeline
  const W = 1100, x0 = 120, sx = w => x0 + (w + 0.5) / (WEEKS + 2) * (W - x0 - 20);
  const rows = []; let yy = 30; const parts = [];
  [["client", CS, "#A15C07"], ["ibm", "IBM", "#0043CE"]].forEach(([party, name, col]) => {
    const items = L.filter(o => o.party === party || (party === "client" && o.party === "both")).sort((a, b) => a.week - b.week);
    if (!items.length) return;
    const lanes = []; items.forEach(o => { const a = sx(o.week) - 7, b = o.until ? sx(o.until) + 7 : sx(o.week) + 7; let i = lanes.findIndex(e => e < a - 2); if (i < 0) { i = lanes.length; lanes.push(0); } lanes[i] = b; o._lane = i; });
    const h = lanes.length * 16 + 16;
    parts.push(`<rect x="0" y="${yy - 8}" width="${W}" height="${h}" fill="${party === "client" ? "#FCF7F0" : "#F4F8FF"}"/><text x="14" y="${yy + 8}" style="font-family:var(--cn);font-weight:700;font-size:14px;fill:${col}">${esc(name)} owes</text>`);
    items.forEach(o => { const y = yy + o._lane * 16 + 4, late = isLate(o), done = isDone(o), c = late ? "#DA1E28" : done ? "#A8B3BC" : col;
      parts.push(o.until ? `<rect x="${sx(o.week) - 6}" y="${y - 5}" width="${sx(o.until) - sx(o.week) + 12}" height="10" rx="5" fill="${c}" opacity=".85"><title>${esc(o.text)} (weeks ${o.week} to ${o.until})</title></rect>` : `<circle cx="${sx(o.week)}" cy="${y}" r="6" fill="${c}"><title>${esc(o.text)} (week ${o.week})</title></circle>`); });
    yy += h + 6;
  });
  for (let w = 0; w <= WEEKS; w += 4) parts.push(`<text x="${sx(w)}" y="${yy + 12}" text-anchor="middle" style="font-size:11px;fill:#7A8793">wk ${w}</text>`);
  parts.push(`<line x1="${sx(cur)}" x2="${sx(cur)}" y1="14" y2="${yy}" stroke="#F1C21B" stroke-width="3"/>`);
  const bucket = (party, title, cls) => { const items = L.filter(o => (party === "client" ? o.party !== "ibm" : o.party === "ibm")).filter(flt).sort((a, b) => a.week - b.week); return `<section class="panel pad bucket"><h3><span class="tag ${cls}">${title}</span><span class="cnt">${plural(items.length, "item")}</span></h3>${items.map(o => { const late = isLate(o), done = isDone(o); return `<div class="ob ${done ? "done" : ""} ${late ? "late" : ""}"><input type="checkbox" data-ob="${o.id}" ${done ? "checked" : ""} aria-label="Mark done: ${esc(o.text)}"><div><div class="t">${esc(o.text)}</div><div class="meta"><span class="tag">${esc(o.kind)}</span>${late ? '<span class="tag red">missed</span>' : isOn(o) ? '<span class="tag amber">ongoing</span>' : o.week === cur ? '<span class="tag amber">this week</span>' : ""}${chips(o.src)}</div></div><span class="w">${o.until ? `wk ${o.week} to ${o.until}` : o.week <= 0 ? "before start" : "wk " + o.week}</span></div>`; }).join("") || '<div class="empty" style="margin-top:8px">Nothing matches this filter.</div>'}</section>`; };
  const lateN = L.filter(isLate).length;
  return `<div class="view-h"><div><h1>Who owes what</h1><p>Every duty in the SOW that has a date on it, for both sides. Anything due before "You are here" is assumed done. Untick something that did not happen and it turns red here and on the Brief.</p></div>
    <div class="seg" role="group" aria-label="Filter">${[["all", "Everything"], ["now", "This week"], ["soon", "Next 4 weeks"], ["late", "Missed" + (lateN ? " (" + lateN + ")" : "")]].map(([k, l]) => `<button data-of="${k}" aria-pressed="${S.oweFilter === k}">${l}</button>`).join("")}</div></div>
  <div class="otl"><svg viewBox="0 0 ${W} ${yy + 20}" role="img" aria-label="Obligations timeline">${parts.join("")}</svg></div>
  <div class="buckets sec" style="margin-top:22px">${S.lens !== "ibm" ? bucket("client", CS + " owes", "client") : ""}${S.lens !== "client" ? bucket("ibm", "IBM owes", "ibm") : ""}</div>`;
};
AFTER_owes = () => {
  $$("[data-of]").forEach(b => b.addEventListener("click", () => { S.oweFilter = b.dataset.of; render(); }));
  $$("[data-ob]").forEach(c => c.addEventListener("change", () => { const id = c.dataset.ob; if (c.checked) { S.done.add(id); S.missed.delete(id); } else { S.done.delete(id); const o = OBL.find(x => x.id === id); if (o && (o.until || o.week) < S.week) S.missed.add(id); } const y = window.scrollY; render(); window.scrollTo(0, y); }));
};

/* =====================================================================
   FAQ
   ===================================================================== */
VIEW_FN_faq = () => {
  const q = S.faqQ.toLowerCase();
  const L = FAQ.map((f, i) => ({ ...f, i })).filter(lensOK).filter(f => !q || (f.q + " " + f.a).toLowerCase().includes(q));
  return `<div class="view-h"><div><h1>Questions people ask</h1><p>Short answers with the clause attached. ${S.lens !== "both" ? "Filtered to the " + (S.lens === "ibm" ? "IBM" : CS) + " lens." : ""}</p></div></div>
  <div class="faqs"><input type="search" id="faqQ" placeholder="Filter questions" value="${esc(S.faqQ)}" aria-label="Filter questions">
  <div style="margin-top:12px">${L.map(f => `<div class="qa ${S.faqOpen.has(f.i) ? "open" : ""}"><button class="q" data-faq="${f.i}" aria-expanded="${S.faqOpen.has(f.i)}"><span>${esc(f.q)}</span>${ic("chev", 18, 2)}</button><div class="a">${esc(f.a)} ${chips(f.src)}</div></div>`).join("") || `<div class="empty">No question matches "${esc(S.faqQ)}". Try Ctrl K to search the whole SOW.</div>`}</div></div>`;
};
AFTER_faq = () => {
  $$("[data-faq]").forEach(b => b.addEventListener("click", () => { const i = +b.dataset.faq; S.faqOpen.has(i) ? S.faqOpen.delete(i) : S.faqOpen.add(i); b.parentElement.classList.toggle("open"); b.setAttribute("aria-expanded", S.faqOpen.has(i)); }));
  const inp = $("#faqQ"); inp.addEventListener("input", () => { S.faqQ = inp.value; const pos = inp.selectionStart; render(); const n = $("#faqQ"); n.focus(); n.setSelectionRange(pos, pos); });
};

/* =====================================================================
   TOUR
   ===================================================================== */
function tour(i) {
  const T = D.tour || []; if (!T.length) return;
  if (i < 0) i = 0; if (i >= T.length) { endTour(); return; }
  S.tour = i; const st = T[i]; const f = st.focus || "";
  if (f.startsWith("slip:")) { const [, t, w] = f.split(":"); S.slip = { target: t, weeks: +w }; S.sel = t; nav(st.view); setTimeout(() => { const s = $("#slip"); if (s) s.scrollIntoView({ behavior: "smooth", block: "center" }); }, 60); }
  else if (st.view === "route" && f) { S.slip = { target: "", weeks: 0 }; S.sel = f; nav("route"); setTimeout(() => centerInMap(f), 40); }
  else if (st.view === "org" && f) { S.orgSel = f; nav("org"); }
  else { if (st.view === "route") { S.sel = null; S.slip = { target: "", weeks: 0 }; } nav(st.view, f || null); }
  const el = $("#tour");
  el.innerHTML = `<div class="tn">Step ${i + 1} of ${T.length}</div><h3>${esc(st.title)}</h3><p>${esc(st.text)}</p>
    <div class="tb"><div class="dots">${T.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</div>
    <button class="btn" id="tEnd">End tour</button>${i ? `<button class="btn" id="tBack">Back</button>` : ""}<button class="btn go" id="tNext">${i === T.length - 1 ? "Finish" : "Next"}</button></div>`;
  el.classList.add("on");
  $("#tNext").onclick = () => tour(i + 1); $("#tEnd").onclick = endTour; const b = $("#tBack"); if (b) b.onclick = () => tour(i - 1);
  $("#tNext").focus({ preventScroll: true });
}
function endTour() { S.tour = -1; $("#tour").classList.remove("on"); }

/* ---------- registry + boot ---------- */
var VIEW_FN_route, AFTER_route, VIEW_FN_brief, AFTER_brief, VIEW_FN_org, AFTER_org, VIEW_FN_process, AFTER_process, VIEW_FN_people, VIEW_FN_scope, AFTER_scope, VIEW_FN_risks, AFTER_risks, VIEW_FN_money, VIEW_FN_owes, AFTER_owes, VIEW_FN_faq, AFTER_faq;
const VIEW_FN = { brief: () => VIEW_FN_brief(), route: () => VIEW_FN_route(), org: () => VIEW_FN_org(), process: () => VIEW_FN_process(), people: () => VIEW_FN_people(), scope: () => VIEW_FN_scope(), risks: () => VIEW_FN_risks(), money: () => VIEW_FN_money(), owes: () => VIEW_FN_owes(), faq: () => VIEW_FN_faq() };
const AFTER = { brief: () => AFTER_brief(), route: () => AFTER_route(), org: () => AFTER_org(), process: () => AFTER_process(), scope: () => AFTER_scope(), risks: () => AFTER_risks(), owes: () => AFTER_owes(), faq: () => AFTER_faq() };
document.title = `${M.project} SOW Atlas`;
frame();
const h = (location.hash || "").slice(1).split(":");
nav(VIEWS.some(v => v[0] === h[0]) ? h[0] : "brief");
})();
