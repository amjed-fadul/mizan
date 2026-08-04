import { useId } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import './Input.css'

/**
 * The kind of value the field holds, expressed as the HTML `type` attribute.
 *
 * Four of these decide the field's direction on their own — see
 * {@link InputProps.valueDirection}. `email`, `tel`, `url` and `password` hold
 * values that are Latin and Western-digit whatever the interface language is,
 * so they default to `dir="ltr"` rather than inheriting an RTL page.
 *
 * **`number` is deliberately absent.** Two reasons, and the second is ours
 * rather than the platform's. The platform one: `type="number"` silently
 * discards values it cannot parse, changes on a scroll wheel over the field,
 * and exposes spinner buttons that are a 12×12 hit target nobody can use.
 * The rule-layer one: content/rules/rtl-arabic.md §4 puts every number on a
 * screen behind one formatting boundary, and a field that parses and reformats
 * its own value is a second boundary that will disagree with the first. A
 * quantity is typed as text with `inputMode="numeric"` and formatted on the way
 * out.
 */
export type InputType = 'text' | 'email' | 'tel' | 'url' | 'password' | 'search'

/**
 * The size step, which is padding and type size and nothing else.
 *
 * The same three steps as Button, resolving through the same
 * `control.{sm,md,lg}.*` semantics that decision 022 made per-product. That is
 * the point of the step being a shared vocabulary rather than a per-component
 * scale: a form's field and its submit button at the same step are the same
 * height in both products, and neither component knows which product it is in.
 *
 * `md` and `lg` guarantee a 44×44 hit target. `sm` does not and is not meant
 * to — it clears WCAG 2.2 2.5.8 at 24×24 and belongs only where 2.5.8 itself
 * grants an exception. `machinery/scripts/check-tap-target.mjs` is what holds
 * all three to those bars in every mode combination.
 */
export type InputSize = 'sm' | 'md' | 'lg'

/**
 * How the field's *value* is directed, which is not how the page is laid out.
 *
 * This is the judgment this component exists to encode, and
 * content/rules/rtl-arabic.md §1 lists exactly three legitimate reasons for a
 * `dir` attribute below the root. Two of them are fields, and both are here.
 *
 * - `'page'` — the value is prose in the interface language. No `dir` is set at
 *   all and the field inherits the page. This is the correct default for a
 *   name, a note, an Arabic address line in an Arabic interface.
 * - `'ltr'` — the value is Latin by nature: an email, a URL, an IBAN, an order
 *   reference, a promo code, a card number. §6 is explicit that this is set
 *   **explicitly** rather than inherited or left to the user agent, and that
 *   the platform covers exactly one of these cases: an `<input type="tel">`
 *   with no `dir` resolves to `ltr` on its own, and `email`, `url`, `search`,
 *   `number` and plain `text` all inherit the page. Verified rather than
 *   assumed. What the user sees without it was rendered rather than reasoned
 *   about: `+971 50 123 4567` in a plain text input on an RTL page paints as
 *   `4567 123 50 971+`, and an email under composition *moves* — `amjed@`
 *   paints as `@amjed`, the `@` jumping to the far end of the field and coming
 *   back once a domain is typed. In every one of these the stored value is
 *   correct and only the painting is wrong, which is exactly why it survives
 *   being tested by somebody reading the value out of state instead of off the
 *   screen.
 * - `'auto'` — the direction genuinely cannot be known: a search query, a
 *   review body, a customer's name typed by that customer. **Opt-in and never a
 *   default**, because of the trap §6 names: `dir="auto"` computes from the
 *   value, an empty value has no strong character, and the specified fallback
 *   is `ltr`. So an Arabic field with an Arabic placeholder opens left-aligned
 *   on an Arabic page and snaps to the right on the first letter typed. Nothing
 *   that matters may depend on where a placeholder sits.
 *
 * The default is derived from `type` rather than fixed: `email`, `tel`, `url`
 * and `password` default to `'ltr'`; `text` and `search` default to `'page'`.
 * Deriving it is what makes the common case correct without a call site having
 * to know the rule — and passing it explicitly is what makes the uncommon case
 * possible, because `type="text"` covers an Arabic note, an order reference and
 * a customer's name, and no attribute can tell those apart.
 */
export type InputValueDirection = 'page' | 'ltr' | 'auto'

/**
 * The properties Input exposes. The list is closed on the same terms as
 * Button's: it does not extend `InputHTMLAttributes`, because that hands back
 * `style`, `className`, `width` and `size` — and `size` on a native input is a
 * width in characters, which is the exact prop
 * content/rules/rtl-arabic.md §6 says is usually the one that clips Arabic.
 */
export interface InputProps {
  /**
   * The label. Required, and a `ReactNode` rather than a string so it can carry
   * a `<bdi>`-wrapped run without this component having to know about
   * direction inside it.
   *
   * There is no unlabelled variant and no `aria-label` prop to substitute for
   * one. A visible label is what lets somebody using speech control say the
   * name they can see, and it is the only one of the accessible-name mechanisms
   * that also serves a sighted user who has forgotten what the field is for.
   *
   * **Instructions belong here, not in the placeholder.** §6: a placeholder is
   * an example of the value, it disappears the moment typing starts, and in an
   * `ltr` field on an Arabic page it is painted hard against the wrong edge.
   */
  label: ReactNode

  /** The HTML `type`. Defaults to `'text'`. */
  type?: InputType

  /** The size step. Defaults to `'md'`, the smallest step that clears 44×44. */
  size?: InputSize

  /**
   * How the value is directed. Defaults are derived from `type` — see
   * {@link InputValueDirection}.
   */
  valueDirection?: InputValueDirection

  /** The controlled value. */
  value?: string

  /** The uncontrolled initial value. */
  defaultValue?: string

  /**
   * An example of the value — `name@example.com`, `+971 50 123 4567`.
   *
   * In the same script as the value, never the interface language, and never
   * carrying an instruction. §6 refuses the common workaround of right-aligning
   * an Arabic placeholder inside an `ltr` field and letting the alignment flip
   * once typing starts: a field that jumps as the first character lands is the
   * defect, not the fix.
   */
  placeholder?: string

  /**
   * Helper text under the field — a format, a constraint, a reassurance.
   * Linked with `aria-describedby`, so it is read when the field takes focus
   * rather than only seen.
   */
  hint?: ReactNode

  /**
   * The value was not accepted.
   *
   * Sets `aria-invalid` and paints the edge with `border.error`. It is
   * deliberately independent of `errorMessage` being present, because a field
   * can be one of several in a group that failed together — but a screen that
   * sets this without ever rendering a message has built a state a user can see
   * and not act on, and that is worth saying out loud rather than enforcing in
   * a type.
   *
   * **Three signals, and no one of them alone.** The edge colour, the message,
   * and `aria-invalid`. Colour alone fails WCAG 1.4.1 for a colour-blind user;
   * a message alone is missed by somebody scanning a long form; `aria-invalid`
   * alone is invisible to everyone looking at the screen. Decision 023 is why
   * the edge is a colour change rather than a heavier line: there is no
   * border-width scale, and a thicker edge is the weakest of the three signals
   * anyway.
   */
  invalid?: boolean

  /**
   * What was wrong and, where possible, what to do about it. Rendered under the
   * field in `text.error` and linked with `aria-describedby`.
   *
   * **This component does not announce it.** There is no `role="alert"` and no
   * live region here, and the omission is deliberate: a field cannot know
   * whether its error arrived because the user is still typing, because they
   * left the field, or because a submit failed, and those want different
   * announcements — the third wants a summary of every failure and a move of
   * focus, which is a form's job and not a field's. `aria-describedby` means
   * the message is read whenever the field is reached. Anything louder belongs
   * to whatever owns the form.
   */
  errorMessage?: ReactNode

  /**
   * The field must be filled. Sets the real `required` attribute so it reaches
   * assistive technology through the platform, and marks the label.
   */
  required?: boolean

  /**
   * The value is shown but not editable. The real `readonly` attribute — the
   * value stays selectable, copyable and reachable by keyboard, which is the
   * whole difference between this and `disabled`.
   */
  readOnly?: boolean

  /**
   * The field is not available. The real `disabled` attribute.
   *
   * Drawn with a declared token pair — `text.secondary` on `surface.sunken` —
   * and not with an opacity. v0 uses `opacity: 0.5`, which renders a colour no
   * token declares and therefore a contrast ratio the gate cannot see.
   */
  disabled?: boolean

  /** Fill the inline extent of the container. Not a width — see §6. */
  fullWidth?: boolean

  /** The form control name, for a field inside a real `<form>`. */
  name?: string

  /**
   * A hint to the on-screen keyboard. Separate from `type` on purpose: a
   * quantity is `type="text"` with `inputMode="numeric"` (see {@link InputType}
   * on why `number` is absent), and a numeric keypad is a convenience rather
   * than a parsing rule.
   */
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'email' | 'url' | 'search'

  /** Change handler. */
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void
}

/** Which types hold a value that is Latin whatever the page is. §6. */
const LATIN_BY_NATURE: ReadonlySet<InputType> = new Set<InputType>([
  'email',
  'tel',
  'url',
  'password'
])

/**
 * Resolve the value's direction, deriving from `type` when nothing was said.
 *
 * `'page'` returns `undefined` rather than a direction: inheriting is what a
 * page-language value should do, and writing `dir="rtl"` to achieve it would be
 * a component deciding a layout, which §1 forbids. The absence is the feature.
 */
function resolveDir(
  type: InputType,
  valueDirection: InputValueDirection | undefined
): 'ltr' | 'auto' | undefined {
  const resolved = valueDirection ?? (LATIN_BY_NATURE.has(type) ? 'ltr' : 'page')
  return resolved === 'page' ? undefined : resolved
}

/**
 * Mizan's Input — a single-line text field.
 *
 * ## What it is
 *
 * A real `<input>` with a real `<label>` bound to it by `id`. Not a `div` with
 * a role, and not a placeholder standing in for a label.
 *
 * ## What it guarantees
 *
 * - **A visible label, always.** `label` is required and has no `aria-label`
 *   escape hatch.
 * - **The value's direction is decided, never inherited by accident.** An email
 *   or a phone number paints left-to-right inside an Arabic page, because §6
 *   says the platform covers only `type="tel"` and we do not rely on it for
 *   the rest.
 * - **A hit target of at least 44×44 at `md` and `lg`**, through the same
 *   `control.*` semantics Button uses and the same gate.
 * - **An invalid state carried by three signals**, never by colour alone.
 * - **Correct behaviour under `dir="rtl"` with no branch.** Every directional
 *   value in the stylesheet is logical, and the one `dir` this component writes
 *   is a statement about content rather than about layout.
 *
 * ## What it will not do
 *
 * Take a width, take a `className`, take a `style`, shorten a string, announce
 * its own error, or paint a colour `content/tokens/pairs.json` has not seen.
 *
 * @example An ordinary field
 * ```tsx
 * <Input label="Full name" value={name} onChange={e => setName(e.target.value)} />
 * ```
 *
 * @example Latin by nature — `dir="ltr"` is derived, not asked for
 * ```tsx
 * <Input label="Email" type="email" placeholder="name@example.com" />
 * ```
 *
 * @example A Latin identifier in a text field, where `type` cannot tell
 * ```tsx
 * <Input label="Order reference" valueDirection="ltr" placeholder="MZ-4417-002" />
 * ```
 *
 * @example Invalid, with all three signals
 * ```tsx
 * <Input
 *   label="Email"
 *   type="email"
 *   invalid
 *   errorMessage="We could not find an account with that address."
 * />
 * ```
 *
 * @example Arabic, in an RTL layout — the label flips, the email does not
 * ```tsx
 * <div dir="rtl" lang="ar">
 *   <Input label="البريد الإلكتروني" type="email" placeholder="name@example.com" />
 * </div>
 * ```
 */
export function Input({
  label,
  type = 'text',
  size = 'md',
  valueDirection,
  value,
  defaultValue,
  placeholder,
  hint,
  invalid = false,
  errorMessage,
  required = false,
  readOnly = false,
  disabled = false,
  fullWidth = false,
  name,
  inputMode,
  onChange
}: InputProps) {
  // One generated id per instance, and the three derived from it. useId rather
  // than a counter or a required `id` prop: a counter is not stable across a
  // server render and a hydration, and a required id makes every call site
  // invent one.
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`

  const showError = invalid && errorMessage !== undefined && errorMessage !== null

  // Order matters to a screen reader: the description is read in the order the
  // ids are listed, and the message about what went wrong belongs after the
  // hint that describes what is wanted.
  const describedBy = [hint ? hintId : null, showError ? errorId : null]
    .filter(Boolean)
    .join(' ')

  const className = [
    'mz-input',
    `mz-input--${size}`,
    invalid ? 'mz-input--invalid' : null,
    fullWidth ? 'mz-input--full-width' : null
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className}>
      {/*
        The supporting text carries `dir="auto"`, and this is the second
        direction decision in the component — separate from the value's, and
        answering a different question.

        content/rules/rtl-arabic.md §3 draws the line: `<bdi>` isolates a RUN
        inside a sentence, but alignment and the end an ellipsis lands at belong
        to the BLOCK, and "a block whose entire content may be in either
        direction carries its own dir". A label, a hint and an error message are
        blocks, and they are the case §3 reserves `auto` for — content whose
        direction genuinely cannot be known, because this component is handed a
        ReactNode and cannot read it.

        Without it the failure is not subtle and was rendered rather than
        reasoned about: the English message "That address is missing everything
        after the @." inside an Arabic page paints as ".@ That address is
        missing everything after the" — the trailing neutrals thrown to the far
        end, which reads as a rendering bug and is the bidirectional algorithm
        working correctly on unmarked content.

        The known weakness is §3's own: `auto` reads the first strong character
        and nothing else, so a message opening with a Latin brand name resolves
        LTR whatever follows it. A caller who KNOWS the direction — and an
        application with a string catalogue nearly always does — should pass a
        node that declares it, which these props accept because they are
        ReactNode rather than string. `auto` is the floor, not the ceiling.
      */}
      <label className="mz-input__label" htmlFor={id} dir="auto">
        {label}
        {required ? (
          /*
            The marker is aria-hidden because `required` on the input already
            tells assistive technology, and an asterisk read aloud as "star" in
            the middle of a label is noise. It is not the only signal either:
            a form whose only indication of a required field is a glyph in one
            colour has said it once, visually, in a way §6's Arabic labels have
            no room for.
          */
          <span className="mz-input__required" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      <input
        id={id}
        className="mz-input__field"
        type={type}
        name={name}
        inputMode={inputMode}
        // The one `dir` this component writes, and it is a statement about the
        // content rather than a layout choice. `undefined` for a page-language
        // value, so the field inherits rather than declaring.
        dir={resolveDir(type, valueDirection)}
        value={value}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        readOnly={readOnly}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy || undefined}
        onChange={onChange}
      />

      {hint ? (
        <p className="mz-input__hint" id={hintId} dir="auto">
          {hint}
        </p>
      ) : null}

      {showError ? (
        <p className="mz-input__error" id={errorId} dir="auto">
          {errorMessage}
        </p>
      ) : null}
    </div>
  )
}
