> **Draft — for rewriting in Amjed's voice before publishing.** The judgment described here is his; the sentences are not yet.

# Two tokens, same hex, different meaning — who survived my gray massacre and why

I merged two greens no perceptual threshold would have merged, and refused to merge two reds that the same threshold, loosened enough to catch those greens, would have swallowed. Both calls were right. No number produces both.

That is the part of token consolidation nobody warns you about.

## The pain

Mizan v0 is a legacy system I built on purpose, then audited like a first week on the job: two products descended from one ancestor stylesheet and evolved apart by teams that stopped talking.

The audit found **33 distinct colour values**, of which **21 pairs sit below the just-noticeable difference while doing the same job**. ΔE00 under 2.3 is the standard threshold for "no user can tell these apart." Developers choose between them daily; users never see the difference.

The obvious move is to merge everything under the threshold and call it a cleanup. I ran that rule before my own judgment, to see where they disagreed. They disagreed in the one place that mattered most.

## The decision

Merge on **role**, then verify by **distance**, with any disagreement between the two a signal to look harder rather than a tiebreak.

33 values became 14. Four consolidations, three refusals. The refusals are the entries worth reading.

## The demo

**`commerce.discount` and `mobility.safety` stay separate.** `#c62828` and `#b3261e`, **ΔE00 4.21** — close enough that merging looks like tidying. One means *this costs less*. The other means *this cancels your trip*. Merge them and you can never restyle a destructive action without restyling every discount badge in the catalogue. Value coincidence is not semantic identity.

**The two brand greens merge.** `#2e7d5a` and `#2f8560`, **ΔE00 2.90** — above the 2.3 just-noticeable difference, so a threshold rule leaves them alone. Both are the primary CTA fill. Both are the same brand, drifted.

The number that ends the argument: the gap a button's hover state is meant to signal in this system is **9.23**. The brand was less distinct from itself than a button is from its own hover. That is a brand integrity problem wearing a token problem's clothes, and it is the most important merge in the consolidation. The measurement, applied honestly, says don't.

**Market's and Move's secondary text stay separate.** `#5a5a5a` at 6.90:1 and `#6b6b6b` at 5.33:1, **ΔE00 6.30** — not near-identical, and merging them would have been the most damaging cleanup available. Market is browsed on a sofa. Move is read at a curb, in one glance. The lighter grey is a density decision somebody made correctly and never wrote down.

Now try to write the rule. To merge the greens it must reach past 2.90; to spare `discount` and `safety` it must stop before 4.21. A window **1.31 ΔE00 wide** — and nothing in the measurement tells you it is there. A threshold that reproduces these decisions is not a rule. It is the decisions, back-fitted.

## What WCAG deleted

v0 shipped four tiers of neutral text. The bottom two failed AA everywhere they appeared — `#999999` at 2.85:1, `#9b9b9b` at 2.78:1, `#8e8e8e` at 3.28:1 — across roughly fifteen CSS rules and every screen.

So darken them until they pass. Everybody tries this first, and it dies on arithmetic. To clear 4.5:1 with any margin, muted has to reach about `#6e6e6e` (5.10:1). Against Move's secondary `#6b6b6b`, that is **1.045:1**.

Those are the same colour. The tier survives in the token file and dies on screen: three names, two visible steps.

There is not enough room between white and the AA floor for three steps once one of them already resolves to two values by product. The muted tier is gone; size and weight now do what colour did.

The general version: **accessibility requirements are not a filter you apply after designing the palette. They are a constraint on how many tiers the palette can have at all.** v0's four-tier ramp was not a good ramp that happened to fail contrast. It was a ramp that could only exist *because* it failed contrast.

## The refusal that nearly collapsed in the dark

Every saturated hue dark enough to read on white fails on the dark surface: greens, blues and reds all land between 2.82:1 and 3.50:1 on `#141414`. The tidy fix is one light step per hue.

Which would have given `commerce.discount` and `mobility.safety` — the two I had just argued to keep apart — the same light red in dark mode. The refusal would have held in two of four mode combinations and evaporated in the other two: documented, defended, then abandoned in the theme nobody checks first.

So there are two light reds: `#ef5350` and `#e57373`. A refusal that only holds in one mode is not a refusal.

## The lesson

I computed ΔE00 for every pair in the system, and it changed my mind exactly zero times.

It was still worth computing. The measurement is what made the judgment arguable — it turned "these feel different to me" into a claim someone can check and hold me to. What it could not do is the thing it looks like it can do. It told me which values are close. It could not tell me which are the same.
