import { useState } from 'react'
import './rebuilt.css'
import { useMode } from '../lib/mode'
import { s, ui } from '../lib/strings'
import type { Lang, Str } from '../lib/strings'
import { isolate } from '../lib/script'
import { formatCurrency, formatDiscount, formatNumber } from '../lib/format'
import { Run } from '../components/Run'
import { FILTER_IDS, PRODUCTS } from './products'
import type { CatalogueItem, DeliveryWindow, FilterId, StockLevel } from './products'

/**
 * The same screen, rebuilt on the token system.
 *
 * Same eight products, same content, same information. What changed:
 *
 *  - every colour resolves from a token, so every pairing on screen is one the
 *    build gate already checked in all four mode combinations
 *  - logical properties throughout, so `dir` is the only thing that has to move
 *  - mixed-direction runs isolated in `<bdi>`, never concatenated. The title is
 *    two elements rather than `name + ' - ' + size`
 *  - one formatter, asking for its numbering system explicitly (decision 012)
 *  - the Arabic type mode scoped to this subtree by :lang(), not to the root
 *  - real `<button>` elements, visible focus, alt text on every image. No
 *    `<div onClick>` anywhere in this pane.
 */

// A transparent pixel. The tile the reader sees is surface.sunken, painted by
// the stylesheet — so the placeholder carries no colour of its own and the
// element is still a real <img> with real alt text.
const PLACEHOLDER =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

const FILTER_LABELS: Record<FilterId, Str> = {
  all: ui.screen.filterAll,
  dairy: ui.screen.filterDairy,
  bakery: ui.screen.filterBakery,
  pantry: ui.screen.filterPantry,
  beverages: ui.screen.filterBeverages,
  electronics: ui.screen.filterElectronics
}

const STOCK_LABELS: Record<StockLevel, Str> = {
  'in-stock': ui.screen.inStock,
  'low-stock': ui.screen.lowStock,
  'out-of-stock': ui.screen.outOfStock
}

const DELIVERY_LABELS: Record<DeliveryWindow, Str> = {
  today: ui.screen.deliveryToday,
  tomorrow: ui.screen.deliveryTomorrow,
  none: ui.screen.deliveryNone
}

function ProductCard({ product, lang }: { product: CatalogueItem; lang: Lang }) {
  const soldOut = product.stock === 'out-of-stock'

  return (
    <li className="rb-card">
      <img
        className="rb-media"
        src={PLACEHOLDER}
        // No markup is possible inside an attribute, so the catalogue name is
        // isolated with the character-level equivalent of <bdi>.
        alt={`${s(ui.screen.photoOf, lang)} ${isolate(product.name)}`}
      />

      {product.wasPrice !== undefined && (
        <p className="rb-discount">
          <bdi>{formatDiscount(product.price, product.wasPrice, lang)}</bdi>
        </p>
      )}

      <h3 className="rb-title">
        <a href="#" onClick={(event) => event.preventDefault()}>
          <Run text={product.name} ambient={lang} />
          <span className="rb-title__size">
            <Run text={product.size} ambient={lang} />
          </span>
        </a>
      </h3>

      <p className="rb-prices">
        <span className="rb-price">
          <bdi>{formatCurrency(product.price, lang)}</bdi>
        </span>
        {product.wasPrice !== undefined && (
          <span className="rb-price-was">
            <bdi>{formatCurrency(product.wasPrice, lang)}</bdi>
          </span>
        )}
      </p>

      <p className="rb-unit">
        <bdi>{formatCurrency(product.unit, lang)}</bdi>{' '}
        <Run text={s(ui.screen.perUnit, lang)} ambient={lang} />{' '}
        <Run text={product.unitLabel} ambient={lang} />
      </p>

      <p className={product.stock === 'in-stock' ? 'rb-stock rb-stock--muted' : 'rb-stock'}>
        {product.stock === 'low-stock' && <span className="rb-stock__dot" aria-hidden="true" />}
        <Run text={s(STOCK_LABELS[product.stock], lang)} ambient={lang} />
      </p>

      <p className="rb-delivery">
        <Run text={s(DELIVERY_LABELS[product.delivery], lang)} ambient={lang} />
      </p>

      <p className="rb-card__foot">
        <button type="button" className="rb-btn rb-btn--block" disabled={soldOut}>
          <Run text={s(ui.screen.addToCart, lang)} ambient={lang} />
        </button>
      </p>
    </li>
  )
}

export function RebuiltPane() {
  const { lang } = useMode()
  const [activeFilter, setActiveFilter] = useState<FilterId>('all')

  return (
    // mz-script is where the script mode is applied. Not :root — decision 013.
    <div className="rb mz-script">
      <nav className="rb-nav" aria-label={s(ui.screen.grocery, lang)}>
        {[ui.screen.home, ui.screen.grocery, ui.screen.cart, ui.screen.move].map((label, index) => (
          <a key={index} href="#" onClick={(event) => event.preventDefault()}>
            <Run text={s(label, lang)} ambient={lang} />
          </a>
        ))}
      </nav>

      <div className="rb-header">
        <h2 className="rb-h1">
          <Run text={s(ui.screen.heading, lang)} ambient={lang} />
        </h2>
        <p className="rb-sub">
          <Run text={s(ui.screen.subheading, lang)} ambient={lang} />
        </p>
      </div>

      <div className="rb-toolbar">
        <fieldset className="rb-chips">
          <legend>
            <Run text={s(ui.screen.filterLegend, lang)} ambient={lang} />
          </legend>
          {FILTER_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className="rb-chip"
              aria-pressed={id === activeFilter}
              onClick={() => setActiveFilter(id)}
            >
              <Run text={s(FILTER_LABELS[id], lang)} ambient={lang} />
            </button>
          ))}
        </fieldset>

        <div className="rb-actions">
          <button type="button" className="rb-btn rb-btn--secondary">
            <Run text={s(ui.screen.sortByPrice, lang)} ambient={lang} />
          </button>
          <button type="button" className="rb-btn rb-btn--secondary">
            <Run text={s(ui.screen.filter, lang)} ambient={lang} />
          </button>
          <button type="button" className="rb-btn">
            <Run text={s(ui.screen.viewCart, lang)} ambient={lang} />{' '}
            <bdi>({formatNumber(4, lang)})</bdi>
          </button>
          <button type="button" className="rb-btn rb-btn--secondary">
            <Run text={s(ui.screen.addAll, lang)} ambient={lang} />
          </button>
        </div>
      </div>

      <ul className="rb-grid">
        {PRODUCTS.map((product) => (
          <ProductCard key={product.id} product={product} lang={lang} />
        ))}
      </ul>

      <div className="rb-foot">
        <button type="button" className="rb-btn rb-btn--secondary">
          <Run text={s(ui.screen.loadMore, lang)} ambient={lang} />
        </button>
      </div>
    </div>
  )
}
