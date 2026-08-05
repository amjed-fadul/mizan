# Decision 019 — The focus indicator is two-tone, and `pairs.json` gets its first exceptions

**Date:** 2026-08-04
**Status:** accepted

## Context

`.mz-seg` is a segmented control. Its buttons are flush — no gap, a 1px `border.control` hairline between them, rounded ends belonging to the end buttons rather than to a clipping group. They are the only controls the [Stage 2 preview](./018-the-preview-reads-the-build-output.md) has.

Focus was a single ring in `text.primary`, offset outside the border box. Measured in the running app, it cleared its bar on every ground the page draws it against but one. On `surface.default`: 13.39:1 in light, 18.42:1 in dark. On `surface.sunken`: 11.96:1 and 16.48:1. Where an unpressed button's ring crosses its **pressed neighbour's `action.primary` fill**, it is **2.37:1 in light Market and 2.54:1 in light Move**, against the 3.0 of WCAG 1.4.11.

So the indicator was compliant on every ground except the one this control guarantees it will meet. A flush segmented control does not put a ring next to a brand fill occasionally; it puts it there every time focus lands beside the pressed segment, which is most of the time, because the pressed segment is where the eye and the keyboard both start.

The old CSS comment stated the 2.37 honestly and left it, on the grounds that every remedy was a design decision nobody had taken. This entry takes one.

## Problem

How does a focus indicator clear 1.4.11 against a brand fill it is guaranteed to be drawn across, without changing what the control is?

## Constraints

- [Decision 010](./010-contrast-is-a-token-layer-guarantee.md). Contrast is guaranteed at the token layer and enforced by a gate that blocks. The escape hatch is an explicit, reviewed exception with a stated reason — **never a lowered threshold.** Softening 3.0 for focus indicators was not on the table for a moment.
- 2.4.7 requires a visible indicator at all. Removing focus styling to dodge the ratio is a worse failure than the one being fixed.
- No accessibility specialist and no per-screen review, ever — 010's constraint, from the brief. Whatever is decided has to survive as arithmetic in a gate rather than as something a maintainer remembers.
- The spacing scale steps 2, 4, 8. A ring is spacing and takes its widths from the scale.
- Logical properties only. The indicator has to mirror with `dir` alongside the control's rounded ends.
- The control may not change size on focus. A box that grows at the moment it is being pointed at is a different defect.

## Options

1. **Put a gap between the segments.** No adjacency, so no ring ever crosses a neighbour's fill.
2. **Move `action.primary`** until `text.primary` clears 3.0 against it.
3. **Two bands, light tone inside only** — a light band between the button and the dark ring.
4. **Two bands, light tone outside only** — the dark ring with a light band around its outer edge.
5. **Three bands, light tone flanking** — light, dark, light, measured outward from the border box.

## Trade-offs

**Option 1 works, and it is the most expensive thing on the list.** Flushness is not decoration in a segmented control; it is the statement that these options are one choice, and the shared edge is what makes a row of buttons into a single control. Separate them and the component is a button group that happens to have one item highlighted. That is design language traded for a contrast ratio, and it is only worth trading when the ratio cannot be met any other way.

**Option 2 moves a token that belongs to the product to fix a state of a component.** `action.primary` resolves per product — green.600 in Market, blue.600 in Move ([008](./008-the-colour-consolidation.md)) — and both were set at the lightness that lets white sit on them at 5.64:1 and 5.27:1. Darkening either far enough for neutral.900 to clear 3.0 takes the brand somewhere neither product chose. The token that should move is the indicator's, not the identity's.

**Options 3 and 4 are the interesting rejections, and they were rejected on rendered evidence rather than on reasoning.** They look equivalent on paper and are not:

- Light tone **inside only**: the outermost pixel of the indicator is still `text.primary`, and against a pressed neighbour it is still 2.37:1. The failure is not fixed, it is moved two pixels.
- Light tone **outside only**: the outer edge is fine, and then a focused button that is *itself* pressed puts `text.primary` flush against its own `action.primary` fill at the same ratio.

Whichever single side the light tone is on, some real case has the dark band meeting a brand fill with nothing between them. That is the finding, and it is the reason this entry exists rather than a two-line CSS change: two bands are enough for the ground an indicator sits on and are not enough for a control that puts a fill on one side of it and possibly another underneath.

**Option 5 costs three things, all named below**: 8px of outward bleed instead of 4, a stacking rule the box-shadow needs and the outline does not, and two declared pairings that cannot clear 3.0 and have to be excepted. The third is the real cost and the rest of this entry is about it.

## Decision

The focus indicator is **two tones in three bands, flanking**, measured outward from the border box:

```
0–2px   surface.default   box-shadow spread
2–4px   text.primary      outline, painted over the shadow
4–8px   surface.default   the rest of the same box-shadow
```

`content/tokens/pairs.json` gains three pairings and its **first two exceptions**.

## Why

**The tone pair is chosen for polarity, not for looks.** `text.primary` and `surface.default` are opposite ends of the same axis — neutral.900 against neutral.0 in light, reversed in dark — so a pair chosen that way stays a pair in both themes. `text.on-action` looks like the safer light tone, at 5.64:1 on green.600 in either theme, until you notice it is white in dark next to a `text.primary` that is also white there. **An indicator whose two tones are the same colour is one tone**, and it would have collapsed in exactly the theme nobody screenshots first.

**Flanking is chosen because it is the arrangement with no failing case left.** What every ground meets is `surface.default`:

| Ground | What meets it | Ratio |
|---|---|---|
| `surface.default` | itself — invisible by construction, so this reads as the single ring did | `text.primary` carries it at 13.39:1 / 18.42:1 |
| `surface.sunken` | 1.12:1, one step off and effectively the ground too | `text.primary` carries it at 11.96:1 / 16.48:1 |
| `action.primary` | `surface.default` | 5.64:1 light Market, 5.27:1 light Move, **3.27:1 dark Market**, 3.50:1 dark Move |

Every ground meets a tone above 3.0 in all four combinations. What the eye reads is `text.primary` between two lines of `surface.default` at 13.39:1 against them.

**8px rather than 6px** because the spacing scale steps 2, 4, 8, and the outer band takes a step from the scale instead of inventing one. A 6px ring would be a spacing value existing in exactly one rule, which is how v0 arrived at four spacing rhythms — the fourth of them living entirely in inline styles, conforming to nothing because there was nothing to conform to.

## The interpretation this rests on, and it should be read as an interpretation

WCAG 1.4.11 asks for 3.0 from **the indicator**, and not from each tone of the indicator separately. That reading is what makes `text.primary` at 2.37:1 over `action.primary` acceptable: the band is 2px of a composite that is 8px wide, it does not touch the fill, and it has 13.39:1 on both sides of it.

**A reviewer could take the stricter reading** — that every rendered foreground/background adjacency clears its own bar — and under that reading these two exceptions are a failure in better clothes, and the honest remedies are option 1 or option 2. That position is coherent. It is not the one taken here, for two reasons: the success criterion is written about the perceivability of the indicator rather than the composition of it, and a rule applied per-tone forbids two-tone indicators outright, since **a two-tone indicator only earns its name because each tone is allowed to vanish somewhere.** A pair of tones that both had to clear 3.0 on every ground is a pair that cannot exist.

Which reading is taken is therefore a judgment, it is recorded here as one, and it is the thing to argue with if this decision is ever wrong. What it is not allowed to become is invisible. The failing pairings are **declared at the full threshold and excepted with the argument** rather than declared `decorative` or left out. Decorative would be a false statement — WCAG plainly governs a focus indicator. Leaving them undeclared would hide the exact ratio the fix was made for, and an undeclared pairing is an unchecked one.

The first exception is scoped to `theme.light`, because in dark that same tone is the one at 5.64:1 and 5.27:1 and should be reported as the plain pass it is. Both exceptions are written so they are **void the moment the flanking stops**: a single ring in `text.primary` is the failure this replaced, and it must not be able to inherit an argument that no longer describes it.

## Is this the exception 010 was watching for?

010 said the exception list is itself a signal: *"if it grows, the palette is wrong"*, and its revisit trigger fires if the list grows past a handful. It has carried zero entries since it was written. It now carries two, and this entry owes that trigger an answer rather than a shrug.

**The answer is no, and the reason is that these entries are not the kind 010 was describing — but the distinction only holds if it is written down, because the gate cannot see it.**

010's exception is a *palette* exception: a foreground and a background that Mizan intends to render adjacent, that a user is meant to distinguish, and that the colour values cannot pull apart. Every one of those is evidence the ramp is wrong, and the count is a fair proxy for how wrong. That is why growth is the signal.

These two are *composition* exceptions. Neither is a pairing anyone is asked to distinguish. `text.primary` on `action.primary` is an interior band whose neighbours carry the contrast; `surface.default` on `surface.sunken` is a band that is *supposed* to disappear into a panel one step off it — it would be a defect if it did not. They record parts of a composite whose bar is met by the composite. No palette value is failing to do a job it was given; a threshold is being applied to a fragment of something WCAG measures whole.

**Three honest costs of that answer:**

- The distinction was drawn by the entry that needed it. 010 did not anticipate composite indicators, so this is a category being added after the fact, by the party it benefits. That is exactly the shape of reasoning 018 flagged in itself as *a rule that fits the present arrangement, proposed by the arrangement* — and it is being flagged here for the same reason.
- **~~The gate cannot tell the two kinds apart.~~** `pairs.json` had one `exceptions` array and both kinds landed in it, so 010's watch signal was measuring a mixture. The fix was a `kind` field — `"palette"` versus `"composite"` — so the count 010 cares about can be read on its own. That was a change to `content/tokens/`, which this entry does not own, and it was owed. **It landed; see the amended consequence at the foot of this entry, and the granularity error it uncovered.**
- Until that field exists, the count is read by hand, which is precisely the sustained vigilance 010 was built to avoid. Two entries is small enough to read by hand. Five is not.

The trigger survives, restated: **a third exception that is not part of a composite indicator is 010's signal firing**, and the response is palette rework, not a third reason.

## Two implementation facts that cost real debugging

Recorded because they will otherwise be rediscovered, at the same price.

**`box-shadow` paints in document order; `outline` does not.** An outline paints last within its stacking context, so the dark band lands on top of a neighbour's fill for free. A box-shadow paints with the element's own background, in document order — so an unpositioned button's light bands were painted over by the *next* sibling's background and survived on the previous one's. The symptom is a ring missing exactly one edge, and only one, which reads as a rendering glitch rather than as a paint-order bug. `position: relative` with a `z-index` lifts the shadow above both neighbours. It changes what paints on top and never the shape or the box.

**Both mechanisms follow `border-radius`, including logical corners.** The rounded ends of the segmented control are set with `border-start-start-radius` and friends, and both the outline and the shadow follow them, so the indicator mirrors with `dir` along with the control. Verified in RTL Arabic: the last segment resolves to `4px 0 0 4px` and the rounded end stays at the end of the line.

A third, from the same rule and already in the CSS: `overflow: hidden` on the group — the thing a segmented control usually reaches for — erased the indicator on all eight buttons, because the offset puts it outside the button's border box and the two clip boxes coincide. A control that cannot show focus is a 2.4.7 failure.

## Consequences

- **`pairs.json` has exceptions for the first time.** The empty list was a claim the palette could keep, and it can no longer be made without qualification. The qualification is the section above.
- **The binding contrast number in the system moved to 3.27:1 — `surface.default` on `action.primary`, dark Market — with 0.27 of headroom.** `surface.default` in dark is now a token that cannot be lightened without re-checking the focus indicator, and it did not carry that constraint before. The gate will catch it; the point of writing it here is that the person lightening it will not otherwise know *why* it broke.
- **The preview's contrast matrix needed a fourth verdict.** It reads `pairs.json` live and knew only about pairs, so the first exceptions made it print Fail on six cells of a build that passes — the page decision 018 put there to make the gate inspectable, disagreeing with the gate. `excepted` is its own verdict rather than a footnote on Pass, and the reason is printed on the card, on the same grounds the gate prints every exception whether it currently clears or not: an exception a reader has to go and find in a JSON file is a silent one.
- **Six of sixty checks are now exceptions.** Five real pairings out of the six that two tones across three grounds can produce — the sixth is `surface.default` against itself, 1.00:1 by construction rather than by measurement, which is not a pairing.
- **The indicator is 8px of outward bleed on every focusable element in the preview**, not just the segmented control, because the rule is on `:focus-visible` globally. Nothing currently sits close enough for that to collide. Something eventually will.
- **~~A `kind` field on exceptions is owed to `content/tokens/pairs.json`~~, so 010's watch signal counts palette failures and not composite parts. Landed:** `"kind": "palette" | "composite"` is required on every exception, `check-contrast.mjs` refuses a waiver without one, and the summary reads `0 palette, 2 composite` rather than a bare 6.

  The field turned out to be the smaller half of the fix. **The count was also being taken at the wrong granularity.** An exception is excepted once per combination it applies to, so these two waivers produce *six* excepted checks, and a split reported over checks would have said "6 composite" — or, for a palette failure, would have fired 010's third-exception trigger on the *first* waiver the moment it spanned four combinations. 010's trigger means a third *decision*. The summary now reports both numbers and says which is which, and the selftest asserts the distinction directly rather than trusting it.

## What would make us revisit this?

**A third exception that is not part of a composite indicator.** That is 010's trigger, unmodified, and the response it prescribes — palette rework rather than another reason — still applies.

**A reviewer who takes the strict per-tone reading of 1.4.11.** The interpretation in this entry is the load-bearing part of it. If it is rejected, the two exceptions go with it, and the remedy is the gap between segments — the option this entry declined, at a cost it named.

**`surface.default` in dark being lightened.** 3.27:1 has 0.27 of headroom, and it is the number this whole arrangement now stands on. The gate blocks it, and this is the entry that says what breaks.

**A component whose focus ring needs to sit inside its own border box** — a control that cannot afford 8px of bleed, or one nested tightly enough that the outer band lands on a third colour nobody measured. The three grounds this was measured against are the three the preview has, and that is a smaller world than Stage 4's.
