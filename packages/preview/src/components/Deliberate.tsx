import { useMode } from '../lib/mode'
import { s, ui } from '../lib/strings'
import type { Lang } from '../lib/strings'
import { Run } from './Run'
import { COMBINATIONS, combinationKey, declarationsFor, resolveToken } from '../lib/tokens'
import type { Combination, Theme } from '../lib/tokens'
import { contrastRatio, formatRatio } from '../lib/contrast'

function modeLabel(c: Combination, lang: Lang): string {
  const theme = c.theme === 'light' ? s(ui.controls.light, lang) : s(ui.controls.dark, lang)
  const product = c.product === 'market' ? s(ui.controls.market, lang) : s(ui.controls.move, lang)
  return `${theme} · ${product}`
}

function valueOf(name: string, c: Combination): string {
  return resolveToken(name, declarationsFor(c)).value
}

/**
 * Decision 008 refused to merge commerce.discount and mobility.safety. The
 * refusal is only worth anything if it holds in every combination, so this is
 * the refusal checked rather than restated.
 */
function RefusalNote({ lang }: { lang: Lang }) {
  const distinct = COMBINATIONS.filter(
    (c) => valueOf('--commerce-discount', c) !== valueOf('--mobility-safety', c)
  ).length

  return (
    <article className="mz-note">
      <h3 className="mz-h3">
        <Run text={s(ui.notes.refusalTitle, lang)} ambient={lang} />
      </h3>
      <p className="mz-prose">
        <Run text={s(ui.notes.refusalBody, lang)} ambient={lang} />
      </p>
      <div className="mz-note__proof">
        <p className="mz-prose">
          <Run
            text={`${s(ui.notes.refusalResult, lang)} ${distinct}/${COMBINATIONS.length}`}
            ambient={lang}
          />
        </p>
        {COMBINATIONS.map((c) => {
          const discount = valueOf('--commerce-discount', c)
          const safety = valueOf('--mobility-safety', c)
          return (
            <div className="mz-proof-row" key={combinationKey(c)}>
              <span className="mz-proof-row__name">
                <Run text={modeLabel(c, lang)} ambient={lang} />
              </span>
              <span className="mz-proof-row__chip" style={{ backgroundColor: discount }} />
              <bdi>{discount}</bdi>
              <span className="mz-proof-row__chip" style={{ backgroundColor: safety }} />
              <bdi>{safety}</bdi>
            </div>
          )
        })}
      </div>
    </article>
  )
}

/** text.secondary is the one shared semantic that depends on both dimensions. */
function DensityNote({ lang, theme }: { lang: Lang; theme: Theme }) {
  const rows = (['market', 'move'] as const).map((product) => {
    const c: Combination = { theme, product }
    const value = valueOf('--text-secondary', c)
    const ground = valueOf('--surface-default', c)
    const ratio = contrastRatio(value, ground)
    const chain = resolveToken('--text-secondary', declarationsFor(c)).chain
    return { product, value, ratio, chain }
  })

  return (
    <article className="mz-note">
      <h3 className="mz-h3">
        <Run text={s(ui.notes.densityTitle, lang)} ambient={lang} />
      </h3>
      <p className="mz-prose">
        <Run text={s(ui.notes.densityBody, lang)} ambient={lang} />
      </p>
      <div className="mz-note__proof">
        <p className="mz-prose">
          <Run text={s(ui.notes.inTheme, lang)} ambient={lang} />
        </p>
        {rows.map((row) => (
          <div className="mz-proof-row" key={row.product}>
            <span className="mz-proof-row__name">
              <Run
                text={
                  row.product === 'market'
                    ? s(ui.controls.market, lang)
                    : s(ui.controls.move, lang)
                }
                ambient={lang}
              />
            </span>
            <span className="mz-proof-row__chip" style={{ backgroundColor: row.value }} />
            <bdi>{row.chain[row.chain.length - 1]}</bdi>
            <bdi>{row.value}</bdi>
            <bdi>{row.ratio === null ? '—' : `${formatRatio(row.ratio)}:1`}</bdi>
          </div>
        ))}
      </div>
    </article>
  )
}

/** The two amber tokens, and the one thing they are not allowed to do. */
function AmberNote({ lang }: { lang: Lang }) {
  const mode = useMode()
  const tokens = [
    { name: '--commerce-stock-low', label: s(ui.notes.lowStockLabel, lang) },
    { name: '--mobility-surge', label: s(ui.notes.surgeLabel, lang) }
  ]
  const ground = valueOf('--surface-default', mode.combination)

  return (
    <article className="mz-note">
      <h3 className="mz-h3">
        <Run text={s(ui.notes.amberTitle, lang)} ambient={lang} />
      </h3>
      <p className="mz-prose">
        <Run text={s(ui.notes.amberBody, lang)} ambient={lang} />
      </p>
      <div className="mz-note__proof">
        {tokens.map((token) => {
          const value = valueOf(token.name, mode.combination)
          const ratio = contrastRatio(value, ground)
          return (
            <div className="mz-proof-row" key={token.name}>
              {/* Permitted: the token is the dot. The words beside it are
                  text.primary, which is where the legibility actually comes from. */}
              <span className="mz-dot" style={{ backgroundColor: `var(${token.name})` }} />
              <span className="mz-proof-row__name" style={{ color: 'var(--text-primary)' }}>
                <Run text={token.label} ambient={lang} />
              </span>
              <bdi>{value}</bdi>
              <bdi>{ratio === null ? '—' : `${formatRatio(ratio)}:1`}</bdi>
            </div>
          )
        })}
        {/* Forbidden, shown once so the rule has something to point at: the same
            token carrying the same words. It is legible enough to be tempting
            and short of 4.5:1, which is exactly why the role was narrowed
            instead of the value darkened. */}
        <div className="mz-proof-row">
          <span className="mz-tag">
            <Run text={s(ui.notes.forbidden, lang)} ambient={lang} />
          </span>
          <span className="mz-strike" style={{ color: 'var(--commerce-stock-low)' }}>
            <Run text={s(ui.notes.lowStockLabel, lang)} ambient={lang} />
          </span>
        </div>
      </div>
    </article>
  )
}

export function Deliberate() {
  const { lang, theme } = useMode()

  return (
    <section className="mz-section" aria-labelledby="mz-notes-title">
      <div className="mz-section__head">
        <p className="mz-eyebrow">
          <Run text="04" ambient="en" />
        </p>
        <h2 className="mz-h2" id="mz-notes-title">
          <Run text={s(ui.notes.title, lang)} ambient={lang} />
        </h2>
      </div>
      <div className="mz-notes">
        <RefusalNote lang={lang} />
        <DensityNote lang={lang} theme={theme} />
        <AmberNote lang={lang} />
      </div>
    </section>
  )
}
