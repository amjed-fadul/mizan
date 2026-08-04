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
| `__fixtures__/` | One valid token set and one deliberately broken one. See its README. |

Node 22, plain ESM, zero dependencies. Node built-ins only, and that is a constraint worth keeping: a governance gate that cannot run because an install failed is not a gate.

## Running them

```
npm run check           # schema, then contrast
npm run check:schema
npm run check:contrast
npm run selftest        # proves the gates reject things
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

Thresholds come from WCAG, by the context the pair declares: `text` 4.5, `large-text` 3.0, `ui` 3.0 for non-text boundaries and graphics.

A translucent foreground is composited over its background before the ratio is computed. A translucent *background* is an error: what sits behind it is unknown, so the ratio would be a guess.

`exceptions` in the pairs file waive a specific pairing, optionally in specific modes, and every entry requires a `reason`. An exception is printed in the output whether it passes or fails — a silent exception is not an exception, it is a hole, and the point of keeping the list is that it can be read and counted.

Exit 1 on any non-excepted failure. Output names the pair, the mode combination, the computed ratio, the threshold and both resolved hexes, so a CI log is readable without opening a file.

## selftest.mjs

Runs both gates against both fixture sets and asserts the valid set passes with no errors and no warnings, and that the broken set fails **with each expected error code**, including a contrast failure that appears in one mode and not the other.

A gate that has never rejected anything is an untested claim, and a gate asserted only on its exit code can pass for the wrong reason. `npm run selftest` is what makes the claim checkable.
