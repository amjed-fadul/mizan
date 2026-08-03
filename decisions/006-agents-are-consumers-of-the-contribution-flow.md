# Decision 006 — Agents are consumers of the system, not contributors to it

**Date:** 2026-08-04
**Status:** accepted

## Context

The roadmap was revised to v1.1 mid-Stage-1, adding a governance rule book, component contracts, an agent navigation protocol, and a triage flow for incoming ideas. Most of those are structural refinements. One is a genuine reversal of the obvious default, and it deserves its own entry.

The question surfaced while working out what an agent does when it cannot find a component it needs.

## Problem

When an agent is asked to build a screen and no existing component fits, what should it do?

## Constraints

- Rule 5 of the system: no boss agent, and the final review is human.
- Rule 7: every artifact must prove a design-system capability.
- A contribution flow already exists for designers, and Stage 6 exercises it by refusing a request.
- Solo maintainer. Anything that lets entropy in faster than one person can remove it is fatal.

## Options

1. **Scaffold it.** The agent creates the missing component and carries on. The task completes.
2. **Fail.** The agent reports that it cannot proceed.
3. **File a contribution request.** The agent pauses and enters the same intake flow a designer would use.

## Trade-offs

Option 1 is what almost every agentic coding setup does, and it is why they produce entropy. Each scaffolded component is locally reasonable and globally corrosive: it has no contract, no rejection path, no owner, and no entry in the Decision Log. Ten of them and the system has quietly forked. It also silently converts the agent into a contributor with commit rights over the system's own vocabulary — which is exactly the authority the governance model reserves for a human.

Option 2 keeps the system clean and wastes the signal. A missing component is *information*: somebody needed something that does not exist, which is the most useful input a design system receives.

Option 3 costs latency. The task does not complete, and a human has to look at it. That cost is real and recurring.

## Decision

Agents file a contribution request. They do not scaffold missing components.

## Why

The contribution flow exists to answer four questions about any new component: is this a real problem, does something existing solve it, is it a pattern or a component, and what capability does it prove? Those questions do not become less important because the requester is a machine. If anything they matter more, because an agent will ask for a new component far more readily than a designer who has to build and maintain it.

Stated as a principle: **designers consume the system and the system team curates it — and agents are consumers too.** The symmetry is the point. An agent that can extend the system unsupervised is not governed, however good its output looks in any single instance.

This also protects the thing the project is actually demonstrating. The roadmap's claim is that AI can be introduced into a design system without adding entropy. An agent that scaffolds components is a direct counterexample to that claim, no matter how well it does it.

## Consequences

- Agent tasks will sometimes stop without completing, and that is the intended behaviour rather than a failure to fix.
- The contribution queue receives entries from both humans and agents, so it needs to handle volume it would not otherwise see.
- Every agent instruction file must state this policy explicitly, since the default behaviour of a coding agent is the opposite.
- A refused agent request is a Decision Log entry like any other — and probably a good one, since it records demand for something the system deliberately does not provide.
- Component contracts need `do_not_use_when` and `alternatives` fields, so an agent can be told *"not for rides — use RideCard"* rather than concluding nothing fits.

## What would make us revisit this?

If the contribution queue fills with agent requests that are all obviously legitimate and all get approved unchanged, the gate is ceremony rather than judgment and should be narrowed to the cases that actually need it. The signal to watch is the approval rate: a flow that never refuses is not curating anything.
