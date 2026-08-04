# machinery/scripts/

Deterministic checks and build scripts. The governance ladder starts here, and most of it never leaves.

**What belongs here:** anything that can be decided by a rule with no judgment attached. Schema validation, token build steps, drift detection between Figma and JSON, lint rules, contrast math, naming-pattern enforcement.

**What does not belong here:** judgment. If answering the question requires knowing whether a design is *good* — hierarchy, density, whether a component is being overused — it is not a script. That belongs to an agent, and the agent's output still gets rejected by something deterministic or by a human.

**Scripts for facts, agents for judgment.** A script that says "this hex is not in the token set" is a fact. A script that says "this layout is confusing" is a script pretending to be a designer.

Also not here: Mizan's values. A script may enforce that no raw hex appears in the semantic layer; it may not contain the list of Mizan hexes it is checking against. Those come from `content/`, passed in.

---

## Contents

| File | Purpose |
|---|---|
| `lib/tokens.mjs` | Shared library: load DTCG documents, resolve `$type` inheritance and aliases, compose modes, and do WCAG colour maths. No CLI. |
| `check-schema.mjs` | Structural gate over a token set. |
| `check-contrast.mjs` | WCAG gate over the declared foreground/background pairs, in every mode combination. |
| `check-drift.mjs` | Governance rung 2: compares a Figma variables snapshot against the token source. |
| `health-dashboard.mjs` | All three gates rendered as one self-contained HTML page. |
| `selftest.mjs` | Runs the gates against the fixture sets and asserts the specific defects that come back. |
| `dtcg-adapt.mjs` | **Temporary.** Degrades DTCG 2025.10 values into what Style Dictionary can read today. Deleted when it can read them itself. |
| `build-tokens.mjs` | The token build: gates, then adapt, then Style Dictionary, for every mode combination. |
| `__fixtures__/` | One valid token set and one deliberately broken one. See its README. |

The gates are Node 22, plain ESM, zero dependencies — Node built-ins only, and that is a constraint worth keeping: a governance gate that cannot run because an install failed is not a gate. The **build** is the one exception: it depends on `style-dictionary`. That is a deliberate line. A gate must run everywhere; a build only has to run where things are built.

## Running them

```
npm run check           # schema, then contrast
npm run check:schema
npm run check:contrast
npm run check:drift -- --snapshot <file>    # rung 2: Figma against the source
npm run health -- --snapshot <file>         # the same three gates, as a page
npm run selftest        # proves the gates reject things
npm run adapt:tokens    # the adapter alone, for inspecting what SD is handed
npm run build:tokens    # gates, then adapt, then build every mode combination
```

Every gate takes `--root <dir>` (defaulting to `$TOKENS_ROOT`, then to the repository's token directory), `--json` for machine-readable output, and `--quiet` to suppress the passing summary. `check-contrast.mjs` additionally takes `--pairs <file>` and a repeatable `--mode <id>`; `check-drift.mjs` takes `--snapshot <file>` or `--file-key <key>`.

An empty token root is reported as such and exits 0. There is nothing to reject, and that is stated in the output rather than implied by a green tick.

## What the scripts assume about a token root

Structure, never values. The layout below is machinery's contract; everything inside the files is content.

```
<root>/primitive/**.json    literal values
<root>/semantic/**.json     named concepts — must reference, never restate
<root>/component/**.json    component concepts — must reference
<root>/modes/*.json         per-mode overrides of existing token paths
<root>/modes.json           optional mode manifest
<root>/pairs.json           declared foreground/background pairings
```

Format is DTCG 2025.10. A token is any object with `$value`; anything else with members is a group. `$type` inherits from the nearest ancestor group **within the same file** — files are separate documents, so a group type declared in one file does not reach tokens in another. Token paths come from the JSON structure alone: neither the filename nor the layer directory appears in a path, so two files may extend the same group and a duplicate path across files is an error.

Colour is an object — `{ "colorSpace": "srgb", "components": [0.25, 0.25, 0.25], "alpha": 1, "hex": "#404040" }`. Components are 0–1 floats and are authoritative. `hex` is advisory: it is computed from the components and a disagreement is an error, not a silent preference for one or the other.

## Mode composition

**Mode names are content.** Nothing here contains one. They are discovered from the token root, two ways:

1. **A manifest at `<root>/modes.json`**, if present, which is authoritative:

   ```json
   { "dimensions": [ { "name": "theme",   "modes": ["light", "dark"] },
                     { "name": "product", "modes": ["one", "two"] } ] }
   ```

   Each entry of `modes` names a file `<root>/modes/<id>.json`. Dimension order in the manifest is the order overrides are applied. A mode file not listed in any dimension is an error — a mode nothing can select is a mode nobody applies.

2. **Otherwise the filenames in `<root>/modes/`.** `theme.light.json` is mode `theme.light` in dimension `theme`; `light.json` with no prefix belongs to the single implicit dimension `mode`. Dimensions are then applied in alphabetical order by dimension name.

The rule, in one line: **a token's effective value is its base value, overridden by each mode in turn, later modes winning; a combination takes exactly one mode from each dimension, so the applicable combinations are the cartesian product of the dimensions.**

Two dimensions of two modes give four combinations, and every one of them is checked. Aliases are resolved *after* the overrides are applied, so a mode may swap a token to a different alias and the chain still resolves. A mode may only override a path that already exists in the base: a token that exists in one mode and nowhere else cannot be represented downstream, so it is rejected at the gate instead of surfacing as an undefined variable later.

`--mode a --mode b` overrides discovery entirely and checks that one combination, applied in the order given.

## check-schema.mjs

Fails the build on:

| Code | Meaning |
|---|---|
| `missing-value` | a leaf that is neither a token (`$value`) nor a group (members) |
| `unresolvable-type` | no `$type` on the token and none on any ancestor group in its file |
| `alias-not-found` | a reference to a token path that does not exist |
| `alias-cycle` | a reference chain that returns to itself |
| `semantic-literal` | a semantic or component token restating a value instead of referencing one |
| `naming-pattern` | a path segment that is not lowercase kebab-case |
| `hex-mismatch` | a declared `hex` that disagrees with its `components` |
| `mode-overrides-unknown-path` | a mode file overriding a path absent from the base |
| `pair-token-missing` | `pairs.json` names a token no file defines |
| `duplicate-token` | the same path declared in two files |
| `color-*` | a colour value that is not a well-formed DTCG colour object |

Warns, without failing, on `unused-primitive`: a primitive no semantic, component or mode token references.

## check-contrast.mjs

Reads `pairs.json` and checks **every declared pair in every applicable mode combination**. Checking base values only would pass a pair that is legible in light and invisible in dark, which is the specific failure this gate exists to catch.

Thresholds come from WCAG, by the context the pair declares:

| Context | Threshold | For |
|---|---|---|
| `text` | 4.5 | body and heading text (1.4.3) |
| `large-text` | 3.0 | text at or above the large-text size (1.4.3) |
| `ui` | 3.0 | non-text boundaries and meaningful graphics (1.4.11) |
| `decorative` | none | a pairing WCAG does not govern |

`decorative` has no threshold — `null`, not a low number. The pair is resolved in every mode combination and its ratio is measured and printed exactly like any other, but it can never fail the build.

It exists because 1.4.11 governs the boundaries that identify *user interface components and their states*, and not everything drawn on a screen is one. Forcing a container hairline through the `ui` gate is a category error with a visible cost; leaving it undeclared to avoid that is worse, because an undeclared pairing is an unchecked pairing and the token stops being visible to this gate at all. `decorative` is the third option: declared, tracked, reported, ungated.

The risk is obvious — it is a category anything inconvenient could be moved into. Two things hold against that. Decorative pairs are printed under `REPORTED, NOT GATED` on a **passing** run, not hidden behind a flag, so the list can be read and counted at any time. And it is a context, not an exception: it makes a claim about what the pairing *is*, which somebody can disagree with in review, rather than a claim that a real requirement should be waived.

A translucent foreground is composited over its background before the ratio is computed. A translucent *background* is an error: what sits behind it is unknown, so the ratio would be a guess.

`exceptions` in the pairs file waive a specific pairing, optionally in specific modes, and every entry requires a `reason`. An exception is printed in the output whether it passes or fails — a silent exception is not an exception, it is a hole, and the point of keeping the list is that it can be read and counted.

Exit 1 on any non-excepted failure. Output names the pair, the mode combination, the computed ratio, the threshold and both resolved hexes, so a CI log is readable without opening a file.

## check-drift.mjs — governance rung 2

Rung 1 checks the token source against itself. This checks **Figma against the
token source**, and it is the gate that makes rule 1 enforceable rather than
merely stated.

**The direction is not negotiable and the output says so.** Figma is a display,
never a source. Every finding carries a `remedy`, and every remedy runs outward
— regenerate the variables from the JSON. There is no code path here that reads
a Figma value into the token source, and there should never be one: that repair
would make the display a source, and the next sync would silently undo it. The
one finding whose fix is not a re-sync is `orphan-in-figma`, and it is not an
exception to the direction — a variable the source never asked for is deleted in
Figma, not imported.

```
node machinery/scripts/check-drift.mjs [--root <dir>] [--snapshot <file>]
                                       [--file-key <key>] [--save-snapshot <file>]
                                       [--json] [--quiet]
```

### Where the display comes from

Two sources, and the offline one is first on purpose.

**`--snapshot <file>`** — a saved Figma variables payload. This is what makes
the detector testable with no credentials, in CI, and in `selftest.mjs`. A gate
that only runs when somebody has a Figma token in their environment is a gate
that does not run.

**`--file-key <key>`** (or `$FIGMA_FILE_KEY`, with `$FIGMA_TOKEN`) — a live read
of `GET /v1/files/<key>/variables/local`. `--save-snapshot <file>` writes what
came back, so a live run becomes tomorrow's offline fixture. Figma's variables
**write** API is Enterprise-gated, which is why `machinery/figma-plugin/` exists;
reading is the half this gate needs. If the read endpoint is unavailable on a
given plan, nothing changes here — the plugin can export the same shape and the
snapshot path takes it.

Neither source given is an error, not a quiet pass. Reporting zero drift because
there was nothing to compare against is the failure mode this gate exists to
prevent.

### The snapshot format

Exactly the endpoint's payload, saved verbatim. Either the whole response or its
`meta` object alone is accepted, so `curl … > snapshot.json` and a plugin export
both work with no massaging.

```json
{ "meta": {
  "variableCollections": {
    "<collectionId>": { "id": "…", "name": "theme",
                        "modes": [ { "modeId": "…", "name": "light" } ],
                        "defaultModeId": "…" } },
  "variables": {
    "<variableId>": { "id": "…", "name": "text/primary",
                      "variableCollectionId": "<collectionId>",
                      "resolvedType": "COLOR" | "FLOAT" | "STRING" | "BOOLEAN",
                      "description": "",
                      "valuesByMode": {
                        "<modeId>": { "r": 1, "g": 1, "b": 1, "a": 1 } } } } } }
```

A value is a literal, or `{ "type": "VARIABLE_ALIAS", "id": "<variableId>" }`.
Unknown keys are ignored, which is what lets the fixtures carry a `_defect` note
beside each planted edit.

Two conventions turn that into something comparable, and both are rules rather
than values:

**Names.** Figma groups on `/`, DTCG paths join on `.`, so the variable
`text/primary` is the token `text.primary`. Nothing else is stripped or
rewritten. This is the exact inverse of the plugin's `figmaName`.

**Modes.** A Figma collection carries modes; a token root carries mode
*dimensions*. A collection whose name and mode names resolve to a known mode id
— `<collection>.<mode>` first, then `<mode>` — is that dimension, and each of its
modes speaks for every combination containing it. A collection with a single mode
is invariant and is compared against every combination. A multi-mode collection
with a mode that resolves to nothing is a mode Figma has and the source does not:
warned about, and its values skipped, because there is no source value to compare
them to.

### What it reports

| Code | Meaning | Fix |
|---|---|---|
| `missing-in-figma` | the source defines it, the file has no variable | re-sync outward |
| `orphan-in-figma` | the file has a variable no token declares | delete it in Figma |
| `value-mismatch` | the variable holds a different value, in some mode | re-sync outward |
| `alias-flattened` | the token references, the variable holds a raw value | re-sync outward |
| `alias-unexpected` | the token states a literal, the variable references | re-sync outward |
| `alias-target-mismatch` | both reference, at different targets | re-sync outward |
| `type-mismatch` | the resolved type is not what the token's `$type` projects to | delete and re-sync |
| `description-drift` | the description was edited in the file | re-sync outward |

Warns, without failing, on `figma-mode-unknown`. Lists, without failing, the
tokens with no Figma variable form at all — Figma variables hold colour, number,
string and boolean, so a `shadow` missing from the file is a fact about Figma
rather than a disagreement.

**`alias-flattened` is the one that matters.** Its Figma value is usually
*correct*: somebody replaced `{color.neutral.100}` with the colour that alias
resolves to, and nothing looks wrong. A detector that compared values alone would
call it aligned. But the chain is the thing being protected — a flattened
variable stops moving when its primitive moves, and the file drifts silently from
that day forward. It is checked structurally, before any value comparison, and
the selftest asserts specifically that the flattened value matched and the
finding was raised anyway.

Every disagreement is reported **per mode**, because a variable can be correct in
light and hand-edited in dark — the same reason `check-contrast.mjs` runs across
combinations rather than against base values. Where a token says the same thing
in every combination, that is collapsed to one finding rather than repeated four
times.

### Kept in step with the sync plugin

`machinery/figma-plugin/` writes the variables; this reads them back and asks
whether they are still what was written. The two therefore have to agree on the
same projection — the type table, the `px`-only dimension rule, the first-family
narrowing of a font stack, the `[deprecated: …]` description prefix, and the 1e-6
comparison tolerance are all mirrored from `src/core/map.ts` and `src/core/plan.ts`.

A detector more lenient than the syncer calls a file aligned that the syncer
would still rewrite. A detector stricter than the syncer reports drift nobody can
fix. They are mirrored by hand, and deliberately so: the plugin's core is
TypeScript that needs a build, and **a gate that needs a build step is not a
gate**. If `map.ts` changes, `check-drift.mjs` changes with it.

## health-dashboard.mjs — governance you can screenshot

```
node machinery/scripts/health-dashboard.mjs [--root <dir>] [--snapshot <file>]
                                            [--file-key <key>] [--out <file>]
                                            [--title <str>] [--strict] [--quiet]
```

One self-contained HTML file — inline CSS, no dependencies, no network, nothing
fetched from anywhere. It runs the three gates as separate processes with
`--json`, exactly as `selftest.mjs` runs them, and renders what came back. It
**never re-implements a check**, so the page cannot claim anything the gates did
not report.

It shows the verdict, the three gate cards, the aligned/drifted/missing/orphaned
counts, each drift class with source and Figma side by side and the fix beneath,
every token in the set with its variable and status — aligned rows included,
because a detector is only worth reading if you can see what it looked at — and
then the contrast and schema results from rung 1.

The direction is the loudest thing on it. There is one arrow, it points outward,
and the page says in as many words that there is no arrow back.

`--out` defaults to `.tokens-build/health.html`, which is gitignored: the page is
build output, regenerated from the gates every time. `--title` has only a generic
default, because a name is a brand decision — the root `npm run health` supplies
this repository's.

`--strict` adopts the gates' verdict as the exit code, for CI. Without it the
script exits 0 whenever the page was written, because generating the report
succeeded even when the news in it is bad, and the gates already own the build's
exit code.

**The page is styled by the system it reports on.** Its palette is not hardcoded
and does not read the generated CSS: the roles are chosen from `pairs.json` —
the ground the most pairings are declared against, the highest-contrast *neutral*
foreground on it, a line from a non-text context, the most saturated other
background as the accent — and then resolved through `lib/tokens.mjs` in every
mode combination, which is also where the page's own mode switcher comes from.
Nothing in the file names a token. Change a colour in the source and the next
dashboard is that colour; the only colours belonging to the report itself are the
pass and drift hues, because "this has drifted" is a claim the report makes
rather than a decision the design system took.

## selftest.mjs

Runs both gates against both fixture sets and asserts the valid set passes with no errors and no warnings, and that the broken set fails **with each expected error code**, including a contrast failure that appears in one mode and not the other.

`decorative` is asserted the only way that means anything: the valid fixture declares a decorative pair sitting at about **1.14:1** in light — below every WCAG threshold, including the 3.0 a `ui` declaration would impose — and the assertions are that its threshold is `null`, that it is resolved in all four combinations, that each result carries a measured ratio, that it appears by name in the passing run's output, and that the gate still exits 0. A threshold that was merely lenient would pass an exit-code check; only the ratio and the printed line prove there is no bar at all.

**Rung 2 is held to the same standard.** Both drift fixtures are snapshots of the *same* correct token set: `figma/aligned.json`, which must report zero drift, zero errors and zero warnings with all eighteen tokens compared in all four combinations; and `figma/drifted.json`, which must report **each of the eight drift codes by name**. `alias-flattened` is asserted three ways, because its exit code alone would prove nothing: that the flattened Figma value *equals* what the alias resolves to — so a value-only comparison would have called it aligned — that it is caught in the one Figma mode it was planted in, and that the untouched mode of the same variable reports nothing. The remedies are asserted too: no finding may tell anybody to take a Figma value back into the source.

The dashboard is asserted on the same terms. It writes a complete document, nothing in it is fetched from anywhere, every drift class appears on the page by its label, both sides of a value mismatch appear, its palette is the one resolved from the fixture's tokens rather than a hardcoded default, and `--strict` returns 1 on the drifted snapshot and 0 on the aligned one.

A gate that has never rejected anything is an untested claim, and a gate asserted only on its exit code can pass for the wrong reason. `npm run selftest` is what makes the claim checkable.

## dtcg-adapt.mjs — the file designed to be deleted

DTCG 2025.10 is stable and specifies structured values: a colour is `{ colorSpace, components }`, a dimension is `{ value, unit }`, a shadow is an object whose members are themselves colours and dimensions. Style Dictionary 5.5 does not read those — its own documentation calls 2025.10 support a work in progress.

That left two options. Author the tokens in whatever Style Dictionary accepts this quarter, and let a tool's current limitations become the shape of the source of truth. Or author to the spec and put the whole gap in one file that gets deleted.

This is that file. It degrades 2025.10 values into the string forms Style Dictionary reads today — colour objects to hex, dimension objects to `"16px"`, and the same recursively through every composite type. Detection is by **shape, not by `$type`**: a shadow's members carry no type of their own, and neither do a border's or a typography token's, so walking on shape handles composite types this repository does not use yet without enumerating them.

It does **not** resolve aliases. Alias strings pass straight through, so Style Dictionary emits `var(--…)` and the generated CSS keeps the reference structure the source declares. `resolveTokens` still runs, as a gate rather than a step: a chain that cannot resolve fails here instead of becoming an undefined custom property downstream.

Tracking issue: <https://github.com/style-dictionary/style-dictionary/issues/1590>. The file's own header lists the four steps to delete it, including the one that matters — rebuild and diff `packages/tokens/`, and if the output is not byte-identical then the file was doing more than value-shape translation and that something needs a home before the file goes.

```
node machinery/scripts/dtcg-adapt.mjs [--root <dir>] [--out <dir>] [--mode <id>]... [--quiet]
```

Writes one adapted document per mode combination plus a manifest to `--out` (default `.tokens-build/`, gitignored). `--mode` restricts to a single combination, repeatable and ordered, exactly as `check-contrast.mjs` takes it.

## build-tokens.mjs

```
node machinery/scripts/build-tokens.mjs [--root <dir>] [--out <dir>] [--work <dir>]
                                        [--prefix <str>] [--no-check] [--quiet]
```

Three steps, in this order and no other:

1. **Gate.** Runs `check-schema.mjs` then `check-contrast.mjs` against the same root and refuses to continue if either fails, passing their output through unchanged. The gates run *before* the build rather than beside it, because generated output that has not been checked looks exactly like generated output that has. `--no-check` exists for debugging the build itself and has no business in CI.
2. **Adapt.** Calls `dtcg-adapt.mjs` in-process, writing the intermediate to `--work`.
3. **Build.** One Style Dictionary instance per mode combination, formatted in memory and written to `--out` (default `packages/tokens/`).

Every generated file carries a header naming its source, its generator and its mode combination.

### Outputs

**CSS — one file, one block per combination.** `:root` holds every value that is identical in all combinations; each combination then gets `:root[data-<dimension>="<mode>"]…` containing only the values that differ. The attribute names are the mode dimension names discovered in the token root, so a third dimension appears as a third attribute with nothing here changing.

One file rather than one per combination, for two reasons. A preview app toggling an attribute at runtime needs every combination present at once — swapping a stylesheet would mean a network round-trip and a flash. And the invariant/varying split is computed from the adapted values themselves, so what lands in each block is the composition `lib/tokens.mjs` actually performed, not the CSS cascade re-deriving it and possibly disagreeing with the gates.

**iOS and Android** are proof that the pipeline is multi-platform, not a mobile deliverable. They carry colour and dimension only — the two types that map onto both resource models without inventing a convention. Whether a dimension is `dp` or `sp` depends on whether the token is spacing or type, which is knowledge about the token rather than its shape, and it belongs in the source as a `$extensions` hint rather than in a name-matching special case here.

`--prefix` prefixes every generated name. It defaults to nothing and has no default value in this file, because a prefix is a brand decision.
