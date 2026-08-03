# Generation notes — the answer key

> **Do not read this before or during the Stage 1 audit.**
>
> This file records how Mizan v0 was built and what was deliberately planted in it. Reading it first turns the audit into a copying exercise. The audit is supposed to be an act of diagnosis, and its value — to the project and to anyone reading the case study — depends on the findings being discovered rather than transcribed.
>
> Read it afterwards, to check what the audit missed.

---

## Why this file exists

v0 was generated, not inherited from a real codebase ([Decision 004](../decisions/004-generate-v0-rather-than-fork.md)). That decision carries an obligation: a generated mess is only useful if it is *believable*, and believability is a claim that has to be checkable. This file is the record that makes it checkable.

The test applied throughout: **every defect must be traceable to a plausible decision by a reasonable person under a plausible constraint.** A defect without a story is a defect generated lazily, and the instruction was to regenerate rather than keep it.

## The fiction

Mizan Labs built **Mizan Market** first. Eighteen months later a second team started **Mizan Move** and copied Market's stylesheet as a starting point — *before* Market's visual refresh. Neither team did anything unreasonable. Each solved its own problems, on its own deadlines, without a shared owner.

## The four layers

v0 was built in four sequential passes, each committed separately, so the history reads as accretion rather than as a pile.

### Layer 1 — the ancestor (`src/shared/`)

One person, about 2023, working carefully with the knowledge they had. **This layer is deliberately coherent.** It should read as "fine, a bit dated" — not as a mess. The mess arrives from divergence, and divergence needs something to diverge from.

What it plants is *latent*: consistent and defensible in isolation, a problem at scale or in Arabic.

| Planted | Why it is defensible | Why it is a problem |
|---|---|---|
| Physical direction properties throughout | Nobody was thinking about RTL | Every one becomes a bug in Arabic |
| `letter-spacing: 0.01em` on `body` | Looks like tasteful typography in Latin | Arabic is cursive and joined; this breaks the joins |
| Latin-only font stack | The product was English-only | Arabic rendering falls to whatever the OS picks |
| `--gray-mid: #999999` for secondary text | Applied consistently, looks intentional | 2.85:1 on white — fails WCAG AA |
| No spacing scale, just 4px literals | A small team hadn't abstracted yet | Nothing anchors the next teams, so both drift |
| `Button` with a `type` prop | Reads naturally | Collides with the native attribute, which is never forwarded — every button silently renders as `type="submit"` |

The palette is eight flat, un-namespaced values. That incompleteness is load-bearing: it is *why* both teams later extended it in incompatible directions.

### Layer 2 — Market's drift (`src/market/`)

Two years of shipping under deadline. A visual refresh midway introduced `--color-neutral-*`, `--space-*`, and 6px radii — **and nobody removed the old scheme.** Both are live. New code uses the new names, old code the old, and `ProductCardPromo` uses both in the same file.

### Layer 3 — Move's drift (`src/move/`)

Move copied the ancestor pre-refresh, so it **never adopted Market's scheme and has never heard of it.** It kept some ancestor tokens verbatim and invented a third scheme (`--text-*`, `--gap-*`, `--mv-*`) for everything else, in ignorance of what Market was doing in parallel.

Move is also a genuinely different product. Some of its divergence is **legitimate product difference**, not drift — and separating the two is the audit's hardest job.

### Layer 4 — the crunch (the five screens)

A launch date moved up. One person spent two weeks touching whatever was in front of them, shipping fixes that worked. Not incompetent — *rushed*. Every change is the fastest thing that works, made by someone who knew better and had no time.

This layer landed unevenly across the screens, the way real crunch lands wherever the bugs were. Category and product detail were hit hardest; booking barely at all.

| Planted | The implied reason |
|---|---|
| Raw hex inline in `style={{}}` — `#2e2e2e`, `#767676`, `#eaeaea`, `#c0392b` | Someone needed a colour to look right and typed one. `#2e2e2e` is a **fourth** dark gray, bypassing all three token schemes. |
| Magic numbers — `7px`, `13px`, `18px`, `22px`, `26px` | Fit none of the three spacing rhythms. Nudged until it looked right. |
| Five `<div onClick>` used as buttons | Faster than restyling a real button. No `role`, no `tabIndex`, no keyboard handling. |
| Three `<button className="btn btn-cta">` | Markup copied from somewhere; the styles never came with it. `btn-cta` exists in no stylesheet, so these render unstyled. |
| Inline styles contradicting their own class | `.mk-card` with `style={{ borderRadius: '4px', padding: '13px' }}` — the class was close, the override was quicker than a new one. |
| A JSX block copied between screens with a small edit | Reuse would have meant refactoring the component. |
| Five abandoned TODOs | `// FIXME: hardcoded, move to config`, `// don't touch, breaks the layout`, and similar. They meant to come back. |

One visual defect emerged from this layer that was not specified: the quick-view overlay collides with the image placeholder text on the category screen. It was kept — an overlay landing on top of existing content is exactly what a rushed absolute-position fix produces, and it is a legitimate audit finding.

**Everything still works.** This is code that shipped. Every screen renders, every link navigates, the cart stepper, ride selection and trip status all respond. It is ugly, not broken — which is the harder and more realistic thing to be.

---

## The value inventory

### The gray problem

Three dark grays and four mid grays, across three naming schemes:

| Value | Name | Layer |
|---|---|---|
| `#333333` | `--gray-dark` | ancestor |
| `#2f2f2f` | `--color-neutral-900` | Market |
| `#343434` | `--text-primary` | Move |
| `#999999` | `--gray-mid` | ancestor |
| `#8e8e8e` | `--color-neutral-500` | Market |
| `#9b9b9b` | `--text-muted` | Move |
| `#6b6b6b` | `--text-secondary` | Move |

Near-identical pairs also exist for light surfaces (`#f5f5f5` / `#f2f2f2` / `#fafafa`), borders (`#dddddd` / `#dcdcdc` / `#e0e0e0`), and — the one most likely to be missed — **the brand itself** (`#2e7d5a` / `#2f8560`, and `#246247` / `#256b4d`).

**The trap:** not every near-identical pair should merge, and not every exact match should stay separate. Move reuses several ancestor tokens *verbatim* — those are the values genuinely worth re-merging. Meanwhile Market's `--price-current: #2f2f2f` and `--color-neutral-900: #2f2f2f` are the same hex expressing different intent, and merging them would be the mistake. Value coincidence is not semantic identity. That distinction is the whole of Stage 2.

### Three of everything

| Concern | Ancestor | Market | Move |
|---|---|---|---|
| Button API | `type` | `variant` | `kind` |
| Spacing rhythm | 4px literals | 8px tokens | 10px tokens + off-scale literals |
| Radius | 4px | 6px | 8px |
| Shadow | `0 1px 3px rgba(0,0,0,.12)` | `0 2px 6px rgba(0,0,0,.1)` | `0 1px 4px rgba(0,0,0,.16)` |
| Currency | — | `'AED ' + n.toFixed(2)` | `'from AED ' + Math.round(n)` |

### The most valuable single defect

**`StockStatus` and `TripStatus` share nothing.** Two teams solved the identical conceptual problem — show the state of a thing — and produced two unrelated implementations: different prop shapes, different map structures, different colour delivery (inline style vs. generated class name), different markup. Market's vocabulary runs in-stock → delivered; Move's runs searching → completed.

This sets up the hardest and most instructive question in the whole system: the concept is shared, the semantics are not. Answering it well is what separates a shared foundation from two design systems wearing a trench coat.

### Planted for the Arabic audit

- Currency built by concatenation in **three** places, which inverts wrongly in RTL.
- Western numerals hardcoded; no `Intl`, no locale awareness, no `<bdi>` anywhere.
- The global `letter-spacing`, which Move partially removed on two classes for unrelated aesthetic reasons — so the codebase is now inconsistent about a property that is not merely inconsistent but actively wrong for Arabic.
- `MapPlaceholder` with absolutely-positioned overlays using physical `left`/`right`: the surface must not mirror, the chrome must.

### Deliberately absent

No linting, formatting, tests, CI, strict mode, i18n, `dir` handling, focus styles, `aria-*`, or `alt` text. A codebase with those would not have these problems.

---

## What was checked before the audit

- Zero CSS logical properties, zero `aria-*`/`role`, zero `Intl`/`toLocaleString`, zero `<bdi>` across `src/`.
- The near-identical values are genuinely hard to distinguish on screen.
- Every planted defect has a story in the table above.
- Market and Move read as different teams' work rather than one theme with two accent colours.
