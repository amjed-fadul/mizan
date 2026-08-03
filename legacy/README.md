# legacy/ — Mizan v0

## Do not fix anything in this directory.

This directory holds **Mizan v0**: a deliberately broken legacy design system, representing two product teams that drifted apart over years from a shared ancestor stylesheet. Six near-identical grays. Three separate button implementations. Inconsistent spacing and radii. Arbitrary type sizes. English-first assumptions. Physical `left`/`right` CSS. Contrast failures. Duplicated components that diverged silently.

All of it is intentional. All of it is a **fixed artifact**.

## The rule

Do not refactor this code. Specifically, and not exhaustively:

- Do not correct a hex value, even one that is obviously a typo.
- Do not merge duplicate colours, spacing values, or components.
- Do not convert physical CSS properties (`margin-left`, `padding-right`, `text-align: left`) to logical ones.
- Do not add `aria-label`, `alt` text, roles, or any other accessibility improvement.
- Do not fix contrast failures.
- Do not deduplicate the three button implementations, or any other duplication.
- Do not tidy formatting, rename variables, extract helpers, or modernize syntax.
- Do not add tests, types, or linting.
- Do not "improve" anything.

## Why

This code is the subject of two exercises that depend on it staying broken.

**The audit.** Mizan v0 is the mess a new Design System Designer inherits in Stage 1 — inventoried, mapped for duplication, assessed for accessibility and RTL failures, and prioritized. Every architectural decision in the real system is an answer to something found here. If the mess is quietly cleaned up, the audit has nothing to find and the decisions that follow lose their justification.

**The migration.** Later, these same screens get migrated to the real system, partly agent-assisted, as a demonstration that the system can absorb existing product code. A pre-cleaned legacy is a migration that proves nothing.

Repairing this code destroys both. The value is in the diff between v0 and what replaces it, and every well-intentioned fix shrinks that diff.

## If a task seems to require editing this

Stop and ask a human. That includes tasks that look purely mechanical — a repo-wide lint fix, a formatting pass, a codemod, a dependency upgrade that rewrites source, an automated accessibility sweep. `legacy/` is excluded from all of them by intent, and a tool that does not know that is not permission.

The one legitimate reason to change files here is that the mess itself is being authored or extended, and that is deliberate work with its own instructions — not incidental cleanup.
