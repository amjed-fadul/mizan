# packages/tokens/

Generated output. **Nothing in `css/`, `ios/` or `android/` is edited by hand** — every file in them carries a header saying so and naming its source.

The source is [`content/tokens/`](../../content/tokens/). The build is [`machinery/scripts/build-tokens.mjs`](../../machinery/scripts/build-tokens.mjs). Run it with:

```
npm run build:tokens
```

The build runs `check-schema.mjs` and `check-contrast.mjs` first and refuses to generate anything if either fails. Output that has not been checked is indistinguishable from output that has, so it is never produced.

## Contents

| Path | Generated | Holds |
|---|---|---|
| `css/tokens.css` | yes | every token, every mode combination, one file |
| `ios/DesignTokens*.swift` | yes | one `enum` per mode combination |
| `android/<combination>/tokens.xml` | yes | one resource file per mode combination |
| `docs/button.md` | no | the component spec — how one set of semantics becomes three implementations |
| `package.json` | no | package metadata |
| `README.md` | no | this file |

## Why these files are committed

They are a future npm package, so a consumer should be able to install the repository and have working CSS without a build step. They are also the review surface: a pull request that changes one primitive shows exactly which semantic values moved and in which modes, which is how an unintended global change gets caught before it ships. The build is deterministic — same input, byte-identical output — so a rebuild that produces a diff means something actually changed.

The build *intermediate* (`.tokens-build/`) is not committed. It is the adapted JSON handed to Style Dictionary and nothing else reads it.

## CSS — one file, one block per mode combination

```css
:root                                             /* values identical in every combination */
:root[data-theme="light"][data-product="market"]  /* only the values that differ */
:root[data-theme="light"][data-product="move"]
:root[data-theme="dark"][data-product="market"]
:root[data-theme="dark"][data-product="move"]
```

One attribute per mode dimension, named after the dimension. Switching product or theme at runtime is a single attribute write on the root element:

```js
document.documentElement.dataset.theme = 'dark';
document.documentElement.dataset.product = 'move';
```

The attribute names are not configured anywhere. They come from the dimension names in `content/tokens/modes.json`; a third dimension added there appears here as a third attribute with no change to the build.

Semantic tokens keep their references, so `--text-primary: var(--neutral-900)` in the CSS is the same alias the source declares. Following a value back to its primitive is reading, not rebuilding.

Two custom properties in the file — `--text-secondary-market` and `--text-secondary-move` — are the slot tokens the source describes as plumbing. They exist here because `--text-secondary` references one of them, and a reference needs a target. Nothing outside the mode files should use them, in CSS or anywhere else.

## iOS and Android

These prove the pipeline is multi-platform. **They are not a mobile deliverable**, and they should not be treated as the start of one.

They carry colour and dimension only. Those are the two types that map onto both resource models without inventing a convention. The rest need a decision that is content rather than machinery: whether a dimension becomes `dp` or `sp` on Android depends on whether the token is spacing or type, and that is knowledge about the token, not about its shape. When mobile becomes real, that knowledge arrives as a `$extensions` hint in the source and the platform filter in `build-tokens.mjs` grows.

Two other things a real mobile delivery would change, noted so they are not discovered as surprises:

- **Android** would map the theme dimension onto resource qualifiers (`values-night/`) rather than one directory per combination. Doing that here would mean the build knowing which of its discovered dimensions means "theme", which it deliberately does not.
- **iOS** would use asset-catalogue colour sets with light/dark variants, or a `Color` extension resolving against `UITraitCollection`, rather than one flat `enum` per combination.
