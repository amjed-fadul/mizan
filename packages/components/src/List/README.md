# List — the API spec

The smallest component in the library, and the one with the narrowest reason to exist.

## What it replaces

**Five mapped collections in v0, and not one `<ul>`.**

| v0 | what it renders |
|---|---|
| `CartScreen.tsx:87` — cart lines | `<div>` |
| `CategoryScreen.tsx:160` — the product grid | `<div>` |
| `CategoryScreen.tsx:129` — the filter row | `<div>` |
| `BookingScreen.tsx:86` — ride options | `<div>` (and correctly *not* a list — it is a radio group, now [`RideCard`](../RideCard/README.md)) |

The only semantic list in the entire application is the developer index on the home screen. A screen-reader user is told nothing about how many things there are, or where they are among them — no *"list, 7 items"*, no *"item 3 of 7"*.

## Why this is a component and not "just write a `<ul>`"

Because of one line of CSS that every styled list needs, and that silently removes the semantics it was styling:

```css
ul { list-style: none }
```

WebKit is documented as dropping the implicit `list` role when the markers go — the reasoning being that a list without markers was probably not meant as one. So a list styled the way every design system styles it is announced as a run of ordinary text. `role="list"` restores it, and is inert in engines that never removed it.

**Stated as received, not as measured.** This was developed against Chromium, which keeps the role either way, so the behaviour being guarded against **could not be reproduced here**. That is precisely why the attribute is written unconditionally rather than behind an engine check: it costs nothing where it is unnecessary, and the failure it prevents is invisible to everyone who cannot hear it.

One platform trap, fixed once, where a pattern would be fixed by whoever remembered. That is the entire argument for the component — and it is a narrow one, which is why this spec is short.

**The CSS and the attribute are a pair.** `list-style: none` lives in `List.css`; `role="list"` lives in `List.tsx`. Removing one without the other is the defect this component exists to prevent, and both files say so.

## Anatomy

```
┌ <ul role="list"> ── list-style:none, block-axis grid, gap ──┐
│  ┌ <li> ─────────────────────────── no styling of its own ─┐│
│  ├ <li> ── border-block-start when dividers ───────────────┤│
│  └ <li> ── no trailing rule under the last ────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

**Dividers are drawn on the rows, not on the list** — `border-block-start` on every row *after the first*, so the line belongs to the row below it and there is never a trailing rule under the last one. That is what `border-block-end` on every row produces, and what makes a list look unfinished.

`border.default` is the token whose own description names this use: *"a card outline, a divider between list rows"*. It is declared `decorative` in `pairs.json`, so its 1.48:1 is measured and reported and nothing gates it — correct for a divider, and wrong for a line that identified a control.

## Properties exposed

`children` (required) · `ordered` · `dividers` · `label`

Four props, which is the smallest API in the library.

### `ordered` is about meaning, not sequence

The test is **not** "are these in an order" — everything on a screen is. It is whether the **number is information**.

- Checkout steps, a ranked result, the legs of a trip → `ordered`.
- A cart → not ordered. A user does not think of the third thing they added as third, and an `<ol>` there announces *"item 3 of 7"* about a position that means nothing.

### `label` is the second-best answer

It becomes `aria-label`, so it is a `string` rather than a `ReactNode` — an attribute cannot hold an element.

Prefer a visible heading beside the list. A name only assistive technology can reach is a name a sighted user cannot use to say *"the one under Saved addresses"*.

## Constraints

- **No layout beyond a single-column stack.** No columns, no density, no alignment. A product grid is a layout decision and this component deliberately cannot express one — the boundary is in the contract rather than blurred with a prop.
- **No styling of the rows.** A row holds a `ProductCard` or a cart line, and each already decides its own padding and ground. A List that styled its rows would be a second opinion about every one of them, and the first thing a consumer would need is a way to switch it off.
- **No empty state.** A list with nothing in it is a screen's decision about what to say, and it is usually a sentence.
- **No virtualisation, pagination or sorting.** Those are behaviours of a screen's data, not of its markup.
- No `className`, no `style`.
- One written number, the 1px divider, for the sixth time in the library. **Still no border-width scale.**

## Accessibility guaranteed

- A real `<ul>` or `<ol>` with a real `<li>` per row, so the collection is counted.
- `role="list"` unconditionally, so the semantics survive the styling.
- An accessible name when `label` is given.
- **0 axe violations across all six stories**, checked in dark + RTL.

`ListItem` exists so a call site cannot forget the `<li>`. A `<div>` inside a `<ul>` is invalid and fails the quiet way: it usually looks right, and the row stops being counted.

**What the consumer must still do** is in the contract's `accessibility.consumer_must` — prefer a visible heading, wrap every row, decide `ordered` honestly, and write the empty state.

## RTL behaviour

**There is nothing in this component with a direction to get wrong**, and that is a property rather than an accident: the stack is a **block-axis** grid and the divider is a `border-block-start`, and the block axis is the one `dir` does not touch.

What flips inside a row is the row's own business — the browser reorders its text, and this component neither knows nor cares.

`letter-spacing: 0` is declared rather than inherited, because a list is a container that would otherwise pass a page's global tracking straight through to every Arabic row. §2: tracking breaks the joins in Arabic script, and the Stage 1 audit found exactly that reaching every product title.

There is no `[dir='rtl']` selector anywhere.

## How we would deprecate it

The narrowest component here, which makes it the easiest to withdraw and the one most likely to be **absorbed**. If a layout primitive ever lands that owns stacking and spacing, the question is whether List becomes a thin semantic wrapper over it or disappears into it entirely. Either way that is a decision entry naming what replaces it, and the migration is mechanical because the API is four props.

## What is not here

**A grid**, **a description list** (`<dl>`, for label/value pairs), and **Navigation** — which needs a landmark and current-page semantics this does not have. All three are named in `do_not_use_when` so that somebody told not to use this component is not left at a dead end.
