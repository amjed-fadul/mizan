# machinery/figma-plugin/\_\_fixtures\_\_/

Two token roots that exist to make claims in the plugin's comments testable. Neither is anybody's design system; both are the smallest shape that exercises a rule.

| Fixture | Proves |
|---|---|
| `three-dimensions/` | A third mode dimension needs no plugin change. It also carries the two-dimension case (`text.secondary` as a selector over two slots), an invariant semantic that lands in a layer collection rather than a dimension collection, a font stack that has to be narrowed to one family, and a composite `shadow` that must be reported as skipped rather than flattened. |
| `cross-dimension/` | The refusal. One token is overridden by both dimensions directly instead of being expressed as a selector plus slots, and the plugin must produce a `cross-dimension-token` error and refuse to write anything. |

`dry-run.mjs` reads both, and reads the repository's real token root beside them. The fixtures give concrete assertions; the real root gives structural ones, so no Mizan value ever has to be written down in `machinery/`.
