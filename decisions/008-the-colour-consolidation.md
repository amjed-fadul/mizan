# Decision 008 — Thirty-three colours walked in. Here is who survived, and who was spared.

**Date:** 2026-08-04
**Status:** accepted

## Context

The [Stage 1 audit](../audit/stage-1-v0-audit.md) inventoried **33 distinct colour values** across Market and Move, of which **21 pairs sit below the just-noticeable difference while serving the same role**. This is the consolidation that answers it.

## Problem

Which of these values are the same colour wearing different names, and which are different meanings that happen to look alike?

## Constraints

- Merging is not free: every merge removes a distinction someone once made on purpose.
- Splitting is not free either: every surviving token is a token to maintain, document and teach.
- Whatever survives must pass WCAG AA in the role it is used for ([010](./010-contrast-is-a-token-layer-guarantee.md)).
- The two products must stay visibly different ([005](./005-two-products-not-one.md)).

## Options

1. **Merge on perceptual distance.** Anything below the JND becomes one token.
2. **Merge on role.** Values used for the same job become one token regardless of distance.
3. **Merge on role, then verify by distance** — and treat a mismatch between the two as a signal to look harder.

## Trade-offs

Option 1 is objective, fast, and wrong. It would merge `--discount` and `--safety`, which are 4.21 apart and mean entirely different things. Perceptual distance is a measurement, not a meaning.

Option 2 is correct in principle and unfalsifiable in practice — "role" is whatever the person consolidating says it is, and without a measurement there is nothing to argue with.

Option 3 costs more time and produces the only defensible answer: the measurement constrains the judgment without replacing it.

## Decision

Merge on role, verified by distance. **33 values become 14.** Four consolidations, three refusals.

### The merges

| Merged | From | Tightest ΔE00 | Reasoning |
|---|---|---|---|
| `text.primary` | `#333333` `#2f2f2f` `#343434` `#2e2e2e` | **0.32** | four names for "the darkest text on white", all 12.45–13.58:1. No usage distinguishes them. |
| `border.default` | `#dddddd` `#dcdcdc` `#e0e0e0` `#eaeaea` | **0.23** | four names for a 1px neutral hairline. |
| `surface.sunken` | `#f5f5f5` `#f2f2f2` `#eaeaea` | **0.62** | three names for a lightly tinted panel. |
| `action.primary` | `#2e7d5a` `#2f8560` | **2.90** | **both are the brand.** See below. |

The brand merge is the one that matters most and is easiest to miss. The gap between the two greens is **2.90**, while the gap a hover state is meant to signal is **9.23**. The brand was less distinct from itself than a button is from its own hover.

**Correction, made while authoring the primitives:** an earlier draft of this entry claimed `action.primary` resolves to the same value in both products. That was wrong, and it contradicted the audit's explicit instruction to leave Move's blue and Market's green alone. Both greens are Market-lineage — `--brand` from the ancestor stylesheet and `--color-brand-500` from Market's refresh — and Move never had a green at all. So the merge is **within Market's own drift**, not across products. `action.primary` still resolves per product mode: green in Market, blue in Move. The brand is now one green instead of two; it is not one colour instead of two products.

### The refusals

These are the entries worth reading. All three would have been merged by any distance-based rule.

**`commerce.discount` and `mobility.safety` stay separate.** ΔE00 **4.21** — close enough that merging looks like tidying. One means *this costs less*; the other means *this cancels your trip*. Merging them would make it impossible to restyle destructive actions without restyling every discount badge in the catalogue. **Value coincidence is not semantic identity.**

**`commerce.stock.low` and `mobility.surge` stay separate.** ΔE00 **6.71** — not near-identical, and the audit was explicit that they should remain independently tunable. One means *we are running out*, the other *this costs more right now*. They share a visual register and nothing else.

**Market's and Move's secondary text stay separate** — `#5a5a5a` (6.90:1) and `#6b6b6b` (5.33:1), ΔE00 **6.30**. These are *not* near-identical, and the audit named merging them the most damaging cleanup available. Market is browsed on a sofa; Move is read at a curb in one glance. Under [007](./007-modes-for-shared-namespaces-for-unique.md) this survives as **one semantic name, `text.secondary`, resolved differently by product mode** — so the distinction is preserved without making components product-aware.

### The deletions

`#c0392b` and `#cc3333` (a redundant third and fourth red, one of them declared and never used), `#767676` and `#2e2e2e` (inline-only overrides that shadowed tokens that already existed), `#e8ebee` (an untokenised map background), and `--space-4` (declared, never referenced). Nine values leave without replacement because nothing depended on them meaning anything.

`--surface` at `#fafafa` is deleted for a different reason: at **ΔE00 1.00 from pure white** it was not a surface, it was a rounding error. A surface that cannot be seen is not doing the job its name claims.

### The values that had to change

Two refusals survived as *tokens* while losing their *values*. Both ambers failed contrast in the role they were used for — `stock.low` at 2.69:1 and `surge` at 3.19:1 as text on white. Amber is unusually hard to make accessible; reaching 4.5:1 requires roughly `#a05f00`, which reads brown and abandons the warning register entirely.

So the role narrows rather than the colour darkening past recognition: **these tokens become indicator colours, not text colours.** They pass 3:1 as graphics — a dot, a bar, a badge fill — and the text beside them uses `text.primary` like everything else. Status colour and status text are two jobs, and v0 conflated them.

## Why

The audit could tell me which values are close. It could not tell me which are the *same*. That distinction is the entire content of this decision, and it is why the consolidation could not be mechanical.

Three of the seven judgments went against the measurement. `discount` and `safety` are close and stay apart. The two brand greens are further apart than either of those pairs and merge. A rule built on distance would have got all three backwards.

The refusals also carry more weight than the merges, because a merge can be undone by adding a token back, while a merge that erased a real distinction is invisible afterwards — nobody can see the meaning that used to be there.

## Consequences

- **33 values become 14.** Every remaining value is referenced by a semantic token; no primitive exists without a consumer.
- Two amber tokens can no longer be used for text. This is a real capability loss and needs stating in their `$description`, because the obvious use is the forbidden one.
- The brand is now one value across both products, so a brand change is one edit and Market can no longer drift from Move by accident.
- `text.secondary` resolving differently per product is the first real test of [007](./007-modes-for-shared-namespaces-for-unique.md). If mode resolution turns out to be awkward in practice, this is where it shows first.
- Nine deleted values means nine places in v0 that have no direct replacement. That is intentional — the Stage 6 migration should be forced to ask what each one *meant*, not mechanically swap it.

## What would make us revisit this?

If a designer requests a colour that already exists under another name, the vocabulary is not discoverable and the problem has moved from too many values to poor naming. If either refused pair is ever set to the same value by a future theme, the distinction was ceremonial and should be collapsed. And if the amber indicator-only rule is violated more than once, the constraint is unteachable and needs to become a lint rule rather than a description.
