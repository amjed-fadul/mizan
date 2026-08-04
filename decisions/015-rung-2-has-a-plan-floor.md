# Decision 015 — Governance rung 2 has a plan floor, and the floor is published

**Date:** 2026-08-04
**Status:** accepted

## Context

Rung 2 — [`check-drift.mjs`](../machinery/scripts/README.md#check-driftmjs--governance-rung-2) — was built to take its picture of Figma two ways: a saved snapshot file, or a live read of `GET /v1/files/<key>/variables/local`. The live read was the interesting half. It is what would let a CI job notice, unprompted, that somebody had hand-edited a variable.

The whole arrangement rested on one sentence, written in the scripts README and never tested: *Figma's variables **write** API is Enterprise-gated, which is why the plugin exists; reading is the half this gate needs.*

That sentence is wrong, and this session is where it was checked.

**What was verified.**

| Route | Result |
|---|---|
| `GET /v1/files/:key/variables/local` | Enterprise only. Needs the `file_variables:read` scope **and** a Full seat in an Enterprise org. Read is gated exactly as write is. |
| Figma MCP `search_design_system` | Returns variables from *published libraries* only, and gives names, keys and types — **no values**. |
| Figma MCP `get_variable_defs` | Returns values, but only for variables **bound to a selected layer**. Returns nothing on an empty file; needs a manual selection in the desktop app. |
| Running a plugin headlessly | Impossible on every plan, Enterprise included. There is no API that executes a plugin. |

So on Professional — Mizan's plan, and the plan almost every team forking the Stage 7 skeleton will be on — there is no way for a script to fetch the live variable table at all.

## Problem

When the live read is unavailable, does the governance ladder require an Enterprise plan, lose its second rung, or change shape?

## Constraints

- **Figma is a display, never a source** — rule 1. Nothing decided here may create a path that reads a Figma value back into the token source.
- A gate that only runs when somebody has the right credentials is a gate that does not run. This is already the stated reason the snapshot route exists.
- The [Stage 7 extraction](../mizan-roadmap-v1.md) publishes this machinery for other teams to fork. Whatever is claimed has to be true in the fork, not only here.
- Solo maintainer, four to six hours a week. Anything needing sustained vigilance will lapse ([010](./010-contrast-is-a-token-layer-guarantee.md)).
- **The sync is manual and always will be.** Plugins cannot be executed by an API on any plan. Somebody opens the file and clicks Preview, then Apply.

## Options

1. **Require Enterprise.** Declare rung 2 an Enterprise capability. The ladder is described as designed, and the plan is a stated prerequisite for the second rung.
2. **Drop rung 2 below Enterprise.** Below the floor the ladder has one rung. `check-drift.mjs` survives as a self-test fixture and nothing else.
3. **Accept a degraded rung 2 below Enterprise, and document the degradation.** Drift is checked at the moment of sync, from a payload the plugin exports, plus a generated proof sheet whose frames bind every variable so the values can be read back through the MCP with a single selection.

## Trade-offs

Option 1 is clean and unavailable. Mizan is on Professional; the extraction targets teams that are not on Enterprise either. A governance model that can only be run by readers who do not exist is a diagram of a governance model.

Option 2 is honest and wasteful. Almost everything the detector can catch, it can still catch — it already accepts a snapshot, and the plugin is standing inside the file with the variable table in hand. Retiring a working check because one of its two input routes is gated throws away the check, not the gate.

Option 3 is the one that survives, and it costs three things worth naming.

- **Verification is only as fresh as the last sync.** Between syncs the file can be wrong and nothing says so.
- **It has a human step.** The proof-sheet read needs somebody to select a frame in the desktop app. A step a person takes is a step a person can skip, and a skipped step reports nothing rather than reporting a problem.
- **The proof sheet is a third consumer of the projection rules**, alongside the plugin and the detector, and therefore a third thing that can fall out of step with `src/core/map.ts`.

The first of those is the real cost, and it is not a small one. Unattended detection exists to catch **drift you did not cause and were not told about** — the hand-edit nobody mentioned. That is the case the governance ladder most wants, and below Enterprise it is the case that goes uncovered.

## Decision

Governance rung 2 has a plan floor. It degrades by tier rather than failing outright, and the floor is published rather than hidden.

| Tier | What rung 2 is |
|---|---|
| **Enterprise** | Unattended drift detection. CI reads the variables and catches a hand-edit nobody reported. |
| **Everything below** | Drift detection at the moment of sync, from the plugin's exported payload, plus a generated proof sheet that binds every variable so the values are readable through the MCP with one selection. |

The `--file-key` route stays exactly as it is. It simply only works above the floor, and the documentation says so instead of implying otherwise.

## Why

**The burden is smaller than it first looks, because the sync is already manual.** No plan lets a script run a plugin, so somebody is already in that file, already clicking through a diff. Verification attaches to a step that has to happen anyway. It is not a new ritual — it is a few more seconds inside an existing one. Had the sync been automatable and this been the only manual step, the answer would probably have been different.

**The MCP was tested as a substitute and cannot be one, and it is worth writing down why** so that nobody re-tests it hopefully in six months. `search_design_system` sees published libraries and returns names, keys and types with no values — enough to know a variable exists, never enough to know it is right. `get_variable_defs` does return values, but only for variables bound to a selected layer; on an empty file it has nothing to say. Neither is a read of the file's variable table.

But the second one stops being a dead end the moment something binds the variables to layers. That is the entire job of the proof sheet: it converts *"no values without a selection"* from a blocker into a precondition the pipeline can generate for itself.

**This is worth publishing rather than concealing.** Most teams forking the Stage 7 skeleton will not be on Enterprise. A governance model that only works at the top tier, presented as if it works everywhere, fails silently in somebody else's repository — they inherit the claim and discover the gap the first time it mattered. A model that states its floor tells them what they are getting before they start. **A documented limit is a feature of an honest system**, and a system built to be forked has no business shipping a capability claim it cannot meet in the fork.

**It also sharpens what the plugin is.** It began as a workaround for one Enterprise gate, on writing. It turns out to be the bridge in **both** directions — below Enterprise it is the only component in the system that can see Figma's variables at all.

That does not weaken rule 1, and the distinction matters. The plugin exports what it observes; the detector compares it to the source; every remedy still runs outward. Nothing here takes a Figma value into the token source. **Reading for verification is not reading for authority** — the display is being asked what it is showing, not what it thinks is true.

## Consequences

- The claim in [`machinery/scripts/README.md`](../machinery/scripts/README.md) that "reading is the half this gate needs" is false and has to be corrected. Its `--file-key` documentation needs the Enterprise condition stated at the point of use, not in a footnote.
- **The snapshot route is promoted.** It was described as the offline convenience that makes the gate testable; below Enterprise it is the only route there is. Its format is now load-bearing, and the plugin must export the endpoint's payload shape verbatim so the detector cannot tell the two sources apart.
- The plugin gains an export responsibility it did not have. That is scope it did not ask for, on the component that already carries the most.
- The proof sheet is a new generated artifact governed by the projection rules, which means a new way for those rules to disagree with themselves. The rule from the detector's design applies unchanged — a projection that discards information is shared code, not a mirrored comment.
- **The health dashboard's claim gets weaker below the floor and must say so.** "Aligned" and "aligned as of the last observation" are different statements, and the page should carry the tier it was produced under and when the display was last seen. A dashboard that reads identically on both tiers is misreporting on one of them.
- Between syncs, below Enterprise, the file can drift and nothing will notice. This is the accepted cost, stated plainly, and it is the reason the floor exists as a documented concept rather than an unmentioned difference.
- The Stage 7 skeleton has to ship this floor in its own README. Otherwise a forking team inherits a governance promise its plan cannot keep.

## What would make us revisit this?

**The floor moving.** The check is a scripted probe: call `GET /v1/files/:key/variables/local` with a non-Enterprise token and watch the status code. The day it returns 200 rather than 403, the tiering collapses — the CI job becomes the single path for every tier and the proof sheet gets deleted rather than maintained. That probe belongs in CI as a standing question, because the answer changing is good news that would otherwise go unnoticed for a year.

**Headless plugin execution.** If Figma ever ships a way to run a plugin without a person in the file, the premise this decision rests on — *the sync is already manual, so verification is free* — stops holding. The manual proof-sheet read would then be the only human step left in the loop, which is a much worse ratio than it is today, and the trade has to be argued again from scratch.

**The step being skipped.** If two consecutive syncs land with no recorded drift result, the degraded rung is not being run. An unrun gate is worth less than an honestly stated absence, and at that point option 2 was the right answer after all.
