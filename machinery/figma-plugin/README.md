# machinery/figma-plugin/ — Mizan Sync

A Figma plugin that generates variables from a DTCG token root.

Figma's REST API can *read* variables on any plan but can only *write* them on Enterprise. A plugin can write them on any plan. That asymmetry is the entire reason this exists: it is how the token JSON reaches Figma without an Enterprise seat and without anybody retyping a hex.

**The direction is one way, always outward.**

```
content/tokens/  ──►  Figma variables
```

Never the other way. This plugin does not read Figma variables and write them back into the token source, and it never will — that is rule 1 of the system, not a feature that has not been built yet. If a value is wrong in Figma, it is wrong in the JSON; fix it there and sync again. **The Figma file is a display, not a source.**

Like everything in `machinery/`, this is brand-agnostic. It contains no colour, no product name and no mode name. Collection names, mode names, variable names, values and descriptions all come from the token root it is pointed at. Point it at somebody else's tokens and it works on those.

---

## Loading it in Figma

The plugin runs from your own machine — it is not published, and it does not need to be.

```
cd machinery/figma-plugin
npm install       # @figma/plugin-typings, esbuild, typescript — all dev-only
npm run build     # produces code.js
```

Then, in the **Figma desktop app** (browser Figma cannot load local plugins):

1. Open any Figma design file.
2. Menu → **Plugins → Development → Import plugin from manifest…**
3. Choose `machinery/figma-plugin/manifest.json`.

It now appears under **Plugins → Development → Mizan Sync**. Re-run `npm run build` after any source change and re-run the plugin; there is no watch mode inside Figma, but `node build.mjs --watch` will keep `code.js` fresh.

## Running a sync

The plugin cannot read your filesystem — no plugin can. The tokens have to be handed to it, three ways, all producing the same thing:

| Route | When |
|---|---|
| **Choose token folder…** | Normal use. Pick `content/tokens/`. The picker reads every `.json` under it. |
| **Choose bundle file…** | You generated a bundle: `node bundle.mjs --out /tmp/tokens.json` |
| **Paste JSON** | Quick checks, or a token root that is not on this machine. `node bundle.mjs \| pbcopy` |

Then:

1. **Preview changes.** The plugin reads the file's current variables, computes a diff and shows it. Nothing has been written.
2. Read the diff. It lists every collection, every variable it will create, every value it will change with its before and after, everything it is *not* projecting and why, and every orphan.
3. **Apply…** → **Write to this file**. Two clicks, deliberately.

Before writing, it re-plans against the live document and refuses if the diff has moved since your preview — if somebody edited a variable in the meantime, the diff you approved is not the diff that would be written, and you get shown the new one instead.

After writing, it re-plans once more and reports what is left. On a healthy sync that number is zero, which is what idempotent means: running it twice changes nothing the second time.

---

## The mapping

### The problem it has to solve

Figma variable modes are **per collection**. A variable lives in exactly one collection and holds one value per mode of that collection. The token layer has more than one dimension — theme and product today, script decided but not yet implemented ([013](../../decisions/013-script-is-a-mode-not-a-parallel-scale.md)) — and a variable that depends on **two** dimensions cannot be expressed by two independent collections, because neither collection can see which mode of the other is active.

That is the same wall the token layer hit, and the token layer already went over it ([007, Amendment](../../decisions/007-modes-for-shared-namespaces-for-unique.md#amendment--the-cost-this-decision-did-not-anticipate); the long `$note` in `content/tokens/modes.json`). A token depending on N dimensions is expressed as one **selector** token plus one **slot** per mode of the last-applied dimension, with the earlier dimensions setting the slots.

**So this plugin invents nothing.** It mirrors that solution rather than adding a second one, because the Figma structure being a faithful projection of the token structure is exactly what will make the Stage 3 drift detector meaningful. Two structures that disagree by design cannot be compared.

### The rule

```
one collection per mode dimension          theme, product, (script)
one collection per invariant token layer   primitive, semantic, component

a token overridden by dimension D    →  a variable in collection D,
                                        one value per mode of D
a token overridden by nothing        →  a variable in its layer's collection,
                                        which has a single mode, "Default"
a token overridden by two dimensions →  an ERROR that names the slot convention
```

A variable's collection is decided by **what it varies by**, not by where its JSON lives.

Mode names drop the dimension prefix the collection already carries: `theme.dark` in dimension `theme` becomes the mode `dark`. Token paths become Figma names with `/` for `.`, because Figma groups on `/` and rejects `.` — `text.secondary-market` becomes `text/secondary-market`.

### What it looks like on Mizan's tokens today

```
primitive   59 variables   modes: Default
theme       12 variables   modes: light, dark
product      3 variables   modes: market, move
```

And the two-dimension case, resolved through Figma's own alias support:

```
product/text/secondary   [market]  →  theme/text/secondary-market  [light] → primitive/neutral/700
                                                                   [dark]  → primitive/neutral/400
                         [move]    →  theme/text/secondary-move    [light] → primitive/neutral/650
                                                                   [dark]  → primitive/neutral/500
```

Set `theme = dark` and `product = market` on a frame and Figma resolves the chain across both collections. **A designer must set a mode for every collection they consume** — on the page, or on a top-level frame. A frame with no explicit mode uses each collection's default, which is its first mode.

The alias chain is the point, not a convenience. A semantic variable *references* its primitive instead of restating the value, so editing a primitive moves everything downstream of it, in Figma exactly as in the JSON.

### A third dimension costs no code

Dimensions are read from the token root's `modes.json`. Adding

```json
{ "name": "script", "modes": ["script.latin", "script.arabic"] }
```

with its two mode files produces a third collection with two modes and moves the tokens that script overrides into it. Nothing in `src/` names a dimension, a mode, or a layer. `__fixtures__/three-dimensions/` is a token root with exactly that shape, and `dry-run.mjs` asserts it projects and applies cleanly — the claim is tested, not just stated.

**One consequence to know before that day.** A token that gains a dimension changes collection, and Figma cannot move a variable between collections. The plugin creates the new variable in the new collection and **reports the old one as an orphan** with a note saying where it went. Deleting the old one is your call, in Figma, by hand.

**One assumption this projection retires.** [007](../../decisions/007-modes-for-shared-namespaces-for-unique.md) and [013](../../decisions/013-script-is-a-mode-not-a-parallel-scale.md) both treat Figma's mode ceiling as a live constraint, counting one mode per *combination*: four today, eight once script lands. Per-dimension collections do not count that way. Each collection needs one mode per mode of its own dimension — two, two and two — never the cartesian product. The ceiling binds a dimension with many modes, not a system with many dimensions.

---

## Types

| DTCG `$type` | Figma | Notes |
|---|---|---|
| `color` | `COLOR` | Components are 0–1 floats in DTCG and 0–1 floats in Figma. Nothing is converted; `alpha` becomes `a`. Only `srgb` is projected. |
| `dimension` | `FLOAT` | `px` only. Figma's FLOAT is unitless and its canvas unit is the pixel. |
| `number` | `FLOAT` | Line heights, multipliers. |
| `fontWeight` | `FLOAT` or `STRING` | Numeric weights become FLOAT; keyword weights become STRING. |
| `fontFamily` | `STRING` | A stack narrows to its first family — the one Figma can resolve to a font. The fallbacks are named in a warning. `machinery/scripts/check-drift.mjs` compares against the same first family; the convention has to move in both files or not at all. |
| `duration` | `FLOAT` | Milliseconds. |
| `boolean` | `BOOLEAN` | |
| `shadow`, `typography`, `border`, `transition`, `gradient`, `cubicBezier` | — | **Not projected.** Figma has no composite variable; these are styles, not variables. Each one is listed in the diff with that reason. |
| `dimension` in `rem` | — | **Not projected.** Converting needs a root font size, which is a fact about a document rather than about the token. Refused rather than assumed. |

`$description` is carried into the Figma variable description verbatim, so the reasoning travels with the value — a designer hovering a variable reads the same sentence a developer reads in the JSON. `$deprecated` is prefixed to it.

---

## What it will not do

- **It will not delete anything.** There is no delete operation in its vocabulary at all — not for variables, not for modes, not for ones it created itself. A variable with no counterpart in the source is reported as an **orphan**, with a note, and left exactly where it is. Removing it is a human decision made in Figma.
- **It will not touch collections it does not manage.** A collection whose name matches no dimension and no layer is listed under "left alone" and is not even scanned for orphans. It is not this plugin's business.
- **It will not rename a mode that has values in it.** The one rename it performs is Figma's placeholder mode on a collection somebody created by hand and left empty. Renaming a mode with values would silently re-point everything bound to it.
- **It will not change a variable's type.** Figma fixes a resolved type at creation. If the token's type no longer matches, that is an error telling you to delete the variable or rename the token — never a silent recreate.
- **It will not write a partial projection.** Any error blocks the whole run. Half a projection is drift, and drift that the tool itself introduced is the worst kind.
- **It does not set scopes, code syntax, or publishing visibility.** Those are decisions about a Figma library, and the plugin has no opinion it could honestly base on the token JSON. They survive a re-sync untouched.
- **It does not touch styles, components, or any node on the canvas.** Variables only.
- **It does not use the network.** `manifest.json` declares `"allowedDomains": ["none"]`.

---

## Proving it without Figma

A Figma plugin cannot run in CI. If the only way to find out what this does is to load it in the desktop app and look, then every claim above is untestable.

So the whole transformation — load, classify, assign collections, map values, diff, apply — is pure: plain data in, plain data out, no Figma and no Node. The plugin sandbox drives it and so does the command line.

```
npm run dry-run          # builds, then runs the harness
node dry-run.mjs --verbose
node dry-run.mjs --root path/to/other/tokens
```

It runs against the **real** `content/tokens/` plus two fixtures, with an in-memory model in place of the Figma API that enforces the constraints the real one enforces — one placeholder mode on a new collection, unique names, fixed resolved types, aliases that must exist and must match type. It asserts, among others:

1. The plugin's fs-free loader agrees with `machinery/scripts/lib/tokens.mjs` token for token on the real root. The port cannot drift without this failing.
2. Every token is accounted for — projected, or skipped with a reason, or an error. Nothing vanishes.
3. Each token lands in the collection its dimensions say it should.
4. Colour components reach Figma unchanged; DTCG types land on the right Figma types; `$description` arrives verbatim.
5. A semantic aliases its primitive, and at least one alias crosses a collection boundary — the mechanism the two-dimension case rests on.
6. Apply, then re-plan: nothing left to do. Idempotent.
7. A token deleted from the source is reported as an orphan and nothing is written to remove it.
8. Three dimensions project and apply with no code change.
9. A token varying by two dimensions is refused, and the message names the fix.
10. Collections the plugin did not plan are untouched.

`npm run typecheck` runs `tsc --noEmit` over the same sources.

### Against the drift detector

The other half of the claim is that what this plugin writes is what `machinery/scripts/check-drift.mjs` expects to find. That was checked end to end: the plan for the real token root was applied to the in-memory model, its state exported in the shape of Figma's `GET /v1/files/<key>/variables/local` response, and the drift detector pointed at it.

```
74 token(s) aligned across 296 comparison(s), 0 drifted, 0 missing, 0 orphaned
```

The two files were written independently and agree on all four conventions that matter — `/` for `.` in names, `<collection>.<mode>` for mode ids, a single-mode collection meaning invariant, and which DTCG types have no variable form. They also have to agree on one thing that is a *convention* rather than a fact: a `fontFamily` stack narrows to its first family on both sides. That one is worth a Decision Log entry, because nothing enforces it and a change on one side alone produces drift no sync can ever clear.

---

## Layout

| File | |
|---|---|
| `manifest.json` | Figma plugin manifest. `documentAccess: dynamic-page`, no network. |
| `src/core/` | The pure core. No Figma, no Node — this is what the dry run drives. |
| `src/core/token-model.ts` | The fs-free port of `machinery/scripts/lib/tokens.mjs`: flatten, `$type` inheritance, mode discovery, composition. |
| `src/core/map.ts` | DTCG values to Figma values, and every refusal to translate one. |
| `src/core/plan.ts` | The projection and the diff. The architecture argument lives in its header. |
| `src/core/apply.ts` | Writing a plan, through an adapter. The only apply path there is. |
| `src/core/memory-adapter.ts` | Figma's variable model in memory, for the dry run. |
| `src/figma-adapter.ts` | The only file that knows Figma exists. |
| `src/code.ts` | The plugin main thread: message plumbing and the confirmation gate. |
| `ui.html` | The source picker and the diff. Plain HTML, CSS and JS. |
| `build.mjs` | esbuild → `code.js` for Figma, `dist/core.mjs` for Node. |
| `bundle.mjs` | A token root flattened into one JSON file. Also importable. |
| `dry-run.mjs` | The harness. |
| `__fixtures__/` | Two token roots that make the claims above testable. |

`code.js` is generated. Edit `src/`, never it.
