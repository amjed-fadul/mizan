# Decision 024 — ProductCard and RideCard stay separate, because one is a container and the other is a control

**Date:** 2026-08-04
**Status:** accepted

## Context

Two boxes, one per product. Both are a rounded rectangle with a media area, a title, a price and some supporting facts, arranged in a vertical stack and repeated in a scrolling list. Put a Market product card next to a Move ride card and a reasonable person asks why the system has two of them.

This is the consolidation question the whole project has been answering "yes" to. [Decision 020](./020-the-button-consolidation.md) merged four buttons into one. [Decision 008](./008-the-colour-consolidation.md) deleted two of four reds. The Stage 1 audit's own recommendation list is mostly merges. So the burden here is on *not* merging, and this entry has to carry it.

**What v0 actually contains**, taken from `legacy/src` rather than from the brief:

| | Market's product card | Move's ride card |
|---|---|---|
| implementations | **3 components, none of them imported** — `ProductCard`, `ProductCardCompact`, `ProductCardPromo` — plus **5 inline copies** | **1 component**, `RideCard`, imported by `BookingScreen` |
| renders | the inline copies do; the components are dead | 4 times, once per `RIDE_OPTIONS` entry |
| interaction | a `<Link>` on the title, a `<Button>` for Add to Cart, and a `<div onClick>` "Quick view" over the image | a `<div onClick>` on the whole card, with `selected` and `onSelect` |
| keyboard | the link and the button work; the quick-view overlay does not | **nothing works.** A keyboard user cannot change from the Economy default |

Both are broken and they are broken in different directions, which is the first hint that they are different things. Market's card has three interactive targets and one of them is inert. Move's card has one target and it is inert.

The audit already reached the conclusion this entry defends — *"Interaction model and content responsibility are the boundary. Visual similarity is superficial"* — and recorded it as a recommendation. This is the decision that adopts it, and it adopts it for a stronger reason than the audit gave.

## Problem

Does Mizan ship one `Card` with a product mode, or two components?

And underneath it, the question that generalises past cards: **what makes two similar-looking things one component?**

## Constraints

- **A shared component may not reference `commerce.*` or `mobility.*`** ([007](./007-modes-for-shared-namespaces-for-unique.md)). The product card needs discount and stock colours; the ride card needs surge. Neither set is reachable from a shared component, and both are needed *inside the box*.
- **No `density` or product prop.** [020](./020-the-button-consolidation.md) and [022](./022-control-geometry-resolves-by-product.md) both refused one, and a `product="market"` prop on a shared Card is the same refusal arriving in a new place.
- **Rule 7:** every artifact answers what design-system capability it proves. A refusal has to prove something too.
- The answer must be checkable by somebody who cannot see the two screens.

## Options

1. **One `Card` with slots**, and the products fill them.
2. **One `Card` with a `variant="product" | "ride"`.**
3. **A shared presentational shell** — `CardSurface` — with `ProductCard` and `RideCard` composing it.
4. **Two independent components, no shared shell.**

## Trade-offs

### The argument that decides it is structural, not aesthetic

Every version of "they are basically the same box" dies on one fact, and it is a fact about HTML rather than about taste.

**Move's ride card is a selection.** Four options, exactly one chosen, chosen by the user before booking. Built correctly that is a radio in a radio group: one tab stop for the whole group, arrow keys moving between options, `aria-checked` on each, the entire card surface being the target.

**Market's product card is a container.** The live inline copy holds a `<Link>` on the title that navigates to the product page, a `<Button>` that adds to cart, and a quick-view affordance over the image. Three targets, independently reachable, each its own tab stop.

Those two cannot be the same component, and not because it would be inelegant:

> **A card whose whole surface selects it cannot also contain an independently operable button.** Move's ride card is a `<label>` wrapping a visually-hidden radio, so the entire surface is the radio's activation target. A `<button>` inside it is invalid markup — the `<label>` content model excludes labelable descendants other than its own control, and a button is labelable — and it is unusable even where a browser tolerates it, because a press lands on the button *and* on the label, so acting on the row and choosing the row become the same gesture.

**This blockquote is a correction.** It first read *"A radio may not contain a button"*, which is snappier and does not describe the code this entry produced: the radio is a sibling of the card's content, not its ancestor, so nothing is nested inside it at all. Read literally the old claim was vacuous — `<input>` is a void element and can contain nothing — and read as ARIA it was true but about a construction nobody built. The narrower sentence above is what the refusal actually rests on, and it is the one to attack. The old wording also carried *"there is no arrangement in which both work"*, which is false: a plain container holding a radio and a button as siblings, with the radio named by `aria-labelledby`, works fine. What does not work is that arrangement being **this** component, whose whole surface is the target.

So option 2 is not a component with two variants. It is a component that is a **container** in one variant and a **control** in the other — a different element, a different role, a different tab-stop model, a different keyboard contract, and a different answer to "what happens when I press it". `variant` would be selecting between two components that share a border-radius.

Option 1 fails the same way one level down: slots do not change what the outer element is, or what that element does with a press. A shared `Card` would have to render a `<label>` for Move — so that the surface selects — and a plain container for Market, so that the surface does nothing and the link and button inside it are reachable on their own. That is two elements with two activation models behind one name, which is what "slots" would be hiding rather than solving.

### Content responsibility differs, and it differs in a way modes cannot express

Set the structure aside for a moment, because the content argument is what makes this a *design system* decision rather than only an accessibility one.

| | product card | ride card |
|---|---|---|
| carries | image, name, size, price, was-price, unit price, stock, delivery estimate | vehicle, ride type, ETA, fare, surge note, seat count |
| tokens it needs | `commerce.discount`, `commerce.stock.low` | `mobility.surge` |
| the number in it | a **price** — a formatted quantity, fixed, comparable across the catalogue | a **fare estimate** — provisional, and it changes while you look at it |
| what "seats" and "size" are | a package size, part of the product's identity | a capacity, a constraint on whether this option is usable at all |

A mode resolves one *name* to different *values*. There is no name here to resolve: "unit price per kilogram" and "minutes away" are not two values of one concept, and [007](./007-modes-for-shared-namespaces-for-unique.md)'s test — *does the other product have this concept at all?* — returns no in both directions. That is the same test that put `commerce.*` and `mobility.*` in separate files rather than making them modes of each other, and it gives the same answer for the components that consume them.

The token constraint then makes it concrete rather than theoretical: a shared `Card` would need `commerce.discount` **inside itself** to paint the discount badge, which 007 forbids outright. Every workaround — passing the colour in as a prop, exposing a slot for the whole badge, adding a `product` mode to the shared component — is a way of writing the product's identity into a shared component and calling it something else.

### Option 3 is the near miss, and it is refused on a rule this repo already has

A shared `CardSurface` — the radius, the elevation, the ground, the padding — with both cards composing it, is genuinely tempting. It is the DRY answer and it would work.

It is refused for now, and the reason is a rule rather than a preference: **two occurrences is a coincidence, three is a pattern.** `Input.css` already says this out loud about its duplicated focus block, and the trigger it names is the third component that needs it. Extracting a shell from exactly two consumers means designing the shell against those two, and the third card — a promo tile, an order summary, a saved-address row — is the one that would have told us what the shell actually is.

There is a specific cost to being early here, and v0 is the evidence. The audit found **four radii across six card recipes, three of them for the same "card" role**, and an inline override applied "wherever someone noticed and nowhere else". That mess is what a premature shared shell decays into once each consumer has overridden the part that did not fit. Extracting later from three known consumers is a mechanical refactor; extracting now from two guesses is how the fourth radius gets born.

**What is shared instead is the token layer**, which is the layer designed to be shared. Both cards read `surface.default`, `border.default`, `radius.*` and the same elevation tokens. If those drift apart, that is a token defect the gates can see — and it is a better place to enforce visual consistency than a base class, because a token cannot be overridden by a consumer who found it inconvenient.

## Decision

**Two components. `ProductCard` and `RideCard`, independent, no shared shell.** Option 4.

`RideCard` is built as a **radio within a group**: the card is the label of a real `<input type="radio">`, the group is a `radiogroup`, one tab stop, arrow keys between options, `aria-checked` carried by the platform. It fixes 4 of the 24 keyboard-unreachable elements the audit counted.

`ProductCard` is built as a **container**: an `<article>` holding a link and an action, each independently focusable, with no click handler on the box itself. The quick-view overlay does not survive — a third target stacked over the image, invisible to a keyboard, is not a feature to reimplement.

**They share tokens and nothing else.** No base component, no shared stylesheet, no `variant` prop bridging them.

## Why

### The rule this generalises to, which is the reusable part

> **Two things are one component when they answer the same question about what the user does with them, not when they answer the same question about what they look like.**

Say it as a test that somebody can apply without seeing the screens:

1. **What element is it?** A container, a control, or a link. Different answers, different components — this is structural and it ends the argument early.
2. **How many tab stops does it have?** One is a control. Several is a container. Zero is a display.
3. **Does the other product have this concept at all?** ([007](./007-modes-for-shared-namespaces-for-unique.md)) If no, the content is namespaced, and a shared component cannot reach the tokens it needs.

The product card and the ride card give different answers to all three. Button's four implementations gave the same answer to all three, which is why 020 merged them and this entry does not. **The same test produced both outcomes**, and that is the point worth more than either result: a system that only ever merges is not applying judgment, it is applying a preference.

### The visual similarity is real and is not evidence

Both are cards because a card is what you draw when a scrolling list needs its items separated. That is a *layout* answer, and the token layer already owns it. Sharing a radius is not sharing a component, and the fact that this needed saying is why the entry exists.

## What this proves

[Rule 7](../CLAUDE.md), and specifically the half a portfolio of merges cannot: that the system can **decline** a consolidation and say why in terms somebody can check. It also proves the boundary is drawn on interaction model and content ownership rather than on appearance, which is the distinction that separates a component library from a collection of skins — and it does it with a structural argument (a radio may not contain a button) rather than a stylistic one, so the refusal survives a reviewer who disagrees about taste.

## Consequences

- **Two components in `packages/components/`,** with two contracts, two specs and two entries in the Figma library.
- **`RideCard` becomes a real radio group**, closing 4 of the audit's 24 keyboard-unreachable elements. The remaining 20 are other components' work.
- **The quick-view overlay is not reimplemented.** A screen that wants it can put a real control there; a `<div onClick>` stacked on an image is not a pattern to carry forward.
- **`ProductCard` composes `Button`**, which is the first time a Mizan component contains another one, and the first real test of whether the size steps compose inside a card.
- **The bidi defect at the call site does not travel.** v0 builds its title as `product.name + ' - ' + product.size`, which the audit found scrambles exactly one card in eight. `ProductCard` takes name and size as separate props and never concatenates them.
- **A shared `CardSurface` is owed a re-read at the third card**, not before. The trigger is written into both components' READMEs so it is found by whoever builds the third.
- **Neither component may reference the other's tokens**, and both say so in their contracts. That is checkable and eventually a lint rule.

## What would make us revisit this?

**A third card.** It is the trigger for the shared surface, and it is the first thing that would tell us whether the shell is a component, a set of tokens, or nothing at all.

**A ride card that stops being a selection.** If Move grows a screen where a ride is displayed rather than chosen — a trip receipt, a scheduled booking — that display is not this component, and it might well be closer to `ProductCard` than `RideCard` is. That would be evidence *for* a shared container, and it would arrive as a new component rather than a prop on this one.

**A product card that becomes selectable** — a multi-select for a bulk reorder, say. Same shape of question from the other side, and the answer is likely a distinct `SelectableProductCard` rather than a `selectable` prop, for the reason this entry is built on: adding selection to a container changes what element it is.

**Someone demonstrating the merge.** The refusal rests on a claim — that a radio may not contain a button — that is testable. If a construction exists where a keyboard user can both choose a card and press a button inside it, and screen readers agree about what it is, this entry should be reread rather than defended.
