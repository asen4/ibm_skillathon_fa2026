---
name: sow-atlas
description: Turn a Statement of Work (SOW) into an interactive, visual "atlas" that anyone on the IBM or client side can understand in five minutes. Use when someone shares a SOW, contract scope, or services agreement (.docx, .pdf, .md, .txt) and asks to summarize it, make it visual, build a TLDR, map the plan or timeline, show who owes what, explain the client organization, or prepare for a kickoff, steering committee, or client walkthrough.
version: 1.0.0
author: Anubhav Sen (IBM Consulting)
license: Internal use. Contains no client data.
---

# SOW Atlas

A signed SOW is the most important document on an engagement and the one people read least. It runs thirty to eighty pages, the important parts are scattered (a dependency in Section 6 quietly decides whether the go-live in Section 7 happens), and both sides end up working from memory. SOW Atlas reads the SOW once, carefully, and produces a single interactive HTML file that lays the whole engagement out as a set of maps: where the client is today and where the project has to get them, the route from week one to final acceptance, the client organization and where the project sits inside it, who owes what and when, what happens if a step slips, and where the money moves. Every statement in the atlas links back to the clause it came from, so nobody has to take the summary on faith.

## When to use it

Use this skill when the user provides a SOW or similar scope document and wants any of the following: a summary or TLDR, a visual or interactive version, a timeline or plan view, a view of client obligations, a client org view, a risk or contingency view, or material to walk a client or an IBM team through the deal. Typical phrasing includes "make this SOW digestible", "build me a one-pager for the kickoff", "what does the client actually have to do", "what happens if the data is late", and "show the steering committee the plan".

Do not use it for drafting a new SOW from scratch, for legal review or redlining (the atlas explains the document, it does not give legal advice), or for documents that have no plan, scope or commercial terms.

## Inputs

The skill needs one SOW file. Supported formats are .docx, .pdf (text based; scanned PDFs need OCR first), .md and .txt. Optional extras that improve the result are the client's public annual report or org information, a current date to position the "you are here" marker, and the user's preferred lens (IBM, client, or both). Never invent client facts that are not in the provided material. If the SOW contains real client data and the output will leave the engagement team, remind the user to handle it under the engagement's data rules.

## Outputs

The skill produces three files in the user's chosen folder: `<project>_SOW_Atlas.html`, a single self-contained interactive page with no external dependencies that opens in any modern browser and works offline; `<project>_brief.md`, a plain text one-page brief generated from the same data for email or chat; and `sow.json`, the structured extraction the page is built from, which can be reviewed, corrected and rebuilt.

## What the atlas contains

The page has ten views, reachable from the left rail, by number keys 1 to 0, or through search (Ctrl or Cmd + K).

1. **Brief.** A plain-language headline of what the project is, the deal at a glance (start, go-live, end, fee, team size), a from-to chart of every success measure from baseline to target, a "you are here" status card, a miniature route map, the findings to settle before kickoff (places where the SOW contradicts itself or leaves a gap), the "why this exists" chain from business driver to objective, the design rules, and lens-specific watch-outs for IBM and for the client.
2. **Route map.** The plan drawn as a transit map. Each workstream is a line, each deliverable is a station, governance decisions are gates that cut across every line, payment milestones sit underneath, and client dependencies appear as their own row. Drag the "you are here" marker to any week to see what is done, in flight and due next. Select any station to trace what it depends on and what it feeds. Use the slip simulator to delay any client dependency or deliverable and watch the downstream go-lives, payments and contract end date move, with the SOW's own contingency terms and suggested recovery options alongside.
3. **Client org.** A zoom ladder from the whole enterprise down to the process being changed, and a collapsible org tree colored by how each unit relates to the project (in scope, involved, pilot partner, out of scope). Selecting a unit shows what it does, how the project touches it and who represents it.
4. **Process.** The current and future process side by side as a flow, with the pain points, rework loops and statistics the SOW cites, followed by a flow diagram of where the yearly volume goes today and at target.
5. **People and governance.** IBM and client counterparts paired by area, the governance forums with their rhythm and decision rights, a decision matrix, and the escalation ladder with its time limits.
6. **Scope.** What is inside the fence, what sits on the boundary with a limited IBM role, and what is outside along with who owns it instead. The assumptions the price rests on are shown with what breaks if each one is wrong.
7. **Risks.** A likelihood and impact grid. Each risk has an early warning signal, a contingency, an owner and links to the clauses and deliverables involved, and is marked as either stated in the SOW or inferred by the atlas.
8. **Money.** The fee as a cash staircase across the weeks (it responds to the slip simulator), payment triggers, expense caps, optional extensions, invoicing terms and anything the fee does not include.
9. **Who owes what.** Every obligation for both parties on one timeline, filterable by party and checkable, with overdue items flagged against the "you are here" week.
10. **Questions.** The questions people actually ask about a SOW, answered in one or two sentences with the clause attached.

A lens switch in the header reframes the content for an IBM reader (commercial protections, assumptions, change triggers, cash) or a client reader (what you get, what you must do and by when, what is not included).

## How to run it

Follow these steps in order. The quality of the atlas depends almost entirely on step 2, so take the time there.

### Step 1. Extract the SOW into numbered sections

```bash
python3 scripts/extract_sow.py <path/to/sow.docx|pdf|md|txt> --out <workdir>/sections.json
```

This writes `sections.json` (one entry per numbered section with its id, title and full text) and prints a section outline. Read the whole outline and then read every section in full. Do not skim. Dependencies, acceptance rules and payment triggers are frequently buried in sections that look procedural.

### Step 2. Author `sow.json`

Read `references/schema.md` for the exact structure and `references/extraction-playbook.md` for where each element usually hides in a SOW and how to handle gaps. Then write `<workdir>/sow.json`. The essentials:

- **Quote, do not paraphrase, in sources.** Every entry in `sources` must be a verbatim excerpt of the SOW (a sentence or two, enough to stand alone). The build script checks this and fails on any excerpt it cannot find. Paraphrasing belongs in the other fields, which point at sources by key.
- **Mark inference honestly.** Anything not stated in the SOW (most risks, all suggested contingencies, illustrative volume flows, positions on the org tree that come from public knowledge) must carry `"origin": "inferred"` or sit in a field the schema labels as suggested. The page shows these differently so readers can tell the contract from the commentary.
- **Model dependencies explicitly.** Each deliverable lists the deliverables it depends on and the client dependencies it needs. If the SOW has a dependency table, use it. If not, infer from the phase logic and mark the deliverable's `dep_origin` as `"inferred"`.
- **Use weeks, not dates.** Express timing in project weeks from the start date; the page calculates calendar dates. If the SOW only gives dates, convert them.
- **Hunt for findings.** Read the clauses against each other: review windows against the slot the plan leaves for them, decision rights in governance against the deliverable that names an approver, deadlines that can be read two ways, payment triggers that depend on a forum meeting. Each real conflict becomes a `findings` entry with the one action that settles it. This is the part of the atlas people remember.
- **Write for a busy reader.** Labels short enough to fit a station tooltip, summaries in plain sentences, no legal restatement. The headline should read like something a sponsor would say out loud.

### Step 3. Build and validate

```bash
python3 scripts/build_atlas.py --data <workdir>/sow.json --sections <workdir>/sections.json \
  --template assets/atlas_template.html --out <outdir>/<Project>_SOW_Atlas.html --brief <outdir>/<Project>_brief.md
```

The build validates the data (required fields, every referenced id exists, the dependency graph has no cycles, payment milestones add up to the fixed fee, every source excerpt appears verbatim in the SOW), reports which SOW sections the atlas covers, and injects the data into the template. Fix every error it reports and rebuild. Treat warnings as a checklist: an uncited section usually means something was missed.

### Step 4. Check it like a reviewer would

Open the HTML and walk through every view. For anything client-facing, have a second reviewer (or a subagent) check `sow.json` against the SOW for numbers, dates and inference presented as fact, since the build can only verify the quotes. Confirm the headline, the go-live and end dates, the fee and the success measures against the SOW yourself. Try the slip simulator on the client dependency most likely to slip and make sure the downstream effect makes sense. If a screenshot tool is available, use it. Then share the HTML and the brief with the user, and tell them in a sentence or two what the atlas shows and anything you had to infer.

## Quality bar

The atlas is only useful if people trust it, so hold it to these standards. Every number on the page traces to a clause. Dates, fees and success measures match the SOW exactly. Nothing inferred is presented as contractual. The page loads with no network access, works with a keyboard, reads on a laptop or a tablet, and respects reduced motion settings. If the SOW is silent on something a view needs (for example, there is no org information), leave that part of the view empty with a short note rather than filling it with guesses.

## Files in this skill

- `SKILL.md`: this guide.
- `references/schema.md`: the full `sow.json` structure with field-by-field notes.
- `references/extraction-playbook.md`: how to read a SOW for each part of the atlas, inference rules, and common traps.
- `assets/atlas_template.html` and `assets/atlas.js`: the page shell and the renderer. Data driven, so they work for any SOW that follows the schema. The build inlines both into one file.
- `assets/fonts/`: TeX Gyre Heros and Heros Condensed (GUST Font License), embedded at build time so the page looks the same offline.
- `scripts/extract_sow.py`: converts .docx, .pdf, .md or .txt into numbered sections.
- `scripts/build_atlas.py`: validates `sow.json`, checks source excerpts against the SOW, writes the atlas HTML and the markdown brief.
- `examples/project-clearpath/`: a complete worked example built from a fictional healthcare SOW (input and output).

## Version history

- 1.0.0 (November 2026): first release for the Process Studio Skillathon.
