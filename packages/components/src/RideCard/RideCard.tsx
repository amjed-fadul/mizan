import { Children, cloneElement, isValidElement, useId } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import '../styles/focus.css'
import './RideCard.css'

/**
 * How the fare should be read — as an estimate, or as a settled price.
 *
 * v0's `Fare` component takes an `estimate` boolean and Move's booking screen
 * passes `true` for every option, which is correct and is worth keeping as a
 * decision rather than a default: a fare quoted before a trip is provisional,
 * it moves with traffic and demand, and a rider who reads it as fixed and is
 * charged more has been misled by the interface rather than by the price.
 *
 * `'settled'` exists for the screens Move does not have yet — a completed trip,
 * a scheduled booking at a locked rate. It is here so that the day one arrives,
 * the answer is a value on this union rather than a second component.
 */
export type FareBasis = 'estimate' | 'settled'

/**
 * The properties RideCard exposes.
 *
 * Closed on the same terms as Button's and Input's: no `className`, no `style`,
 * no width. It does not extend `InputHTMLAttributes` even though it renders a
 * radio, because that would hand back `size` — a width in characters — and
 * `content/rules/rtl-arabic.md` §6 names that as the prop that clips Arabic.
 */
export interface RideCardProps {
  /**
   * The value this option submits, and what `onChange` reports. Unique within
   * the group.
   */
  value: string

  /**
   * The group name. **Every card in one choice shares it**, and that shared name
   * is what makes the browser treat them as one radio group: a single tab stop
   * for the whole set, arrow keys moving between options, and exactly one
   * chosen. None of that is implemented here — it is the platform's, and it is
   * the reason this component is a real `<input type="radio">` rather than a
   * `div` with `role="radio"` and a key handler that would have to reimplement
   * all of it.
   *
   * `RideCardGroup` sets this for its children, so a call site normally does not.
   */
  name?: string

  /** Whether this option is the chosen one. */
  checked?: boolean

  /**
   * The vehicle, as the rider will recognise it at the curb — "Toyota Camry".
   *
   * A `ReactNode` rather than a string so it can carry a `<bdi>`-wrapped run.
   * A vehicle name is Latin in an Arabic interface more often than not, and §3
   * is explicit that a run of opposite-direction content inside a sentence is
   * isolated rather than hoped about.
   */
  vehicle: ReactNode

  /**
   * The tier — Economy, Comfort, XL, Electric.
   *
   * Taken as a node rather than mapped from a key inside this component. v0
   * holds a `RIDE_TYPE_LABELS` object and falls back to the raw key when a type
   * is missing from it, which means an unrecognised tier renders as `economy`
   * in the middle of a translated interface. A label is a string from the
   * catalogue and the catalogue is not this component's business.
   */
  rideType: ReactNode

  /**
   * How far away the vehicle is, already formatted.
   *
   * **Not a number.** v0 writes `etaMinutes + ' min away'`, which is English
   * concatenation with nowhere to put a plural category — and Arabic has six,
   * including a dual, so "2 minutes" is not "3 minutes" with the number
   * swapped. `content/rules/rtl-arabic.md` §4 puts every number behind one
   * formatting boundary and records duration formatting as blocked on a string
   * catalogue. This prop takes what that boundary produced.
   */
  eta: ReactNode

  /**
   * The fare, already formatted by the §4 boundary — `AED 24.00`, or
   * `24.00 د.إ` in Arabic, with the symbol placed by `Intl` rather than
   * concatenated.
   */
  fare: ReactNode

  /**
   * Whether the fare is an estimate or settled. Defaults to `'estimate'`,
   * because that is what every fare Move currently shows actually is.
   */
  fareBasis?: FareBasis

  /**
   * Why the fare is higher than usual, when it is — Move's surge note.
   *
   * Painted in `mobility.surge`, which this component is allowed to reference
   * and a shared one is not. That permission is a consequence of decision 024
   * rather than an incidental convenience: keeping this component Move's is
   * what lets it name Move's tokens.
   */
  surgeNote?: ReactNode

  /**
   * Seat capacity, already formatted — "4 seats".
   *
   * A node for the same reason `eta` is: v0 writes `seats + ' seats'` with a
   * hand-written special case for `1 seat`, which is a two-category plural
   * rule in a product that ships a six-category language.
   */
  capacity?: ReactNode

  /** Chosen. Reports the `value` of whichever card the user picked. */
  onChange?: (value: string, event: ChangeEvent<HTMLInputElement>) => void

  /** The option is not available — no vehicle of this tier nearby. */
  disabled?: boolean
}

/**
 * Move's ride option — **one radio in a group**, not a card that happens to be
 * clickable.
 *
 * ## What it is
 *
 * A real `<input type="radio">` visually hidden inside a `<label>` that draws
 * the card. The label *is* the target, so the whole card is clickable and the
 * radio carries the semantics.
 *
 * ## What that fixes
 *
 * v0's `RideCard` is a `<div onClick>` rendered four times on the booking
 * screen, and the Stage 1 audit counted it as 4 of the 24 keyboard-unreachable
 * elements in the app — *"a keyboard user cannot change from the Economy
 * default"*. Not a styling problem: the ride selector is the screen, and it
 * could not be operated without a pointer.
 *
 * Everything that replaces it comes from the platform rather than from code
 * here: one tab stop for the group, arrow keys between options, `aria-checked`,
 * and the disabled semantics. A `div` with `role="radio"` would have had to
 * reimplement each of those, and the audit is a record of what happens to the
 * ones nobody remembers.
 *
 * ## Why it is not `ProductCard` with a variant
 *
 * [Decision 024](../../../../decisions/024-productcard-and-ridecard-stay-separate.md).
 * A card whose whole surface selects it cannot also contain an independently
 * operable button, and Market's product card contains one. The
 * two are a control and a container, and no prop bridges that.
 *
 * @example The group, which is how this is always used
 * ```tsx
 * <RideCardGroup label="Choose a ride" value={ride} onChange={setRide}>
 *   <RideCard value="economy" vehicle="Toyota Yaris" rideType="Economy"
 *             eta="3 min away" fare="AED 24.00" capacity="4 seats" />
 *   <RideCard value="comfort" vehicle="Toyota Camry" rideType="Comfort"
 *             eta="5 min away" fare="AED 38.00" capacity="4 seats"
 *             surgeNote="Higher demand in your area right now" />
 * </RideCardGroup>
 * ```
 */
export function RideCard({
  value,
  name,
  checked,
  vehicle,
  rideType,
  eta,
  fare,
  fareBasis = 'estimate',
  surgeNote,
  capacity,
  onChange,
  disabled = false
}: RideCardProps) {
  const id = useId()
  const surgeId = `${id}-surge`

  const className = ['mz-ride-card', 'mz-focus-ring-within', disabled ? 'mz-ride-card--disabled' : null]
    .filter(Boolean)
    .join(' ')

  return (
    <label className={className} htmlFor={id}>
      {/*
        The radio is visually hidden and NOT display:none — a hidden-by-display
        input is removed from the accessibility tree and from the tab order,
        which would reintroduce the exact defect this component exists to fix.
        The .mz-ride-card__input rule in the stylesheet is the clip-rect
        technique, and the focus ring is drawn on the card from :has() rather
        than on the input nobody can see.
      */}
      <input
        className="mz-ride-card__input"
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        aria-describedby={surgeNote ? surgeId : undefined}
        onChange={(event) => onChange?.(value, event)}
      />

      <span className="mz-ride-card__top">
        <span className="mz-ride-card__vehicle">{vehicle}</span>
        <span className="mz-ride-card__type">{rideType}</span>
      </span>

      <span className="mz-ride-card__row">
        <span className="mz-ride-card__eta">{eta}</span>
        {capacity ? <span className="mz-ride-card__capacity">{capacity}</span> : null}
      </span>

      <span className="mz-ride-card__row">
        <span className="mz-ride-card__fare" data-basis={fareBasis}>
          {fare}
        </span>
      </span>

      {surgeNote ? (
        /*
          Described-by rather than merely adjacent. A rider choosing between
          options needs to know this one is surging *while they are on it*, and
          a note that is only visually near the card is a note a screen-reader
          user meets after they have already chosen.
        */
        <span className="mz-ride-card__surge" id={surgeId}>
          {surgeNote}
        </span>
      ) : null}
    </label>
  )
}

/** The properties RideCardGroup exposes. */
export interface RideCardGroupProps {
  /**
   * What the group is asking — "Choose a ride".
   *
   * Required, and rendered as a real `<legend>`. A radio group without an
   * accessible name is a set of options with no question attached to them, and
   * a screen-reader user arriving at it is told "Economy, radio button, 1 of 4"
   * with no indication of what is being chosen.
   */
  label: ReactNode

  /** The chosen value. */
  value?: string

  /** Chosen. Reports the value of whichever card the user picked. */
  onChange?: (value: string, event: ChangeEvent<HTMLInputElement>) => void

  /**
   * The group name shared by every radio in it. Generated when not given, which
   * is the normal case — the name only has to be unique on the page, and a
   * call site inventing one is a call site that can collide with another group.
   */
  name?: string

  /** The `RideCard`s. */
  children: ReactNode
}

/**
 * The group a `RideCard` lives in — a real `<fieldset>` with a `<legend>`.
 *
 * It exists for one reason that is not styling: **a radio group needs an
 * accessible name**, and `fieldset`/`legend` is the way to give a set of
 * controls one without inventing ARIA. v0 has no equivalent — the four ride
 * cards sit in a bare `div`, so the question they answer is on screen as a
 * heading and absent from the accessibility tree.
 *
 * It also owns the `name` and the `checked` wiring, so a call site does not
 * repeat either per card and cannot get them inconsistent.
 */
export function RideCardGroup({
  label,
  value,
  onChange,
  name,
  children
}: RideCardGroupProps) {
  const generatedName = useId()
  const groupName = name ?? generatedName

  return (
    <fieldset className="mz-ride-card-group">
      <legend className="mz-ride-card-group__legend">{label}</legend>
      <div className="mz-ride-card-group__options">
        {/*
          The children are cloned to receive name, checked and onChange rather
          than being asked to carry them. A call site repeating name="ride" on
          four cards is a call site where the fifth is added with a typo and
          silently becomes its own group of one — which looks like a radio that
          will not deselect its neighbour, and is the kind of defect nobody
          finds by reading.
        */}
        {mapRideCards(children, groupName, value, onChange)}
      </div>
    </fieldset>
  )
}

/**
 * Wire each RideCard child to the group.
 *
 * Kept as a function rather than inlined so the one piece of cleverness in this
 * file — cloning children to inject props — is named and findable. Anything
 * that is not a RideCard passes through untouched, so a group may hold a
 * separator or a message without this throwing.
 */
function mapRideCards(
  children: ReactNode,
  name: string,
  value: string | undefined,
  onChange: ((value: string, event: ChangeEvent<HTMLInputElement>) => void) | undefined
): ReactNode {
  return Children.map(children, (child) => {
    if (!isValidElement<RideCardProps>(child) || child.type !== RideCard) return child
    return cloneElement(child, {
      name,
      checked: value === undefined ? child.props.checked : child.props.value === value,
      onChange: child.props.onChange ?? onChange
    })
  })
}
