# Decision 009 — The neutral text ramp has two tiers, not three

**Date:** 2026-08-04
**Status:** accepted

## Context

v0 used four tiers of neutral text: primary, secondary, muted, and placeholder. The [Stage 1 audit](../audit/stage-1-v0-audit.md) found the bottom two failing WCAG AA everywhere they appeared — `#999999` at 2.85:1, `#9b9b9b` at 2.78:1, `#8e8e8e` at 3.28:1 — across roughly fifteen CSS rules and every screen in both products.

The obvious fix is to darken them until they pass. That fix does not work, and the reason is worth recording.

## Problem

How many distinguishable tiers of neutral text can exist on white, given that every tier must pass 4.5:1 and that secondary text already resolves to two different values by product?

## Constraints

- Every text token must clear 4.5:1 on its declared background ([010](./010-contrast-is-a-token-layer-guarantee.md)).
- `text.secondary` resolves per product: `#5a5a5a` in Market (6.90:1), `#6b6b6b` in Move (5.33:1) — a refusal established in [008](./008-the-colour-consolidation.md).
- A tier only earns its place if a reader can tell it apart from its neighbours.

## Options

1. **Keep three tiers, darken muted to pass.**
2. **Keep three tiers, lower the bar** — accept AA for primary and secondary, allow muted to fail as "decorative".
3. **Two tiers**, and express the third distinction some other way.

## Trade-offs

Option 1 is what everyone tries first. It does not survive arithmetic:

| Token | Value | On white |
|---|---|---|
| `text.primary` | `#2f2f2f` | 13.39:1 |
| `text.secondary` (Market) | `#5a5a5a` | 6.90:1 |
| `text.secondary` (Move) | `#6b6b6b` | 5.33:1 |
| `text.muted` — darkened to pass with margin | `#6e6e6e` | 5.10:1 |

**`#6e6e6e` against `#6b6b6b` is 1.045:1.** Those are the same colour. Darkening muted far enough to pass AA moves it into the space Move's secondary already occupies, so the ramp has three names and two visible steps — and in Move specifically, two names for one appearance. The tier survives in the token file and dies on screen.

Option 2 keeps the appearance and abandons the guarantee. It also reintroduces the exact failure the audit spent its longest section documenting, one stage after intervening on it. "Decorative text" is not a category WCAG recognises, and in practice it is where prices, delivery estimates and stock counts had been living — none of which are decorative.

Option 3 costs a real expressive tool. Three tiers of grey is a genuine hierarchy device and losing it means finding another one.

## Decision

**Two neutral text tiers: `text.primary` and `text.secondary`.** The muted tier is deleted.

Where v0 used muted to de-emphasise, the system uses **size and weight** instead: a smaller step on the type scale, or regular weight against a 600. Colour is no longer available as a de-emphasis mechanism below secondary.

## Why

There is not enough room. The gap between white and the AA floor holds about two comfortably distinguishable steps once one of them is already resolving to two different values per product. A third tier can be declared but cannot be seen, and a token nobody can perceive is worse than no token — it teaches designers a distinction that does not exist and then makes them defend it in review.

The underlying point generalises beyond this project: **accessibility requirements are not a filter applied after the palette is designed, they are a constraint on how many tiers the palette can have at all.** v0's four-tier ramp was not a good ramp that happened to fail contrast. It was a ramp that could only exist *because* it failed contrast.

Choosing size and weight instead is also the more robust hierarchy device. It survives dark mode, high-contrast mode, and a change of background, none of which a colour-only hierarchy does.

## Consequences

- Roughly fifteen v0 rules using the muted tier have no direct replacement. The Stage 6 migration must decide, per site, whether the intent was *smaller* or *lighter* — which is a better question than the one a mechanical swap would have answered.
- Designers lose a familiar tool and will ask for it back. The answer is in this entry, and the request should be logged when it comes.
- The type scale now carries hierarchy weight it did not carry before, so it needs enough steps to do that job. This constrains Session 2.3.
- `::placeholder` cannot reuse a muted grey. It takes `text.secondary`, which is heavier than convention but is the only option that passes.
- Dark mode gets the same two-tier structure. Verified on a `#141414` surface, `#f5f5f5` (16.90:1) and `#a8a8a8` (7.75:1) give two clear steps with room to spare — the constraint is asymmetric, and light mode is the binding case.

## What would make us revisit this?

If Stage 8's research sessions show designers consistently reaching for a third level of de-emphasis and working around its absence — detaching components, overriding colour inline — then the need is real and the answer is a different mechanism, not a third grey. A tinted or lower-chroma secondary might buy perceptual separation that pure neutrals cannot, and that is worth testing before conceding the tier.
