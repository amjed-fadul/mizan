import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, waitFor } from 'storybook/test'
import { Button } from '../Button'
import { Dialog } from './Dialog'

/**
 * # Dialog
 *
 * A modal built on the platform's `<dialog>`, opened with `showModal()`.
 *
 * ## What v0 has instead
 *
 * Nothing. There is no modal, no overlay and no confirmation anywhere in
 * `legacy/src` — and two actions that badly want one:
 *
 * - **"Cancel Trip"** on Move's trip screen is `onClick={() => navigate('/move')}`.
 *   One press, no confirmation, with a driver en route.
 * - **"Remove"** on Market's cart is a `<div onClick>` with a hard-coded
 *   `#c0392b`, keyboard-inert, deleting a line immediately.
 *
 * The **CancelTrip** story is the first of those, as it should have been.
 *
 * ## Why the platform element
 *
 * `showModal()` gives the focus trap, the inertness of everything behind it,
 * `Escape`, the top layer — so the dialog is never clipped by an ancestor's
 * `overflow` or outranked by a `z-index` — and `role="dialog"` with
 * `aria-modal`. None of it is implemented here. It is the same argument
 * `RideCard` makes for a real radio.
 *
 * `<dialog open>` is **not** the same thing: that renders a *non-modal* dialog
 * with no top layer, no focus trap, nothing inert and no Escape. It looks
 * identical and is the easiest way to ship a modal that is not one.
 *
 * ## Where the weight of a destructive action goes
 *
 * Into the label and the description. Decision 020 refused a destructive Button
 * variant, and the token layer still has no action-danger semantic — so this
 * component does not have a red button to reach for, and does not want one. A
 * red fill is invisible to a colour-blind user and is the same red whether a
 * thing is undoable or merely annoying. *"Your driver is two minutes away"* is
 * a stronger signal than any colour.
 */
const meta = {
  title: 'Components/Dialog',
  component: Dialog,
  parameters: {
    layout: 'centered',
    /*
      Taller frames than the library default. Each docs story renders in its own
      iframe (see .storybook/preview.tsx), and a modal fills the viewport it is
      given — at the default height the dialog would be cropped by the frame
      rather than by anything in the component.
    */
    docs: { story: { height: '440px' } }
  },
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    dismissLabel: { control: 'text' },
    confirmLabel: { control: 'text' },
    confirmIsSafe: { control: 'boolean' },
    open: { control: false },
    children: { control: false },
    onDismiss: { action: 'dismissed' },
    onConfirm: { action: 'confirmed' }
  },
  args: {
    open: true,
    title: 'Cancel this trip?',
    description: 'Your driver is two minutes away. Cancelling now may charge a fee.',
    confirmLabel: 'Cancel trip',
    dismissLabel: 'Keep trip',
    onDismiss: fn(),
    onConfirm: fn()
  }
} satisfies Meta<typeof Dialog>

export default meta
type Story = StoryObj<typeof meta>

/**
 * **The confirmation v0 does not have.**
 *
 * Read the two labels. Neither is "Yes" or "No", and neither is "Cancel" —
 * which is the word that cannot be used in this dialog at all, because "Cancel"
 * in a *cancel-the-trip* dialog can be read as either answer. `Cancel trip` and
 * `Keep trip` both name what happens.
 *
 * Both buttons are `secondary`. There is no primary, and that is decision 020
 * showing through rather than an oversight: a primary fill on "Cancel trip"
 * would be the destructive variant arriving under another name, and a primary
 * on "Keep trip" would push the safe answer at someone who may genuinely want
 * the other one.
 */
export const CancelTrip: Story = {}

/**
 * **Focus lands on the safe action.** This is the story that proves the one
 * behavioural decision in the component.
 *
 * `confirmIsSafe` defaults to `false`, so the platform's initial focus is
 * placed on the dismissing action. Someone who opens a confirmation and presses
 * Enter out of habit keeps what they had.
 *
 * It decides focus and *nothing else* — no colour, no icon, no variant.
 */
export const FocusLandsOnTheSafeAction: Story = {
  play: async ({ step }) => {
    // A modal in the top layer is not inside canvasElement, so queries go
    // through the document. That is a fact about `showModal()` rather than a
    // workaround: the dialog is deliberately not in the normal flow.
    const dialog = document.querySelector('dialog')

    await step('the dialog is open and modal', async () => {
      await expect(dialog).toBeTruthy()
      await expect(dialog?.open).toBe(true)
    })

    await step('focus is on "Keep trip", not on "Cancel trip"', async () => {
      const active = document.activeElement
      await expect(active?.textContent).toBe('Keep trip')
    })
  }
}

/**
 * The reverse, where confirming is the harmless option.
 *
 * "Retry" cannot hurt anybody, so habit should land on it. Same component, same
 * two secondary buttons, one flag — and the flag moves focus rather than paint.
 */
export const ConfirmIsSafe: Story = {
  args: {
    title: 'Could not load your cart',
    description: 'Check your connection and try again.',
    confirmLabel: 'Retry',
    dismissLabel: 'Not now',
    confirmIsSafe: true
  },
  play: async ({ step }) => {
    await step('focus is on "Retry"', async () => {
      await expect(document.activeElement?.textContent).toBe('Retry')
    })
  }
}

/**
 * Nothing to decide — an acknowledgement.
 *
 * Omit `confirmLabel` and `onConfirm` and there is one action. The dismissing
 * label is still required, because there is always a way out.
 */
export const Acknowledge: Story = {
  args: {
    title: 'Your order is on its way',
    description: 'We will text you when the driver is nearby.',
    confirmLabel: undefined,
    onConfirm: undefined,
    dismissLabel: 'Got it'
  }
}

/**
 * **Escape closes it, and the component says so.**
 *
 * The `<dialog>` element closes itself on Escape — that is the platform, and it
 * is deliberately not intercepted. What this component adds is reporting it
 * upward: without that, the `open` prop and the DOM disagree, and the next
 * `open={true}` would do nothing because the element is already closed in its
 * own eyes.
 *
 * Escape, the backdrop and the dismissing action are all the same event on
 * purpose. A dialog that can be escaped one way but not another teaches a user
 * that the box is unpredictable.
 */
export const EscapeDismisses: Story = {
  /*
    A STATEFUL render, and it is the point of the story rather than scaffolding.

    An args-driven version of this story asserts something false. Escape closes
    the element, the `close` listener reports it through `onDismiss` — and with
    a mock consumer `open` stays `true`, so the effect that opens the dialog
    sees `open && !element.open` on the next render and calls `showModal()`
    again. The dialog reopens in the same frame it closed, and a test that reads
    `dialog.open` finds `true` and concludes Escape does not work.

    That is correct behaviour for a controlled component and a genuine footgun:
    a consumer who renders `open` from a constant, or forgets to handle
    `onDismiss`, gets a modal that cannot be escaped or dismissed at all. The
    README records it under Constraints; this story is where it is demonstrated.
  */
  render: (args) => {
    const [open, setOpen] = useState(true)
    return (
      <Dialog
        {...args}
        open={open}
        onDismiss={() => {
          args.onDismiss()
          setOpen(false)
        }}
      />
    )
  },
  play: async ({ args, step }) => {
    /*
      The platform close is invoked directly, and NOT with
      `userEvent.keyboard('{Escape}')`. That is not a shortcut — it is the only
      honest way to test this.

      Closing a `<dialog>` on Escape is a user-agent DEFAULT ACTION of a real
      key press. A dispatched `keydown` does not carry one, so no synthetic
      event library can produce it: the element stays open, no `close` fires,
      and the assertion below fails no matter how correct the component is.

      This story used to press Escape and assert `dialog.open === false`, and
      it could never have passed. It shipped that way for a whole stage,
      because nothing ran the play functions — which is the gap
      `vitest.config.ts` was added to close, and this is the first thing it
      caught.

      What the component actually owns is the line above: the element closes
      itself, and this component REPORTS it so the consumer's state cannot
      drift out of step with the DOM. `element.close()` is exactly what the
      platform does on Escape, so triggering it tests the component's half and
      leaves the browser's half to the browser.
    */
    await step('when the platform closes the dialog, the consumer is told', async () => {
      const dialog = document.querySelector('dialog')
      await expect(dialog).toBeTruthy()
      dialog?.close()
      // `close` is dispatched as a task, so the listener has not run yet at the
      // point close() returns. Asserting straight after it reads the state
      // before the component has been told anything.
      await waitFor(() => expect(args.onDismiss).toHaveBeenCalled())
    })

    await step('and because this consumer listens, it stays closed', async () => {
      const dialog = document.querySelector('dialog')
      await expect(dialog?.open).toBe(false)
    })
  }
}

/**
 * Opened from a real button, which is how a dialog is actually met.
 *
 * Worth opening and closing a few times with the keyboard alone: focus moves
 * into the dialog on open and the browser returns it to the trigger on close.
 * That restoration is the platform's too.
 */
export const FromATrigger: Story = {
  render: function FromATriggerStory(args) {
    const [open, setOpen] = useState(false)
    return (
      <>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Cancel trip
        </Button>
        <Dialog
          {...args}
          open={open}
          onDismiss={() => setOpen(false)}
          onConfirm={() => setOpen(false)}
        />
      </>
    )
  },
  args: { open: false }
}

/**
 * Arabic, right to left.
 *
 * Three things to look at, none of which has a rule naming a side:
 *
 * - The actions sit at the reading **end** of the row, which is the left here.
 *   `justify-content: flex-end` is a position on the inline axis, so the row
 *   flips with the document.
 * - The dismissing action is still **first in reading order** — the rightmost
 *   here — and the committing action is still last. Last is the last thing read
 *   before acting.
 * - The title and description carry `dir="auto"`, so a dialog whose strings
 *   come from a catalogue in either language aligns each as its own block. The
 *   same §3 rule `Input` learned by rendering an English error inside an Arabic
 *   page and watching the trailing `@.` jump to the far end.
 */
export const Arabic: Story = {
  args: {
    title: 'إلغاء هذه الرحلة؟',
    description: 'سائقك على بعد دقيقتين. قد يترتب على الإلغاء الآن رسوم.',
    confirmLabel: 'إلغاء الرحلة',
    dismissLabel: 'الاحتفاظ بالرحلة'
  },
  globals: { direction: 'rtl', lang: 'ar' }
}
