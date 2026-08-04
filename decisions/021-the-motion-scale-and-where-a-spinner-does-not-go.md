# Decision 021 — The motion scale, the cycle that is not a tier, and reduced motion as a rule rather than a mode

**Date:** 2026-08-04
**Status:** accepted

## Context

`content/tokens/` had colour, dimension, elevation and typography, and nothing for duration or easing. Stage 4's first component found the hole from the inside.

[Decision 020](./020-the-button-consolidation.md)'s Button ships a busy indicator that cannot rotate and a hover that changes colour with no transition. `Button.css` named `--duration-500` for the spin, took no fallback, and said so in a comment: an unresolved `var()` makes the shorthand invalid at computed-value time, so the ring rendered static — "visibly unfinished, which is the honest state of a system with no motion tokens." `machinery/metadata/authored/button.json` carried the same gap as a declared `tokens_absent` entry, so the contract gate reported it on every run rather than letting it become folklore.

That is the correct behaviour for a component that wants a token the system has not decided, and it is not a state to leave the system in. This entry decides the tokens.

## Problem

What is the motion scale — how many duration tiers, where they stop, which easing curves get names — and where does one full revolution of an indeterminate spinner go, given that it is a cycle length and every duration tier is the length of a transition?

## Constraints

- **The token layer is not extended to make a component convenient.** 020 stated this as a constraint and then honoured it by shipping a broken spinner rather than writing `0.9s` into a stylesheet. The scale here is decided on its own terms, and the fact that Button wanted it is not an argument for any particular value in it.
- **One source of truth, and it projects outward.** `duration` reaches Figma as a FLOAT in milliseconds, which `machinery/scripts/check-drift.mjs` already handles. `cubicBezier` is a composite DTCG type and is skipped with a stated reason, exactly as `shadow` is.
- **Scripts for facts, agents for judgment** ([rule 4](../CLAUDE.md)). Anything a duration can be checked against has to end in a deterministic check, not in a maintainer remembering.
- **The tiers are conventional, not invented.** Motion durations are one of the few things in a design system where the industry has genuinely converged, and inventing a house ramp would be originality spent where it buys nothing.
- Two external references were consulted and they **disagree**, which is what made the easing question a decision rather than a lookup. Sources are named where they land, in the manner [`content/rules/rtl-arabic.md`](../content/rules/rtl-arabic.md) names Ahmad Shadeed.

## Options

For the shape of the scale:

1. **No motion tokens; each component picks its own durations and curves.**
2. **Duration tiers only**, easing left to components as CSS keywords.
3. **Duration tiers and named easing curves**, with the spinner cycle as a fifth duration tier.
4. **Duration tiers and named easing curves**, with the cycle in its own group.

For `prefers-reduced-motion`:

A. A **component** concern — each component writes its own media query.
B. A **rule layer** concern, on the model of `content/rules/rtl-arabic.md`.
C. A **mode dimension** — reduced motion becomes a third dimension and every duration resolves to `0ms` in it.

## Trade-offs

**Option 1 is what v0 did with spacing**, one layer over. The Stage 1 audit found four spacing rhythms because four teams each picked a number that looked right in the file they had open, and there is no reason motion would behave differently. Motion is in fact the worse case: a spacing inconsistency is visible in a screenshot and an easing inconsistency is not. Nobody can measure a curve by looking at two stills, which means motion drift is the kind that is never found by review — only by someone eventually noticing that the app feels uneven and having no way to say why.

**Option 2 is the tempting middle** and it is worse than it looks, because the thing it leaves to components is the half that cannot be reviewed. A duration written in a component is a number somebody can grep for. A curve written in a component is `ease-in-out`, which is what CSS does when you say nothing, and it will be everywhere within four components.

**Option 3's cost is the whole of the next section.**

**Option 4 costs a second group and the explanation of why it exists** — this entry — plus a naming surface that is one concept wider than a single ramp would have been. It is what was chosen.

**Option C for reduced motion is the interesting wrong answer** and it is argued at length below, because it is the one a token person reaches for first.

## Decision

`content/tokens/primitive/motion.json`, with three groups.

**`duration` — the transition ramp.** Numbered on the convention `space` and `radius` already use: the step number is the value as a proportion of the base step, ×100. The base step here is 100ms, so the number and the millisecond value coincide.

| token | value | for |
|---|---|---|
| `duration.0` | 0ms | a named zero, on `space.0`'s terms |
| `duration.100` | 100ms | hover, press, focus — instant |
| `duration.200` | 200ms | toggles, small reveals — micro |
| `duration.300` | 300ms | cards, modals, dropdowns — standard |
| `duration.500` | 500ms | full-screen, hero moments — large |

**`cycle` — its own group, not a fifth tier.** `cycle.spin` is 800ms: one full revolution of an indeterminate busy indicator.

**`easing` — four `cubicBezier` curves**, each named for the motion it describes rather than for its shape.

| token | value | for |
|---|---|---|
| `easing.entrance` | `[0.16, 1, 0.3, 1]` | something arriving |
| `easing.exit` | `[0.7, 0, 0.84, 0]` | something leaving |
| `easing.move` | `[0.65, 0, 0.35, 1]` | something moving within the screen |
| `easing.continuous` | `[0, 0, 1, 1]` | constant speed, for motion with no start and no end |

And **`prefers-reduced-motion` is a rule-layer job** — option B. It is not a mode dimension, and it is not left to each component to invent.

## Why

### A motion scale is a token-layer decision because motion is a system property and duration is where it is decided

The argument that motion belongs to components is that motion is felt rather than measured, and a felt thing is a design call at the point of use. That gets it exactly backwards. What a user perceives is not any one duration but the **consistency** of durations across an interface — a menu that opens in 200ms next to a sheet that opens in 450ms reads as two apps, and neither number is wrong on its own. Consistency across components is definitionally not a property any component can hold.

There is also a specific reason this system in particular cannot leave it to components: Mizan has **two products with deliberately different densities**, and the temptation is to make Move's motion faster because Move is the glanceable one. That is a per-product decision, which means it is a mode question, which means it has to be expressible in the token layer before anybody can even ask it. Today the ramp is identical in both products. The point is that it is now the kind of thing that *could* differ by a decision rather than by a component drifting.

Button behaved correctly under the old state and it is worth recording why, because it is the behaviour we want next time: it named the token it wanted, took no fallback so the gap was visible in the running app, declared the absence in its contract so the gate reported it, and refused to write a literal. The system found its own hole through a component and closed it in the token layer. That loop working is more valuable than the four numbers it produced.

### The tiers, and why 600ms is the ceiling

The four tiers are not evenly spaced and should not be. `100 → 200` doubles; `200 → 300` adds half; `300 → 500` adds two thirds. What is constant is not the ratio but the **question each tier answers**: how much of the screen is changing.

- **100ms answers the hand.** Hover, press, focus — the states that acknowledge an input. This tier must not be felt as a duration at all; past roughly 160ms an acknowledgement stops reading as a consequence of the input and starts reading as a response to it. Most of the motion in a working interface lives here, which is exactly why it is the cheapest tier to get wrong: an extra 100ms is paid twenty times a minute.
- **200ms answers a control.** A toggle, a checkbox, a disclosure. It is twice instant rather than half again, because two rungs that cannot be told apart are a longer list of the same decision.
- **300ms answers a panel.** Something arrives or leaves and enough of the screen changes that the eye needs the path and not only the endpoints.
- **500ms answers a screen**, and it has to be justified rather than selected.

**The ceiling is 600ms, and nothing in the ramp reaches it.** Past about 600ms a transition stops reading as the interface responding and starts reading as the interface making somebody wait — and the honest remedy at that length is a progress indicator, not a longer curve. There is no sixth tier because there is nothing above the ceiling that is still a transition.

**The tension with the reference, stated rather than smoothed over.** Emil Kowalski's material — he wrote Sonner and Vaul, so this is a practitioner's ramp rather than a guideline document's — holds that UI animations should stay **under 300ms**, and puts press feedback at 100–160ms. That is tighter than this scale. `duration.300` is kept as the *default* for a panel rather than demoted to a maximum, and `duration.500` is kept for the one or two moments a flow is allowed to be deliberate. The honest reading is that the reference is right about the vast majority of cases and this ramp is one rung more generous than it at the top, deliberately, because a system that cannot express a page transition has not solved the problem, it has declined it. A dropdown at 300ms and one at 200ms are both correct, and only one of them is ever noticed. That is written into `duration.300`'s own description so a reader meets it at the point of use.

### Easing curves are tokens even though Figma cannot hold one

`cubicBezier` is a composite DTCG type. Figma variables hold single values, so `check-drift.mjs` skips all four curves with a stated reason, exactly as it skips the three shadows. The dry run now reports **7 skipped** where it reported 3.

**A growing skip list is not a defect, and this is the entry that says so.** The skip list is a record of what the *display* cannot show. Treating it as a list of things not worth deciding would invert the system's whole direction — it would let the least capable consumer of the token set decide the vocabulary of it, which is the same failure as editing a generated file, arriving from further away. Figma cannot hold a shadow either, and nobody has proposed deleting the elevation scale.

The affirmative case is the one from the previous section, sharpened: **easing drifts more quietly than anything else in a design system.** A wrong hex shows up in a screenshot diff; a wrong curve does not show up anywhere except in the feel of the thing, and by the time somebody articulates it there are forty call sites.

One implementation fact, recorded because the obvious guess about it is wrong: the DTCG source is four bare numbers, and the generated CSS is a **complete function** — `--easing-entrance: cubic-bezier(0.16, 1, 0.3, 1)`. A consumer writes `var(--easing-entrance)` and never wraps it. That is stated in the token's own `$description`, because the generated CSS does not state it anywhere and the wrong guess produces `cubic-bezier(cubic-bezier(…))`.

`easing.entrance` is `[0.16, 1, 0.3, 1]` and its description says out loud that this is not the only defensible strong ease-out — `[0.23, 1, 0.32, 1]` is the same idea with a slightly softer entry, and a system that had picked it would not be wrong. **What would be wrong is a system carrying both.** The value of a curve token is almost entirely in there being one of them.

### `linear` gets a token, and it is not called `linear`

This is the question the two references disagree on, and the disagreement is the useful part.

- **Reference A**, a general UI-motion guide: *never* use the CSS keyword `linear`, because objects in the real world accelerate and decelerate and linear reads as robotic.
- **Reference B**, Kowalski: route easing by question, and *"is it constant motion (marquee, progress bar)? Yes → linear."*

Both are right about different things, and the resolution is a category distinction rather than a compromise. **A transition has a start and an end**, so it should accelerate and settle; linear on a transition is the robotic thing reference A is describing. **A spinner has neither** — it is a steady state — and an eased rotation visibly speeds up and slows down once per revolution, which reads as *struggling* rather than as working.

So the naive rule, "never linear", would have produced a worse spinner. And a token layer offering only eased curves would make the correct answer **unexpressible**: the component would write the bare keyword by hand, which is a value decided inside a component however small the value is, and it is the specific defect this whole layer exists to prevent.

Two further reasons the token earns its place:

- `cubic-bezier(0, 0, 1, 1)` **is** the definition of the `linear` keyword, not an approximation of it. The token is not a lossy restatement of something CSS already has.
- A named curve is reviewable and a keyword is not. `var(--easing-continuous)` on a transition reads as a wrong choice in a diff. A bare `linear` reads as no choice having been made, which is what it usually is.

**It is named `continuous` rather than `linear` on purpose.** Naming it for its shape would make it the obvious thing to reach for whenever no other curve seemed right, which is precisely when it is wrong. Naming it for the motion means using it on a transition requires writing a word that is false about a transition. That is a weak guard and it is the only one a naming layer can offer; it is written down here so that a future reader knows the name is doing work rather than being decorative.

### The spinner cycle is not a tier, and the number proves it

800ms could have been `duration.800` in one line. It is `cycle.spin` in its own group, for three reasons in ascending order of how much they generalise.

**The arithmetic gives it away.** The transition ramp sets its own ceiling at 600ms. 800ms is above that ceiling — so **if this were a fifth tier it would be an illegal one.** A value that violates its own ramp's stated rule is not a member of that ramp. That is the cleanest evidence available and it happens to be checkable.

**The two groups answer different questions.** A transition tier is chosen against *how much of the screen is changing*. A cycle is chosen against *how fast the loop reads*. Those have nothing in common, which means the same number means nothing in common in the two groups — and a scale on which neighbouring values are incomparable is not a scale, it is a list.

**Category errors in a token layer are load-bearing, because tokens are chosen by adjacency.** Somebody picking a duration scrolls the group and takes a neighbour. If the spinner cycle sits at the top of the transition ramp, then the fastest route to a slower modal is to reach one rung further — and the rung is a spinner's revolution, which is not a length anybody chose for a modal. In the other direction, a spinner that feels sluggish gets fixed by taking the tier below, which is a page-transition duration. Separating the groups means neither of those substitutions is one keystroke away.

**On the value itself.** 800ms rather than the 1s most spinner examples default to, because reference B claims a faster spinner makes an identical wait *feel* shorter — the load takes the same time either way and the perception does not. Not faster than that, because below roughly 600ms a 2px ring stops reading as something rotating and starts reading as something flickering. That figure is a judgment from watching it rather than a measurement, and it is recorded as one.

### `prefers-reduced-motion` is a rule, not a mode, and specifically not a token that resolves to zero

This is the question this entry exists for, and option C — reduced motion as a third mode dimension in which every duration resolves to `0ms` — is the answer that looks most like the rest of the system and is wrong.

**It is wrong first because reduced motion is not zero.** The preference does not say "no animation"; it says the user is sensitive to *motion*, and the well-supported reading — reference B states it plainly — is **fewer and gentler animations, not none**. Opacity and colour transitions aid comprehension and cost nothing to a vestibular system. Movement and position animations are the ones to remove. A dimension that substitutes `0ms` everywhere cannot make that distinction, because it operates on the *value* and the distinction is about the *property*.

**It is wrong second, and worse, because of what it does to the spinner.** A reduced-motion mode that zeroes every duration stops `cycle.spin`, and a busy indicator that stops indicating is not an accommodation — it is a bug that reports the wrong system state, shipped to exactly the users least able to afford confusion about it. An accessibility feature whose failure mode is lying about whether the app is working is not an accessibility feature.

**It is wrong third for the reason [decision 014](./014-direction-is-not-a-mode-dimension.md) already gave about direction.** A third dimension multiplies the mode matrix from four combinations to eight. Every declared pair in `pairs.json` would then be resolved and reported in eight combinations instead of four — for a dimension in which **not one colour value changes.** 014 refused a dimension on precisely this basis, and the refusal generalises: a mode dimension is for a question whose answer is a *value*, and reduced motion's answer is a *behaviour*.

**And it is wrong fourth on ownership.** A mode is something the system chooses. `prefers-reduced-motion` is something the user's operating system declares, and the platform already has the mechanism for it. Putting it in the mode matrix means the token layer has to be told something the browser already knows, and told it by a build.

**Option A — leave it to each component — is rejected for the reason [rule 3](../CLAUDE.md) rejects an RTL agent.** Every component would answer independently, Button's answer would differ from Card's, and the answers would be discovered one at a time by whoever was affected. Correctness that has to be remembered is correctness that will not happen.

**So it is a rule layer, on exactly the model of `content/rules/rtl-arabic.md`**: written once, read by every agent and every human, unavoidable rather than invoked. The rule, stated here so it can be lifted whole:

> **Reduced motion means fewer and gentler, never none.** Remove movement and position animations — translates, scales, slides, anything that changes where a thing is or how big it is. Keep opacity and colour transitions, which aid comprehension and carry no motion. Keep indeterminate progress indicators rotating: an indicator that stops indicating reports the wrong system state. Never use the blanket `animation-duration: 0.01ms !important` override — it cannot tell a slide from a spinner, and the spinner is the one case where it is actively harmful.

**`content/rules/motion.md` is owed**, on the same terms decision 019 owed a `kind` field to `pairs.json`. This entry does not own `content/rules/`, and the rule above is written out in full so that creating the file is transcription rather than a second decision.

**And this is where `duration.0` comes in, which is a different thing from option C and the difference is the whole refusal.** `duration.0` is a named zero on exactly `space.0`'s terms — a component removing a transition states it as a token rather than dropping out of the system. What makes it legitimate where the mode is not: selecting `duration.0` is a component deciding, **one property at a time**, that the thing being removed is movement. A global substitution decides nothing and cannot tell a slide from a spinner. The token is the mechanism the rule reaches for; the mode would have been a mechanism that replaced the rule with an average.

## What this proves

[Rule 7](../CLAUDE.md): that a token layer can be extended under pressure from a component **without being designed backwards from it** — the component named what it wanted, the system decided the scale on its own terms, and the one name the component had already chosen (`--duration-500` for a spinner) was refused, because 500ms is a transition tier and a spinner cycle is not a transition. It also proves that a category distinction can be enforced by structure rather than by documentation: the two groups exist so that the wrong substitution is not adjacent to the right one.

## Consequences

- **The Button spins.** `Button.css` now takes `var(--cycle-spin) var(--easing-continuous)`, and the `tokens_absent` entry in `machinery/metadata/authored/button.json` is empty for the first time. The contract gate went red in between, correctly — a declaration nothing exercises is a note pretending to be a check — and that red is the gate doing its job on a closed gap rather than an open one.
- **The name the component picked did not survive.** `Button.css` said the indicator "starts spinning the day the scale is declared with no change to this file." That turned out to be false, and it is the most instructive consequence here: the component successfully avoided writing a motion *value* and still took a motion *name*, and the name was the wrong category. Naming the token you wish existed is the right move; being right about it is a separate thing.
- **The Figma skip list grew from 3 to 7** and the projection from 76 variables to 82. Six duration tokens project as FLOAT in milliseconds and carry a `value-narrowed` warning saying so; four curves are skipped as composites. `check-drift` against the live file will report the six as missing until somebody syncs.
- **The mobile outputs are unchanged.** `build-tokens.mjs` emits only `color` and `dimension` to iOS and Android, so neither duration nor easing appears in the Swift or XML. That is the existing rule working as written — whether a duration is a `TimeInterval` or a millisecond `Long` is knowledge about the token rather than about its shape — and it means **the motion scale is a web-and-Figma decision that the mobile targets currently cannot see.** Recorded because it is a real limit and not a rounding error.
- **There is now a `linear` in the system**, under a name that hides it. If it turns up on a transition, the naming guard failed and the answer is a lint rule, not a rename.
- **`content/rules/motion.md` is owed**, with the rule text above.
- **The tiers can now differ by product and do not.** That is a question somebody can now ask, and the answer today is no.

## What would make us revisit this?

**A second cycle length.** `cycle` currently has one member, which is the weakest possible evidence that it needed to be a group. A skeleton shimmer or a pulsing live indicator would be the second, and if none ever arrives then the honest reading is that this was a category distinction with a population of one — still correct, and cheaper to have made as a comment.

**`easing.continuous` appearing on a transition.** The name is the only guard, and a guard that fails once has failed. The response is a deterministic check that rejects it in a `transition` declaration, not a stricter name.

**A component that needs a duration between two tiers and cannot round to either.** The ramp is four rungs on purpose. If a real case needs 250ms and 200 and 300 are both visibly wrong, the ramp is under-specified in the range where most motion lives, and the fix is a rung — not a component-local value.

**Reduced motion turning out to need a value the rule cannot express.** If the honest implementation of "fewer and gentler" turns out to require a *different curve* under the preference rather than a removed animation, then there is a second easing set and the mode-dimension question reopens with a real argument behind it instead of a plausible one.

**A per-product motion difference.** If Move's glanceability turns out to need a faster instant tier than Market's, `duration` becomes the second thing in the system that resolves by product ([decision 022](./022-control-geometry-resolves-by-product.md) is the first), and that is an entry rather than an edit.
