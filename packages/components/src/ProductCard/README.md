# ProductCard — the API spec

Market's product tile. **A container, not a control.**

It is the other half of [decision 024](../../../../decisions/024-productcard-and-ridecard-stay-separate.md), which refused to merge it with Move's [`RideCard`](../RideCard/README.md):

> This card holds a **link** to the product and a **button** that adds it to the cart — two tab stops, independently reachable. A ride card is one option in an exclusive choice: a radio, one tab stop, whose whole surface is the target. **A radio may not contain a button**, so a `variant` prop would be selecting between a container and a control that happen to share a border radius.

The `TwoTabStops` story is that refusal as a test: it asserts a link, a button, and that the card itself is an `<article>` with no `role` and no `tabindex`.

## What it replaces

v0 has **three `ProductCard` components that nothing imports** — `ProductCard`, `ProductCardCompact`, `ProductCardPromo` — and **five inline copies that actually render**. The dead components are the tidy ones; the live markup is inline in the screens.

Three defects do not travel:

- **The title concatenation.** v0 renders `product.name + ' - ' + product.size` at three call sites. The audit's finding is the sharpest sentence in that document: *"Every Arabic product name renders correctly on its own. It is the concatenation that scrambles them. Seven of eight cards look right and one is wrong, which is exactly why this survives review."* Here `name` and `packageSize` are two props rendered as two elements — there is no string to scramble, so the fix is **structural** rather than a `<bdi>` applied afterwards.
- **The "Quick view" overlay** — a `<div onClick>` stacked over the image, counted by the audit among the 24 keyboard-unreachable elements, 8 of them, one per product in the grid. It is not reimplemented. A screen that wants quick view puts a real control there.
- **`width: 240px` in an inline style**, which is the prop §6 names as the usual culprit arriving as a style object, and **`opacity: 0.5`** for out of stock, which renders a colour no token declares.

## Anatomy

```
┌ <article> .mz-product-card ─── no role, no tabindex, no handler ┐
│  ┌ media (aspect-ratio) ──────────────────────────────────────┐ │
│  │  image                          [ -20% ]  ← inset-inline-start│
│  └────────────────────────────────────────────────────────────┘ │
│  <h3><a> name ────────────────────────────────── tab stop 1     │
│  package size ──────────────── a separate element, never joined │
│  price   ̶w̶a̶s̶ ̶p̶r̶i̶c̶e̶  + visually-hidden "Was"                     │
│  unit price                                                     │
│  │ stock ──────────── commerce.stock.low mark + text.secondary  │
│  delivery                                                       │
│  ┌ <Button variant=primary fullWidth> ─────────── tab stop 2 ─┐ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Two tokens, two contexts — applied from the start this time

This component names two product-namespaced tokens, and it may because decision 024 kept it Market's. A shared `Card` could reach neither without taking them as props or exposing a slot, both of which write Market's identity into shared code under another name.

| token | declared as | measures | so it is |
|---|---|---|---|
| `commerce.discount` | **text**, 4.5 | passes | the colour of its own words, in the badge |
| `commerce.stock.low` | **ui**, 3.0 | 4.29:1 everywhere — clears 4.5 **nowhere** | a *mark* on the edge, with the words in `text.secondary` |

The second row is here because `RideCard` shipped the other version of it first — a whole sentence in `mobility.surge` at 3.87:1 in dark — and axe caught it. `check-contrast.mjs` could not: it verifies declared pairings in the context they were declared in, and cannot see a component using a token in a different context. That is a real limit of the gate, and this table is what applying the lesson looks like.

## Properties exposed

`name` (required) · `packageSize` · `href` (required) · `image` · `price` (required) · `wasPrice` · `wasPriceLabel` · `discount` · `unitPrice` · `stockLevel` · `stockLabel` · `delivery` · `addToCartLabel` · `onAddToCart`

**`packageSize`, not `size`.** `size` names a control step everywhere else in this library, and one word meaning two things across a component library is the defect [020](../../../../decisions/020-the-button-consolidation.md) found in v0's three names for a variant.

**Every number is a node, already formatted** by §4's one boundary — symbol placed by `Intl` rather than concatenated, Western digits in both locales, the currency's own minor-unit count. v0 writes `'AED ' + price.toFixed(2)`, which is the concatenation §4 exists to end.

**Omit `onAddToCart` and no action renders.** The card is still a card — the title still links, the facts still read. A `RideCard` with its radio removed would be nothing, and that difference is what decision 024 is built on. The `NoAction` story exists to show it.

## The struck price is labelled as well as struck

§2 records that `line-through` is drawn across whatever glyphs are there and **no property will move it** — skip-ink applies to underlines and overlines only. So a struck price cannot be the only carrier of its own meaning.

Read aloud it is worse: without a label, a screen-reader user hears *"AED 9.99, AED 12.50"* and has no way to know which one they pay. `wasPriceLabel` renders visually hidden beside the strike.

It is not required by the type, because a card may legitimately show no old price — which means a consumer can pass `wasPrice` without it. That is in the contract's `accessibility.consumer_must` rather than enforced, and the trade is stated rather than hidden.

## Constraints

- **No click handler on the card, and no selection state.** Adding selection changes what element it is — the answer would be a distinct component, not a prop.
- **No width, no fixed height.** The card fills its grid cell.
- No `className`, no `style`, no numbers, no prop that shortens a string.
- **No heading-level prop.** The heading is an `h3`. Exposing `level` would let a call site produce an outline that skips levels, which is the more common failure; if a screen needs it, the fix is a heading-level context rather than a prop on every card.
- **No alt text invented here.** This component cannot know whether an image adds information the name does not already carry — in a grid where the name is right there, the correct alt is usually empty, and an invented one is noise on every card.
- One written number, the 1px edge — and one value the token layer owes a name to: the `0.25em` underline offset, which §2 says belongs in the token layer for the same reason the optical size correction does.

## Accessibility guaranteed

- An `<article>` with no role, no tabindex and no handler — not a control pretending to be one.
- The name is a real link inside a real heading, so the grid is navigable by heading.
- The action is a `Button`, which brings its own focus indicator, disabled semantics and 44×44 target by composition. **This is the first Mizan component to contain another one.**
- Out of stock is carried by words plus a disabled action — never colour or opacity alone.
- The low-stock colour is used as a mark at the bar it was declared for.
- **0 axe violations across all eight stories**, checked in dark + Market + RTL.

## RTL behaviour

- The discount badge is placed with `inset-inline-start` and the low-stock mark is a `border-inline-start`, so both sit on the reading-start edge in either direction with no side named.
- The badge is an **element**, not a background image: §1 records that `background-position` has no logical keywords at all — checked in a current engine, not assumed.
- Prices carry `unicode-bidi: isolate`.
- The link underline declares `text-underline-offset`. §2: a default underline is drawn straight through the dots Arabic carries below the baseline — ب, ي, ج all do — and `text-decoration-skip-ink`, which is already `auto` everywhere, makes it *worse* on Arabic by breaking the line into four or five dashes with the dots in the gaps.
- The product image does **not** mirror. §5: it depicts a real object, and mirroring a photograph produces a false one.

## What is owed

**The focus indicator is duplicated for the fourth time**, on the link. `Input.css` set the trigger at three. The extraction is overdue and is its own change rather than something that happens while a card is being written.

**A quantity stepper.** The roadmap's description of this card includes one, and it is deliberately absent: a stepper is a third interactive target and a component in its own right. It should be built before it is embedded here.

## How we would deprecate it

Withdrawn only by a decision naming what replaces it. A prop goes first: `@deprecated` in the source with the replacement named in the tag, kept for one minor version, then removed in a major one with the migration written down.

The likeliest growth is the stepper, which arrives as a **new component embedded here** rather than as props on this one.
