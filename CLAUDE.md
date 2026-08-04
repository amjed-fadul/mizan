# CLAUDE.md — how to work in this repo

## What Mizan is

Mizan is a multi-product design system built to demonstrate a full design-system operating model — architecture, judgment, governance, designer experience, and AI-native workflows — with exceptional Arabic/RTL capability.

It is built solo, in public, over roughly eight months, with Claude Code as the engineering partner and one human at the review gate.

**Mizan Labs** is the fictional company that owns two products:

- **Mizan Market** — grocery and everyday commerce. Browsy, image-forward, conversion-oriented. Comfortable density.
- **Mizan Move** — ride-booking. Glanceable, real-time, high-stakes. Compact density — someone is holding a phone at a curb.

They share one core and diverge deliberately. Working out what is shared and what is product-specific *is* the project.

---

## The seven non-negotiable rules

1. **One source of truth.** `content/tokens/` is the only editing surface. Figma variables and CSS are generated displays, never editing surfaces. Sync is one-way, always outward.
2. **Machinery and content never mix.** `machinery/` is brand-agnostic — pipeline, checks, plugins, agent instructions. `content/` is Mizan's own tokens, rules, and Arabic specifics. If you deleted `content/`, everything in `machinery/` should still make sense.
3. **RTL is a rule layer, not an agent.** Every agent reads the same rules in `content/rules/rtl-arabic.md`. Correct behaviour is unavoidable, not invoked.
4. **Scripts for facts, agents for judgment.** Anything checkable gets a deterministic check. Agents are only for what genuinely requires judgment.
5. **No boss agent.** Fixed loop, checklist routing. Final review is human, always.
6. **Every agent has a documented rejection path.** Each agent file ends by answering: *what rejects this agent's output, and who decided the rule?* The answer terminates in a deterministic check or in a human — never in another agent, all the way down.
7. **Every artifact must answer: what design-system capability does this prove?** If it proves nothing, it does not get built.

---

## The legacy quarantine — read this before touching `legacy/`

`legacy/` contains **Mizan v0**: a deliberately broken legacy system representing two product teams that evolved independently from a shared ancestor stylesheet. It is a fixed artifact, not work in progress.

**Do not, under any circumstances:**

- refactor it, or extract shared code from it
- fix or consolidate a hex value
- convert a physical CSS property (`margin-left`, `text-align: left`, `float`) to a logical one
- add an `aria-label`, alt text, focus state, or any other accessibility improvement
- deduplicate the near-identical grays, the three button implementations, or anything else
- correct the spacing scale, the type sizes, or the letter-spacing
- add i18n plumbing or `<bdi>` wrappers
- "tidy up while you're in there"

**Why:** this code is the subject of a design-system audit (Stage 1) and later an assisted migration (Stage 6). Both exercises measure the distance between v0 and the system that replaces it. Repairing v0 destroys the evidence and the exercise.

**If a task appears to require editing `legacy/`, stop and ask.** Fixing it is almost never the intent.

The only legitimate reasons to edit `legacy/` are: adding *more* period-appropriate mess during Stage 1, or performing the Stage 6 migration when that stage is explicitly underway.

---

## Where things live

| Path | Holds | Does not hold |
|---|---|---|
| `machinery/` | brand-agnostic pipeline, checks, plugins, agent instructions | Mizan colours, token values, Arabic copy, anything naming Market or Move |
| `machinery/scripts/` | deterministic checks and build scripts | judgment calls — those belong to agents or humans |
| `machinery/metadata/` | per-component JSON that becomes agent knowledge | prose documentation for humans |
| `machinery/agents/` | agent instruction files, each with a rejection path | agents that review other agents |
| `content/` | Mizan's tokens, rules, Arabic specifics | pipeline logic, build scripts, anything another brand could reuse |
| `content/tokens/` | DTCG JSON — the only token editing surface | generated CSS or Figma output |
| `content/rules/` | the RTL/Arabic rule layer every agent reads | product-specific exceptions |
| `decisions/` | the Decision Log — one entry per significant call | status updates, meeting notes |
| `brief/` | the Mizan Labs brief: company, products, constraints | fictional coworkers or invented arguments |
| `packages/` | build output and the artifacts that consume it — generated token files, the preview app | a token value, a hex, or any fact not derived from `content/` at build time |
| `legacy/` | Mizan v0, quarantined | anything correct |

`packages/` is the one directory nothing is authored into. `packages/tokens/` is build output — editing it is editing a display, and the next build overwrites the edit. `packages/preview/` is hand-written, but its rule is that it may read the build output and may not restate it: the first hardcoded token value there is the same defect as an edited generated file, arriving by hand. Mizan's own content still belongs in `content/`; where the preview currently breaks that, [decision 018](./decisions/018-the-preview-reads-the-build-output.md) says so and states the trigger for moving it.

---

## RTL and Arabic

`content/rules/rtl-arabic.md` is the single rule layer. Read it before writing any CSS or component code outside `legacy/`. It is a living document — when a new rule is decided, it goes there, not into a component.

The short version, which the file expands: logical properties only, never `left`/`right`. `letter-spacing: 0` for Arabic, always. `<bdi>` around mixed-direction content. Directional icons mirror; logos, media controls, and maps do not.

---

## Operating discipline

- **One session, one task.** "Add spacing tokens" is a session. "Do Stage 2" is not.
- **Commit after every working step.** Git is the undo button and the build log. Write the message clearly — a human reads it.
- **Review outcomes, not code.** Run it, look at it, flip it to RTL, break it on purpose.
- **Stuck for 30 minutes means stop.** Fresh session, describe from zero.
- **Feed the Decision Log the moment a decision happens**, not at the end of the week. Refusals especially — a documented "no" with reasons is the most valuable entry type in this repo.

---

## Vocabulary

**Use:** design tokens, DTCG, Figma variables, component API, MCP, Code Connect, governance, linting, deprecation, migration, RTL, WCAG, headless, multi-brand.

**Never use:** "autonomous", "self-healing", "fully agentic". Mizan is deliberately not autonomous — agents do the mechanical work between gates a human owns. Say that proudly rather than dressing it up.
