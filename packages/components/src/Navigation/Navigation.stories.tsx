import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Navigation, NavigationItem } from './Navigation'

/**
 * # Navigation
 *
 * The way around a product — a `<nav>` landmark holding a list of destinations.
 *
 * ## What v0 has instead
 *
 * A pipe-separated row of links, **copy-pasted into five screens**:
 *
 * ```tsx
 * <Link to="/">Home</Link> | <Link to="/market">Grocery</Link> |{' '}
 * <Link to="/market/cart">Cart</Link> | <Link to="/move">Mizan Move</Link>
 * ```
 *
 * Three defects, none cosmetic:
 *
 * - **No `<nav>` anywhere in the application.** Not one landmark, so a
 *   screen-reader user can neither jump to the navigation nor skip past it.
 * - **No `aria-current`, anywhere.** Nothing marks the current page in any of
 *   the five copies — so "where am I" has no answer at all.
 * - **The separator is a literal `|`.** It is *content*, so it is announced;
 *   and it is a Unicode-**neutral** character, so under the bidirectional
 *   algorithm it reorders with its surroundings in Arabic rather than staying
 *   between two things.
 *
 * ## Why this is one component when the cards were two
 *
 * [Decision 024](../../../../decisions/024-productcard-and-ridecard-stay-separate.md)
 * refused to merge `ProductCard` and `RideCard` and wrote down the test. This is
 * the same test giving the opposite answer, which is the point of having one:
 *
 * | | ProductCard vs RideCard | Market nav vs Move nav |
 * |---|---|---|
 * | What element is it? | container vs **control** | landmark, **both** |
 * | How many tab stops? | several vs **one** | one per destination, **both** |
 * | Does the other product have it? | **no** | **yes** |
 *
 * Three matching answers, so one component. The links differ; the thing does
 * not.
 */
const meta = {
  title: 'Components/Navigation',
  component: Navigation,
  parameters: {
    layout: 'centered'
  },
  argTypes: {
    label: { control: 'text' },
    separators: { control: 'boolean' },
    children: { control: false }
  },
  args: {
    label: 'Main',
    children: null
  }
} satisfies Meta<typeof Navigation>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Market's navigation, as v0's five copies should have been.
 *
 * The current page is "Grocery" — lifted to `text.primary`, ruled underneath in
 * `action.primary`, and carrying `aria-current="page"`. Three signals, because
 * colour alone fails WCAG 1.4.1 and because hover uses the same two tokens, so
 * colour alone would make "where I am" and "where my pointer is" identical.
 */
export const Default: Story = {
  render: (args) => (
    <Navigation {...args}>
      <NavigationItem href="/market" current>
        Grocery
      </NavigationItem>
      <NavigationItem href="/market/cart">Cart</NavigationItem>
      <NavigationItem href="/move">Mizan Move</NavigationItem>
    </Navigation>
  )
}

/**
 * **The story that proves the component.**
 *
 * Three things v0 does not have, asserted rather than described: a landmark
 * with a name, a list whose items are counted, and exactly one item marked as
 * the current page.
 *
 * Note what `aria-current` is set to. It is `page`, not `true` — `true` is the
 * generic fallback for a currency the vocabulary has no word for, and a
 * navigation always has the word. And it is *absent* on the other items rather
 * than `false`, because `aria-current="false"` is a stated claim that this is
 * not the current page, repeated on every other destination.
 */
export const LandmarkAndCurrentPage: Story = {
  render: (args) => (
    <Navigation {...args}>
      <NavigationItem href="/market" current>
        Grocery
      </NavigationItem>
      <NavigationItem href="/market/cart">Cart</NavigationItem>
      <NavigationItem href="/move">Mizan Move</NavigationItem>
    </Navigation>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)

    await step('there is a navigation landmark, and it has a name', async () => {
      const nav = canvas.getByRole('navigation', { name: 'Main' })
      await expect(nav).toBeTruthy()
    })

    await step('the destinations are a counted list', async () => {
      await expect(canvas.getAllByRole('listitem')).toHaveLength(3)
    })

    await step('exactly one is the current page, and it says page', async () => {
      const current = canvas.getByRole('link', { current: 'page' })
      await expect(current).toHaveTextContent('Grocery')
      await expect(current).toHaveAttribute('aria-current', 'page')
    })

    await step('and the others make no claim at all', async () => {
      const cart = canvas.getByRole('link', { name: 'Cart' })
      await expect(cart).not.toHaveAttribute('aria-current')
    })
  }
}

/**
 * Separators, replacing v0's `|`.
 *
 * A `border-inline-start` on every item after the first — a box decoration
 * rather than content, so it is invisible to a screen reader; and on the
 * **inline** axis, so it moves to the other side of the item in Arabic with
 * nothing in the stylesheet naming a side.
 *
 * Flip the toolbar to RTL and watch the rules move without the markup changing.
 */
export const WithSeparators: Story = {
  args: { separators: true },
  render: (args) => (
    <Navigation {...args}>
      <NavigationItem href="/" >Home</NavigationItem>
      <NavigationItem href="/market" current>
        Grocery
      </NavigationItem>
      <NavigationItem href="/market/cart">Cart</NavigationItem>
      <NavigationItem href="/move">Mizan Move</NavigationItem>
    </Navigation>
  )
}

/**
 * Move's navigation — the same component, different destinations.
 *
 * Switch the product toolbar between Market and Move. The current-page rule is
 * `action.primary`, a *shared* semantic that resolves per product, so it is
 * Market's green at `product=market` and Move's blue at `product=move` — with
 * no product named anywhere in this component or its stylesheet.
 */
export const MoveDestinations: Story = {
  render: (args) => (
    <Navigation {...args} label="Main">
      <NavigationItem href="/">Home</NavigationItem>
      <NavigationItem href="/move" current>
        Book a ride
      </NavigationItem>
      <NavigationItem href="/move/trip">Active trip</NavigationItem>
      <NavigationItem href="/market">Mizan Market</NavigationItem>
    </Navigation>
  )
}

/**
 * Two landmarks on one page, which is why `label` is required.
 *
 * A screen-reader user listing the landmarks of a page hears "navigation,
 * navigation" unless each one says which it is. Neither label contains the word
 * *navigation*, because the role already says it — `label="Main navigation"` is
 * announced as "Main navigation navigation".
 */
export const TwoLandmarks: Story = {
  render: (args) => (
    <div style={{ display: 'grid', gap: '2rem' }}>
      <Navigation {...args} label="Main">
        <NavigationItem href="/market" current>
          Grocery
        </NavigationItem>
        <NavigationItem href="/market/cart">Cart</NavigationItem>
      </Navigation>
      <Navigation {...args} label="Account">
        <NavigationItem href="/orders">Orders</NavigationItem>
        <NavigationItem href="/addresses">Addresses</NavigationItem>
      </Navigation>
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    await step('both landmarks are reachable by their own name', async () => {
      await expect(canvas.getByRole('navigation', { name: 'Main' })).toBeTruthy()
      await expect(canvas.getByRole('navigation', { name: 'Account' })).toBeTruthy()
    })
  }
}

/**
 * Arabic, right to left, with separators — the case v0's `|` cannot survive.
 *
 * Everything that moves here is derived. The row is flex, so it flips; the
 * separator is `border-inline-start`, so it changes side; the current-page rule
 * is `border-block-end`, so it stays underneath. Not one physical direction is
 * written in the stylesheet.
 *
 * The Latin destination in the middle of Arabic labels is deliberate: "Mizan
 * Market" is a brand name and stays as it is, which is the ordinary case in
 * this market rather than an edge case.
 */
export const Arabic: Story = {
  args: { separators: true, label: 'الرئيسية' },
  render: (args) => (
    <Navigation {...args}>
      <NavigationItem href="/">الرئيسية</NavigationItem>
      <NavigationItem href="/market" current>
        البقالة
      </NavigationItem>
      <NavigationItem href="/market/cart">السلة</NavigationItem>
      <NavigationItem href="/move">Mizan Move</NavigationItem>
    </Navigation>
  ),
  globals: { direction: 'rtl', language: 'ar' }
}
