# Dialog — the API spec

A modal built on the platform's `<dialog>`, opened with `showModal()`.

## What it replaces

**Nothing.** There is no modal, no overlay and no confirmation anywhere in `legacy/src` — Dialog is the second component in the library with no v0 predecessor, after [`Input`](../Input/README.md).

What v0 has instead is two irreversible actions that fire on one press:

| v0 | what it is | what happens |
|---|---|---|
| `TripScreen.tsx:86` — **"Cancel Trip"** | `<ActionButton kind="cancel" onClick={() => navigate('/move')}>` | cancels a trip with a driver two minutes away, no confirmation |
| `CartScreen.tsx:129` — **"Remove"** | a `<div onClick>` with a hard-coded `#c0392b` | deletes a cart line immediately, and is keyboard-inert |

The `CancelTrip` story is the first of those as it should have been.

## Why the platform element

`showModal()` supplies, with no code here:

| behaviour | where it comes from |
|---|---|
| focus trap | the browser, for a modal dialog |
| everything else inert | the top layer |
| `Escape` closes | the browser |
| never clipped by an ancestor's `overflow`, never outranked by a `z-index` | the top layer |
| `role="dialog"` + `aria-modal` | implicit on the element |
| focus returns to the trigger on close | the browser |

The same argument [`RideCard`](../RideCard/README.md) makes for a real radio. Each of those is a thing a `div` re-implementation gets subtly wrong, and the ones it gets wrong are the ones nobody tests.

**`<dialog open>` is not this.** That attribute renders a *non-modal* dialog: no top layer, no focus trap, nothing inert, and Escape does nothing. It looks identical on screen, which makes it the single easiest way to ship a modal that is not one.

## Where the weight of a destructive action goes

Into the **label** and the **description**.

[Decision 020](../../../../decisions/020-the-button-consolidation.md) refused a destructive Button variant, and the token layer still has no action-danger semantic. That refusal is not worked around here — it is the constraint that shapes the API:

- `confirmLabel` **names the verb**. `Cancel trip` and `Keep trip`, never `Yes` and `No`.
- `description` **states the consequence**. *"Your driver is two minutes away"* is what makes this a decision rather than a box somebody presses to make go away.
- `confirmIsSafe` decides **which action a habitual Enter lands on**.

A red button would be the weaker signal anyway: invisible to a colour-blind user, and the same red whether the thing is undoable or merely annoying.

**Neither action is primary.** A primary fill on "Cancel trip" is the refused variant arriving under another name; a primary on "Keep trip" pushes the safe answer at somebody who may genuinely want the other one.

### "Cancel" is the one word this dialog cannot use

In a *cancel-the-trip* dialog, a button reading "Cancel" can be read as either answer. Both labels name what will happen instead.

## Focus, and a bug worth recording

Initial focus is placed **after** `showModal()`, explicitly, scoped to the actions row.

The first version used React's `autoFocus` and **silently did nothing** — which is worse than failing, because it looked right in a screenshot. React applies `autoFocus` by calling `.focus()` at mount, and mount happens before the effect that opens the dialog. Focusing an element inside a closed dialog is a no-op, so the dialog opened with `document.activeElement` still on `<body>`: no ring, no keyboard starting point, and the one safety property this component claims quietly absent.

It was caught by measuring `document.activeElement` in the running Storybook, not by review.

The focus is scoped to `.mz-dialog__actions button` rather than to the dialog, because `children` may contain focusable content and *"the first focusable thing"* is not the same question as *"the action a habit should land on"*.

## Anatomy

```
┌ <dialog> ─── the click target for backdrop dismissal, no padding ─┐
│  ::backdrop ─────────────────────── surface.scrim, decision 025   │
│  ┌ .mz-dialog__panel ── surface.default, border, shadow.300 ────┐ │
│  │  <h2> title ───────────── aria-labelledby, dir=auto          │ │
│  │  <p> description ──────── aria-describedby, dir=auto         │ │
│  │  children                                                     │ │
│  │  ┌ actions ── flex-end ── dismiss first, confirm last ──────┐ │ │
│  └───────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

**The `<dialog>` carries no padding**, and that is structural rather than stylistic: the element is the click target for backdrop dismissal, so padding on it would turn its own padding into backdrop, and a click an inch from the title would close the dialog. Everything visible is in the panel.

## The scrim

This is the first consumer of `surface.scrim`, which [decision 025](../../../../decisions/025-the-scrim-is-one-value-and-carries-no-pairing.md) added for it — and which the elevation scale asked for long before, in `shadow.300`'s own description:

> anything that needs to feel further away than this needs a scrim behind it, which is a separate mechanism and not a fourth shadow

`::backdrop` inherits from its originating element, so the custom properties on `:root` reach it. Verified rather than assumed — that inheritance is a relatively recent spec change and older advice says the pseudo-element inherits from nothing.

**Nothing may be drawn on the scrim.** `surface.scrim` carries no contrast pairing, and 025 is explicit that this is a property rather than an exemption: `check-contrast.mjs` *errors* on a translucent background, because what shows through is unknown. There is no close button floating on the backdrop and there must never be one.

Measured in dark, which is where the scrim does least: the page composites to `#0a0a0a` behind a panel that stays `#141414`, and `border.default` at `#3d3d3d` plus `shadow.300` carry the edge. 025 says so rather than pretending one value does everything.

## Responsibilities

**What Dialog owns:**

- Driving the element's modal state from `open` — always through `showModal()`, never through the `open` attribute.
- Placing initial focus once the dialog is actually open, on the action `confirmIsSafe` names. See Focus, above; it is the one guarantee here that the platform does not supply.
- Reconciling the platform's own closing with the consumer's state. The element closes itself on Escape, and this component reports that upward, so `open` and the DOM never disagree — without that, the next `open={true}` would be a no-op on an element already closed in its own eyes.
- Collapsing the three ways out — Escape, the backdrop, the dismissing action — into one event.
- Naming itself. The `<h2>` it renders is wired as the accessible name and the description as the accessible description; neither is optional plumbing the caller can forget.
- The order of the actions row: dismiss first, confirm last, in both directions.
- Its own surface — scrim, elevation, edge, and a ceiling on the measure.

**What Dialog does not own, and who does:**

| Not owned | Owner | Why not here |
|---|---|---|
| Whether it is open | the call site | It is controlled, and this component never closes itself without saying so through `onDismiss`. A dialog that owned its own visibility would have two sources of truth for one boolean. |
| The focus trap, the inertness of everything behind it, Escape, and the return of focus to the trigger | the browser | Why the platform element. Each is a thing a `div` re-implementation gets subtly wrong. |
| What the title, the description and the two labels say | the call site, and eventually the string catalogue | The same reason [`Button`](../Button/README.md) gives: a component that authors a string authors content, and the catalogue does not exist yet. Here it is sharper — the label *is* the destructive signal, so a component supplying one would be supplying the warning. |
| Whether confirming is in fact the safe choice | the call site, through `confirmIsSafe` | Nothing in the component can tell. It is a fact about the action, not about the box, and it defaults to the cautious reading rather than guessing. |
| What confirming does | the call site, through `onConfirm` | Same line [decision 020](../../../../decisions/020-the-button-consolidation.md) drew for Button: what pressing it means belongs to the screen. |
| How the two actions look | [`Button`](../Button/README.md) | Both are a plain `variant="secondary"`. Dialog chooses *that* neither is primary — see above — and nothing else about them. |
| What the colours and the elevation are | `content/tokens/` | Rule 1, and [decision 025](../../../../decisions/025-the-scrim-is-one-value-and-carries-no-pairing.md) for the one value that was added to serve this component. |
| Opening it from a real control | the consumer | A dialog raised by a `<div onClick>` has no trigger for focus to return to, and there is nothing this component can do about that from the inside. |

Button's test for that line was *is this true of the control, or true of the situation the control is in?* Dialog's is narrower and easier to apply: **is this true of the box, or true of the decision inside it?** The box is this component. The decision belongs to the screen that raised it.

## Variants

**None, and that is the specification rather than a gap.**

A variant names how something looks. The only thing that varies between one confirmation and another is what it will cost to press the confirming action, and that is meaning — so a variant is the wrong shape for it before any particular variant is proposed.

The obvious proposal is a `destructive` or `danger` dialog: red title, red confirm, a warning icon. It is refused for the same reasons [decision 020](../../../../decisions/020-the-button-consolidation.md) refused a destructive Button variant, one level up:

- **The token layer still has no action-danger semantic**, and inventing one here to serve a dialog would be designing a token backwards from a component exactly as it would have been in Button. 007 keeps `mobility.safety` out of a shared component.
- **A colour is a weaker carrier than a sentence.** Already argued under *Where the weight of a destructive action goes*: invisible to a colour-blind user, and the same red whether the thing is undoable or merely annoying.
- **The sharper cost is what a variant would let a caller skip.** Today the only way to say "this is serious" is to write `description` and to name the verb in `confirmLabel`. Add `variant="destructive"` and there is a way to signal severity without writing either — and a red box whose text still reads *Are you sure? / Yes / No* is a dialog that has been decorated instead of written. The absence of the variant is what keeps the writing mandatory.
- **A variant named after the action is the same refusal again.** 020's second judgment: `confirm` and `cancel` are the semantics of the action rather than the appearance of the control, and a vocabulary that names verbs grows a term per feature until it is a list of the product's screens. `<Dialog variant="delete">` is that list starting.

The axis that genuinely does vary with severity is exposed — as **behaviour, not appearance**. `confirmIsSafe` moves where a habitual Enter lands. It changes no colour, no icon and no size, which is why it is a boolean about the action rather than a name for a look.

There is no size variant either. The width is a ceiling the content stays under rather than a choice a caller makes — see Constraints.

**And no `alertdialog` variant.** That is a different ARIA role rather than a different appearance, and roles are not variants; see Accessibility guaranteed for where this component sits against the APG patterns and why it does not reach for that one.

## States

Two, and the interesting column is not what changes but who owns it.

| State | Trigger | The platform owns | The component owns |
|---|---|---|---|
| Closed | `open={false}` | the element is not rendered to the user, nothing is inert, nothing is trapped | calling `close()` when `open` goes false, so the element's own state cannot drift from the prop |
| Open | `open={true}` → `showModal()` | the top layer, the `::backdrop`, the focus trap, the inertness of the rest of the document, `Escape`, and returning focus to the invoking element on close | placing initial focus **after** the element is open, on the dismissing action or — when `confirmIsSafe` — on the confirming one |
| Closing | Escape · a backdrop click · the dismissing action | closes the element itself on Escape and fires `close` | listening for `close` and calling `onDismiss`; and, for the backdrop, testing that the click landed on the `<dialog>` rather than on anything inside it |

**There is no third state, and one that looks like a state is not reachable.** `<dialog open>` renders a *non-modal* dialog — no top layer, no trap, nothing inert, Escape doing nothing. It is one attribute away and this component never takes it; see *Why the platform element*.

**Nothing here has a hover, a press or an entrance.** The panel is a surface rather than a control, and the two things inside it that respond to a pointer are `Button`s with `Button`'s states. The absence of an entrance animation is argued in Constraints, and it is a decision rather than a state nobody got round to.

**Focus placement is a one-shot rather than a state.** It happens on the transition into open and never again: changing `confirmIsSafe` on an already-open dialog moves nothing, because the effect that would act on it is guarded on the element not yet being open. That is the right behaviour — focus jumping under a user mid-read is worse than a stale default — but it is a consequence of the guard rather than something separately implemented, and it is recorded here so a later change to that effect does not quietly alter it.

## Properties exposed

`open` (required) · `title` (required) · `description` · `children` · `dismissLabel` (required) · `onDismiss` (required) · `confirmLabel` · `onConfirm` · `confirmIsSafe`

Four are required, and two of those are about the way out: `dismissLabel` and `onDismiss`. There is always one.

## Content designers control

More of this component than of any other in the library, because the whole signal is text.

- **The title.** Required, rendered as a real `<h2>`, and it is the accessible name. **There is no `aria-label` escape hatch and no unlabelled dialog**, which is the one place this spec takes a decision out of a writer's hands on purpose: a modal takes the whole screen away from someone, and arriving in one with no name is arriving somewhere with no idea what it is.
- **The description.** Optional in the API and effectively required for anything irreversible — it is where the consequence goes, and it is announced on open rather than only seen.
- **Both action labels.** Name the verb. `Cancel trip` and `Keep trip`, never `Yes` and `No`, and never "Cancel" in a cancel-the-trip dialog — argued above.
- **Whether there is a confirming action at all.** A dialog with only a way out is an acknowledgement; a dialog with two is a decision. That choice is made by passing labels, not by setting a mode.
- **Anything longer than a sentence**, through `children`. Most dialogs should not need it, and one that does is usually a dialog that should have been a page.

What a writer may **not** do, and what rejects each:

- **Ship it unnamed.** `title` is required by the type.
- **Shorten a label to fit.** Nothing here truncates or abbreviates, and §2 is why: Arabic has no abbreviations.
- **Put the emphasis somewhere other than the words.** There is no primary action, no tone and no icon to reach for. The label is the signal — which is a constraint on the writing before it is a constraint on the API.

The first two items carry the weight, and they are design work rather than a codemod: the two v0 actions this component replaces have no title and no description to migrate, because a control that fires immediately never had to say what it was about to do.

## Constraints

- **No width, no fixed height.** Sized against the viewport — `min(100% - space.400, 28rem)` — so a phone gets margins and a wide screen gets a readable measure. A dialog is one of the few things that legitimately has a maximum width; it is a ceiling the content stays under, not a width it is forced into.
- **No `className`, no `style`, no prop that shortens a string.**
- **No destructive variant, no tone, no icon.**
- **No entrance animation**, and it is a decision. A modal takes focus and makes everything else inert the moment it appears; animating it delays the point at which a keyboard user's focus is somewhere predictable, and a dialog that fades spends its first frames not being usable. [Decision 021](../../../../decisions/021-the-motion-scale-and-where-a-spinner-does-not-go.md)'s scale exists and is deliberately not reached for.
- **No way to suppress the dismissing action or intercept Escape.**
- **No focus management beyond the initial placement.** The trap and the restoration are the platform's.
- **Two written numbers**, each named because the house rule is to count them exactly: `28rem` (the readable ceiling, argued above); and `26rem`, the width below which the actions stretch. The third was `1px`, the control edge, and this file's note that five components was "the strongest evidence one is owed" is what [decision 026](../../../../decisions/026-the-stroke-scale.md) eventually acted on — at seven. It resolves from `stroke.100`. That last one is the library's **first viewport-dimension media query** — every other `@media` in these components is a capability or preference query — so it puts a breakpoint into a system with no breakpoint scale. It is flagged rather than smoothed, and a second component needing one is the trigger for deciding that scale.

## Accessibility guaranteed

- A real `<dialog>` opened with `showModal()`.
- An accessible name, always — `title` is required and wired with `aria-labelledby`.
- The consequence announced on open, through `aria-describedby`.
- **Initial focus on the safe action**, placed after the dialog is open.
- Escape, the backdrop and the dismissing action are one event.
- Focus returns to the trigger on close.
- **0 axe violations across all seven stories**, checked in dark + RTL.

**The pattern is APG's Modal Dialog**, and almost none of it is code in this file. `role="dialog"` and `aria-modal="true"` are implicit on a `<dialog>` opened with `showModal()` — neither is written in the source, and writing them would be restating the platform. The focus trap, `Escape`, and the return of focus to the invoking element are the browser's. An accessible name is guaranteed because `title` is required. Every control is a descendant of the dialog because nothing is drawn on the scrim and nothing may be — see The scrim.

What the component contributes is the one thing the pattern leaves to judgment: **initial focus placement**, where APG says that for a destructive action the least harmful option is worth focusing. `confirmIsSafe` is that recommendation turned into an API rather than left to each call site's taste, and it defaults to the cautious reading. Naming it as conformance matters, because otherwise it reads as a preference somebody could reasonably reverse.

**Where it departs, deliberately.** APG has a separate Alert Dialog pattern, `role="alertdialog"`, for a message that interrupts to demand a response. This component never sets a `role` attribute, so it is always a plain dialog. That is not an oversight to be fixed with a prop: `alertdialog` is for messages, and a message that needs no decision belongs in the status region named under What is not here. Adding the role here would make it easier to use this component for exactly the thing it says it is not for.

Two page-level rules — `landmark-one-main` and `page-has-heading-one` — fire on the `FromATrigger` story when axe is run against the whole iframe document. They are not this component: a plain `Button` story reports the identical two. Scoped to the component root, as Storybook's own addon runs it, Dialog is clean.

**What the consumer must still do** is in the contract's `accessibility.consumer_must` — open it from a real control, write labels that name the verb, decide `confirmIsSafe` honestly, and keep the content to a decision.

## RTL behaviour

- The actions sit at the reading **end** of their row via `justify-content: flex-end` — a position on the inline axis, not a physical edge — so the row flips with the document.
- **The dismissing action stays first in reading order** and the committing action last, in both directions. Last is the last thing read before acting.
- Title and description carry `dir="auto"` as blocks, on the §3 reasoning [`Input`](../Input/README.md) learned by rendering.
- Arabic line height on the title, because a short heading is exactly where a tight leading looks safe and clips a diacritic. **This was false when written** and is true now: the title writes `line-height.normal`, which was 1.5 — a Latin value — until [decision 027](../../../../decisions/027-script-is-an-overlay-not-a-dimension.md) made `:lang(ar)` re-resolve that name to the Arabic step. The declaration did not change; what it resolves to did.
- Below a narrow breakpoint the actions stretch rather than huddling at one end — §6 measured Arabic running to 117 per cent of English on some strings, and a wrapped row of end-aligned buttons reads as a mistake.

There is no `[dir='rtl']` selector anywhere.

## Code API mapping

### To the rendered DOM

| Prop | What it renders |
|---|---|
| — | `<dialog class="mz-dialog">`, the click target for backdrop dismissal and the carrier of no padding |
| — | `div.mz-dialog__panel`, everything visible |
| `title` | `<h2 class="mz-dialog__title" dir="auto">`, with a generated `id` |
| `description` | `<p class="mz-dialog__description" dir="auto">`, with a generated `id`. Not rendered at all when omitted |
| `children` | `div.mz-dialog__body`, between the description and the actions. Not rendered when omitted |
| `dismissLabel` | a `<Button variant="secondary">`, **first** in `div.mz-dialog__actions` |
| `confirmLabel` | a `<Button variant="secondary">`, **last** in the row — rendered only when `confirmLabel` **and** `onConfirm` are both passed. Either alone renders nothing, which is deliberate: a labelled action with no handler is a button that does nothing |

The ids are generated with `useId`, so two dialogs on one page cannot collide.

### To the platform

| Prop | HTML / ARIA |
|---|---|
| `open: true` | `showModal()` — top layer, `::backdrop`, focus trap, the rest of the document inert, `Escape` |
| `open: false` | `close()` |
| — | `role="dialog"` and `aria-modal="true"`, implicit and unwritten. See Accessibility guaranteed |
| `title` | `aria-labelledby`, pointing at the `<h2>` |
| `description` | `aria-describedby`, and the attribute is **absent** rather than empty when there is no description |
| `onDismiss` | called by the dismissing `Button`, by a backdrop click, and by the element's own `close` event — which is how `Escape` arrives |
| `onConfirm` | `click` on the confirming `Button` |
| `confirmIsSafe` | which of the two buttons receives `.focus()` after `showModal()`, and **nothing else**. With no confirming action there is one button in the row and both readings land on it |

`Escape` is listened for as `close` rather than intercepted as `cancel`. The distinction is the point: the platform's Escape keeps working exactly as defined, and this component only reports that it happened.

### To the token layer

Every value, and the two exceptions are counted in Constraints rather than hidden here.

| Slot | Token |
|---|---|
| Scrim | `surface.scrim` |
| Panel ground | `surface.default` |
| Panel edge | `border.default` at `stroke.100` |
| Elevation | `shadow.300` |
| Corner | `radius.200` |
| Panel padding | `space.300` |
| Gap between title, description, body and actions | `space.150` |
| Gap between the actions, and the space above the row | `space.100` |
| Viewport margin, in both the inline ceiling and the block one | `space.400` |
| Dialog text / description text | `text.primary` / `text.secondary` |
| Title size and weight | `font-size.500`, `font-weight.medium` |
| Description and body size | `font-size.300` |
| Leading, all three | `line-height.normal` |
| Face | `font-family.sans` |
| Tracking | `letter-spacing.none` |
| The two actions | `Button`'s own, all of them |

### To Figma

Not yet wired. When Code Connect lands, `title`, `description`, `dismissLabel` and `confirmLabel` are text properties and whether there is a confirming action is a boolean.

`open`, `onDismiss` and `onConfirm` have no Figma counterpart and must not acquire one — a design tool has no state and no handlers. **`confirmIsSafe` is the one to watch.** It changes nothing visible, so there is nothing for a component property to show; giving it one would mean inventing a visual difference on the design side that the component deliberately does not have, which is the destructive variant arriving through the tool that has no contrast gate.

## How we would deprecate it

Withdrawn only by a decision naming what replaces it. A prop goes first: `@deprecated` in the source with the replacement named in the tag, one minor version of overlap, then removal in a major one with the migration written down.

`confirmIsSafe` is the prop most likely to move. If the answer ever needs to be "neither", that is a **third state on one prop** rather than a second prop — the reason [020](../../../../decisions/020-the-button-consolidation.md) gives about v0's three names for one axis.

## What is not here

**A toast, and an inline status region.** Both are named in `do_not_use_when` as the right answer for a message that needs no decision, and neither exists. Until they do, the risk is that this component gets used for messages — which is how a confirmation stops being read.

**Stacked dialogs.** A dialog that opens another leaves a user with no model of where they are. If a flow needs it, the answer is one dialog whose content changes, or a route.
