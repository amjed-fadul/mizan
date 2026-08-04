# Decision 014 — Direction is not a mode dimension

**Date:** 2026-08-04
**Status:** accepted

## Context

The roadmap's Stage 3 specified a "4-mode matrix: Light/Dark × LTR/RTL". Building the actual mode matrix in Stage 2 produced Light/Dark × Market/Move instead, and the discrepancy went unexamined until the Figma work started, where modes become a scarce resource with a hard ceiling.

## Problem

Should text direction be one of the token system's mode dimensions?

## Constraints

- Figma allows 10 variable modes per collection. Every dimension spent is one unavailable later.
- [Decision 013](./013-script-is-a-mode-not-a-parallel-scale.md) already claims one dimension for script, taking the matrix from four combinations to eight.
- `content/rules/rtl-arabic.md` mandates logical properties everywhere and forbids physical ones.

## Options

1. **Direction as a mode** — `ltr` and `rtl` modes that tokens resolve against.
2. **Direction handled entirely by `dir` and logical properties**, with no mode.

## Trade-offs

Option 1 is what the roadmap assumed, and it is what a system built on *physical* properties would need — if spacing were expressed as `margin-left`, the RTL value would genuinely differ and a mode would be the way to express it.

Its cost under the actual architecture is that it buys nothing and spends a dimension.

> **Correction.** An earlier draft added: *"Adding it alongside script would put the matrix at sixteen combinations against a ceiling of ten, which is not a tight fit but an impossible one."* That claim does not hold. Figma's ten-mode limit is per **collection**, and the sync plugin maps one collection per dimension — so each collection carries two modes regardless of how many dimensions exist, and sixteen combinations are never materialised. See the correction in [013](./013-script-is-a-mode-not-a-parallel-scale.md).
>
> **The decision is unaffected.** It never rested on the ceiling. It rests on the fact that no token takes a different value in RTL, which is verified and unchanged. The ceiling was a supporting argument that turned out to be false, and a conclusion that survives losing one of its arguments is worth more than one that needed all of them.

Option 2 is free but depends on the logical-property rule actually holding. If a physical property ever ships, direction silently becomes a dimension the system does not have.

## Decision

Direction is not a mode dimension. It is handled by `dir` on a root element and logical properties throughout.

## Why

**No token in Mizan takes a different value in RTL.** Verified against the whole token set: no colour, spacing, radius, type or elevation value differs by direction. That is not a coincidence — it is the *point* of the logical-property rule. `margin-inline-start` resolves to the correct physical side by itself, so the value never has to change.

A mode dimension exists to express *"this concept takes a different value here."* Direction does not meet that test, so modelling it as a mode would encode a distinction that does not exist and consume a scarce slot to do it.

The confusion in the original line is worth naming, because it is a common one: **direction and script travel together but are not the same axis.** Arabic is written right-to-left *and* needs different leading, a different face and an optical size correction. The first is direction and needs no tokens. The rest is script and is [decision 013](./013-script-is-a-mode-not-a-parallel-scale.md). Collapsing them into one "RTL mode" would mean an English page could never contain a correctly-set Arabic run — which is precisely the case the bidi rules exist for.

## Consequences

- The combination count is four now and eight once script lands. **There is no budget being spent.** This consequence originally read "against a ceiling of ten. Comfortable rather than tight", which is the same retracted arithmetic the correction under Trade-offs above disposes of, restated one section later — under collection-per-dimension each dimension is a collection holding two modes, and the combinations are never materialised as modes at all. Found while sweeping the ceiling claim out of the repository; it is recorded rather than silently deleted because **a correction placed at the argument it falsifies does not reach the consequence that repeats it**, and this file is the second of two entries where exactly that happened.
- **The logical-property rule is now load-bearing** rather than stylistic. If a physical property ships, the system has no mechanism to correct it, because the dimension that would have expressed the correction deliberately does not exist. This raises the value of the lint rule in Stage 6 considerably.
- The Figma library needs no direction modes, so the collection structure maps to theme and product only.
- Testing direction means flipping `dir` and looking, not switching a mode. That is a different verification habit and worth stating in the preview and in the eventual Figma docs.

## What would make us revisit this?

A token that genuinely differs by direction. The plausible candidates are asymmetric shadows — a light source that stays physically left while the layout mirrors — and directional iconography, though the latter is a mirroring flag rather than a token value ([the icon rules](../content/rules/rtl-arabic.md)). If either arrives, the cheaper fix is a handful of direction-specific tokens rather than a whole dimension, and that trade should be re-argued before a mode is spent.
