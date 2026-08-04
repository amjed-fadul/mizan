/**
 * Which script a run of text is written in, and when to say so in markup.
 *
 * Decision 013 settled that script is a mode of the type scale, and that unlike
 * theme and product it is scoped to a subtree rather than to the document root —
 * an Arabic page contains Latin runs and an English page contains Arabic ones,
 * which is the case the bidi rules exist for.
 *
 * That decision is not in the token layer yet, and this file does not implement
 * it. `content/tokens/modes.json` declares two dimensions, and the Arabic
 * typography values are separate primitives under `arabic-*` names. What is here
 * is a CSS approximation standing in until Stage 3: two selectors swapping one
 * named primitive for another — `.mz-script:lang(ar)` (family, leading,
 * tracking — all inherited) and `.mz-run:lang(ar)` (the optical size correction,
 * applied once on the run). By 013's own account that shape is Option 1, the
 * parallel scale, with a class doing the switching rather than a resolved mode.
 *
 * The half of 013 the approximation does carry is where the scoping goes: the
 * selector sits on the element that carries the language, never on the root.
 * That part is a property of the markup and survives the mode landing.
 *
 * langAttr is the reason the correction is never applied twice: it emits a lang
 * attribute only when the run differs from the language already in force, so a
 * `lang="ar"` never nests inside another `lang="ar"`.
 */
import type { Lang } from './strings'

// Arabic, Arabic Supplement, Arabic Extended-A, and the two presentation-forms
// blocks. Written as escapes rather than as literal ranges so the source cannot
// be broken by an editor normalising a character it does not recognise.
const ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/

/** The dominant script of a run. A run with any Arabic in it is set as Arabic. */
export function langOf(text: string): Lang {
  return ARABIC.test(text) ? 'ar' : 'en'
}

/** The lang attribute a run needs, or undefined when it matches its surroundings. */
export function langAttr(text: string, ambient: Lang): string | undefined {
  const own = langOf(text)
  return own === ambient ? undefined : own
}

/**
 * The plain-text equivalent of <bdi>, for the places markup cannot reach: an
 * alt attribute, a title, an aria-label. U+2068 FIRST STRONG ISOLATE opens a run
 * whose direction is taken from its own first strong character, and U+2069 POP
 * DIRECTIONAL ISOLATE closes it. Same guarantee as the element, no element.
 */
export function isolate(text: string): string {
  return `\u2068${text}\u2069`
}
