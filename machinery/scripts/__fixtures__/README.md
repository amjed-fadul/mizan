# scripts/__fixtures__/

Two token sets that exist only to prove the gates work.

- `valid/` — a small, correct token set. Both checks must pass against it. One
  pair in it is deliberately near-invisible (`border.subtle` on
  `surface.default`, about 1.14:1 in light) and declared `decorative`: the set
  is still correct, because that context carries no threshold. It is there so
  the selftest can prove *no bar* rather than *a low bar*.
- `broken/` — a deliberately wrong token set carrying one instance of every
  defect class the gates claim to catch. Both checks must fail against it, and
  `selftest.mjs` asserts *which* errors come back, not merely that some did.

`valid/` also carries one `fontFamily` token declared as a **stack**
(`font-family.sans`) and a semantic aliasing it. That is not decoration: a stack
is the one value the sync throws information away to project — Figma holds one
string — so it is the one rule the syncer and the detector share as code rather
than mirror as a comment. The token is here so both ends can be held to the same
answer. See `../README.md`, "Kept in step with the sync plugin".

These fixtures are machinery, so they carry no brand: the names are generic
(`color.neutral`, `surface.default`, `theme.light`, `Fixture Sans`) and the values
are chosen for the arithmetic they produce, not for how they look.

`valid/` also discovers its modes by the filename convention
(`theme.light.json`), while `broken/` uses a `modes.json` manifest — between
them both discovery paths are exercised.

Do not fix `broken/`. Its defects are the test.

## `pairs/` — declarations, not values

Two alternative pairs files for `check-contrast.mjs`, both pointed at `valid/`
with `--pairs`. They live outside both token roots on purpose: every `.json`
under a subdirectory of a root is loaded as a token document, so a pairs fixture
filed inside one would be read back as tokens.

Nothing in either is about arithmetic — every pairing they name is one of
`valid/pairs.json`'s, and the ratios are the ones already asserted elsewhere.
What they exercise is the *declaration*: which combinations a pairing is checked
in, and what happens when the answer is none.

- `mode-scopes.json` — four pairings, four different `"modes"` scopes, all
  passing. The assertions are counts (4, 2, 1, 4) rather than an exit code,
  because with everything passing an exit code says nothing about what was
  looked at.
- `unknown-mode.json` — a mode id misspelt on a pair and another on an
  exception. Do not correct the spellings; they are the test.

## `figma/` — the display side

Four Figma variable snapshots of the **same** `valid/` token set, for
`check-drift.mjs`. Rung 1 checks the source against itself, so its fixtures are
two token sets; rung 2 checks the display against the source, so its fixtures
are several displays of one correct source.

- `aligned.json` — what the sync plugin would have written. Zero drift, no
  warnings, and every token in the table reads `aligned`. This is the fixture
  that proves the detector does not cry wolf, which matters exactly as much as
  the other one.
- `drifted.json` — the same file after somebody has been in it by hand, carrying
  one instance of every drift class a hand-edit can produce. Each planted edit
  carries a `_defect` key saying what it is and why it matters; the key is not
  part of Figma's payload and the loader ignores it.
- `mode-deleted.json` — the aligned file with one mode of a multi-mode collection
  deleted, values and all. Every surviving value still agrees with the source, so
  the only thing wrong with this file is a comparison that no longer happens.
  That is the defect: it costs comparisons rather than causing them, and before
  `mode-missing-in-figma` existed this file passed the gate, with `80 → 74`
  comparisons the only trace and `--quiet` hiding even that.
- `dimension-flattened.json` — the aligned file with a whole mode dimension left
  unmodelled: the collection that used to carry it now has one mode, which is the
  invariant convention rather than a defect. It must report **no** missing mode,
  and must still report the value finding that one-value-for-every-combination
  causes. It is here to hold the line between a comparison that ran and
  disagreed and one that never ran — the two look identical in an exit code and
  are not the same thing at all.

Each planted edit is attributable to its own code: repair one of them and exactly
that code stops being reported. `value-mismatch` is planted twice on purpose —
once as a nudged colour, once as a whole CSS font stack pasted over the narrowed
family — because the second is the shape a *disagreement between the two tools*
would take, and it is worth having a fixture for the failure that would otherwise
be unfixable.

Both are the payload of Figma's read endpoint for local variables,
`GET /v1/files/<key>/variables/local`, verbatim — so a real file can be curled
straight into this shape and compared with no credentials in CI.

They are a faithful projection of what `machinery/figma-plugin/` writes: one
collection per mode dimension, one per invariant token layer, and the single
mode of an invariant collection named `Default`. That fidelity is the point.
A snapshot shaped the way the syncer does *not* write would prove nothing about
a real file, and two structures that disagree by design cannot be compared.

Do not fix `drifted.json` either.
