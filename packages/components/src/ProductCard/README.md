# ProductCard — the API spec

Market's product tile. **A container, not a control.**

It is the other half of [decision 024](../../../../decisions/024-productcard-and-ridecard-stay-separate.md), which refused to merge it with Move's [`RideCard`](../RideCard/README.md):

> This card holds a **link** to the product and a **button** that adds it to the cart — two tab stops, independently reachable. A ride card is one option in an exclusive choice: a radio, one tab stop, whose whole surface is the target. **a card whose whole surface selects it cannot also contain an independently operable button**, so a `variant` prop would be selecting between a container and a control that happen to share a border radius.

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

## Responsibilities

**What ProductCard owns:**

- **Being an `<article>` and nothing more** — no `role`, no `tabindex`, no handler on the box. It is a container whose contents are independently reachable, and that sentence is the whole of decision 024's argument restated as a job.
- The parts in the anatomy and the order they read in, including that the name is a real link inside a real heading and the action, when there is one, is a real `Button`.
- **The heading level.** Fixed at `h3`, owned here on purpose rather than exposed — see Constraints.
- Which of Market's two commerce tokens is a mark and which is the colour of its own words. See the table below.
- **What disables the action:** `stockLevel === 'out'`, and nothing else. The card decides that the action exists and what makes it unavailable; it decides nothing else about it.
- Correct layout under any `dir` without being told which, and no width or height of its own.

**What it does not own, and who does:**

| Not owned | Owner | Why not here |
|---|---|---|
| Every word on it — name, size, prices, stock, delivery, action label | the string catalogue, via the call site | A component that authors a string authors content, and a default here would be an English string in a component that ships Arabic. |
| How a number is written | §4's one formatting boundary | `Intl` places the symbol and picks the minor units. Every numeric prop arrives already formatted; none of them is a `number`. |
| The image, and its alt text | the caller | See Content designers control. |
| The action's geometry, focus indicator, disabled semantics and hit target | `Button` | This is the first Mizan component to contain another one, and containment is the point: the card would otherwise be restating four guarantees it does not check. |
| What adding to the cart does | the call site | `onAddToCart` is a handler, not a behaviour this component has an opinion about. |
| Whether a pairing is legible | `content/tokens/pairs.json` and `check:contrast` | [Decision 010](../../../../decisions/010-contrast-is-a-token-layer-guarantee.md). |
| Where the card sits and how wide it is | the parent grid | §6. There is no `fullWidth` here and no equivalent — the card has no layout escape hatch at all. |

Button's test for this line is *"is this true of the control, or true of the situation the control is in?"*. A container needs the question asked one level further in: **is this true of the card, or true of one of the two things it contains?** The action's disabled *reason* is the card's — it is the card that knows about stock. The action's disabled *appearance* is Button's. Both rows above are the same question answered twice.

## Two tokens, two contexts — applied from the start this time

This component names two product-namespaced tokens, and it may because decision 024 kept it Market's. A shared `Card` could reach neither without taking them as props or exposing a slot, both of which write Market's identity into shared code under another name.

| token | declared as | measures | so it is |
|---|---|---|---|
| `commerce.discount` | **text**, 4.5 | passes | the colour of its own words, in the badge |
| `commerce.stock.low` | **ui**, 3.0 | 4.29:1 everywhere — clears 4.5 **nowhere** | a *mark* on the edge, with the words in `text.secondary` |

The second row is here because `RideCard` shipped the other version of it first — a whole sentence in `mobility.surge` at 3.87:1 in dark — and axe caught it. `check-contrast.mjs` could not: it verifies declared pairings in the context they were declared in, and cannot see a component using a token in a different context. That is a real limit of the gate, and this table is what applying the lesson looks like.

## Variants

**None, and the absence is the finding rather than an omission.** There is no `variant` prop, no `compact`, no `promo`. v0 had all three of those as separate components — `ProductCard`, `ProductCardCompact`, `ProductCardPromo` — and nothing imported any of them, which is the cheapest possible evidence that the axis was invented rather than needed.

What every card renders is one appearance. The things that differ between two cards on the same screen are *which optional parts are present* — a discount badge, a unit price, an action — and presence is not a variant. A variant is chosen; a part is passed or not passed.

### Is `stockLevel` a variant or a state?

It is the sharpest question this component asks, because `stockLevel` is a closed set of three strings that changes how the card looks, which is exactly the shape of a variant prop. Button's test decides it: **a variant names a legitimate difference in look; a state is a condition the same component passes through.**

`stockLevel` is a **state**, on four counts.

- **Nobody chooses it.** A variant is a designer's call at the call site — `primary` against `secondary` is a claim about which action matters on this screen. `'out'` is not a claim; it is what the inventory says. The same card, the same call site, the same product renders `'in'` in the morning and `'out'` in the afternoon with no design decision in between. A component passes *through* that; it does not get specified as it.
- **It is a fact about the product, not about the card.** Every prop on this component is a fact about a product except `href`, and `stockLevel` is one of them. Reading it as a variant would make "we are nearly out of milk" an appearance.
- **The differences it produces are not on a variant's permitted axis.** Button's variants differ in fill, label token and edge — three declared pairings a script checks — and are identical in everything else. `stockLevel` changes a `border-inline-start` mark, a font weight, and whether the contained `Button` is disabled. The last of those is decisive: **a variant does not disable another component.** Disabling is what a state does, and `disabled` is a state on Button for the same reason.
- **The variant reading would immediately be wrong about pairs.** Three variants imply three appearances that a designer may select between; only one of the three is painted in a product token at all, and that token is a 3.0 mark rather than a 4.5 text colour. There is no third appearance for `'in'` — it is the absence of the other two.

The counter-argument, stated so it is not smuggled past: `stockLevel` is *not* like Button's states either, because none of hover, press, focus or busy is data. It is a **data-driven state** — a condition of the world the card reflects — where Button's are interaction states of a control. That is the right distinction to draw, and it is a distinction between two kinds of state rather than a reason to call one of them a variant. It is also why the prop is `stockLevel` and not `stock`: the level is the state, and a prop called `stock` would read as the thing rather than as its condition.

## States

The card has **no interactive states of its own**, and that follows from Responsibilities rather than being a separate decision: an `<article>` with no handler has nothing to hover, press, focus or disable. There is no `:hover` rule on `.mz-product-card` — no lift, no shadow, no border change. A card that highlighted on hover would be advertising a target that is not there.

Its one state is the stock level, and the interactive states in it belong to the two things it contains.

| State | Trigger | What changes | What does not |
|---|---|---|---|
| `stockLevel="in"` *(default)* | — | nothing. `data-level="in"` is written and no rule matches it | — |
| `stockLevel="low"` | the catalogue | the stock line takes a `commerce.stock.low` mark on its reading-start edge, at `stroke.200`, with the words left in `text.secondary` | the words' colour, the action, everything else |
| `stockLevel="out"` | the catalogue | the stock line's words go to `text.primary` at `font-weight.medium`; **the contained `Button` is `disabled`** | the layout, the link, the prices — the card stays fully readable and the title still navigates |

**Nothing here fades and nothing here is red.** v0 draws out-of-stock as `opacity: 0.5`, which renders a colour no token declares and therefore a ratio `check:contrast` cannot see; `'out'` is carried by words plus a disabled action instead, and `'low'` is carried by a mark plus words rather than by coloured words. Both are the same rule: colour is never the only carrier.

**One gap in that, and it is real.** `outOfStock` is computed from `stockLevel` alone, so a consumer who passes `stockLevel="out"` without a `stockLabel` renders a disabled action with **nothing on the card saying why** — the stock line only renders when there are words to put in it. That is the same shape of trade as `wasPrice` without `wasPriceLabel`: the type permits it, the contract's `accessibility.consumer_must` asks for it, and nothing enforces it. Stated rather than hidden.

### The states of what it contains

Neither row is this component's to specify, and both are listed so a reader is not left thinking the card has none.

| Part | States | Owned by |
|---|---|---|
| The title link | rest, hover, `:focus-visible` | This component's CSS, but only two properties of them: the underline appears on hover and focus with `text-underline-offset` for the Arabic dots, and `mz-focus-ring` brings [019](../../../../decisions/019-the-focus-indicator-is-two-tone.md)'s indicator from `../styles/focus.css`. The radius is overridden to `radius.0` — an inline link inside a heading is not a rounded box. |
| The action | rest, hover, press, focus, disabled, busy | [`Button`](../Button/README.md) entirely. The card sets `disabled` and passes a label; it specifies none of the six. |

## Properties exposed

`name` (required) · `packageSize` · `href` (required) · `image` · `price` (required) · `wasPrice` · `wasPriceLabel` · `discount` · `unitPrice` · `stockLevel` · `stockLabel` · `delivery` · `addToCartLabel` · `onAddToCart`

**`packageSize`, not `size`.** `size` names a control step everywhere else in this library, and one word meaning two things across a component library is the defect [020](../../../../decisions/020-the-button-consolidation.md) found in v0's three names for a variant.

**Every number is a node, already formatted** by §4's one boundary — symbol placed by `Intl` rather than concatenated, Western digits in both locales, the currency's own minor-unit count. v0 writes `'AED ' + price.toFixed(2)`, which is the concatenation §4 exists to end.

**Omit `onAddToCart` and no action renders.** The card is still a card — the title still links, the facts still read. A `RideCard` with its radio removed would be nothing, and that difference is what decision 024 is built on. The `NoAction` story exists to show it.

## The struck price is labelled as well as struck

§2 records that `line-through` is drawn across whatever glyphs are there and **no property will move it** — skip-ink applies to underlines and overlines only. So a struck price cannot be the only carrier of its own meaning.

Read aloud it is worse: without a label, a screen-reader user hears *"AED 9.99, AED 12.50"* and has no way to know which one they pay. `wasPriceLabel` renders visually hidden beside the strike.

It is not required by the type, because a card may legitimately show no old price — which means a consumer can pass `wasPrice` without it. That is in the contract's `accessibility.consumer_must` rather than enforced, and the trade is stated rather than hidden.

## Content designers control

Nearly all of it. Every visible word on this card arrives as a prop and not one of them has a default. Of the fourteen properties, eleven are content; the other three are `href`, `onAddToCart` and `stockLevel`, which are a destination, a handler and a state.

- **The product name**, at any length, in either language. Nothing truncates it and the card grows to fit, vertically as well as horizontally. It is never joined to anything: `packageSize` is a second element for the structural reason in What it replaces, so the two are written and translated independently.
- **The prices, the discount, the unit price and the delivery estimate** — as formatted strings from §4's boundary, never numbers. That means the writer controls the words around the figure ("per kg", "Get it tomorrow") and `Intl` controls the figure.
- **`wasPriceLabel`**, which is a word a screen reader says and nobody sees. It is content work with no visual output, which is the kind that gets skipped; the argument for it is above.
- **The stock words.** `'low'` is a state, but "Only 3 left" against "Low stock" is a writing decision, and the component holds no English string to make it for anybody.
- **The action's label**, required whenever there is an action.
- **The image, and its alt text.**

### What must be true of the alt text

The image arrives as a node — an `<img>`, a framework's optimised component, or nothing — and its `alt` is written at the call site. Three things have to be true of it:

- **It is usually empty.** In a grid the name is directly below the image, so alt text repeating it makes a screen reader say every product twice. `alt=""` is the correct value in that case and it must be present, not absent: a missing `alt` attribute and an empty one are different, and only one of them means "decorative".
- **When it is not empty, it adds what the name does not.** The case for real alt text is an image carrying information no other prop carries — a serving suggestion, a variant colour, a label the shopper is meant to recognise.
- **It never contains the price, the discount or the stock.** All three are text elsewhere on the card and all three change without the image changing.

**What this component cannot check, stated plainly.** It receives a rendered node and never inspects it, so it cannot tell whether an `alt` attribute is present, whether it is empty on purpose or by accident, or whether a non-empty one is any good. The last of those is not a check any script can do — deciding whether alt text is *right* requires knowing what the picture shows. What the gate does reach: axe fails a story whose image has no `alt` attribute at all, and that is the whole of the automated coverage. The rest is judgment at the call site, which is why this section says what "right" means rather than pretending a script settles it.

## Constraints

- **No click handler on the card, and no selection state.** Adding selection changes what element it is — the answer would be a distinct component, not a prop.
- **No width, no fixed height.** The card fills its grid cell.
- No `className`, no `style`, no numbers, no prop that shortens a string.
- **No heading-level prop.** The heading is an `h3`. Exposing `level` would let a call site produce an outline that skips levels, which is the more common failure; if a screen needs it, the fix is a heading-level context rather than a prop on every card.
- **No alt text invented here.** This component cannot know whether an image adds information the name does not already carry — in a grid where the name is right there, the correct alt is usually empty, and an invented one is noise on every card.
- **One value the token layer owes a name to:** the `0.25em` underline offset, which §2 says belongs in the token layer for the same reason the optical size correction does. The 1px edge was a written number until [decision 026](../../../../decisions/026-the-stroke-scale.md); it resolves from `stroke.100` now, and the low-stock mark from `stroke.200`.

## Accessibility guaranteed

- An `<article>` with no role, no tabindex and no handler — not a control pretending to be one.
- The name is a real link inside a real heading, so the grid is navigable by heading.
- The action is a `Button`, which brings its own focus indicator, disabled semantics and 44×44 target by composition. **This is the first Mizan component to contain another one.**
- Out of stock is carried by words plus a disabled action — never colour or opacity alone.
- The low-stock colour is used as a mark at the bar it was declared for.
- **0 axe violations across all eight stories**, checked in dark + Market + RTL.

**No ARIA Authoring Practices pattern applies to this component, and that is the correct finding rather than a gap in the research.** APG describes widgets — things that take keyboard interaction *as a unit*, with the composite's own arrow-key model, roving tabindex and single tab stop. This card takes no keyboard interaction as a unit at all: it is a container holding a link and a button, each reached and operated on its own, and the platform already knows how to do that. The relevant W3C guidance is the negative one, and it is worth stating because the instinct runs the other way: a card containing multiple interactive elements **must not** be turned into a single control. Doing so has exactly two outcomes, and both are defects — either the inner controls are buried, so the add-to-cart button becomes unreachable, or they survive and produce nested interactive elements, which is a link inside a button and has no defined behaviour. Reaching for a pattern here would mean choosing one of those. The `<article>` with no role is what having no pattern looks like when it is done deliberately.

[`RideCard`](../RideCard/README.md) is the case where a pattern *does* apply, and the contrast is decision 024's argument arriving from the accessibility side rather than the API side.

## RTL behaviour

- The discount badge is placed with `inset-inline-start` and the low-stock mark is a `border-inline-start`, so both sit on the reading-start edge in either direction with no side named.
- The badge is an **element**, not a background image: §1 records that `background-position` has no logical keywords at all — checked in a current engine, not assumed.
- Prices carry `unicode-bidi: isolate`.
- The link underline declares `text-underline-offset`. §2: a default underline is drawn straight through the dots Arabic carries below the baseline — ب, ي, ج all do — and `text-decoration-skip-ink`, which is already `auto` everywhere, makes it *worse* on Arabic by breaking the line into four or five dashes with the dots in the gaps.
- The product image does **not** mirror. §5: it depicts a real object, and mirroring a photograph produces a false one.

## Code API mapping

### To the DOM

Every prop is a node placed in an element, and the table is short because nothing is transformed on the way. No prop is concatenated with another, none is parsed, and none is turned into a string.

| Prop | What it renders |
|---|---|
| `name` | the contents of `a.mz-product-card__link`, inside `h3.mz-product-card__heading` — **tab stop 1** |
| `href` | the `href` attribute on that `<a>`, verbatim |
| `packageSize` | `p.mz-product-card__package-size`, a separate element, never joined to `name` |
| `image` | placed into `div.mz-product-card__media` as given — no wrapper element, no attribute added, no `alt` supplied |
| `price` | `span.mz-product-card__price`, inside `p.mz-product-card__prices` |
| `wasPrice` | an `<s>` inside `span.mz-product-card__was` |
| `wasPriceLabel` | a visually hidden `<span>` **before** the `<s>`, with a trailing space, so it is read as "Was AED 12.50" |
| `discount` | `span.mz-product-card__discount`, absolutely positioned over the media. Not `aria-hidden` — the saving is information the price row does not carry |
| `unitPrice` | `p.mz-product-card__unit` |
| `stockLevel` | the `data-level` attribute on the stock paragraph, **and** `disabled` on the contained `Button` when it is `'out'` |
| `stockLabel` | the contents of `p.mz-product-card__stock`. Nothing renders without it, including the `data-level` hook |
| `delivery` | `p.mz-product-card__delivery` |
| `addToCartLabel` | the children of `<Button variant="primary" fullWidth>`, and therefore its accessible name — **tab stop 2** |
| `onAddToCart` | Button's `onClick` |

**Five parts are optional-by-omission and one is optional-by-pair.** Each of `packageSize`, `wasPrice`, `unitPrice`, `stockLabel` and `delivery` renders nothing at all when absent — no empty element, no reserved space. `image` is the exception and deliberately so: the media box is a `4 / 3` `aspect-ratio` that stays whether or not an image arrives, because a row of cards where one has no picture should not be a row where one card is shorter. The action needs **both** `onAddToCart` and `addToCartLabel`; either alone renders no button, which is deliberate — a handler with no label would be an unnamed button, and a label with no handler would be a control that does nothing.

**No prop maps to an ARIA attribute, and none maps to a `role`.** The two tab stops are a real `<a>` and a real `<button>`, and every semantic on this card comes from an element rather than from an attribute restating one. The count is two only when the action renders: with `onAddToCart` omitted the card has one tab stop and is still a card, which is the `NoAction` story.

**One value crosses a component boundary** — `stockLevel === 'out'` becomes Button's `disabled`. It is the only coupling between the container and its contents, and it goes one way.

### To Figma

Not yet wired. When Code Connect lands, `stockLevel` is a component property and the six optional parts are boolean properties for presence; `href` and `onAddToCart` have no Figma counterpart and must not acquire one, for the reason Button's spec gives — a property that exists on only one side is a property that drifts.

## What is owed

~~**The focus indicator is duplicated for the fourth time.**~~ **Extracted** to [`../styles/focus.css`](../styles/focus.css) and reached by `mz-focus-ring` on the link. What stays local is the `border-radius: var(--radius-0)`: the shared rule deliberately sets no radius, so every consumer keeps its own corners, and an inline link inside a heading is not a rounded box.

**A quantity stepper.** The roadmap's description of this card includes one, and it is deliberately absent: a stepper is a third interactive target and a component in its own right. It should be built before it is embedded here.

## How we would deprecate it

Withdrawn only by a decision naming what replaces it. A prop goes first: `@deprecated` in the source with the replacement named in the tag, kept for one minor version, then removed in a major one with the migration written down.

The likeliest growth is the stepper, which arrives as a **new component embedded here** rather than as props on this one.
