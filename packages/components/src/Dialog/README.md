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

## Properties exposed

`open` (required) · `title` (required) · `description` · `children` · `dismissLabel` (required) · `onDismiss` (required) · `confirmLabel` · `onConfirm` · `confirmIsSafe`

Three are required and two of those are about the way out: `dismissLabel` and `onDismiss`. There is always one.

## Constraints

- **No width, no fixed height.** Sized against the viewport — `min(100% - space.400, 28rem)` — so a phone gets margins and a wide screen gets a readable measure. A dialog is one of the few things that legitimately has a maximum width; it is a ceiling the content stays under, not a width it is forced into.
- **No `className`, no `style`, no prop that shortens a string.**
- **No destructive variant, no tone, no icon.**
- **No entrance animation**, and it is a decision. A modal takes focus and makes everything else inert the moment it appears; animating it delays the point at which a keyboard user's focus is somewhere predictable, and a dialog that fades spends its first frames not being usable. [Decision 021](../../../../decisions/021-the-motion-scale-and-where-a-spinner-does-not-go.md)'s scale exists and is deliberately not reached for.
- **No way to suppress the dismissing action or intercept Escape.**
- **No focus management beyond the initial placement.** The trap and the restoration are the platform's.
- **Three written numbers**, each named because the house rule is to count them exactly: `1px` (the control edge, for the fifth time — **still no border-width scale**, and five components is now the strongest evidence one is owed); `28rem` (the readable ceiling, argued above); and `26rem`, the width below which the actions stretch. That last one is the library's **first viewport-dimension media query** — every other `@media` in these components is a capability or preference query — so it puts a breakpoint into a system with no breakpoint scale. It is flagged rather than smoothed, and a second component needing one is the trigger for deciding that scale.

## Accessibility guaranteed

- A real `<dialog>` opened with `showModal()`.
- An accessible name, always — `title` is required and wired with `aria-labelledby`.
- The consequence announced on open, through `aria-describedby`.
- **Initial focus on the safe action**, placed after the dialog is open.
- Escape, the backdrop and the dismissing action are one event.
- Focus returns to the trigger on close.
- **0 axe violations across all seven stories**, checked in dark + RTL.

Two page-level rules — `landmark-one-main` and `page-has-heading-one` — fire on the `FromATrigger` story when axe is run against the whole iframe document. They are not this component: a plain `Button` story reports the identical two. Scoped to the component root, as Storybook's own addon runs it, Dialog is clean.

**What the consumer must still do** is in the contract's `accessibility.consumer_must` — open it from a real control, write labels that name the verb, decide `confirmIsSafe` honestly, and keep the content to a decision.

## RTL behaviour

- The actions sit at the reading **end** of their row via `justify-content: flex-end` — a position on the inline axis, not a physical edge — so the row flips with the document.
- **The dismissing action stays first in reading order** and the committing action last, in both directions. Last is the last thing read before acting.
- Title and description carry `dir="auto"` as blocks, on the §3 reasoning [`Input`](../Input/README.md) learned by rendering.
- Arabic line height on the title, because a short heading is exactly where a tight leading looks safe and clips a diacritic.
- Below a narrow breakpoint the actions stretch rather than huddling at one end — §6 measured Arabic running to 117 per cent of English on some strings, and a wrapped row of end-aligned buttons reads as a mistake.

There is no `[dir='rtl']` selector anywhere.

## How we would deprecate it

Withdrawn only by a decision naming what replaces it. A prop goes first: `@deprecated` in the source with the replacement named in the tag, one minor version of overlap, then removal in a major one with the migration written down.

`confirmIsSafe` is the prop most likely to move. If the answer ever needs to be "neither", that is a **third state on one prop** rather than a second prop — the reason [020](../../../../decisions/020-the-button-consolidation.md) gives about v0's three names for one axis.

## What is not here

**A toast, and an inline status region.** Both are named in `do_not_use_when` as the right answer for a message that needs no decision, and neither exists. Until they do, the risk is that this component gets used for messages — which is how a confirmation stops being read.

**Stacked dialogs.** A dialog that opens another leaves a user with no model of where they are. If a flow needs it, the answer is one dialog whose content changes, or a route.
