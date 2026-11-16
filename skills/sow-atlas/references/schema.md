# sow.json schema

`sow.json` is the single source the atlas is built from. Every view reads from it, and `build_atlas.py` validates it before building. This page lists every block, what it drives on the page, and the rules for filling it in.

## Conventions that apply everywhere

**Weeks.** All timing is in project weeks, where Week 1 starts on `meta.start_date`. Use whole numbers. Something due "within 10 business days after the start date" is due in Week 3. Something before the start is Week 0.

**`src`.** Any object can carry `src`, a list of keys into `sources`. The page turns each key into a small clause chip that opens the source drawer. Cite the narrowest clause that supports the statement. Use a list even for one key: `"src": ["s6_2a"]`.

**`origin`.** `"sow"` (default) means the SOW states it. `"inferred"` means the atlas worked it out from context, public knowledge or common delivery practice. Inferred content is drawn with a dashed outline and labelled "Atlas inference" on the page. Use it honestly; if you are unsure, mark it inferred.

**`lens`.** Optional on watch-outs, obligations, risks and FAQ entries: `"ibm"`, `"client"` or `"both"` (default). The header lens switch filters and reorders content with it.

**Text.** Write labels short (station labels under 28 characters, `short` names under 14). Write summaries as one or two plain sentences. No legal restatement, no em dashes.

## Blocks

### `meta`

| field | type | notes |
|---|---|---|
| `project` | string | Project name, e.g. "Project Clearpath". |
| `sow_number` | string | As printed on the SOW. |
| `title` | string | Full SOW title. |
| `client` / `client_short` | string | Legal name and short form used on the page. |
| `vendor` | string | Normally "IBM". |
| `industry` | string | One phrase. |
| `sow_date`, `start_date`, `end_date`, `term_end` | ISO date | `end_date` is the planned last day; `term_end` is when the SOW expires if different. |
| `weeks` | int | Planned duration. |
| `headline` | string | One sentence a sponsor could say out loud. Leads the Brief view. |
| `summary` | string | Two or three sentences expanding the headline. |
| `fictional` | bool | Shows a banner when true. |
| `as_of_week` | int or null | Starting position of the "you are here" marker. Null means use today's date. |

### `deal`
List of `{label, value, note, src}` for the "deal at a glance" strip. Keep to five or six: start, go-live, finish, fee, team, scope size.

### `why`
The chain from business context to project objective, as an ordered list of `{label, text, src}`. Usually four links: the client's strategy or pressure, the problem in numbers, the deadline or trigger, the objective.

### `measures`
Success measures, each `{id, label, baseline, target, unit, better: "down"|"up", min, max, format, src}`. `format` is a printf-like hint the page uses (`"pct"`, `"days"`, `"min"`, `"score"`). `min` and `max` set the axis for the from-to chart. If the SOW has no measurable targets, leave the list empty and the Brief shows a note saying so (that is itself a finding worth raising).

### `principles`
Non-negotiable design or delivery principles, `{title, text, src}`.

### `watchouts`
`{lens, title, text, src, go?}` where `go` is an optional jump target such as `"route:D6"` or `"risks:R2"`. Three to five per lens. For IBM think exposure: assumptions that carry the price, deemed acceptance, change triggers, cash timing. For the client think obligations: what you must provide, by when, and what is not included.

### `workstreams`
`{id, name, short, color, summary, src}`. `color` is a hex value; pick visually distinct transit-style colours. The route map draws one line per workstream in order.

### `phases`
`{id, name, start, end, summary, src}` with week numbers. Phases may overlap.

### `deliverables`
The stations on the route map.

| field | notes |
|---|---|
| `id` | As numbered in the SOW (D1, D2...). |
| `name`, `short` | Full name and a short station label. |
| `ws` | Workstream id the station sits on. Governance milestones still need a `ws` (normally the PM workstream) for the list views. |
| `week` | Planned week. |
| `type` | `"document"`, `"build"`, `"golive"` or `"gate"`. Gates are drawn as interchanges that cut across every line. |
| `depends` | Deliverable ids this one depends on. |
| `needs` | Client dependency ids this one needs. |
| `dep_origin` | `"sow"` if the SOW lists the dependencies, `"inferred"` if you derived them. |
| `acceptance` | Acceptance criteria in plain words, or empty. |
| `summary` | What it is, one sentence. |
| `milestone` | Optional label if the SOW names it as a key milestone (e.g. "Full Go-Live"). |
| `recovery` | Optional list of suggested recovery moves if it slips (always inferred). |
| `src` | Clause keys. |

### `client_deps`
Things the client must provide that the plan depends on. `{id, label, week, detail, feeds, slack, recovery, src}`. `feeds` lists deliverable ids that wait on it. `slack` is the number of weeks the dependency can slip before the first fed deliverable moves (estimate it from the plan; 0 if it is on the critical path). `recovery` is a list of suggested moves (inferred).

### `deadlines`
External dates the plan must respect, `{id, label, week | date, kind: "term"|"external"|"regulatory", src}`. The slip simulator checks the plan against each one. Always include the SOW term end if the SOW has one.

### `contingency_terms`
What the SOW itself says happens when things go off plan: `{trigger, rule, src}`. Late client responsibilities, change control, deemed acceptance, start date conditions and escalation all belong here. These appear beside the slip simulator.

### `payments`
`{id, label, trigger, amount, pct, src}` where `trigger` is a deliverable id. Amounts must add up to `fees.fixed` (the build checks).

### `fees`
`{model, fixed, currency, payment_terms_days, expenses: {cap, text, src}, options: [{label, amount, text, src}], excluded: [{text, src}], invoicing: [{label, text, src}]}`. For time and materials SOWs set `model: "tm"`, leave `fixed` null and describe the rate card in `invoicing`.

### `org`
`{levels, tree}`.

`levels` is the zoom ladder from enterprise to the process being changed: `[{name, label, fact, src, origin}]`, outermost first.

`tree` is a nested node: `{id, name, kind, relation, does, touch, size, people, children, src, origin}`. `relation` is one of `"sponsor"` (where the sponsor sits), `"in_scope"`, `"involved"`, `"pilot"`, `"out"` or `"context"`. `does` says what the unit does, `touch` says how the project affects it, `people` lists named contacts. Do not add units that are neither in the SOW nor in material the user supplied; if you add public-knowledge context, mark it inferred.

### `process`
`{current, future, flow}`.

`current` and `future` are ordered steps `{id, label, actor, detail, stats: [{value, label}], pain, maps_to, src}`. `maps_to` on a future step lists the current step ids it replaces or changes, which drives the connecting lines between the two rows. `pain` is a short phrase for current-state problems. Add `loop: {to, label}` to show a rework loop back to an earlier step.

`flow` drives the volume diagram: `{total, unit, origin, columns: [{label, nodes:[{id,label}]}], today: [{from,to,value}], target: [{from,to,value}], note}`. These numbers are usually derived, so mark `origin: "inferred"` and explain the arithmetic in `note`.

### `people`
`{ibm: [...], client: [...], pairs: [...], forums: [...], decisions: [...], escalation: [...]}`.

People are `{id, name, role, title, src}`. `pairs` matches counterparts: `{area, ibm: [ids], client: [ids]}`. Forums are `{id, name, cadence, every_weeks, active: [start,end], chair, members, decides, src}`. `decisions` is the decision matrix: `{decision, by, forum, src}`. `escalation` is ordered: `{level, who, within, src}`.

### `scope`
`{in: [{text, ws, src}], boundary: [{text, ibm_role, owner, src}], out: [{text, owner, src}], assumptions: [{id, text, if_wrong, src}]}`. `boundary` is for items IBM touches but does not own (an interface spec for someone else's API, joint testing). `if_wrong` explains what breaks if the assumption fails; this is usually inferred and that is fine because the SOW already says assumptions can trigger change.

### `risks`
`{id, title, likelihood, impact, origin, signal, contingency, owner, links, lens, src}`. Likelihood and impact are 1 to 5. `signal` is the early warning you would see first. `links` are deliverable or client dependency ids; the page lets the reader jump to them on the route map. Include the risks the SOW states (look in assumptions and client responsibilities) and the obvious ones it does not; mark the latter inferred.

### `obligations`
Every duty with a time on it, for both parties: `{id, party: "client"|"ibm"|"both", text, week, until, kind, src}`. `until` is set for duties that span weeks. `kind` is `"provide"`, `"decide"`, `"review"`, `"attend"`, `"deliver"` or `"pay"`. Pull these from client responsibilities, acceptance terms, change control and governance.

### `faq`
`{q, a, lens, src}`. Write the questions people ask: when do we go live, what happens if we are late, what is not included, how do we change scope, when are we billed, what do we have to do this month, who decides.

### `tour`
Optional guided walkthrough: `[{view, focus, title, text}]`. `focus` is an optional element id to highlight (for example `"D15"`). Six to nine steps that tell the story of the engagement.

### `findings`
`{id, severity: "high"|"medium", title, text, ask, src, go}`. Places where the SOW contradicts itself or leaves a gap, found by reading clauses against each other (a review window longer than the slot the plan allows for it, two forums that both claim a decision, a deadline that can be read two ways). `ask` is the one action that settles it. These lead the Brief under "Settle these before kickoff", which is often the most valuable thing the atlas produces, so look hard for them. Always inferred.

### Slip simulator extras
`slip_presets`: `[{label, target, weeks}]`. These are one-click scenarios shown above the simulator. Pick the three to five slips most likely to happen on this engagement.

`slip_rules`: `[{when: "any"|"golive_moves"|"term_breach", text, src}]`. These are the SOW consequences shown under a simulated slip, filtered by what the slip actually caused.

`deadlines[].check`: the deliverable id each deadline is tested against (for example, the term end is checked against the Final Acceptance deliverable). The simulator reports "misses the deadline" or "still makes it" with the margin.

### Small optional fields
`client_deps[].short` is a station label for the map. `client_deps[].shifts_all: true` marks a start condition that moves every week of the plan. `deliverables[].needs_origin: "inferred"` marks client links that came from Section 6 reading rather than an explicit dependency list. `measures[].baseline_label` is display text such as "<4%". `measures_note` is `{text, src}` shown under the success chart. `process.flow.kpis` is `[{node, label, better: "up"|"down"}]`, the three numbers under the flow diagram. `org.levels[].node` links a zoom step to an org tree node. `org.external` is `[{name, relation: "involved"|"boundary"|"out", text, src}]` for third parties.

### `sources`
`{key: {sec, text}}`. `sec` is the clause reference as printed (e.g. "6.2(a)"); `text` is a verbatim excerpt. The build normalises whitespace and quote styles when matching, but otherwise the excerpt must appear exactly as written in the SOW. Keys are free-form but short (`s6_2a`).
