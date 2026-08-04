/**
 * projection.mjs — the projection rules the syncer and the detector share.
 *
 * `machinery/figma-plugin/src/core/map.ts` decides what a token *becomes* when
 * it is written into Figma. `machinery/scripts/check-drift.mjs` decides what a
 * token *should look like* once it is there. Those are the same question asked
 * from two ends, and most of the answer is safe to state twice: a type table or
 * a unit rule that disagrees produces a finding somebody can read and fix.
 *
 * This file holds the part that is not safe to state twice — where the two
 * sides would disagree *silently and permanently*. A rule that discards
 * information on the way out cannot be re-derived on the way back in. If the
 * writer and the reader pick differently, the detector reports drift, the sync
 * runs, and the detector reports the same drift again: a gate nobody can ever
 * clear, which is worse than no gate, because the only way to make the build
 * green is to stop looking.
 *
 * So there is one copy, both sides import it, and it lives here rather than in
 * the plugin because a gate that needs a TypeScript build to run is not a gate.
 * The plugin's build bundles this file; `check-drift.mjs` imports it directly.
 *
 * Brand-agnostic, like everything else in `machinery/`: nothing here knows a
 * font name, a token name or a product.
 */

/* ------------------------------------------------------------------ *
 * Font families
 * ------------------------------------------------------------------ */

/**
 * Narrow a DTCG font *stack* to the single family Figma can hold.
 *
 * DTCG allows a stack — `["Some Sans", "Fallback Sans", "sans-serif"]` — because
 * CSS resolves fallbacks at render time. A Figma variable is one STRING, and
 * Figma binds it to an installed font by name, so the *first* family is the only
 * projection that produces a working variable. Joining the stack into
 * `"Some Sans, Fallback Sans, sans-serif"` would round-trip through the drift
 * gate perfectly and bind to nothing in the file.
 *
 * The fallbacks are lost, and they are named rather than dropped quietly: the
 * caller reports `note` as a warning, so the loss shows up on the run that
 * caused it instead of being discovered in Figma months later.
 *
 * Deliberately narrow in scope. A `fontFamily` may also be a plain string, and
 * that case is *not* handled here — it is the identity, it loses nothing, and
 * both callers state it themselves. Only the lossy step is shared, so a later
 * change to this function can only ever affect stacks.
 *
 * @param {unknown} value a DTCG font stack: a non-empty list of strings.
 * @returns {{ family: string, fallbacks: string[], note: string|undefined }|null}
 *          `null` when the value is not a stack — the caller owns the error
 *          message, because the two callers phrase refusals differently and only
 *          the *choice* has to be shared.
 */
export function narrowFontStack(value) {
  if (!Array.isArray(value) || value.length === 0 || !value.every((item) => typeof item === 'string')) {
    return null;
  }
  const [family, ...fallbacks] = value;
  return { family, fallbacks, note: fallbacks.length > 0 ? fontStackNote(fallbacks) : undefined };
}

/**
 * How the narrowing reads in a warning. Shared for the same reason the choice
 * is: two wordings for one decision is two places to look when it changes.
 */
export function fontStackNote(fallbacks) {
  return `narrowed to the first family; a Figma variable holds one value, so the fallbacks (${fallbacks.join(', ')}) are not represented`;
}
