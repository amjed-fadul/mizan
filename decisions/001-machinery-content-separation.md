# Decision 001 — Machinery and content are separated from the first commit

**Date:** 2026-08-04
**Status:** accepted

## Context

The repository was being created. Nothing existed yet except the roadmap. The roadmap's stated end state includes extracting an open-source, headless design-system skeleton that any team can fork and feed with their own values — which means at some point every Mizan-specific value has to be separable from the pipeline that processes it.

## Problem

Should the brand-agnostic pipeline and Mizan's own values be separated structurally from day one, or should the system be built as one coherent thing and split later when the extraction is actually needed?

## Constraints

- Four to six hours a week. Anything that costs a lot of discipline every week will be abandoned.
- The extraction is a stated deliverable, not a maybe.
- Solo. There is no reviewer to catch a value leaking into the wrong directory.

## Options

1. **Split from the first commit.** `machinery/` holds pipeline, checks, plugins, agent instructions. `content/` holds tokens, rules, Arabic specifics.
2. **Build it as one system, split at extraction time.** Simpler now; one directory tree, no boundary to think about.
3. **Split only the tokens**, since those are the obvious brand-specific artifact, and leave everything else mixed.

## Trade-offs

Option 1 costs a small decision on every new file — *which side does this belong on?* — for months before the benefit arrives. It also risks over-abstracting early, building a seam for a generality that never materialises.

Option 2 is cheaper every day and far more expensive once. Untangling a system that was never designed to come apart is not a weekend; the coupling is usually in the places nobody remembers writing.

Option 3 is the worst of both: it looks like a seam and does not hold one. Scripts, checks and agent instructions all end up carrying Mizan assumptions, and those are precisely the parts a forking team needs.

## Decision

Split from the first commit. `machinery/` and `content/` are top-level siblings, each with a README stating what belongs in it and what explicitly does not.

## Why

The seam is not tidiness, it is the deliverable's cost structure. The extraction stage is budgeted as a weekend, and that budget is only real if the boundary was maintained continuously. Deferring the split converts a small recurring cost into a large one-time cost at exactly the point in the project where energy is lowest.

The recurring cost is also smaller than it looks, because the boundary has a sharp test rather than a judgment call: **if you deleted `content/`, everything in `machinery/` should still make sense.** A script that validates "semantic tokens must reference a primitive" passes. The list of Mizan's semantic tokens does not.

## Consequences

- Every new file requires a placement decision. The directory READMEs exist to make that decision fast rather than thoughtful.
- Some things will sit awkwardly. The RTL rule layer is Mizan content by location but reads almost like machinery, because the rules are general even though the type scale is not. Expect more of these.
- The Stage 7 extraction becomes a deletion rather than a refactor.
- Any Mizan value found inside `machinery/` is a defect, and can eventually be checked for by a script rather than by reading.

## What would make us revisit this?

If by Stage 4 the split is producing frequent genuine ambiguity — files that could honestly go either way, argued about more than once — the boundary is drawn in the wrong place and should be redrawn rather than endured. Ambiguity in one or two files is normal; ambiguity as a routine experience means the seam does not match the real structure of the system.
