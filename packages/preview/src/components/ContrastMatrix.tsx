import pairsSource from '../../../../content/tokens/pairs.json'
import { useMode } from '../lib/mode'
import { s, ui } from '../lib/strings'
import type { Lang } from '../lib/strings'
import { Run } from './Run'
import { COMBINATIONS, combinationKey, cssNameForPath, resolvePath } from '../lib/tokens'
import type { Combination } from '../lib/tokens'
import { contrastRatio, formatRatio, thresholdFor, verdict } from '../lib/contrast'
import type { PairContext, Verdict } from '../lib/contrast'

type DeclaredPair = {
  foreground: string
  background: string
  context: string
  $description: string
}

type DeclaredException = {
  foreground: string
  background: string
  reason: string
  modes?: string[]
}

// content/tokens/pairs.json is read directly rather than copied. It is the
// editing surface for this declaration (CLAUDE.md rule 1), and a preview that
// kept its own list of pairings would be able to disagree with the build gate.
const SOURCE = pairsSource as { pairs: DeclaredPair[]; exceptions?: DeclaredException[] }
const PAIRS = SOURCE.pairs
const EXCEPTIONS = SOURCE.exceptions ?? []

/**
 * A mode scope, read the way check-contrast.mjs reads one: for every dimension
 * the list mentions, this combination's mode for that dimension must be one of
 * the listed ones. Or within a dimension, and within a dimension only.
 *
 * The script's own comment records why: as a plain conjunction across
 * dimensions, ["theme.light", "theme.dark"] — which reads to anybody as "both
 * themes" — matched nothing at all and silently switched the check off. The two
 * files have to agree on this or the page and the gate would disagree about
 * which combinations an exception covers, which is the same defect as
 * disagreeing about a ratio.
 */
function scopeIncludes(modes: string[] | undefined, c: Combination): boolean {
  if (!modes) return true
  const byDimension = new Map<string, Set<string>>()
  for (const id of modes) {
    const dimension = id.slice(0, id.indexOf('.'))
    if (!byDimension.has(dimension)) byDimension.set(dimension, new Set())
    byDimension.get(dimension)!.add(id)
  }
  for (const [dimension, ids] of byDimension) {
    const selected = dimension === 'theme' ? `theme.${c.theme}`
      : dimension === 'product' ? `product.${c.product}`
        : null
    if (selected === null || !ids.has(selected)) return false
  }
  return true
}

function exceptionFor(pair: DeclaredPair, c: Combination): DeclaredException | undefined {
  return EXCEPTIONS.find((e) => e.foreground === pair.foreground
    && e.background === pair.background
    && scopeIncludes(e.modes, c))
}

/** Every distinct reason in effect on this pair, in any of the four combinations. */
function reasonsFor(pair: DeclaredPair): string[] {
  const seen = new Set<string>()
  for (const c of COMBINATIONS) {
    const exception = exceptionFor(pair, c)
    if (exception) seen.add(exception.reason)
  }
  return [...seen]
}

function contextLabel(context: PairContext, lang: Lang): string {
  switch (context) {
    case 'text':
      return s(ui.pairs.contextText, lang)
    case 'large-text':
      return s(ui.pairs.contextLargeText, lang)
    case 'ui':
      return s(ui.pairs.contextUi, lang)
    case 'decorative':
      return s(ui.pairs.contextDecorative, lang)
  }
}

function verdictLabel(value: Verdict, lang: Lang): string {
  if (value === 'pass') return s(ui.pairs.pass, lang)
  if (value === 'fail') return s(ui.pairs.fail, lang)
  if (value === 'excepted') return s(ui.pairs.excepted, lang)
  return s(ui.pairs.reported, lang)
}

function modeLabel(c: Combination, lang: Lang): string {
  const theme = c.theme === 'light' ? s(ui.controls.light, lang) : s(ui.controls.dark, lang)
  const product = c.product === 'market' ? s(ui.controls.market, lang) : s(ui.controls.move, lang)
  return `${theme} · ${product}`
}

function ratioFor(pair: DeclaredPair, c: Combination): number | null {
  const fg = resolvePath(pair.foreground, c).value
  const bg = resolvePath(pair.background, c).value
  return contrastRatio(fg, bg)
}

function VerdictBadge({ value, lang }: { value: Verdict; lang: Lang }) {
  return (
    <span className={`mz-verdict mz-verdict--${value}`}>
      <span className="mz-verdict__mark" aria-hidden="true" />
      <Run text={verdictLabel(value, lang)} ambient={lang} />
    </span>
  )
}

function PairCard({ pair, lang }: { pair: DeclaredPair; lang: Lang }) {
  const mode = useMode()
  const context = pair.context as PairContext
  const threshold = thresholdFor(context)
  const currentKey = combinationKey(mode.combination)

  return (
    <li className="mz-pair">
      <div className="mz-pair__id">
        <div className="mz-pair__names">
          <span className="mz-token-name">
            <bdi>{pair.foreground}</bdi>
          </span>
          <span className="mz-value">
            <Run text={s(ui.pairs.on, lang)} ambient={lang} />
          </span>
          <span className="mz-token-name">
            <bdi>{pair.background}</bdi>
          </span>
        </div>

        <div
          className="mz-pair__sample"
          style={{
            color: `var(${cssNameForPath(pair.foreground)})`,
            backgroundColor: `var(${cssNameForPath(pair.background)})`
          }}
        >
          {/* The specimen is the pairing rendered, not described: Latin, Arabic
              and digits together, because that is the string this system has to
              hold up under. */}
          <Run text="Mizan" ambient="en" />
          {' · '}
          <Run text="ميزان" ambient="en" />
          {' · '}
          <Run text="12.50" ambient="en" />
        </div>

        <div className="mz-pair__names">
          <span className="mz-tag mz-tag--strong">
            <Run text={contextLabel(context, lang)} ambient={lang} />
          </span>
          <span className="mz-tag">
            {threshold === null ? (
              <Run text={s(ui.pairs.notGated, lang)} ambient={lang} />
            ) : (
              <>
                <Run text={s(ui.pairs.needs, lang)} ambient={lang} />
                {' '}
                <bdi>{threshold.toFixed(1)}</bdi>
              </>
            )}
          </span>
        </div>
      </div>

      <ul className="mz-pair__matrix">
        {COMBINATIONS.map((c) => {
          const ratio = ratioFor(pair, c)
          const key = combinationKey(c)
          const isCurrent = key === currentKey
          return (
            <li key={key} className={isCurrent ? 'mz-cell mz-cell--current' : 'mz-cell'}>
              <span className="mz-cell__mode">
                <Run text={modeLabel(c, lang)} ambient={lang} />
                {isCurrent && (
                  <>
                    {' · '}
                    <Run text={s(ui.pairs.current, lang)} ambient={lang} />
                  </>
                )}
              </span>
              <span className="mz-cell__ratio">
                <bdi>{ratio === null ? '—' : `${formatRatio(ratio)}:1`}</bdi>
              </span>
              {ratio !== null && (
                <VerdictBadge
                  value={verdict(ratio, context, exceptionFor(pair, c) !== undefined)}
                  lang={lang}
                />
              )}
            </li>
          )
        })}
      </ul>

      {/* The reason, in full, on the card the exception applies to. An exception
          the reader has to go and find in a JSON file is a silent one, and
          pairs.json says what a silent exception is. */}
      {reasonsFor(pair).map((reason) => (
        <p key={reason} className="mz-pair__exception">
          <span className="mz-tag mz-tag--strong">
            <Run text={s(ui.pairs.excepted, lang)} ambient={lang} />
          </span>
          {' '}
          <Run text={reason} ambient="en" />
        </p>
      ))}
    </li>
  )
}

export function ContrastMatrix() {
  const { lang } = useMode()

  return (
    <section className="mz-section" aria-labelledby="mz-pairs-title">
      <div className="mz-section__head">
        <p className="mz-eyebrow">
          <Run text="03" ambient="en" />
        </p>
        <h2 className="mz-h2" id="mz-pairs-title">
          <Run text={s(ui.pairs.title, lang)} ambient={lang} />
        </h2>
        <p className="mz-prose">
          <Run text={s(ui.pairs.lede, lang)} ambient={lang} />
        </p>
        <p className="mz-prose">
          <Run text={s(ui.pairs.verdictNote, lang)} ambient={lang} />
        </p>
      </div>

      <ul className="mz-pairs">
        {PAIRS.map((pair) => (
          <PairCard key={`${pair.foreground}-${pair.background}-${pair.context}`} pair={pair} lang={lang} />
        ))}
      </ul>
    </section>
  )
}
