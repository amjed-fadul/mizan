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
| [013](./013-script-is-a-mode-not-a-parallel-scale.md) | The Arabic type scale is a mode, and script becomes a third dimension | 2 |
| [014](./014-direction-is-not-a-mode-dimension.md) | Direction is not a mode dimension — logical properties make it unnecessary | 3 |
