# The Mizan Decision Log

A hiring manager can learn whether someone understands design tokens in fifteen minutes. What they cannot learn anywhere else is whether that person can make difficult system decisions and live with them. This log is where that is recorded.

Every significant call gets an entry, written from [`TEMPLATE.md`](./TEMPLATE.md):

```
Context · Problem · Constraints · Options · Trade-offs
Decision · Why · Consequences · What would make us revisit this?
```

## The rules of this log

- **Write the entry when the decision happens**, not at the end of the week. A reconstructed rationale is a different thing from a recorded one, and the difference shows.
- **Refusals are the most valuable entries.** A good design-system designer is a component refusal machine with reasons. Every "no" gets written down, with what was asked for and why the answer was no.
- **If there was only one option, it was not a decision.** No entry needed.
- **If the chosen option has no downsides, the entry is not finished.** Every real decision costs something.
- **Every entry ends with a revisit trigger.** A decision without a stated condition for reopening it is a preference wearing a decision's clothes.
- **An entry that has not been carried out says so — in its status line, and in the table below.** Entries are written in the present tense, which reads as a description of the system whether or not anything was built. One of them currently describes an intention ([017](./017-primitives-are-hidden-from-publishing.md)), and the marker is there so the table cannot be mistaken for an inventory. [013](./013-script-is-a-mode-not-a-parallel-scale.md) was the other until [027](./027-script-is-an-overlay-not-a-dimension.md) implemented it — with one consequence of 013 corrected on the way, because the mechanism it predicted was a third dimension and what it needed was an overlay.

## Numbering

Entries are numbered sequentially in the order decisions actually happen. Numbers are not reserved in advance and gaps are not left for anticipated entries — the log records what happened, in the order it happened.

## The entries

| # | Decision | Stage |
|---|---|---|
| [001](./001-machinery-content-separation.md) | Machinery and content are separated from the first commit | 0 |
| [002](./002-react-typescript-vite.md) | The stack is React, TypeScript and Vite | 0 |
| [003](./003-build-the-mess-first.md) | The legacy system is built before the real one, and quarantined | 0 |
| [004](./004-generate-v0-rather-than-fork.md) | v0 is generated, not forked from an existing open-source product | 0 |
| [005](./005-two-products-not-one.md) | The sandbox is two products, and specifically these two | 0 |
| [006](./006-agents-are-consumers-of-the-contribution-flow.md) | Agents are consumers of the system, not contributors to it | 1 |
| [007](./007-modes-for-shared-namespaces-for-unique.md) | Modes for what both products have, namespaces for what only one has | 2 |
| [008](./008-the-colour-consolidation.md) | Thirty-three colours walked in — the merges, and the three refusals | 2 |
| [009](./009-the-text-ramp-loses-a-tier.md) | The neutral text ramp has two tiers, not three | 2 |
| [010](./010-contrast-is-a-token-layer-guarantee.md) | Contrast is guaranteed at the token layer and enforced by a build gate | 2 |
| [011](./011-a-hue-needs-both-ends-only-if-it-carries-text.md) | A hue gets steps at both ends of the ramp only if it carries text | 2 |
| [012](./012-western-numerals-and-what-follows.md) | Western numerals in both locales, and the formatted/transcribed split | 2 |
| [013](./013-script-is-a-mode-not-a-parallel-scale.md) | The Arabic type scale is a mode of the Latin scale — implemented by [027](./027-script-is-an-overlay-not-a-dimension.md), which corrected "third dimension" to "overlay" | 2 |
| [014](./014-direction-is-not-a-mode-dimension.md) | Direction is not a mode dimension — logical properties make it unnecessary | 3 |
| [015](./015-rung-2-has-a-plan-floor.md) | Governance rung 2 has a plan floor, and the floor is published | 3 |
| [016](./016-build-the-read-bridge-rather-than-adopt-figma-console-mcp.md) | The variable read bridge is built read-only, not adopted from `figma-console-mcp` | 3 |
| [017](./017-primitives-are-hidden-from-publishing.md) | Primitives are hidden from publishing; only the semantic layer is a library — decided, not yet in the file | 3 |
| [018](./018-the-preview-reads-the-build-output.md) | The Stage 2 preview reads the build output, and the content seam it opens | 2 |
| [019](./019-the-focus-indicator-is-two-tone.md) | The focus indicator is two-tone, and `pairs.json` gets its first exceptions | 2 |
| [020](./020-the-button-consolidation.md) | Four buttons become one, and the vocabulary the shared API refuses to carry | 4 |
| [021](./021-the-motion-scale-and-where-a-spinner-does-not-go.md) | The motion scale, the cycle that is not a tier, and reduced motion as a rule rather than a mode | 4 |
| [022](./022-control-geometry-resolves-by-product.md) | Control geometry resolves by product, and the tap target is not a token | 4 |
| [023](./023-the-error-semantic-is-two-tokens.md) | The error semantic is two tokens, and neither of them is the red that already exists | 4 |
| [024](./024-productcard-and-ridecard-stay-separate.md) | ProductCard and RideCard stay separate, because one is a container and the other is a control | 4 |
| [025](./025-the-scrim-is-one-value-and-carries-no-pairing.md) | The scrim is one value in all four combinations, and the first token with no contrast pairing | 4 |
| [026](./026-the-stroke-scale.md) | Ink gets its own scale, and it is two values because two is what the library draws | 4 |
| [027](./027-script-is-an-overlay-not-a-dimension.md) | Script is a mode that is not a dimension, and the gate had been saying so for weeks | 4 |
