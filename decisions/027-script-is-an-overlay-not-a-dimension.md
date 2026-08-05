# Decision 027 — Script is a mode that is not a dimension, and the gate had been saying so for weeks

**Date:** 2026-08-05
**Status:** accepted

## Context

Six of the seven Stage 4 components rendered Arabic in the Latin font stack. Every component wrote `font-family: var(--font-family-sans)` — `system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`, a stack with no Arabic face in it — and only `Button.css` overrode it, with two `:lang(ar)` rules of its own. Measured in Storybook with `lang="ar"` correctly applied, Button's Arabic story computed `IBM Plex Sans Arabic` and ProductCard's computed `system-ui`. Same conditions, different result, and each of the six shipped an Arabic story that looked like a demonstration of Arabic support.

[Decision 013](./013-script-is-a-mode-not-a-parallel-scale.md) had settled the architecture a day earlier — one set of typography names, resolved by script — and carried an implementation gap notice saying so. Button's rules were a local implementation of a system-wide mechanism that did not exist. Six components did not write those rules, and nothing existed to notice.

**Except that something did.** All 40 warnings from `check:schema` are `unused-primitive`, and four of them were `font-family.arabic`, `line-height.arabic-tight`, `line-height.arabic-normal` and `line-height.arabic-relaxed` — *"a primitive with no consumer is a value nobody decided to use."* The gate had been reporting this defect from the day the Arabic tokens landed. It went unread because the list is forty long and mostly noise from dimension primitives that CSS consumes directly, which the token graph cannot see.

[Decision 026](./026-the-stroke-scale.md), written the day before this one, ends with the trigger: *"The `unused-primitive` warning reaching a count nobody reads. At 40 it is already a list people skim. If a real unused primitive ever hides in it, the gate needs to learn that CSS consumes primitives directly."* One was hiding in it. The trigger fired within a day of being written, which is the strongest argument this log can make for writing triggers down.

## Problem

Where does the script mode live — in each component, in one shared stylesheet, or in the token layer — and if the token layer, is script a third mode dimension?

## Constraints

- **013 already decided the mechanism.** Script is scoped to a subtree by `:lang()`, not applied at the document root, because an Arabic page contains Latin runs and an English page contains Arabic ones. 013 calls this *"a genuine asymmetry between dimensions and the mode machinery has to tolerate it."*
- **Rule 2.** `machinery/` may not know that `arabic-normal` is the counterpart of `normal`, or that a multiplier applies to font sizes. That is content's knowledge.
- **013's shape rule.** The two scales must stay the same shape, and the optical correction is *one multiplier* precisely so it cannot drift.
- The build emits semantics as `var()` references rather than resolved literals, so overriding a primitive reaches everything derived from it.

## Options

1. **Six copies of Button's block.** Every component gets its own `:lang(ar)` rules.
2. **A shared component stylesheet**, on `styles/focus.css`'s model — a shared construction extracted once, opted into by name.
3. **A third mode dimension.** `script` joins `theme` and `product` in the cartesian product; four combinations become eight, as 013 predicted.
4. **An overlay** — a mode that is composed on top of whichever combination is active and emitted as one additional block under a content-declared selector.

## Trade-offs

**Option 1** is what produced the defect. Its cost is not the duplication, it is that the rule has to be *remembered* per component, and six components forgot. That is the argument the RTL rule layer already makes and [rule 3](../CLAUDE.md) already accepted: correctness that has to be invoked is correctness that will not happen.

**Option 2** is the strong candidate and it has a direct in-repo precedent: `styles/focus.css` exists because 022 named a component token layer that does not exist, and *"until it exists, a shared stylesheet is where a shared construction lives."* What makes it wrong here and right there is *what is being shared*. Focus geometry is a construction — an arrangement of two colours that no token expresses. This is a **name resolving to a different value**, which is the definition of a mode and something the token layer already does four times over. Putting it in `packages/` would also put content knowledge there — that `normal`'s Arabic counterpart is `arabic-normal` — which is the leak [018](./018-the-preview-reads-the-build-output.md) records for the preview and does not recommend repeating.

**Option 3 is 013's own stated consequence and it does not survive contact.** Making script a dimension multiplies four combinations into eight — and produces four pairs that are byte-identical, because no Arabic typography value depends on theme or product. The Arabic face is the same face in dark Move as in light Market. Worse, it doubles the work of every gate that resolves something in every combination: `check-contrast` would resolve all 80 declared pairings twice, for a dimension **in which not one colour value changes**. That sentence is not new. It is [decision 014](./014-direction-is-not-a-mode-dimension.md)'s refusal of direction, word for word, and it applies to script for exactly the same reason.

**Option 4** costs a new concept in the mode machinery, and a reader now has to know that a manifest has two kinds of entry.

## Decision

**Script is an overlay: a mode that is deliberately not a dimension.**

`content/tokens/modes.json` gains an `overlays` list beside `dimensions`. An overlay names a mode file and the **selector** it answers to, and content states the selector because only content knows what selects its subtree. `content/tokens/modes/script.arabic.json` re-points four names at their counterparts — `font-family.sans` and the three `line-height` steps — by alias, never by restated value. The build emits one additional CSS block, last in the file, under `:lang(ar)`.

Nothing in any component changed. Button's two local rules were **deleted**, because the two declarations it already had now resolve correctly on their own.

**An overlay emits two blocks, not one, and the second is the one review found missing.** Custom properties inherit. The overlay redefines names on the subtree its selector matches, so an island inside that subtree which does *not* match the selector inherits the overlaid values — there is no declaration for it to fall back to. For a script overlay that is precisely the mixed-content case: a `lang="en"` run inside an Arabic page was rendering in the Arabic face at Arabic leading, **measured, not theorised**. So a restore block follows, at `<selector> :not(<selector>)`, carrying the base values.

That is worth stating plainly because the first version of this decision shipped without it and **claimed the opposite in its own Constraints section** — quoting 013's *"an Arabic page contains Latin runs"* as the reason for subtree scoping while implementing a scope with no way back out. Subtree scoping only buys the mixed-content case if there is a restore. The deleted Button rule, the "wrong-place" mechanism, handled it correctly by accident: `.mz-button:lang(ar)` simply did not match a Latin button.

**The optical size correction is not included, and that is the open half.** `font-size.arabic-scale` is a *multiplier*, and a mode file states values rather than computing them. Expressing it as a mode means either eight hand-written Arabic sizes — the drift 013 created a single multiplier to prevent — or teaching the build to multiply, which is brand knowledge and rule 2 keeps it out of `machinery/`. So it stays as one `calc()` on Button's label, and `font-size.arabic-scale` remains the one Arabic primitive `check:schema` still reports as unused. **The gate now names precisely the half that is undone, which is the most useful state an unfinished thing can be left in.**

## Why

**Because a dimension is a claim that values differ across the matrix, and this one's do not.** The cartesian product is the right shape for theme and product, whose values genuinely vary per combination. It is the wrong shape for a mode whose values are constant across all four — the product would materialise four identical copies and charge every gate double for them. 014 refused direction on that arithmetic; refusing to apply the same arithmetic to script would make it a precedent rather than a rule.

**Because the token layer is where a name resolving to another value belongs.** The whole fix is that `var(--line-height-normal)` means 1.5 on a Latin page and 1.75 on an Arabic one. Every component already wrote that. The defect was never in the components — it was that the name had nothing behind it, and six components did not know they were supposed to compensate by hand.

**Because the fix deletes code rather than adding it.** Button lost two rules. No component gained any. A fix for "six components are missing a rule" that ends with *seven* components not needing the rule is the shape that says the rule was in the wrong place.

## Consequences

- **All seven components render Arabic in `IBM Plex Sans Arabic`**, verified in the browser rather than in the CSS: every Arabic story computes the Arabic face, Button at leading ratio 1.45 (`arabic-tight`) and the rest at 1.75 (`arabic-normal`). Latin is untouched — `system-ui` at 1.5 — which is checked as a regression rather than assumed.
- **`check:schema` drops from 40 warnings to 36.** Four `unused-primitive` warnings were real and are now gone. The one that remains on `font-size.arabic-scale` is the deferred half, correctly reported.
- **`check:contrast` is unmoved at 70 / 4 / 6.** That number not moving is the point of the whole decision: an overlay adds no combinations, so it costs the gates nothing.
- **The adapter refuses an overlay that collides with a dimension.** If an overlay changes a path that varies across the matrix, which block renders would be decided by selector specificity rather than by anybody, so it is an error — `overlay-collides-with-dimension` — with a fixture proving it.
- **Overlays are emitted for CSS only, and the reason is structural.** An overlay applies to a subtree; a Swift enum and an Android resource file are flat tables with no subtree to apply it to. Emitting one there would mean picking a winner globally, which is the opposite of what an overlay is. **So the Arabic typography does not reach the mobile outputs at all** — the same limit 021 recorded for motion, arriving for a different reason.
- **The Figma plugin recognises overlays and does not project them.** Figma resolves a variable per mode of its collection, for the whole document, so the faithful projection would be a script collection re-resolving the typography names — a decision about the Figma file rather than a translation of one. The primitives it aliases do project, so the *values* are all in the file; the **mapping between them is not**, and a designer picking `line-height/normal` in Figma gets the Latin value. That is owed.
- **A second implementation of mode discovery had to learn the same word.** `machinery/figma-plugin/src/core/token-model.ts` reimplements the token model in TypeScript, and it failed on the new mode file with the old error message — which is how it was found. `projection.mjs` exists precisely because a rule stated twice can disagree silently; this is a second place where the same thing is true and there is no shared copy. Recorded rather than fixed.
- **A false claim in `Dialog.css` was resolved by being made true.** Its title comment claimed "Arabic leading" while writing `line-height.normal`, which was 1.5 — a Latin value. The right choice described by the wrong mechanism. The declaration did not change; what it resolves to did, and both the comment and `Dialog/README.md` now say so rather than quietly reading as though they were always correct.
- **`selftest` goes from 217 to 224 assertions**, on two new fixture roots: an overlay does not multiply the matrix, a colliding overlay is refused, the overlay block is emitted after every combination block, and a restore block follows it. The order assertion reads **emitted CSS** rather than the model, and it exists because every other assertion here would still pass if the emitting loop were moved above the combination loop — while Arabic silently reverted to Latin leading. A mechanism whose correctness reduces to "last wins" needs one check that it is last.
- **Two guards that make asserted invariants true.** A mode may not be claimed by both a dimension and an overlay (`overlay-claims-dimension-mode`), and two overlays may not share a name (`duplicate-overlay-name`) — a name reaches a build-artefact filename, so a duplicate silently emitted one overlay's values under the other's selector. Both were comments claiming a property nothing enforced.
- **The two implementations of overlay parsing disagree on strictness.** `lib/tokens.mjs` errors on an overlay entry missing `name` or `selector`; the plugin's TypeScript copy checks only `mode`. So a malformed manifest passes `figma:dry-run` and fails `build:tokens` — the same file, two verdicts. That is a sharper statement of the duplication noted below than "the error messages differ", and it is recorded rather than fixed.
- **The preview still hand-writes the approximation.** `packages/preview/src/app.css` and `compare/rebuilt.css` carry eight `:lang(ar)` rules that predate this change, and Button's deleted comment called them "the same approximation the preview uses". Deleting Button's copy and leaving those means the claim that this fix *"deletes code rather than adding it"* is true of the component library and not of the repository. [Decision 018](./018-the-preview-reads-the-build-output.md) is the licence for the preview to hold content knowledge, so this is defensible — but it is stated here rather than left to be discovered.

## What would make us revisit this?

- **An overlay value that depends on theme or product.** The moment an Arabic token needs a different value in dark than in light, this stops being an overlay and becomes a dimension, and 013's four-to-eight arithmetic is correct after all. The adapter already refuses the halfway state.
- **A second overlay.** One is a mechanism with a single user, which is the same standing `cycle.spin` has in the motion scale. A second would tell us whether `overlays` is a general shape or a special case wearing a general name.
- **Figma needing the mapping.** The first designer who picks a line-height variable for an Arabic frame and gets the Latin value is the trigger for deciding the script collection, and that is its own entry.
- **The optical correction finding an expression.** If DTCG grows arithmetic, or if a `$extensions` hint can carry "multiply this group by that token" without machinery learning what the tokens mean, the deferred half lands and `font-size.arabic-scale` leaves the unused list.
- **The `unused-primitive` list still being unread.** This entry exists because a real warning hid in forty. Splitting the list — primitives consumed by CSS are a known class and could be declared as such — would make the remainder mean something. Until then the gate is right and nobody is looking, which is the failure mode this decision got lucky on.
