# Decision 010 — Contrast is guaranteed at the token layer and enforced by a build gate

**Date:** 2026-08-04
**Status:** accepted

## Context

The [Stage 1 audit](../audit/stage-1-v0-audit.md) computed 129 foreground/background pairings in v0 and found **48 failing**. Its single strongest sequencing warning was that building the new token layer without resolving contrast would encode all 48 failures permanently into the replacement.

Mizan Labs has **no accessibility specialist and no capacity to hire one** — a constraint from the brief, not a temporary staffing gap. Whatever guarantee exists has to hold without anyone reviewing screens by hand.

## Problem

Where does the accessibility guarantee live, and what enforces it?

## Constraints

- No specialist, and no per-screen review capacity, ever.
- Solo maintainer at four to six hours a week — anything requiring sustained vigilance will lapse.
- The audit established that the failures are concentrated: five custom properties account for the failing text tier, four for the failing borders.
- Scripts for facts, agents for judgment. Contrast is arithmetic, so it is a script.

## Options

1. **Component-layer guarantee.** Each component ensures its own contrast; the token layer stays neutral about how values combine.
2. **Documentation guarantee.** Publish which pairings are safe; rely on designers and developers to follow it.
3. **Token-layer guarantee with a build gate.** Declare the legitimate pairings alongside the tokens and fail the build when any of them drops below threshold.

## Trade-offs

Option 1 is where most design systems put it, and it works only while every surface is a component. The audit found 22 inline colour declarations bypassing every component and every token — that is the normal condition of real product code under deadline, not an aberration. A component-layer guarantee protects exactly the code that was already going to be fine.

Option 2 costs nothing and guarantees nothing. v0 had no documentation and 48 failures; a system with documentation and no enforcement would have had documentation and 48 failures.

Option 3 requires something that did not exist before: an explicit statement of **which foreground is intended to sit on which background.** That is real authoring work, and the pairings will be incomplete at first.

## Decision

Contrast is guaranteed at the token layer. `content/tokens/pairs.json` declares every legitimate foreground/background combination, and `machinery/scripts/check-contrast.mjs` **fails the build** when any declared pair falls below its threshold — 4.5:1 for normal text, 3:1 for large text and non-text UI boundaries.

The check is written **before any semantic token exists**, so tokens are validated as they are authored rather than audited afterwards.

## Why

The most useful thing the audit revealed was not that 48 pairings fail. It was *why* they were allowed to: *nothing in v0 ever declared what pairs with what.* Every combination was implicit, discovered at render time, and therefore unverifiable. `#c0392b` text landed on a `#c62828` background at **1.03:1** — not because anyone chose it, but because one inline override changed the foreground and nothing existed to notice.

Making the pairings explicit is most of the fix. Once a system can state its intended combinations, checking them is arithmetic, and arithmetic does not get tired at 2am before a launch.

Writing the gate first matters more than it sounds. A check written afterwards has to be reconciled with tokens that already exist, and the reconciliation always ends the same way — the threshold bends, because the tokens are already in use. A check written first is a constraint the tokens are designed against. That ordering is the difference between the guarantee holding and the guarantee being negotiated.

Blocking rather than warning follows directly from the staffing constraint. A warning needs someone to read it and act, and this team has no one whose job that is. **A gate that does not block is a report nobody reads.**

## Consequences

- Every new colour pairing must be declared before it can be used. This is deliberate friction at exactly the moment a decision is being made.
- Some legitimate designs will be blocked. The escape hatch is an explicit, reviewed exception entry in `pairs.json` with a stated reason — never a lowered threshold. The exception list is itself a signal: if it grows, the palette is wrong.
- `pairs.json` will be incomplete at first and must grow as components arrive in Stage 4. An undeclared pairing is unchecked, so coverage matters as much as strictness — worth a completeness check of its own later.
- Two amber tokens are now indicator-only ([008](./008-the-colour-consolidation.md)), because they cannot pass as text at any value that still reads as amber. The gate is what makes that constraint real rather than advisory.
- The neutral text ramp lost a tier ([009](./009-the-text-ramp-loses-a-tier.md)) as a direct result of this decision. That is the cost, and it is worth it.
- This is governance rung 1 of the ladder. It is deterministic, it runs without being invoked, and it terminates in a script rather than in a person — which is the property that lets it survive a solo maintainer.

## What would make us revisit this?

If the exception list in `pairs.json` grows past a handful of entries, the threshold is fighting the design rather than protecting it, and the palette needs rework rather than more exceptions. If a real failure ships despite a green build, the pairings are under-declared and the fix is coverage, not a stricter threshold. And if AAA is ever adopted as the target, the two-tier ramp in [009](./009-the-text-ramp-loses-a-tier.md) collapses to one and the whole neutral strategy needs rebuilding.
