# Decision 022 — Control geometry resolves by product, and the tap target is not a token

**Date:** 2026-08-04
**Status:** accepted

## Context

[Decision 020](./020-the-button-consolidation.md) settled that Button's `size` prop names a **step** and the product mode decides what the step resolves to — the shape [007](./007-modes-for-shared-namespaces-for-unique.md) and [008](./008-the-colour-consolidation.md) already settled for `text.secondary`. It then scoped the other half as **decided and owed**, on [013](./013-script-is-a-mode-not-a-parallel-scale.md)'s terms:

> The token layer does not support this yet. `product.market.json` and `product.move.json` change **exactly three tokens between them, all colour** […] `dimension.json` holds a `space` ramp and a `radius` ramp with no semantic layer above them.

That framing was accurate about the state and too pessimistic about the work. The primitives were already there. What was missing was a semantic layer above them and two mode blocks — a token choice, not a blocked dependency. This entry makes the density real and answers the question 020 left underneath it.

**The measurements, taken from `legacy/src` rather than from the density brief**, and recomputed here rather than carried forward, because two numbers in circulation were wrong:

| v0 control | font | line-height | padding | border | rendered height |
|---|---|---|---|---|---|
| `.mk-btn--md` (Market) | 15px | 1.5 | 10 / 18 | 1px | **44.5px** |
| `.mk-btn--lg` (Market) | 16px | 1.5 | 14 / 24 | 1px | **54px** |
| `.mv-action` (Move, its only button) | 17px | 1.5 | 14 / 22 | 1px | **55.5px** |

020 and `Button.css` both cite 53.5px for `.mv-action` and 43.5px for Market's medium. The first drops the 2px border; the second is not a v0 number at all — 43.5px is the *new* component's natural height at `md` under Mizan's own tokens, which is a different measurement of a different thing that happens to sit near the one it was standing in for. Neither error changes any conclusion, and both are corrected here because a number that travels through three files without being recomputed is how the audit's findings turn into folklore.

**The conclusion is unchanged and is the important part: Move's only button lands on Market's LARGE.** Move is compact in how much it puts on a screen and generous in the one thing you hit with a thumb at a curb. "Move is smaller" is what the density brief alone would produce, and it is backwards.

## Problem

Two questions, and the second is the one with no obvious answer.

1. What is the semantic layer above the space ramp that lets `size` resolve per product, and what does each step resolve to in each product?
2. Does the 44×44 tap-target minimum become a named token?

## Constraints

- **No existing `$value` changes.** This is additive, and Market's values are exactly what `Button.css` ships today, so Market has no visual change at all.
- **Semantics are alias-only.** `machinery/scripts/check-schema.mjs` rejects a semantic that states a literal as `semantic-literal`. Every value here references a primitive.
- **Do not invent a 44px primitive.** The space ramp steps 40 then 48. Splitting it to serve one component is how v0 arrived at four spacing rhythms, the fourth of which lived entirely in inline styles.
- **A mode file belongs to one dimension.** Control geometry depends on product alone, so unlike `text.secondary` it needs no slot indirection — it is the simple case 007 describes, not the cross-dimension one.
- **`modes.json`'s convention:** every mode file states its values explicitly, so that no combination is the privileged one.
- Components stay product-agnostic. A `density` prop, or a call site writing `size="move-md"`, is 020's own revisit trigger firing.

## Options

For the shape:

1. **Add the geometry to `semantic/shared.json`**, where the shared vocabulary lives.
2. **A new `semantic/control.json`**, shared vocabulary in its own file.
3. **No semantic layer; override the `space` primitives per product** so `space.200` means something different in Move.

For the tap target:

A. **A `size.tap-target` semantic** resolving to the nearest step that clears 44.
B. **A new 44px primitive** on the space ramp.
C. **No token. A floor stated in descriptions, and a deterministic check that is owed.**

## Trade-offs

**Option 3 is the one that has to be refused loudly**, because it is the cheapest and it destroys the system. If `space.200` is 16px in Market and 20px in Move, then every use of the spacing scale everywhere moves when a product mode changes, the ramp stops being a ramp, and the value a designer reads in Figma is true in one product. It also makes the density *unarguable*: there is no place left where somebody could decide that one particular step should be identical in both products, which — see below — is exactly the decision this entry most wanted to be able to make.

**Option 1 is defensible and was declined on a narrow point.** `shared.json`'s own `$description` makes a claim about itself: *"Eleven names and two plumbing slots, and the count is deliberate: every shared semantic has to resolve in all four mode combinations, so each name added here is four decisions and four contrast checks, not one."* Fifteen dimension tokens that no pairing can ever name would make that sentence false while adding nothing to what it is about. The ownership axis is unchanged — this is shared vocabulary, and `commerce.*` / `mobility.*` still may not be referenced from it. Only the burden differs, and the file boundary now tracks the burden. The honest cost is that `semantic/` is now organised on two axes at once: ownership (shared / Market / Move) and, within the shared half, whether the tokens carry a contrast obligation. That is one more thing to explain to the next person.

**Option B for the tap target is forbidden by the constraint above** and would be wrong even if it were not: 44 is not a step anybody chose, it is a conformance floor, and putting it on the ramp makes every future spacing decision negotiate with it.

**Option A is the trap**, and the reason is in the next section.

## Decision

**`content/tokens/semantic/control.json`** — option 2 — with fifteen tokens: three size steps × five axes.

`padding-inline`, `padding-block`, `font-size`, `min-block`, `min-inline`. Height is deliberately not among them: a control's block size comes from its padding and its leading, and `min-block` is a floor under that growth rather than a replacement for it.

Both product mode files state all fifteen. Nine values are identical between the products and six differ.

| | Market | Move |
|---|---|---|
| `sm` — padding, font, floors | 12 / 8, 13px, 32 / 40 | **identical** |
| `md` — padding-inline | `space.200` = 16px | `space.300` = 24px |
| `md` — padding-block | `space.150` = 12px | `space.200` = 16px |
| `md` — font-size | `font-size.300` = 14px | `font-size.400` = 16px |
| `md` — floors | 48 / 48 | 48 / 48 |
| `lg` — padding-inline | `space.300` = 24px | `space.400` = 32px |
| `lg` — padding-block | `space.200` = 16px | `space.250` = 20px |
| `lg` — font-size | `font-size.400` = 16px | `font-size.500` = 18px |
| `lg` — floors | 48 / 48 | 48 / 48 |

Rendered heights that follow, at the default text size: Market 34.25 / 43.5 (floored to 48) / 54. Move 34.25 / 54 / 64.5.

**And the 44×44 tap target is not a token** — option C. It is a floor stated in the descriptions with its arithmetic, and the check that would enforce it is owed to `machinery/scripts/`.

## Why

### Per-step, per-product, decided against the role — and one step that does not move

The rule is not "Move is smaller" and it is not "Move is bigger" either. Each step is decided against **what the step is for**, and the two products answer differently at two of the three.

**`md` is the default control**, so it is whatever the product's ordinary button is. Market's ordinary button was 44.5px; Move's *only* button was 55.5px, because in Move the ordinary button is the one thing a person finds by feel in a moving car. Move's `md` therefore takes Market's `lg` geometry. That is the single most counter-intuitive fact in this entry and it is the one that had to be measured rather than reasoned about.

**`lg` moves up in both**, because a step that does not differ from the one below it is not a step.

**`sm` is identical in both products, and that is a decision rather than a leftover.** `sm` is defined by the WCAG 2.2 exemption it lives in — 2.5.8's 24×24 minimum, available inline within a run of text, or where an equivalent full-size control exists elsewhere on the screen. That definition does not vary between a sofa and a curb. And Move being the compact product is not a licence to spend its compactness on the *smallest* control, which is the one place a lost pixel is a missed tap rather than a tighter screen. Both mode files state `sm` explicitly for this reason: a step that is identical by omission is indistinguishable from a step nobody thought about.

That one step out of three does not move is the strongest evidence available that this is a per-step decision and not a global density multiplier. A multiplier could not have produced it.

**Type size is in the set, and a density scale that only moved padding would have missed the point.** The loudest signal in v0 is the type: 15px against 17px. A control that is taller with the same label is a control with more air; a control that is taller *and* sets its label bigger is a control designed to be read in one glance. The second is what Move is.

### `lg` in Move is the weakest thing here, and it says so in its own description

Market's `lg` is `.mk-btn--lg` — real, measured, 54px. Move has no large button in v0 at all, because its one button became Move's `md`. Move's `lg` is therefore defined **by extension**: one rung up from Move's `md` on each axis. It exists because the API has three steps and every semantic must resolve in all four mode combinations, not because a Move screen has asked for it.

This is worth flagging rather than smoothing, because it is the shape of mistake a token layer makes constantly: a scale is completed for symmetry, the symmetric values look exactly as authoritative as the measured ones in the generated CSS, and nobody downstream can tell which is which. The `$description` on the `lg` group is where that distinction survives the build.

### The tap target is not a token, and the reason generalises past tap targets

Option A — a `size.tap-target` semantic — fails on a single sentence: **the space ramp has no 44, so the token named `tap-target` would hold 48.** A token whose name and value disagree is worse than no token, because every reader after the first takes the name at face value.

The deeper reason is that **a floor is not a value.** 44×44 is a relation between a geometry and a threshold — "whatever this resolves to must be at least this" — and a dimension token can only state the geometry. This system has already settled how to express that relation, and it did not use a token: [decision 010](./010-contrast-is-a-token-layer-guarantee.md) put the WCAG contrast thresholds in the **gate**, and had `pairs.json` declare what to check against them. Contrast is not a token either. It is a guarantee, enforced by a script, and the token layer's contribution is a declaration of what the guarantee applies to.

So the correct shape for the tap target is the same one: **a check that reads `control.*` and asserts that every step claiming to be a full-size control clears 44×44 in every mode combination** — with `sm` declared exempt and the 2.5.8 clause that exempts it named, the way `pairs.json` declares a decorative context and an exception with its reason. That check does not exist, this entry does not own `machinery/`, and it is owed.

**Until it exists, what the system actually guarantees is 48, and 48 ≥ 44 is arithmetic nothing verifies.** That is the honest state and it is stated in `control.md.min-block`'s own description rather than only here. It is also fragile in a specific way: Market's `md` natural height is 43.5px, so the floor is load-bearing at exactly one step in exactly one product, and anyone who trims Market's `md` padding-block by a rung breaks the tap target with nothing to catch them.

## What this proves

[Rule 7](../CLAUDE.md): that a mode system built for colour carries dimension without modification — the same four combinations, the same override mechanism, the same generated switch — and that "density" can be a per-step judgment rather than a scalar. It also proves the negative case, which is the harder one: that a floor is a *gate's* job and not a token's, and that the system can decline to name something even when a component is visibly reaching for it.

## Consequences

- **Move's buttons change size and Market's do not.** Market's fifteen values are byte-for-byte what `Button.css` ships today. Everything that moves, moves in Move.
- **020's "decided and owed" blockquote is false and has been amended**, along with its consequence bullet. The entry now points here.
- **`machinery/metadata/button.json` carries `status: "draft"` because of that gap.** It is not this entry's to edit and it should move to `stable`.
- **The stylesheet must switch to the new names**, which are `--control-{sm,md,lg}-{padding-inline,padding-block,font-size,min-block,min-inline}`. Until it does, the tokens are generated and unread, and the two products' buttons stay identical — the regression 020 named is closed in the token layer and open in the component until both land.
- **The busy indicator does not scale with the control, and this is a knowingly created defect.** Its diameter is per-step in `Button.css` and is not in this set: naming a busy indicator in the *semantic* layer is naming a component part in a layer meant to describe any control. It is a component token, there is no component layer, and the visible result is that Move's `md` grew and its indicator did not. The available fixes are an `em`-relative diameter in the component or the component layer this system has not built.
- **Six new variables resolve per product in Figma.** The `product` collection goes from 3 variables to 18, and it holds a dimension for the first time. `check:drift` against the live file will report all fifteen as missing until somebody syncs.
- **Twelve `unused-primitive` warnings cleared.** The schema gate went from 50 warnings to 38, because eight `space` steps and four `font-size` steps now have a consumer. That is a real signal rather than noise: primitives with no semantic above them were a ramp nobody had decided how to use, and a third of them now have one.
- **`semantic/` is organised on two axes**, and the second one — contrast burden — is only legible from the two files' descriptions.
- **The tap-target check is owed to `machinery/scripts/`.**

## What would make us revisit this?

**A Move screen that needs a large button.** Move's `lg` is the one block here defined by symmetry rather than by evidence. The first real use is what will say whether 32 / 20 / 18px is right, and if it is not, that is a correction rather than a new decision.

**A third product, or a density that is not a product.** The whole arrangement assumes density and product are the same axis. A tablet layout, or a "comfortable / compact" user preference inside Market, breaks that assumption — and the answer would not be a second product mode, it would be a genuine density dimension, which is a new dimension in the matrix and a new entry.

**A sixth axis.** If the busy indicator, the icon gap or the corner radius turn out to need per-product resolution too, then "control geometry" is bigger than a control's footprint and the component layer this system does not have is what is actually missing.

**A step needing to differ by *theme* rather than by product.** Nothing here depends on theme, which is why none of it needs the slot indirection `text.secondary` needs. If one ever does, the mechanism is already documented in `modes.json` and this file would be its second user.

**`sm` diverging.** It is identical in both products by argument, not by accident. If Move ever needs its own small control, the argument in this entry has met a counter-example and should be reread rather than patched around.
