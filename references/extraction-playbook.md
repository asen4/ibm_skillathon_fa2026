# Extraction playbook

How to read a SOW so the atlas is right. SOWs from different practices and clients look different, but the information you need almost always lives in the same handful of places. Read the whole document first, then fill `sow.json` block by block using the notes below.

## Where things hide

**The headline and summary** come from the objective section, but the objective is usually written defensively ("to assist the Client in..."). Rewrite it as what the client gets: "Cut prior authorization decision time in half and get the Plan inside federal timeframes by August 2027." If you need the background section to say it well, cite both.

**The deal strip** pulls from the term section (start and end), the schedule (go-live), the fees section and the staffing section. If the start date is conditional, say so in the note.

**Success measures** are often split between the objectives section (targets) and the background section (baselines). Watch for a sentence that says the measures are goals and not commitments. That sentence matters for both lenses and belongs in the IBM watch-outs and in an FAQ answer.

**Workstreams and phases** sit in the scope section. When the SOW lists activities without naming workstreams, group them into three to six lines that make sense to a reader and set the workstream `origin` to inferred.

**Deliverables** are usually in a table or a lettered list. The week often appears in a separate schedule table or an appendix. Acceptance criteria may be listed per deliverable, collected in an acceptance section, or both. Governance decisions (sign-offs, go/no-go) are gates even when the SOW calls them deliverables.

**Dependencies** are the most valuable thing the atlas can surface and the easiest to miss. Look in four places: an explicit dependency list or table; phrases inside deliverable descriptions such as "depends on", "following", "based on", "upon receipt"; client responsibilities that name a deadline relative to the start date or a week; and assumptions about environments, licenses and access. If the SOW gives no dependency list, infer the obvious ones from phase order and mark `dep_origin` as inferred.

**Client dependencies** come from the client responsibilities section. Each one with a deadline becomes a `client_deps` entry. To set `slack`, compare the dependency's due week with the planned week of the first deliverable it feeds, minus the time that deliverable needs (for example, two to three weeks of analysis after data arrives). Be conservative.

**Contingency terms** are spread across client responsibilities ("if the Client does not perform..."), change control, acceptance (deemed acceptance, resubmission), conditions precedent (start date moves) and escalation. Quote each one.

**Payments** come from the fees section. Check that percentages and amounts agree and add up to the total. If the SOW is time and materials, the Money view shows a burn estimate instead; describe the rate card and any cap.

**Org structure** is thin in most SOWs: a paragraph about the client, a list of departments in scope, and named roles. Build the tree from what is there. You can place named departments under the right parent using the SOW's own wording ("sits within Clinical Operations under the Chief Medical Officer"). Do not fill in departments you are guessing at. If the user supplies an annual report or org chart, use it and cite it as an external source with `origin: "inferred"`.

**Process steps** come from the current-state or background section and the scope description. The SOW will rarely spell out the future process step by step; draft it from the scope (what is being built) and the design principles, and mark it inferred where the SOW does not describe it.

**People and governance** come from the staffing and governance sections. Pair IBM and client roles by area of responsibility. The decision matrix is built from forum decision rights, acceptance authorities named on individual deliverables, and change control thresholds.

**Scope boundary** items are the ones with phrases like "IBM's role is limited to", "IBM will support", "joint", "participate in". These are where disputes start, so they get their own band on the Scope view.

**Risks** the SOW states are hidden in assumptions (each assumption is a risk that it turns out to be wrong) and in client responsibilities (each is a risk that it is late). Add the delivery risks any experienced practitioner would raise for this kind of project and mark them inferred. Keep the list to eight to twelve and make sure each has a concrete early warning signal.

## Inference rules

Mark something inferred when any of these are true: it is not written in the SOW; it combines two SOW facts into a new number (for example, annual volume by channel); it comes from public knowledge about the client or industry; or it is a recommendation (recovery moves, contingencies, watch-outs that go beyond what the SOW says).

Never infer contractual facts: dates, fees, acceptance criteria, named people, obligations. If the SOW is silent, the atlas says so.

## Common traps

Dates written as "Week 12" in one section and as a calendar date in another may not agree. Check them and flag any mismatch to the user rather than silently picking one.

Payment percentages that do not add to 100 percent, or amounts that do not match the percentages, should be raised as a finding.

A deliverable with no acceptance criteria will default to the generic acceptance clause. Say so in its `acceptance` field.

"Deemed acceptance" and "use in production" acceptance are often missed by both sides. Put them in the contingency terms and in the watch-outs for both lenses.

Out-of-scope lists often hide the most expensive gap, usually software licenses, third-party vendor work, or end-user training. Name the owner for each item where the SOW does.

## Writing for the page

Write as if you were explaining the SOW to a sponsor in the hallway. Use the client's vocabulary (their department names, their product names). Keep labels short and summaries to one or two sentences. Avoid em dashes, legalese and filler. Numbers carry the most weight, so make sure every one is right.
