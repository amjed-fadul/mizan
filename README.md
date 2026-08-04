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
| `content/` | Mizan's own tokens, rules, and Arabic specifics. No pipeline logic. |
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

**Stage 2 — the foundation is re-architected, and it is visible.**

- **Stage 1** audited Mizan v0 and wrote down what it costs: 33 distinct colour values, four spacing rhythms, four button implementations behind three contradictory APIs, 72 physical direction properties and not one logical, and an accessibility floor that turns out to be mostly a token problem. [`audit/`](./audit/).
- **Stage 2** rebuilt the foundation. Spec-strict DTCG source in [`content/tokens/`](./content/tokens/) as the only editing surface; two blocking gates in [`machinery/scripts/`](./machinery/scripts/) — structure and WCAG contrast — with a self-test that proves they reject a broken token set rather than merely accepting a good one; generated CSS, iOS and Android output in `packages/tokens/` for four mode combinations; and a preview in `packages/preview/` that reads the build output rather than restating it.
- **Decisions 001–013 and 018** are in [`decisions/`](./decisions/), including the ones that were refusals. 014–017 are numbered and not here: they belong to Stage 3, on another branch.

Stage 3 — Figma, the sync plugin and the drift detector — is not in this branch. There is no `check-drift.mjs` here, and nothing in `machinery/` yet talks to Figma.
