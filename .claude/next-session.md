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

## B. Claims the repository has already retracted and never propagated

This project's product is the honesty of its prose. Each of these is contradicted by the repo's own later work.

- **`decisions/008` contradicts itself.** Line 103 says `action.primary` "is now one value across both products"; line 50 of the same file says it "still resolves per product mode — green in Market, blue in Move". The code agrees with line 50. Commit `5564f27` fixed the Why section and left Consequences alone. **`content/tokens/pairs.json:32` repeats the wrong version** — and that is a shipped `$description` the plugin carries verbatim into Figma, where designers hover it.
- **`decisions/008:101`** — "33 values become 14 / no primitive exists without a consumer". `primitive/color.json` holds **23** colour primitives, and `check:schema` emits 40 `unused-primitive` warnings, one of them a colour (`neutral.200`). The input figure 33 is correct.
- **`machinery/figma-plugin/README.md:5`** — "Figma's REST API can *read* variables on any plan". This is the exact sentence decision 015 exists to retract, and line 108 of the same file states the correction. It is the opening factual claim of the file.
- **The ten-mode-ceiling claim** is retracted in decisions 013 and 014 but still live in `content/rules/rtl-arabic.md:97` and `mizan-roadmap-v1.md:207`. `decisions/013:72` contradicts its own correction nine lines above.
- **`machinery/scripts/health-dashboard.mjs:686`** ships "Reading Figma live needs the variables REST API, which is Enterprise-only" onto every generated page. Decision 016 and the bridge falsify it. The dashboard also has no `--bridge` source.
- **`README.md:34`** still says "Stage 0: repository skeleton", and the repository map lists neither `packages/` nor `machinery/figma-plugin/`.
- **`mizan-roadmap-v1.md:223`** lists what Stage 3 produced and omits the proof sheet and the read bridge — about 2,600 lines and two of the three most interesting artifacts.
- **`brief/mizan-labs.md:30`** lists Arabic-Indic numerals as a core requirement; decision 012 refused them. Reframe as the refusal rather than deleting it — refusals are this log's best material.
- **`content/tokens/semantic/shared.json:64`** describes `border.control` as "the tightest gated pair, 3.03:1"; both theme files override it to `{neutral.600}`, so it is 4.29:1 in both. Another shipped `$description`.
- **`figma-adapter.ts:2`** and the README layout table call it "the only file that knows Figma exists"; `src/code.ts` uses the `figma` global 19 times. The substance holds — `src/core/**` is genuinely pure — but the sentence is the load-bearing architecture claim.
- **`src/core/index.ts:5`** says the plugin sandbox imports it. Nothing does. That is *better* than described — `index.ts` re-exports the in-memory test adapters, which would otherwise ship in the bundle.

`audit/stage-1-v0-audit.md` has a cluster of counts that do not reproduce (line 85 is flatly false — `.mv-card`'s 8px radius is not overridden and the component *is* imported; line 178's "8 code sites" recounts to 6). Re-derive them rather than trusting the recount.

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
