# Decision 013 — The Arabic type scale is a mode of the Latin scale, and script becomes a third dimension

**Date:** 2026-08-04
**Status:** accepted — decided, not yet implemented

> **Implementation gap, stated so it is not mistaken for done.** `content/tokens/modes.json` still declares two dimensions (theme × product) and `packages/tokens/` still holds four combinations. The Arabic typography tokens currently exist as `arabic-*` primitive names rather than being resolved by a script mode. This entry records the decision and its costs; the eight-combination matrix is Stage 3 work, alongside the Figma mode mapping that makes the ceiling concrete.

## Context

`content/rules/rtl-arabic.md` listed this as an open question and said explicitly that it should not be settled before the token layers existed, because it interacts with the token architecture. The token layers now exist, so it is answerable.

Arabic needs more line-height than Latin at the same nominal size, needs its own font stack, and reads optically smaller at the same `font-size`. The question is what shape those facts take in the token system.

## Problem

Is the Arabic typography scale a **mode** of the Latin scale — one set of names resolving differently by script — or a **parallel scale** with its own namespaced names?

## Constraints

- [Decision 007](./007-modes-for-shared-namespaces-for-unique.md) established the test: modes for what both sides have, namespaces for what only one has.
- Figma Professional allows ten variable modes. Four are already committed to light/dark × Market/Move.
- Arabic is a primary market, not a localisation pass.

## Options

1. **A parallel Arabic scale** — `font-size.arabic-100…800`, `line-height.arabic-*`, namespaced throughout.
2. **A mode** — one set of names, resolved by script.
3. **No system-level answer** — each component adjusts for Arabic itself.

## Trade-offs

Option 3 is what v0 did by omission, and the audit found the result: one global `letter-spacing` reaching every Arabic string, and two Move components that had independently discovered the problem and fixed it locally for Latin reasons. That is the failure mode of leaving it to components — the rule gets decided repeatedly, inconsistently, and in the wrong place.

Option 1 is the intuitive answer and it fails 007's test. Run it honestly on every Arabic typography token: `line-height.arabic-normal` has a Latin counterpart in `line-height.normal`. `font-family.arabic` has `font-family.sans` — both are "the interface face for this script". The optical correction's Latin counterpart is the identity, 1.0. **Every Arabic typography token has a Latin counterpart, and nothing on the Arabic side resembles `mobility.eta`** — no concept that exists for one script and not the other. Under 007 that is a mode by definition.

A parallel scale would also drift. Two eight-step scales maintained separately diverge the first time either end is adjusted, and nothing would catch it.

## Decision

**A mode.** One set of typography names, resolved by script.

Consequently **script becomes a third mode dimension**, and the combination count goes from four to eight.

## Why

007's test is factual rather than stylistic, and it comes out unambiguous here. Applying it consistently matters more than the local convenience of either answer — an architecture whose rules are applied selectively is not an architecture.

The shape constraint follows and is worth stating: **the two scales must stay the same shape.** Three line-height steps on each side, not four and three. One size multiplier, not eight Arabic sizes shadowing eight Latin ones. Two scales of different shapes are two scales, and a mode would have nothing left to resolve.

This is also why the optical correction is a single multiplier (`font-size.arabic-scale`, 1.08) rather than a parallel size ramp. A multiplier cannot drift, because there is only one of it.

## Consequences

- **Eight mode combinations.**

> **Correction, made while building the Figma sync plugin.** This consequence originally read: *"007 cited Figma's ten-mode ceiling as a background constraint; at eight it is a live one. Any fourth dimension now has to displace something rather than be added."* That is wrong, and it was wrong because it assumed one architecture without saying so.
>
> Figma's ten-mode limit is **per variable collection**, and there is no documented limit on the number of collections. The constraint therefore depends entirely on how dimensions are mapped:
>
> - **One flat collection, one mode per combination** — 4 modes now, 8 with script, 16 with direction. Here the ceiling is real and my original arithmetic was right.
> - **One collection per dimension** — each holds exactly 2 modes, forever. Adding a dimension adds a *collection*, not modes. The cartesian product is never materialised and the ceiling never binds.
>
> The sync plugin uses collection-per-dimension, so the ceiling is not a live constraint. What that choice costs instead is the slot indirection: a variable lives in one collection, so a token varying by two dimensions cannot be expressed directly and needs the selector-plus-slots pattern from [007](./007-modes-for-shared-namespaces-for-unique.md)'s amendment. The plugin refuses such a token rather than flattening it.
>
> The real lesson is not the number. It is that **a constraint attributed to a tool was actually a property of an unstated design choice** — and stating the choice dissolved it.
- **Script mode is not applied where the other two are.** Light/dark and Market/Move are properties of a whole rendered page. Script is not — an Arabic page contains Latin runs and an English page contains Arabic ones, which is exactly what the bidi rules exist for. So the script mode is scoped to a subtree, selected by `:lang()` and set on the same element that sets the language. **A script mode applied at the document root is wrong for precisely the content the bidi rules are about.** This is a genuine asymmetry between dimensions and the mode machinery has to tolerate it.
- The optical correction reaches leading on its own, because line-height is a unitless ratio. Applying it twice is a real and easy mistake.
- `font-size.arabic-scale` at 1.08 has only 0.3% of margin under its ceiling: the tightest Latin rung is 12→13px at 1.083, and any correction at or above that makes the Arabic rendering of one step indistinguishable from the Latin rendering of the next, collapsing an eight-step scale to seven. If Arabic ever needs a larger correction, **the 12/13 rung is what has to change first** — not the multiplier.

## What would make us revisit this?

If Arabic turns out to need a typographic concept Latin has no counterpart for, 007's test flips and that specific token gets namespaced while the rest stay a mode — the two mechanisms coexist by design. The more likely pressure is the mode ceiling: if a fifth dimension becomes necessary, something has to give, and script scoped to a subtree is the most separable of the three since it is already applied differently from the others.
