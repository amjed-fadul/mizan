# content/tokens/

Mizan's design tokens in DTCG format, in three layers: primitive → semantic → component. Light and dark, LTR and RTL.

**This is the only editing surface for tokens.** CSS variables, Figma variables, and any iOS or Android output are generated displays. They are never sources, and nobody hand-edits them. The sync runs one way: outward from here.

**What belongs here:** token values and their relationships. Primitives hold raw values. Semantics reference primitives and carry meaning. Component tokens reference semantics.

**What does not belong here:** generated output of any kind — no CSS files, no platform exports, no Figma variable dumps. No build configuration and no validation logic; those are machinery. And no raw hex in the semantic layer: semantics reference primitives, always.

Two tokens sharing a value are not the same token. Value coincidence is not semantic identity, and merging on that basis is the mistake this layering exists to prevent.

`pairs.json` declares every foreground/background combination the system intends to render, and the context each is used in. It is content, not machinery: the pairings are Mizan's knowledge of what sits on what. `machinery/scripts/check-contrast.mjs` reads it and fails the build when a declared pair drops below its WCAG threshold in any mode. An undeclared pairing is an unchecked pairing — see [decision 010](../../decisions/010-contrast-is-a-token-layer-guarantee.md).

**Arrives Stage 2**, written as an intervention on the Mizan v0 audit rather than as a greenfield exercise. Every choice here should be traceable to something the audit found.
