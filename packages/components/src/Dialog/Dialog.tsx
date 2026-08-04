import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { Button } from '../Button'
import '../styles/focus.css'
import './Dialog.css'

/** The properties Dialog exposes. */
export interface DialogProps {
  /**
   * Whether the dialog is showing. Controlled — the consumer owns the state,
   * and this component never closes itself without saying so through
   * {@link DialogProps.onDismiss}.
   */
  open: boolean

  /**
   * What the dialog is asking or telling. Required, rendered as a real `<h2>`,
   * and wired as the dialog's accessible name with `aria-labelledby`.
   *
   * There is no `aria-label` escape hatch and no unlabelled variant. A modal
   * takes the whole screen away from someone; arriving in one with no name is
   * arriving somewhere with no idea what it is.
   */
  title: ReactNode

  /**
   * The consequence, in a sentence. Linked with `aria-describedby`, so it is
   * announced when the dialog opens rather than only seen.
   *
   * This is where the weight of a destructive action goes — see the component
   * docs. "Your driver is two minutes away" is what makes "Cancel trip" a real
   * decision rather than a button somebody presses to make a box go away.
   */
  description?: ReactNode

  /** Anything more than a sentence. Most dialogs should not need it. */
  children?: ReactNode

  /**
   * The label on the dismissing action. **Required**, because there is always a
   * way out — see {@link DialogProps.onDismiss}.
   *
   * Say what not-doing-it means rather than "Cancel", which is ambiguous in
   * exactly the dialog where ambiguity is most expensive: "Cancel" in a
   * *cancel-the-trip* dialog can be read as either answer.
   */
  dismissLabel: ReactNode

  /**
   * Called when the dialog should close: the dismissing action, the Escape key,
   * or a click on the backdrop.
   *
   * All three routes are the same event on purpose. A dialog that can be
   * escaped by one route and not another teaches a user that the box is
   * unpredictable, and Escape is the one everybody already knows.
   */
  onDismiss: () => void

  /**
   * The label on the confirming action. Omit it — along with
   * {@link DialogProps.onConfirm} — for a dialog that only has to be
   * acknowledged.
   *
   * **Name the verb.** `Cancel trip` and `Keep trip`, not `Yes` and `No`.
   * Decision 020 refused a destructive Button variant and said the weight of
   * an action lives in the label; this is the component where that stops being
   * a principle and becomes the only mechanism available.
   */
  confirmLabel?: ReactNode

  /** Called when the confirming action is pressed. */
  onConfirm?: () => void

  /**
   * Whether confirming is the safe choice.
   *
   * It decides **where focus lands when the dialog opens**, and nothing else —
   * no colour, no icon, no variant. Defaults to `false`, which is the cautious
   * reading: a dialog that had to be built usually exists because the action
   * behind it is worth a second thought, so focus goes to the dismissing
   * action and a user who hits Enter out of habit keeps what they had.
   *
   * Set it `true` where the confirming action is the harmless one — "Save
   * before leaving?", "Retry?" — so that habit lands on the outcome the user
   * almost certainly wants.
   */
  confirmIsSafe?: boolean
}

/**
 * Mizan's Dialog — a modal built on the platform's `<dialog>`.
 *
 * ## What v0 has instead
 *
 * Nothing. There is no modal, no overlay and no confirmation anywhere in
 * `legacy/src`, and two actions that badly want one:
 *
 * - **"Cancel Trip"** on Move's trip screen — `onClick={() => navigate('/move')}`.
 *   One press, no confirmation, with a driver en route.
 * - **"Remove"** on Market's cart — a `<div onClick>` with a hard-coded
 *   `#c0392b`, keyboard-inert, deleting a line immediately.
 *
 * This component is what those two become.
 *
 * ## Why the platform element
 *
 * `showModal()` supplies, with no code here: the focus trap, the inertness of
 * everything behind it, `Escape` to close, the top layer — so a dialog is never
 * clipped by an ancestor's `overflow` or outranked by a `z-index` — and the
 * implicit `role="dialog"` with `aria-modal`. The same argument
 * [`RideCard`](../RideCard/README.md) makes for a real radio: every one of
 * those is a thing a `div` re-implementation gets subtly wrong, and the ones it
 * gets wrong are the ones nobody tests.
 *
 * ## Where the weight of a destructive action goes
 *
 * Into the **label** and the **description**, because
 * [decision 020](../../../../decisions/020-the-button-consolidation.md) refused
 * a destructive Button variant and the token layer still has no action-danger
 * semantic. That refusal is not worked around here. It is the constraint that
 * makes this component's API what it is: `confirmLabel` names the verb,
 * `description` states the consequence, and `confirmIsSafe` decides which
 * action a user's habit lands on.
 *
 * A red button is a weaker signal than a sentence anyway — it is invisible to a
 * colour-blind user and it is the same red whether the thing is undoable or
 * merely annoying.
 *
 * @example The confirmation v0 does not have
 * ```tsx
 * <Dialog
 *   open={confirming}
 *   title="Cancel this trip?"
 *   description="Your driver is two minutes away. Cancelling now may charge a fee."
 *   confirmLabel="Cancel trip"
 *   onConfirm={cancelTrip}
 *   dismissLabel="Keep trip"
 *   onDismiss={() => setConfirming(false)}
 * />
 * ```
 *
 * @example Acknowledged, with nothing to decide
 * ```tsx
 * <Dialog
 *   open={shown}
 *   title="Your order is on its way"
 *   description="We will text you when the driver is nearby."
 *   dismissLabel="Got it"
 *   onDismiss={() => setShown(false)}
 * />
 * ```
 */
export function Dialog({
  open,
  title,
  description,
  children,
  dismissLabel,
  onDismiss,
  confirmLabel,
  onConfirm,
  confirmIsSafe = false
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  const titleId = `${id}-title`
  const descriptionId = `${id}-description`

  /*
    Drive the element's own modal state from the `open` prop.

    `showModal()` rather than the `open` attribute, and the difference is not
    cosmetic: `<dialog open>` renders a NON-modal dialog — no top layer, no
    focus trap, nothing behind it inert, and Escape does nothing. It looks
    identical on screen and is a different component underneath, which makes it
    the single easiest way to ship a modal that is not one.
  */
  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (open && !element.open) {
      element.showModal()

      /*
        Focus is placed here, explicitly, and NOT with React's `autoFocus`.

        That was the first attempt and it silently did nothing, which is worse
        than failing: React applies `autoFocus` by calling `.focus()` at mount,
        and mount happens before this effect runs `showModal()`. Focusing an
        element inside a closed dialog is a no-op, so the dialog opened with
        `document.activeElement` still on `<body>` — no ring, no keyboard
        starting point, and the one safety property this component claims
        quietly absent. It looked correct in a screenshot.

        So the focus goes after showModal(), scoped to the actions row rather
        than to the whole dialog: `body` and `children` may contain focusable
        content, and "the first focusable thing" is not the same question as
        "the action a user's habit should land on".

        The order this reads — dismiss first, confirm second — is fixed by the
        JSX a few lines below and by nothing else.
      */
      const actions = element.querySelectorAll<HTMLButtonElement>(
        '.mz-dialog__actions button'
      )
      const safe = confirmIsSafe ? actions[actions.length - 1] : actions[0]
      safe?.focus()
    }
    if (!open && element.open) element.close()
  }, [open, confirmIsSafe])

  /*
    The element closes itself on Escape, and that has to be reported upward or
    the `open` prop and the DOM disagree — the next `open={true}` would be a
    no-op because the element is already closed in its own eyes. Listening to
    `close` rather than intercepting `cancel` keeps Escape working exactly as
    the platform defines it; this only tells the consumer it happened.
  */
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const handleClose = () => {
      if (open) onDismiss()
    }
    element.addEventListener('close', handleClose)
    return () => element.removeEventListener('close', handleClose)
  }, [open, onDismiss])

  return (
    <dialog
      ref={ref}
      className="mz-dialog"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      /*
        A click on the backdrop dismisses. The backdrop is not a separate
        element — it is the dialog's own ::backdrop pseudo-element — so the
        click lands on the <dialog> itself, and the test for "was that the
        backdrop" is whether the target is the dialog rather than anything
        inside it. The inner wrapper below is what makes that test reliable.
      */
      onClick={(event) => {
        if (event.target === ref.current) onDismiss()
      }}
    >
      {/*
        Everything visible lives in this wrapper rather than on the <dialog>.
        Two reasons, and the second is the one that bites: the padding has to
        belong to something that is not the click target, or every click inside
        the dialog's padding would read as a backdrop click and close it.
      */}
      <div className="mz-dialog__panel">
        <h2 className="mz-dialog__title" id={titleId} dir="auto">
          {title}
        </h2>

        {description ? (
          <p className="mz-dialog__description" id={descriptionId} dir="auto">
            {description}
          </p>
        ) : null}

        {children ? <div className="mz-dialog__body">{children}</div> : null}

        {/*
          The actions, in reading order: dismiss first, confirm last.

          Last in reading order is the last thing read before acting, which is
          where the committing action belongs — and because the row is a flex
          row, "last" becomes the left in Arabic with nothing in this file
          naming a side.

          Both are secondary. There is no primary here and that is decision
          020's refusal showing through: a primary fill on "Cancel trip" would
          be the destructive variant arriving under a different name, and a
          primary on "Keep trip" would push the safe answer at somebody who
          might genuinely want the other one. The label is the signal.
        */}
        <div className="mz-dialog__actions">
          <Button variant="secondary" onClick={onDismiss}>
            {dismissLabel}
          </Button>

          {onConfirm && confirmLabel ? (
            <Button variant="secondary" onClick={onConfirm}>
              {confirmLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </dialog>
  )
}
