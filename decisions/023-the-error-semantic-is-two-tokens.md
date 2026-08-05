# Decision 023 — The error semantic is two tokens, and neither of them is the red that already exists

**Date:** 2026-08-04
**Status:** accepted

## Context

Input is the second component, and it needs to tell a user that what they typed was not accepted. It reached for an error colour and found none.

That is not a gap somebody forgot to fill. It is the same wall [decision 020](./020-the-button-consolidation.md) hit from the other side, and it hit it hard enough to change Button's API: 020 refused a `destructive` variant, and one of its two reasons was that **`mobility.safety` is structurally unreachable from a shared component** and inventing `action.danger` for one v0 button would be designing a token backwards. Button could refuse the variant and ship. Input cannot refuse an invalid state and ship — a text field with no way to say "this is wrong" is not a text field.

So the question 020 deferred arrives with a component that cannot route around it. Two components independently reaching for the same missing name, from opposite directions, is the evidence this entry is built on. One component wanting something is a feature request; two is a gap in the vocabulary.

**What already exists, and why none of it is the answer:**

| Token | What it means | Why a shared component may not use it |
|---|---|---|
| `mobility.safety` | Trip cancellation and hazard *messaging* | Move-only. `mobility.*` is unreachable from shared by construction — the rule is in `mobility.json`'s own `$description`. |
| `commerce.discount` | A price treatment that happens to be red | Market-only, on the same terms. |
| `border.control` | The edge of any interactive control | Real and shared, but it is the *resting* edge. A field that looks identical valid and invalid has no error state. |

The red primitives were never the problem. `color.red`'s own description already reads *"the hue for loss and irreversibility — **errors**, destructive confirmations, cancellations"*, and the ramp already carries both ends under [decision 011](./011-a-hue-needs-both-ends-only-if-it-carries-text.md): red.600/700 for light grounds, red.300/400 for dark. The primitive was built for this. The semantic above it was never written.

## Problem

1. Does a shared error semantic exist, or is an error something each product names for itself?
2. If it exists, is it **one** name or more than one?

The second question looks like bookkeeping and is the one this entry is actually about.

## Constraints

- **Semantics are alias-only.** `check-schema.mjs` rejects a semantic that states a literal. Every value here references a primitive.
- **`shared.json` makes a claim about its own size** — *"each name added here is four decisions and four contrast checks, not one"* — so a name added here has to be worth four of each.
- **An undeclared pairing is an unchecked pairing.** Whatever is added is declared in `pairs.json` in every ground it renders on, or it is not really in the system.
- **A shared semantic must pass 007's factual test:** does the other product have this concept at all?
- **No new primitive.** The reds needed already exist and are already argued.

## Options

1. **No shared semantic.** Each product names its own error colour; Input takes it as a prop or a mode.
2. **One shared name** — `feedback.error`, or `text.error` used for both the message and the field edge.
3. **Two shared names** — `text.error` and `border.error`, identical in value, gated differently.
4. **Promote `mobility.safety`** to shared, per the promotion rule `mobility.json` already documents.

## Trade-offs

**Option 1 fails 007's test immediately, and the test is factual rather than stylistic: does the other product have this concept at all?** Market has forms and Move has forms. A grocery checkout validates a card number; a ride booking validates a phone number. Both products tell users their input was rejected, so "this field is wrong" is shared vocabulary by the same rule that put `surface.default` there. Pushing it to the products would also make Input product-aware, which is precisely the crack [007](./007-modes-for-shared-namespaces-for-unique.md) exists to prevent and which [022](./022-control-geometry-resolves-by-product.md) has just finished keeping out of Button.

**Option 4 is the interesting wrong answer**, because `mobility.json` explicitly invites it: *"If Market ever grows one of these concepts, the token is promoted to a shared semantic with a Market mode value — and that promotion is a Decision Log entry, not a rename."* The invitation does not apply, because **Market has not grown `mobility.safety`'s concept.** That token is trip cancellation and hazard messaging — content, about the world, addressed to a rider. A form error is interface feedback about a control's state. They share a hue and nothing else, and [decision 008](./008-the-colour-consolidation.md) already refused exactly this merge once, keeping `mobility.safety` and `commerce.discount` apart *"precisely so that destructive meaning stayed independently tunable."* Promoting on the strength of a shared value would undo 008 by the back door.

**Which leaves 2 against 3, and the deciding fact is the threshold.**

The error colour has two jobs on a single invalid field: it sets the **message**, which is text and gated by 1.4.3 at 4.5:1, and it draws the **field edge**, which identifies a control and its state and is gated by 1.4.11 at 3.0:1. One name cannot be declared at both. `pairs.json` takes one `context` per pairing, so a single `text.error` would be declared at 4.5 and its use as a border would go unchecked — or declared at 3.0 and the message would be unchecked at the bar that actually applies to it. Either way one of the two renderings sits outside decision 010's guarantee while looking exactly as covered as the other.

That is the same conflation [008](./008-the-colour-consolidation.md) had to undo for the ambers, and it says so in its own words: **status colour and status text are two jobs.** This entry is that sentence applied before the conflation rather than after it.

## Decision

**Two tokens: `text.error` and `border.error`**, both in `shared.json`, both resolved by the theme dimension alone.

| | light | dark | on `surface.default` | on `surface.sunken` |
|---|---|---|---|---|
| `text.error` | `{red.600}` | `{red.300}` | 5.62 / 5.28 — bar **4.5** | 5.02 / **4.73** — bar **4.5** |
| `border.error` | `{red.600}` | `{red.300}` | 5.62 / 5.28 — bar **3.0** | 5.02 / 4.73 — bar **3.0** |

Identical values in every combination. Different names, different gates, independently tunable.

Four new pairings are declared, and a fifth closes a hole that was already open: **`border.control` on `surface.sunken`** — 3.83:1 light, 3.84:1 dark — which Button has been drawing since it shipped with nothing checking it. It was one of the four gaps Button's own pull request recorded, and declaring the error edge on that ground while leaving the resting edge undeclared would have been incoherent in a single file.

## Why

### Two names for one value is the position this system has already taken twice

It looks wasteful and it is the established pattern here. [Decision 019](./019-the-focus-indicator-is-two-tone.md) made `focus.ring` and `focus.ring-contrast` aliases of `text.primary` and `surface.default` — *"the rendered indicator is byte-for-byte what it was before these names existed"* — and argued that the values were never the problem, the **ownership** was. 008 kept two identical reds apart so each stayed independently tunable.

The test that decides it is not "are these the same colour today" but **"would a change to one of them be a change to the other?"** Soften the error message because a form full of red reads as shouting, and the field edge should not follow it below 3.0. Darken the invalid edge for a denser form, and the message should not follow it into unreadability. They move for different reasons, so they are different names. A shared value is fine; a shared name is what turns one decision into two without anybody deciding it.

### The invalid state is three signals, and the colour is only one

`border.error` states in its own description that the edge is never the whole signal: the invalid state is the edge **and** the `text.error` message **and** `aria-invalid`, and no one of the three carries it alone. Colour alone fails 1.4.1 for a colour-blind user; a message alone is invisible to someone scanning a long form for what to fix; `aria-invalid` alone is not seen by anybody looking at the screen.

This is also why the invalid edge is not drawn as a **heavier** edge. There is no border-width scale — Button's stylesheet still carries the one literal `1px` in the system, recorded as a gap and still open — so a width change would either invent a scale in passing or hard-code a second literal. And a thicker line is the weakest of the available signals: it is the one a user is least likely to notice and the one that survives least well at small sizes.

### The new tightest pair, stated because it is a cost

`text.error` on `surface.sunken` in dark is **4.73:1 against a 4.5 bar — 0.23 of headroom**, and that makes it the tightest gated pairing in the system. It takes the title from `text.secondary` on the same ground in light + Move at 4.76:1.

Three descriptions claimed the old fact and have been corrected rather than left: `border.control`'s, `text.secondary-move`'s, and `product.move.json`'s. Two of them now say "tightest **neutral** pairing", which is still true and is the more useful claim anyway. `pairs.json`'s own note survived unedited because it had already said "tightest **neutral-on-neutral**" — a qualifier written by somebody who expected the ranking to change.

The honest reading of 0.23 is that a red on a tinted dark panel is close to the floor and the next move on either value has to be checked rather than eyeballed.

## What this proves

[Rule 7](../CLAUDE.md): that the token layer answers to components rather than anticipating them, and that a gap is found by a component reaching for something and failing — twice, from two directions, before anything was added. It also proves the negative case that 020 set up and this entry pays off: refusing to invent `action.danger` for one v0 button was correct *because* the right shape only became visible when a second component needed it, and the right shape was two names rather than the one 020 would have been inventing.

## Consequences

- **`shared.json` goes from eleven names to thirteen**, and its own count sentence is updated rather than left stale.
- **Five new pairings, twenty new checks.** `npm run check` goes from 50 to 70 passing.
- **The tightest gated pair in the system changed**, and three descriptions that named the old one are corrected.
- **`border.control` on `surface.sunken` is now declared** — one of the four gaps Button's pull request recorded is closed, and it passes at 3.83:1 / 3.84:1.
- **Both theme files gain two lines each.** The product files gain none: this pair depends on theme alone, exactly like `commerce.discount` and `mobility.safety`.
- **106 tokens build, 19 mode-dependent** (was 104 and 17).
- **Input can now be built**, and its invalid state has a colour it is entitled to.
- **~~The border-width scale is still owed~~, and this entry is the second component to route around it rather than fix it. That is now a pattern rather than an incident. Landed:** the pattern this bullet named ran to seven components before [decision 026](./026-the-stroke-scale.md) built `stroke.100` and `stroke.200`. The sentence was right and the count it predicted was low — which is the useful thing about writing a pattern down at the moment you notice it rather than at the moment it becomes unbearable.
- **`check:drift` will report both new variables as missing** against the live Figma file until somebody syncs.

## What would make us revisit this?

**A warning or success state.** Amber exists (`commerce.stock.low`, `mobility.surge`) and green is spoken for as Market's brand. The moment a form needs "saved" or "check this", the question is whether `text.error`/`border.error` were the first two members of a `feedback.*` family that should have been named as one — and the answer is a rename with a migration, not a new pair of names alongside them.

**A filled error state.** If an invalid field ever needs a tinted background rather than an edge, that is a third token (`surface.error`) and a fourth threshold question, and it should be argued rather than assumed to follow from these two.

**The two values diverging.** They are identical today by coincidence of the ramp, not by rule. The first time one moves without the other, this entry's argument is confirmed; if five years pass and they have never diverged, that is evidence the split was over-careful and worth re-reading.

**A border-width scale.** If one lands, the question of whether the invalid edge should also be heavier reopens — but as an addition to the colour signal, never as a replacement for it.
