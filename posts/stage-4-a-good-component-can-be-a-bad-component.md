> **Draft — for rewriting in Amjed's voice before publishing.** The judgment described here is his; the sentences are not yet.

# A component can be reusable and still be a bad component

Seven components wrote the same number. Each one wrote a comment explaining why that was the honest thing to do. Every comment was right. The sequence was wrong, and nothing in the process noticed, because nothing was counting.

That is the failure mode I did not expect from a stage about components.

## The pain

Stage 4 of Mizan is "five to seven components, and go deep." I built seven: Button, Input, Dialog, List, Navigation, ProductCard, RideCard. The interesting work turned out not to be in any of them.

Every component hit a value the token layer could not express. Button needed a border width. So did Input — and its comment said so, and cited Button's. So did RideCard, ProductCard, List, Dialog, Navigation. Seven components, seven literal `1px` declarations, seven comments arguing that a literal with the gap written down beats a token invented backwards from one component.

**That argument is correct for the first component.** It is weaker for the second. By the seventh it is a system that has decided something and failed to write it down, with the count sitting in prose across seven files.

The decision entry for the error semantic called two occurrences "a pattern rather than an incident." Dialog's spec called five "the strongest evidence one is owed." Navigation's called itself "the last component of the stage to route around its absence." Everyone saw it. Nobody was counting, because counting was not anybody's job.

## The decision

A stroke scale: two steps, 1px and 2px, on their own base.

Two, not five. [Polaris](https://polaris-react.shopify.com/tokens/border) ships five border-width tokens and [Primer](https://primer.style/foundations/primitives/size) ships four, and all three systems I checked — Spectrum too — keep stroke as a scale of its own rather than expressing it as a spacing step. I took the structure and declined the inventory: they all carry a 4px step, Mizan draws no 4px line, and a ramp is not made more correct by having the same number of rungs as somebody else's.

The sharper finding was underneath. Four places in the library drew 2px of *ink* — a focus outline, a busy indicator's ring, two card marks — and all four took it from `space.25`, the spacing step that happens to be 2px. One stylesheet used that token on two adjacent lines: once as the width of an outline, once as the gap beneath it. Ink and emptiness, same token, and nothing in the system could tell them apart.

That is the same principle I spent Stage 2 defending for colour — value coincidence is not semantic identity — failing in dimension because the colour layer was the only place anyone was watching.

## The refusal

ProductCard and RideCard look like the same box. They stay separate components, and the reason is not that they look different.

`ProductCard` is an `<article>` containing a link and an add-to-cart button — two independently focusable things inside one container. `RideCard` is a radio inside a radio group: one tab stop for the whole group, arrow keys between options, selection moving with focus. The platform gives all of that free to `<input type="radio">` inside a `<fieldset>`, and a `div` with `role="radio"` has to rebuild every bit of it.

So the cut is **behaviour, not appearance**. And the cleanest way to say it: a radio may not contain a button. There is no construction where the ride card's interaction model survives having ProductCard's action inside it.

The mirror of that argument is what merged Navigation into one component when the cards stayed two. Same test, opposite answer, which is how you know the test is doing work.

## What the gate had been saying for weeks

Six of my seven components rendered Arabic in the Latin font stack.

Every component wrote `font-family: var(--font-family-sans)` — a stack with no Arabic face in it. Only Button overrode it. So Button's Arabic story rendered in IBM Plex Sans Arabic and ProductCard's rendered in `system-ui`, under identical conditions, and each of the six shipped an Arabic story that looked like a demonstration of Arabic support.

Here is the part that should be uncomfortable. **The schema gate had been reporting this since the day the Arabic tokens landed.** Four warnings, naming the four unused Arabic primitives: *a primitive with no consumer is a value nobody decided to use.* They sat inside a list of forty, most of which is noise the gate cannot avoid, and nobody read it.

A gate that reports a real defect inside a list of noise has not reported it. The count was the camouflage.

The fix implemented a decision I had already written and got one thing wrong in it: script becomes a *mode* of the type scale, resolved by `:lang()`. I had said it would be a third mode dimension. It should not be — no Arabic typography value differs between light and dark or between the two products, so a third dimension produces four byte-identical copies of the matrix and doubles the work of every gate that resolves something in every combination. That is word for word the argument I had already used to refuse *direction* as a dimension, and I did not notice it applied here until I tried to build it.

So script is an overlay: composed on top of whichever combination is active, one extra block, no multiplication.

## The one that reviewed worse than it built

Four agents reviewed the four pull requests before they merged. The worst finding was in the newest decision entry, and it was mine.

Custom properties inherit. My `:lang(ar)` overlay redefined four names on the Arabic subtree — and a `lang="en"` island *inside* that subtree does not match `:lang(ar)`, so it had nothing to fall back to. It inherited the Arabic face at Arabic leading. I measured it: an English span in an Arabic page, set in IBM Plex Sans Arabic.

That is exactly the case the decision cites as its reason for scoping to a subtree rather than the document root — an Arabic page contains Latin runs. The entry argued for subtree scoping and then implemented a scope with no way back out.

And the mechanism I deleted had handled it correctly, by accident. `.mz-button:lang(ar)` simply never matched a Latin button. The wrong-place fix was right about the case the right-place fix broke.

Overlays now emit two blocks: the overlay, and a restore for anything inside its scope that is not in it.

## The lesson

The thing I would tell someone starting a component library: **your components are the easy half.**

Every real decision in this stage happened one layer down — in what the token system could and could not say, and in what happened when seven components each worked around the same silence politely. The components were fine. They were reusable. Six of them were also quietly wrong about a script that is the entire reason this project exists.

And the second thing, which I believe more than I did a month ago: write the revisit trigger. One of these entries ends by warning that a warning list nobody reads will eventually hide something real. That trigger fired the next day, and the thing it caught is the Arabic defect above.

A decision without a trigger is a preference. A trigger is the only part of an entry that can still do work after everybody has forgotten the argument.

---

*Mizan is a multi-product design system I'm building in public to demonstrate the full operating model — architecture, judgment, governance, designer experience — with Arabic and RTL as the stress test. [Storybook](https://amjed-fadul.github.io/mizan/) · the Decision Log is 27 entries and counting.*
