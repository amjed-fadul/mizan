import type { MouseEvent, ReactNode } from 'react'
import './Button.css'

/**
 * The appearance of a button, and only its appearance.
 *
 * v0 called this axis three different things — `type` on `shared/Button`,
 * `variant` on Market's `PrimaryButton`, `kind` on Move's `ActionButton` — so
 * the same idea had three names and a component could not be moved between
 * products without a rename. It is `variant` everywhere now.
 *
 * There is no `confirm` and no `cancel`. Those are the semantics of the action,
 * not its appearance: a cancel is sometimes the quiet option and sometimes the
 * loud one, and encoding that in the paint means the screen cannot change its
 * mind without changing its markup. Move's `kind="confirm"` becomes
 * `variant="primary"` and `kind="cancel"` becomes `variant="secondary"`, which
 * is what they were drawn as.
 *
 * There is no destructive variant either. The token layer has no action-danger
 * semantic — `mobility.safety` and `commerce.discount` are text colours with
 * their own meanings, not a fill for a control — and one is not invented here.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost'

/**
 * The size step, which is padding and type size and nothing else.
 *
 * `md` and `lg` guarantee a hit target of at least 44×44 CSS px. `sm` does not
 * and is not meant to: it clears WCAG 2.2 2.5.8 (Target Size Minimum) but not
 * 2.5.5, and it belongs only where 2.5.8 itself grants an exception — inline
 * within a run of text, or where an equivalent full-size control for the same
 * action is on the same screen.
 *
 * Decision 020: `size` names the **step**, and the product mode decides what
 * the step resolves to — the shape 007 and 008 settled for `text.secondary`.
 * That half is decided and owed. The two product mode files differ by exactly
 * three tokens and all three are colour, so no control geometry resolves by
 * product today and both products' buttons are currently the same size at the
 * same step. A visible temporary regression against v0, recorded rather than
 * hidden. See the Variants section of ./README.md.
 *
 * A `density` prop is not the workaround. It would push the choice onto every
 * call site and let a Market screen ask for Move's geometry, which is the drift
 * the mode system exists to prevent.
 */
export type ButtonSize = 'sm' | 'md' | 'lg'

/**
 * The properties Button exposes. The list is closed on purpose — see the
 * Constraints section of ./README.md. It does not extend
 * `ButtonHTMLAttributes`, because that would hand back `style`, `className` and
 * `width`, and content/rules/rtl-arabic.md §6 is explicit that a component does
 * not take a width: a control sized to Latin ink clips Arabic, and the prop
 * that causes it is usually named `width` and sometimes named `size`.
 */
export interface ButtonProps {
  /**
   * Which of the three appearances to paint. Defaults to `'secondary'`, which
   * is the one that assumes the least: a primary is a claim that this is *the*
   * action on the screen, and a default that makes that claim silently produces
   * screens with four primary actions on them.
   */
  variant?: ButtonVariant

  /**
   * The size step. Defaults to `'md'`, the only default that guarantees the
   * 44×44 hit target.
   */
  size?: ButtonSize

  /**
   * The **HTML `type` attribute**, and nothing else. Defaults to `'button'`.
   *
   * This is the prop the whole API renaming was for, and the defect has two
   * halves. Decision 020 states both, and the second is the sharper one.
   *
   * The obvious half: v0's `shared/Button` took `type` for its variant and
   * never passed the real attribute, so seventeen of the twenty-five call sites
   * render `type="submit"` by omission while Market's visually identical button
   * renders eight that do not. It has never fired, because `legacy/src` contains
   * no `<form>` element at all — luck rather than design, and the difference is
   * sitting in the rendered DOM waiting for the first form somebody wraps
   * around a checkout.
   *
   * The half that needs no form: because `type` was spent on the variant,
   * `shared/Button` **cannot express a submit button at all.** The prop name did
   * not merely risk confusion, it consumed a platform capability and left no way
   * to ask for it back.
   *
   * So `type` here means what it means in HTML, it is always set explicitly, and
   * `'submit'` is available and has to be asked for.
   */
  type?: 'button' | 'submit' | 'reset'

  /**
   * The action is in flight.
   *
   * Sets `aria-busy`, blocks activation, and does not change the size of the
   * control — the label keeps its box and the indicator shares its grid cell,
   * so the button is exactly as wide while it is working as it was a moment
   * before the press.
   *
   * A loading button stays focusable and keeps its accessible name. It is
   * `aria-disabled`, not `disabled`: a control that sets the real attribute on
   * itself mid-action throws focus to `<body>` and a keyboard user loses their
   * place at the moment they most need it.
   *
   * **The label does not change.** v0's `ActionButton` replaces its children
   * with the hard-coded English string `'Please wait'`, in a product that ships
   * Arabic, and decision 020 hands that question here rather than inheriting the
   * answer. A substituted label is a *string*, a string needs the catalogue, and
   * content/rules/rtl-arabic.md records the catalogue as blocked on a content
   * commitment. So Button does not author one. The label it was given stays the
   * accessible name for the whole of the busy state, and the state itself is
   * carried by `aria-busy` — the one channel that is already localised, because
   * the screen reader announces it in the user's language rather than in ours.
   */
  loading?: boolean

  /**
   * An optional icon, placed before the label in reading order. It mirrors with
   * `dir` because the row is a flex row and flex flips — there is no second
   * rule and no `[dir='rtl']` selector anywhere in this component.
   *
   * Whether the icon's own glyph mirrors is the icon's flag, never Button's.
   * content/rules/rtl-arabic.md §5: arrows mirror, maps and play triangles and
   * brand marks do not, and the default is *do not*.
   *
   * The icon is decorative. `children` is required, so there is always a label
   * and the icon never has to carry the accessible name.
   */
  icon?: ReactNode

  /**
   * Fill the inline extent of the container.
   *
   * Not a width. §6 says a component does not take one; this says "as wide as
   * where you put me", which is a statement about the container rather than a
   * number about the label.
   */
  fullWidth?: boolean

  /**
   * The action is not available. Sets the real `disabled` attribute, so it
   * reaches assistive technology through the platform rather than through an
   * ARIA restatement of it.
   *
   * The disabled appearance is a declared pair of tokens — text.secondary on
   * surface.sunken — and not an opacity. v0 uses `opacity: 0.5` in all three
   * stylesheets, which renders a colour no token declares and therefore a
   * contrast ratio the gate cannot see.
   */
  disabled?: boolean

  /**
   * The label. Required: a button with no accessible name is not a button, and
   * making the label optional is how icon-only buttons end up unnamed.
   *
   * No prop shortens it. There is no `maxChars` and no `truncate`, because
   * Arabic has no abbreviations — السبت does not shorten to three letters, and
   * an API that shortens by character count is untranslatable by construction.
   */
  children: ReactNode

  /**
   * The activation handler. Not called while `loading` or `disabled`.
   */
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
}

/**
 * Mizan's Button — one component replacing the four implementations in v0.
 *
 * ## What it is
 *
 * A real `<button>`. Not a `<div>` with a role, not an `<a>` styled as a
 * control: the element brings keyboard activation, the disabled state, the
 * form association and the focus behaviour with it, and every one of those is
 * something a re-implementation gets subtly wrong.
 *
 * ## What it guarantees
 *
 * - **A visible focus indicator on every variant**, including `primary`, where
 *   the ring meets a brand fill. Two tones, from decision 019.
 * - **A hit target of at least 44×44 CSS px at `md` and `lg`.**
 * - **The disabled state reaches assistive technology** through the platform
 *   attribute, and is drawn with a declared token pair rather than an opacity.
 * - **The control does not change size when it becomes busy.**
 * - **Correct behaviour under `dir="rtl"` with no branch.** Every directional
 *   value in this component is derived — logical properties and flex order —
 *   and §6's test for a component is whether any of them is written down.
 *
 * ## What it will not do
 *
 * Take a width, take a height, take a `className`, take a `style`, shorten a
 * string, or paint a colour that `content/tokens/pairs.json` has not seen. Each
 * of those is refused in ./README.md with the reason.
 *
 * @example Primary action
 * ```tsx
 * <Button variant="primary" onClick={checkout}>Checkout</Button>
 * ```
 *
 * @example In a form, submitting it — which has to be asked for
 * ```tsx
 * <Button variant="primary" type="submit">Place order</Button>
 * ```
 *
 * @example While the request is in flight
 * ```tsx
 * <Button variant="primary" loading={pending}>Confirm ride</Button>
 * ```
 *
 * @example Arabic, in an RTL layout — no prop changes
 * ```tsx
 * <div dir="rtl" lang="ar">
 *   <Button variant="primary" icon={<CartIcon />}>أضف إلى السلة</Button>
 * </div>
 * ```
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  type = 'button',
  loading = false,
  icon,
  fullWidth = false,
  disabled = false,
  children,
  onClick
}: ButtonProps) {
  const className = [
    'mz-button',
    `mz-button--${variant}`,
    `mz-button--${size}`,
    fullWidth ? 'mz-button--full-width' : null
  ]
    .filter(Boolean)
    .join(' ')

  // Activation is blocked here rather than by disabling the element, so that a
  // busy button keeps its focus and its name. A real <button> fires click for
  // Enter and Space as well as for the pointer, so this one guard covers the
  // keyboard too — there is no second key handler to keep in step with it.
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (loading || disabled) {
      event.preventDefault()
      return
    }
    onClick?.(event)
  }

  return (
    <button
      type={type}
      className={className}
      disabled={disabled}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={handleClick}
    >
      <span className="mz-button__stack">
        <span className="mz-button__content">
          {icon ? (
            <span className="mz-button__icon" aria-hidden="true">
              {icon}
            </span>
          ) : null}
          <span className="mz-button__label">{children}</span>
        </span>
        {/*
          The busy indicator is decorative and says so. What carries the state
          is aria-busy on the control itself — an assistive technology user is
          told the button is busy, not shown a spinning ring they cannot see.
        */}
        {loading ? <span className="mz-button__busy" aria-hidden="true" /> : null}
      </span>
    </button>
  )
}
