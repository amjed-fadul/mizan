# Decision 003 — The legacy system is built before the real one, and quarantined

**Date:** 2026-08-04
**Status:** accepted

## Context

The roadmap opens with a stage that builds a deliberately broken design system before building the real one. This inverts the obvious order and costs three weeks at the start of the project, so it is worth recording why.

## Problem

Should the project start by building the system, or by building the mess the system is an answer to?

## Constraints

- Roughly 33 weeks total, four to six hours a week. Three weeks spent on the mess is close to ten percent of the budget.
- The project's purpose is to demonstrate design-system judgment to people hiring for it.
- A coding agent is doing most of the building, and coding agents are trained to write good code.

## Options

1. **Build the mess first, audit it, then re-architect as an intervention.**
2. **Build the system greenfield**, and describe the problems it solves in prose.
3. **Build the system greenfield, then retro-fit a mess** afterwards to demonstrate migration.

## Trade-offs

Option 1 costs three weeks before anything good exists, and requires deliberately writing bad code — which is slower than it sounds, because both the human and the agent resist it.

Option 2 is the fastest route to a portfolio piece and the weakest one. Every architectural choice becomes a preference asserted rather than a decision argued. "I used three token layers" and "I used three token layers because the audit found semantic values hard-coded in twelve components" are different sentences to the person reading them.

Option 3 gets the migration demo without the audit, but the mess would be built to fit the system rather than the system built to answer the mess. The reasoning would run backwards and it would show.

## Decision

Build the mess first. Quarantine it permanently in `legacy/` and never repair it.

## Why

The real job is almost never greenfield. Entering an existing mess, understanding it, prioritising it, and intervening without breaking product teams *is* the work, and it is the specific capability the final interview question tests. A project that skips it demonstrates the easy half.

The audit also does something a greenfield build cannot: it converts every later decision into an answer. The token architecture becomes a response to specific findings. The component boundaries become responses to specific duplications. The migration becomes a response to specific screens.

The quarantine matters as much as the mess. v0 has to survive intact until Stage 6, because the migration measures the distance between v0 and the system. Any well-intentioned repair shrinks that distance and quietly deletes the evidence.

## Consequences

- Three weeks before anything good exists. The first public post is about building something broken, deliberately.
- `legacy/` needs an explicit, forceful prohibition against improvement, because the default instinct of every tool and agent that touches it is to tidy it. This is now a rule in `CLAUDE.md` and in `legacy/README.md`.
- Writing convincing bad code is a real skill and takes longer than writing good code. Budget accordingly.
- The mess must be *believable*. An obviously synthetic mess produces a worthless audit, so v0 is generated in eras with traceable causes rather than as a pile of random defects.

## What would make us revisit this?

If the generated mess reads as fake — if a defect cannot be traced to a plausible decision by a plausible person under a plausible deadline — then the audit built on it is theatre and the approach has failed. The test is applied at the end of Stage 1: pick any duplicated value and explain which team introduced it and why. If that cannot be answered, regenerate rather than proceed.
