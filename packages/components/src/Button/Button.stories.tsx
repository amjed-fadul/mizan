import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Button } from './Button'

/**
 * # Button
 *
 * One component, replacing the four implementations in Mizan v0 —
 * `shared/Button`, `market/PrimaryButton`, `move/ActionButton` and the raw
 * `.btn.btn-cta` that was declared in no stylesheet at all. Decision 020 argues
 * the consolidation; `./README.md` is the full API spec; this file is the part
 * you can press.
 *
 * The stories below are written to be read as much as run. Each one is a real
 * usage rather than a permutation of the props, because a grid of every
 * combination documents the type signature and nothing else.
 *
 * **Use the toolbar.** Theme, product, direction and language are all live. The
 * component has no branch for any of them: the colours resolve from
 * `data-theme` and `data-product`, the layout mirrors from `dir`, and the
 * Arabic face and leading arrive through `:lang()`. If a story looks right in
 * one combination and wrong in another, that is a defect in this component and
 * not in the toolbar.
 */
const meta = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    layout: 'centered'
  },
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['primary', 'secondary', 'ghost'],
      description: 'How the control looks. Never what pressing it means.'
    },
    size: {
      control: 'inline-radio',
      options: ['sm', 'md', 'lg'],
      description:
        'The step. md and lg guarantee a 44×44 hit target; sm does not and is exempt only where WCAG 2.5.8 exempts it.'
    },
    type: {
      control: 'inline-radio',
      options: ['button', 'submit', 'reset'],
      description: 'The HTML attribute, always set. Defaults to button.'
    },
    loading: { control: 'boolean' },
    fullWidth: { control: 'boolean' },
    disabled: { control: 'boolean' },
    icon: { control: false },
    children: { control: 'text' },
    onClick: { action: 'clicked' }
  },
  args: {
    children: 'Add to cart',
    onClick: fn()
  }
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

/**
 * A cart icon, standing in for whatever the icon set turns out to be.
 *
 * It is drawn `currentColor` so that it inherits the variant's declared label
 * token instead of introducing a colour `pairs.json` has not seen — the same
 * rule the busy indicator follows.
 *
 * It does not mirror, and that is the icon's own decision under
 * `content/rules/rtl-arabic.md` §5, not the Button's. A basket is a real-world
 * object. What mirrors in RTL is where it *sits* — before the label in reading
 * order, which flex handles — and not the glyph.
 */
const CartIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
    <path
      d="M2 3h2l1.2 6.5A1.5 1.5 0 0 0 6.7 10.8h5.1a1.5 1.5 0 0 0 1.5-1.2L14 5.5H4.4"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="6.8" cy="13" r="1" fill="currentColor" />
    <circle cx="11.8" cy="13" r="1" fill="currentColor" />
  </svg>
)

/**
 * The default, and the reason the default is `secondary`.
 *
 * A `primary` is a claim that this is *the* action on the screen. A default
 * that makes that claim silently produces screens with four primary actions on
 * them, and the fourth one is where the claim stops meaning anything.
 */
export const Default: Story = {
  args: {
    children: 'View details'
  }
}

/**
 * The one action on the screen. `action.primary` resolves green in Market and
 * blue in Move — switch the product in the toolbar without touching a prop.
 */
export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Checkout'
  }
}

/**
 * The quiet one. No fill, no border, and a `surface.sunken` ground on hover.
 *
 * Ghost is the only variant that carries no boundary at rest, which is a real
 * cost: a control that looks like text is a control some people will not find.
 * It belongs beside another button, not alone on a screen.
 */
export const Ghost: Story = {
  args: {
    variant: 'ghost',
    children: 'Not now'
  }
}

/**
 * The three variants together, which is how the difference is actually read.
 *
 * Tab through them with the keyboard. The focus indicator has to be visible on
 * all three, and `primary` is the case decision 019 exists for: a single ring
 * in `focus.ring` meets that brand fill at 2.37:1 against 1.4.11's 3.0, so the
 * indicator is two-tone and the light band is what touches the fill.
 */
export const Variants: Story = {
  args: { children: 'Add to cart' },
  render: (args) => (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <Button {...args} variant="primary">
        Checkout
      </Button>
      <Button {...args} variant="secondary">
        View details
      </Button>
      <Button {...args} variant="ghost">
        Not now
      </Button>
    </div>
  )
}

/**
 * The three steps.
 *
 * `md` and `lg` guarantee a hit target of at least 44×44 CSS px. `sm` clears
 * WCAG 2.2 2.5.8 but not 2.5.5, and is documented as available only where 2.5.8
 * grants an exception — inline in a run of text, or where a full-size control
 * for the same action is on the same screen.
 *
 * Both products currently get the same geometry at the same step. Decision 020
 * settles that the product mode should resolve it and records the token work as
 * owed; switching the product in the toolbar changes the colour and nothing
 * else, which is the regression made visible rather than hidden.
 */
export const Sizes: Story = {
  args: { variant: 'primary' },
  render: (args) => (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <Button {...args} size="sm">
        Small
      </Button>
      <Button {...args} size="md">
        Medium
      </Button>
      <Button {...args} size="lg">
        Large
      </Button>
    </div>
  )
}

/**
 * An icon before the label.
 *
 * The icon sits first in reading order and the gap between them is
 * `space.100`. Flip the direction in the toolbar: the icon moves to the other
 * side because the row is a flex row and flex mirrors with `dir`. There is no
 * second rule, no `[dir='rtl']` selector, and nothing physical in this
 * component to get wrong. v0's `.mk-btn__icon` used `margin-right: 6px`.
 */
export const WithIcon: Story = {
  args: {
    variant: 'primary',
    icon: <CartIcon />,
    children: 'Add to cart'
  }
}

/**
 * The bottom-anchored mobile call to action, which is what `fullWidth` is for.
 *
 * Decision 020 keeps this prop and is uneasy about it in writing: it is a
 * layout escape hatch, and unlike a wrong variant a wrong `fullWidth` looks
 * fine. It survives because v0 did not avoid the problem by omitting it —
 * `.mv-action` is `display: block; width: 100%` unconditionally, so Move baked
 * the choice into a stylesheet where it looked like a fact instead of a
 * decision.
 */
export const FullWidth: Story = {
  args: {
    variant: 'primary',
    fullWidth: true,
    children: 'Confirm ride'
  },
  parameters: { layout: 'padded' },
  render: (args) => (
    <div style={{ inlineSize: 320 }}>
      <Button {...args} />
    </div>
  )
}

/**
 * The action is in flight.
 *
 * Three things are true at once and the play function checks all three.
 *
 * 1. **The control does not change size.** The story measures the button
 *    before and after, and the width is identical. The label keeps its box and
 *    the indicator shares its grid cell — nothing is measured in JavaScript and
 *    nothing is pinned. v0's `ActionButton` swaps the label for "Please wait"
 *    and adds a spinner beside it, so the control changes width under the
 *    finger pressing it.
 * 2. **Activation is blocked** while it is busy, and the handler is not called.
 * 3. **The label does not change, and no string is substituted.** v0
 *    hard-codes the English `'Please wait'` in a product that ships Arabic.
 *    Substituting a label means authoring one, authoring one needs the string
 *    catalogue, and there is no string catalogue. So the accessible name is the
 *    label it was given, unchanged, and the state travels on `aria-busy`, which
 *    the screen reader announces in the user's language rather than in ours.
 *
 * The indicator does not spin. There is no motion scale in `content/tokens/`,
 * the animation names the duration token it wants and takes no fallback, and a
 * static ring is the honest rendering of a system with no motion tokens. It is
 * the one gap this component asked for and did not find.
 */
export const Loading: Story = {
  args: {
    variant: 'primary',
    loading: true,
    children: 'Confirm ride'
  },
  play: async ({ canvasElement, args, step }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole('button', { name: 'Confirm ride' })

    await step('it is busy, and it still has its name', async () => {
      await expect(button).toHaveAttribute('aria-busy', 'true')
      await expect(button).toHaveAccessibleName('Confirm ride')
    })

    await step('it is not the real disabled attribute, so focus survives', async () => {
      await expect(button).not.toBeDisabled()
      await expect(button).toHaveAttribute('aria-disabled', 'true')
      button.focus()
      await expect(button).toHaveFocus()
    })

    await step('pressing it does nothing', async () => {
      await userEvent.click(button)
      await expect(args.onClick).not.toHaveBeenCalled()
    })

    await step('and it is the same size it was before it became busy', async () => {
      const busyWidth = button.getBoundingClientRect().width

      // Take the busy state off by hand and re-measure. This is the assertion
      // the whole grid stack exists for, and the only way to make it is to see
      // both states on the same element.
      button.removeAttribute('aria-busy')
      const restingWidth = button.getBoundingClientRect().width
      button.setAttribute('aria-busy', 'true')

      await expect(busyWidth).toBe(restingWidth)
    })
  }
}

/**
 * The action is not available.
 *
 * `disabled` sets the real platform attribute, so assistive technology is told
 * through the platform rather than through an ARIA restatement of it, and the
 * browser blocks activation without help.
 *
 * The appearance is a declared pair of tokens — `text.secondary` on
 * `surface.sunken`, gated at the full 4.5 text threshold — and not an opacity.
 * v0 carries `opacity: 0.5` on the disabled button in all three stylesheets,
 * which renders a colour no token declares and therefore a contrast ratio the
 * gate cannot see. All three variants collapse to this one appearance, because
 * an unavailable control is not primary, secondary or ghost; it is unavailable.
 */
export const Disabled: Story = {
  args: {
    variant: 'primary',
    disabled: true,
    children: 'Out of stock'
  },
  play: async ({ canvasElement, args, step }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole('button', { name: 'Out of stock' })

    await step('the platform attribute, not an ARIA restatement of it', async () => {
      await expect(button).toBeDisabled()
      await expect(button).not.toHaveAttribute('aria-busy')
    })

    await step('pressing it does nothing', async () => {
      await userEvent.click(button)
      await expect(args.onClick).not.toHaveBeenCalled()
    })

    await step('no opacity — the colour is a token the gate can see', async () => {
      await expect(getComputedStyle(button).opacity).toBe('1')
    })
  }
}

/**
 * Every button on a Move screen, disabled, so the one appearance can be read
 * against the three it replaces.
 */
export const DisabledVariants: Story = {
  args: { disabled: true, children: 'Unavailable' },
  render: (args) => (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <Button {...args} variant="primary" />
      <Button {...args} variant="secondary" />
      <Button {...args} variant="ghost" />
    </div>
  )
}

/**
 * Arabic, right to left, with no prop changed.
 *
 * This story sets `dir="rtl"` and `lang="ar"` on its own container so it is
 * correct however the toolbar is set, and it is deliberately a *mixed*-content
 * case rather than Latin text in an RTL box — the second one looks fine and
 * proves nothing.
 *
 * What to check, and what each thing proves:
 *
 * - **The icon is at the other end**, and no rule says so. Flex mirrored it.
 * - **The label is set in `font-family.arabic`** with `line-height.arabic-tight`
 *   at 1.45 against Latin's 1.25, and the 1.08 optical size correction applied
 *   once — on the label, because in a `font-size` declaration `1em` is the
 *   *parent's* size and the correction would otherwise multiply the wrong
 *   number.
 * - **`letter-spacing` is 0.** Arabic is cursive; tracking breaks the joins and
 *   renders the text wrong rather than differently styled. v0 applies a global
 *   `0.01em` that reaches every Arabic label, and `.mv-action` restates it.
 * - **The order number keeps its own direction**, because it is wrapped in
 *   `<bdi>`. It is a transcribed identifier — reproduced glyph for glyph,
 *   never regrouped — and unmarked it would be reordered by the bidirectional
 *   algorithm into a number that is not the one on the receipt.
 * - **The busy button says nothing in English.** This is the case v0 fails:
 *   `'Please wait'` would appear here, in the middle of an Arabic screen.
 * - **The buttons are taller than their Latin equivalents**, and they are meant
 *   to be. إتمام الشراء paints more ink above and below the baseline than
 *   "Checkout" does, and a height fitted to Latin ink cuts the tops off the
 *   diacritics — which, in Arabic, is a different word rather than a cosmetic
 *   loss.
 */
export const ArabicRTL: Story = {
  args: { children: 'إتمام الشراء' },
  parameters: {
    layout: 'padded'
  },
  globals: {
    direction: 'rtl',
    lang: 'ar'
  },
  render: (args) => (
    <div
      dir="rtl"
      lang="ar"
      style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start' }}
    >
      <Button {...args} variant="primary" icon={<CartIcon />}>
        أضف إلى السلة
      </Button>
      <Button {...args} variant="primary">
        إتمام الشراء
      </Button>
      <Button {...args} variant="secondary">
        تم
      </Button>
      <Button {...args} variant="primary" loading>
        إتمام الشراء
      </Button>
      <Button {...args} variant="ghost">
        <bdi>MZ-4821-KD</bdi> عرض الطلب
      </Button>
      <Button {...args} variant="secondary" disabled>
        غير متوفر
      </Button>
    </div>
  )
}

/**
 * The same six labels in English, at the same sizes, so the two can be put side
 * by side.
 *
 * The pair is the point. `content/rules/rtl-arabic.md` §6 measured "Done" at
 * 38.3px against تم's 15.1 — 39 per cent — and "Add to cart" at 117 per cent of
 * أضف إلى السلة. Arabic is not shorter than English; it is differently long,
 * string by string, and no per-component padding allowance covers both ends.
 * The floor under the short case is `min-inline-size`, which is why a
 * two-character label is a button rather than a slab.
 */
export const LatinComparison: Story = {
  args: { children: 'Checkout' },
  parameters: { layout: 'padded' },
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start' }}>
      <Button {...args} variant="primary" icon={<CartIcon />}>
        Add to cart
      </Button>
      <Button {...args} variant="primary">
        Checkout
      </Button>
      <Button {...args} variant="secondary">
        Done
      </Button>
      <Button {...args} variant="primary" loading>
        Checkout
      </Button>
      <Button {...args} variant="ghost">
        View order <bdi>MZ-4821-KD</bdi>
      </Button>
      <Button {...args} variant="secondary" disabled>
        Out of stock
      </Button>
    </div>
  )
}

/**
 * Inside a form, where the `type` prop stops being a naming preference.
 *
 * The default is `type="button"`, so the secondary button here does not submit.
 * The primary one asks for `type="submit"` explicitly and does.
 *
 * v0 cannot express this story. `shared/Button` spent the name `type` on its
 * variant, so it has no way to ask for a submit — and, because a `<button>`
 * with no `type` defaults to `submit`, seventeen of v0's twenty-five call sites
 * render one by accident. That has never fired, because `legacy/src` contains
 * no `<form>` at all. It is luck, and the difference is sitting in the rendered
 * DOM waiting for the first form somebody wraps around a checkout.
 */
export const InAForm: Story = {
  args: { children: 'Place order' },
  parameters: { layout: 'padded' },
  render: (args) => (
    <form
      onSubmit={(event) => {
        event.preventDefault()
      }}
      style={{ display: 'flex', gap: 16, alignItems: 'center' }}
    >
      <Button {...args} variant="primary" type="submit">
        Place order
      </Button>
      <Button {...args} variant="secondary">
        Keep shopping
      </Button>
    </form>
  )
}
