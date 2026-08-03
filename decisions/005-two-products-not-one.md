# Decision 005 — The sandbox is two products, and specifically these two

**Date:** 2026-08-04
**Status:** accepted

## Context

The roadmap specified two products only as categories — "commerce" and "mobility" — and never said what they were. Stage 3's central claim is *two products, one core: what is shared, what is not, and why.* That claim needs products concrete enough to disagree with each other.

## Problem

What are the two products, and are two products even necessary — or would one product with more surface area demonstrate the same things more cheaply?

## Constraints

- Every screen built is time not spent on the system itself.
- The products must be plausible in the Gulf market, since Arabic and RTL are the project's differentiator rather than a late localisation pass.
- They must be fictional. Cloning a real product's flows would make the work about someone else's product decisions.
- Roughly five legacy screens total across both products.

## Options

1. **One product with deep surface area.** Cheaper, more screens per product, no multi-product argument.
2. **Two products that are structurally similar** — for example a customer app and an internal admin tool for the same business.
3. **Two products that diverge on the axes a design system has to absorb.**

## Trade-offs

Option 1 halves the build cost and forfeits the most valuable thing the project can demonstrate. Almost every design system that matters serves more than one product, and the interesting problems — what is shared, what is deliberately not, how a system stays coherent without becoming uniform — only exist in the plural.

Option 2 gets the multi-product label at low cost, but two similar products need the same things, so the shared-versus-specific question answers itself. A system demo where nothing is contested demonstrates nothing.

Option 3 costs the most and is the only option where Stage 3 has real content.

## Decision

Two products under one fictional company, chosen for divergence:

**Mizan Market** — grocery and everyday commerce. Browsy, image-forward, conversion-oriented, comfortable density.

**Mizan Move** — ride booking. Glanceable, real-time, high-stakes, compact density.

## Why

They disagree on exactly the axes a design system has to absorb, and the disagreements are substantive rather than cosmetic:

- **Status.** Both products need the concept; their vocabularies share nothing. Market runs in stock → preparing → shipped → delivered. Move runs searching → assigned → arriving → in trip → completed. The concept is identical and the semantics are not, which is the hardest and most instructive case in the whole system.
- **Density.** Market is browsed on a sofa. Move is read at a curb, in one glance, possibly in the sun. Same type scale, different application of it.
- **Pricing.** `AED 19.99` / `20% OFF` / `Save AED 5` versus `from AED 18` / `+ AED 5 surcharge` / `Estimated fare`. Different semantics, identical currency and numeral problems underneath — which makes pricing the sharpest localisation case in the project.
- **Surface ownership.** Move needs a map, and a map is the one surface the system does not own. That forces an explicit answer to a question most design systems dodge: what do we *not* control, and how do we sit next to it?

A pair of dashboards would have produced none of these.

The Gulf super-app pattern — one company running commerce and mobility together — is also the regional norm, which makes the sandbox credible rather than contrived, and puts Arabic at the centre where it belongs.

## Consequences

- Two products to build and maintain in v0, within a five-screen budget. Neither gets deep coverage; both get enough to argue with.
- Stage 3 has genuine content, and so does the flagship component-boundary decision — ProductCard and RideCard look similar and will stay separate.
- Stage 5's demo becomes considerably stronger: the same system prompted for both products produces two visibly different results, which pre-empts the standard objection that a design system homogenises everything it touches.
- The map is a scope risk. It is deliberately a static image or a minimal library, because the valuable question is the boundary one, not the integration.
- Roughly three of the eight identified product flows will not exist in v0. They get built system-native later, which is its own evidence.

## What would make us revisit this?

If by Stage 4 the two products are producing the same components with the same properties — if nothing genuinely needs to differ — then the divergence was cosmetic and the second product is overhead. The signal is the Decision Log itself: if no entry between now and Stage 4 records a real shared-versus-specific argument, there was not one to have.
