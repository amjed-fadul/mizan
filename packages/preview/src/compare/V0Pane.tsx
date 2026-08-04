import { useState } from 'react'
import './v0.css'
import {
  FILTER_IDS,
  PRODUCTS,
  V0_DELIVERY_TEXT,
  V0_FILTER_LABELS,
  V0_STOCK_TEXT
} from './products'
import type { FilterId } from './products'

/**
 * Mizan v0's Market category screen, reproduced.
 *
 * Nothing here is imported from legacy/ and nothing there is modified. The
 * markup shape, the class names' effects, the inline overrides and the string
 * construction are transcribed from
 * legacy/src/market/screens/CategoryScreen.tsx so that the two panes differ in
 * how they were built and in nothing else.
 *
 * The defects are reproduced rather than described wherever reproducing them is
 * possible without importing a physical direction property into this package:
 *
 *  - titles built by concatenation, so the bidi algorithm reorders the neutral
 *    characters between an Arabic run and a Latin one
 *  - `AED ` concatenated onto `toFixed(2)`, and a percentage from Math.round —
 *    no Intl anywhere, which is why the numeral system could not be decided
 *  - the filter chips and the quick-view overlay are plain `div`s, both carrying
 *    `onClick` in v0: not focusable, no role, no key handler. Try the chips with
 *    a mouse, then with Tab. The overlay is reproduced without its navigation,
 *    since this exhibit has nowhere to navigate to; from a keyboard and from a
 *    screen reader it is the identical element either way.
 *  - no alt text; the image is a div containing the word IMG
 *  - four greys and two brand greens that mean the same thing
 */
export function V0Pane() {
  const [activeFilter, setActiveFilter] = useState<FilterId>('all')

  return (
    <div className="v0">
      <div className="v0-nav">
        <a href="#" onClick={(e) => e.preventDefault()}>
          Home
        </a>
        {' | '}
        <a href="#" onClick={(e) => e.preventDefault()}>
          Grocery
        </a>
        {' | '}
        <a href="#" onClick={(e) => e.preventDefault()}>
          Cart
        </a>
        {' | '}
        <a href="#" onClick={(e) => e.preventDefault()}>
          Mizan Move
        </a>
      </div>

      <div className="v0-header">
        <h1 className="v0-h1">Grocery &amp; Everyday</h1>
        <p className="v0-muted">Delivered across Dubai and Sharjah, seven days a week.</p>
      </div>

      <div className="v0-card">
        {FILTER_IDS.map((id) => (
          <div
            key={id}
            className={`v0-badge ${id === activeFilter ? 'v0-badge--on' : 'v0-badge--off'}`}
            onClick={() => setActiveFilter(id)}
          >
            {V0_FILTER_LABELS[id]}
          </div>
        ))}
        <div className="v0-actions">
          <button className="v0-btn v0-btn--secondary">Sort by Price</button>
          <button className="v0-btn v0-btn--secondary">Filter</button>
          <button type="button" className="v0-btn v0-btn--mk">
            View Cart (4)
          </button>
          <button className="v0-btn v0-btn--cta">Add All to Cart</button>
        </div>
      </div>

      <div className="v0-grid">
        {PRODUCTS.map((product) => {
          var percentOff = 0
          if (product.wasPrice) {
            percentOff = Math.round(((product.wasPrice - product.price) / product.wasPrice) * 100)
          }

          var stockText = V0_STOCK_TEXT[product.stock]
          if (!stockText) {
            stockText = 'Unavailable'
          }

          return (
            <div key={product.id}>
              <div className="v0-product">
                <div className="v0-image">
                  IMG
                  <div className="v0-quickview">Quick view</div>
                </div>
                <div className="v0-body">
                  {product.wasPrice ? (
                    <span className="v0-discount">{'-' + percentOff + '%'}</span>
                  ) : null}
                  <div className="v0-title">
                    <a href="#" onClick={(e) => e.preventDefault()}>
                      {product.name + ' - ' + product.size}
                    </a>
                  </div>
                  <div className="v0-row">
                    <span className="v0-price">{'AED ' + product.price.toFixed(2)}</span>
                    {product.wasPrice ? (
                      <span className="v0-price-was">{'AED ' + product.wasPrice.toFixed(2)}</span>
                    ) : null}
                  </div>
                  <div className="v0-unit">
                    {'AED ' + product.unit.toFixed(2) + ' per ' + product.unitLabel}
                  </div>
                  <div className="v0-meta">{stockText}</div>
                  <div className="v0-delivery">{'Get it ' + V0_DELIVERY_TEXT[product.delivery]}</div>
                  <div className="v0-actions">
                    <button
                      className="v0-btn v0-btn--primary"
                      disabled={product.stock === 'out-of-stock'}
                    >
                      Add to Cart
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="v0-actions">
        <button className="v0-btn v0-btn--secondary">Load More</button>
      </div>
    </div>
  )
}
