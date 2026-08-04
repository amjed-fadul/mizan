# Mizan v0 — design system audit

**Date:** 2026-08-04
**Scope:** `legacy/src` — Mizan Market and Mizan Move, 6 screens, 3 stylesheets, 12 components, 2,643 lines
**Audience:** product and engineering leadership at Mizan Labs

---

## 1. Executive summary

Market and Move share a company, a brand, and a stylesheet ancestor — and almost nothing else. Two years of independent work have produced **three competing token vocabularies, four spacing rhythms, four button implementations and 33 distinct colours**, of which 21 pairs are close enough that no user can tell them apart while every developer must choose between them daily.

The cost is not aesthetic. **Six screens currently fail basic accessibility**: 24 interactive elements cannot be reached by keyboard at all, which means a keyboard user cannot select a ride, remove a cart item, or filter the catalogue. Three call-to-action buttons — including "Buy Now" and "Call Driver" — reference a CSS class that does not exist and render as unstyled text. And the product already ships Arabic content into a hard-coded left-to-right layout with no Arabic font, which for a Gulf business is not a localisation gap but a live defect.

Doing nothing has a compounding cost. Every new screen picks one of three vocabularies, and the choice is arbitrary, so drift accelerates. My recommendation is to fix the foundation first — tokens and the accessibility floor — before either team builds anything new, and to explicitly **not** unify the things that are legitimately different between a grocery app and a ride-booking app.

---

## 2. Method and scope

All 21 source files under `legacy/src` plus `legacy/index.html` were examined. Contrast ratios were computed from the sRGB relative-luminance formula rather than estimated; colour similarity uses CIEDE2000 (D65/2°). Bidirectional rendering was traced through the Unicode bidirectional algorithm (UAX#9) per string rather than described in general terms.

Three parallel read-only passes covered design values and component APIs, Arabic/RTL readiness, and accessibility. The inventory sections below are mechanical and reproducible. **The recommendations in §7 and §8 are judgment and should be read as such.**

Not examined: build tooling, dependency health beyond the note in §4, backend contracts, analytics.

### Corrections, made 2026-08-04 by re-deriving the counts from `legacy/src`

Three of the numbers in the original did not reproduce. They are corrected in place; what changed is recorded here, because an audit that quietly restates its own figures is not evidence of anything.

- **Keyboard-unreachable elements: 30 → 24, across 4 of 6 screens rather than 5.** Method: every `onClick` in `legacy/src/**/*.tsx` (27 occurrences), minus real `<button>` elements, minus prop declarations, minus handlers passed *into* the three button components — leaving **6** `<div onClick>` code sites, all of them keyboard-inert. Each was then multiplied by the length of the array it is mapped over in the default state: `RideCard` × 4 `RIDE_OPTIONS`, the filter chip × 6 `FILTERS`, the quick-view overlay × 8 `PRODUCTS`, "Remove" × 4 `INITIAL_LINES`, and two unlooped sites ("Reset" on booking, "Report an issue" on trip) × 1. That is 4 + 6 + 8 + 4 + 1 + 1 = **24**. The 30 could not be reconstructed under any reading tried: not 6 code sites, not 14 (the worst single screen, `/market`), and not 28 (24 plus the four `cursor: pointer` badges on Product Detail that have no `onClick` at all and are therefore dead to mouse and keyboard alike).
- **Code sites: 8 → 6.** Same derivation. This is the number §8 sequences the work against, and it was the one worth getting right — the whole argument there is that the count of *defects* matters less than the count of *places*.
- **§3.4's claim that no newer radius reaches the screen.** `.mv-card` is 8px, unoverridden, and live. Detail in that section.

**Re-derived and standing:** §3.1's headline **33 distinct colour values** — the union of every hex literal in the three stylesheets (29) with the four that appear only in inline `style={{}}` and have no token anywhere (`#2e2e2e`, `#767676`, `#c0392b`, `#eaeaea`) is exactly 33. §3.6's **3 of 12 components never imported** — `ProductCard`, `ProductCardCompact` and `ProductCardPromo`, confirmed by grepping every import path against every component file. That figure matters because §3.4 above turns on which components are dead and which are not.

**Not re-derived, and therefore not vouched for here:** §3.1's 35-properties-to-28-values decomposition, the ΔE00 figures, the spacing rhythms in §3.2, the typography counts in §3.3, and §6's 129 pairings / 48 failures. They are unchanged because nothing contradicted them, which is not the same as having checked them.

---

## 3. Inventory

### 3.1 Colour

**33 distinct values.** 35 custom properties resolving to 28 values, across three `:root` blocks that share no property names — plus 4 values that exist only in inline `style={{}}` and have no token anywhere.

Six near-identical clusters. ΔE00 below 2.3 is the standard just-noticeable difference:

| Cluster | Values | Tightest pair | Roles |
|---|---|---|---|
| Hairline border | `#dddddd` `#dcdcdc` `#e0e0e0` `#eaeaea` | **0.23** | all four are "1px neutral border" |
| Primary text | `#333333` `#2f2f2f` `#343434` `#2e2e2e` | **0.32** | all four are "darkest text on white" |
| Muted text | `#999999` `#9b9b9b` `#8e8e8e` `#6b6b6b` `#767676` | **0.63** | secondary text, both products |
| Light surface | `#f5f5f5` `#f2f2f2` `#fafafa` `#eaeaea` `#e8ebee` | **0.62** | tinted panel on white |
| Brand green | `#2e7d5a` `#2f8560` | **2.90** | both are the primary CTA fill |
| Red | `#c62828` `#c0392b` `#cc3333` `#b3261e` | **2.63** | discount **and** destructive |

**21 colour pairs sit below the JND while serving the same role.**

The brand finding deserves emphasis: the gap between the two products' brand greens (2.90) is **roughly a third of the gap intended to signal a hover state** (9.23). The brand is less distinct from itself than a button is from its own hover.

Two tokens are declared and never used: `--red`, `--space-4`.

### 3.2 Spacing

**20 distinct values across four rhythms**, none shared by all three stylesheets:

| Rhythm | Values | Where |
|---|---|---|
| 4px literals, untokenised | 4, 8, 12, 16, 24 | `shared/styles.css` |
| `--space-1..4` tokens | 8, 16, 24, (32) | the `mk-` half of `market.css` |
| `--gap-sm/md/lg` tokens | 6, 10, 20 | `move.css` |
| **`7 / 13 / 26`, inline only** | 7, 13, 26 | every screen file, both products |

The fourth rhythm appears in **no stylesheet** — it exists only in inline styles and is the single largest source of inline spacing. `13px` appears 15 times inline and once in CSS.

Inside `market.css`, both Market rhythms are applied to the **same roles**: `.product-card` pads `12px` while `.mk-card` pads `var(--space-2)`; six such pairs exist. Nine of the twelve `--space-*` padding declarations mix a token axis with a literal axis.

### 3.3 Typography

One font stack, Latin-only. **12 distinct font sizes, 2 weights, 1 line-height ratio** plus four pixel line-heights used as vertical-centring hacks.

The same semantic role is sized differently per product:

| Role | Market | Move |
|---|---|---|
| Item title | 14 / 15px | 17px |
| Section title | 22px | 15px |
| Primary money | 16px | 17px |
| Small print | 13px | 11px |
| Button label | 14 / 15px | 17px |

**Four sizes serve "item title"; three serve "button label".** Twelve inline `fontSize` overrides exist; four of them restate the stylesheet value exactly and do nothing.

### 3.4 Radii and elevation

**Four radii, three of them for the same "card" role** — 4px, 6px, 8px across six card recipes, plus `50%` for the three circles. Every 6px card that actually renders is overridden back to 4px by an inline style, and so is one of the two 8px ones (`.mv-panel`, `TripScreen.tsx:43`, under a comment reading *don't touch, breaks the layout*).

**The exception is `.mv-card`, and it is the interesting one.** It is 8px, it carries no inline override, and `RideCard` — the component that applies it — is imported by `BookingScreen` and rendered four times on `/move`. So one card recipe genuinely renders at a radius no other card in either product uses, on the ride-selection screen, and it is the only place the newer radii reach the screen at all. The pattern is therefore not "the newer radii exist only in dead code": it is that **the inline override is applied wherever someone noticed and nowhere else**, which is a worse fact than uniform dead code, because the surviving 8px is indistinguishable from a deliberate choice.

**Three box-shadow recipes for one role**, one per stylesheet — plus a fourth treatment, a card with no shadow at all. Note that `0 2px 6px/0.10` is simultaneously Market's *hover* elevation for one card and its *resting* elevation for another: the same shadow means two different states depending on which card you're looking at.

### 3.5 Naming

**Seven custom-property conventions and five class conventions across three files.** `market.css` uses three property conventions and two class conventions; `move.css` the same. Aliases exist within files — `--price-current` is `--color-neutral-900`, `--eta` is `--accent`, `--fare` is `--text-primary`.

### 3.6 Components

12 components, of which **3 are never imported**. Their markup is instead hand-duplicated in the screens five times.

| Role | Implementations |
|---|---|
| Button | **4** — three components plus a dead CSS recipe |
| Product card | 3 components (all unused) + 5 inline copies |
| Money | 4 |
| Status label | 3 vocabularies for the same three keys |

The three button APIs contradict each other on every axis:

| | `Button` | `PrimaryButton` | `ActionButton` |
|---|---|---|---|
| Variant prop | `type` | `variant` | `kind` |
| Vocabulary | primary / secondary | primary / secondary / ghost | confirm / cancel / ghost |
| HTML `type` attr | **not set** | `"button"` | **not set** |

Nine CSS pairs are functionally identical; `.badge` and `.mv-chip` are **byte-identical across all seven declarations**.

---

## 4. Findings

Severity reflects user impact and the teams' ability to ship, not how much the code offends.

| # | Finding | Severity | Reach | Cost if unaddressed |
|---|---|---|---|---|
| 1 | **24 interactive elements are keyboard-unreachable.** Ride selection, cart removal and catalogue filtering are impossible without a mouse | **Critical** | 4 of 6 screens | Core tasks unavailable to keyboard and screen-reader users; legal exposure |
| 2 | **`.btn-cta` is defined in no stylesheet.** "Buy Now", "Add All to Cart", "Call Driver" render as unstyled text with no fill or border | **Critical** | 3 screens | The highest-intent action on the product page reads as the least important element beside it |
| 3 | **Arabic ships under `lang="en"` with no `dir` and no Arabic font** | **Critical** | 3 Market screens | Screen readers pronounce Arabic with English phonemes; rendering differs per OS |
| 4 | **Mixed Arabic/Latin strings scramble.** `شاي أحمر Lipton - 100 كيس` renders as `كيس Lipton - 100 شاي أحمر` — the pack count detaches from its unit and binds to the brand | **Critical** | catalogue-wide | Product information is factually wrong to an Arabic reader |
| 5 | **No `aria-live` anywhere.** Every state change is silent — including trip-status transitions on an active ride | **High** | 4 screens | A rider is never told their trip state changed |
| 6 | **Discount label at 1.03:1** — `#c0392b` on `#c62828` | **High** | 5 of 8 products | The discount is invisible on the screen that sells it |
| 7 | **`StockStatus` fails contrast on 5 of 7 states** (1.94–4.04:1) | **High** | 2 screens | Availability is the most decision-relevant fact on a grocery page |
| 8 | **Secondary text tier fails system-wide** (2.78–3.28:1) | **High** | all 6 screens | ~15 rules; affects every price, caption and meta line |
| 9 | **Every container border fails 1.4.11** (1.12–1.37:1) | **High** | all 6 screens | No control or region has a perceptible boundary |
| 10 | **Same product shows two different discounts** — `Math.floor` in one component, `Math.round` in five others (11% vs 12%) | **High** | catalogue | A pricing inconsistency users can screenshot |
| 11 | **Booking shows two fares for one ride** — the row labelled "Estimated fare" is the one *not* using estimate formatting ("from AED 38" vs "AED 38.0") | **High** | 1 screen | Erodes trust at the moment of commitment |
| 12 | **11 buttons have no handler, including "Checkout"** | **High** | 5 screens | Indistinguishable from working controls |
| 13 | **21 colour pairs below the JND serving the same role** | **Medium** | codebase-wide | Every new element is an arbitrary choice; drift compounds |
| 14 | **Four spacing rhythms**, one existing only inline | **Medium** | codebase-wide | No rhythm to conform to, so none is followed |
| 15 | **Text overlap** — "Quick view" prints directly over "IMG" | **Medium** | 8 tiles | Visibly broken on the main browse screen |
| 16 | **Product Detail has no `h1`; `h3` precedes `h2`** | **Medium** | 1 screen | No navigable structure on the deepest page |
| 17 | **Three mislabelled controls** — "Call Driver" sets trip status to `arriving` | **Medium** | 2 screens | Actions do not do what they say |
| 18 | **Three unused components carrying their own defects**, plus 5 dead CSS rules and 6 props never honoured | **Low** | — | Any future sweep must fix or delete them |
| 19 | **Known-vulnerable `react-router` 7.18.2** (two high-severity advisories) | **Low** | — | Not exploitable here — no RSC mode, never deployed — but it will raise alerts |

---

## 5. Cross-cutting: Arabic and RTL

**This is the most serious section of the audit, and the least visible from a screenshot.**

There is no direction mechanism of any kind. No `dir`, no locale, no string catalogue; every UI string is an English literal inline in JSX. **72 physical direction properties** exist and **zero logical properties**.

The trap is that fixing this is not one line. Setting `dir="rtl"` today would produce a layout *worse* than the current one, because the six flex containers would reorder while all 57 meaningful physical properties stayed put — trailing gaps become leading gaps, badges collide with their neighbours, the "Selected" marker on a ride card jumps in front of the vehicle name, and the map's ETA chip stays in the corner the map no longer occupies. **A half-flipped layout reads as more broken than an unflipped one.**

Three findings deserve naming individually:

- **`body { text-align: left }`** in the shared stylesheet, reinforced by 13 component-level repeats, is the single most damaging line in the codebase. It silently defeats any future `dir` change document-wide.
- **The bidi failures are created at the call site, not in the data.** Every Arabic product name renders correctly on its own. It is `product.name + ' - ' + product.size` that scrambles them. Seven of eight cards look right and one is wrong, which is exactly why this survives review.
- **Someone already hit the letter-spacing problem and settled it in the wrong place** — two Move components set `letter-spacing: normal` for Latin aesthetic reasons, while every Arabic product title in Market still carries the global `0.01em`. This is a rule decided inside a component instead of in the rule layer.

The map is the one surface the system does not own, and it is nowhere declared as such. Under RTL the surface would mirror and the chrome would not — the exact inverse of correct behaviour.

Currency has **four formats across 21 call sites** and no `Intl` anywhere, so there is no single place to make a decision about numeral system or currency placement. Arabic pluralisation is structurally impossible: countable phrases are built by English binary concatenation, and Arabic has six plural categories including a dual.

---

## 6. Cross-cutting: accessibility

**129 foreground/background pairings were computed. 48 fail.**

The critical finding is not contrast but **keyboard access**. Twenty-four elements use `<div onClick>` with no `tabIndex`, no `role` and no key handler. They are not in the tab order, `Enter` and `Space` do nothing, and a screen reader announces them as inert text. `tabIndex`, `role`, `onKeyDown`, `onKeyPress` and `onKeyUp` have **zero occurrences** in `legacy/src`, so this is uniform rather than patchy. Three of them are the *only* way to perform their task:

- `RideCard` is the ride selector — a keyboard user cannot change from the Economy default
- The cart's "Remove" is the only removal path, and the quantity stepper floors at 1
- The category filter chips are the only filtering mechanism

The constraint that shapes the fix: **this team has no accessibility specialist and no capacity to hire one.** That makes the location of each defect more important than its count. Most of the failures are concentrated:

- The failing colour tier is **5 custom properties**
- Every failing border is **4 custom properties**
- All 24 keyboard failures trace to **6 code sites**, the highest-count ones being single elements rendered in loops — three sites account for 18 of the 24
- Focus styles, `aria-live`, `alt` and `lang` are *absences* — zero occurrences, so there is no inconsistent prior art to reconcile

That is the encouraging part of this audit: the accessibility floor is mostly a token problem and a component problem, both of which a design system fixes structurally rather than screen by screen.

**What is already sound, stated explicitly:** every genuine button is a real `<button>` with correct keyboard operability and disabled handling. No `outline: none` exists anywhere, so default focus rings survive. Link text is meaningful throughout. Colour is genuinely redundant with text in every status component. Five of six screens have exactly one correct `h1`. Body text passes at 12.63:1.

---

## 7. Recommendations

### What to unify

- **The hairline border.** Four values, tightest pair ΔE00 0.23, one role. One token.
- **The primary text colour.** Four values, all below the JND, all "darkest text on white". One token.
- **The brand green.** Two values for the same CTA fill, differing by less than a third of a hover delta. **One brand, one value** — this is a brand integrity issue, not a token cleanup.
- **The muted-text pair `#999999` / `#9b9b9b`** (ΔE00 0.63). Same role, two products, no reason.
- **The light-surface pair `#f5f5f5` / `#f2f2f2`** (ΔE00 0.62).
- **The spacing rhythm.** One scale. The `7/13/26` inline rhythm is deleted, not tokenised.
- **The button.** One component, one variant vocabulary, `type="button"` always set.
- **Currency and percentage formatting.** One implementation. Four currency formats and six percentage formats across 21 sites is the reason §4 findings 10 and 11 exist.

### What to keep separate — and why

This is the section that matters most, because the obvious move is to merge everything that looks alike, and that would be wrong.

- **`--discount` (`#c62828`) and `--safety` (`#b3261e`) stay separate.** ΔE00 4.21 — close enough that a merge looks tempting. But one means "this costs less" and the other means "this cancels your trip." **Value coincidence is not semantic identity.** Merging them would make it impossible to restyle destructive actions without restyling every discount badge in the catalogue.
- **`--stock-low` (`#e08a00`) and `--surge` (`#d97706`) stay separate.** Same visual role, ΔE00 6.71 — genuinely different values already. One is "we're running out", the other is "this costs more right now." They should remain independently tunable.
- **Market's `--color-neutral-700` (`#5a5a5a`) and Move's `--text-secondary` (`#6b6b6b`) stay separate.** ΔE00 6.30 — these are *not* near-identical. Market is browsed on a sofa; Move is read at a curb in one glance. The lighter secondary text is a legitimate density decision, not drift. **Merging these would be the single most damaging "cleanup" available.**
- **The type scales stay separate at the semantic layer.** Move's 17px item title against Market's 14px is the same density argument. What unifies is the *scale*; what differs is which step each product uses.
- **`StockStatus` and `TripStatus` remain two components.** They share a concept and nothing else: in-stock→delivered versus searching→completed. What should be shared is the *structure* — one status primitive with a consistent shape, prop contract and fallback behaviour — with product-specific vocabularies on top. Sharing the vocabulary would force Move to model "shipped."
- **`ProductCard` and `RideCard` remain two components.** They look similar and behave differently: a ProductCard carries a quantity stepper and an add-to-cart action; a RideCard is a radio selection within a group. Interaction model and content responsibility are the boundary. Visual similarity is superficial.

### What to deprecate

- The three unimported card components. They are not a foundation to build on — they carry their own contrast failures, their own percentage arithmetic and their own stock vocabulary.
- `.market-btn` / `.market-btn-primary` — a fourth button implementation with no component.
- The five dead CSS rules, including `.mk-card--promo .mk-card__title`, which can never match because the component emits a different class. Someone wrote it to fix a real problem and it never applied.
- `--red` and `--space-4`, declared and never referenced.
- The `7/13/26` inline rhythm, in its entirety.

### What not to touch

- **The two products' distinct densities and moods.** A system that makes Market and Move look identical has failed even if it is perfectly consistent.
- **Move's blue and Market's green as product accents.** These are legitimately different products.
- **The screens themselves, for now.** Fixing screens before the foundation means fixing them twice.
- **The `react-router` version.** The advisory is real but not exploitable here, and downgrading to an unsupported release is worse engineering than documenting it.

---

## 8. Priorities and sequencing

Constrained by four to six hours a week and two product teams with limited engineering capacity. A plan that ignores that is not a plan.

**First — the accessibility floor and the token foundation, together.** They are the same work. Five custom properties fix the failing text tier; four fix every border. Doing tokens *without* fixing contrast means encoding the failures into the new system permanently. This is the one sequencing mistake that cannot be undone cheaply.

**Second — the keyboard failures.** Six code sites, three of which block a core task outright — ride selection, cart removal and catalogue filtering, 14 of the 24 broken targets between them. Highest user impact per hour of any work in this audit.

**Third — the RTL rule layer, before any new screen is built.** Not the migration — the *rules*, and the lint that enforces them. Every screen built between now and then adds physical properties to undo. The migration itself is mechanical and can follow.

**Fourth — one button, one card structure, one money formatter.** This is where the two teams' work converges, so it needs the most agreement and should not be first.

**Last — the screen-level cleanup.** The 22 inline colour overrides and the `7/13/26` rhythm can only be removed once there is something to replace them with.

Explicitly deferred: visual redesign of either product. Nothing in this audit requires it, and conflating "make it consistent" with "make it new" is how design system work loses its sponsor.

---

## 9. Open questions for Stage 2

These surfaced here but cannot be settled by an audit. Each becomes a Decision Log entry.

1. **Shared concepts as modes, or product-namespaced tokens?** `action.primary` needs to exist for both products; `mobility.eta` has no Market counterpart. The answer is probably both mechanisms, and the boundary between them is the most consequential architectural call in the project.
2. **Does `--surface` at ΔE00 1.00 from pure white earn its place?** It is barely a surface. Either it becomes perceptible or it is deleted.
3. **Arabic-Indic or Western numerals** — and plausibly a different answer for prices, ETAs and quantities.
4. **Currency format** — symbol position, decimal separator and numeral system are not independent decisions.
5. **Is the Arabic type scale a mode of the Latin scale, or a parallel scale?** This depends on question 1 and should not be settled before it.
6. **What is the status primitive's contract?** Specifically, how a product declares its own vocabulary without the core needing to know about it.
7. **Where does the density difference live?** If Market and Move genuinely need different type steps for the same role, is that a mode, a separate scale, or a component-level decision?

---

*Inventory gathered by three independent read-only passes over `legacy/src`; contrast computed rather than estimated; bidi traced per string through UAX#9. Severity, the unify/separate calls in §7 and the sequencing in §8 are judgment.*
