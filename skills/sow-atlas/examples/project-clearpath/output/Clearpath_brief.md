# Project Clearpath in one page

_Fictional SOW used for demonstration. No client data._

**Cut prior authorization decisions from 9.4 days to 5, and get the Plan inside federal timeframes, in 32 weeks.**

IBM redesigns how Larkspur Health Plan handles prior authorization, from the moment a request arrives to the moment the provider hears back. AI reads incoming faxes and portal documents, low-risk requests in three service categories are approved by rules, and nurses get an AI clinical summary. No request is ever denied by a machine.

## The deal

- Starts: Jan 11, 2027 (moves if start conditions slip)
- Pilot live: Week 24 (advanced imaging)
- Full go-live: Week 29 (all three categories)
- Finishes: Aug 20, 2027 (term ends Aug 31)
- Fixed fee: $4.86M (plus expenses, 7% cap unless approved)
- IBM team: ~14 at peak (onshore and offshore)

## What success looks like

- Median decision time, standard requests: 9.4 days today, target 5.0 days
- Expedited requests decided within 72 hours: 81% today, target 99%
- Requests received electronically: 50% today, target 75%
- Approved by rules without nurse review: <4% today, target 25%
- Intake handling time per fax request: 22 min today, target 6 min
- Requests pended for missing documents: 42% today, target 20%
- Provider satisfaction with prior auth: 2.9 / 5 today, target 3.8 / 5

_These are shared goals, not IBM guarantees, and missing one is not by itself a breach. They are measured only for the service categories live at the time, over the four weeks before the Benefits Realization Report._

## Key dates

- Week 8 (Mar 05, 2027): Discovery Sign-off
- Week 13 (Apr 09, 2027): Design Approval
- Week 23 (Jun 18, 2027): Pilot Go/No-Go Decision
- Week 24 (Jun 21, 2027): Pilot Go-Live: Advanced Imaging
- Week 26 (Jul 09, 2027): Pilot Results Report and Scale Decision
- Week 27 (Jul 12, 2027): Wave 2 Go-Live: DME and Home Health
- Week 29 (Jul 26, 2027): Wave 3 Go-Live: Outpatient Surgical Procedures
- Week 32 (Aug 20, 2027): Operational Handover and Runbooks

## What LVH has to do

- Before the start: Sign the BAA, name client roles, issue network accounts
- By week 3: Give read-only access to 24 months of event logs
- By week 3: Run the provider pulse survey (first round)
- By week 10: watsonx subscription active (an assumption in Section 9, so a PCR if it slips)
- By week 11: Approve every Auto-Approval Rule in writing
- By week 14: Provide the UM Platform test environment with APIs on
- By week 15: Finish the security review of D6 (contract deadline; the plan hopes for Week 13)
- By week 18: Name the Client UM Lead for UAT
- By week 23: Train remaining UM staff before the pilot go-live
- By week 30: Decide on the hypercare extension, in writing
- By week 30: Run the provider pulse survey (second round)

Ongoing:

- Weeks 1 to 32: Review each deliverable within 5 business days
- Weeks 1 to 32: Approve or reject each PCR within 5 business days of the assessment
- Weeks 1 to 32: Manage the UM Platform vendor and Interop Vendor
- Weeks 2 to 32: Pay each invoice within 45 days
- Weeks 3 to 13: At least 6 nurses and 4 coordinators as SMEs, up to 4 hours a week each
- Weeks 7 to 25: Clinical Policy Owner at 20% time, decisions within 5 business days
- Weeks 12 to 29: Run any consultation with employees about role changes
- Weeks 21 to 22: Provide 15 UM staff for UAT
- Weeks 26 to 28: Train remaining UM staff before Wave 2 and Wave 3

## Money

Fixed fee of $4,860,000, paid on these milestones:

- Charter accepted (week 2): $486,000
- Discovery Sign-off (week 8): $729,000
- Design Approval (week 13): $972,000
- Pilot Go/No-Go (week 23): $972,000
- Full Go-Live (week 29): $972,000
- Final Acceptance (week 32): $729,000

## Not included

- Pharmacy prior authorization (owner: Pharmacy benefit manager)
- Behavioral health utilization management (owner: Delegated behavioral health organization)
- Appeals and grievances redesign (owner: LVH)
- Writing or licensing clinical criteria (owner: LVH and its criteria vendor)
- Software licenses and cloud subscriptions, including watsonx (owner: LVH, under a separate order)
- UM Platform vendor configuration or custom development (owner: UM Platform vendor)
- Supplemental intake or clinical review staff (owner: LVH)
- Any service category beyond the three named (owner: Needs a PCR)

## Risks to watch

- Security review runs its full 15 days. Watch for: No security walkthrough booked by Week 10
- Rule approvals bottleneck on one person. Watch for: Rules waiting more than 5 business days for a decision
- Event log data is late or thin. Watch for: Access not granted by Week 2, or under 85% of records have codes
- Providers keep faxing. Watch for: Electronic share under 60% in the pilot

_Built with SOW Atlas from SOW No. LVH-2026-014. Open the atlas for the full interactive view and clause references._
