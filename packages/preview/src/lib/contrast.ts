/**
 * WCAG 2.2 relative luminance and contrast ratio.
 *
 * This is the same arithmetic machinery/scripts/check-contrast.mjs runs at build
 * time. It is reimplemented here rather than imported because that script is
 * Node-side build machinery and this is a browser bundle; what matters is that
 * both compute the ratio from the *resolved* value of the same two tokens in the
 * same mode combination, so the number on screen is the number that gated the
 * build. If the two ever disagree, the build is the authority.
 */

export type PairContext = 'text' | 'large-text' | 'ui' | 'decorative'

/** The threshold a context is gated at, or null when the context makes no claim. */
export function thresholdFor(context: PairContext): number | null {
  switch (context) {
    case 'text':
      return 4.5
    case 'large-text':
    case 'ui':
      return 3
    case 'decorative':
      // Not a lowered bar — the absence of a claim. WCAG 1.4.11 governs
      // boundaries that identify components and their states; a container
      // hairline identifies none, so the ratio is reported and nothing is gated.
      return null
  }
}

type Rgb = { r: number; g: number; b: number }

/** Accepts #rgb, #rrggbb and #rrggbbaa. Alpha is ignored: no declared pair uses it. */
export function parseColor(value: string): Rgb | null {
  const hex = value.trim()
  if (!hex.startsWith('#')) return null
  const body = hex.slice(1)
  const expand = (s: string) => parseInt(s, 16)
  if (body.length === 3) {
    return {
      r: expand(body[0] + body[0]),
      g: expand(body[1] + body[1]),
      b: expand(body[2] + body[2])
    }
  }
  if (body.length === 6 || body.length === 8) {
    return { r: expand(body.slice(0, 2)), g: expand(body.slice(2, 4)), b: expand(body.slice(4, 6)) }
  }
  return null
}

function channel(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

export function relativeLuminance(rgb: Rgb): number {
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b)
}

/** Contrast ratio of two resolved colour values, or null if either is not a colour. */
export function contrastRatio(foreground: string, background: string): number | null {
  const fg = parseColor(foreground)
  const bg = parseColor(background)
  if (!fg || !bg) return null
  const a = relativeLuminance(fg)
  const b = relativeLuminance(bg)
  const lighter = Math.max(a, b)
  const darker = Math.min(a, b)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Two decimal places, rounded — the same formatting
 * machinery/scripts/check-contrast.mjs prints, so a ratio read here and a ratio
 * read in the build log are the same string.
 *
 * The verdict below is decided on the unrounded value, not on this one. A pair
 * at 4.499 prints as 4.50 and is still marked Fail, because the threshold is a
 * property of the colours and not of how many digits we chose to show.
 */
export function formatRatio(ratio: number): string {
  return ratio.toFixed(2)
}

export type Verdict = 'pass' | 'fail' | 'reported' | 'excepted'

/**
 * `excepted` is the fourth verdict because pairs.json grew its first exceptions
 * and a matrix that did not know about them would have printed Fail on six cells
 * of a build that passes. That is the one thing this page may never do: decision
 * 018 puts it here to make the gate's guarantee inspectable, and a matrix that
 * disagrees with the gate is worse than no matrix.
 *
 * It is deliberately not a pass. check-contrast.mjs prints every exception
 * whether it currently clears its threshold or not — "a silent exception is not
 * an exception, it is a hole" — so the verdict says the bar was set aside, the
 * ratio stays on screen next to it, and the reason is printed on the card. What
 * a reader must be able to do is find every exception in the system by looking,
 * which is why this is its own word rather than a footnote on Pass.
 */
export function verdict(ratio: number, context: PairContext, excepted = false): Verdict {
  if (excepted) return 'excepted'
  const threshold = thresholdFor(context)
  if (threshold === null) return 'reported'
  return ratio >= threshold ? 'pass' : 'fail'
}
