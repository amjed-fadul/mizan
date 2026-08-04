# Decision 011 — A hue gets steps at both ends of the ramp only if it carries text

**Date:** 2026-08-04
**Status:** accepted

## Context

The primitive ramps were authored with one dark step per hue plus a darker one for hover — `green.600/700`, `blue.600/700`, `red.600/700`, `amber.600/700` — all chosen to pass WCAG AA against white. Testing them against the dark mode surface produced a uniform result:

| Hue | As text on white | As text on `#141414` |
|---|---|---|
| `green.600` | 5.64 pass | **3.27 fail** |
| `blue.600` | 5.27 pass | **3.50 fail** |
| `red.600` | 5.62 pass | **3.28 fail** |
| `red.700` | 6.54 pass | **2.82 fail** |
| `amber.700` | 4.75 pass | **3.87 fail** |

Every saturated hue in the system fails as text on the dark ground. A value dark enough to read on white is, by construction, too dark to read on near-black.

## Problem

Does every hue need a light counterpart step for dark mode, or only some of them?

## Constraints

- Every primitive must be justified. The consolidation was 33 values to 14 ([008](./008-the-colour-consolidation.md)), and doubling the hue ramps would undo most of it.
- Both modes must pass AA ([010](./010-contrast-is-a-token-layer-guarantee.md)).
- The refusals in [008](./008-the-colour-consolidation.md) must hold in **all four** mode combinations, not just the two light ones.

## Options

1. **Mirror every hue.** Add a light step to green, blue, red and amber. Symmetrical, predictable, and doubles the palette.
2. **Add light steps only where a hue is used as text.**
3. **Forbid coloured text in dark mode**, resolving all coloured semantics to neutrals when the theme flips.

## Trade-offs

Option 1 is the tidy answer and it buys almost nothing. Green and blue are never text in this system — they are **fills**, with `text.on-action` sitting on top of them. A fill only has to satisfy the contrast of the label against it, and white on `green.600` is 5.64:1 on any ground, because the ground is irrelevant once the fill is opaque. Adding `green.300` would create a primitive that no semantic could honestly reference.

Option 3 is defensible and destroys meaning. A discount that is red in light mode and grey in dark mode is not the same discount; colour is carrying semantic weight and dropping it in one theme is a worse failure than the contrast problem it avoids.

Option 2 requires knowing each hue's **role** before deciding its ramp, which means the primitive layer cannot be designed in isolation from how the semantic layer will use it. That is a genuine coupling and slightly uncomfortable.

## Decision

Add light steps only for hues that carry text. In practice that is red alone: `red.300` `#ef5350` and `red.400` `#e57373`.

Green and blue stay two-step — they are fills, and fills are ground-independent. Amber stays two-step because it is indicator-only ([008](./008-the-colour-consolidation.md)) at a 3:1 threshold, which it already clears on dark at 4.29 and 3.87.

## Why

The question "how many steps does this ramp need?" has no answer in the abstract. It depends entirely on the role the hue plays, and the three roles have different requirements:

- **Fill** — the label's contrast against the fill is what matters, and that is unaffected by what is behind the fill. One step per state.
- **Indicator** — 3:1 as a graphic, which is a low enough bar that a mid-dark value clears it against both grounds.
- **Text** — must clear 4.5:1 against the actual background, and no single value clears it against both white and near-black. This role, and only this role, needs both ends.

Stated generally: **a hue needs steps at both ends of the ramp only if it carries text, because only text is measured against the ground it sits on.**

### Two light reds, not one

This is the part that would have been easy to miss. `commerce.discount` and `mobility.safety` are a deliberate refusal — kept apart because one means *this costs less* and the other *this cancels your trip*. In light mode they are `red.600` and `red.700`.

Had dark mode resolved both to a single light red, the refusal would have **silently collapsed in two of the four mode combinations.** The distinction would have been documented, argued and then quietly abandoned in the theme nobody checks first.

So there are two light reds, and `discount` → `red.300` while `safety` → `red.400` in dark. A refusal that only holds in one mode is not a refusal.

## Consequences

- The primitive layer now has an asymmetric shape — red has four steps, every other hue two. That asymmetry is information, and the `$description` on each red step says which mode it exists for and that it fails on the opposite ground.
- Primitives can no longer be designed without knowing their intended roles. This weakens the clean separation between the primitive and semantic layers, and it is a real cost accepted knowingly.
- Any future hue added for text must arrive with both ends, or it will pass review in light mode and fail in dark. Worth a check of its own eventually: *every hue referenced by a `text` context pairing has a step usable in every theme.*
- The verification for the refusals is now stricter — they must resolve to different values in all four combinations, not merely exist as two token names.

## What would make us revisit this?

If a future semantic needs green or blue as text rather than as a fill — a link colour, an inline status label — the fill argument stops applying and that hue needs both ends too. The signal is a `text` context pairing in `pairs.json` naming a hue that has no light step; that is a design decision arriving disguised as a contrast failure, and it should be caught as the former.
