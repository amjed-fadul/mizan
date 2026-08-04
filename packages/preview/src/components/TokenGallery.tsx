import { useMemo } from 'react'
import pairsSource from '../../../../content/tokens/pairs.json'
import { useMode } from '../lib/mode'
import { s, ui } from '../lib/strings'
import type { Lang } from '../lib/strings'
import { Run } from './Run'
import {
  GROUPED_TOKENS,
  LAYER_COUNTS,
  TOKEN_COUNT,
  cssNameForPath,
  declarationsFor,
  resolveToken
} from '../lib/tokens'
import type { Layer, TokenMeta } from '../lib/tokens'

const LAYERS: Layer[] = ['primitive', 'semantic', 'product']

/**
 * How many declared pairings each token appears in. An undeclared pairing is an
 * unchecked one, so the interesting number here is not the total but the zeros:
 * a colour that renders as a foreground or a background and shows no count is a
 * colour nothing has verified. The ratios themselves are in the next section.
 */
const PAIR_COUNTS: Record<string, number> = (() => {
  const counts: Record<string, number> = {}
  const pairs = (pairsSource as { pairs: { foreground: string; background: string }[] }).pairs
  for (const pair of pairs) {
    for (const path of [pair.foreground, pair.background]) {
      const name = cssNameForPath(path)
      counts[name] = (counts[name] ?? 0) + 1
    }
  }
  return counts
})()

function layerTitle(layer: Layer, lang: Lang): string {
  if (layer === 'primitive') return s(ui.gallery.layerPrimitive, lang)
  if (layer === 'semantic') return s(ui.gallery.layerSemantic, lang)
  return s(ui.gallery.layerProduct, lang)
}

function layerNote(layer: Layer, lang: Lang): string {
  if (layer === 'primitive') return s(ui.gallery.layerPrimitiveNote, lang)
  if (layer === 'semantic') return s(ui.gallery.layerSemanticNote, lang)
  return s(ui.gallery.layerProductNote, lang)
}

/**
 * The swatch. Colour tokens get a colour; everything else gets a rendering of
 * the thing it actually controls, because a design token that can only be shown
 * as a string has not been shown.
 */
function Preview({ token, value }: { token: TokenMeta; value: string }) {
  const name = token.name

  if (token.kind === 'color') {
    return <div className="mz-swatch" style={{ backgroundColor: `var(${name})` }} />
  }

  if (name.startsWith('--radius')) {
    return (
      <div className="mz-swatch mz-swatch--plain">
        <div
          style={{
            inlineSize: 'var(--space-300)',
            blockSize: 'var(--space-300)',
            backgroundColor: 'var(--text-primary)',
            borderRadius: `var(${name})`
          }}
        />
      </div>
    )
  }

  if (token.kind === 'shadow') {
    return (
      <div className="mz-swatch mz-swatch--plain" style={{ overflow: 'visible' }}>
        <div
          style={{
            inlineSize: 'var(--space-250)',
            blockSize: 'var(--space-250)',
            backgroundColor: 'var(--surface-default)',
            borderRadius: 'var(--radius-100)',
            boxShadow: `var(${name})`
          }}
        />
      </div>
    )
  }

  if (name.startsWith('--space') || name.startsWith('--letter-spacing')) {
    return (
      <div className="mz-swatch mz-swatch--plain">
        <div
          className="mz-swatch__bar"
          style={{ inlineSize: `var(${name})`, maxInlineSize: '100%' }}
        />
      </div>
    )
  }

  if (name.startsWith('--font-family')) {
    return (
      <div className="mz-swatch mz-swatch--plain" style={{ fontFamily: `var(${name})` }}>
        {name.endsWith('arabic') ? 'أب' : 'Aa'}
      </div>
    )
  }

  if (name.startsWith('--font-size') && !name.endsWith('scale')) {
    return (
      <div className="mz-swatch mz-swatch--plain" style={{ fontSize: `var(${name})` }}>
        Aa
      </div>
    )
  }

  if (name.startsWith('--font-weight')) {
    return (
      <div
        className="mz-swatch mz-swatch--plain"
        style={{ fontWeight: `var(${name})`, fontSize: 'var(--font-size-400)' }}
      >
        Aa
      </div>
    )
  }

  return <div className="mz-swatch mz-swatch--plain">{value}</div>
}

function TokenRow({ token, lang }: { token: TokenMeta; lang: Lang }) {
  const mode = useMode()
  const resolution = useMemo(
    () => resolveToken(token.name, declarationsFor(mode.combination)),
    [token.name, mode.combination]
  )

  const aliases = resolution.chain.slice(1)
  const pairCount = PAIR_COUNTS[token.name] ?? 0

  return (
    <div className="mz-row">
      <Preview token={token} value={resolution.value} />

      <div>
        <div className="mz-token-name">
          <bdi>{token.name}</bdi>
        </div>
        {(token.variesByTheme || token.variesByProduct || token.plumbing || pairCount > 0) && (
          <div className="mz-row__meta">
            {pairCount > 0 && (
              <span className="mz-tag mz-tag--strong">
                {/* One string, not two nodes with a space between them: the tag
                    is an inline-flex box and would drop the whitespace item.
                    Also side-steps a count phrase, which Arabic cannot form
                    without the six plural categories nothing here has yet. */}
                <Run text={`${s(ui.gallery.inPairs, lang)} · ${pairCount}`} ambient={lang} />
              </span>
            )}
            {token.variesByTheme && (
              <span className="mz-tag">
                <Run text={s(ui.gallery.variesTheme, lang)} ambient={lang} />
              </span>
            )}
            {token.variesByProduct && (
              <span className="mz-tag">
                <Run text={s(ui.gallery.variesProduct, lang)} ambient={lang} />
              </span>
            )}
            {token.plumbing && (
              <span className="mz-tag mz-tag--strong">
                <Run text={s(ui.gallery.plumbing, lang)} ambient={lang} />
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mz-value">
        <bdi>{resolution.value}</bdi>
      </div>

      {/* The alias chain, separated by a solidus rather than an arrow. An arrow
          is an interface glyph and would have to mirror under RTL; a chain of
          names is not a direction and should not acquire one. */}
      <div className="mz-chain">
        {aliases.map((alias, index) => (
          <span key={alias} className="mz-chain__item">
            {index > 0 && <span className="mz-chain__arrow"> / </span>}
            <bdi>{alias}</bdi>
          </span>
        ))}
      </div>
    </div>
  )
}

export function TokenGallery() {
  const { lang } = useMode()

  return (
    <section className="mz-section" aria-labelledby="mz-gallery-title">
      <div className="mz-section__head">
        <p className="mz-eyebrow">
          <Run text="02" ambient="en" />
        </p>
        <h2 className="mz-h2" id="mz-gallery-title">
          <Run text={s(ui.gallery.title, lang)} ambient={lang} />
        </h2>
        <p className="mz-prose">
          <Run text={s(ui.gallery.lede, lang)} ambient={lang} />
        </p>
      </div>

      <div className="mz-stats">
        <div className="mz-stat">
          <span className="mz-stat__value">{TOKEN_COUNT}</span>
          <span className="mz-stat__label">
            <Run text={s(ui.gallery.tokenCount, lang)} ambient={lang} />
          </span>
        </div>
        {LAYERS.map((layer) => (
          <div className="mz-stat" key={layer}>
            <span className="mz-stat__value">{LAYER_COUNTS[layer]}</span>
            <span className="mz-stat__label">
              <Run text={layerTitle(layer, lang)} ambient={lang} />
            </span>
          </div>
        ))}
      </div>

      {LAYERS.map((layer) => (
        <div className="mz-layer" key={layer}>
          <div className="mz-layer__head">
            <h3 className="mz-h3">
              <Run text={layerTitle(layer, lang)} ambient={lang} />
            </h3>
            <p className="mz-prose">
              <Run text={layerNote(layer, lang)} ambient={lang} />
            </p>
            {layer === 'semantic' && (
              <p className="mz-prose">
                <Run text={s(ui.gallery.plumbingNote, lang)} ambient={lang} />
              </p>
            )}
          </div>

          {GROUPED_TOKENS.filter((group) => group.layer === layer).map((group) => (
            <div className="mz-group" key={`${group.layer}-${group.group}`}>
              <div className="mz-group__head">
                <h4 className="mz-h4">
                  <Run text={group.group} ambient="en" />
                </h4>
                <span className="mz-tag">{group.tokens.length}</span>
              </div>
              <div className="mz-rows">
                {group.tokens.map((token) => (
                  <TokenRow key={token.name} token={token} lang={lang} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </section>
  )
}
