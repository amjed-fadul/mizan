import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { ProductCard } from './ProductCard'

/**
 * # ProductCard
 *
 * Market's product tile — **a container, not a control**, which is the whole of
 * [decision 024](../../../../decisions/024-productcard-and-ridecard-stay-separate.md).
 *
 * It holds a link to the product and a button that adds it to a cart: two tab
 * stops, independently reachable. Move's `RideCard` is one option in an
 * exclusive choice — a radio, whose whole surface is the target. A radio may
 * not contain a button, so no `variant` prop bridges these two, and the refusal
 * is structural rather than a matter of taste.
 *
 * ## What it drops from v0
 *
 * - **The "Quick view" overlay** — a `<div onClick>` stacked over the image,
 *   counted by the Stage 1 audit among the 24 keyboard-unreachable elements,
 *   8 of them, one per product in the grid.
 * - **The title concatenation.** v0 renders `product.name + ' - ' + product.size`
 *   at three call sites. The audit's finding on it is the sharpest sentence in
 *   the whole document: *"Every Arabic product name renders correctly on its
 *   own. It is the concatenation that scrambles them. Seven of eight cards look
 *   right and one is wrong, which is exactly why this survives review."* The
 *   **Arabic** story below is that fix, visible.
 * - **`width: 240px`** in an inline style, and `opacity: 0.5` for out of stock.
 */
const meta = {
  title: 'Components/ProductCard',
  component: ProductCard,
  parameters: {
    layout: 'centered'
  },
  argTypes: {
    name: { control: 'text' },
    packageSize: { control: 'text' },
    price: { control: 'text' },
    wasPrice: { control: 'text' },
    discount: { control: 'text' },
    unitPrice: { control: 'text' },
    stockLevel: { control: 'inline-radio', options: ['in', 'low', 'out'] },
    stockLabel: { control: 'text' },
    delivery: { control: 'text' },
    addToCartLabel: { control: 'text' },
    image: { control: false },
    onAddToCart: { action: 'added to cart' }
  },
  args: {
    name: 'Almarai Fresh Milk',
    packageSize: '2 L',
    href: '/market/product/almarai-milk-2l',
    price: 'AED 9.99',
    delivery: 'Get it tomorrow',
    addToCartLabel: 'Add to cart',
    onAddToCart: fn()
  },
  decorators: [
    (Story) => (
      <div style={{ inlineSize: '17rem' }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof ProductCard>

export default meta
type Story = StoryObj<typeof meta>

/** A product at its ordinary price, in stock. */
export const Default: Story = {}

/**
 * On offer — and the struck price is **labelled as well as struck**.
 *
 * §2 of the RTL rules is why. `line-through` is drawn across whatever glyphs are
 * there and there is no property that will move it, so a struck price cannot be
 * the only carrier of its own meaning. Read aloud it is worse: without the
 * label, a screen-reader user hears "AED 9.99, AED 12.50" and has no way to
 * know which one they pay. `wasPriceLabel` is rendered visually hidden beside
 * the strike.
 *
 * The discount badge is `commerce.discount`, which this component may name
 * because decision 024 kept it Market's — a shared card would have had to take
 * the colour as a prop.
 */
export const OnOffer: Story = {
  args: {
    price: 'AED 9.99',
    wasPrice: 'AED 12.50',
    wasPriceLabel: 'Was',
    discount: '-20%',
    unitPrice: 'AED 5.00 per L'
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)

    await step('the old price is announced as the old price', async () => {
      // getByText with an exact string would miss it — the label and the amount
      // are two elements, which is the point. This asks the accessible way.
      const was = canvas.getByText(/AED 12\.50/)
      await expect(was.closest('.mz-product-card__was')).toHaveTextContent('Was')
    })
  }
}

/**
 * Low stock, and the token doing the job it was declared for.
 *
 * `commerce.stock.low` is declared in `pairs.json` at the **3.0 indicator bar**
 * and sits at 4.29:1 in every mode combination — which clears 4.5 nowhere. So
 * it marks the line and does not set it: a hairline down the reading-start edge,
 * with the words in `text.secondary`.
 *
 * That split is here because `RideCard` shipped the other version of it first —
 * a whole sentence painted in `mobility.surge` at 3.87:1 in dark — and axe
 * caught it. The gate could not: `check-contrast.mjs` verifies every *declared*
 * pairing in the context it was declared in, and cannot see a component using a
 * token in a different context from the one it was declared for.
 */
export const LowStock: Story = {
  args: {
    stockLevel: 'low',
    stockLabel: 'Only 3 left'
  }
}

/**
 * Out of stock. Not red, not faded.
 *
 * The words say it and the action is disabled, which says it to everybody
 * including a colour-blind user and a screen-reader user. v0 uses
 * `opacity: 0.5`, which renders a colour no token declares and therefore a
 * contrast ratio the gate cannot see — and `Button`'s disabled state is already
 * a declared token pair, so this card gets that for free by composing it.
 */
export const OutOfStock: Story = {
  args: {
    stockLevel: 'out',
    stockLabel: 'Out of stock'
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)

    await step('the action is disabled through the platform attribute', async () => {
      const button = canvas.getByRole('button', { name: 'Add to cart' })
      await expect(button).toBeDisabled()
    })

    await step('and the link still works — the product is still browsable', async () => {
      const link = canvas.getByRole('link', { name: /Almarai/ })
      await expect(link).toHaveAttribute('href')
    })
  }
}

/**
 * **The card with no action at all**, which is the story that proves this is a
 * container rather than a control.
 *
 * Omit `onAddToCart` and the button is not rendered. The card is still a card:
 * the title still links, the facts still read. A `RideCard` with its radio
 * removed would be nothing — that is the difference decision 024 is built on,
 * and it is visible here rather than only argued.
 */
export const NoAction: Story = {
  args: {
    onAddToCart: undefined,
    addToCartLabel: undefined
  }
}

/**
 * **Two tab stops, and this is the whole refusal made testable.**
 *
 * The play function tabs through the card and finds a link and then a button.
 * A radio has exactly one tab stop and nowhere to put a second — so a component
 * that must produce this cannot also be `RideCard`, whatever prop is added to
 * it.
 */
export const TwoTabStops: Story = {
  args: {
    discount: '-20%',
    wasPrice: 'AED 12.50',
    wasPriceLabel: 'Was'
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)

    await step('the title is a real link, not a click handler on the box', async () => {
      const link = canvas.getByRole('link', { name: /Almarai/ })
      await expect(link).toHaveAttribute('href', '/market/product/almarai-milk-2l')
    })

    await step('the action is a real button', async () => {
      await expect(canvas.getByRole('button', { name: 'Add to cart' })).toBeEnabled()
    })

    await step('and the card itself is not interactive', async () => {
      // An <article> with no role, no tabindex and no handler. If this ever
      // starts failing, someone has made the box clickable and taken the
      // middle-click, the copy-link and the open-in-new-tab away with it.
      const card = canvasElement.querySelector('.mz-product-card')
      await expect(card?.tagName).toBe('ARTICLE')
      await expect(card).not.toHaveAttribute('tabindex')
      await expect(card).not.toHaveAttribute('role')
    })
  }
}

/**
 * **Arabic, and the defect the audit found.**
 *
 * v0 renders `product.name + ' - ' + product.size`, and the audit's note is
 * exact: the name is fine on its own, the concatenation is what scrambles it,
 * and seven of eight cards look right — which is why nobody caught it.
 *
 * Here the name and the package size are two props rendered as two elements.
 * There is no string to scramble, so the fix is structural rather than a
 * `<bdi>` applied after the fact.
 *
 * The prices arrive already formatted by §4's one boundary: symbol placed by
 * `Intl` rather than concatenated, Western digits in both locales, and the
 * currency's own minor-unit count.
 */
export const Arabic: Story = {
  args: {
    name: 'حليب المراعي الطازج',
    packageSize: '٢ لتر',
    price: '9.99 د.إ',
    wasPrice: '12.50 د.إ',
    wasPriceLabel: 'كان',
    discount: '-٢٠٪',
    unitPrice: '5.00 د.إ لكل لتر',
    stockLevel: 'low',
    stockLabel: 'بقي ٣ فقط',
    delivery: 'احصل عليه غدًا',
    addToCartLabel: 'أضف إلى السلة'
  },
  globals: { direction: 'rtl', language: 'ar' }
}

/**
 * A grid of them, which is how a product card is actually met.
 *
 * The card takes no width — §6 says a component does not take one, and v0's
 * `ProductCard` hard-codes `width: 240px` in an inline style, which is that
 * exact prop arriving as a style object. Each card fills its grid cell, and the
 * cards in a row are different heights only if their content differs.
 */
export const Grid: Story = {
  decorators: [
    (Story) => (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 15rem)',
          gap: '1rem',
          alignItems: 'start'
        }}
      >
        <Story />
        <ProductCard
          name="Barilla Spaghetti No. 5"
          packageSize="500 g"
          href="/market/product/barilla-spaghetti"
          price="AED 7.25"
          unitPrice="AED 14.50 per kg"
          delivery="Get it tomorrow"
          addToCartLabel="Add to cart"
          onAddToCart={fn()}
        />
        <ProductCard
          name="Nescafé Gold Instant Coffee"
          packageSize="200 g"
          href="/market/product/nescafe-gold"
          price="AED 34.00"
          wasPrice="AED 42.00"
          wasPriceLabel="Was"
          discount="-19%"
          stockLevel="out"
          stockLabel="Out of stock"
          addToCartLabel="Add to cart"
          onAddToCart={fn()}
        />
      </div>
    )
  ]
}
