import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Input } from './Input'

/**
 * # Input
 *
 * The second component, and the first test of whether the vocabulary Button
 * established generalises or was quietly designed around Button. Two things say
 * it did: the size steps read the same `control.{sm,md,lg}.*` semantics decision
 * 022 made per-product, and the one name Input needed that did not exist —
 * an error colour — became decision 023 rather than a value invented here.
 *
 * `./README.md` is the full API spec. This file is the part you can type into.
 *
 * **Use the toolbar.** Theme, product, direction and language are live and this
 * component branches on none of them. The one `dir` it writes is a statement
 * about the *value* — an email is Latin whatever the page is — and the stories
 * below are arranged so you can watch that decision be right and be wrong.
 *
 * The story worth opening first is **Latin Value In An Arabic Page**. It is the
 * whole reason this component has a `valueDirection` prop.
 */
const meta = {
  title: 'Components/Input',
  component: Input,
  parameters: {
    layout: 'centered'
  },
  argTypes: {
    type: {
      control: 'inline-radio',
      options: ['text', 'email', 'tel', 'url', 'password', 'search'],
      description:
        'The HTML type. number is deliberately absent — see the type docs and rtl-arabic.md §4.'
    },
    size: {
      control: 'inline-radio',
      options: ['sm', 'md', 'lg'],
      description:
        'The step, shared with Button. md and lg guarantee 44×44; sm is exempt only where WCAG 2.5.8 exempts it.'
    },
    valueDirection: {
      control: 'inline-radio',
      options: ['page', 'ltr', 'auto'],
      description:
        'How the VALUE is directed, not how the page is laid out. Derived from type when not given.'
    },
    invalid: { control: 'boolean' },
    required: { control: 'boolean' },
    readOnly: { control: 'boolean' },
    disabled: { control: 'boolean' },
    fullWidth: { control: 'boolean' },
    label: { control: 'text' },
    hint: { control: 'text' },
    errorMessage: { control: 'text' },
    placeholder: { control: 'text' },
    onChange: { action: 'changed' }
  },
  args: {
    label: 'Full name',
    onChange: fn()
  }
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The ordinary field: a label, a box, nothing else.
 *
 * No `dir` is written at all here, and that absence is the feature. A name is
 * prose in the interface language, so it inherits the page — flip the toolbar to
 * RTL and the field, its label and its caret all move together because the page
 * moved, not because this component did anything.
 */
export const Default: Story = {}

/**
 * A field that is asking for something specific, with the format in a hint
 * rather than in the placeholder.
 *
 * The split matters. A placeholder disappears the moment typing starts, so an
 * instruction placed there is an instruction the user cannot re-read while they
 * are following it. `hint` is linked with `aria-describedby`, which means it is
 * read when the field takes focus and stays on screen while the field is used.
 */
export const WithHint: Story = {
  args: {
    label: 'Delivery note',
    hint: 'Anything the driver should know — a gate code, a floor.',
    placeholder: 'Leave at the door'
  }
}

/**
 * Required, and the asterisk is not carrying the message alone.
 *
 * The marker is `aria-hidden` because the input's own `required` attribute is
 * what tells assistive technology; an asterisk read aloud as "star" mid-label is
 * noise. What this story is really for is the visual check: at every step and in
 * both scripts, the marker sits after the label's last glyph on the correct side
 * — `margin-inline-start`, with neither "left" nor "right" written anywhere.
 */
export const Required: Story = {
  args: {
    label: 'Card number',
    required: true,
    valueDirection: 'ltr',
    inputMode: 'numeric',
    placeholder: '4111 1111 1111 1111'
  }
}

/**
 * **Latin by nature, inside an Arabic page — the story this component exists
 * for.**
 *
 * `type="email"` derives `dir="ltr"`, so the value paints left-to-right while
 * the label, the hint and the layout stay right-to-left. Nothing was passed to
 * make that happen.
 *
 * Why it is not the browser's job: `content/rules/rtl-arabic.md` §6 checked it
 * rather than assuming. The platform's directionality algorithm covers exactly
 * one input type — `tel` — and `email`, `url`, `search`, `number` and plain
 * `text` all inherit the page. Without the explicit `dir`, an email under
 * composition *moves*: `amjed@` paints as `@amjed`, the `@` jumping to the far
 * end of the field and coming back once a domain is typed. The stored value is
 * correct the whole time, which is exactly why this survives being tested by
 * somebody reading state instead of the screen.
 *
 * Type into it with the toolbar set to RTL and watch it stay still.
 */
export const LatinValueInAnArabicPage: Story = {
  args: {
    label: 'البريد الإلكتروني',
    type: 'email',
    hint: 'سنرسل إيصالك إلى هذا العنوان.',
    placeholder: 'name@example.com'
  },
  parameters: {
    docs: {
      description: {
        story:
          'The label is Arabic and the value is Latin. Both are correct at once, which is the normal case in this market rather than an edge case.'
      }
    }
  },
  globals: { direction: 'rtl', lang: 'ar' },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    const field = canvas.getByLabelText(/البريد/)

    await step('the field declares its value direction explicitly', async () => {
      // Asserted as an attribute rather than by screenshot, because this is the
      // one thing about this component that cannot be seen in a static render
      // with a Latin value in it — an empty ltr field and an empty inherited
      // field look identical.
      await expect(field).toHaveAttribute('dir', 'ltr')
    })

    await step('and typing an address does not move it', async () => {
      await userEvent.type(field, 'amjed@')
      await expect(field).toHaveValue('amjed@')
      await expect(field).toHaveAttribute('dir', 'ltr')
    })
  }
}

/**
 * The same page, a value that genuinely is Arabic.
 *
 * `type="text"` derives `'page'`, which writes **no** `dir` at all, so the field
 * inherits. This is the story that proves the previous one is a decision rather
 * than a blanket rule: if every field were `ltr`, an Arabic name would paint
 * against the wrong edge of its own interface.
 */
export const ArabicValueInAnArabicPage: Story = {
  args: {
    label: 'الاسم الكامل',
    placeholder: 'محمد عبد الله'
  },
  globals: { direction: 'rtl', lang: 'ar' },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    const field = canvas.getByLabelText(/الاسم/)

    await step('no dir is written, so the value follows the page', async () => {
      await expect(field).not.toHaveAttribute('dir')
    })
  }
}

/**
 * An identifier in a `text` field, where the type cannot possibly tell.
 *
 * `type="text"` covers an Arabic note, a customer's name and an order reference,
 * and no attribute distinguishes them. This is where `valueDirection` stops
 * being a derived default and becomes the call site's decision — an order
 * reference is a *transcribed identifier* under §4, reproduced glyph for glyph
 * because it is compared against a thing in the world.
 */
export const IdentifierInATextField: Story = {
  args: {
    label: 'Order reference',
    valueDirection: 'ltr',
    defaultValue: 'MZ-4417-002',
    hint: 'On your confirmation email, above the delivery address.'
  }
}

/**
 * The invalid state, and all three of its signals at once.
 *
 * The edge is `border.error`, the message is `text.error`, and `aria-invalid` is
 * on the input. Decision 023 is explicit that no one of the three carries the
 * state alone: colour alone fails WCAG 1.4.1 for a colour-blind user, a message
 * alone is missed by someone scanning a long form, and `aria-invalid` alone is
 * invisible to anyone looking at the screen.
 *
 * Turn the a11y panel on. This is also the story where the tightest gated
 * pairing in the whole system is on screen — `text.error` on `surface.sunken`
 * in dark sits at 4.73:1 against a 4.5 bar, 0.23 of headroom.
 */
export const Invalid: Story = {
  args: {
    label: 'Email',
    type: 'email',
    invalid: true,
    defaultValue: 'amjed@',
    errorMessage: 'That address is missing everything after the @.'
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    const field = canvas.getByLabelText('Email')

    await step('the input is marked invalid for assistive technology', async () => {
      await expect(field).toHaveAttribute('aria-invalid', 'true')
    })

    await step('and the message is linked, not merely nearby', async () => {
      // The visual association is proximity; the programmatic one is this. A
      // message that sits under a field and is not referenced by it is a
      // message a screen-reader user never hears.
      const describedBy = field.getAttribute('aria-describedby')
      await expect(describedBy).toBeTruthy()
      const message = document.getElementById(describedBy as string)
      await expect(message).toHaveTextContent('missing everything after the @')
    })
  }
}

/**
 * Invalid *and* hinted, which is where the description order starts to matter.
 *
 * `aria-describedby` is read in the order the ids are listed, and this component
 * lists the hint before the error on purpose: what is wanted, then what went
 * wrong. Reversed, a screen-reader user hears the correction before the
 * requirement it corrects.
 */
export const InvalidWithHint: Story = {
  args: {
    label: 'Mobile number',
    type: 'tel',
    hint: 'A UAE number we can reach the driver on.',
    invalid: true,
    defaultValue: '+971 50',
    errorMessage: 'That number is too short.'
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    const field = canvas.getByLabelText(/Mobile/)

    await step('the hint is described before the error', async () => {
      const ids = (field.getAttribute('aria-describedby') ?? '').split(' ')
      await expect(ids).toHaveLength(2)
      const first = document.getElementById(ids[0])
      const second = document.getElementById(ids[1])
      await expect(first).toHaveTextContent('reach the driver')
      await expect(second).toHaveTextContent('too short')
    })
  }
}

/**
 * The three steps, which are the same three Button has.
 *
 * Switch the product toolbar between Market and Move. Market's values are
 * byte-for-byte what shipped before decision 022; Move's `md` and `lg` are
 * larger, because Move is compact in what it puts on a screen and generous in
 * the thing you touch at a curb. `sm` is deliberately identical in both.
 *
 * There is no product named anywhere in this component or its stylesheet.
 */
export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: 'grid', gap: '1.5rem', inlineSize: '20rem' }}>
      <Input {...args} size="sm" label="Small — exempt from 44×44" />
      <Input {...args} size="md" label="Medium — the default" />
      <Input {...args} size="lg" label="Large" />
    </div>
  ),
  args: {
    placeholder: 'Type here'
  }
}

/**
 * Read-only is not disabled, and does not look like it.
 *
 * The value stays selectable, copyable and reachable by keyboard — which is the
 * whole difference. What changes is that the edge stops claiming to be an
 * editable control and drops to the divider token.
 */
export const ReadOnly: Story = {
  args: {
    label: 'Order reference',
    valueDirection: 'ltr',
    defaultValue: 'MZ-4417-002',
    readOnly: true,
    hint: 'Copy this if you contact support.'
  }
}

/**
 * Disabled, drawn with a declared token pair rather than an opacity.
 *
 * v0 uses `opacity: 0.5` on its disabled controls, which renders a colour no
 * token declares and therefore a contrast ratio the gate cannot see. This is
 * `text.secondary` on `surface.sunken`, which is gated at 4.5:1 in `pairs.json`
 * and reported on every run.
 */
export const Disabled: Story = {
  args: {
    label: 'Promo code',
    valueDirection: 'ltr',
    placeholder: 'MIZAN10',
    disabled: true,
    hint: 'Promo codes cannot be combined with a delivery offer.'
  }
}

/**
 * A whole form, which is where the shared size vocabulary pays off.
 *
 * The fields and the submit button are all at `md`, so they are the same height
 * as each other — in Market and in Move, at 48px and 48px, without either
 * component knowing which product it is in. That is decision 022's claim made
 * visible, and it is the thing that would have been impossible if Input had
 * grown its own size scale.
 *
 * Flip to RTL. Nothing in this story has a direction written into it.
 */
export const InAForm: Story = {
  render: (args) => (
    <form
      style={{ display: 'grid', gap: '1rem', inlineSize: '22rem' }}
      onSubmit={(event) => event.preventDefault()}
    >
      <Input {...args} label="Full name" placeholder="Amjed Fadul" />
      <Input
        {...args}
        label="Email"
        type="email"
        placeholder="name@example.com"
        hint="We will send your receipt here."
      />
      <Input
        {...args}
        label="Mobile number"
        type="tel"
        placeholder="+971 50 123 4567"
      />
    </form>
  ),
  args: {
    fullWidth: true
  }
}
