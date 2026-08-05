# The motion rule layer

**Status: living document.** Rules are added here as they are decided, and this is the only place they are decided. When a new rule is settled it goes in this file — never into a single component, and never into an agent's instructions.

## Why this file exists rather than an agent

The same reason [`rtl-arabic.md`](./rtl-arabic.md) exists rather than an RTL agent, and [decision 021](../../decisions/021-the-motion-scale-and-where-a-spinner-does-not-go.md) makes the argument in full. Reduced motion is not a review step and not a specialist's job. If every component answered the question independently, Button's answer would differ from Dialog's and the difference would be discovered one at a time, by whoever was affected. **Correctness that has to be remembered is correctness that will not happen.**

This file is the rule half of decision 021. The token half is `content/tokens/primitive/motion.json`, and the two are meant to be read together: the tokens say what values exist, this file says which one to pick and when not to animate at all.

## Sources

- **WCAG 2.2**, for the two success criteria that govern animation — [2.3.3 Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) (Level AAA) and [2.2.2 Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html) (Level A). Both carry an *essential* exemption. §4 below reads them narrowly: they establish that an exemption of this kind exists, and neither of them names this one.
- **Emil Kowalski's design-engineering material**, the practitioner source behind the easing-by-question rule in §2 and the "fewer and gentler" reading in §4. Where it disagrees with the token ramp, §1 says so rather than smoothing it over.
- **Apple's motion guidance**, translated for the web, for the reduced-motion posture in §4 and the additional preference signals recorded as open questions in §6.

Everything taken from these was checked against the shipped components before being written down. Where a rule here describes something the library does not yet do, it says so.

---

## 1. Choosing a duration

Pick against **how much of the screen changes**, never against how important the change feels.

| Tier | Value | For |
|---|---|---|
| `duration.0` | 0ms | No motion, stated as a token rather than by omission |
| `duration.100` | 100ms | Hover, press, focus — the states that answer the hand |
| `duration.200` | 200ms | A toggle, a checkbox, a disclosure — only the control redraws |
| `duration.300` | 300ms | Cards, modals, dropdowns — a panel arriving or leaving |
| `duration.500` | 500ms | Full-screen changes, and the one or two moments a flow is allowed to be deliberate |

**Never write a duration.** If none of these tiers fits, that is a decision to bring to the log, not a number to write into a component. A duration written in CSS is a value decided inside a component, which is the defect the whole token layer exists to prevent.

**`duration.0` is a choice, not an absence.** A component removing a transition selects the named zero, on exactly the terms `space.0` is selected. Dropping the property instead removes the transition from the system's view.

**The top of the ramp is one rung more generous than the reference, deliberately.** Kowalski's material holds that UI animation should stay under 300ms; `duration.300` is kept as the *default* for a panel rather than as a maximum, and `duration.500` exists for the rare deliberate beat. The reference is right about the vast majority of cases. A system that cannot express a page transition has not solved the problem, it has declined it.

## 2. Choosing an easing

Pick by asking what the element is doing, not what the curve looks like.

| Curve | For |
|---|---|
| `easing.entrance` | Something arriving — a menu opening, a sheet rising, a toast appearing |
| `easing.exit` | Something leaving. Not `entrance` reversed: a thing going away has no destination the eye needs to watch it reach |
| `easing.move` | Something moving within the screen, present at both ends — a card reordering, a thumb crossing a switch |
| `easing.continuous` | Constant speed, for motion with no start and no end |

**`easing.continuous` may not appear on a transition.** It is exactly the CSS `linear` keyword, and linear on a transition is the robotic motion every guideline warns about. It is named for the motion rather than the shape precisely so that using it on a transition requires writing a word that is false about a transition. That is a weak guard, it is the only one a naming layer can offer, and **if it ever turns up on a transition the answer is a lint rule, not a rename.**

**Never write a bare `linear`, `ease`, `ease-in-out` or a hand-rolled `cubic-bezier`.** A named curve is reviewable in a diff; a bare keyword reads as no choice having been made, which is usually what it is.

## 3. Continuous motion is not a transition

A transition has a start and an end. A cycle has neither. They are different groups in the token layer and the separation is structural, not cosmetic: `cycle.spin` sits above the transition ramp's own ceiling, so **as a fifth duration tier it would be an illegal one.**

The practical rule: a spinner's revolution is chosen against *how fast the loop reads*, a transition against *how much of the screen changes*. Never substitute one group's value for the other's — not to make a modal slower, not to make a spinner faster.

An eased rotation visibly speeds up and slows down once per revolution, which reads as **struggling** rather than as working. Continuous motion takes `easing.continuous`, always.

## 4. Reduced motion

This is the rule the file exists for. It is transcribed from decision 021, which wrote it out in full so that creating this file would be transcription rather than a second decision.

> **Reduced motion means fewer and gentler, never none.** Remove movement and position animations — translates, scales, slides, anything that changes where a thing is or how big it is. Keep opacity and colour transitions, which aid comprehension and carry no motion. Keep indeterminate progress indicators rotating: an indicator that stops indicating reports the wrong system state. Never use the blanket `animation-duration: 0.01ms !important` override — it cannot tell a slide from a spinner, and the spinner is the one case where it is actively harmful.

### Why the spinner is exempt, and what the specifications do and do not say about it

Decision 021 argued this from first principles — *an accessibility feature whose failure mode is lying about whether the app is working is not an accessibility feature* — and **that argument is the one this rule rests on.** The success criteria below are consistent with it. Neither adjudicates it, and an earlier version of this section claimed they did.

- **2.3.3** (Level AAA, which Mizan does not target) requires that interaction-triggered motion animation can be disabled *"unless the animation is essential to the functionality or the information being conveyed."* Its own examples are parallax and scroll-triggered movement, not busy indicators. And WCAG's definition of *essential* has a second half — the information cannot be conveyed another way that would conform — which a spinner arguably fails, because `aria-busy` with a static "Loading…" carries "the system is working" without motion. **What the criterion supports is that an exemption of this kind exists. It does not name this one.**
- **2.2.2** (Level A) governs content that moves for more than five seconds. Its *Understanding* document — informative, not the criterion's normative text — treats a preload animation as essential *when interaction cannot occur during that phase*. Button's indicator sits on one control in a page that stays interactive, so the condition is not met as written.

**The honest summary is that the criteria are consistent with this position and neither settles it.** The reason the spinner keeps turning is 021's, and it does not need borrowed authority: an indicator that stops indicating reports the wrong system state, and the users least able to afford that confusion are the ones the preference is for.

### What this means in practice

Guard the **property**, not the duration. Zeroing a duration on a `transform` leaves the control still snapping to its pressed size — a scale that merely happens instantly, which is movement with the reading time removed rather than movement removed.

```css
@media (prefers-reduced-motion: reduce) {
  .thing:active { transform: none; }          /* the movement itself, removed */
  .thing { transition-duration: var(--duration-0); }
}

/* `transition-duration` is LIST-valued. One value applies to every transitioned
   property, so the block above also zeroes the colour crossfade this rule says
   to keep. On an element transitioning more than one property, restate the list
   with the movement at zero and the rest at its tier. Button's list is
   `transform, background-color`: */
@media (prefers-reduced-motion: reduce) and (hover: hover) and (pointer: fine) {
  .thing { transition-duration: var(--duration-0), var(--duration-100); }
}
```

**That second block is not optional polish.** Without it the rule contradicts itself: `duration.0` applied to a list removes the colour transition, which is the one thing §4 says to preserve, and the failure is invisible in a screenshot. `Button.css` carries both blocks and says why.

### What the library does today

Only two declarations in the whole component library move anything, and both are in Button:

| | Under `prefers-reduced-motion: reduce` | Why |
|---|---|---|
| Press scale (`transform: scale(0.97)`) | **Removed**, and the transition it rode on stated as `duration.0` | The only movement in the library, and it is polish rather than information |
| Hover colour transition | **Kept**, at `duration.100` | It says which control the pointer is on, and nothing about it moves |
| Busy indicator (`cycle.spin`) | **Keeps rotating**, unchanged | §4 above, and both success criteria |
| Focus indicator | Unchanged | It never transitioned — see `styles/focus.css` |

Dialog states the question and changes nothing, because it has no motion to reduce. **That is the correct shape for a component with nothing to do here** — the absence is recorded rather than left ambiguous, so a reader can tell "considered and not needed" from "never considered".

## 5. Motion and direction

`content/rules/rtl-arabic.md` owns direction, and two of its rules are motion rules from the other side. They are cross-referenced rather than restated, because a rule stated twice is a rule that can disagree with itself.

- **Transforms do not flip.** `translateX(6px)` moves six pixels rightward in both directions, so an arrow that nudges forward on hover in English nudges backwards in Arabic. A transform that means "forward" either takes its sign from the direction or is not used. (rtl-arabic §1.)

  rtl-arabic offers `margin-inline-start`/`inset-inline-start` as the alternative, and that advice is about **static layout**. Do not lift it into motion: those are layout properties, and animating one runs layout on every frame. `Button.css` states the opposing rule — *"No geometry property transitions, so no state change in this file can cause a layout"* — and `Input.css` and `RideCard.css` each repeat it. In a *transition* the answer is the first branch: derive the transform's sign from the direction, or do not animate the position at all.
- **Rotation is not mirrored.** Clockwise is clockwise in every locale, for the same reason a clock does not mirror. The busy indicator spins the same way in both directions. (rtl-arabic §5.)

The press scale is the one transform in the library and it is deliberately a `scale` rather than a `translate`: **a scale is the only transform with no side.**

---

## Open questions — decided later, recorded here

These are genuinely unsettled. They are listed so that nobody quietly settles them inside a component.

- **The other two preference signals.** `prefers-reduced-transparency` and `prefers-contrast: more` are real user preferences the system does not currently answer. The first has an obvious consumer — [decision 025](../../decisions/025-the-scrim-is-one-value-and-carries-no-pairing.md) gave the scrim a single translucent value and explicitly refused it a contrast pairing on the grounds that a translucent value has no rankable contrast, which is precisely the case `prefers-reduced-transparency` exists for. Whether the answer is a rule here, a second scrim token, or nothing at all is undecided, and it is not decided here because 021 did not decide it.
- **Whether motion tiers differ by product.** They could — Move is the compact, high-stakes product and a case could be made that it should move faster. Today they do not, and nobody has produced the case. [Decision 022](../../decisions/022-control-geometry-resolves-by-product.md) is the shape this would take if the case arrives.
- **A second cycle length.** `cycle.spin` is a category with one member. A marquee or an indeterminate progress bar would make it a scale, and the numbering convention would need deciding at that point rather than now.

When any of these is decided, it moves out of this section into the rules above and gets a Decision Log entry.
