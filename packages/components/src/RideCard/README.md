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

## Responsibilities

Two exports, and the split between them is the same one decision 024 makes between this component and `ProductCard`: **`RideCard` is a control, `RideCardGroup` is the container it lives in.** A control that also had to be a container would be back to arguing 024 from the other end.

**What `RideCard` owns:**

- Rendering one real `<input type="radio">` inside the `<label>` that draws it, and being the whole hit target for it.
- Its own visual states — rest, hover, checked, disabled, focus — drawn only from declared tokens, and its own transition between them, timed and curved only from declared tokens.
- Associating the surge note with the option via `aria-describedby`, so the note is part of what a rider hears while they are on the option rather than after it.
- Correct layout under any `dir`, without being told which.

**What `RideCardGroup` owns, and `RideCard` therefore does not:**

- The group's accessible name — a real `<fieldset>` and `<legend>`.
- The shared `name`, generated with `useId` when the call site does not give one. A card does not name its own group, because a card that named its own group could name it differently from its neighbour and become a group of one.
- Which option is checked. The group derives `checked` per card from its `value`, so the checked state is stated once for the set rather than once per card.
- The default `onChange` for its children — a card's own handler wins if it has one.
- The gap between options, and nothing else about how they are laid out.

Non-`RideCard` children pass through untouched, so a group may hold a separator or a message without the cloning throwing.

**What neither owns, and who does:**

| Not owned | Owner | Why not here |
|---|---|---|
| The words — tier names, the surge note, the group's question | the string catalogue | A component that authors a string authors content, and the catalogue does not exist yet. |
| Every number in the card — ETA, fare, capacity | the §4 formatting boundary | Six plural categories, a dual among them, and a currency whose symbol `Intl` places. See Properties exposed. |
| Which tiers exist, in what order, and whether one is available | the booking screen | `disabled` reports availability; nothing here decides it. |
| What choosing an option does next | the call site | `onChange` reports the `value`. It does not book a ride. |
| What the colours are, and whether the pairing is legible | `content/tokens/` and `pairs.json`, gated by `check:contrast` | Rule 1 and [decision 010](../../../../decisions/010-contrast-is-a-token-layer-guarantee.md). The surge note is what happens when a component reasons about a colour itself. |

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

## Variants

**None, and that is the finding rather than an omission.** All four ride tiers render the same card: the same padding, the same radius, the same edge, the same type ramp, the same states. A tier is content — `rideType` is a node the catalogue supplies — and a component that grew a variant per tier would need a new one the week Move adds a fifth.

The prop that looks like a variant is `fareBasis`, and it is worth working through rather than asserting, because Button's test cuts a different way here than it first appears.

**Button's test.** A variant names a legitimate difference in *look*; [decision 020](../../../../decisions/020-the-button-consolidation.md), judgment 2 refused `confirm` and `cancel` because those name the difference in *meaning* between two actions, and the appearance is a consequence of it. A vocabulary that names meanings has to grow a term per feature.

**Where `fareBasis` falls.** `'estimate'` and `'settled'` are unmistakably a difference in meaning: one fare is provisional and moves with traffic and demand, the other is fixed. So by the letter of 020 it is not a variant, and it is not typed as one — it renders as `data-basis` on the fare rather than as a class on the card. But the reason it survives where `cancel` did not is the second half of 020's argument, not the first: `cancel` was refused because the *appearance* it asked for was already available under an honest name, so the verb bought nothing. There is no honest name for "this price may change" in the appearance vocabulary, because it is not an appearance. It is a fact about the fare, and the fare is the thing it modifies — which is exactly where it is written.

So it is neither a variant nor a mistake. It is a **content qualifier**, and it belongs to the same family as `vehicle` and `eta`: a fact about this option that the card carries.

**The cost, stated.** Today `data-basis` is styled by nothing. `RideCard.css` has no `[data-basis]` rule, so an `'estimate'` fare and a `'settled'` fare are pixel-identical, and the prop is a hook that no display has been hung on yet. That is deliberate rather than unfinished: the honest way to say a fare is an estimate is a *word* — "Estimated", "from" — and a word is a string, and the catalogue that owns strings is recorded as blocked on a content commitment. A component that reached for a colour or an italic instead would be encoding a meaning in a paint precisely to avoid authoring the string, which is the substitution 008 and 023 both refuse. The attribute is in the DOM so that the display, when it is decided, is a stylesheet rule and a catalogue entry rather than an API change at every call site.

The default is `'estimate'`, because that is what every fare Move currently shows actually is. A rider who reads a provisional fare as fixed and is then charged more has been misled by the interface rather than by the price, and the default is what decides which of those happens on the screens nobody revisited.

## States

Five, and the first line of the table is the point: most of what a state *means* here is the platform's, and this component only paints it.

| State | Trigger | What changes | Whose it is |
|---|---|---|---|
| Rest | — | — | — |
| Hover | pointer, enabled only | edge takes `text.primary` | the paint is the component's; there is no hover in the radio |
| Checked | the input is `:checked` | edge takes `action.primary`, ground takes `surface.sunken` | **the platform's.** The DOM holds it; `:has()` reads it |
| Focus | the input's `:focus-visible` | the indicator appears, drawn on the **card** | the focus is the platform's; the relocation is the component's |
| Disabled | `disabled` | ground `surface.sunken`, label `text.secondary`, edge transparent, cursor `not-allowed` | the semantics are the attribute's; the paint is the component's |

**What the native input gives for free**, and what a `role="radio"` rebuild would owe: one tab stop for the whole group landing on the checked option, arrow-key movement that carries the selection with focus and wraps at the ends, Space checking the focused option, exactly one option checked at a time, `aria-checked` maintained without anybody setting it, and arrow keys skipping a disabled option. None of that is in this component's code. See the table above under *Why a real radio*.

**What the component adds** is four paints and one relocation. The relocation is the interesting one: focus lands on an input nobody can see, so the ring is drawn on the card through `mz-focus-ring-within` — the variant in `../styles/focus.css` for a control whose focusable element is not the thing a user looks at.

**Checked is never mirrored into React state.** The card styles itself from `:has(.mz-ride-card__input:checked)`, so the DOM stays the single source of truth and there is no class name that can disagree with the control. That is the payment for hiding the input with a clip-rect rather than replacing it.

**Checked and disabled together is reachable**, and the paint resolves rather than fighting: `:has()` carries the specificity of its argument, so the checked rule outweighs `.mz-ride-card--disabled` and keeps the `action.primary` edge, while the disabled rule sets the label colour and the cursor, which checked does not touch. Both rules set the same `surface.sunken` ground, so there is nothing to resolve there. A group whose `value` names an option that has since become unavailable therefore reads as *chosen and not bookable*, which is the true statement.

**There is no press state**, and unlike Button that is not a decision this component has argued. Button's `:active` scale exists because a press is the only acknowledgement a touch screen offers before the action resolves; here the answer arrives in the same frame — the card becomes checked — so the acknowledgement is the state change itself. The cost is that the gap between finger-down and the check is unmarked, and on a slow device that is a real perceptual gap. It is not paid for here because a `transform` on a card is a larger movement than a `transform` on a button, and the argument for it wants its own change.

**Motion.** One transition, on `border-color` and `background-color`, at `duration.100` on `easing.entrance` — the properties named rather than `all`, and neither of them able to cause a layout. Nothing is removed under `prefers-reduced-motion`: a border colour crossfading over 100ms is neither vestibular nor attention-grabbing, and decision 021's rule is fewer and gentler rather than zero. The stylesheet carries an empty reduced-motion block so the next reader knows the question was asked.

## Properties exposed

`value` · `name` · `checked` · `vehicle` · `rideType` · `eta` · `fare` · `fareBasis` · `surgeNote` · `capacity` · `onChange` · `disabled`

Plus `RideCardGroup`: `label` (required) · `value` · `onChange` · `name` · `children`.

**Every number arrives already formatted.** `eta`, `fare` and `capacity` are nodes, not numbers, and that is an API decision rather than laziness: v0 writes `etaMinutes + ' min away'` and `seats + ' seats'` with a hand-written special case for `1 seat` — a two-category plural rule in a product that ships a language with **six**, including a dual. §4 puts every number behind one formatting boundary; these props take what it produced.

Likewise `rideType` is a node rather than a key. v0 holds a `RIDE_TYPE_LABELS` map and falls back to the raw key, so an unrecognised tier renders as `economy` in the middle of a translated interface.

## Content designers control

Every word on this card, and nothing about how it is drawn. All six content props take a `ReactNode`, at any length, in either language — nothing here truncates, abbreviates, or shortens, and no prop offers to.

| What | Prop | What a designer decides |
|---|---|---|
| The question | `RideCardGroup` `label` | Required, and it is the group's accessible name as well as its heading. Not optional, because a rider hearing "Economy, radio button, 1 of 4" with no question attached is being asked to choose between four things they were not told the category of. |
| The tier | `rideType` | The name as the catalogue holds it, not a key. v0 falls back to the raw key, so an unrecognised tier reads as `economy` in the middle of a translated interface. |
| The vehicle | `vehicle` | As the rider will recognise it at the curb. Usually Latin in an Arabic interface, so it is the caller's `<bdi>`. |
| The ETA | `eta` | The whole phrase, already formatted — "3 min away", not `3`. |
| The fare | `fare` | The formatted amount, symbol placed by `Intl`. The card isolates it; it does not compose it. |
| The capacity | `capacity` | Optional. Omitted entirely when absent — the element is not rendered empty. |
| The surge note | `surgeNote` | Below. |

**The surge note is the one with rules, and they come from the defect above.**

- **It must be a sentence that carries its own meaning.** The amber is a hairline mark at the 1.4.11 indicator bar, not a highlighter — the words are `text.secondary`. If the note only works because it is amber, it does not work: it fails for a rider who cannot distinguish the mark, and it failed the 4.5 threshold in dark when the words themselves were amber.
- **It says why the fare is higher, not that the fare is higher.** The fare is already on the card and the rider can read it. *"Higher demand in your area right now"* is the shape — a cause, in the rider's language, from the catalogue.
- **It is read out attached to the option.** `aria-describedby` puts it in the announcement for the card a rider is currently on, so it has to make sense immediately after the tier name and the fare rather than as a caption to something above it.
- **It does not repeat the fare, and it is not a second fare.** Anything numeric in it is a number, and every number in this card comes through the §4 boundary. A multiplier written into a sentence is a number that skipped it.
- **Absent is a state.** No note renders no element and no `aria-describedby` — not an empty box, and not a permanent "no surge" reassurance nobody asked for.

## Constraints

- **No nested interactive content, ever.** It is a radio.
- **No click handler on the card.** The label forwards activation to the input, which is what makes the keyboard work.
- No width, no fixed height, no `className`, no `style`.
- No numbers, and no prop that shortens a string.
- No colour used outside the context it was declared in — see above.
- **No written numbers.** The 1px control edge was the third of seven occurrences and resolves from `stroke.100` since [decision 026](../../../../decisions/026-the-stroke-scale.md); the surge mark moved to `stroke.200` in the same change, having been drawn at `space.25` — the right width taken from the scale that measures gaps rather than ink.

## Accessibility guaranteed

- A real `<input type="radio">` in a `<label>`, so the group is one tab stop with arrow-key movement.
- A real `<fieldset>` and `<legend>` — v0 has neither, so its question exists on screen as a heading and not in the accessibility tree.
- The surge note is linked with `aria-describedby`, so a rider is told an option is surging **while they are on it**.
- `disabled` uses the real attribute, so arrow keys skip an option nobody can book.
- The focus indicator is drawn on the **card** from the hidden input's `:focus-visible`, so the visible ring matches the thing that actually has focus.
- **0 axe violations across all six stories**, checked in dark + Move + RTL.

**The pattern being implemented is the W3C ARIA Authoring Practices *Radio Group*.** It is worth naming the pattern and then naming who satisfies it, because almost none of it is satisfied here:

| What the pattern requires | Where it comes from |
|---|---|
| `radiogroup` role, with an accessible name | the `<fieldset>` and its `<legend>` — implicit `group`, named by the legend |
| `radio` role on each option, with an accessible name | the `<input type="radio">` and its `<label>` |
| `aria-checked` tracking the selection | the browser, from the input's checked state |
| One tab stop for the set, landing on the checked option — or the first, when none is checked | the browser, from the shared `name` |
| Arrow keys moving between options and moving the selection with focus, wrapping at the ends | the browser |
| Space checking the focused option | the browser |

Every row but the first two is the platform's, and the first two are markup rather than code. **Not one ARIA attribute is authored in this component** except `aria-describedby` on the surge note, which is the one thing the pattern does not cover.

The APG documents roving `tabindex` and `aria-activedescendant` for authors who *cannot* use native inputs. It does not recommend rebuilding what the platform provides, and this component is not in that position — nothing about a card's appearance requires giving up the input. v0 gave it up for a `<div onClick>` and the Stage 1 audit is the receipt.

## RTL behaviour

Logical throughout. The rows are flex with `space-between` — which names an axis, not a side — and the surge mark is a `border-inline-start`, so it moves to the right in Arabic with no rule mentioning either edge.

The fare carries `unicode-bidi: isolate`, the CSS equivalent of the `<bdi>` §3 asks for, because a formatted amount is the one run in this card guaranteed to be opposite-direction in Arabic.

There is no `[dir='rtl']` selector anywhere.

## Code API mapping

### `RideCard` to the DOM

| Prop | What it renders |
|---|---|
| `value` | the input's `value` attribute, and the argument `onChange` reports |
| `name` | the input's `name` attribute — the shared string that makes the set one group |
| `checked` | the input's `checked` property. Optional, so a standalone card — or one inside a `RideCardGroup` with no `value` — renders `checked={undefined}` and React treats the input as **uncontrolled**. Adding `value` to the group later switches it, which is React's controlled/uncontrolled warning. Pass `checked` or pass the group a `value` |
| `disabled` | the input's `disabled` **attribute**, plus `.mz-ride-card--disabled` on the label for the paint |
| `vehicle` | `span.mz-ride-card__vehicle` |
| `rideType` | `span.mz-ride-card__type` |
| `eta` | `span.mz-ride-card__eta` |
| `capacity` | `span.mz-ride-card__capacity`, **or no element at all** when absent |
| `fare` | `span.mz-ride-card__fare` |
| `fareBasis` | `data-basis` on the fare span. Nothing styles it yet — see Variants |
| `surgeNote` | `span.mz-ride-card__surge`, given an id, **and** `aria-describedby` on the input pointing at it. Both appear together or neither does |
| `onChange` | the input's `change` event, called as `(value, event)` |

The label's `htmlFor` and the input's `id` are the same `useId()`, which is what makes the whole card the target: a label forwards its activation to the control it names. There is no click handler anywhere in the file, and there must not be — a handler on the card would fire for the pointer and not for the keyboard, which is v0's defect arriving by a different route.

The surge note's id is that same `useId()` with `-surge` appended, so two cards on one screen cannot collide.

### `RideCardGroup` to the DOM

| Prop | What it renders |
|---|---|
| `label` | a real `<legend>` inside the `<fieldset>`. Required |
| `name` | the `name` given to every `RideCard` child. Generated with `useId` when absent, which is the normal case |
| `value` | each child's `checked`, by equality with that child's `value`. When `value` is `undefined` the child's own `checked` is left alone |
| `onChange` | each child's `onChange`, **unless the child brought its own** — a card's handler wins |
| `children` | cloned into `div.mz-ride-card-group__options`. Anything that is not a `RideCard` passes through untouched |

The cloning is the one piece of cleverness in the file and it is deliberate: a call site repeating `name="ride"` on four cards is a call site where the fifth is added with a typo and silently becomes its own group of one — a radio that will not deselect its neighbour, which is a defect nobody finds by reading.

### To ARIA

| Rendered | Role / property |
|---|---|
| `<fieldset>` + `<legend>` | `group`, named by the legend — the radiogroup |
| `<input type="radio">` | `radio`, named by its `<label>` |
| `checked` | `aria-checked`, maintained by the browser |
| `disabled` | the disabled semantics, and arrow keys skipping the option |
| `surgeNote` | `aria-describedby` |

Nothing in the left column is an ARIA attribute this component writes, except the last row. That is the whole argument of the section above, stated as a table.

### To Figma

Not yet wired. When Code Connect lands, `fareBasis` and `disabled` are component properties and the six content props are text slots; `value`, `name` and `onChange` have no Figma counterpart and must not acquire one, because a design tool has no radio group name and no handlers, and a property that exists on only one side is a property that drifts.

## What is owed

~~**The focus indicator is duplicated for the third time.**~~ **Extracted.** It now lives once, in [`../styles/focus.css`](../styles/focus.css), reached by the `mz-focus-ring-within` class — the variant for an element that shows focus taken by a *descendant*. That variant exists because of this component: the real focus lands on a radio that is visually hidden inside the card, so the ring has to be drawn on the card. It got a name rather than an exception, because it is the correct construction for any control whose focusable element is not the thing a user sees.

**`RideCardGroup` has no contract.** The contract generator takes one props type per file, and this file exports two. The group is documented here and in the stories, but nothing machine-checks its API. The honest fix is either a second source file or a generator that handles more than one exported props type, and neither is this component's to decide.

## How we would deprecate it

Withdrawn only by a decision naming what replaces it. A prop goes first: `@deprecated` in the source with the replacement named in the tag — which the contract derives — kept for one minor version, then removed in a major one with the migration written down.

`fareBasis` is the likeliest to move. If a third basis appears it becomes a new member of the union, never a sibling prop.
