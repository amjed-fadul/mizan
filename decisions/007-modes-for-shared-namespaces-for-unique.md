# Decision 007 — Modes for what both products have, namespaces for what only one has

**Date:** 2026-08-04
**Status:** accepted

## Context

Stage 2 builds the token architecture as an intervention against the [Stage 1 audit](../audit/stage-1-v0-audit.md), which found three competing token vocabularies across two products with no shared foundation. Before a single token can be written, one question has to be answered, because everything else inherits from it.

## Problem

Market and Move both need a primary action colour. Only Market needs a discount colour. Only Move needs an ETA colour. Does the token layer express product difference by *namespacing* every token per product, or by giving tokens one name and resolving them differently per product?

## Constraints

- Two products that must stay visibly different ([005](./005-two-products-not-one.md)). A system that makes them identical has failed even if it is perfectly consistent.
- Components are built once in Stage 4 and used by both products.
- Figma Professional allows 10 variable modes; four are needed for light/dark × Market/Move.
- Solo maintainer. Every token authored is a token maintained.

## Options

1. **Namespace everything.** `commerce.action.primary`, `mobility.action.primary`, `commerce.surface.raised`, and so on. Every token carries its product.
2. **Mode everything.** One flat semantic vocabulary, with Market and Move as modes that swap the underlying values.
3. **Both, split by whether the concept exists in both products.**

## Trade-offs

**Option 1** makes every difference explicit and traceable, and it never surprises anyone. Its cost is fatal at the component layer: a Button that needs `action.primary` must know which product it is rendering inside in order to pick between `commerce.action.primary` and `mobility.action.primary`. That knowledge has to come from somewhere — a prop, a context, a build flag — and once components are product-aware, they are no longer shared. You have built two design systems that happen to live in one repository.

**Option 2** keeps components product-agnostic, which is exactly what makes them reusable. But it has no way to express a concept that exists in only one product. `mobility.eta` has no Market counterpart, so there is nothing for a Market mode to resolve it *to*. The choices are inventing a meaningless Market value, leaving it null, or not having the token — all three are worse than the problem.

**Option 3** costs a judgment call on every new token — *does the other product have this concept?* — and the boundary will occasionally be wrong.

## Decision

Both mechanisms, split by whether the concept exists in both products.

- **Shared concepts** — `action.primary`, `surface.raised`, `text.secondary`, `border.default`. One semantic name. Market and Move are **modes** that resolve it to different values.
- **Product-unique concepts** — `commerce.discount`, `commerce.stock.*`, `mobility.eta`, `mobility.surge`, `mobility.safety`. **Namespaced** per product.

## Why

The two mechanisms answer different questions, and conflating them is the classic multi-product failure.

A mode answers *"what value does this concept take here?"* A namespace answers *"whose concept is this?"* Those are not the same question, and a system that only has one of them will answer the other badly.

The test for which mechanism applies is not stylistic — it is factual: **does the other product have this concept at all?** Market has no equivalent of a surge fare. Move has no equivalent of a discount. Those are namespaced. Both products have primary actions, raised surfaces and secondary text; those are modes.

Stated as the rule: *namespace everything and you have built two design systems wearing a trench coat; mode everything and `mobility.eta` becomes inexpressible.*

The audit supplies the evidence for why this matters. It found Market's `#5a5a5a` and Move's `#6b6b6b` secondary text 6.30 ΔE00 apart and recommended keeping them separate — one product is browsed on a sofa, the other is read at a curb. Under this decision that separation is preserved **as a mode difference rather than two tokens**, so components stay product-agnostic and the density difference survives. That result is only available because both mechanisms exist.

## Consequences

- Every new token requires the question *does the other product have this?* The directory layout makes the answer structural rather than remembered: `semantic/shared/`, `semantic/commerce/`, `semantic/mobility/`.
- Components may reference shared semantics freely and must **never** reference a namespaced one. A `commerce.*` token appearing in a shared component is a defect, and eventually a lint rule.
- A concept can migrate. If Move later grows a discount, `commerce.discount` is promoted to a shared semantic with a Move mode value. That promotion is a Decision Log entry, not a rename.
- Four modes now exist: light/dark × Market/Move. Every shared semantic must resolve in all four, which is a real authoring cost and the reason the shared vocabulary stays small.
- The boundary will sometimes be drawn wrong, and the cost of being wrong is asymmetric: wrongly namespacing something is a cheap promotion later, wrongly sharing something forces an awkward value into a product that does not want it. **When genuinely unsure, namespace.**

### Amendment — the cost this decision did not anticipate

*Added while building the mode matrix, because it is a real hole in the guarantee above.*

A token that depends on **two** dimensions cannot be expressed by mode overrides alone. Modes compose in sequence, so the dimension applied second has no way to know what the first resolved to. `text.secondary` depends on both theme and product — it is `#5a5a5a`/`#6b6b6b` in light and `#b8b8b8`/`#949494` in dark — and that is exactly the shape the mechanism does not handle.

The implementation uses two slot tokens, `text.secondary-market` and `text.secondary-move`, set by the theme dimension and selected by the product dimension. It works, and it costs two things worth stating plainly:

1. **Two tokens exist that are plumbing rather than vocabulary.** They are labelled as such in their descriptions, but they are indistinguishable from real semantics to anyone reading the token list.
2. **They leak into the published CSS.** `--text-secondary` references one of them, so both must exist in the output. A product-named custom property is now in the public API of a system whose central claim is that components are product-agnostic — which is precisely what this decision exists to prevent.

Neither is fatal and both are contained, but the guarantee in this entry is weaker than it reads. The honest version: *components need not be product-aware, and the token layer pays for that with two tokens that are.*

The fix is a lint rule rather than an architecture change — banning `-market`/`-move` suffixes and `commerce.`/`mobility.` prefixes inside shared components catches the slots alongside the namespaced tokens they resemble. That belongs to Stage 6.

## What would make us revisit this?

If by Stage 4 the shared vocabulary has grown large enough that most tokens resolve to the same value in both modes, the mode mechanism is carrying no information and the products are not as different as [005](./005-two-products-not-one.md) claimed. Conversely, if components repeatedly need namespaced tokens to do their job, the boundary is drawn too far toward namespacing and shared concepts are being misclassified as product-unique.
