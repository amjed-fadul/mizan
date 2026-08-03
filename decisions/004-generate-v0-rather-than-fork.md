# Decision 004 — v0 is generated, not forked from an existing open-source product

**Date:** 2026-08-04
**Status:** accepted

## Context

Having decided to build the mess first ([003](./003-build-the-mess-first.md)), the question became where it comes from. The proposal on the table was to fork a real, mature open-source product — specifically [Twenty](https://github.com/twentyhq/twenty), a well-regarded open-source CRM — change its colours, remove some modules, and use that as the legacy system.

## Problem

Should the legacy system be a real production codebase adapted for the purpose, or generated from scratch?

## Constraints

- The legacy system must contain the specific defect classes the roadmap's later stages respond to: duplicated near-identical values, competing component implementations, English-first assumptions, physical direction properties, accessibility failures.
- It must support two products, because the multi-product architecture argument depends on it.
- Whatever is published must remain forkable by the teams the Stage 7 skeleton is aimed at.
- Four to six hours a week.

## Options

1. **Fork a real open-source product** and degrade it into a legacy system.
2. **Generate v0** from a specification of defect classes and eras.
3. **Study real messy codebases** for texture, then generate — a middle path.

## Trade-offs

Option 1's genuine advantage is texture. Real code has historical accretion that generated code struggles to imitate: dead branches, abandoned conventions, comments referring to deadlines that passed years ago. That advantage is real and was the reason to consider it seriously.

Its costs, on inspection, were larger:

- **The candidate is well-built, which is the wrong starting material.** Twenty ships its own component package, uses themed CSS, and has working internationalisation through a proper i18n framework. Manufacturing a mess would mean *deleting working infrastructure* — more effort than generating a mess, and less convincing, because the sound architecture underneath remains visible.
- **It is one product.** The multi-product architecture in Stage 3 has nothing to argue about with a single-product codebase.
- **Licensing.** The main repository is AGPL-3.0. The Stage 7 deliverable is a skeleton intended for teams to adopt, and a copyleft-derived skeleton is one most companies will decline to touch — which defeats the artifact's purpose.
- **Infrastructure cost.** A monorepo with a separate API server, a relational database, a cache and a job queue is a multi-week setup at this pace, spent learning nothing about design systems.
- **Attribution.** A recolored fork of a widely recognised repository, presented as one's own build, undermines exactly the credibility this log exists to establish.

Option 2 costs the texture, which is a real loss and needs a deliberate remedy.

## Decision

Generate v0. Recover the missing texture through layered generation: a shared ancestor stylesheet, then two teams drifting from it independently over two years, then a deadline-driven pass that inlines values past both.

## Why

None of the objections above are about Twenty's quality. They are about fit. It is a well-engineered project, and that is precisely the problem — the exercise needs a system that is bad for legible reasons, and the effort of making a good system bad is greater than the effort of building a bad one, with a worse result.

The texture argument is answered by *how* the generation is structured rather than by its source. A mess generated in one pass reads as random. A mess generated as history — an ancestor, two divergences, a crunch — reads as accreted, because the defects have causes. That is the property the audit actually needs: not "there are six grays" but "there are six grays because two naming schemes coexist and a third wave inlined past both."

## Consequences

- v0's realism now depends entirely on the discipline of the layered generation. If that is done lazily, the mess is synthetic and [003](./003-build-the-mess-first.md)'s premise collapses.
- The repository stays free of copyleft obligations, so the Stage 7 skeleton can carry a permissive licence.
- Both products can be built to diverge deliberately rather than accidentally, which makes the Stage 3 argument sharper than a real codebase would have allowed.
- Nothing in the project is inherited, so nothing in it is unexamined. Every defect in v0 was chosen, which means every finding in the audit can be traced to a cause.

## What would make us revisit this?

If the layered generation fails its realism test at the end of Stage 1 — defects without traceable causes, grays that are obviously distinct, two products that read as one theme with two accent colours — then generation was the wrong call and a real codebase, with all its costs, would have been the better source. The test is applied before the audit begins, not after.
