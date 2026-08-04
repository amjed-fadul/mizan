# Decision 025 — The scrim is one value in all four combinations, and it is the first token with no contrast pairing

**Date:** 2026-08-04
**Status:** accepted

## Context

Dialog is the fifth component, and a modal cannot be built without a backdrop. The token layer had already thought about this and declined to answer it. `shadow.300`'s own description, written in the elevation scale long before any dialog existed:

> Overlay. The element is over the whole interface rather than over its neighbours — a dialog, a bottom sheet, a toast. The top of the scale: anything that needs to feel further away than this **needs a scrim behind it, which is a separate mechanism and not a fourth shadow.**

So the mechanism was named, deliberately excluded from the elevation ramp, and left with no value. This entry supplies the value, on the same terms every other gap in this project has been filled: a component arrived needing it.

It is the third time a component has pushed back on the token layer and the third different answer. [023](./023-the-error-semantic-is-two-tokens.md) added **two** names for one value because they were gated differently. RideCard needed **no** new token — `mobility.surge` was already right and only its use was wrong. This one adds one name, and the interesting property is what it does *not* get.

## Problem

1. What colour is a scrim, and does it differ by theme?
2. Where does it live, given that semantics must alias and no primitive has ever carried an alpha?
3. What contrast pairing does it get?

The third question is the one with a surprising answer.

## Constraints

- **Semantics are alias-only.** A semantic that states a literal is rejected as `semantic-literal`, so a translucent value has to exist as a primitive first.
- **No colour a pairing has not seen** ([010](./010-contrast-is-a-token-layer-guarantee.md)) — which is exactly the constraint this entry has to argue its way out of.
- **A primitive with no consumer is a warning.** The schema gate says so, and it said so out loud the moment `scrim.black` existed with nothing referencing it.
- **`check-contrast.mjs` errors on a translucent background** with `background-not-opaque`: *"Contrast against a translucent background is undefined, because what sits behind it is unknown."*

## Options

For the value:

1. **The user agent's default `::backdrop`.** Write nothing.
2. **An existing token with `opacity` applied in CSS.**
3. **A new primitive carrying alpha, plus a semantic above it.**
4. **Two scrims, one per theme.**

For the pairing:

A. Declare it as a background and gate what sits on it.
B. Declare it `decorative`, so the ratio is measured and printed but never gated.
C. Declare nothing, and state why.

## Trade-offs

**Option 1 is the tempting one and it fails 010 exactly.** A UA-default backdrop is a colour rendered on screen that no token declares — the same defect as `opacity: 0.5` on a disabled control, which this project has now refused three times in three components. That it comes from the browser rather than from a stylesheet changes who wrote it, not whether it is declared.

**Option 2 is worse than it looks.** `opacity` on an element composites the whole element, so a scrim built that way cannot hold anything, and the value that actually renders is still undeclared. It also puts the translucency in the component rather than in the token, which means the next component to need a scrim invents its own.

**Option 4 was the near miss.** A black scrim over an already-dark page does less work than over a white one, and the instinct is to lighten it in dark. Two things argue against it. A scrim's job is to *darken what is behind it* — a lighter scrim in dark mode would be a veil that raises the page rather than pushing it back, which is the opposite operation. And 0.5 turns out to do both jobs with one value: over white the page reads as plainly inactive, and over `#141414` it composites to `#0a0a0a`, which separates the page from a dialog that stays `#141414`. The separation in dark is smaller than in light and that is honest — dark mode has less range below its page ground, which is why the dialog also carries `border.default` and `shadow.300` rather than relying on the scrim alone.

## Decision

**One primitive, `scrim.black` — pure black at alpha 0.5 — and one semantic, `surface.scrim`, aliasing it. The same value in all four mode combinations. No contrast pairing at all.** Option 3, and option C.

### Why black rather than `neutral.1000`

A scrim darkens; it does not tint. `neutral.1000` is `#141414`, a chosen near-black with a slight warmth to it, and at half opacity it would push everything behind it *toward that grey* rather than simply down. Over a white page the difference is visible as a cast. Black is the only value that darkens without deciding a hue, and this is the one place in the system where "no hue" is the correct answer rather than a missing decision.

It is also why the token is **not** a step on the neutral ramp. Ramp position means contrast rank — a step exists where a declared pairing needs one — and a translucent value has no fixed contrast to rank, because what it resolves to depends on what is behind it. Putting it on the ramp would give it a number that means nothing.

### Why it carries no pairing, and why that is a property rather than an exemption

This is the part worth reading twice, because "a colour with no contrast pairing" is the shape of every hole this project has closed.

`check-contrast.mjs` **already refuses** to measure a translucent background. It reports `background-not-opaque` and errors, with the reason in the code: what sits behind it is unknown, so a ratio against it would be fiction. Declaring `surface.scrim` as a background would not produce a lenient check or a false pass — it would produce a **failing build**.

So the absence here is not an exemption anybody granted. It is the gate stating a fact about translucency, and the token layer agreeing with it.

What makes that safe is a rule about use rather than about value: **nothing is read through a scrim.** The content behind a modal is inert — the browser makes it inert, because a `<dialog>` opened with `showModal()` puts everything else outside the top layer — and the dialog in front of it sits on its own opaque `surface.default`. A scrim is the one colour in this system that exists to be looked *past* rather than at.

The rule that follows, and it belongs to components rather than to this file: **no text, no control and no mark may be drawn on the scrim.** Anything that needs to sit in front of the interface sits on an opaque surface first. A "close" affordance floating on the backdrop is the shape this would take, and it is refused for the same reason — its contrast would be unmeasurable.

### The first colour token with alpha

Shadows have carried alpha since the elevation scale existed — `shadow.100` is black at 0.06 — so the *format* is not new. What is new is a **colour** token that is not opaque, and it is worth flagging because every contrast calculation in this system assumes an opaque background. `compositeOver` exists in `lib/tokens.mjs` for translucent *foregrounds* and there is no equivalent for backgrounds, by design.

## What this proves

[Rule 7](../CLAUDE.md): that the token layer can add a name whose defining property is what it declines to guarantee, and say so precisely enough that the omission is checkable rather than merely asserted. It also proves the gate is load-bearing in a direction nobody planned — `background-not-opaque` was written to catch a mistake, and it turned out to be the argument for how a whole category of token has to behave.

## Consequences

- **`shared.json` goes from thirteen names to fourteen**, and its count sentence now records that one of them carries no contrast check.
- **108 tokens build, 89 identical in every combination** (was 106 and 87). Both new tokens are invariant, so they land in the root block rather than in the four mode blocks.
- **`theme.dark.json` does not mention the scrim**, and that silence is the statement — the file's own description says overriding a token to an identical value "would be a line of file that claims a decision was made".
- **`scrim.black` is the only colour primitive with alpha below 1**, and the only one that is not a member of a ramp.
- **A rule for components:** nothing may be drawn on the scrim. It is stated here and in Dialog's spec, and it is not currently checkable — a lint rule that noticed a foreground painted over `surface.scrim` would be the way to make it so.
- **The mobile targets gain both tokens**, because `build-tokens.mjs` emits every colour, and `rgba()` has a clean equivalent in both resource models.

## What would make us revisit this?

**A second scrim.** A bottom sheet, a side drawer or a photo lightbox may want a different weight — a lightbox usually wants near-opaque. The first one that does turns this from a value into a small scale, and the question then is whether they are steps of one thing or two different mechanisms with one hue.

**Either page ground moving.** The 0.5 is set against exactly two grounds: pure white and `#141414`. If `surface.default` changes in either theme, the value that separates a dialog from a scrimmed page changes with it, and this is the number to recompute.

**Something needing to sit on the scrim.** The rule above is the load-bearing part of this entry. If a design genuinely needs a control floating on the backdrop, the answer is not to relax the rule but to give that control an opaque ground of its own — and if that turns out to be impossible, the scrim needs an opaque variant and this entry needs rereading.

**A translucent surface anywhere else.** Glass, frosted panels and translucent headers all raise the same unmeasurable-contrast problem, and none of them can borrow this entry's escape, because unlike a scrim they are meant to be read through.
