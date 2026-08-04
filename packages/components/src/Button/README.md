# Button — the API spec

**Status:** shipped, Stage 4. **Decided by:** [decision 020](../../../../decisions/020-the-button-consolidation.md).

The component is one `<button>`. This document is the contract around it: what it is made of, what it takes responsibility for, what a designer may change, what a designer may not, and what would have to be true for it to be withdrawn.

It is written in the order every later component follows, and the order is not arbitrary. Anatomy and Responsibilities come first because they decide the rest — a part that is not in the anatomy has no properties, and a job the component has not taken cannot be configured. Constraints come after Properties because a refusal only means something once the reader knows what was granted. Deprecation comes last because a component that cannot state how it would be withdrawn is a component nobody can replace.

**What this proves** ([rule 7](../../../../CLAUDE.md)): that a component API can be specified as a set of guarantees and refusals rather than a list of props, and that the refusals can be traced — every "no" below ends at a deterministic check, an existing rule, or a Decision Log entry, and never at taste.

---

## Anatomy

```
┌─ button ───────────────────────────────────────────┐   ← the control
│                                                    │
│   ┌─ stack ────────────────────────────────────┐   │   ← one grid cell
│   │  ┌─ content ─────────────────────────────┐ │   │
│   │  │  [ icon ]  ·gap·  [ label ]           │ │   │   ← reading order
│   │  └───────────────────────────────────────┘ │   │
│   │  [ busy indicator ]                        │   │   ← same cell
│   └────────────────────────────────────────────┘   │
│                                                    │
└────────────────────────────────────────────────────┘
   ╎ ╎                                                    ← focus indicator,
   ╎ └ focus.ring          (2–4px, outline)                  outside the border
   └── focus.ring-contrast (0–2px and 4–8px, box-shadow)     box, three bands
```

| Part | Element | Present when | Notes |
|---|---|---|---|
| Control | `<button>` | always | A real one. See Accessibility. |
| Stack | `span.mz-button__stack` | always | One grid cell holding two occupants. It is what holds the size. |
| Content | `span.mz-button__content` | always | The flex row. Mirrors with `dir` on its own. |
| Icon | `span.mz-button__icon` | `icon` is passed | `aria-hidden`. Decorative by construction. |
| Label | `span.mz-button__label` | always | Carries the accessible name and the Arabic optical correction. |
| Busy indicator | `span.mz-button__busy` | `loading` | `aria-hidden`. Shares the stack cell with the content. |
| Focus indicator | — | `:focus-visible` | Three bands, two tones, painted outside the border box. |

**The stack is the load-bearing part.** Content and indicator occupy the same grid cell, so the control's inline size is `max(label, indicator)` in both states, which is the label. That is the entire mechanism by which a loading button does not resize: nothing is measured in JavaScript, nothing is pinned, and there is no `min-width` set from a previous render. The label is hidden by `opacity: 0` rather than removed, which keeps its box *and* keeps it in the accessibility tree — the button holds its accessible name for the whole of the busy state.

There is no wrapper element outside the `<button>` and there will not be one. A control that renders a `<div>` around itself cannot be placed in a flex row, a grid cell or an inline run without the parent discovering the wrapper.

---

## Responsibilities

**What Button owns:**

- Rendering a real `<button>` with an explicit `type` attribute.
- Its own visual states — rest, hover, focus, busy, disabled — drawn only from declared tokens.
- Its own hit target floor, and its own inline floor for short labels.
- Correct layout under any `dir` and correct type under any `lang`, without being told which.
- Blocking activation when it is busy or unavailable, and saying so to assistive technology.

**What Button does not own, and who does:**

| Not owned | Owner | Why not here |
|---|---|---|
| What the label says | the string catalogue | A component that authors a string authors content. The catalogue does not exist yet, which is exactly why Button must not start. |
| Which icon, and whether that icon mirrors | the icon set, via its own flag | §5: arrows mirror, maps and play triangles do not, and the default is *do not*. A button that mirrored what it was handed would mirror a "turn right" glyph in a Move screen. |
| Where the button sits, and how wide the row is | the parent layout | With one named exception, `fullWidth`. See Constraints. |
| What the colours are | `content/tokens/` | Rule 1. Button consumes; it never decides. |
| Whether the pairing is legible | `content/tokens/pairs.json` and `check:contrast` | [Decision 010](../../../../decisions/010-contrast-is-a-token-layer-guarantee.md). Contrast is a token-layer guarantee, gated by a script, and not a thing a component reviews. |
| What pressing it means | the call site | [Decision 020](../../../../decisions/020-the-button-consolidation.md), judgment 2. |

The line between the first list and the second is one question: **is this true of the control, or true of the situation the control is in?** That is 020's test, and it is the one to reach for when a later component is being specified.

---

## Variants

Three, and each one exists because it renders a foreground/background pairing that `pairs.json` declares. That is the constraint that decided the set — not taste, and not a survey of what other systems ship. An undeclared pairing is an unchecked pairing, so a variant the component cannot express in declared tokens is a variant it does not have.

| Variant | Fill | Label | Edge | Hover |
|---|---|---|---|---|
| `primary` | `action.primary` | `text.on-action` | none | `action.primary-hover` |
| `secondary` *(default)* | none | `text.primary` | `border.control`, 1px | `surface.sunken` ground |
| `ghost` | none | `text.primary` | none | `surface.sunken` ground |

**The default is `secondary`.** A `primary` is a claim that this is *the* action on the screen, and a default that makes that claim silently produces screens with four primary actions on them.

### Which differences are legitimate

The variants differ in **fill, label token and edge**. Those three are the whole permitted axis, and the reason is that each of them is a declared pairing that a script checks. Everything else is identical across all three: the same padding, the same radius, the same type size and weight, the same focus indicator, the same disabled appearance, the same hit target.

Three differences that would *not* be legitimate, named because each is the kind of thing that arrives as a small request:

- **A variant with different padding.** Geometry is `size`'s axis. A variant that is also a size means a call site can no longer set the two independently, and the first screen that needs a small primary discovers it.
- **A variant with a different type weight.** Weight carries emphasis, [decision 009](../../../../decisions/009-the-text-ramp-loses-a-tier.md) removed the third grey that used to, and letting a variant move it puts one signal on two axes.
- **A variant named after an action.** 020, judgment 2: `confirm` and `cancel` are the semantics of the action, not the appearance of the control, and a vocabulary that names verbs has to grow a term per feature until it is a list of the product's screens.

### What is not here

**No destructive variant.** The token layer has no action-danger semantic. `mobility.safety` is a namespaced Move token that a shared component may not reference under [007](../../../../decisions/007-modes-for-shared-namespaces-for-unique.md), and inventing `action.danger` to serve one v0 button would be designing a token backwards from a component. The cost is stated rather than hidden: a genuinely destructive action — delete account, cancel a ride with a driver en route — has no variant today, and the first team to need one is blocked until the semantic is decided and its pairing gated. 020 records the trigger for lifting it.

**No `confirm`, no `cancel`, no `kind`, no `type` as a variant name.** All four translate. See Code API mapping.

### Product density: decided and owed

`size` names the **step**; the product mode is meant to decide what the step resolves to. That is 020's fourth judgment and it is only half implemented, so it is stated here as a visible gap rather than left to be discovered:

> `content/tokens/modes/product.market.json` and `product.move.json` differ by **exactly three tokens, all colour** — `action.primary`, `action.primary-hover`, and the `text.secondary` slot selection. No spacing or control-geometry semantic resolves by product, and `dimension.json` holds a `space` ramp and a `radius` ramp with no semantic layer above them. **Both products' buttons are therefore the same size at the same step today.** That is a temporary regression against v0, and it is visible in the running app rather than hidden in a file.

Two things follow that a reader implementing from the product brief would get wrong:

- **Move is not the smaller of the two.** `.mv-action` is 17px type with 14px/22px padding against `.mk-btn--md`'s 15px with 10px/18px — Move's single button is *larger* than Market's medium and lands beside Market's large. Move is compact in how much it puts on a screen and generous in the one thing you have to hit at a curb with one thumb. "Move's `md` is smaller than Market's `md`" is the wrong rule, it is not encoded anywhere in this component, and it must not be written into the mode files when the density work lands.
- **A `density` prop is not the workaround.** It would push the choice onto every call site and let a Market screen ask for Move's geometry, which is the drift the mode system exists to prevent.

Until the tokens land, a Move screen that wants the geometry it had names the step at the call site — `size="lg"`, whose 54px of rendered height is within half a pixel of `.mv-action`'s 53.5.

---

## States

| State | Trigger | What changes | What does not |
|---|---|---|---|
| Rest | — | — | — |
| Hover | pointer, and only when enabled and not busy | `primary` takes `action.primary-hover`; `secondary` and `ghost` take a `surface.sunken` ground | size, position, shape |
| Focus | `:focus-visible` | the three-band indicator appears outside the border box | size, position, shape |
| Busy | `loading` | `aria-busy`, `aria-disabled`, activation blocked, content at `opacity: 0`, indicator shown | **size**, accessible name, focusability, variant colours |
| Disabled | `disabled` | the platform attribute; all three variants collapse to `surface.sunken` + `text.secondary`, edge transparent | size |
| Busy **and** disabled | both | disabled wins the paint; both attributes are set | — |

**No state changes the size of the control.** That is one rule with three consequences: the focus indicator paints outside the border box rather than as a border, the busy indicator shares the label's grid cell rather than taking a column, and hover changes colour only. A control that grows at the moment it is being pointed at or pressed is a different defect from the one each of those mechanisms was chosen to avoid, and it is worse than all of them.

**No state uses `opacity` to produce a colour.** v0 carries `opacity: 0.5` on the disabled button in all three stylesheets, which renders a foreground no token declares and therefore a contrast ratio `check:contrast` cannot see. The disabled state here is a declared pair — `text.secondary` on `surface.sunken`, gated at the full 4.5 text threshold — and the busy state's `opacity: 0` renders no foreground at all, so there is no pairing to declare.

**No state has a transition.** There is no motion scale in `content/tokens/`; see Constraints.

### What a busy button says

v0's `ActionButton` replaces its children with the hard-coded English string `'Please wait'`, in a product that ships Arabic. 020 hands the question here rather than inheriting the answer, so this spec decides it:

> **The label does not change.** Substituting a label means authoring a string; authoring a string needs the catalogue; `content/rules/rtl-arabic.md` records the catalogue as blocked on a content commitment rather than on a code decision. A component that starts authoring strings before the catalogue exists is a component that will have hard-coded English in it when the catalogue arrives.

So the label it was given remains the accessible name for the whole busy state, and the state travels on `aria-busy` — the one channel that is already localised, because the screen reader announces it in the user's language rather than in ours. The visible label is hidden behind the indicator; the announced one never changes.

The cost, stated: a sighted user sees an indicator where the words were, and gets no text confirmation of what is in flight. That is the normal pattern and it is still a cost. The alternative costs more, and it costs it in Arabic.

---

## Properties exposed

| Prop | Type | Default | What it means |
|---|---|---|---|
| `variant` | `'primary' \| 'secondary' \| 'ghost'` | `'secondary'` | How the control looks. Never what pressing it means. |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | The step. `md` and `lg` guarantee 44×44. |
| `type` | `'button' \| 'submit' \| 'reset'` | `'button'` | The HTML attribute, always set explicitly. |
| `loading` | `boolean` | `false` | The action is in flight. |
| `icon` | `ReactNode` | — | Placed before the label in reading order. Decorative. |
| `fullWidth` | `boolean` | `false` | Fill the container's inline extent. |
| `disabled` | `boolean` | `false` | The action is not available. |
| `children` | `ReactNode` | *required* | The label. |
| `onClick` | `(e) => void` | — | Not called while busy or disabled. |

Nine props, and the list is closed — `ButtonProps` does not extend `ButtonHTMLAttributes`. That is a real cost and it is in Constraints rather than buried here.

`type` deserves its own line because it is the prop the consolidation was named for. v0's `shared/Button` spent the name on its variant, which had two consequences: seventeen of the twenty-five call sites render `type="submit"` by omission — never fired, because `legacy/src` contains no `<form>` at all, which is luck rather than design — and, the sharper half, **`shared/Button` cannot express a submit button at all.** The prop name did not merely risk confusion; it consumed a platform capability and left no way to ask for it back.

---

## Content designers control

- **The label.** Every word of it, in both languages, at any length. Nothing here truncates, abbreviates or shortens it, and the component grows to fit rather than clipping — vertically as well as horizontally, which is the axis that matters, because a control fitted to Latin ink cuts the tops off Arabic diacritics and a lost diacritic is a different word.
- **Whether there is an icon, and which one.** Its mirroring behaviour is the icon's own property.
- **Which of the three appearances carries the action**, and therefore where the emphasis on a screen sits.
- **Whether the action submits a form.**

That is the whole list, and the first item is doing most of the work. 020's judgment 2 moved weight out of colour and into words: `kind="cancel"` in v0 was red, and it becomes `variant="secondary"` *plus a label rewrite*, because "Cancel booking" against "Keep booking" is a clearer control than either colour makes it. That rewrite is design work at every migrated site, not a codemod, and it is the honest price of not having a destructive variant.

---

## Constraints — what may not be customised

Each refusal names what rejects it, so that none of them terminates in taste.

| Refused | What rejects it |
|---|---|
| **A width or a height.** No `width`, `height`, `minWidth`, `maxWidth`. | `content/rules/rtl-arabic.md` §6. Width is content plus padding with a floor from the token layer. "Add to cart" against أضف إلى السلة is 117 per cent and "Done" against تم is 39 — no per-component allowance covers both ends, and the prop that causes the failure is usually named `width` and sometimes named `size`. |
| **`className` and `style`.** | The token layer. Either one is an unreviewable escape from every guarantee below, and the first hardcoded value arriving through them is the same defect as an edited generated file. |
| **A colour, a radius, a padding or a font.** | Rule 1 and decision 010. Tokens are decided in `content/tokens/` and consumed by components, never the reverse. |
| **`maxChars`, `truncate`, a three-letter label.** | §2. Arabic has no abbreviations — السبت does not shorten, because its letters are joined and the first three of them are not a word. An API that shortens by character count is untranslatable by construction. |
| **A destructive or danger variant.** | 007 (`mobility.*` is not shared) and 020's judgment 3. Reopened by a genuinely destructive flow, not by a second request. |
| **An action-named variant.** | 020's judgment 2. |
| **A `density` prop.** | 020's judgment 4. Density is a mode, and a prop would let a call site name a product. |
| **`dangerouslySetInnerHTML`, a rendered-as-`<a>` escape, a polymorphic `as`.** | The Accessibility section. Every guarantee below is a guarantee about a `<button>`. |

**Two costs of the closed prop list, stated rather than glossed.**

The list has no `id`, no `name`, no `form`, no `aria-describedby`, no `ref`. A form that needs to associate a submit button with a `<form>` it is not nested inside cannot do it today, and a tooltip that needs to describe a button cannot point at it. Those are real gaps and they are *not* the same kind of refusal as the ones in the table — nothing rejects them on principle; they simply have not been needed yet. The route is an addition to this spec with a named use, reviewed like any other API change, not a `...rest` spread that opens all of them at once. A `...rest` would also silently re-admit `style`, `className` and `type`, which is how three of the refusals above would be undone by one convenience.

`fullWidth` is the one layout escape hatch in the API, and 020 keeps it while saying it is uneasy: unlike a wrong variant, a wrong `fullWidth` looks fine. It survives because v0 did not avoid the problem by omitting it — `.mv-action` is `display: block; width: 100%` unconditionally, so Move hardcoded the choice into a stylesheet where it looked like a fact. It is named as an escape hatch here so its spread can be measured. If it appears on a large share of call sites, layout has leaked into the control.

### Two tokens this component asked for and did not find

Both are recorded here rather than invented, because inventing either would be a system decision taken inside one component.

- **No motion scale.** `content/tokens/` has colour, dimension, elevation and typography, and nothing for duration or easing. So there are no state transitions, and the busy indicator does not spin: the animation names `--duration-500`, takes no fallback, and is therefore invalid at computed-value time. A static ring is the honest rendering of a system with no motion tokens, and the day a motion scale is declared it spins with no change to `Button.css`. **This blocks nothing except the polish of one state**, which is why it is a report rather than a refusal to ship.
- **No tap-target semantic and no border-width scale.** 44 CSS px is a floor from WCAG, not from Mizan, and there is no `size.tap-target` to name it — so `md` takes the next spacing step that clears it, `space.600` at 48px, rather than composing 44 out of two steps. The 1px control edge is the one number written rather than resolved in the whole stylesheet; `border.default` and `border.control` are colours, not widths, and both decision 019 and `packages/tokens/docs/button.md` describe the edge as 1px in prose and in their reference CSS.

One pairing this component renders is not yet in `pairs.json`: **`border.control` on `surface.sunken`**, produced by `secondary`'s hover ground meeting its own edge. It passes on the numbers — **3.83:1 in light and 3.84:1 in dark**, in all four combinations, against the 3.0 non-text bar — but an undeclared pairing is an unchecked one whether or not it currently passes, which is the whole argument of decision 010. It wants an entry, at context `ui`, and it is the one gap between what this component draws and what the gate can see.

The disabled pair, by contrast, is declared and gated, and its binding case is light Move at **4.76:1** against the 4.5 text threshold — 0.26 of headroom, which makes `text.secondary` in Move the value to watch if either end of that pair is ever softened.

---

## Accessibility guaranteed

Not a variant, not a prop, and not something a call site can switch off.

- **A real `<button>`.** Keyboard activation on Enter and Space, the disabled semantics, form association and focus behaviour all arrive from the platform. Each of them is something a `<div role="button">` gets subtly wrong, and the subtlety is the problem.
- **A visible focus indicator on every variant**, including `primary`. This is the case [decision 019](../../../../decisions/019-the-focus-indicator-is-two-tone.md) exists for: a single ring in `focus.ring` meets `action.primary` at 2.37:1 in light Market and 2.54:1 in light Move, against 1.4.11's 3.0. The indicator is three bands and two tones — `focus.ring-contrast` at 0–2px and 4–8px, `focus.ring` at 2–4px — so the light tone is what touches the world. Against `action.primary` that tone is 5.64:1 and 5.27:1 in light, 3.27:1 and 3.50:1 in dark; every ground meets a tone above 3.0 in all four mode combinations. The losing tone is declared in `pairs.json` and excepted with a stated reason, and **the exception is void the moment the light bands stop being drawn on both sides.** They are drawn on both sides here.
- **A hit target of at least 44×44 CSS px at `md` and `lg`.** `md`'s natural height is 43.5px, so the `min-block-size` is load-bearing rather than decorative — remove it and the control misses the bar by half a pixel. **`sm` does not clear it and is not meant to.** It clears WCAG 2.2 2.5.8 (Target Size Minimum, AA) at 32px of block size against a 24px bar, and it is available only where 2.5.8 itself grants an exception: inline within a run of text, or where an equivalent full-size control for the same action is on the same screen. `sm` is a step, not a product, and it is not "the small primary".
- **An inline floor as well as a block one**, because §6's contraction case is a real failure and not a hypothetical: تم sets 15.1px against "Done"'s 38.3, and a two-character label centred in a slab of brand colour reads as a label that failed to load rather than as a word.
- **`disabled` reaches assistive technology through the platform attribute**, not through an ARIA restatement of it.
- **`loading` does not.** A busy button keeps the real attribute off, stays focusable and keeps its accessible name: a control that disables itself mid-action throws focus to `<body>`, and a keyboard user loses their place at the moment they most need it. Activation is blocked in the handler instead, which covers Enter and Space too because a real `<button>` fires click for both.
- **The label is always the accessible name**, in every state including busy. `children` is required, so there is no unnamed-button case to get wrong.
- **The icon and the busy indicator are `aria-hidden`.** Neither is ever the name of anything.
- **No colour is the only carrier of a state.** Disabled changes the fill *and* the label token *and* the cursor *and* sets the attribute; busy changes the content *and* sets `aria-busy`.

**What checks these.** Contrast is checked by `npm run check:contrast` against `pairs.json`, in all four mode combinations, and it blocks. The a11y addon runs axe against every story on render, configured to fail rather than warn. Focus visibility, the hit-target floor and the no-resize guarantee are checked by the play functions on the `Loading` and `Disabled` stories, which measure the control in both states on the same element. What is left over — whether `sm` is being used where 2.5.8 exempts it — is judgment, and it is judgment at the call site rather than here, which is why this spec says where `sm` belongs instead of a script trying to.

---

## RTL behaviour

Every directional value in this component is derived. §6's test for a component is not "does it look mirrored" but **"is every directional value in it derived, or is one of them written down?"** — and one written-down value is all a half-flipped component takes.

- **No `[dir='rtl']` selector, anywhere.** The component never reads the direction and never branches on it.
- **The icon mirrors because the row is a flex row.** Icon first in reading order, `gap` between, and flex flips with `dir`. There is no second rule. v0's `.mk-btn__icon` used `margin-right: 6px`.
- **All spacing is logical** — `padding-inline`, `padding-block`, `min-inline-size`, `min-block-size`, `inline-size`.
- **The focus indicator mirrors for free.** Both `outline` and `box-shadow` follow the element's own `border-radius`, including logical corners, so nothing about the indicator has a side.
- **The busy indicator's rotation is not mirrored, and must not be.** Clockwise is clockwise in every locale — §5, the same reason a clock does not mirror.
- **Whether the icon's glyph mirrors is the icon's flag, never Button's.** A button that mirrored what it was handed would mirror a "turn right" glyph in a Move screen, and a turn-by-turn icon describes a physical manoeuvre rather than an interface direction. The default is *do not mirror*.
- **`letter-spacing` is `0` and is never overridden.** Arabic is cursive and joined; tracking breaks the joins and renders the text wrong rather than differently styled. There is one tracking token in the system and this is it. v0 applies a global `0.01em` that reaches every Arabic label, and `.mv-action` restates it on the button itself.
- **The Arabic face and leading arrive through `:lang(ar)`**, scoped to the subtree that sets the language rather than to `:root` — [decision 013](../../../../decisions/013-script-is-a-mode-not-a-parallel-scale.md), because an Arabic page contains Latin runs and an English page contains Arabic ones. `font-family.arabic`, and `line-height.arabic-tight` at 1.45 against Latin's 1.25.
- **The optical size correction is applied on the label, not on the control**, and that is arithmetic rather than style: in a `font-size` declaration `1em` is the *parent's* size, so applying `1.08` on the element that also sets the size would multiply the wrong number. The label is always inside whatever set the size, so the correction lands exactly once.
- **The height comes from padding and line-height, never from a fixed value**, and the label is allowed to wrap. إتمام الشراء paints 16.5px of ink against "Checkout"'s 12.0, and مُخفَّض reaches above the font's own declared ascent. A control sized to Latin ink clips the diacritics, and in Arabic a lost mark is a different word.
- **Mixed-direction content in a label is the caller's `<bdi>`.** The `ArabicRTL` story carries an order reference inside an Arabic label to show what it looks like when it is done, and what it would look like if it were not. Identifiers are reproduced glyph for glyph and never regrouped (§4).

---

## Code API mapping

### From v0

| v0 | Mizan | Mechanical? |
|---|---|---|
| `shared/Button` `type="primary"` | `variant="primary"` | yes |
| `shared/Button` `type="secondary"` | `variant="secondary"` | yes |
| `shared/Button` (no `type` attribute set) | `type="button"`, by default | yes, and it changes the rendered DOM |
| `market/PrimaryButton` `variant=…` | `variant=…` | yes |
| `market/PrimaryButton` `size=…`, `icon`, `fullWidth` | unchanged | yes |
| `move/ActionButton` `kind="confirm"` | `variant="primary"` | yes |
| `move/ActionButton` `kind="cancel"` | `variant="secondary"` **plus a label rewrite** | **no — design work at every site** |
| `move/ActionButton` `kind="ghost"` | `variant="ghost"` | yes |
| `move/ActionButton` `loading` | `loading`, without the `'Please wait'` substitution | yes |
| raw `<button className="btn btn-cta">` | `<Button variant="primary">` | yes, and it gains a fill it never had |
| `.market-btn` / `.market-btn-primary` | deleted, nothing replacing them | referenced by nothing |

Twenty-five call sites. The `cancel` row is the one that is not a codemod, and it is the price of judgment 3.

### To the platform

| Prop | HTML / ARIA |
|---|---|
| `type` | the `type` attribute, verbatim |
| `disabled` | the `disabled` attribute |
| `loading` | `aria-busy="true"` + `aria-disabled="true"`, and no `disabled` attribute |
| `children` | the accessible name, via the label element |
| `icon` | `aria-hidden="true"` |
| `onClick` | `click`, which a real `<button>` also fires for Enter and Space |

### To the token layer

Every value, and this is the table that has to keep matching `packages/tokens/docs/button.md`.

| Slot | Token |
|---|---|
| Filled background / hover | `action.primary` / `action.primary-hover` |
| Label on a filled background | `text.on-action` |
| Label on an unfilled background | `text.primary` |
| Control edge | `border.control` |
| Hover ground, unfilled variants | `surface.sunken` |
| Disabled fill / label | `surface.sunken` / `text.secondary` |
| Focus indicator | `focus.ring`, `focus.ring-contrast` |
| Indicator band widths | `space.25`, `space.100` |
| Inline padding | `space.150` / `space.200` / `space.300` |
| Block padding | `space.100` / `space.150` / `space.200` |
| Icon-to-label gap | `space.100` |
| Hit-target floors | `space.400`, `space.500`, `space.600` |
| Corner | `radius.100`; busy indicator `radius.full` |
| Label size | `font-size.200` / `.300` / `.400` |
| Weight, face, leading | `font-weight.medium`, `font-family.sans`, `line-height.tight` |
| Arabic face, leading, correction | `font-family.arabic`, `line-height.arabic-tight`, `font-size.arabic-scale` |
| Tracking | `letter-spacing.none` |
| Duration | **none — see Constraints** |

### To Figma

Not yet wired. When Code Connect lands, `variant`, `size`, `loading`, `disabled` and `fullWidth` are component properties and `icon` is an instance swap; `type` and `onClick` have no Figma counterpart and must not acquire one, because a design tool has no forms and no handlers and a property that exists on only one side is a property that drifts.

---

## How we would deprecate it

A component that cannot state how it would be withdrawn is a component nobody can replace, so this section is written now rather than when it is needed.

**What deprecation is not.** It is not deleting the export, and it is not a console warning added in a patch release. Both of those move the cost onto whoever happens to run the code next.

**The sequence.**

1. **A Decision Log entry first**, naming what replaces it and why, on the same terms as [020](../../../../decisions/020-the-button-consolidation.md) — with the cost of the migration counted in call sites before it is agreed to, not after.
2. **The replacement ships and is used**, on at least one real screen in each product. A deprecation announced before its replacement has been through a review gate is a deprecation that gets reversed.
3. **`@deprecated` on the export and on every affected prop**, with the replacement named in the tag. That is the only step an agent or an IDE can act on without reading prose, which is why it is a discrete step rather than something folded into the entry.
4. **A deterministic check**, because rule 4 applies to migrations as much as to tokens: a script that counts remaining call sites and reports the number is what turns "we are migrating" into a figure that can be looked at. It reports before it blocks.
5. **The check starts blocking** once the count is small enough that the remaining sites are known by name.
6. **Removal**, in one commit, with the entry from step 1 linked in the message.

**What can be deprecated without deprecating the component.** A prop, on the same six steps at smaller scale. `fullWidth` is the likeliest candidate and 020 says why — if it spreads past the bottom-anchored mobile CTA it exists for, layout has leaked into the control and the parent should own it through a layout component instead. A prop removal is a major change to this spec and a minor one to the library.

**What would trigger it.** Three things, and none of them is "a better button exists":

- **The variant vocabulary needs a fourth purely visual term and the honest name for it is a verb.** That is 020's central argument meeting its counter-example, and the entry says to reread it rather than defend it.
- **A call site needs to name a product** — the equivalent of `size="move-md"`. Density would have failed as a mode, which is the first crack in 007's guarantee that components stay product-agnostic, and the component's whole size axis would need respecifying.
- **The platform makes a guarantee here obsolete.** If `<button>` gains what this component adds, the component is a shim and shims are deprecated on purpose rather than kept out of habit.

**Who decides.** A human, at the review gate. Rule 5 — no agent deprecates a component, and no agent's output is what rejects another agent's. The scripts in step 4 and 5 are what make the decision checkable; they are not what makes it.
