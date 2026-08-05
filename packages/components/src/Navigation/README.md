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

## Responsibilities

**What `Navigation` owns:**

- Rendering the landmark — a real `<nav>` with an accessible name it refuses to be constructed without.
- Rendering the list that holds the destinations, and writing `role="list"` back on after the stylesheet removes the markers.
- The row's layout: it wraps, and the spacing between destinations is the list's `gap` rather than anything on an item.
- Whether the rule between destinations is drawn.

**What `NavigationItem` owns:**

- Rendering one destination as a real anchor with a real `href`.
- Carrying `aria-current="page"` when it is told it is the current one, and carrying no such attribute when it is not.
- Its own rest, hover and focus appearance, and the current-page appearance when the attribute is present.

**What neither owns, and who does:**

| Not owned | Owner | Why not here |
|---|---|---|
| **Which destination is current** | the consumer, through `current` | The component cannot know the address. Nothing here reads `location`, compares it to `href`, or matches a prefix — a prefix match is a judgment about a route shape, and it is the router's judgment. |
| Navigating | the application's router | It renders anchors. Following one is the platform's job or the router's, and Constraints says so. |
| What the labels say | the call site | Content designers control, below. |
| What the colours and the widths are | `content/tokens/` | Rule 1. Nothing in `Navigation.css` is a value. |
| The page's skip link | the page | A component that emitted one would emit several on a page with several navigations. |

**It is not a menu.** That is the one worth stating as a refusal rather than a boundary, because it is the mistake this component is most likely to be "corrected" into. A menu has an owner, an expanded state, roving focus and an escape key. This is a list of links, every one of which is a tab stop, and Accessibility guaranteed sets out why that is the right finding rather than a missing feature.

## Variants

**There are none. `separators` is configuration, and the distinction is worth the paragraph.**

Button's test is that a variant names a *legitimate difference* — a difference on one declared axis, expressible in tokens a check can see, with a name that says what the thing looks like rather than what it means. `variant="primary"` passes it: it names an appearance, it renders a pairing `pairs.json` declares, and a call site choosing it is making a claim about the screen.

`separators` fails it on every clause. It is a boolean, so it names nothing — `separators={false}` is not the name of a look. It renders identical DOM in both states: same elements, same attributes, same accessible name, same accessibility tree. What it changes is one box decoration on every item after the first, drawn from `border.default` at `stroke.100`. And no call site chooses it to say something; it is chosen because the bar sits in a place where the destinations need visually separating, which is a fact about the surrounding layout rather than about the navigation.

The merge argument above sharpens this. `ProductCard` and `RideCard` stayed separate because the two products' answers differed; Market's nav and Move's nav merged because all three matched. A variant here would have to name a difference between two navigations that is legitimate to hold in the vocabulary — and the whole finding of that section is that there is no such difference. The links differ. The thing does not. A variant vocabulary would be naming distinctions the merge just established do not exist.

**The cost of it being a boolean, stated.** A boolean cannot grow. If a second visual switch ever arrives, two booleans give four combinations of which some will be meaningless, and [020](../../../../decisions/020-the-button-consolidation.md)'s rule applies at that moment rather than after: one axis, one prop, and a new case is a new member of a union rather than a second boolean beside the first. The trigger for turning `separators` into a union is the second switch, not a preference for how the API reads.

## States

Four, and only one of them is a prop.

| State | Trigger | What changes | What does not |
|---|---|---|---|
| Rest | — | — | — |
| Hover | pointer over a link | colour lifts to `text.primary`; an underline appears, offset by `0.25em` | size, position, the row's layout |
| Focus | `:focus-visible` | the shared focus indicator, through `mz-focus-ring` | everything else |
| Current | `current` on the item | three signals — set out immediately below | the element: it stays an anchor, and stays a tab stop |

**Current and hover deliberately share a colour, and that is why current is never colour alone.** The hover state lifts `text.secondary` to `text.primary`; so does the current-page state. If colour were the whole of either, *"where I am"* and *"where my pointer is"* would be the same appearance — which is the second of the two arguments in the next section, and the reason the current item also carries weight and a rule.

**No press state.** There is no `:active` rule in `Navigation.css`. A press on a link is acknowledged by the platform and by the page changing; Button's press exists because a button's action may resolve slowly and invisibly, which is not the case here.

**No visited state**, deliberately. `:visited` on a navigation would colour destinations by browsing history rather than by position in the site, and its restricted style set cannot carry the weight or the rule the current state uses — so it could only ever be colour alone, which is the thing this component refuses.

**Only `color` transitions**, at `duration.100` on `easing.entrance`, and the property is named rather than `all`. Nothing in the component moves, which is why the reduced-motion block in the stylesheet is a comment recording that the question was asked: [021](../../../../decisions/021-the-motion-scale-and-where-a-spinner-does-not-go.md)'s terms are fewer and gentler rather than zero, and a 100ms colour crossfade is neither vestibular nor attention-grabbing.

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

## Content designers control

- **Every destination label**, in both languages, at any length. Nothing truncates, abbreviates or shortens one, and the row wraps rather than clipping — which is why the list is a wrapping flex row and not a grid, since §6 measures some Arabic strings at 117 per cent of their English counterparts and a bar that fits on one line in English is a bar that wraps in Arabic.
- **How many destinations there are.** The list is whatever is passed; nothing collapses the overflow into a "More" menu, and Constraints says why there is no submenu to collapse into.
- **The landmark's name**, through `label` — and this is the item that is easy to read as plumbing when it is content. It is the only string in this component that a sighted user never sees, so it is the only one that gets no proofreading from looking at the screen. It is written for a screen-reader user listening to a list of landmarks, and it needs translating like any other string. The two rules on it are above: required, and never containing the word "navigation".

**What a content designer does not control is which destination is current.** That is a fact about the address, it comes from the consumer through `current`, and it is not a label to be written.

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

### No APG widget pattern applies, and that is the finding

The ARIA Authoring Practices Guide has **no pattern for a site navigation made of links**. It has `menu` and `menubar`, and those are patterns for *application* menus — the File-Edit-View kind, where a control opens a list of commands, focus is roving, one arrow key moves between items, and Escape closes the thing.

Applying that here is a well-known over-application and it makes the navigation worse, specifically:

- It replaces Tab with arrow keys, so a user who has learned that links are reached by tabbing loses them.
- It announces destinations as menu items — commands to be invoked — when they are places to go. The user is told the wrong thing about what pressing Enter will do.
- It takes on an expanded/collapsed model this component does not have and, per Constraints, deliberately does not want.

So the correct semantics are the ones the component already renders and there is no third one: **a `<nav>` landmark with an accessible name, a list, and `aria-current="page"` on the current link.** That is not a reduced version of a pattern — it is the whole of what is specified for this, and the rest is the platform's.

This section says so out loud because "the APG has no pattern for it" reads like a gap in a review, and it is the opposite: adopting the menubar pattern here would be a downgrade with a spec citation attached to it, which is the hardest kind to argue back out of afterwards.

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

## Code API mapping

Six props across two components, and every one of them lands somewhere in the DOM. Nothing is held in state, and nothing is computed from anything the component reads for itself.

### `Navigation`

| Prop | Rendered as |
|---|---|
| `label` | `aria-label` on the `<nav>`, verbatim |
| `separators` | `.mz-nav--separators` on the `<nav>` when `true`; the class is absent when `false`, and no attribute or element changes either way |
| `children` | the contents of `ul.mz-nav__list`, which carries `role="list"` |

The `<ul>` is always rendered, and there is no element between the `<nav>` and it. `separators` puts its class on the landmark rather than on the list because the rule it draws is on the items, and the selector needs an ancestor to scope from — `.mz-nav--separators .mz-nav__item + .mz-nav__item`, which is why the first destination never has one.

### `NavigationItem`

| Prop | Rendered as |
|---|---|
| `href` | the `href` attribute on the `<a>`, verbatim — never rewritten, never prefixed |
| `current` | `aria-current="page"` when `true`; **the attribute is absent** when `false` |
| `children` | the link's content, and therefore its accessible name |

Each item is one `li.mz-nav__item` holding one `a.mz-nav__link`. The link also carries `mz-focus-ring`, the shared indicator from `../styles/focus.css` rather than anything this component draws. `Navigation.css` contains no focus rule at all, which is the point: the navigation cannot acquire a focus style of its own by accident, and [019](../../../../decisions/019-the-focus-indicator-is-two-tone.md)'s two-tone guarantee holds here without this component restating it.

**`current` is the only prop whose false case renders nothing**, and that is the decision, not an implementation detail: `aria-current="false"` is a stated claim rather than an absence. The reasoning is in *The current page is three signals*; what belongs here is the mechanical consequence — a consumer diffing the DOM sees the attribute appear and disappear rather than flip its value, and a selector written against `[aria-current]` is as correct as one written against `[aria-current='page']`. The stylesheet uses the second.

**The current-page appearance keys off the attribute, not off a class.** `.mz-nav__link[aria-current='page']` is the selector, so the visual state cannot drift out of step with the announced one — there is no way to render the styling without the semantics, because they are the same declaration.

### From v0

The mapping to what this replaces is not a prop table, because v0 has no component to map from: the row is inline markup copy-pasted into five screens, and the migration is deleting it. *What it replaces* is that table.

## How we would deprecate it

The last component of Stage 4, and the one most likely to **grow** rather than be withdrawn: a real product eventually wants a vertical arrangement, a submenu or a breadcrumb. Each is a decision about whether this gains a mode or a sibling is built — and [020](../../../../decisions/020-the-button-consolidation.md)'s rule applies either way: one axis, one prop, and a new case is a new member of a union rather than a second prop beside it.

## What is not here

**A breadcrumb** and **a hierarchical menu**, both named in `do_not_use_when` so that somebody told not to use this component is not left at a dead end. A breadcrumb needs an ordered list and its own separator rule; a tree needs expanded state.
