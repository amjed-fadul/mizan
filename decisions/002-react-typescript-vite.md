# Decision 002 — The stack is React, TypeScript and Vite

**Date:** 2026-08-04
**Status:** accepted

## Context

Before any code could be written, the component layer needed a target. The choice also determines what the legacy system is written in, since v0 and the system that replaces it must share a stack for the Stage 6 migration to demonstrate anything.

## Problem

What should the components — and therefore the legacy system, the Storybook, and everything the agents read and write — be built in?

## Constraints

- The Stage 7 deliverable is a headless skeleton other teams can fork, which argues for framework independence.
- Stage 5 depends on agent tooling that reads component structure. Whatever exists off the shelf will be built for the mainstream ecosystem.
- Solo, four to six hours a week. Fighting a toolchain is not affordable.
- This is a portfolio artifact. A hiring manager should be able to read it without first learning an unfamiliar framework.

## Options

1. **React + TypeScript + Vite + Storybook.**
2. **Web Components (Lit) + Storybook.** Framework-agnostic output, which suits a headless skeleton better.
3. **Plain HTML and CSS for v0, defer the framework choice to Stage 4.**

## Trade-offs

Option 1 has the deepest tooling, the largest share of hiring-manager familiarity, and the ecosystem that agent tooling targets first. Its cost is real: React is a framework commitment inside an artifact that claims to be headless, and the claim gets weaker the further React leaks past the component layer.

Option 2 tells a better headless story and would make the fork demo more honest. It costs tooling maturity, a smaller pool of readers who can evaluate the code at a glance, and more time spent on problems that are not design-system problems.

Option 3 makes v0 more believable as a legacy artifact — real legacy systems predate the current framework — but breaks continuity with Stage 4. Auditing a mess in one technology and rebuilding in another means the migration exercise compares two things that were never comparable.

## Decision

React, TypeScript and Vite, used for both v0 and the real system. Storybook for the component documentation layer.

## Why

The framework independence that Option 2 buys applies to the component layer only, and the component layer is not the part being extracted. What Stage 7 publishes is the *machinery* — the token pipeline, the checks, the sync plugin, the agent instruction format — and none of that is React-specific. Tokens are JSON, checks are scripts, rules are prose. A team forking the skeleton brings their own components regardless.

Choosing React costs a weaker headline claim and buys a materially faster build, better agent tooling, and code a reader can evaluate immediately. At four to six hours a week, build speed is the binding constraint.

## Consequences

- The headless claim in Stage 7 has to be stated precisely: the *machinery* is headless, not the component library. Overstating it would be caught immediately by anyone who looks.
- `machinery/` must stay free of React. This is now a specific thing to watch for, not a general principle — a check for it belongs in the governance ladder.
- v0 and the real system share a stack, so the Stage 6 migration measures what it claims to measure.
- If React does leak into `machinery/`, the fork demo will expose it publicly, which is the right place for it to be caught.

## What would make us revisit this?

The Stage 7 fork demo is the test. If feeding the skeleton a different brand turns out to require touching React-specific code, the coupling is real and the boundary — not necessarily the framework choice — needs to move. A second signal: if agent tooling in Stage 5 turns out to work off framework-neutral output anyway, the main argument for React weakens considerably and Option 2 deserves a second look for any future component work.
