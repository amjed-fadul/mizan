# Input — the API spec

The second component, and the one the RTL rule layer was mostly written about. `content/rules/rtl-arabic.md` §6 is four paragraphs on fields specifically — which values are Latin whatever the page is, where a placeholder may not put an instruction, and why `dir="auto"` on an empty field is a trap — and this component is that section made into an API.

It is also the test of whether Button's vocabulary generalised or was designed around Button. Two answers, both in this file: the size steps are the same `control.*` semantics with nothing added, and the one thing Input needed that did not exist became [decision 023](../../../../decisions/023-the-error-semantic-is-two-tokens.md) rather than a value invented here.

`Input.stories.tsx` is the part you can type into. Start with **Latin Value In An Arabic Page**.

## Anatomy

```
┌ .mz-input ──────────────────────────────── grid, block axis ┐
│  <label> ──────────────── label + required marker, dir=auto │
│  ┌ <input> ─────────────────────────────────────────────┐   │
│  │  value / placeholder            dir: ltr | auto | —   │   │
│  └───────────────────────────────────────────────────────┘   │
│  <p> hint ───────────────── text.secondary, dir=auto, id ────│
│  <p> error ──────────────── text.error, dir=auto, id ────────│
└──────────────────────────────────────────────────────────────┘
```

Four elements, and the two `<p>`s are conditional. Nothing in the diagram has a side: the stack is a block-axis grid, and the block axis is the one `dir` does not touch.

## Responsibilities

- Render a native `<input>` bound to a real `<label>` by `id`.
- **Decide the direction of the value**, independently of the page, and derive that decision from `type` where `type` knows.
- Take its geometry from a size step and let the product mode decide what the step resolves to.
- Carry the invalid state in three signals at once, never one.
- Link the hint and the error programmatically, in the order a reader needs them.
- **Nothing about validation.** It renders a state it is told about.

## The direction decision — the whole point of this component

There are two direction questions in a text field and they have different answers. Conflating them is the defect.

### 1. How the value is directed — `valueDirection`

| value | what is written | for |
|---|---|---|
| `'page'` | **no `dir` at all** | prose in the interface language — a name, a note |
| `'ltr'` | `dir="ltr"` | Latin by nature — email, URL, IBAN, order reference, promo code |
| `'auto'` | `dir="auto"` | genuinely unknown — a search query, a customer's own name |

Derived from `type` when unset: `email`, `tel`, `url`, `password` → `'ltr'`; `text`, `search` → `'page'`.

**Why this is not the browser's job.** §6 checked rather than assumed: the HTML directionality algorithm resolves `<input type="tel">` to `ltr` with no attribute, and **nothing else** — `email`, `url`, `search`, `number` and plain `text` all inherit the page. Verified in a current browser.

What that costs, rendered rather than reasoned about:

- `+971 50 123 4567` in a plain text input on an RTL page paints as `4567 123 50 971+`.
- An email **under composition moves**: `amjed@` paints as `@amjed`, the `@` jumping to the far end of the field and coming back once a domain is typed.

In both, the stored value is correct and only the painting is wrong — which is exactly why this survives being tested by somebody reading the value out of state instead of off the screen.

**Why `'page'` writes nothing rather than `dir="rtl"`.** Inheriting is what a page-language value should do, and writing a direction to achieve it would be a component deciding a layout, which §1 forbids. The absence is the feature.

**Why `'auto'` is never a default.** §6's trap: `auto` computes from the value, an empty value has no strong character, and the specified fallback is `ltr`. An Arabic field with an Arabic placeholder would open left-aligned on an Arabic page and snap right at the first letter. The jump is the defect, not the fix.

### 2. How the supporting text is directed — `dir="auto"`, always

The label, hint and error carry `dir="auto"` and there is no prop for it.

§3 draws the line this rests on: `<bdi>` isolates a **run** inside a sentence, but alignment — and the end an ellipsis lands at — belongs to the **block**. These three are blocks, and they are the case §3 reserves `auto` for: content whose direction genuinely cannot be known, because the component is handed a `ReactNode` and cannot read it.

This was found by rendering, not by review. Before it, the English message *"That address is missing everything after the @."* inside an Arabic page painted as:

```
.@ That address is missing everything after the
```

The trailing neutrals thrown to the far end — the bidirectional algorithm working correctly on unmarked content, and indistinguishable from a rendering bug.

**Its known weakness is §3's own:** `auto` reads the first strong character and nothing else, so a message opening with a Latin brand name resolves LTR whatever follows it. A caller who knows the direction — and an application with a string catalogue nearly always does — passes a node that declares it. These props are `ReactNode` rather than `string` precisely so that is possible. **`auto` is the floor, not the ceiling.**

## Variants

**None, and that is the finding rather than an omission.** Button's test is that a variant names a legitimate difference in *appearance* — a fill, a label token, an edge, each of them a pairing `pairs.json` declares. Nothing on this component's API changes what the field looks like at rest. A field is a field.

Three props look like variants at a glance and are each something else, which is worth writing down because each will be *proposed* as a variant eventually:

| Prop | Looks like | Actually is |
|---|---|---|
| `size` | a variant | the **geometry step**, the same axis Button carries. It names a step and the product mode decides what the step resolves to ([022](../../../../decisions/022-control-geometry-resolves-by-product.md)). Geometry is not appearance in the sense the variant test means, and Button's Variants section already refuses to let the two axes merge. |
| `type` | a variant | a **platform behaviour**. `email`, `tel`, `url`, `search` and `password` change the software keyboard, the autofill contract and — through §2 above — the resolved direction of the value. Two of them change what the browser renders inside the field, and none of them is a look this system chose. |
| `valueDirection` | a variant | a **content decision**, argued in full above. It changes which way the value reads, not how the field is drawn. |

### Which differences would be legitimate

The same axis Button's are on: a declared foreground/background pairing. A field variant would have to be a different edge or a different ground, both of which already exist here as **states** rather than variants — `border.control` at rest, `border.error` when invalid, `surface.sunken` when disabled. That is the distinction to hold: **the same field passing through a condition is a state; two fields that are permanently different are variants.** Nothing in this component is permanently different from anything else in it.

### What is not here, and the request each refusal will arrive as

- **No `variant="search"` with an inset icon.** Search is a `type`, and an icon inside the field is a slot this component does not have — it would need a second focusable target inside a control with one, or a decorative element that pushes the text and has to be mirrored under RTL. If search needs a distinct treatment it is a component that composes this one, not a variant of it.
- **No `variant="ghost"` or borderless field.** The resting edge is the only thing distinguishing a field from static text, and `border.control` on `surface.sunken` is a declared pairing precisely so that boundary is checked. Removing it removes the affordance and the gate at once.
- **No `variant="inline"` for a label beside the field rather than above it.** That is a layout decision belonging to the form, and the block-axis stack in Anatomy is what keeps `dir` out of this component entirely. An inline label puts a side back into a component that currently has none.

## States

| state | what changes | how it reaches assistive technology |
|---|---|---|
| resting | `border.control` edge | — |
| hover | edge to `text.primary` | — |
| focus | two-tone indicator, decision 019 | platform focus |
| invalid | edge to `border.error`, message in `text.error` | `aria-invalid` + `aria-describedby` |
| read-only | ground to `surface.sunken`, edge to `border.default` | real `readonly` |
| disabled | declared pair, `text.secondary` on `surface.sunken` | real `disabled` |

**Read-only is not disabled and does not look like it.** The value stays selectable, copyable and keyboard-reachable — that is the whole difference — and the edge drops to the divider token because it has stopped claiming to be editable.

**Hover does not overwrite the error edge.** A field that stops looking invalid because a pointer passed over it has traded a state for a hover effect.

### The invalid state is three signals, and no one of them alone

The edge colour, the message, and `aria-invalid`.

- Colour alone fails WCAG 1.4.1 for a colour-blind user.
- A message alone is missed by somebody scanning a long form for what to fix.
- `aria-invalid` alone is invisible to anyone looking at the screen.

[Decision 023](../../../../decisions/023-the-error-semantic-is-two-tokens.md) is why the edge changes **colour** rather than width. When that was decided there was no border-width scale, so a heavier edge would have invented one in passing; [decision 026](../../../../decisions/026-the-stroke-scale.md) has since built one, and the reasoning does not change — a thicker line is the weakest of the three signals regardless of whether the system can name its thickness.

### What this component does not announce

There is no `role="alert"` and no live region, and the omission is deliberate.

A field cannot know whether its error arrived because the user is still typing, because they left the field, or because a submit failed — and those want different announcements. The third wants a summary of every failure and a move of focus, which is a **form's** job. `aria-describedby` means the message is read whenever the field is reached; anything louder belongs to whatever owns the form.

## Properties exposed

`label` (required) · `type` · `size` · `valueDirection` · `value` · `defaultValue` · `placeholder` · `hint` · `invalid` · `errorMessage` · `required` · `readOnly` · `disabled` · `fullWidth` · `name` · `inputMode` · `onChange`

Seventeen, which is more than Button's nine, and the gap is honest: a field carries a label, two kinds of supporting text and four states that a button does not have.

## Content designers control

- The **label**, which names the value rather than instructing.
- The **hint**, where a format or a constraint goes so it stays readable while the field is used.
- The **error message**, which says what is wrong and where possible what to do about it.
- The **placeholder**, which is an example of the value and is in the value's script, not the interface's.

## Constraints — what may not be customised

- **No width and no fixed height.** Width is the container's business through `fullWidth`; height comes from padding and the Arabic line height. §6: a control sized to Latin ink clips Arabic, and the vertical axis clips rather than reflows.
- **No `className`, no `style`.** `InputProps` does not extend `InputHTMLAttributes` — that would hand back `style`, `className`, `width` and **`size`**, and `size` on a native input is a width in characters, which is exactly the prop §6 names as the usual culprit.
- **No prop shortens a string**, in the label, the hint or the error.
- **No `type="number"`.** It discards values it cannot parse, changes on a scroll wheel over the field, and exposes spinners that are a 12×12 target. The rule-layer reason is stronger: §4 puts every number behind one formatting boundary, and a field that parses and reformats its own value is a second boundary that will disagree with the first. A quantity is `type="text"` with `inputMode="numeric"`.
- **No `aria-label` escape hatch.** The label is required and visible.
- **No validation.** It never decides whether a value is acceptable.
- **No colour `pairs.json` has not seen.**
- **No product named anywhere** in the component or the stylesheet.

### What this component asked the token layer for

One thing, and it got it: **an error colour.**

Button hit the same wall from the other side — [decision 020](../../../../decisions/020-the-button-consolidation.md) refused a destructive variant partly because `mobility.safety` is unreachable from a shared component. Button could refuse and ship. Input cannot: a field with no way to say "this is wrong" is not a field. Two components reaching for the same missing name from opposite directions is what [023](../../../../decisions/023-the-error-semantic-is-two-tokens.md) rests on, and it added **two** names rather than one, because the message is gated at 4.5 and the edge at 3.0 and one name could only have been declared at one of them.

**~~Still owed, and this is now the second component to route around it: a border-width scale.~~ Landed:** [decision 026](../../../../decisions/026-the-stroke-scale.md) added `stroke.100` and `stroke.200` to `content/tokens/primitive/dimension.json`, and the edge resolves from `stroke.100`. Decision 023 called the repetition a pattern rather than an incident at two components; it reached seven before the scale was built.

**One value that is not a token and says so:** `--mz-input-supporting-scale`, the `0.875` the label, hint and error are set at. It is declared in the contract's `tokens_absent` with its reason — it is a *ratio* against the resolved step, so supporting text tracks the field's type when the product mode makes it larger, and a ramp step would stay 14px while Move's field grew to 16. This is the component token layer [022](../../../../decisions/022-control-geometry-resolves-by-product.md) named and nobody has built.

## Accessibility guaranteed

- A native `<input>` bound to a real `<label>` by `id`.
- A visible label, always.
- A visible two-tone focus indicator, drawn on the **field** rather than the wrapper, so the indicator matches the thing that actually has focus.
- A hit target of at least 44×44 at `md` and `lg` — held there by `machinery/scripts/check-tap-target.mjs` in every mode combination, rather than by arithmetic nobody verifies.
- The invalid state through `aria-invalid`, a message, and an edge.
- Hint before error in `aria-describedby`: what is wanted, then what went wrong.
- Real `disabled` and `readonly`, so the difference between them is one assistive technology reports.
- 0 axe violations across all twelve stories, checked in dark + Move + RTL.

**What the consumer must still do** is in the contract's `accessibility.consumer_must` — announce a submit-time error, pass an `errorMessage` whenever `invalid` is set, and declare the direction of supporting text where the application knows it.

## RTL behaviour

- Logical properties throughout. The stack is a block-axis grid; the required marker uses `margin-inline-start`. **No `[dir='rtl']` selector anywhere.**
- The one `dir` on the field is a statement about **content**, per §1's three legitimate cases.
- Label, hint and error carry `dir="auto"` as blocks, per §3.
- `letter-spacing: 0`, always, declared so it cannot be inherited from a page.
- Arabic line height, so diacritics reaching above the declared ascent are not clipped.
- The placeholder does not move, fade or re-align as the field is used.

The test §6 sets is not "does it look mirrored" but **"is every directional value derived, or is one of them written down?"** Every one here is derived.

## Code API mapping

### To the platform

| prop | attribute |
|---|---|
| `type` | `type` |
| `required` | `required` |
| `readOnly` | `readonly` |
| `disabled` | `disabled` |
| `invalid` | `aria-invalid` |
| `hint` / `errorMessage` | `aria-describedby` → element ids |
| `valueDirection` | `dir`, or nothing |

### To the token layer

Thirty-three custom properties, one declared absent. The geometry is `control.{sm,md,lg}.{padding-inline,padding-block,font-size,min-block}` — the same names Button reads, minus `min-inline`.

**Why `min-inline` is not read here.** Button needs an inline floor because a two-character Arabic label in a button-shaped slab reads as a label that failed to load. A field is already `inline-size: 100%` of a wrapper that is either `fit-content` or full-width, so its inline extent is a layout question rather than a label-length one. The **block** floor is what the tap target needs, and it is applied at every step.

### To Figma

Eleven props mirror a property; six do not and say why in `figma.unmapped` — `type`, `valueDirection`, `value`, `name`, `inputMode`, `onChange`.

`valueDirection` is the interesting one: it resolves to a `dir` attribute, and Figma has no text-layer property that means the same thing. Which end the value sits at is a property of the **frame's** direction in Figma, so mirroring it as a variant would produce two variants that look identical in a left-to-right file.

## How we would deprecate it

The first component in the library with no v0 predecessor to consolidate, so it is withdrawn only by a decision naming what replaces it.

A prop goes first: `@deprecated` in the source with the replacement named in the tag — which the contract derives and any agent reading it sees — kept working for one minor version, then removed in a major one with the migration written down.

`valueDirection` is the prop most likely to change shape. If a fourth case appears it becomes a **new member of the union**, never a second prop: two props describing one axis is the defect [020](../../../../decisions/020-the-button-consolidation.md) found in v0's three names for a variant.

## What is not here, and is the first thing this should grow

**Affixes** — a prefix, a suffix, a unit, a visibility toggle, a search submit inside the field.

It is a deliberate v1 boundary rather than an oversight. An affix changes the padding on *one side* of the field, and "one side" is exactly the kind of value §1 says must be logical rather than written down — so it is a small amount of CSS and a real decision about which side is which in Arabic, and it deserves to be made on purpose.
