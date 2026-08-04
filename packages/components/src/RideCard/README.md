# RideCard — the API spec

Move's ride option. **One radio in a group**, not a card that happens to be clickable.

It is half of [decision 024](../../../../decisions/024-productcard-and-ridecard-stay-separate.md), which refused to merge it with Market's [`ProductCard`](../ProductCard/README.md). The argument is structural rather than aesthetic and it is worth stating first, because everything else in this file follows from it:

> **A card whose whole surface selects it cannot also contain an independently operable button.** This card is the label of a real radio, so the whole surface is the target and it has exactly one tab stop — and a `<button>` inside a `<label>` is invalid markup, because the label content model excludes labelable descendants other than its own control. A product card contains a link *and* an action, which are two. No prop bridges a control and a container.

## What it replaces, and what that was costing

v0's `RideCard` is a `<div onClick>` rendered four times on `/move`. The Stage 1 audit counted it among the 24 keyboard-unreachable elements in the app — 4 of them, one per option — with the note that **a keyboard user cannot change from the Economy default.**

The ride selector *is* the booking screen. It could not be operated without a pointer.

## Anatomy

```
┌ <fieldset> .mz-ride-card-group ─────────────────────────────┐
│  <legend> ──────────────── the question, in the a11y tree   │
│  ┌ <label> .mz-ride-card ──────────── one option, one radio ┐│
│  │  <input type=radio>  visually hidden, clip-rect, focusable││
│  │  vehicle ───────────────────────────────────── ride type ││
│  │  eta ─────────────────────────────────────────── capacity││
│  │  fare                                                    ││
│  │  │ surge note      ← mobility.surge mark + text.secondary ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

## Why a real radio, and not `role="radio"`

Everything the replacement needs comes from the platform:

| behaviour | where it comes from |
|---|---|
| one tab stop for the whole group | `name` shared across the inputs |
| arrow keys between options | the browser |
| `aria-checked` | the browser |
| skipping a disabled option | the `disabled` attribute |
| the group's accessible name | `<fieldset>` + `<legend>` |

A `div` with `role="radio"` would reimplement each of those, and v0 is the record of what happens to the ones nobody remembers.

**The radio is visually hidden with a clip-rect, never `display: none`.** That is not a style preference: `display: none` and `visibility: hidden` both remove an element from the accessibility tree *and* the tab order, which would reintroduce exactly the defect this component exists to fix while looking correct on screen. The card then styles itself from the input's state with `:has()`, so the DOM stays the single source of truth and nothing in React mirrors `checked` into a class that could disagree with it.

## The surge note — a defect this component shipped and axe caught

The first version painted the whole surge sentence in `mobility.surge`. That token is declared in `pairs.json` at the **1.4.11 indicator bar of 3.0**, and it measures:

| | on `surface.default` | bar it was declared at | bar for a sentence |
|---|---|---|---|
| light | 4.75:1 | 3.0 ✓ | 4.5 ✓ |
| **dark** | **3.87:1** | 3.0 ✓ | **4.5 ✗** |

A paragraph of amber on the dark page ground, under the text threshold, shipped behind a comment explaining why it was fine.

**Nothing in the pipeline was going to catch it.** `check-contrast.mjs` verifies every *declared* pairing against the context it was declared in — and this pairing is declared, and passing. What it cannot see is a component using a token in a **different context** from the one it was declared for. The gate checks the token layer's claims, not a stylesheet's use of them.

The fix gives each token the job it was declared for: `mobility.surge` marks the note as a hairline down the reading-start edge, and the words are `text.secondary`, gated at 4.5 and passing everywhere. This is decision 008's sentence arriving a third time — *status colour and status text are two jobs*. [023](../../../../decisions/023-the-error-semantic-is-two-tokens.md) needed a new token to say it; here the token was already right and only its use was wrong.

## Properties exposed

`value` · `name` · `checked` · `vehicle` · `rideType` · `eta` · `fare` · `fareBasis` · `surgeNote` · `capacity` · `onChange` · `disabled`

Plus `RideCardGroup`: `label` (required) · `value` · `onChange` · `name` · `children`.

**Every number arrives already formatted.** `eta`, `fare` and `capacity` are nodes, not numbers, and that is an API decision rather than laziness: v0 writes `etaMinutes + ' min away'` and `seats + ' seats'` with a hand-written special case for `1 seat` — a two-category plural rule in a product that ships a language with **six**, including a dual. §4 puts every number behind one formatting boundary; these props take what it produced.

Likewise `rideType` is a node rather than a key. v0 holds a `RIDE_TYPE_LABELS` map and falls back to the raw key, so an unrecognised tier renders as `economy` in the middle of a translated interface.

## Constraints

- **No nested interactive content, ever.** It is a radio.
- **No click handler on the card.** The label forwards activation to the input, which is what makes the keyboard work.
- No width, no fixed height, no `className`, no `style`.
- No numbers, and no prop that shortens a string.
- No colour used outside the context it was declared in — see above.
- One written number: the 1px control edge, for the third time in the library. Still no border-width scale.

## Accessibility guaranteed

- A real `<input type="radio">` in a `<label>`, so the group is one tab stop with arrow-key movement.
- A real `<fieldset>` and `<legend>` — v0 has neither, so its question exists on screen as a heading and not in the accessibility tree.
- The surge note is linked with `aria-describedby`, so a rider is told an option is surging **while they are on it**.
- `disabled` uses the real attribute, so arrow keys skip an option nobody can book.
- The focus indicator is drawn on the **card** from the hidden input's `:focus-visible`, so the visible ring matches the thing that actually has focus.
- **0 axe violations across all six stories**, checked in dark + Move + RTL.

## RTL behaviour

Logical throughout. The rows are flex with `space-between` — which names an axis, not a side — and the surge mark is a `border-inline-start`, so it moves to the right in Arabic with no rule mentioning either edge.

The fare carries `unicode-bidi: isolate`, the CSS equivalent of the `<bdi>` §3 asks for, because a formatted amount is the one run in this card guaranteed to be opposite-direction in Arabic.

There is no `[dir='rtl']` selector anywhere.

## What is owed

~~**The focus indicator is duplicated for the third time.**~~ **Extracted.** It now lives once, in [`../styles/focus.css`](../styles/focus.css), reached by the `mz-focus-ring-within` class — the variant for an element that shows focus taken by a *descendant*. That variant exists because of this component: the real focus lands on a radio that is visually hidden inside the card, so the ring has to be drawn on the card. It got a name rather than an exception, because it is the correct construction for any control whose focusable element is not the thing a user sees.

**`RideCardGroup` has no contract.** The contract generator takes one props type per file, and this file exports two. The group is documented here and in the stories, but nothing machine-checks its API. The honest fix is either a second source file or a generator that handles more than one exported props type, and neither is this component's to decide.

## How we would deprecate it

Withdrawn only by a decision naming what replaces it. A prop goes first: `@deprecated` in the source with the replacement named in the tag — which the contract derives — kept for one minor version, then removed in a major one with the migration written down.

`fareBasis` is the likeliest to move. If a third basis appears it becomes a new member of the union, never a sibling prop.
