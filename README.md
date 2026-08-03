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
| `legacy/` | Mizan v0, a deliberately broken legacy system. A fixed artifact. Do not repair it. |

Tokens are the only editing surface. CSS variables and Figma variables are generated displays, never sources, and the sync runs one way — outward.

## Start here

- [`mizan-roadmap-v1.md`](./mizan-roadmap-v1.md) — the plan, stage by stage, and the non-negotiable rules.
- [`brief/`](./brief/) — the products and their surfaces.
- [`decisions/`](./decisions/) — the Decision Log.
- [`legacy/`](./legacy/) — Mizan v0. Read its README before touching anything inside it.

## Status

Stage 0: repository skeleton. Directories carry READMEs stating what belongs in them and what does not; implementation arrives stage by stage per the roadmap.
