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
| `selftest.mjs` | Runs both gates against both fixture sets and asserts the specific defects that come back. |
| `dtcg-adapt.mjs` | **Temporary.** Degrades DTCG 2025.10 values into what Style Dictionary can read today. Deleted when it can read them itself. |
| `build-tokens.mjs` | The token build: gates, then adapt, then Style Dictionary, for every mode combination. |
| `__fixtures__/` | One valid token set and one deliberately broken one. See its README. |

The gates are Node 22, plain ESM, zero dependencies — Node built-ins only, and that is a constraint worth keeping: a governance gate that cannot run because an install failed is not a gate. The **build** is the one exception: it depends on `style-dictionary`. That is a deliberate line. A gate must run everywhere; a build only has to run where things are built.

## Running them

```
npm run check           # schema, then contrast
npm run check:schema
npm run check:contrast
npm run selftest        # proves the gates reject things
npm run adapt:tokens    # the adapter alone, for inspecting what SD is handed
npm run build:tokens    # gates, then adapt, then build every mode combination
```

Both checks take `--root <dir>` (defaulting to `$TOKENS_ROOT`, then to the repository's token directory), `--json` for machine-readable output, and `--quiet` to suppress the passing summary. `check-contrast.mjs` additionally takes `--pairs <file>` and a repeatable `--mode <id>`.

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

## selftest.mjs

Runs both gates against both fixture sets and asserts the valid set passes with no errors and no warnings, and that the broken set fails **with each expected error code**, including a contrast failure that appears in one mode and not the other.

`decorative` is asserted the only way that means anything: the valid fixture declares a decorative pair sitting at about **1.14:1** in light — below every WCAG threshold, including the 3.0 a `ui` declaration would impose — and the assertions are that its threshold is `null`, that it is resolved in all four combinations, that each result carries a measured ratio, that it appears by name in the passing run's output, and that the gate still exits 0. A threshold that was merely lenient would pass an exit-code check; only the ratio and the printed line prove there is no bar at all.

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
