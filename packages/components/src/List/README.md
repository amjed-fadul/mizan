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

## Responsibilities

The component is two exports, and the split between them is not symmetrical: `List` holds every decision, and `ListItem` holds the element.

**What `List` owns:**

- Choosing the element — `<ul>` or `<ol>` — and writing `role="list"` on it unconditionally, which is the pair described above.
- Removing the markers, and therefore owning the defect that removal causes.
- The stack: a block-axis grid and the gap between rows.
- `letter-spacing: 0`, declared rather than inherited, because a container is what passes a page's tracking through to every row.
- Whether a divider is drawn, and where — the rule is written on the list's class and reaches the rows through a selector.
- Carrying an accessible name when it is given one.

**What `ListItem` owns:** the `<li>`, and a `margin: 0` that guarantees the row contributes no spacing of its own — the gap is the grid's, and one inherited margin would make it two. That is the whole of it. It takes one prop, it has no modifier class, and it is not told whether dividers are on — `.mz-list--dividers > .mz-list__item + .mz-list__item` is the list's selector reaching down, so a row cannot be asked for a rule of its own and cannot be asked to suppress one. A row that could be individually divided would be a second place the divider decision lives.

**What neither owns, and who does:**

| Not owned | Owner | Why not here |
|---|---|---|
| Everything inside a row — its padding, its ground, its type | the row's content | A row holds a `ProductCard` or a cart line, and each already decided those. See Constraints. |
| Whether the collection is genuinely ordered | the call site | Nothing can check it. See Variants. |
| Any layout wider than one column | the parent, or a layout primitive that does not exist yet | A product grid is a layout. See Constraints and How we would deprecate it. |
| What the rows are, where they come from, how many there are | the screen's data | No virtualisation, no pagination, no sorting. |
| What the divider looks like | `content/tokens/` | Rule 1. `border.default` and `stroke.100` are consumed here and decided there. |
| Any keyboard behaviour | nobody — there is none | A list that took keyboard interaction would be a listbox. See Accessibility guaranteed. |

## Variants

**None, and the argument is worth writing down because the component has two booleans that look like they should be some.**

Button's test is that a variant names a legitimate difference — an axis whose members are mutually exclusive, and each of which is a distinct kind of the same thing. `ordered` and `dividers` fail that test twice over, and they fail it differently, which is the interesting part.

**They are independent, so an enum would have to be their cross product.** `ordered` and `dividers` compose freely: a divided ordered list is as reasonable as an undivided unordered one. A `variant` prop covering both would have four members named after combinations — `plain`, `divided`, `numbered`, `numbered-divided` — and a fifth boolean would take it to eight. Variants are a vocabulary; a cross product is not one.

**`ordered` is not an appearance at all.** It changes the rendered element from `<ul>` to `<ol>`, and the thing it changes is what the collection *means*: a screen reader announces the position, and the position is either information or noise. It is semantic configuration — a claim about the content, made by the only party that can make it. `role="list"` is written on both elements, so this is deliberately *not* a role change: ARIA has no `orderedlist`, the ordering rides on the element, and the role is the same fact in both cases.

**`dividers` is an appearance, but a decoration rather than a kind.** It adds one line drawn in a token declared `decorative`. A list with dividers is not a different kind of list from one without; it is the same list in a denser context. Presentational configuration.

So: one semantic boolean, one presentational one, and no variant axis. The distinction is not pedantry, because the two carry very different risks.

**A wrong `dividers` is visible to everyone who looks at the screen.** A wrong `ordered` is invisible in the pixels — an `<ol>` with `list-style: none` renders exactly like a `<ul>` — and audible only to somebody using a screen reader, who is told *"item 3 of 7"* about a number that means nothing. Nothing checks it and nothing can: whether a position is information is a fact about the product, not about the markup. That is why it is in the contract's `accessibility.consumer_must` rather than in a script, and it is the one place this component depends on a judgment it cannot verify.

## States

**There are none.** No `:hover`, no `:active`, no `:focus-visible`, no selection, no expansion, no motion — `List.css` contains no pseudo-class selector and no transition, and the component holds no state in JavaScript either.

That is worth stating rather than skipping, because it is three guarantees rather than an absence:

- **Nothing here responds to a pointer or a key.** If a row looks interactive, the interactivity is inside the row and belongs to whatever is in it — a `Button`, a link, a card. This component neither adds a target nor removes one.
- **There is nothing for `prefers-reduced-motion` to reduce.** No rule is gated on it, and none is needed.
- **A "selected row" is not a thing this component can express**, and that is the boundary rather than a gap. See Accessibility guaranteed.

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

## Content designers control

- **Everything inside a row.** `ListItem` takes `children` and renders them untouched — a `ProductCard`, a cart line, a sentence. Nothing here truncates, abbreviates or shortens, and nothing here has an opinion about the row's type or padding.
- **Whether the position is part of what a row means**, which is the `ordered` decision. It is a content judgment before it is an API one, and Variants says why nothing can check it.
- **The list's name, when it needs one**, in both languages. It becomes `aria-label`, so it is a string and only assistive technology reads it — which is exactly why Properties exposed argues for a visible heading first. A name written here is a name a sighted user cannot quote back.
- **The empty state.** A list with nothing in it is a sentence, and the sentence is written outside this component. `children` renders whatever it is handed, so a message or a separator passed in place of rows appears as given; the component does not detect the empty case and will not start.

## Constraints

- **No layout beyond a single-column stack.** No columns, no density, no alignment. A product grid is a layout decision and this component deliberately cannot express one — the boundary is in the contract rather than blurred with a prop.
- **No styling of the rows.** A row holds a `ProductCard` or a cart line, and each already decides its own padding and ground. A List that styled its rows would be a second opinion about every one of them, and the first thing a consumer would need is a way to switch it off.
- **No empty state.** A list with nothing in it is a screen's decision about what to say, and it is usually a sentence.
- **No virtualisation, pagination or sorting.** Those are behaviours of a screen's data, not of its markup.
- No `className`, no `style`.
- **No written numbers.** The 1px divider was the sixth of seven occurrences of the literal; it resolves from `stroke.100` since [decision 026](../../../../decisions/026-the-stroke-scale.md).

## Accessibility guaranteed

- A real `<ul>` or `<ol>` with a real `<li>` per row, so the collection is counted.
- `role="list"` unconditionally, so the semantics survive the styling.
- An accessible name when `label` is given.
- **0 axe violations across all six stories**, checked in dark + RTL.

**No APG pattern applies, and that is the finding rather than a gap.** The ARIA Authoring Practices Guide describes widgets — things that take focus and keys and hold state. A static content list is none of those; it is plain content semantics, and the platform elements already carry them. The moment this component grew selection, or arrow-key navigation between rows, it would be a `listbox` and would owe the whole of that pattern: roving `tabindex`, `aria-selected`, an active-descendant story, and a keyboard contract. It deliberately is not one. Checking a content list against a widget pattern and reporting the missing keyboard support as a defect is the mistake this paragraph exists to head off.

`ListItem` exists so a call site cannot forget the `<li>`. A `<div>` inside a `<ul>` is invalid and fails the quiet way: it usually looks right, and the row stops being counted.

**What the consumer must still do** is in the contract's `accessibility.consumer_must` — prefer a visible heading, wrap every row, decide `ordered` honestly, and write the empty state.

## RTL behaviour

**There is nothing in this component with a direction to get wrong**, and that is a property rather than an accident: the stack is a **block-axis** grid and the divider is a `border-block-start`, and the block axis is the one `dir` does not touch.

What flips inside a row is the row's own business — the browser reorders its text, and this component neither knows nor cares.

`letter-spacing: 0` is declared rather than inherited, because a list is a container that would otherwise pass a page's global tracking straight through to every Arabic row. §2: tracking breaks the joins in Arabic script, and the Stage 1 audit found exactly that reaching every product title.

There is no `[dir='rtl']` selector anywhere.

## Code API mapping

### To the platform

Four props and two elements, so the whole mapping fits in one table.

| Prop | HTML / ARIA |
|---|---|
| `ordered` | the element: `<ol>` when `true`, `<ul>` when `false`. Nothing else changes — `role` included |
| `dividers` | `class="mz-list mz-list--dividers"`, which arms a selector on the rows. No attribute, no ARIA |
| `label` | `aria-label`, verbatim. Absent from the DOM when the prop is not passed |
| `children` | the rows, as given |
| — | `role="list"`, written unconditionally on whichever element `ordered` chose |
| `ListItem` `children` | inside `<li class="mz-list__item">` |

Two rows are load-bearing. **`role="list"` has no prop and must not acquire one** — a switch for it is a switch for the defect this component exists to prevent. And **`ordered` changes the element rather than the role**, because ARIA has no `orderedlist`: the ordering is carried by `<ol>`, `list` is the correct role for both, and a component that expressed the difference in ARIA would be saying it in the layer that cannot carry it.

There is no `className` and no `style`, so the class attribute above is the complete set of classes either element can ever have.

### To the token layer

Six slots, and one of them is a colour.

| Slot | Token |
|---|---|
| Gap between rows | `space.150` |
| Divider colour | `border.default` |
| Divider width | `stroke.100` |
| Space above a divided row | `space.150` |
| Face | `font-family.sans` |
| Tracking | `letter-spacing.none` |

No foreground colour, no ground, no radius, no type size, no weight and no motion token appears anywhere in this component. It paints one line and stacks its rows; everything else it renders was decided by whatever is inside a row.

## How we would deprecate it

The narrowest component here, which makes it the easiest to withdraw and the one most likely to be **absorbed**. If a layout primitive ever lands that owns stacking and spacing, the question is whether List becomes a thin semantic wrapper over it or disappears into it entirely. Either way that is a decision entry naming what replaces it, and the migration is mechanical because the API is four props.

## What is not here

**A grid**, **a description list** (`<dl>`, for label/value pairs), and **Navigation** — which needs a landmark and current-page semantics this does not have. All three are named in `do_not_use_when` so that somebody told not to use this component is not left at a dead end.
