# Briefing — Stage 3 review fixes

Written 2026-08-04 for the next session, human or agent. Delete it when the list is done.

Four reviewers went over PR #1 (`stage-2/preview`) and PR #2 (`stage-3/tooling`). Every finding below was **reproduced**, not inferred. The counts they verified: `selftest` 144, `figma:dry-run` 159, `check` 40, `build:tokens` clean, `legacy/` untouched by both PRs, and the WCAG contrast maths correct to four decimals against nine known pairs.

Read `CLAUDE.md` first. Never lower a threshold to make something pass. Never tidy `legacy/`.

---

## A. Gates that pass on exactly what they exist to catch — PR #2

Fix each, and add an assertion that **fails before the fix and passes after**. Run it against the unfixed code first and record what you saw.

### ~~A1 — a mode deleted in Figma is not drift~~ — **done** in `6d73cae`

New drift class `mode-missing-in-figma`, and the line drawn per *dimension* rather than per collection: a collection that maps onto a dimension has taken it on, so a mode of that dimension it does not carry is a gap; a dimension no collection maps onto is not modelled at all, every value is compared against every combination along it, and a source that varies reports a value finding instead. `figma/mode-deleted.json` and `figma/dimension-flattened.json` assert both halves. selftest 144 → 154.

### ~~A2 — two token paths projecting to one Figma name are permanently non-idempotent~~

**Done** in `522ca46`. Two checks at two layers: `token-model.ts` now calls `SEGMENT_PATTERN` — it was exported and enforced nowhere, and the plugin is a second entry point into the same token root that `check-schema.mjs` cannot vouch for — so a `/` inside a segment is a `naming-pattern` error at load. `plan.ts` gains `checkDistinctNames` over the desired set, keyed on `(collection, name)`, shaped on `sheet.ts`'s `checkSiblingNames`, naming both token paths and the single Figma name. Both are errors, not warnings: the failure is a gate nobody can ever clear. `dry-run` 178 → 187, five of the nine verified failing against the unfixed source. Nothing to do here.

### ~~A3 — a pair's `modes` list can silence the pair entirely~~ — **done** in `d3a8c00`

**Behaviour change, stated loudly in the code, the README and the commit.** A `modes` list now means: for every dimension it mentions, the combination's mode for that dimension must be one of the listed ones — or within a dimension, and across them. Picked over a plain or because it changes nothing that had a meaning: a list naming at most one mode per dimension is a conjunction exactly as before, and the two rules differ only where the old one selected nothing. Behind it, `pair-mode-unknown`, `exception-mode-unknown`, and `pair-never-evaluated` — the invariant that this gate never reports a pass having skipped a declared pairing, whatever the scope grammar becomes. No reachability error for an exception: a pair with an empty scope fails open, an exception with one fails safe. selftest 154 → 164.

---

## ~~B. Claims the repository has already retracted and never propagated~~ — **done** in `72a95e9`, `569ce38`, `87e5efb`, `12ae314`

**One item remains open — see the bottom of this section.**

- ~~`decisions/008` contradicts itself; `pairs.json:32` repeats the wrong version.~~ `72a95e9`. Consequences corrected; `action.primary` resolves per product, confirmed in `modes/product.*.json` and measured at 5.64:1 (green) and 5.27:1 (blue). **One correction to the finding:** `pairs.json` is *not* carried into Figma. It is in the plugin bundle, but `loadBundle` excludes root-level files from the token documents by rule — verified by loading the real bundle: 77 token nodes, none carrying any `pairs.json` string. `semantic/shared.json` *is* carried, via `describeToken` → `set-description`. So of the two "shipped `$description`" findings, only the `border.control` one reaches a designer's hover.
- ~~`decisions/008:101` — 33 → 14 / no primitive without a consumer.~~ `72a95e9`. Confirmed 23 colour primitives and 40 `unused-primitive` warnings with `neutral.200` the only colour. Added: 15 colour semantics across the three semantic files, two of them the `text.secondary-*` plumbing slots. The 14 could not be reconstructed and is recorded as unreconstructable rather than replaced with a guess. `mizan-roadmap-v1.md` repeated the same figure and was corrected with it.
- ~~The ten-mode-ceiling claim.~~ `72a95e9` (decisions) and `569ce38` (rules, roadmap). `013`'s revisit line and — **not on this list, found while sweeping** — `014`'s first consequence, which repeated "against a ceiling of ten. Comfortable rather than tight". Both retracted in place with the wrong sentence quoted. `007` gained a pointer to both corrections; its own constraint line is left standing because nothing in 007 rested on it.
- ~~`health-dashboard.mjs:686` and the missing `--bridge` source.~~ `87e5efb`. Verdict text rewritten; `--bridge`, `--bridge-port` and `--bridge-timeout` now forwarded in check-drift's precedence, and `sourceLine` renders a bridge source instead of falling through to `Figma file undefined (live)`.
- ~~`README.md:34` "Stage 0", and the missing `packages/` and `machinery/figma-plugin/`.~~ `569ce38`. Map gained `packages/`, `machinery/figma-plugin/` and `machinery/scripts/`; status block now separates *variable library published* from *component library does not exist to publish*.
- ~~`mizan-roadmap-v1.md:223` omits the proof sheet and the read bridge.~~ `569ce38`. Both added with what each proves, plus the publish state. **Size figure adjusted:** the two dedicated module sets measure ~2,200 lines (`sheet.ts` + `sheet-apply.ts` + `memory-nodes.ts` = 996 as added; `bridge.ts` + `lib/bridge.mjs` + `lib/ws-server.mjs` = 1,220). The 2,600 could not be reproduced, so the roadmap says 2,200 with the harness excluded.
- ~~`brief/mizan-labs.md:30` Arabic-Indic numerals.~~ `569ce38`. Reframed, not deleted — the line stands as written with 012's refusal beside it and the three things that make it defensible: 012 calls it the weaker of its two arguments, the Arabic-Indic path is kept working so reversal is a parameter, and the Stage 8 test is booked.
- ~~`content/tokens/semantic/shared.json:64` border.control.~~ `72a95e9`. Confirmed 4.29:1 in all four combinations and identical enough that the build hoists it to the root block. Added: the actual tightest gated pair is `text.secondary` on `surface.sunken` in light + Move, 4.76:1 against 4.5.
- ~~`figma-adapter.ts:2`.~~ `87e5efb`, header only. Confirmed 19 uses of the `figma` global in `code.ts`, all shell (`showUI`, `ui.*`, `notify`, `closePlugin`), none touching a variable, collection or node. Replaced with the narrower true claim: the only file that touches document state. **The README layout table half was not touched** — that file belongs to another agent.
- ~~`src/core/index.ts:5`.~~ `87e5efb`, comment only. Confirmed: `build.mjs` uses it as the Node entry point for `dist/core.mjs`; `code.ts` imports the core modules individually and never this barrel.
- ~~`audit/stage-1-v0-audit.md` counts.~~ `12ae314`. Re-derived from `legacy/` rather than trusting the recount, and **the answer disagrees with the audit *and* the reviewer**: 6 code sites (reviewer right) but **24** rendered instances, not 30, and **4 of 6** screens, not 5. Method and arithmetic are in the audit's §2; the 30 could not be reconstructed under any reading tried. `.mv-card` confirmed 8px, unoverridden, live via `RideCard` → `BookingScreen`, four instances on `/move`. §2 also now records what was *not* re-derived (the 35/28 decomposition, the ΔE00 figures, spacing, typography, and §6's 129/48) so their survival does not read as confirmation.

### Still open

- **`machinery/figma-plugin/README.md:5`** — "Figma's REST API can *read* variables on any plan". The exact sentence decision 015 exists to retract, with line 108 of the same file stating the correction. It is the opening factual claim of the file. Left untouched because that file is owned by the agent working the plugin core; it needs whoever holds it next. The README's layout-table copy of the "only file that knows Figma exists" claim is in the same file and needs the same pass — `figma-adapter.ts`'s own header is already corrected in `87e5efb` and can be copied from.

---

## C. PR #1 — `stage-2/preview`

- **The focus ring is invisible on all eight primary controls.** `app.css` draws `:focus-visible` outside the border box with `outline-offset`, and `.mz-seg` has `overflow: hidden`, which clips it. WCAG 2.4.7 failure on the only controls the page has — and `Comparison.tsx` ships the on-screen claim "a visible focus ring" as an improvement over v0. Fix: drop `overflow: hidden` and round the ends with logical corner properties on `:first-child`/`:last-child`.
- **The preview says decision 013 is implemented; 013 says it is not.** Its status is "accepted — decided, not yet implemented" with an explicit implementation-gap callout. Four places state the opposite, one rendered on screen. What the code does is `.mz-script:lang(ar)` switching between two separately-named primitives, which is 013's *rejected* Option 1. This costs five sentences of comment and is the one to insist on.
- **Two `<h1>`s and two backward heading jumps** in the comparison panes.
- **`pairs.json` contains zero occurrences of "hover"**, yet the preview renders text on `action.primary-hover` in three places. It passes today at 8.09:1; it is a coverage hole, and `pairs.json`'s own description says coverage matters as much as strictness.
- **No decision entry for the preview**, and `packages/` appears in neither `CLAUDE.md`'s directory table nor the README's. `packages/preview/src/lib/strings.ts` and `compare/products.ts` are unambiguously Mizan *content* living outside `content/` — the seam needs naming.
- `QuiIMGiew`: `V0Pane.tsx` superimposes an `IMG` label and a `Quick view` overlay with no background, in every mode. It is not in the defect list, so it reads as an accident rather than a demonstration.

---

## D. Needs a person at a Figma desktop — cannot be done in the cloud

- **The read bridge has never completed a round trip against real Figma.** The server accepts only `Origin: null` or absent. Figma's plugin iframe is sandboxed and *should* send `null`, but that is unverified. If it refuses, the run prints `bridge: Refused a connection from Origin ...` naming what Figma actually sent, and the fix is one entry in `LOCAL_ORIGINS` in `machinery/scripts/lib/ws-server.mjs`.
- ~~The proof sheet's `system-ui` binding failure.~~ **Done** in `0c2e699` — it is now a planned skip carrying its reason, visible in the preview rather than in a failure list. `dry-run` 159 → 178. Nothing to do here.

- **The proof sheet's Arabic font specimen is worth one look.** The `font-family.arabic` variable binds the Arabic face to a text node, but if that node's characters are Latin it proves the *binding* while rendering Latin glyphs in an Arabic face — which is the sheet's third job only half done. Unverified; check what `SPECIMEN_NODE` actually sets as `characters` for a `fontFamily` specimen, and whether an Arabic sample would serve better.
