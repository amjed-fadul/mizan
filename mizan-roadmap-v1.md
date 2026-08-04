# Mizan (ميزان) — The Builder's Roadmap · v1.1
### A complete design-system operating model — built solo with Claude Code, shipped in public

**Built for:** Amjed — UX/Product/Visual Designer, 2 years design systems at Bayzat
**Constraints designed in:** ~4–6 hrs/week · solo, Claude Code as engineering partner · Figma Professional · Arabic/RTL as the signature stress test and regional moat

**Positioning (memorize this):** *Mizan is a multi-product design system built to demonstrate the full operating model — architecture, judgment, governance, designer experience, and AI-native workflows — with exceptional Arabic/RTL capability.* Not "I built an AI design system" (too narrow). Not "I built a design system" (too generic). The AI work is a chapter of your design-system expertise; the judgment is the spine.

---

## The one-paragraph vision

Mizan Labs is a small fictional company running two products — **Mizan Market** (grocery and everyday commerce) and **Mizan Move** (ride booking) — shipping in English and Arabic. It has a messy, inconsistent legacy design system, and you are its new Design System Designer. Over ~8 months you audit the mess, re-architect the foundation, build a small set of deeply-designed components, put governance and lifecycle into operation, arm designers and agents with machine-readable knowledge, and prove the whole loop in public — ending with an open-source headless skeleton any team can fork. One human sits at the review gate: you.

---

## The product sandbox

**Mizan Market** — grocery and everyday commerce. The flows:

- Home and discovery
- Category browsing — filters, sort
- Product page
- Cart — substitution preferences, delivery slots
- Checkout — address, delivery slot, payment, order summary
- Order tracking — confirmed → preparing → out for delivery → delivered

**Mizan Move** — ride booking. The flows:

- Booking — pickup, destination, map, ride types, price, ETA
- Ride selection — Economy / Comfort / XL / Electric
- Active ride — driver, vehicle, ETA, trip status, contact, safety
- Trip history — previous rides, receipt, route, payment

They diverge on exactly the axes a design system has to answer for:

| | Market | Move |
|---|---|---|
| Mood | browsy, image-forward, conversion | glanceable, real-time, high-stakes |
| Density | comfortable | compact — phone at a curb |
| Unique semantics | `price`, `discount`, `stock`, `delivery` | `eta`, `fare`, `vehicle`, `safety`, `trip` |
| Hard surface | image galleries | a map the system does not own |
| Status vocabulary | in stock → preparing → shipped → delivered | searching → assigned → arriving → in trip → completed |

These two were chosen *because* they force real shared-versus-specific decisions rather than cosmetic theming. Two dashboards would have made Stage 3's argument toothless — same density, same semantics, same status words, and "what's shared?" answers itself. A grocery cart and a moving car don't let you off that lightly: every call has to be argued, and the wrong ones are visible.

---

## The architecture (decided; don't relitigate it mid-build)

```
                    ┌─────────────────────────┐
                    │   tokens.json (DTCG)    │  ← the ONLY thing anyone edits
                    │   + rules + metadata    │     (human or agent)
                    └───────────┬─────────────┘
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
      Style Dictionary    Mizan Sync plugin   Agent knowledge
      → CSS variables     → Figma variables   (DESIGN.md, guides,
      → iOS/Android         & modes            component contracts)
        outputs (demo)          │                 │
              ▼                 ▼                 ▼
         Components        Figma library      Kit · Banna · Rassam · Raqib
         + Storybook       (2 verticals,             │
                            4 modes)                 │
              └────────────────┬─────────────────────┘
                               ▼
                    Governance ladder (always on)
                    1. Schema checks (scripts, day one)
                    2. Drift detector (Figma vs JSON)
                    3. Raqib (three-layer judgment)
                               ▼
                       YOU — the review gate
```

**Non-negotiable rules:**

1. **One source of truth.** Figma variables and CSS are generated displays, never editing surfaces. One-way sync, always outward.
2. **Machinery and content never mix.** `machinery/` (brand-agnostic pipeline, plugins, checks, agent instructions) and `content/` (Mizan's tokens, rules, Arabic specifics) from day one. Core system + localization layer: Arabic is the advanced stress test of a global-grade system, not a fork of it. This seam makes the Stage 7 extraction a weekend.
3. **RTL is a rule layer, not an agent.** Every agent reads the same RTL/Arabic rules. Correct behavior is unavoidable, not invoked.
4. **Scripts for facts, agents for judgment.** Deterministic checks for everything checkable; agents only where judgment is required.
5. **No boss agent.** Fixed loop, checklist routing. Final review is yours, always. *"One human in the loop, at the gate, by design."*
6. **Every agent has a documented rejection path.** Each agent file ends by answering: *what rejects this agent's output, and who decided the rule?* The answer terminates in a deterministic check or in you — never in another agent, all the way down.
7. **Every technical artifact must answer: what design-system capability does this prove?** If it proves nothing, it doesn't get built.

**The agent roster:**

| Agent | Arabic name | Job | Born in |
|---|---|---|---|
| The Prototyping Kit *(arms the designer's own Claude)* | — | prompt → on-system running prototype; the front door | Stage 5, first |
| The Builder | بنّاء **Banna** | Figma design → on-system code; assisted migration | Stage 5 |
| The Auditor | رقيب **Raqib** | three-layer judgment: compliance, consistency, design quality | Stage 6 |
| The Composer | رسّام **Rassam** | prompt → Figma screens assembled from the real library | Stage 7 |

---

## The Decision Log — your most important artifact

A public collection: **Mizan Design Decisions.** Every significant call gets an entry:

```
Context · Problem · Constraints · Options · Trade-offs
Decision · Why · Consequences · What would make us revisit this?
```

A hiring manager can learn whether you know tokens in fifteen minutes. What they can't learn anywhere else is whether you can make difficult system decisions. This log is where they learn it. Seed it with the hard cases the mess will force:

- *Decision 01 — Six grays walked in. Four walked out. Here's who survived and why.*
- *Decision 07 — ProductCard and RideCard look identical. They remain separate components.* (One has a quantity stepper and an add-to-cart action; the other is a radio selection inside a group. Interaction models and content responsibilities differ; visual similarity is superficial.)
- *Decision 12 — A designer asked for a `compact` variant. The answer was no.* (API complexity vs. one team's convenience.)
- *Decision 15 — PromoCard request refused: it's a pattern, not a component.*

Refusals are gold. Good design system designers are component *refusal* machines with reasons. Write every "no" down.

---

## The rule book — how governance rules are structured

Rules are small, scoped, indexed files — never one giant rules document. Four tiers, from broadest to narrowest:

```
principles/   PRN-*   apply everywhere ("semantic tokens only", "respect RTL directionality")
components/   BTN-*   live inside each component's contract ("one primary button per action group")
patterns/     PAT-*   single-page compositions ("price hierarchy beats image dominance in ProductCard")
journeys/     JRN-*   multi-step flows — generic rules, plus ONE named journey per product:
              CHK-*   Market checkout    BOOK-*   Move ride booking
```

- **Stable IDs, never reused.** A retired rule's number is retired forever. Raqib says "CHK-003 violated," not "the checkout doesn't follow the rules" — traceable, versionable, citable.
- **Every rule carries a `rationale` line** — the *why* ("the final action represents commitment to the purchase"). A rule without rationale is a convention the agent enforces; a rule with rationale is intent the agent can reason with in cases you didn't anticipate. This is the Mizan philosophy in one field.
- **Severity per rule:** error / warning / info.
- **Specific beats general:** a named journey's rule (CHK-1) refines and suppresses the generic one (JRN-1) when both apply. Reports show the suppression.
- **An index file** lets agents load only the rules relevant to the task — never all of them.
- **The same rules are checked against Figma designs AND coded prototypes**, flagging the same violations in both. The intent lives above the tools.
- **Humans approve every rule.** AI may help encode; only you enact. (Rules that judge agent output must not be authored by agents — see rule 6.)

---

## Working solo with Claude Code — the operating discipline

- **`CLAUDE.md` in the repo from day one** — the project, the rules above, where things live. You're building a system that teaches AI rules; start by teaching AI your repo.
- **One session, one task.** "Add spacing tokens" is a session. "Do Stage 2" is not.
- **Commit after every working step.** Git is your undo button. Claude writes the commit; you read the message — it's your build log.
- **Review outcomes, not code.** Run it, look at it, flip it to RTL, break it on purpose. Judge by behavior; the governance scripts read the code so you don't have to.
- **Stuck 30 minutes = stop.** Fresh session, describe from zero.
- **Feed the Decision Log** the moment a decision happens, not at week's end.
- **New ideas enter Mizan through your own contribution flow.** Every article, video, or AI suggestion you find mid-build gets triaged like a component request: real problem? already covered? what capability does it prove? which stage does it belong to? Approved → one line in this doc + a Decision entry. Rejected → logged too. No idea gets to re-architect the project from a chat window.

---

## The skill map — what hiring managers scan for, and where you prove it

| What they're looking for | Where you prove it |
|---|---|
| Can you enter a mess and understand it? (audit, prioritize) | Stage 1 |
| Token architecture; semantic intent vs value coincidence; pipelines | Stage 2 |
| Variables, modes, multi-product architecture, library management | Stage 3 |
| Component API design; boundaries; what *shouldn't* exist | Stage 4 + Decision Log |
| Docs + WCAG as a guarantee; designer experience | Stages 3, 4, 8 + DX thread |
| Agentic design-to-code; MCP; metadata; prompt design | Stage 5 |
| Governance, linting, contribution, refusal, deprecation, migration | Stage 6 |
| Prompt-to-design on-system; the full loop | Stage 7 |
| Evals; enablement; workshops; writing; community | Stage 8 + both threads |
| Difficult decisions, documented | Decision Log, everywhere |
| RTL/Arabic and multi-locale rigor | every stage (the stress test) |

---

## Stage 0 — The workshop and the brief (Week 0)

- Install VS Code, Node, Git + GitHub, **Claude Code** (~$20/mo). Repo with `machinery/`, `content/`, `CLAUDE.md`, `decisions/`.
- Write the **one-page Mizan Labs brief**: two products — Mizan Market (grocery and everyday commerce) and Mizan Move (ride booking) — web-first, English + Arabic, small team, real constraints. This is context, not theater — no fictional coworkers, no invented arguments.
- Warm-up: have Claude build a small page; change your mind twice. Learn the direct–inspect–correct loop.
- Start the habits: 3 substantive comments/week (additions, not applause) · quietly line up 2–3 designer friends for Stage 8's research sessions — recruiting is the slowest ingredient.

**Ship:** the "I'm building in public for ~8 months, here's the plan" post.

## Stage 1 — Inherit the mess (Weeks 1–3)

*The stage that makes this feel like the real job — because it is the real job.*

**Build the disease before the cure:** direct Claude Code to generate **Mizan v0** — not one messy legacy system but two, Market's and Move's, both descended from the same ancestor stylesheet and evolved apart by teams that stopped talking. Six near-identical grays, three button implementations, inconsistent spacing and radii, arbitrary type sizes, English-first assumptions, physical `left/right` CSS, contrast failures, a handful of legacy screens per product using all of it.

**The shared ancestry is the important detail.** Some values still match exactly across the two products, some drifted a few hex values apart, some are unrecognisable. That spread is what makes "which of these should merge?" a genuinely hard question in Stage 2 rather than a cleanup chore — identical values can carry different meanings, near-identical ones can carry the same one, and only the audit tells you which is which.

**Then switch roles: you're the new Design System Designer.** Audit it like you would at a real company — inventory every color/spacing/type value, map duplication, find the a11y and RTL failures, identify what designers would struggle with. Write the audit as you would for stakeholders: findings, severity, priorities, what to unify, what to keep separate, what to deprecate, what not to touch.

**Ship:** the audit document + first Decision Log entries. **Post:** "Two product teams, one ancestor stylesheet. I built the drift on purpose, then audited it like my first week on the job."

## Stage 2 — Re-architect the foundation (Weeks 4–7)

**The tokens, done as an intervention, not a greenfield fantasy.** Every architectural choice is now an answer to something in v0's audit — which is exactly how you'd talk about it in an interview.

- DTCG-format JSON (2025.10 Format Module), three layers (primitive → semantic → component), light + dark.
- The hard calls, logged: which of the six grays merge (value coincidence) and which stay (different semantic intent). This is Decision 01.
- **The token architecture fork, decided here:** two mechanisms hide inside "product semantic layers," and conflating them is the classic multi-product failure. *Shared concepts* — `action.primary`, `surface.raised`, `text.secondary` — are needed by both products; namespacing them forces every component to know which product it's in and kills cross-product reuse. These want **one semantic name, with Market and Move as modes.** *Product-unique concepts* — `commerce.price.discount`, `mobility.eta`, `mobility.safety` — have no counterpart in the other product, so a mode has nothing to swap to. These want **namespacing.** The rule: *modes for what both products have, namespaces for what only one has.* Namespace everything and you've built two design systems wearing a trench coat; mode everything and `mobility.eta` becomes inexpressible.
- **Style Dictionary v5** pipeline → CSS variables + a live preview. **Multi-platform maturity, cheaply:** also emit iOS/Android token outputs and write one component spec showing how the same semantics produce platform-appropriate implementations. Demonstrate the architecture; don't build three libraries.
- **Governance rung 1, day one:** schema checks — semantic must reference primitive, no raw hex in semantic layer, naming pattern, contrast pairs pass WCAG.
- RTL/Arabic layer: direction-safe semantics (inline-start/end), Arabic type scale, line-height compensation, letter-spacing locked to 0.

**What the stage actually produced.** *The plan above held. These are the parts it did not predict — and they are the parts worth talking about.*

- **The spec and the tool disagree, and the tool does not get to win.** DTCG 2025.10 is stable and specifies object-based colour — a `colorSpace` and 0–1 components, not a hex string. Style Dictionary 5.5 does not read that; its own documentation calls the support a work in progress. Two ways out: author tokens in whatever the tool accepts this quarter, or author to the spec and quarantine the gap. Tokens are spec-strict, and `machinery/scripts/dtcg-adapt.mjs` degrades them on the way into the build — a throwaway file carrying its own deletion instructions and the tracking issue that triggers them. *A tool's current limitations are not allowed to become the shape of the source of truth.*
- **The contrast gate was written before the tokens, not after.** So tokens were validated as they were authored rather than audited once they existed. The ordering is the whole trick: a check written afterwards has to be reconciled with tokens already in use, and it is always the threshold that bends. A check written first is a constraint the palette is designed against. (Decision 010.)
- **The neutral text ramp lost a tier — 33 colours became 14, and one of the casualties was a whole tier of grey.** Darkening v0's muted grey far enough to clear AA lands it at `#6e6e6e`, which is **1.045:1 against Move's secondary `#6b6b6b`** — the same colour. Three tiers cannot coexist with AA on white and a secondary that resolves per product. Two tiers ship; size and weight carry the distinction colour can no longer make. *Accessibility is not a filter applied after the palette is designed — it is a constraint on how many tiers the palette can have at all.* (Decision 009.)
- **A hue needs both ends of the ramp only if it carries text.** Every saturated hue dark enough to pass on white fails on `#141414`, which looks like an argument for mirroring the whole palette. It is not. Green and blue are fills, and a fill's contrast is measured against its own label, not against the ground behind it. Amber is indicator-only and clears 3:1 on both grounds. Red alone gets light steps, because red alone carries text — and it gets *two*, since one light red would have silently collapsed the `discount`/`safety` refusal in the two dark combinations. (Decision 011.)
- **Script became a third mode dimension.** Every Arabic typography token has a Latin counterpart and none of them is a concept only Arabic has, so 007's own test makes the Arabic scale a mode rather than a parallel scale. The cost is the matrix: four combinations become eight, against Figma Professional's ten. Stage 3's four-mode line below was written when four was the number — any fourth dimension now has to displace something rather than join.
- **Seven Decision Log entries (007–013), and the refusals are the useful ones.** 33 colours became 14 by merging on role and verifying by distance — never the reverse. The measurement had one chance to be decisive and pointed the wrong way: the two brand greens sit 2.90 ΔE00 apart, *above* the 2.3 just-noticeable difference, so a perceptual rule leaves the most consequential merge in the system undone. Loosen it far enough to catch them and it is 1.31 away from swallowing `commerce.discount` and `mobility.safety` — *this costs less* and *this cancels your trip*. *Value coincidence is not semantic identity* stopped being a slogan the moment it cost something.

**Ship:** the pipeline — spec-strict DTCG source, two blocking gates with a self-test that proves they reject things, and generated CSS, iOS and Android output for every mode combination, plus one component spec showing the same semantics land three different ways. **Post:** "Two tokens, same hex, different meaning — who survived my gray massacre and why."

## Stage 3 — Figma joins, synced — and the second product joins the core (Weeks 8–11)

- **The Mizan Sync plugin:** Figma's REST write API for variables is Enterprise-only, but plugins write variables on any plan — yours reads the token JSON and generates the variables. From here, Figma and code update together from one source; nobody hand-edits either. (Tokens Studio is the fallback; the plugin is the better story.)
- **4-mode matrix:** Light/Dark × LTR/RTL (Professional allows 10 modes; you need 4).
- **Two products, one core:** Market and Move sharing primitives with different semantic layers. Multi-product architecture — what's shared, what isn't, and *why* (log it). The two hardest cases are the ones to write up. **Status:** both products need the concept, but the vocabularies and behaviours differ entirely — in stock → preparing → shipped → delivered against searching → assigned → arriving → in trip → completed — so does `arriving` belong in core or only in Move's layer? **Pricing:** `AED 19.99` / `20% OFF` / `Save AED 5` against `from AED 18` / `+ AED 5 surcharge` / `Estimated fare` — different semantics, identical currency and numeral problems underneath.
- **Governance rung 2: the drift detector** — a script that compares Figma's variables to the JSON and shouts on disagreement. Give it a face: a generated **"Mizan Health" HTML dashboard** — every component and token, aligned or drifted, Figma vs code, click into the diff. Governance you can screenshot, not just describe.
- In-Figma docs (descriptions + do/don'ts at the moment of use), a11y annotations, publish to Figma Community.

**Ship:** the library + a GIF flipping one screen through modes and products. **Post:** "My Figma file is a display, not a source."

## Stage 4 — Components: fewer, deeper (Weeks 12–16)

**Five to seven components, not ten.** Button, Input, Card, Dialog, List, Navigation — and go deep. A hiring manager doesn't care that you made thirty components; they care whether you understand component *boundaries*.

**Every component gets the full API spec:**

```
Anatomy · Responsibilities · Variants (which differences are legitimate?)
States · Properties exposed · Content designers control
Constraints (what they may NOT customize) · Accessibility guaranteed
RTL behavior · Code API mapping · How we'd deprecate it
```

- The v0 cleanup pays off here: three legacy buttons become one, documented as a consolidation decision. ProductCard and RideCard *stay separate* — Decision 07, your flagship judgment entry. ProductCard carries image, name, price, discount, quantity, availability; RideCard carries vehicle, ride type, ETA, price, capacity. Superficially the same box, but ProductCard has a quantity stepper and an add-to-cart action while RideCard is a radio selection within a group — the interaction models and content responsibilities differ.
- Props mirror Figma properties exactly (`state`, `size`, `direction`) — the mirroring is the skill.
- CSS logical properties only. **Storybook** deployed free, a11y addon running, usage guidance beside each component, plus the **"Start here" page written for designers** — how to find things, when detaching is okay, how to request something new.
- **Write stories as agent documentation:** JSDoc descriptions on every component and prop, well-named stories covering real usage, and play functions on 2–3 interactive components. Agents read your stories to learn how to use components — the same care that serves humans now trains machines.
- Begin `machinery/metadata/`: structured JSON per component — quietly becoming the agents' knowledge. Together with the API spec above, this is the **component contract**: the contract describes, the checks verify (don't build a generate-everything-from-contract pipeline — that's a platform team's roadmap, not yours). Each contract includes:
  - purpose, do/don'ts, RTL behavior
  - **`do_not_use_when` + `alternatives`** — boundaries, not just instructions ("not for rides — use RideCard")
  - **`aiHints.keywords`** ("card, product, grid, listing") — what lets a future agent *find* the component instead of scaffolding a duplicate. The metadata is not documentation for humans; it is the component's identity for AI.
  - Generate contracts with a skill you write once — never hand-author per component.

**Ship:** the Storybook URL. **Post:** "A component can be reusable and still be a bad component."

## Stage 5 — The AI layer: arm the designers, then the agents (Weeks 17–20)

*AI as an evolution of a well-designed system — sitting on top of judgment, never replacing it.*

- **The Mizan Prototyping Kit, first:** DESIGN.md + component guides + components, packaged as a skill for any designer's own Claude session. Prompt → on-system, correctly-themed, Arabic-correct running prototype. The system's front door, matching how designers actually work.
- **The money demo, in two halves:** first, the same feature prompt twice — plain Claude (generic, off-system, broken RTL) vs. the Kit. Then the same system prompted for both products — a Market product page and a Move ride-selection screen — producing two visibly different results that are both unmistakably on-system. Half one proves the system constrains AI; half two pre-empts the objection every design-system demo invites, that constraint means homogenisation. The claim is the pair: *the system constrains AI without making every product look the same.* Record all four. Pin it everywhere.
- The component map: Figma ↔ code ↔ props ↔ properties, generated from the contracts. Official Code Connect is Organization-gated; build the open equivalent and write about the gap.
- **Check Storybook MCP first** (early access, launched late 2026): it auto-generates the code-side component manifest — props, types, stories — as structured agent context. If it covers the code side, adopt it (rule 7: don't build what exists off the shelf) and spend your effort where it stops: the RTL rule layer, the Figma side, the judgment.
- Connect **Figma's MCP server** (remote works on all plans) to Claude Code.
- **Banna v1:** Figma selection → on-system code. Banna's real question, stated in his instruction file: *how does the system provide enough structured knowledge that AI reliably implements approved design decisions?* Rejection path: lint + your gate.
- **Encode the six-phase navigation protocol** in every agent's instructions: **Orient** (read the constitution/CLAUDE.md) → **Explore** (read the codebase index in `.ai/`, find components by keywords) → **Study** (read an existing screen to learn conventions and precedent) → **Gather** (confirm the exact tokens exist, semantic tier only) → **Write** (fully constrained; every choice traceable to something read) → **Verify** (self-check against the gathered rules).
- **Missing-component policy — a deliberate reversal:** when an agent can't find a component, it does NOT scaffold one into the system (that would bypass your contribution flow). It pauses and files a contribution request. Designers consume; the system team curates — agents are consumers too. Log this as a Decision entry.
- **Build agents as thin personas over shared skills** — small focused skills (`find-component`, `audit-rtl`, `check-parity`), not giant prompts. Rassam, Banna, Raqib, and your CI draw from the same skill pool instead of duplicating logic.

**Ship:** the Kit + before/after video. **Post:** the video + "context, not magic."

## Stage 6 — Operate the system: governance, lifecycle, refusal (Weeks 21–25)

*The stage that separates "built a library" from "ran a system."*

- **`mizan-lint` in CI:** off-system hex, non-token spacing, physical direction properties, missing `<bdi>`, unflippable-icon rules. Violating PRs fail visibly.
- **Raqib, with the three-layer quality model:**
  - *Layer 1 — Compliance:* does it follow the system? (mostly deterministic, scripts underneath)
  - *Layer 2 — Consistency:* does it behave like existing patterns behave?
  - *Layer 3 — Design quality:* hierarchy, density, task clarity, component overuse — is it actually a good solution? Raqib flags; you judge. This layer is your designer expertise, encoded as questions rather than rules.
- **Raqib cites his sources:** violations reference rule IDs ("❌ CHK-003, rationale: the final action represents commitment") and — the part nobody else has — **Decision Log precedent** ("similar variant refused in Decision 12"). Statutes + case law. He runs the same rule book against Figma designs and Storybook prototypes, catching identical violations in both.
- **The contribution exercise:** a "PromoCard" request enters the flow — is it a real problem? does an existing component solve it? pattern or component? → RFC → decision: *refused; it's a pattern.* Documented end to end. (Decision 15.)
- **The lifecycle exercise:** Button v1 → v2. Deprecation notice, migration guide, Banna-assisted migration of the legacy screens, adoption tracked, v1 removed. Maintenance demonstrated, not just creation.
- **The Mizan Assistant** Figma plugin — for designers, not police: one-click RTL preview, flags icons that shouldn't mirror, applies correct Arabic text styles. One repetitive task removed well.

**Ship:** CI-rejection GIF, the RFC, the migration story. **Post:** "The npm package is the textbook. This is the examiner." / "I deprecated my own component. Here's the migration."

## Stage 7 — Rassam, the round trip, and the extraction (Weeks 26–29)

- **Rassam v1** via Figma's MCP canvas writing (beta, works on your plan): *assembles* screens from the published library — real instances, your variables and modes. His stated question: *how can AI compose interfaces without creating new system entropy?* Rejection path: drift detector + Raqib + your gate.
- **The capstone video:** one prompt → Rassam builds the screen in Figma (a Market product page, in Arabic) → Banna implements it in code → Raqib audits all three layers, citing rule IDs → you review at the gate. On-system in both directions, RTL-correct throughout. Nobody has published this loop with RTL in it. The caption that sells it: *"The design intent survived from human decision → Figma → AI → code → governance."*
- **The extraction:** strip `content/` out and publish the skeleton — an open-source, headless, bidirectional-by-default design-system starter any team can fork and feed. The seam makes this a weekend.
- **Prove the fork:** feed the skeleton a different mock brand in one afternoon. Record it. "Same machinery, different brand, two hours."

**Ship:** round-trip video + skeleton repo + fork demo.

## Stage 8 — Prove it in public (Weeks 30–33)

- **Designer research sessions:** your 2–3 recruits build a checkout screen with Mizan + the Kit while you watch. Where do they look? What do they misunderstand, detach, override, ask? Publish "What I learned watching designers use my design system," ship one prioritized fix, show before/after. Research → insight → system change → measurable improvement. *"I ran user research on my own design system."*
- **The Arabic UI Eval:** 3–4 popular AI UI tools × 15–20 Arabic/RTL tasks, scored against your published rules, screenshots included. The tasks come out of Market and Move: currency placement (`AED 12.50` vs. `١٢٫٥٠ د.إ`), Arabic-Indic against Western numerals and when each is correct, mixed-direction product titles (`Apple iPhone 17 Pro` / `256GB` / `AED 4,299` sitting inside an Arabic layout). Only a designer who reads Arabic can make this. Evaluate **Storybook Evals** as the harness (benchmark prompts, quality/cost/conformance over time) instead of building one from scratch — and use its framing for your ROI story: *you can now measure how much better agents perform with your system than without it.*
- **Publish `mizan` to npm** — tokens, components, agent guides, lint rules, docs. The installable source of design knowledge.
- **The capstone case study**, structured as the loop: product need → design problem → system decision → tokens/components/guidance → designers + AI → production code → adoption → iterate/remove → back to decisions. *That loop is the design system — not the Figma library, not the tokens, not Storybook.*
- Recorded 30-minute hands-on workshop + offer the talk to a Dubai design meetup.

**Ship:** research synthesis + eval + package + case study + workshop.

---

## How this deploys at a company (the "forty designers" answer)

**Designers never branch the system repo.** The system leaves the repo as versioned, installable artifacts — npm package, Kit skill, agent files, MCP config. Release v2.3 and everyone's Claude reads v2.3. A designer's day one: scaffold a disposable scratch project with the Kit preinstalled → prompt → share a preview link → the approved flow goes to Figma as the record (Rassam), then to code (Banna). Missing component? File a request through the contribution flow — designers consume, the system team curates. **Assistance is invited, enforcement is ambient:** helpers activate on request; examiners run automatically and can't be skipped. Stage 8's research sessions are the dress rehearsal of exactly this deployment.

## The DX thread — designers are the system's users (runs throughout)

In-Figma do/don'ts (S3) · designer-language "Start here" (S4) · the Kit as front door (S5) · the Assistant (S6) · contribution flow that invites instead of gatekeeps (S6) · research + shipped fix (S8) · workshop (S8). The sentence this thread buys: *"I treat the design system as a product whose users are designers."*

## The publishing thread (runs throughout)

One substantive post every two weeks + 3 comments/week. Anatomy: pain → decision → demo → lesson. **Lead with decisions, carry with demos:** "When should two identical colors remain separate tokens?" · "I tried to merge two components. Here's why I didn't." · "I gave my design system to another designer — here's everything they misunderstood." · "I deprecated my own component." · "Can AI tell a pattern from a component?" Vocabulary on purpose: design tokens, DTCG, variables, component API, MCP, Code Connect, governance, linting, deprecation, migration, RTL, WCAG, headless, multi-brand.

**Vocabulary to avoid, on purpose:** "autonomous," "self-healing," "fully agentic." Your line, said proudly: *"Mizan is deliberately not autonomous — agents do the mechanical work between gates a human owns."*

## What this plan cannot give you — say it before they think it

Real organizational scars — live stakeholder conflict, political adoption fights — can't be simulated honestly, so Mizan doesn't pretend (no fictional coworkers, no invented arguments). The mess is simulated; the people are real: research participants in Stage 8, the community in your comments, and your two Bayzat years supplying the war stories in interviews. Simulate the mess, not the people.

## The final test (keep this taped above your desk)

A hiring manager asks: *"You've joined us. We have 200 components, inconsistent tokens, three product teams, and designers complaining the system slows them down. What do you do?"*

Every stage above exists so you can answer with artifacts instead of theory: the audit (S1), the semantic surgery (S2), the unify-or-separate reasoning (S4, Decision Log), the contribution and RFC model (S6), the deprecation playbook (S6), the design-code bridge (S3, S5), the adoption evidence (S8), and how to introduce AI without adding entropy (S5–S7). If Mizan lets you answer that question with things you can *show*, it worked.

## Cost sheet

| Item | Cost |
|---|---|
| Figma Professional | already have |
| Claude Code | ~$20/mo |
| Everything else (GitHub, Style Dictionary, Storybook, Vercel/Netlify, npm, Figma Community, remote MCP, Plugin API) | free |
| Code Connect (official) | Org-gated → open equivalent in Stage 5 |
| Figma Variables REST write API | Enterprise-gated → your Sync plugin in Stage 3 |

---

*Nine stages, ~33 weeks at 4–6 hrs/week. Every stage ships. Refusals get written down. One human at the gate.*

*Start date: ______ · Stage 1 ships: ______ — يلا نبني*
