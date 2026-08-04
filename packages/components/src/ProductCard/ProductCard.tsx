import type { ReactNode } from 'react'
import { Button } from '../Button'
import '../styles/focus.css'
import './ProductCard.css'

/**
 * How much of the product is left, as a state rather than a sentence.
 *
 * The label is a separate prop because the words are the catalogue's and the
 * *state* is the card's — a component that mapped `'low'` to "Only a few left"
 * would be holding an English string, and v0's `RIDE_TYPE_LABELS` is what that
 * looks like when it goes wrong.
 *
 * `'low'` is the only one that takes a colour: `commerce.stock.low`, declared
 * in `pairs.json` at the 3.0 indicator bar. `'out'` is not painted red — it
 * disables the action, which says more than a colour can and says it to
 * everybody.
 */
export type StockLevel = 'in' | 'low' | 'out'

/** The properties ProductCard exposes. */
export interface ProductCardProps {
  /**
   * The product name.
   *
   * **Kept separate from `packageSize`, and this is a fix rather than a
   * preference.** v0 builds its title as `product.name + ' - ' + product.size`
   * at three call sites, and the Stage 1 audit found the result: *"Every Arabic
   * product name renders correctly on its own. It is the concatenation that
   * scrambles them. Seven of eight cards look right and one is wrong, which is
   * exactly why this survives review."* Two nodes, rendered as two elements,
   * cannot produce that.
   */
  name: ReactNode

  /**
   * The package size — "500 g", "6 × 1.5 L". A property of the product, not of
   * this component's geometry, which is why it is not called `size`: `size` in
   * this library names a control step, and one word meaning two things across a
   * component library is the defect decision 020 found in v0's three names for
   * a variant.
   */
  packageSize?: ReactNode

  /**
   * Where the product page is. Rendered as a real `<a>` wrapping the name.
   *
   * A link, not a click handler on the card. Decision 024: this component is a
   * container, and the things inside it are independently reachable. A card
   * that navigates on click takes the middle-click, the copy-link, the
   * open-in-new-tab and the status-bar preview away from everybody and gives
   * nothing back.
   */
  href: string

  /**
   * The product image. A node rather than a `src`, so a consumer can hand over
   * whatever their image pipeline produces — a plain `<img>`, a framework's
   * optimised component, or nothing.
   *
   * Alt text is the caller's, and deliberately: this component cannot know
   * whether the image adds information the name does not already carry. Where
   * it does not — the usual case in a grid where the name is right there — the
   * correct alt is empty, and a component that invented one would be adding
   * noise to every card in the list.
   */
  image?: ReactNode

  /**
   * The current price, already formatted by the boundary in
   * `content/rules/rtl-arabic.md` §4 — symbol placed by `Intl`, Western digits
   * in both locales, the currency's own minor-unit count. Never a number: v0
   * writes `'AED ' + price.toFixed(2)`, which is the concatenation §4 exists to
   * end.
   */
  price: ReactNode

  /**
   * What it used to cost, when it is on offer. Struck through *and* labelled —
   * §2 records that `line-through` is drawn across the glyphs with no property
   * that will move it, so the strike cannot be the only thing carrying the
   * meaning. `wasPriceLabel` is the other half.
   */
  wasPrice?: ReactNode

  /**
   * The accessible name for `wasPrice` — "Was", "كان". Rendered visually hidden
   * beside the struck price.
   *
   * Required whenever `wasPrice` is given, and the reason is in §2: a struck
   * price read aloud is just a second number, and a screen-reader user hearing
   * "AED 12.50, AED 9.99" has no way to tell which one they pay.
   */
  wasPriceLabel?: ReactNode

  /**
   * The discount, already formatted — "-20%". Painted in `commerce.discount`,
   * which this component may name because decision 024 kept it Market's.
   */
  discount?: ReactNode

  /** The unit price — "AED 4.20 per kg". Formatted, like every other number. */
  unitPrice?: ReactNode

  /** How much is left. Defaults to `'in'`. */
  stockLevel?: StockLevel

  /** What to call the stock state. The words are the catalogue's. */
  stockLabel?: ReactNode

  /** The delivery estimate — "Get it tomorrow". Formatted. */
  delivery?: ReactNode

  /**
   * The label on the action. Required when `onAddToCart` is given — a button
   * with no accessible name is not a button, and there is no default here
   * because a default would be an English string in a component that ships
   * Arabic.
   */
  addToCartLabel?: ReactNode

  /** Add to cart. Omit it and the card renders with no action at all. */
  onAddToCart?: () => void
}

/**
 * Market's product card — **a container, not a control**.
 *
 * ## What it is
 *
 * An `<article>` holding a link and an action, each independently focusable.
 * There is no click handler on the box.
 *
 * ## Why it is not `RideCard` with a variant
 *
 * [Decision 024](../../../../decisions/024-productcard-and-ridecard-stay-separate.md),
 * and the argument is structural rather than aesthetic: **a radio may not
 * contain a button.** Move's ride card is one option in an exclusive choice —
 * a radio, whose whole surface is the target. This card contains a link to the
 * product and a button that adds it to a cart, which are two tab stops that a
 * radio has nowhere to put. A `variant` prop would be selecting between a
 * container and a control that happen to share a border radius.
 *
 * ## What it drops from v0
 *
 * - **The "Quick view" overlay.** A `<div onClick>` stacked over the image,
 *   counted by the Stage 1 audit among the 24 keyboard-unreachable elements —
 *   8 of them, one per product in the grid. A screen that wants quick view can
 *   put a real control there.
 * - **The title concatenation**, which scrambled Arabic names in one card out
 *   of eight.
 * - **`opacity: 0.5` for the out-of-stock state**, which renders a colour no
 *   token declares.
 *
 * @example A product on offer, in a grid
 * ```tsx
 * <ProductCard
 *   name="Almarai Fresh Milk"
 *   packageSize="2 L"
 *   href="/market/product/almarai-milk-2l"
 *   price="AED 9.99"
 *   wasPrice="AED 12.50"
 *   wasPriceLabel="Was"
 *   discount="-20%"
 *   unitPrice="AED 5.00 per L"
 *   stockLevel="low"
 *   stockLabel="Only 3 left"
 *   delivery="Get it tomorrow"
 *   addToCartLabel="Add to cart"
 *   onAddToCart={() => add('almarai-milk-2l')}
 * />
 * ```
 */
export function ProductCard({
  name,
  packageSize,
  href,
  image,
  price,
  wasPrice,
  wasPriceLabel,
  discount,
  unitPrice,
  stockLevel = 'in',
  stockLabel,
  delivery,
  addToCartLabel,
  onAddToCart
}: ProductCardProps) {
  const outOfStock = stockLevel === 'out'

  return (
    <article className="mz-product-card">
      <div className="mz-product-card__media">
        {image}
        {discount ? (
          /*
            The badge sits over the media, positioned with logical insets so it
            moves to the reading-start corner in Arabic without this file naming
            a side. It is not aria-hidden: a discount is information, and the
            price row alone does not say how big the saving is.
          */
          <span className="mz-product-card__discount">{discount}</span>
        ) : null}
      </div>

      <div className="mz-product-card__body">
        <h3 className="mz-product-card__heading">
          {/*
            A real heading with a real link inside it. The heading level is
            fixed at 3 rather than exposed as a prop, and that is a decision
            with a cost: a card in a grid under an <h2> section title is right,
            and a card used somewhere else may not be. Exposing `as` or `level`
            would let a call site produce a document outline that skips levels,
            which is the more common failure — and the fix, if a screen needs
            it, is a heading-level context rather than a prop on every card.
          */}
          <a className="mz-product-card__link mz-focus-ring" href={href}>
            {name}
          </a>
        </h3>

        {/*
          The package size is its own element, never joined to the name. This
          is the audit's bidi finding made structural: two nodes cannot be
          concatenated into one scrambled string.
        */}
        {packageSize ? (
          <p className="mz-product-card__package-size">{packageSize}</p>
        ) : null}

        <p className="mz-product-card__prices">
          <span className="mz-product-card__price">{price}</span>
          {wasPrice ? (
            <span className="mz-product-card__was">
              {/*
                The label is visually hidden and read aloud. §2: line-through is
                drawn across the glyphs and no property will move it, so the
                strike cannot be the only carrier of the meaning — and read
                aloud, an unlabelled struck price is just a second number.
              */}
              {wasPriceLabel ? (
                <span className="mz-product-card__visually-hidden">{wasPriceLabel} </span>
              ) : null}
              <s>{wasPrice}</s>
            </span>
          ) : null}
        </p>

        {unitPrice ? <p className="mz-product-card__unit">{unitPrice}</p> : null}

        {stockLabel ? (
          <p className="mz-product-card__stock" data-level={stockLevel}>
            {stockLabel}
          </p>
        ) : null}

        {delivery ? <p className="mz-product-card__delivery">{delivery}</p> : null}

        {onAddToCart && addToCartLabel ? (
          <div className="mz-product-card__action">
            {/*
              The first time a Mizan component contains another one. Button
              brings its own size step, its own focus indicator and its own
              disabled semantics — this card decides only that the action
              exists and what disables it.
            */}
            <Button variant="primary" fullWidth disabled={outOfStock} onClick={onAddToCart}>
              {addToCartLabel}
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  )
}
