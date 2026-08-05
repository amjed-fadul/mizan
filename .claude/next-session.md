# Briefing — carried forward

Written 2026-08-05, replacing the Stage 3 review briefing of 2026-08-04. That list is done, and two of its items were found already closed rather than assumed open: `machinery/figma-plugin/README.md:5` now states the retraction [015](../decisions/015-rung-2-has-a-plan-floor.md) exists for and cites it, and the `pairs.json` hover coverage hole is closed — `text.on-action` on `action.primary-hover` is declared as text. The preview's missing decision entry became [018](../decisions/018-the-preview-reads-the-build-output.md), and `packages/` is in `CLAUDE.md`'s directory table.

Read `CLAUDE.md` first. Never lower a threshold to make something pass. Never tidy `legacy/`.

Gate baseline on `main`: `check:schema` 36 warnings · `check:contrast` 70 / 4 / 6 (0 palette, 2 composite) · `check:tap-target` 12 footprints · `check:contracts` 7 agreeing · `selftest` 224 · `figma:dry-run` ok · `tsc` clean · Storybook 66 entries.

---

## The one thing that needs a human at a keyboard

**The read bridge has never completed a round trip against real Figma.** Everything else about it is proven — `selftest` covers the port agreement, the read-only vocabulary and an end-to-end read over a real socket — but against a stand-in, not against Figma.

The server accepts only `Origin: null` or absent. Figma's plugin iframe is sandboxed and *should* send `null`; that is unverified. If it refuses, the run prints `bridge: Refused a connection from Origin …` naming what Figma actually sent, and the fix is one entry in `LOCAL_ORIGINS` in `machinery/scripts/lib/ws-server.mjs`.

Needs somebody at a Figma desktop with the plugin imported. Not doable from CI, not doable by an agent.

**While you are there:** the proof sheet's Arabic specimen. `font-family.arabic` binds the Arabic face to a text node, and if that node's characters are Latin it proves the *binding* while rendering Latin glyphs in an Arabic face. `typography-arabic.json` now carries a `figma-token-sync.specimen` extension with an Arabic pangram for exactly this; worth one look that it is what the sheet actually draws.

---

## Owed, with the entry that owes it

None of these blocks anything. Listed so they are found on purpose rather than rediscovered.

- **A lint rule that does not exist yet**, now owed by three decisions: neither card may reference the other's tokens ([024](../decisions/024-productcard-and-ridecard-stay-separate.md)), nothing may be drawn on the scrim ([025](../decisions/025-the-scrim-is-one-value-and-carries-no-pairing.md)), and nothing may draw ink from the spacing scale ([026](../decisions/026-the-stroke-scale.md)). Three entries pointing at one absent file is the signal that `mizan-lint` became load-bearing before Stage 6 got to it.
- **The optical Arabic size correction** is one `calc()` in `Button.css` and reaches no other component. A multiplier cannot be a mode value; [027](../decisions/027-script-is-an-overlay-not-a-dimension.md) states the two ways out and rejects both for now. `font-size.arabic-scale` is the one Arabic primitive `check:schema` still reports unused — the gate naming the gap correctly.
- **`check:drift` reports `no-source` without a Figma snapshot**, and four token decisions in a row (021, 022, 023, 026) end by saying their variables read as missing until somebody syncs. Four is the count at which "sync after landing a token" stops being a footnote and becomes a question about whether it belongs *in* the landing.
- **The a11y addon and the play functions never run in CI.** `gates.yml` does not execute stories, so the accessibility guarantee holds when a human opens Storybook and not otherwise. `@storybook/test-runner` in `gates.yml` is roughly a session, and it is the cheapest real increase in what this repo can claim.
- **Two implementations of mode discovery** — `machinery/scripts/lib/tokens.mjs` and `machinery/figma-plugin/src/core/token-model.ts` — now disagree on strictness: the plugin validates an overlay's `mode` but not its `name` or `selector`, so a malformed manifest passes `figma:dry-run` and fails `build:tokens`. `projection.mjs` exists precisely because a rule stated twice can disagree silently. Recorded in [027](../decisions/027-script-is-an-overlay-not-a-dimension.md), not fixed.
- **The Figma library has the Arabic values but not the mapping.** Overlays are not projected — Figma resolves a variable per document and has no subtree — so a designer picking `line-height/normal` gets the Latin value. The primitives are all in the file; what is missing is that `:lang(ar)` re-points them. Deciding the script collection is its own entry.
- **`RideCard.stories.tsx`'s Arabic story uses Arabic-Indic digits** — `٣ دقائق`, `٤ مقاعد` — against [012](../decisions/012-western-numerals-and-what-follows.md) and `content/rules/rtl-arabic.md` §4, which settled Western digits in both locales. Found while reviewing the Stage 4 specs, out of scope for that change.
- **The `unused-primitive` list is 36 long and read by nobody.** Not hypothetical: a real defect hid in it for weeks and surfaced only because [026](../decisions/026-the-stroke-scale.md) happened to write a trigger for exactly that. The gate cannot see that CSS consumes dimension primitives directly; teaching it that would leave a list where every entry means something.

---

## Where Stage 4 ended, and what Stage 5 should know

Seven components with full specs and contracts, a deployed Storybook, and decisions 020–027 as the record. The closeout ran as four sessions — the stroke scale, the two owed rules, the API specs, the Arabic overlay — plus a pass applying what four adversarial reviews found.

**The thing to carry into Stage 5:** the Prototyping Kit packages `machinery/metadata/` and `content/rules/` *as the agent's knowledge*, so their accuracy is the Kit's accuracy. A review found five authored contracts still telling a reader there was no border-width scale long after there was one, and `check:contracts` could not catch it because it compares props and tokens, not prose. That class of staleness is invisible today and becomes a wrong answer from an agent tomorrow. Whatever else Stage 5 does first, it is worth knowing that the knowledge base has already been wrong once in exactly the way that matters.
