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
| `legacy/` | Mizan v0, a deliberately broken legacy system. A fixed artifact. Do not repair it. |

Tokens are the only editing surface. CSS variables and Figma variables are generated displays, never sources, and the sync runs one way — outward.

## Start here

- [`mizan-roadmap-v1.md`](./mizan-roadmap-v1.md) — the plan, stage by stage, and the non-negotiable rules.
- [`brief/`](./brief/) — the products and their surfaces.
- [`decisions/`](./decisions/) — the Decision Log.
- [`legacy/`](./legacy/) — Mizan v0. Read its README before touching anything inside it.

## Status

**Stage 3 — Figma joins, synced.** The tooling is built; the component library is not.

- **Stage 1** audited Mizan v0 — 33 colours, four spacing rhythms, four button implementations, and an accessibility floor that is mostly a token problem. `audit/`.
- **Stage 2** built the token architecture: spec-strict DTCG source in `content/tokens/`, two blocking gates with a self-test that proves they reject things, and generated CSS, iOS and Android output for four mode combinations.
- **Stage 3** built Mizan Sync, the Figma plugin that writes the variables; the drift detector with eight drift classes; the health dashboard; a generated proof sheet that binds every projected variable to a real node rather than asserting it reached Figma; and a read-only localhost bridge, because Figma gates the variables REST API for reading as well as writing.
- **Published:** the Figma **variable library** — 74 variables in three collections. **Not published, because it does not exist yet:** the component library. Components are Stage 4.

Sixteen Decision Log entries so far, and the refusals are the useful ones. Implementation continues stage by stage per the roadmap.
