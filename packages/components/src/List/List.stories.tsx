import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { ProductCard } from '../ProductCard'
import { List, ListItem } from './List'

/**
 * # List
 *
 * The smallest component in the library, and the one with the narrowest reason
 * to exist.
 *
 * ## What v0 has instead
 *
 * Five mapped collections and **not one `<ul>`**. The cart lines, the product
 * grid and the filter row are all bare `<div>`s; the only semantic list in the
 * whole application is the developer index on the home screen. A screen-reader
 * user is told nothing about how many things there are, or where they are among
 * them.
 *
 * ## Why a component rather than "just write a `<ul>`"
 *
 * Because of one line of CSS that every styled list needs, and that silently
 * removes the semantics it was styling:
 *
 * ```css
 * ul { list-style: none }
 * ```
 *
 * WebKit is documented as dropping the implicit `list` role when the markers go
 * — the reasoning being that a list without markers was probably not meant as
 * one — so a list styled the way every design system styles it is announced as
 * a run of ordinary text. `role="list"` restores it, and is inert in engines
 * that never removed it.
 *
 * **Said as received, not as measured:** this was developed against Chromium,
 * which keeps the role either way, so the behaviour being guarded against could
 * not be reproduced here. That is exactly why the attribute is unconditional
 * rather than behind an engine check — it costs nothing where it is
 * unnecessary, and the failure it prevents is invisible to everyone who cannot
 * hear it.
 *
 * One platform trap, fixed once. That is the whole argument.
 */
const meta = {
  title: 'Components/List',
  component: List,
  parameters: {
    layout: 'centered'
  },
  argTypes: {
    ordered: { control: 'boolean' },
    dividers: { control: 'boolean' },
    label: { control: 'text' },
    children: { control: false }
  },
  // `children` is required on the props type, so it has to be present in args
  // even though every story below supplies its own rows through `render`.
  args: {
    children: null
  }
} satisfies Meta<typeof List>

export default meta
type Story = StoryObj<typeof meta>

const SAVED_ADDRESSES = [
  'Home — Villa 12, Al Wasl Road, Dubai',
  'Work — Emaar Square, Building 3, Dubai',
  'Mum — Al Nahda 2, Sharjah'
]

/**
 * Three rows, no dividers.
 *
 * There is nothing to see, which is the point: a list that looks like a stack
 * of text is exactly what one should look like. What changed is what a screen
 * reader says about it.
 */
export const Default: Story = {
  render: (args) => (
    <div style={{ inlineSize: '24rem' }}>
      <List {...args}>
        {SAVED_ADDRESSES.map((address) => (
          <ListItem key={address}>{address}</ListItem>
        ))}
      </List>
    </div>
  )
}

/**
 * **The story that proves the component.**
 *
 * `list-style: none` is applied — it is on `.mz-list` in the stylesheet — and
 * the role survives anyway, because it is written explicitly. The play function
 * asserts the role and the item count, which is the pair a screen reader turns
 * into *"list, 3 items"*.
 *
 * Run this against a build that removed `role="list"` and it still passes in
 * Chromium. That is not a weakness of the test — it is the reason the attribute
 * is unconditional, and the reason this is a component rather than a habit.
 */
export const SemanticsSurviveTheStyling: Story = {
  render: (args) => (
    <div style={{ inlineSize: '24rem' }}>
      <List {...args} label="Saved addresses">
        {SAVED_ADDRESSES.map((address) => (
          <ListItem key={address}>{address}</ListItem>
        ))}
      </List>
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    const list = canvas.getByRole('list', { name: 'Saved addresses' })

    await step('the markers are removed by the stylesheet', async () => {
      await expect(getComputedStyle(list).listStyleType).toBe('none')
    })

    await step('and it is still a list, with its rows still counted', async () => {
      await expect(list.tagName).toBe('UL')
      await expect(within(list).getAllByRole('listitem')).toHaveLength(3)
    })
  }
}

/**
 * Dividers, drawn on the rows rather than on the list.
 *
 * `border-block-start` on every row *after the first*, so the line belongs to
 * the row below it and there is never a trailing rule under the last one —
 * which is what `border-block-end` on every row produces, and what makes a list
 * look unfinished.
 *
 * It is the block axis, so `dir` does not touch it and there is nothing here to
 * mirror. `border.default` is the token whose own description names this use:
 * *"a card outline, a divider between list rows"*.
 */
export const WithDividers: Story = {
  args: { dividers: true },
  render: (args) => (
    <div style={{ inlineSize: '24rem' }}>
      <List {...args}>
        {SAVED_ADDRESSES.map((address) => (
          <ListItem key={address}>{address}</ListItem>
        ))}
      </List>
    </div>
  )
}

/**
 * Ordered, where the position is part of what the row means.
 *
 * The test for `ordered` is not "are these in an order" — everything on a
 * screen is. It is whether the **number** is information. Checkout steps are;
 * a cart is not, and an `<ol>` there would tell a screen-reader user "item 3 of
 * 7" about a position the user has never thought about.
 */
export const Ordered: Story = {
  args: { ordered: true },
  render: (args) => (
    <div style={{ inlineSize: '24rem' }}>
      <List {...args}>
        <ListItem>Choose a delivery window</ListItem>
        <ListItem>Confirm your address</ListItem>
        <ListItem>Pay</ListItem>
      </List>
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    await step('an ordered list is an <ol>, and still role=list', async () => {
      const list = canvas.getByRole('list')
      await expect(list.tagName).toBe('OL')
    })
  }
}

/**
 * Holding components rather than strings — the cart, as it should have been.
 *
 * The rows carry no styling of their own. That is deliberate: a `ProductCard`
 * already decides its own padding, ground and border, and a List that styled
 * its rows would be a second opinion about every one of them — the kind whose
 * first feature request is a way to switch it off.
 */
export const HoldingCards: Story = {
  args: { label: 'Your cart' },
  render: (args) => (
    <div style={{ inlineSize: '20rem' }}>
      <List {...args}>
        <ListItem>
          <ProductCard
            name="Almarai Fresh Milk"
            packageSize="2 L"
            href="#"
            price="AED 9.99"
            unitPrice="AED 5.00 per L"
            delivery="Get it tomorrow"
          />
        </ListItem>
        <ListItem>
          <ProductCard
            name="Al Ain Water"
            packageSize="6 × 1.5 L"
            href="#"
            price="AED 12.00"
            unitPrice="AED 1.33 per L"
            stockLevel="low"
            stockLabel="Only 3 left"
          />
        </ListItem>
      </List>
    </div>
  )
}

/**
 * Arabic, right to left.
 *
 * Nothing in this component has a direction to get wrong, and that is worth
 * seeing rather than asserting. The stack is a **block-axis** grid and the
 * divider is a `border-block-start` — the block axis is the one `dir` does not
 * touch — so the only thing that flips is the text inside the rows, which is
 * the browser's doing and not this component's.
 */
export const Arabic: Story = {
  args: { dividers: true, label: 'العناوين المحفوظة' },
  render: (args) => (
    <div style={{ inlineSize: '24rem' }}>
      <List {...args}>
        <ListItem>المنزل — فيلا ١٢، شارع الوصل، دبي</ListItem>
        <ListItem>العمل — إعمار سكوير، مبنى ٣، دبي</ListItem>
        <ListItem>والدتي — النهدة ٢، الشارقة</ListItem>
      </List>
    </div>
  ),
  globals: { direction: 'rtl', language: 'ar' }
}
