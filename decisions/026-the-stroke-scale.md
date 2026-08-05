# Decision 026 — Ink gets its own scale, and it is two values because two is what the library draws

**Date:** 2026-08-05
**Status:** accepted

## Context

Seven components shipped in Stage 4, and every one of them wrote a literal `1px` for its border. Each did so deliberately, and each said so in a comment. The count was tracked as it grew: Button called it "the one number in this file that is written rather than resolved," Input said it was "now the second component to route around it," [decision 023](./023-the-error-semantic-is-two-tokens.md) called two occurrences "a pattern rather than an incident," Dialog's README called five "the strongest evidence one is owed," and Navigation's said it was "the last component of the stage to route around its absence."

Nobody was wrong at any single step. The argument each component made was that `border.default` and `border.control` are colours and not widths, that reaching for `space.25` would produce a 2px edge chosen because a spacing token happened to be nearby, and that an honest literal with the gap written down beats a token invented backwards from one component. That is a good argument for the first component. It is a worse argument for the seventh.

Meanwhile a second thing had happened quietly. Four places needed a 2px stroke — the focus outline, Button's busy indicator ring, ProductCard's low-stock mark and RideCard's surge mark — and all four took it from `space.25`, the spacing step that happens to be 2px. Button's own comment approved of this, noting that `space.25` "is a token, so this is a named value rather than a written number, unlike the border width at the top of the file." So the library had settled into drawing its hairlines with a literal and its emphatic strokes with the spacing scale, and considered the second of those an improvement on the first.

## Problem

Does the system get a scale for stroke width, and if so, what is on it and where does it live?

## Constraints

- `border.*` in `content/tokens/semantic/shared.json` is already a **colour** namespace — `border.default`, `border.control`, `border.error`. A width cannot join it without the same name meaning two things.
- Components consume dimension primitives **directly** (`--space-100`, `--radius-100`); only colour goes through a semantic layer, and `control.*` is the one exception. Whatever is built has to fit that pattern rather than announce a new one.
- [Decision 017](./017-primitives-are-hidden-from-publishing.md) hides primitives from Figma publishing, so a primitive-only scale is invisible to designers picking variables. That is a real cost and it applies to `space` and `radius` already.
- No component needs a third width today. Rule 7 applies: an artifact that proves nothing does not get built.

## Options

**A. Keep the literals.** Seven identical values, each with a comment explaining itself. Costs nothing, changes nothing, and the comments are genuinely good.

**B. A semantic layer — `border.width.default`, `border.width.emphasis`.** Reads well at the point of use and survives a change of value. Collides with the existing `border.*` colour namespace, and adds a layer no other dimension in the system has.

**C. A primitive ramp — `stroke.100`, `stroke.200`, consumed directly.** Matches exactly how `space` and `radius` are already consumed. Loses the semantic naming, so the CSS says how thick rather than why.

**D. Mirror the references — a five-step ramp including 0 and 4px.** Polaris ships five steps; Primer ships four. Complete, conventional, and mostly unused on day one.

## Trade-offs

**A** is the status quo and its cost is not the seven literals — it is that the system cannot express the difference between 2px of ink and 2px of emptiness. `styles/focus.css` had `var(--space-25)` on two adjacent lines, once as the outline width and once as the outline offset. Those are different things that happen to share a number, and the file could not say so. That is precisely the failure [decision 008](./008-the-colour-consolidation.md) refused for colour when it kept `commerce.discount` and `mobility.safety` apart at 1.31 ΔE00: **value coincidence is not semantic identity.** Holding that line for colour and abandoning it for dimension is not a principle, it is a habit.

**B** costs a collision. `border.default` is a colour and `border.width.default` would be a width, one keystroke apart, in a system whose whole claim is that names carry meaning. Renaming the colours to `border.color.*` is the clean version and it is a breaking change to five components and the preview for a naming problem that option C does not have.

**C** costs the semantics. `border-width: var(--stroke-100)` says *one hairline*, not *this is a control edge*. The mitigation is that the description carries the meaning and the component comment carries the intent, which is how `space` and `radius` already work — nobody has argued `space.200` should be `gap.related-items`.

**D** costs honesty. A 4px step would be in the file because Polaris and Primer have one, not because anything in Mizan draws it, and the first component to want a thick stroke would find a value nobody had designed for its use.

## Decision

**A primitive `stroke` ramp in `content/tokens/primitive/dimension.json`, with two steps.** `stroke.100` = 1px, the hairline; `stroke.200` = 2px, the emphatic stroke. Numbered against its own base of 1px, in the same style as `space` and `radius` and — like `radius` — on a base of its own.

All seven components migrate off the literal. The four `space.25` strokes migrate to `stroke.200`. The outline **offset** in `styles/focus.css` stays on `space.25` and the box-shadow spread stays on `space.100`, because an offset is a gap and a spread is an extent; only the outline width is ink.

**No `stroke.0`, and no 4px step.** Both are refused below.

## Why

The count is the argument. One literal is a judgment call, two is a coincidence, and seven is a scale that exists in the components and not in the token layer — which is the definition of a value the system has decided and failed to write down. The comments tracking the count were doing the token layer's job in prose.

**Why its own scale rather than a reach into `space`.** Every mature system consulted keeps stroke separate from spacing: [Polaris](https://polaris-react.shopify.com/tokens/border) ships five border-width tokens (0, 0.66px, 1px, 2px, 4px), [Primer](https://primer.style/foundations/primitives/size) ships four (`thin`/`default` at 1px, `thick` 2px, `thicker` 4px), and Spectrum's `border-width-100` is 1px on a scale of its own. None of them expresses a stroke as a spacing step. They are right, and `focus.css` shows why in two lines: a gap and a stroke can share a number for years and then need to diverge, and a system that spent that whole time calling them the same token cannot tell which call sites meant which.

**Why a primitive and not a semantic layer.** Because that is what the file next door already does. `space` and `radius` are primitives consumed directly by components, and a stroke scale that arrived with a semantic layer would be claiming a significance the other two lengths do not have. The `border.*` collision settles it beyond preference.

**Why two steps.** Because two is what the library draws. This is the point where the references were consulted and then declined: Polaris and Primer both carry a 4px step, and Mizan does not draw one. A ramp is not made more correct by having the same number of rungs as somebody else's.

**Why no `stroke.0`.** `space.0` exists on the stated argument that a component removing a gap should say so in a token rather than dropping out of the system, and the symmetry is tempting. It does not transfer. The four `border: 0` sites in this library — Dialog's `<dialog>` reset, RideCard's `<fieldset>` reset, and the two visually-hidden clip recipes on `RideCard.css`'s real radio and `ProductCard.css`'s hidden text — are shorthand resets of a *browser* default, not the system stating a width of nothing. (This read *three* sites and named a ProductCard button reset that does not exist. The refusal survives site by site — all four strip a UA default and none was ever a Mizan width — but the miscount is worth leaving visible in an entry whose central move is that counting occurrences is the argument.) There was never a Mizan border there to remove. A `stroke.0` would be a token whose only call sites are places the system does not draw.

**Why the hairline does not resolve per product.** [Decision 022](./022-control-geometry-resolves-by-product.md) made control geometry product-dependent, so the question is live: should Move's denser controls carry a thinner or thicker edge? No — a hairline that thickens with the control stops reading as an edge and starts reading as a frame. The value is invariant in all four mode combinations, and that is now verified rather than asserted: all four resolve `stroke.100` to 1px and `stroke.200` to 2px.

## Consequences

- **`content/tokens/primitive/dimension.json` gains a third group.** 108 tokens become 110, and 89 invariant values become 91 — both new steps are the same in all four combinations, which is the claim about hairlines stated as a build fact. The build emits `--stroke-100` and `--stroke-200` for CSS, and iOS and Android outputs for every mode combination.
- **Every component's stroke is now traceable.** `grep stroke- packages/components/src` returns every line of ink in the library, which no grep could do before — `1px` and `var(--space-25)` were indistinguishable from any other use of those strings.
- **Two new `unused-primitive` warnings**, taking `check:schema` from 38 to 40. This is the same warning `radius.0`, `radius.100`, `radius.200`, `radius.full`, `space.0`, `space.25`, `space.50` and every motion primitive already carry, because the gate reads the token graph and cannot see that CSS consumes primitives directly. The warning is correct about the graph and wrong about the world, for all 40 of them. **A gate that cannot see a whole class of consumer is worth its own entry**, and it is not this one.
- **The contrast gate is unmoved at 70 / 4 / 6.** A dimension carries no pairing, which is the same reason [025](./025-the-scrim-is-one-value-and-carries-no-pairing.md) gave for the scrim, arrived at from the other direction.
- **`check:drift` will report both new variables missing until somebody syncs Figma.** The fourth entry in a row to say this — [021](./021-the-motion-scale-and-where-a-spinner-does-not-go.md), [022](./022-control-geometry-resolves-by-product.md) and [023](./023-the-error-semantic-is-two-tokens.md) all end with the same sentence. Four is the count at which this stops being a footnote and becomes a question about whether the sync should be part of landing a token at all.
- **A false statement in `radius`'s own description was found and corrected on the way past.** It claimed radius was "numbered on the same eighths convention as space so the two scales read alike." It is not: `space.100` is 8px and `radius.100` is 4px, so the two scales read *alike and mean differently*, which is worse than reading differently. The correction states the real rule — same numbering style, its own base — and says what the old sentence would have cost a reader who trusted it. **This is the second time a scale's own description has overclaimed its relationship to a neighbouring scale**, and the new `stroke` description was written against that failure rather than into it.
- **`gen:contract --all` cannot regenerate three of the seven contracts.** List, Navigation and RideCard each export two props types, and `--all` has no way to say which one the contract is about, so it fails them rather than guessing — correctly. `check-contracts.mjs` handles the same ambiguity by reading `propsType` off the existing contract, which `--all` does not do. This is pre-existing and was merely surfaced here; the three were regenerated with an explicit `--props-type`.
- **The semantic gap is real and is accepted.** `border-width: var(--stroke-100)` does not say "control edge". If a second kind of hairline ever needs to differ from the control edge, the answer is a semantic layer above this ramp, not a third primitive.

## What would make us revisit this?

- **A third width.** If anything needs a stroke that is not 1px or 2px, the ramp gains a step and the refusal of 4px above was wrong about this library rather than wrong in principle. Note which way it goes: a 4px need vindicates the references, a 3px need vindicates nobody.
- **A stroke that must differ by product or by theme.** The invariance is a claim about hairlines, not a law. A dark theme wanting a heavier edge to survive a low-contrast ground would make `stroke` a mode-resolved semantic rather than a flat primitive, and the argument would be [022](./022-control-geometry-resolves-by-product.md)'s.
- **A second kind of hairline.** A divider that needs to diverge from a control edge is the trigger for the semantic layer this entry declined to build, and `border.*`'s colour namespace has to be renamed before it can be built.
- **Anyone drawing on the scale that measures gaps again.** A new `border-width: var(--space-*)` anywhere is the signal that this scale is not discoverable enough, and the answer is a lint rule — the same shape [024](./024-productcard-and-ridecard-stay-separate.md) and [025](./025-the-scrim-is-one-value-and-carries-no-pairing.md) both said they eventually want. Three entries now owe a lint rule to the same file that does not exist.
- **The `unused-primitive` warning reaching a count nobody reads.** At 40 it is already a list people skim. If a real unused primitive ever hides in it, the gate needs to learn that CSS consumes primitives directly, and this entry's fourth bullet becomes its own decision.
