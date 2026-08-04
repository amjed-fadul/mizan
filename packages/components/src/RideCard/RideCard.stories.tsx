import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { RideCard, RideCardGroup } from './RideCard'

/**
 * The four options Move's booking screen actually offers, taken from v0's
 * `RIDE_OPTIONS` so the comparison is like for like.
 *
 * Every string is pre-formatted, which is the API decision worth noticing: this
 * component takes `eta` and `capacity` as nodes rather than numbers. v0 writes
 * `etaMinutes + ' min away'` and `seats + ' seats'` with a hand-written special
 * case for `1 seat` — a two-category plural rule in a product that ships a
 * language with six, including a dual. `content/rules/rtl-arabic.md` §4 puts
 * every number behind one formatting boundary and records duration formatting
 * as blocked on a string catalogue; these props take what that boundary made.
 */
const OPTIONS = [
  {
    value: 'economy',
    vehicle: 'Toyota Yaris',
    rideType: 'Economy',
    eta: '3 min away',
    fare: 'AED 24.00',
    capacity: '4 seats'
  },
  {
    value: 'comfort',
    vehicle: 'Toyota Camry',
    rideType: 'Comfort',
    eta: '5 min away',
    fare: 'AED 38.00',
    capacity: '4 seats',
    surgeNote: 'Higher demand in your area right now'
  },
  {
    value: 'xl',
    vehicle: 'Hyundai Staria',
    rideType: 'XL',
    eta: '8 min away',
    fare: 'AED 52.00',
    capacity: '6 seats'
  },
  {
    value: 'electric',
    vehicle: 'Tesla Model 3',
    rideType: 'Electric',
    eta: '11 min away',
    fare: 'AED 41.00',
    capacity: '4 seats'
  }
]

/**
 * # RideCard
 *
 * Move's ride option. **A radio in a group**, not a card that happens to be
 * clickable — and that is the entire point of
 * [decision 024](../../../../decisions/024-productcard-and-ridecard-stay-separate.md),
 * which refused to merge this with Market's `ProductCard` because a radio may
 * not contain a button and a product card contains one.
 *
 * ## What this replaces
 *
 * v0's `RideCard` is a `<div onClick>` rendered four times on the booking
 * screen. The Stage 1 audit counted it as **4 of the 24 keyboard-unreachable
 * elements** in the whole app, with the note that *a keyboard user cannot
 * change from the Economy default*. The ride selector is the screen, and it
 * could not be operated without a pointer.
 *
 * The story to run is **Keyboard**. It selects a different ride using only
 * arrow keys, which is the thing v0 cannot do.
 *
 * **Use the toolbar, and notice what the product control does.** The chosen
 * card's border is `action.primary`, which is a *shared* semantic resolving per
 * product — so it renders Move's blue at `product=move` and Market's green at
 * `product=market`. Measured: `#1a6fb5` against `#2a7454`.
 *
 * The green is a combination this component will never actually ship in, since
 * a Move screen is always `product=move`, and it is worth understanding rather
 * than hiding. It is what a shared semantic looks like inside a
 * product-specific component: the mode system resolves every token in every
 * combination whether or not a screen exists for it, which is the same property
 * that lets `check-contrast.mjs` gate all four. The surge note is the opposite
 * case — `mobility.surge` is Move's own token, resolved by theme alone, so it
 * is `#a8620a` in both.
 */
const meta = {
  title: 'Components/RideCard',
  component: RideCard,
  parameters: {
    layout: 'centered'
  },
  argTypes: {
    vehicle: { control: 'text' },
    rideType: { control: 'text' },
    eta: { control: 'text' },
    fare: { control: 'text' },
    capacity: { control: 'text' },
    surgeNote: { control: 'text' },
    fareBasis: { control: 'inline-radio', options: ['estimate', 'settled'] },
    disabled: { control: 'boolean' },
    onChange: { action: 'chosen' }
  },
  args: {
    ...OPTIONS[0],
    onChange: fn()
  }
} satisfies Meta<typeof RideCard>

export default meta
type Story = StoryObj<typeof meta>

function Group({ initial = 'economy' }: { initial?: string }) {
  const [ride, setRide] = useState(initial)
  return (
    <div style={{ inlineSize: '22rem' }}>
      <RideCardGroup label="Choose a ride" value={ride} onChange={setRide}>
        {OPTIONS.map((option) => (
          <RideCard key={option.value} {...option} />
        ))}
      </RideCardGroup>
    </div>
  )
}

/**
 * One option on its own, so the anatomy is readable. In practice a ride card is
 * never alone — a choice of one is not a choice — and every other story shows
 * the group.
 */
export const Single: Story = {
  decorators: [
    (Story) => (
      <div style={{ inlineSize: '22rem' }}>
        <RideCardGroup label="Choose a ride" name="single">
          <Story />
        </RideCardGroup>
      </div>
    )
  ]
}

/**
 * The real thing: four options, one chosen, inside a `<fieldset>` whose
 * `<legend>` is the question.
 *
 * The legend is not decoration. A radio group with no accessible name leaves a
 * screen-reader user hearing *"Economy, radio button, 1 of 4"* with nothing
 * saying what is being chosen. v0 has no equivalent — its four cards sit in a
 * bare `div`, so the question exists on screen as a heading and not in the
 * accessibility tree at all.
 */
export const Group_: Story = {
  name: 'Group',
  render: () => <Group />
}

/**
 * **The story that matters.** Selecting a ride with the keyboard alone.
 *
 * The play function tabs to the group and presses the down arrow twice. That is
 * four lines of test and the entire difference between this component and the
 * one it replaces: v0's `<div onClick>` has no tab stop, no key handler, and no
 * way to change the selection without a pointer.
 *
 * Nothing here implements any of it. One tab stop for the group, arrow-key
 * movement, the roving focus and `aria-checked` all come from using a real
 * `<input type="radio">` — which is the argument for the platform over
 * `role="radio"` and a key handler, made as a test rather than as a paragraph.
 */
export const Keyboard: Story = {
  render: () => <Group />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    const economy = canvas.getByRole('radio', { name: /Toyota Yaris/ })
    const comfort = canvas.getByRole('radio', { name: /Toyota Camry/ })
    const xl = canvas.getByRole('radio', { name: /Hyundai Staria/ })

    await step('the group is one tab stop, landing on the chosen option', async () => {
      await userEvent.tab()
      await expect(economy).toHaveFocus()
    })

    await step('an arrow key moves to the next option and chooses it', async () => {
      await userEvent.keyboard('{ArrowDown}')
      await expect(comfort).toBeChecked()
      await expect(economy).not.toBeChecked()
    })

    await step('and again — this is what v0 could not do at all', async () => {
      await userEvent.keyboard('{ArrowDown}')
      await expect(xl).toBeChecked()
    })
  }
}

/**
 * The surge note, in `mobility.surge`.
 *
 * This is the first component in the library allowed to name a
 * product-namespaced token, and the permission is a *consequence* of decision
 * 024 rather than a convenience: keeping this component Move's — instead of
 * merging it into a shared `Card` — is exactly what lets it reach `mobility.*`.
 * A shared component may not, under
 * [007](../../../../decisions/007-modes-for-shared-namespaces-for-unique.md),
 * and would have had to take the colour as a prop or expose a slot for the
 * whole note. Both are a product's identity written into shared code under
 * another name.
 *
 * The note is linked with `aria-describedby`, so a rider choosing this option
 * is told it is surging *while they are on it* rather than after.
 */
export const Surge: Story = {
  render: () => (
    <div style={{ inlineSize: '22rem' }}>
      <RideCardGroup label="Choose a ride" value="comfort">
        {OPTIONS.slice(0, 2).map((option) => (
          <RideCard key={option.value} {...option} />
        ))}
      </RideCardGroup>
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    const comfort = canvas.getByRole('radio', { name: /Toyota Camry/ })

    await step('the surge note describes the option, not merely sits near it', async () => {
      const describedBy = comfort.getAttribute('aria-describedby')
      await expect(describedBy).toBeTruthy()
      const note = document.getElementById(describedBy as string)
      await expect(note).toHaveTextContent('Higher demand')
    })
  }
}

/**
 * An option with no vehicle nearby.
 *
 * The real `disabled` attribute, so the platform skips it during arrow-key
 * navigation — a rider does not land on a ride they cannot book. Drawn with a
 * declared token pair rather than an opacity, for the reason
 * `content/rules/rtl-arabic.md` gives: an opacity renders a colour no token
 * declares, and therefore a contrast ratio the gate cannot see.
 */
export const Unavailable: Story = {
  render: () => (
    <div style={{ inlineSize: '22rem' }}>
      <RideCardGroup label="Choose a ride" value="economy">
        <RideCard {...OPTIONS[0]} />
        <RideCard {...OPTIONS[2]} disabled />
      </RideCardGroup>
    </div>
  )
}

/**
 * Arabic, right to left, with a Latin vehicle name and a formatted fare.
 *
 * Three things are happening at once and all three are §3 and §4:
 *
 * - The layout mirrors because the page did. Nothing in this component names a
 *   side — the rows are flex with `space-between`, which names an axis.
 * - The vehicle name stays Latin and in order. It is a `ReactNode`, so the call
 *   site can wrap it in `<bdi>`; here it needs no wrapper because it is the
 *   whole of its own element.
 * - The fare is isolated in CSS with `unicode-bidi: isolate` — the equivalent
 *   of the `<bdi>` §3 asks for — because a formatted amount is the one run in
 *   this card guaranteed to be opposite-direction in Arabic.
 *
 * The fare arrives already formatted. §4: symbol placed by `Intl` rather than
 * concatenated, Western digits in both locales, and the currency's own
 * minor-unit count.
 */
export const Arabic: Story = {
  render: () => (
    <div style={{ inlineSize: '22rem' }}>
      <RideCardGroup label="اختر رحلتك" value="comfort">
        <RideCard
          value="economy"
          vehicle="Toyota Yaris"
          rideType="اقتصادية"
          eta="على بعد ٣ دقائق"
          fare="24.00 د.إ"
          capacity="٤ مقاعد"
        />
        <RideCard
          value="comfort"
          vehicle="Toyota Camry"
          rideType="مريحة"
          eta="على بعد ٥ دقائق"
          fare="38.00 د.إ"
          capacity="٤ مقاعد"
          surgeNote="الطلب مرتفع في منطقتك الآن"
        />
      </RideCardGroup>
    </div>
  ),
  globals: { direction: 'rtl', lang: 'ar' }
}
