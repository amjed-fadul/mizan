# Mizan (ميزان)

Mizan is a multi-product design system built to demonstrate the full operating model — architecture, judgment, governance, designer experience, and AI-native workflows — with exceptional Arabic/RTL capability.

Mizan Labs is a fictional company running two products in English and Arabic:

- **Mizan Market** — grocery and everyday commerce: home and discovery, category browsing with filters, product pages, a cart with substitution preferences and delivery slots, checkout, and order tracking.
- **Mizan Move** — ride booking: pickup and destination on a map, ride selection across Economy/Comfort/XL/Electric, an active ride with driver and trip status, and trip history with receipts.

## Repository map

The load-bearing rule is the seam between `machinery/` and `content/`. Machinery is the brand-agnostic pipeline: scripts, checks, plugins, metadata schemas, agent instruction files. Content is everything that belongs to Mizan specifically: token values, rules, Arabic specifics. They never mix. If you deleted `content/`, everything in `machinery/` should still make sense — that test is what keeps a headless open-source extraction cheap later.

| Directory | Holds |
|---|---|
| `machinery/` | Brand-agnostic pipeline, deterministic checks, component metadata, agent instructions. No Mizan values. |
| `machinery/figma-plugin/` | Mizan Sync — the Figma plugin that writes variables from the token JSON, the generated proof sheet, and the read-only bridge the drift detector reads through. One-way, outward, no delete. |
| `machinery/scripts/` | The gates: schema, contrast, drift, the self-test that proves they reject things, and the health dashboard. |
| `content/` | Mizan's own tokens, rules, and Arabic specifics. No pipeline logic. |
| `packages/` | Generated and consuming code. `packages/tokens/` is build output — CSS, iOS and Android, never hand-edited. `packages/preview/` is the live preview app. |
| `brief/` | The Mizan Labs product brief — what Market and Move are and which surfaces exist. |
| `decisions/` | The Decision Log: the significant calls, with reasoning and consequences. |
| `audit/` | Assessments written before an intervention. What is true and what it costs — not what we chose. |
| `packages/` | Build output and the artifacts that consume it: the generated token files, and the preview that reads them. No token value is authored here — `packages/tokens/` is regenerated on every build, and the preview reads it rather than restating it. |
| `legacy/` | Mizan v0, a deliberately broken legacy system. A fixed artifact. Do not repair it. |

Tokens are the only editing surface. CSS variables and Figma variables are generated displays, never sources, and the sync runs one way — outward.

## Start here

- [`mizan-roadmap-v1.md`](./mizan-roadmap-v1.md) — the plan, stage by stage, and the non-negotiable rules.
- [`brief/`](./brief/) — the products and their surfaces.
- [`decisions/`](./decisions/) — the Decision Log.
- [`legacy/`](./legacy/) — Mizan v0. Read its README before touching anything inside it.

## Status

**Stage 4 — Components: fewer, deeper.** Seven components, each with a full API spec. **[Storybook is live](https://amjed-fadul.github.io/mizan/).**

- **Stage 1** audited Mizan v0 — 33 distinct colour values, four spacing rhythms, four button implementations behind three contradictory APIs, 72 physical direction properties and not one logical, and an accessibility floor that is mostly a token problem. [`audit/`](./audit/).
- **Stage 2** rebuilt the foundation: spec-strict DTCG source in [`content/tokens/`](./content/tokens/) as the only editing surface, two blocking gates with a self-test that proves they reject a broken token set rather than merely accepting a good one, generated CSS, iOS and Android output for four mode combinations, and a preview in `packages/preview/` that reads that output rather than restating it.
- **Stage 3** built Mizan Sync, the Figma plugin that writes the variables; the drift detector with nine drift classes; the health dashboard; a generated proof sheet that binds every projected variable to a real node rather than asserting it reached Figma; and a read-only localhost bridge, because Figma gates the variables REST API for reading as well as writing.
- **Stage 4** built Button, Input, Dialog, List, Navigation, ProductCard and RideCard — seven, at the top of the roadmap's five-to-seven range, each with the full eleven-heading spec beside it and a machine-readable contract under [`machinery/metadata/`](./machinery/metadata/). The token layer grew three times to serve them and refused once: a stroke scale ([026](./decisions/026-the-stroke-scale.md)), control geometry that resolves by product ([022](./decisions/022-control-geometry-resolves-by-product.md)), an error semantic that is two tokens because it is gated at two thresholds ([023](./decisions/023-the-error-semantic-is-two-tokens.md)) — and no destructive Button variant, because the token it would need does not exist and inventing one backwards from a component is how token layers rot ([020](./decisions/020-the-button-consolidation.md)).
- **Published:** the Figma **variable library** — 74 variables in three collections, of which the semantic layer is what consumers see — and the **Storybook**, which is Stage 4's ship deliverable. **Not published:** the Figma *component* library. Components exist in code and not yet on the canvas.

**Twenty-seven Decision Log entries**, and the refusals are the useful ones — [ProductCard and RideCard staying separate](./decisions/024-productcard-and-ridecard-stay-separate.md) because one is a container and the other is a control is the flagship. Two rule layers now sit in [`content/rules/`](./content/rules/): RTL/Arabic, and motion.

The entries that correct earlier entries are worth as much as the ones that decide something. [013](./decisions/013-script-is-a-mode-not-a-parallel-scale.md) said script would become a third mode dimension; [027](./decisions/027-script-is-an-overlay-not-a-dimension.md) implemented it as an overlay instead and says why the original arithmetic was wrong. [026](./decisions/026-the-stroke-scale.md) ends with a trigger about a warning list nobody reads; the trigger fired the next day, and 027 is what it caught.

Implementation continues stage by stage per the roadmap.
