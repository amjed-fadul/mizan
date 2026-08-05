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
| Busy indicator | `span.mz-button__busy` | `loading` | `aria-hidden`. Shares the stack cell with the content. Rotates at `cycle.spin`, on `easing.continuous`, and keeps rotating under reduced motion. |
| Focus indicator | — | `:focus-visible` | Three bands, two tones, painted outside the border box. Never transitions — it appears on the frame focus lands. |

**The stack is the load-bearing part.** Content and indicator occupy the same grid cell, so the control's inline size is `max(label, indicator)` in both states, which is the label. That is the entire mechanism by which a loading button does not resize: nothing is measured in JavaScript, nothing is pinned, and there is no `min-width` set from a previous render. The label is hidden by `opacity: 0` rather than removed, which keeps its box *and* keeps it in the accessibility tree — the button holds its accessible name for the whole of the busy state.

There is no wrapper element outside the `<button>` and there will not be one. A control that renders a `<div>` around itself cannot be placed in a flex row, a grid cell or an inline run without the parent discovering the wrapper. It is also what keeps the press feedback honest: the scale is applied to the control itself, so what shrinks under the finger is exactly the thing that was pressed, rather than a box drawn around it.

---

## Responsibilities

**What Button owns:**

- Rendering a real `<button>` with an explicit `type` attribute.
- Its own visual states — rest, hover, press, focus, busy, disabled — drawn only from declared tokens, and its own motion between them, timed and curved only from declared tokens.
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
| `secondary` *(default)* | none | `text.primary` | `border.control`, `stroke.100` | `surface.sunken` ground |
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

### Product density: landed

`size` names the **step**; the product mode decides what the step resolves to. That is 020's fourth judgment, and [decision 022](../../../../decisions/022-control-geometry-resolves-by-product.md) implemented it — `content/tokens/semantic/control.json` carries fifteen control-geometry semantics and both product mode files state all fifteen, six of them differing.

| step | Market | Move |
|---|---|---|
| `sm` | 12/8 padding, 13px, floors 32/40 | **identical, on purpose** |
| `md` | 16/12 padding, 14px | 24/16 padding, 16px |
| `lg` | 24/16 padding, 16px | 32/20 padding, 18px |

Market's values are byte-for-byte what shipped before 022, so nothing in Market moved; everything that moved, moved in Move.

Two things follow that a reader implementing from the product brief would get wrong:

- **Move is not the smaller of the two.** `.mv-action` is 17px type with 14px/22px padding against `.mk-btn--md`'s 15px with 10px/18px — Move's single button is *larger* than Market's medium and lands on Market's large. Move is compact in how much it puts on a screen and generous in the one thing you have to hit at a curb with one thumb. "Move's `md` is smaller than Market's `md`" is the wrong rule and it is encoded nowhere — not in this component, and not in the mode files 022 wrote.
- **A `density` prop is not the workaround.** It would push the choice onto every call site and let a Market screen ask for Move's geometry, which is the drift the mode system exists to prevent.

There is no `[data-product]` selector in this component and no product named anywhere in it. A control that had to know which product it was in to size itself would be the crack 007 exists to prevent, and it would arrive looking like one small conditional.

---

## States

| State | Trigger | What changes | What does not | Motion |
|---|---|---|---|---|
| Rest | — | — | — | — |
| Hover | pointer, and only when enabled and not busy | `primary` takes `action.primary-hover`; `secondary` and `ghost` take a `surface.sunken` ground | size, position, shape | `background-color`, `duration.100`, `easing.entrance` — **only on a device with a real hover** |
| Press | `:active`, and only when enabled and not busy | `transform: scale(0.97)` | colour, size in layout, position, shape | `transform`, `duration.100`, `easing.entrance`. Removed under reduced motion |
| Focus | `:focus-visible` | the three-band indicator appears outside the border box | size, position, shape | **none, deliberately** |
| Busy | `loading` | `aria-busy`, `aria-disabled`, activation blocked, content at `opacity: 0`, indicator shown | **size**, accessible name, focusability, variant colours | the indicator rotates: `cycle.spin`, `easing.continuous`, `infinite` |
| Disabled | `disabled` | the platform attribute; all three variants collapse to `surface.sunken` + `text.secondary`, edge transparent | size | none — a disabled control matches neither the hover nor the press selector |
| Busy **and** disabled | both | disabled wins the paint; both attributes are set | — | the indicator still rotates |

**No state changes the size of the control.** That is one rule with four consequences: the focus indicator paints outside the border box rather than as a border, the busy indicator shares the label's grid cell rather than taking a column, hover changes colour only, and the press is a `transform` rather than a padding change. A transform is drawn after layout — it changes what the pixels look like and not what the box measures — so a pressed button occupies exactly the space it occupied at rest and nothing beside it moves. A control that grows at the moment it is being pointed at, or that nudges its neighbours at the moment it is pressed, is a different defect from the one each of those mechanisms was chosen to avoid, and it is worse than all of them.

**The press is the state that most decides whether the control feels like it heard you.** It is also the one v0 never had: none of `.btn`, `.market-btn`, `.mk-btn` or `.mv-action` has an `:active` rule, so all four of them are visually identical between pointer-down and pointer-up. On a touch screen that is the whole gap — there is no hover to have said anything first, and the press is the only acknowledgement available before the action resolves.

**Only `transform` and `background-color` are ever transitioned, and both lists name their properties.** `transition: all` appears nowhere and must not: it is the declaration that animates whatever property is added next without anybody choosing to. Nothing that could cause a layout is in either list. `background-color` is the one property in the file that is neither `transform` nor `opacity`, and it is there because [decision 010](../../../../decisions/010-contrast-is-a-token-layer-guarantee.md) rules out the alternative — a translucent overlay faded with `opacity` would render a hover colour no token declares, which is the same defect the disabled state was rebuilt to avoid. A paint on the control's own box cannot reflow anything, so the cost is bounded and named.

**No state uses `opacity` to produce a colour.** v0 carries `opacity: 0.5` on the disabled button in all three stylesheets, which renders a foreground no token declares and therefore a contrast ratio `check:contrast` cannot see. The disabled state here is a declared pair — `text.secondary` on `surface.sunken`, gated at the full 4.5 text threshold — and the busy state's `opacity: 0` renders no foreground at all, so there is no pairing to declare.

### Motion

Every duration, cycle length and curve below resolves from `content/tokens/primitive/motion.json` — not one of them is written down here. The note this section replaces said there were no state transitions *because there was no motion scale*, and the scale now exists. (The one number this section does write is `0.97`, which is a ratio rather than a timing, and it is accounted for in Constraints with the other gaps.)

**The instant tier, for everything a hand triggers.** `duration.100`. The token layer names hover, press and focus as exactly what that tier is for, and puts the line at roughly 160ms — past it, a change stops reading as a consequence of the input and starts reading as a response to it.

**A strong ease-out, for the same reason twice.** `easing.entrance`. A press wants most of its movement done before the eye finds it; `easing.move` is eased at both ends and its slow start is a delay on the leading edge of an answer to a finger, and `easing.exit` accelerates away, which is the one shape a press must never have. The hover colour takes the same curve because at 100ms the shape of a curve is not perceptible and two curves would imply a distinction nobody can see.

> **One naming tension, recorded rather than worked around.** A press is not an arrival, and `easing.entrance` is named for the motion it describes. It is used here because it is the only strong ease-out in the scale and the curve is the right curve; what is missing is a name for it. If a second component reaches for the same curve on a state that is also not an arrival, the scale wants a fifth name and this component is the first evidence for it. That is a token-layer decision and it is not taken here.

**The rotation is the exception to "never linear", and the exception is the rule restated.** `easing.continuous`, which resolves to `cubic-bezier(0, 0, 1, 1)` — the definition of the `linear` keyword rather than an approximation of it. A curve describes the shape of a change between two states; a rotation has no two states to be between, and an eased spinner visibly speeds up and slows down once per revolution, which reads as struggling rather than working. The token is named for the motion and not for the shape, so using it on a transition means writing a word that is false about a transition. That is the cheapest guard the naming layer can offer, and it is why the component writes `var(--easing-continuous)` rather than the keyword: a bare `linear` reads as no choice having been made.

**The cycle is 800ms, and 800 is a decision.** `cycle.spin`, not a duration tier — the length of an endless animation is a cycle, and every value in the duration ramp is the length of a change with a start and an end. It also matters that it is fast: a quicker rotation makes an identical wait *feel* shorter, and there is nothing to be won by a stately one. The floor is real too — below roughly 600ms a 2px ring stops reading as something rotating and starts reading as something flickering.

**The focus indicator does not transition, and that is a decision rather than an omission.** It appears on the frame the element takes focus. A ring that fades in is a ring that is not yet there while a keyboard user is deciding whether they moved.

**The hover transition is gated to `(hover: hover) and (pointer: fine)`.** A touch device fires hover on tap and leaves it applied after the finger has gone, so an ungated hover *animation* draws the eye to a state that is already false. Note precisely what is gated: the transition, not the hover rule. The sticky hover state itself belongs to the rule, it predates this section, and it is not fixed here — a change to when the hover *colour* applies is a change to the States table above and wants its own argument.

**The press does not break the focus indicator.** This was measured rather than assumed, because it is the kind of thing that is fine in one mechanism and broken in the other. Both mechanisms paint outside the border box and both are part of the element's own rendering, so a `transform` scales them along with the control: at `md`, the 8px outer extent becomes 7.76px and the 2px outline becomes 1.94px while the pointer is down, and both return on release. The indicator stays present, stays proportional, and keeps every ratio [decision 019](../../../../decisions/019-the-focus-indicator-is-two-tone.md) argued — those are colours, and a scale does not touch a colour. What it does not do is disappear, clip, or change shape, which are the three ways a transform is normally found to have broken a ring.

### Reduced motion — fewer and gentler, not zero

The blanket `animation-duration: 0.01ms !important` that circulates as the reduced-motion snippet is refused here. It is one statement about every animation on a page, and a user who sets the preference is not asking for an interface with no feedback in it — they are asking not to be moved. `duration.0` exists so that a component can remove movement one property at a time, and the token's own description says why: a global substitution decides nothing, because it cannot tell a slide from a spinner.

| Under `prefers-reduced-motion: reduce` | What happens | Why |
|---|---|---|
| Press scale | **removed** — `transform: none`, and the transition it rode on stated as `duration.0` | It is the only movement in the component and it is polish rather than information. Removing only the duration would leave the control still snapping to 97 per cent, which is a scale that merely happens instantly. |
| Hover colour transition | **kept**, at `duration.100` | It aids comprehension — it says which control the pointer is on — and nothing about it moves. |
| Focus indicator | unchanged | It never transitioned. |
| Busy indicator | **keeps rotating**, unchanged | Argued below. |

**Why the spinner keeps spinning.** Three reasons, in the order they decided it.

- **A busy indicator that stops indicating is a bug, not an accommodation.** The rotation is the state's only visible carrier. `aria-busy` carries it to assistive technology, but a sighted user with the preference set would be left looking at a static ring — indistinguishable from a decorative border on a control that has simply stopped responding, at the exact moment they are waiting to find out whether their press did anything.
- **The preference is about being moved, and a ring rotating about its own centre does not move.** Every point on it stays inside its own 16px box. There is no translation across the viewport, no parallax and no change of scale, which are the three things the vestibular case is actually about.
- **Every alternative costs a token that does not exist.** Slowing it needs a second `cycle` value. Swapping the rotation for an opacity pulse needs a `cycle.pulse` — the length of an endless animation is a cycle and not a duration tier, and reaching for `duration.500` to time a pulse is precisely the substitution `motion.json`'s second group was written to prevent. Neither token is invented here, so neither alternative is available, and the one that is available is also the right one.

**The cost, stated.** A reduced-motion user gets no press acknowledgement at all — the platform's own and nothing else. The fix is not a smaller scale, because a small movement is still movement; it is a non-motion cue, and the only honest one is a colour. There is no `action.pressed` ground in `content/tokens/` to draw it with, and inventing one would be designing a token backwards from a component. It is recorded in Constraints as the gap this section opened.

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

### What this component asked the token layer for

**One of them arrived.** The motion scale that this section used to report as missing is now `content/tokens/primitive/motion.json`. The busy indicator's `--duration-500` was a placeholder with no fallback, deliberately invalid at computed-value time so that the ring stayed static; it is now `cycle.spin` on `easing.continuous`, and it spins. The rest of the Motion section above is what the scale bought. Worth recording that the placeholder was also *wrong*, not merely unresolved: the length of an endless rotation is a cycle and not a transition tier, so the name it had named a value from the wrong group.

**Three are still outstanding**, recorded here rather than invented, because inventing any of them would be a system decision taken inside one component.

- **No tap-target semantic.** 44 CSS px is a floor from WCAG, not from Mizan, and there is no `size.tap-target` to name it — so `md` takes the next spacing step that clears it, `space.600` at 48px, rather than composing 44 out of two steps. [Decision 022](../../../../decisions/022-control-geometry-resolves-by-product.md) argues why the floor is a check rather than a token, and `machinery/scripts/check-tap-target.mjs` is that check.
- **~~No border-width scale.~~ Landed.** `border.default` and `border.control` are still colours and not widths, but the width itself now has a name: [decision 026](../../../../decisions/026-the-stroke-scale.md) added `stroke.100` and `stroke.200`, and the control edge resolves from `stroke.100`. Decision 019 and `packages/tokens/docs/button.md` still describe the edge as 1px in prose and in their reference CSS, which remains the right value — 026 changed where the number comes from, not what it is.
- **No scale ramp, which is why `0.97` is now the only written number.** `dimension.json` holds a `space` ramp, a `radius` ramp and a `stroke` ramp, and all three are lengths; a fraction of a control's own size is not a length, so no step on any of them could carry the press scale even in principle. That is a stronger reason to stay a literal than the border width ever had — the edge was a length with no ramp, and [026](../../../../decisions/026-the-stroke-scale.md) built the ramp; this is not a length at all. A second component wanting a press scale is what turns it into a token, and the value it would carry is a ratio rather than a distance.
- **No `action.pressed` ground**, which is the gap the reduced-motion rules opened. A reduced-motion user gets no press acknowledgement, and the only non-motion cue available is a colour the token layer has not declared. It is a smaller gap than it sounds — it affects one state for users with one preference set — and it is the honest price of removing movement rather than shrinking it.

**One naming gap rather than a missing value:** `easing.entrance` is the right curve for the press and the wrong word for it. See the Motion section.

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
- **The press is a scale and not a translate**, which is an RTL decision as much as a motion one. A translate has a direction and every directional value in this component is derived; a scale is the one transform with no side, so the pressed control is identical under either `dir` with no rule of its own — the same reason the focus indicator needs none.
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
| Indicator band widths | `stroke.200` (outline), `space.25` (offset), `space.100` (shadow extent) |
| Inline padding | `space.150` / `space.200` / `space.300` |
| Block padding | `space.100` / `space.150` / `space.200` |
| Icon-to-label gap | `space.100` |
| Hit-target floors | `space.400`, `space.500`, `space.600` |
| Corner | `radius.100`; busy indicator `radius.full` |
| Label size | `font-size.200` / `.300` / `.400` |
| Weight, face, leading | `font-weight.medium`, `font-family.sans`, `line-height.tight` |
| Arabic face, leading, correction | `font-family.arabic`, `line-height.arabic-tight`, `font-size.arabic-scale` |
| Tracking | `letter-spacing.none` |
| Hover and press duration | `duration.100` |
| Hover and press curve | `easing.entrance` |
| Press duration under reduced motion | `duration.0` |
| Busy indicator cycle / curve | `cycle.spin` / `easing.continuous` |

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
