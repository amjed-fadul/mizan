# Decision 020 — Four buttons become one, and the vocabulary the shared API refuses to carry

**Date:** 2026-08-04
**Status:** accepted

## Context

The [Stage 1 audit](../audit/stage-1-v0-audit.md) found **four button implementations behind three contradictory APIs**, and named unifying them the fourth priority — "one button, one variant vocabulary, `type="button"` always set." Stage 4 builds the first real component, and the button is it. This entry is the sibling of [008](./008-the-colour-consolidation.md): the same consolidation exercise, one layer up, where the thing being merged is not a value but a name.

Counted in the source rather than taken from the audit:

| | `shared/Button.tsx` | `market/PrimaryButton.tsx` | `move/ActionButton.tsx` | raw `.btn.btn-cta` |
|---|---|---|---|---|
| variant prop | `type` | `variant` | `kind` | — |
| vocabulary | primary, secondary | primary, secondary, ghost | confirm, cancel, ghost | — |
| size | — | sm, md, lg | — | — |
| full width | — | `fullWidth` | — | always, in CSS |
| icon | — | `icon` | — | — |
| loading | — | — | `loading` | — |
| HTML `type` attr | **not set** | `"button"` | **not set** | **not set** |
| call sites | 8 | 8 | 6 | 3 |

Twenty-five call sites. Three of them — "Buy Now", "Add All to Cart", "Call Driver" — are a bare `<button className="btn btn-cta">` with no component at all, and `.btn-cta` is declared in no stylesheet, so they take `.btn`'s geometry and nothing else: padding, a transparent 1px border, no fill. The highest-intent action on the product page renders as text.

The product boundary had already failed on its own. Market's `CartScreen` imports Move's `ActionButton`; Move's `BookingScreen` imports Market's `PrimaryButton`. Whatever these components were product-specific *for*, it stopped being true before the audit ran.

## Problem

What is the one button's API — specifically, which of the three variant vocabularies survives, and what does the consolidated component refuse to express even though v0 expressed it?

## Constraints

- The consolidated component is shared, so under [007](./007-modes-for-shared-namespaces-for-unique.md) it may not reference a `mobility.*` or `commerce.*` token. `content/tokens/semantic/mobility.json` states this as a rule in its own description, not as a convention.
- The two products must stay visibly different ([005](./005-two-products-not-one.md)), and their densities are the difference the audit was most emphatic about preserving.
- The token layer is finished for Stage 2 and is not to be extended to make a component convenient. Tokens are decided in `content/tokens/` and consumed by components, never the reverse.
- Whatever survives has to be teachable in one sentence, because three vocabularies existed precisely because nobody could remember which was which.

## Options

1. **Keep the widest API** — union the three, so nothing anyone wrote has to change. `type`, `variant` and `kind` all accepted, `confirm` aliased to `primary`.
2. **Pick one vocabulary and translate the rest**, dropping any prop the shared component cannot justify.
3. **Two buttons, one per product**, on the grounds that Market and Move genuinely differ.

## Trade-offs

Option 1 has the lowest migration cost and is the worst outcome available. An API with three names for one prop is not a consolidation; it is the same confusion with a single import path, and it makes the confusion permanent by blessing it. It also cannot be deprecated later without the migration this option exists to avoid.

Option 3 is the honest-looking answer and is refused by the evidence above: the two products were already importing each other's buttons. A button is a control, not a product concept. The audit drew the shared/separate line at **interaction model and content responsibility** — which is why `ProductCard` and `RideCard` stay two components and `StockStatus` and `TripStatus` stay two components. A button has one interaction model in both products. It falls on the shared side of the line the same audit drew.

Option 2 costs a migration at all twenty-five sites and the argument that follows. That is the cost this entry is paying.

## Decision

One `Button`. The API is `variant` (`primary` | `secondary` | `ghost`), `size` (`sm` | `md` | `lg`), the real HTML `type` (`button` | `submit` | `reset`), and `loading`, `icon`, `fullWidth`, `disabled`. Four judgments make it, and each is argued below rather than asserted.

### 1. `variant`, not `type` or `kind`

`kind` loses because it is a synonym with no constituency — one component, one product, no argument for it beyond that someone typed it first.

`type` loses for a reason worth stating precisely, because it is the most instructive defect in the whole set. It shadows the HTML attribute, and `shared/Button` takes the name for the variant **and never passes the real attribute through**. Two things follow, and only one of them is the obvious one.

The obvious one: a `<button>` with no `type` defaults to `submit`. Seventeen of the twenty-five call sites in v0 render a submit button — `shared/Button`'s eight, `ActionButton`'s six, and the three raw ones — while Market's visually identical `PrimaryButton`, which does set `type="button"`, renders eight that do not. **In v0 this never fires, because `legacy/src` contains no `<form>` element at all.** That is luck rather than design, and it is worth recording as luck: the difference is in the rendered DOM at every one of those seventeen sites, waiting for the first form somebody wraps around a checkout. A shared button is exactly the component that ends up inside one.

The less obvious one, which does not need a form to be a defect: because `type` was spent on the variant, **`shared/Button` cannot express a submit button at all.** The prop name did not merely risk confusion — it consumed a platform capability and left no way to ask for it back. A prop that shadows a platform attribute is not a naming preference. It is an API deleting something the platform already gave you.

So `type` on the consolidated component means what it means in HTML, and it is always set explicitly.

### 2. `confirm` and `cancel` do not survive

Move's vocabulary is `confirm` / `cancel` / `ghost`. Two of those three describe **the semantics of the action**, not the appearance of the control. `confirm` is a `primary` button; `cancel` is a `secondary` one. The evidence that this is a translation rather than a loss is in Move's own CSS: `.mv-action--confirm` is a brand fill with white text, and `.mk-btn--primary` is a brand fill with white text. They were already the same button wearing a different word.

The general rule, which is the part of this entry with the longest reach:

> **A variant names how a control looks. It does not name what pressing it means.**

An action-named variant vocabulary fails the moment two actions with opposite meanings need the same appearance, which is immediately: "Save" and "Confirm" and "Book ride" are one button, and a vocabulary that names them separately has to grow a term per verb until it is a list of the product's features. It also fails in the other direction — `cancel` in Move means *abandon this trip*, and `cancel` in a dialog means *close this without doing anything*. One word, two meanings, one appearance, and the component cannot tell which it was handed.

This is the same question that arrives next in Stage 4 as `ProductCard` versus `RideCard`, and it resolves the opposite way there, which is why both are worth stating together. For the button, the *appearance* is shared and the *meaning* varies per call site, so the meaning belongs in the label and the variant stays visual. For the cards, the *interaction model* varies — a quantity stepper and an add-to-cart action against a radio selection within a group — so the components stay separate however alike they look. In both cases the test is the same and the answers differ: **ask what varies, the look or the behaviour, and put the boundary at the behaviour.**

### 3. No destructive variant — the refusal

The most-requested fourth variant is `danger` or `destructive`, and v0 appears to supply the precedent: `.mv-action--cancel` sets `color: var(--safety)`. The consolidated button does not have one. Four reasons, in ascending order of how much they generalise.

**It is structurally forbidden, not merely unwise.** `mobility.safety` is a namespaced Move semantic — `{red.700}` in light, `{red.400}` in dark — and `content/tokens/semantic/mobility.json` says in its own description that shared components must never reference a `mobility.*` token. A shared button cannot reach the value v0's cancel button used. That is [007](./007-modes-for-shared-namespaces-for-unique.md) working as designed rather than an obstacle to route around.

**v0 borrowed a status colour for an action, and the borrowing is the defect.** `mobility.safety` carries *hazard and cancellation messaging* — it is content, it is gated as text at 4.5:1 in `pairs.json`, and [008](./008-the-colour-consolidation.md) refused to merge it with `commerce.discount` precisely so that destructive meaning stayed independently tunable. Pointing a control at it makes the token serve two jobs whose contrast thresholds differ, which is the same conflation 008 had to undo for the ambers: status colour and status text are two jobs, and a status colour driving a button is a third.

**The action is not destructive.** Cancelling a ride search is routine. Backing out of a booking you have not taken is the most ordinary thing a user of Move does, and painting it red teaches people that red means "the way back". Weight that belongs on an action belongs in its label first — "Cancel booking" against "Keep booking" is a clearer control than either colour makes it.

**And inventing `action.danger` to serve one v0 button is designing a token backwards from a component.** The token layer today has exactly three action semantics — `action.primary`, `action.primary-hover`, `text.on-action` — and every one of them exists because a contrast pairing was declared for it and gated. A fourth added on a component's request would be the first token in the system whose justification is that something already wanted it.

**The cost, stated plainly.** A genuinely destructive action exists and will arrive: delete account, and cancel a ride *already under way* with a driver en route. Those need visual weight that `secondary` does not carry, and this decision means the first team to need one is blocked until the token is decided. That is the correct order — decide the semantic, gate the pairing, then give the component the variant — but it is a real block on a real team, and pretending it is free would make the refusal cheaper than it is. The trigger for lifting it is below.

### 4. `size` stays a prop and resolves through product density

Market's `PrimaryButton` has `sm` / `md` / `lg`; Move's `ActionButton` has one size. The naive consolidation gives Move three sizes and calls it done, which would make `md` mean one set of pixels in a product read on a sofa and in a product read at a curb.

`size` therefore names the **step**, and the product mode decides what the step resolves to — exactly the shape [008](./008-the-colour-consolidation.md) and [007](./007-modes-for-shared-namespaces-for-unique.md) settled for `text.secondary`, where one semantic name takes a different value per product and components stay product-agnostic. A second `density` prop would push the choice onto every call site and let a Market screen ask for Move's geometry, which is the drift the mode system exists to prevent.

> **This landed. [Decision 022](./022-control-geometry-resolves-by-product.md) is the token work.** When this entry was written the token layer did not support it: the two product mode files changed exactly three tokens between them, all colour, and `dimension.json` held a `space` ramp and a `radius` ramp with no semantic layer above them. So this half was recorded as **decided and owed**, on [013](./013-script-is-a-mode-not-a-parallel-scale.md)'s terms. `content/tokens/semantic/control.json` now carries fifteen control-geometry semantics — three steps × padding-inline, padding-block, font-size, min-block, min-inline — and both product mode files state all fifteen. Six of them differ between the products. What the amendment does **not** change is the finding below, which 022 measured again from `legacy/src` and confirmed: Move's `md` takes Market's `lg` geometry, and one step of the three is deliberately identical in both products.

> **One number below is wrong and is corrected in 022.** `.mv-action` renders at **55.5px**, not 53.5 — the 53.5 drops the 2px border. The 43.5px cited elsewhere for Market's medium is not a v0 measurement at all; it is the *new* component's natural height at `md` under Mizan's own tokens. `.mk-btn--md` in v0 is 44.5px. Neither error changes the conclusion, and both are left visible here rather than silently edited, because the point of the correction is that a number can travel through three files without anyone recomputing it.

The honest complication, found in the CSS rather than assumed from the brief: **Move's density is not uniformly smaller.** `.mv-action` is 17px type with 14px/22px padding, against `.mk-btn--md` at 15px with 10px/18px — Move's single button is *larger* than Market's medium and lands near Market's `lg`. Move is compact in how much it puts on a screen and generous in the one thing you have to hit at a curb with one thumb. So "Move's `md` is smaller than Market's `md`" is the wrong rule to write into the mode file, and anyone implementing this from the density brief alone would have written it. Per-product resolution, decided per step against the role, is the rule.

### `fullWidth` survives, and it is the prop worth being uneasy about

`fullWidth` lets a component decide its own layout, which is normally the parent's job. It is kept, for a reason v0 supplies: Move did not avoid the problem by omitting the prop. `.mv-action` is `display: block; width: 100%` unconditionally — Move hardcoded full width into the component and removed the choice. The choice exists whether or not it is expressed; the only question is whether it is visible at the call site and reviewable, or baked into a stylesheet where it looks like a fact.

So it survives because a mobile CTA genuinely spans the viewport and something has to say so. The cost is that it will be reached for as a layout shortcut by anyone who wants a wide button and does not want to touch the parent, and unlike a variant that is wrong, a `fullWidth` that is wrong looks fine. It is the one prop in this API that is a layout escape hatch, and it is named as one here so that its growth can be measured rather than noticed too late.

## Why

The colour consolidation could lean on a measurement — CIEDE2000 constrained the judgment even where it could not replace it. This one has no measurement at all. There is no distance metric between `kind` and `variant`, and no script can tell you that `confirm` is an action semantic while `primary` is a visual one. Every call in this entry is judgment, and the only discipline available is that each has to survive being written down with its cost attached.

What the four judgments have in common is a single test, which is the transferable part: **a shared component's API may only express things that are true of the control, never things that are true of the situation the control is in.** `variant` passes, because appearance is a property of the button. `confirm` fails, because what pressing it means is a property of the screen. `type` fails as a variant name for a harder version of the same reason — it was already spoken for by the platform, and an API does not get to redefine a word the platform owns. And `danger` fails today not because destructive actions do not exist but because the system has not yet decided what one *is*, and a component is the wrong place to decide it.

The refusals are again the load-bearing entries. A variant that is missing can be added; a variant that was added wrong is used a hundred times before anyone notices it means two things.

## Consequences

- **Twenty-five call sites migrate**, and none of them migrate mechanically. `type="secondary"` becomes `variant="secondary"`, `kind="confirm"` becomes `variant="primary"`, and `kind="cancel"` becomes `variant="secondary"` **plus a label rewrite**, because the weight that was in the colour now has to be in the words. That last one is design work at every site, not a codemod, and it is the honest price of judgment 3.
- **Every button gets an explicit HTML `type`.** Seventeen of the twenty-five sites currently render `type="submit"` by omission, and they stop.
- **A destructive action has no variant until the token is decided.** Named again here rather than only in the refusal, because this is the section a reader checks when they are blocked.
- **Both products' buttons were the same size until the density work landed.** [Decision 022](./022-control-geometry-resolves-by-product.md) carries it: the mode files now resolve control geometry per product, Market's values are unchanged, and everything that moves moves in Move. The gap was visible in the running app rather than hidden in a file for exactly as long as it existed.
- **`.market-btn` / `.market-btn-primary` are deleted with nothing replacing them.** They are declared in `market.css`, referenced by nothing, and carry a comment explaining why they were written — "Shared `.btn` has no sizes and no icon slot." A whole second implementation grew because the shared component was missing two props. That is the strongest argument in this repo for the consolidated API carrying `size` and `icon`: v0 already paid for their absence once.
- **The `icon` slot arrives owing an RTL rule.** `.mk-btn__icon` uses `margin-right: 6px` — physical, and wrong in Arabic under [`content/rules/rtl-arabic.md`](../content/rules/rtl-arabic.md). The spacing is a logical property in the new component, and the mirroring flag §5 requires is the icon's own property rather than the button's: the button must not mirror what it is handed, because a "turn right" glyph inside a Move button describes a physical manoeuvre and stays as drawn.
- **`loading` inherits an unexamined question.** `ActionButton` replaces its children with the hard-coded English string `'Please wait'` while loading, in a product that ships Arabic. The consolidated component takes the prop and does not take that behaviour; what a loading button says, and in which language, is the component spec's problem and it is now on the record as one.

**What this proves** ([rule 7](../CLAUDE.md)): that a consolidation can be argued at the API layer and not only at the value layer, and that the same governance holds there — a name is merged for a stated reason, a name is refused for a stated reason, and the refusal terminates in an existing rule (`mobility.*` is not shared) or in a human, never in "it seemed cleaner." It also proves the token layer holds under pressure from the direction pressure actually comes from: a component asked for a token, and the answer was no.

## What would make us revisit this?

**The destructive variant is reopened by a genuinely destructive action, not by a request.** The concrete trigger: a flow where the action cannot be undone by the user and loses something they own — deleting an account, or cancelling a ride with a driver already en route and a fee attached. When one exists, the order is decide the semantic in `content/tokens/`, declare its pairing in `pairs.json`, gate it, and *then* give the button a variant — and that sequence is itself a Decision Log entry. A second request for `danger` before such a flow exists is not a trigger; it is the same request twice.

**`size` is wrong if a call site ever needs to name a product.** If anyone writes the equivalent of `size="move-md"`, density has failed as a mode and needs to become something the component can see, which would be the first crack in [007](./007-modes-for-shared-namespaces-for-unique.md)'s guarantee that components stay product-agnostic.

**`fullWidth` is wrong if it appears on a large share of call sites.** It exists for the bottom-anchored mobile CTA. If it spreads past that — if it becomes the way people get a button to fill a cell — then layout has leaked into the control and the parent should own it through a layout component instead.

**And `variant` is wrong the moment a fourth purely visual variant is genuinely needed and cannot be named without reference to an action.** If the honest name for it is a verb, this entry's central argument has met its counter-example and should be reread rather than defended.
