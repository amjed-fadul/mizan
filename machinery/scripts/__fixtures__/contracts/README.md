# `__fixtures__/contracts/`

What `check-contracts.mjs` is pointed at when `selftest.mjs` asks it to prove it
rejects things. Nothing here is Mizan's — the components render `null` and the
prose describes fixtures.

```
src/            components to read
aligned/        one contract that must pass, and nothing else
drifted/        the same contract, hand-edited eleven ways
refused/        contracts the gate refuses before it gets as far as comparing
```

Every metadata directory here borrows the one real schema
(`machinery/metadata/component-contract.schema.json`) through `--schema`. A copy
would be a second source of truth for the shape, and the first thing it would
prove is that a fixture can pass a schema the repository no longer uses. The
token root is `__fixtures__/valid`, passed with `--root`.

## `src/`

| File | What it is for |
|---|---|
| `Widget.tsx` | Every form the reader claims to understand, once: an inline string union, a union behind a local alias, a boolean with a default, a required prop with none, a handler whose type contains an arrow, a `@deprecated` tag carrying its replacement, and a two-paragraph JSDoc so the summary and the notes are two things. |
| `Widget.css` | The stylesheet the token list is read from. It also references `--motion-fast`, which the fixture token set does not define. |
| `Sprawl.tsx` | A props type outside the subset in three ways at once — an index signature, an inline object literal and a call signature. |
| `Overreach.tsx` | An ordinary component. The defect is in its authored half. |

## `aligned/`

Must report **zero errors and zero warnings**, with all seven props compared and
nine tokens read out of the stylesheet. It is generated rather than written: run

```
node machinery/scripts/gen-contract.mjs \
  --source machinery/scripts/__fixtures__/contracts/src/Widget.tsx \
  --metadata machinery/scripts/__fixtures__/contracts/aligned \
  --schema machinery/metadata/component-contract.schema.json \
  --root machinery/scripts/__fixtures__/valid
```

and the file that comes out is the file that is checked in. That is the same
arrangement `figma/aligned.json` has with the projection rules: change the
generator and this fixture stops being aligned, which is the point.

`--motion-fast` is the fixture for the declared-absence rule. The authored half
declares it under `tokens_absent` with a reason, so it is reported and does not
fail; delete the declaration and generation refuses the component.

## `drifted/`

The aligned contract with eleven edits planted in it, one per code. Every edit
is attributable: repair one and exactly its own code stops being reported.

| Planted edit | Code |
|---|---|
| `tone.type` widened to `string` | `prop-type-mismatch` |
| `scale.values` loses `large` | `prop-values-mismatch` |
| `busy.default` flipped to `true` | `prop-default-mismatch` |
| `label.required` flipped to `false` | `prop-required-mismatch` |
| `caption` loses its `deprecated` | `prop-deprecation-drift` |
| `onPress.description` reworded here rather than in the JSDoc | `prop-description-drift` |
| `hint` deleted | `prop-missing-in-contract` |
| `ghost` invented | `prop-unknown-to-source` |
| `no.such.token` added to the token list | `contract-token-unknown` |
| an alternative claiming `in_system` for a component nothing describes | `alternative-not-in-system` |
| `purpose` edited in the generated file instead of the authored one | `contract-stale` |

The last one is the one worth reading twice. Every other edit above is caught by
comparing the contract to the *source*; that one is caught only by regenerating,
and it is the edit that proves the generated file is not an editing surface.

## `refused/`

Six contracts and three authored halves, each refused before or instead of a
comparison.

| File | Code |
|---|---|
| `gone.json` | `component-source-missing` — the source it names is not there |
| `sprawl.json` | `source-unreadable` — the reader refuses the props type by name |
| `overreach.json` + `authored/overreach.json` | `authored-invalid` — the authored half states a prop's type and a prop's default, both of which the source already carries |
| `lonely.json` | `authored-missing` — a correct contract with nothing to regenerate it from |
| `nameless.json` | `contract-invalid` — not a contract |
| `renamed.json` | `component-name-mismatch`, `props-type-mismatch`, `extends-mismatch` |
| `authored/orphan.json` | `orphan-authored`, a warning — work that was written and never generated |

`renamed.json` is why the gate discovers the props type rather than taking the
contract's word for it. Handing the reader a renamed type would report a source
it cannot follow, which names the wrong file for a rename anybody can see.
