# machinery/

The brand-agnostic half of Mizan. Everything here is pipeline: build scripts, deterministic checks, Figma plugins, component metadata schemas, and agent instruction files.

**What belongs here:** logic, structure, schemas, checks, plugins, and instructions that would work unchanged for a different company with different values.

**What does not belong here:** Mizan colours. Mizan token values. Arabic copy. Anything naming Mizan Market or Mizan Move. Anything that is a *value* rather than a *rule about values*.

The test, stated plainly: **if you deleted `content/`, everything here should still make sense.** A script that validates "semantic tokens must reference a primitive" belongs here. The list of Mizan's semantic tokens does not. A check that flags physical CSS properties belongs here. The Arabic type scale does not.

This seam is not stylistic tidiness. It is what makes extracting a headless open-source skeleton a weekend's work instead of a rewrite. Every time a Mizan-specific value leaks into `machinery/`, the extraction gets more expensive.

## Contents

| Path | Purpose | Arrives |
|---|---|---|
| `scripts/` | Deterministic checks and build scripts | Stage 2 |
| `metadata/` | Structured per-component JSON — the agents' knowledge base | Stage 4 |
| `agents/` | Agent instruction files | Stage 5 |

Mizan's own values live in [`content/`](../content/).
