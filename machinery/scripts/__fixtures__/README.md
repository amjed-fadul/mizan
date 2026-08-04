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

These fixtures are machinery, so they carry no brand: the names are generic
(`color.neutral`, `surface.default`, `theme.light`) and the values are chosen
for the arithmetic they produce, not for how they look.

`valid/` also discovers its modes by the filename convention
(`theme.light.json`), while `broken/` uses a `modes.json` manifest — between
them both discovery paths are exercised.

Do not fix `broken/`. Its defects are the test.
