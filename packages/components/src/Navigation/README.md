# Navigation — the API spec

The way around a product — a `<nav>` landmark holding a list of destinations.

## What it replaces

A pipe-separated row of links, **copy-pasted into five screens**:

```tsx
<Link to="/">Home</Link> | <Link to="/market">Grocery</Link> |{' '}
<Link to="/market/cart">Cart</Link> | <Link to="/move">Mizan Move</Link>
```

| defect | scope |
|---|---|
| **No `<nav>` anywhere in the application** | zero landmarks in all of `legacy/src` — verified |
| **No `aria-current` anywhere** | zero, in all five copies |
| **The separator is a literal `\|`** | five copies |

None of those is cosmetic. Without the landmark a screen-reader user can neither jump to the navigation nor skip past it. Without `aria-current` the question *"where am I"* has no answer at all. And the pipe is wrong twice over: it is **content**, so it is announced; and it is a Unicode-**neutral** character, so under the bidirectional algorithm it reorders with its surroundings in Arabic rather than staying between two things.

## Why this is one component when the cards were two

[Decision 024](../../../../decisions/024-productcard-and-ridecard-stay-separate.md) refused to merge `ProductCard` and `RideCard`, and wrote down the test. This is the same test giving the opposite answer, which is the point of having a test rather than a preference:

| | ProductCard vs RideCard | Market nav vs Move nav |
|---|---|---|
| What element is it? | container vs **control** | landmark, **both** |
| How many tab stops? | several vs **one** | one per destination, **both** |
| Does the other product have the concept? | **no** — Market has no fares | **yes** — both need a way around |

Three matching answers, so one component. The links differ; the thing does not.

## Anatomy

```
┌ <nav aria-label> ─────────── the landmark v0 has nowhere ─┐
│  ┌ <ul role="list"> ── flex, wraps, gap ─────────────────┐│
│  │  <li><a>                       ← no aria-current      ││
│  │  <li><a aria-current="page">   ← weight + colour + rule││
│  │  <li><a>  │ ← border-inline-start when separators      ││
│  └────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## The current page is three signals

- `aria-current="page"` — the only one that reaches assistive technology.
- Colour lifts to `text.primary` and weight to medium.
- A `border-block-end` in `action.primary` under the label.

Colour alone would fail WCAG 1.4.1, **and** it would be indistinguishable from hover — the hover state uses the same two neutral tokens, so colour alone would make *"where I am"* and *"where my pointer is"* the same appearance.

**`page`, not `true`.** `aria-current` takes a token, and `page` is the one that means "this is the page you are on"; `true` is the generic fallback for a currency the vocabulary has no word for. A navigation always has the word.

**Absent, not `false`.** `aria-current="false"` is a stated claim that this is *not* the current page, repeated on every other destination — noise on a landmark whose whole job is to say where one thing is.

**The current item stays a link.** It is still somewhere a user can go — reloading is a real thing to want — and removing the link would take it out of the tab order, so the navigation would have a different number of stops depending on which page you are on.

## Properties exposed

**`Navigation`:** `label` (required) · `children` (required) · `separators`
**`NavigationItem`:** `href` (required) · `children` (required) · `current`

### `label` is required, and must not contain "navigation"

A page may hold more than one navigation landmark, and a screen-reader user listing the landmarks hears *"navigation, navigation, navigation"* unless each says which it is. The `TwoLandmarks` story is that case.

The role already says the word, so `label="Main navigation"` is announced as **"Main navigation navigation"**. Name it for what it is *for*: Main, Account, Footer.

## Constraints

- **No routing.** It renders anchors; what following one does belongs to whatever router the application has.
- **No orientation prop.** Both products' navigation is a horizontal row. A vertical arrangement changes which axis the separator and the current marker sit on, and that is a decision worth making with a real sidebar in front of it rather than in advance.
- **No dropdown, submenu or expandable section.** A hierarchy needs expanded state this does not have.
- **No skip link.** It belongs to the page, not to one landmark — a component that emitted one would emit several on a page with several navigations.
- No `className`, no `style`, no prop that shortens a label.
- **No written numbers.** The 1px separator and current-page rule were the **seventh** and last occurrence of the literal, and the count is what finally bought the scale: [decision 026](../../../../decisions/026-the-stroke-scale.md) added `stroke.100` and `stroke.200`, and both lines resolve from `stroke.100`.
- One value the token layer owes a name to: the `0.25em` underline offset, which is §2's Arabic rule and the second place in the library to write it after `ProductCard`.

## Accessibility guaranteed

- A real `<nav>` landmark — which v0 has **nowhere** — so for the first time the navigation can be jumped to and skipped past.
- An accessible name on every landmark.
- The destinations in a real list with `role="list"` written explicitly, so they are counted after `list-style: none` removes the markers. This is the **second** occurrence of that fix after [`List`](../List/README.md); both files record that the trigger for pulling it into one place is a third.
- Real anchors, so middle-click, copy-link, open-in-new-tab and the status-bar preview all work.
- **0 axe violations across all six stories**, checked in dark + RTL.

**What the consumer must still do** is in the contract's `accessibility.consumer_must` — tell it which destination is current, mark at most one, and provide the page's skip link.

## RTL behaviour

**This is the component where the inline axis actually matters.** Everything in `List` was block-axis, which `dir` does not touch. Here the row runs along the reading direction, the separator sits between items on that axis, and the current marker is drawn under them — three places a physical `left` or `right` would produce the half-flipped bar §1 says reads worse than one that never flipped.

Measured in an RTL page rather than assumed:

| | result |
|---|---|
| first destination | rightmost |
| `border-inline-start` | resolves to the **right** edge — 1px right, 0 left |
| current-page rule | `border-block-end`, stays underneath |

The hover underline declares `text-underline-offset`, because §2 records that Arabic carries dots below the baseline — ب, ي, ج all do — and a default underline is drawn straight through them. `text-decoration-skip-ink` is left at its initial `auto` and is deliberately **not relied on**: on an Arabic string it fires several times per word and delivers the link as four or five dashes with the dots in the gaps.

There is no `[dir='rtl']` selector anywhere.

## How we would deprecate it

The last component of Stage 4, and the one most likely to **grow** rather than be withdrawn: a real product eventually wants a vertical arrangement, a submenu or a breadcrumb. Each is a decision about whether this gains a mode or a sibling is built — and [020](../../../../decisions/020-the-button-consolidation.md)'s rule applies either way: one axis, one prop, and a new case is a new member of a union rather than a second prop beside it.

## What is not here

**A breadcrumb** and **a hierarchical menu**, both named in `do_not_use_when` so that somebody told not to use this component is not left at a dead end. A breadcrumb needs an ordered list and its own separator rule; a tree needs expanded state.
