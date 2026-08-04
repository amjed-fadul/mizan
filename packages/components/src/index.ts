/**
 * @mizan/components — Mizan's component library.
 *
 * Four components, and the set is deliberately not five.
 *
 * The library exists at all because decision 020 settled that v0's four button
 * implementations become one. Input is the second, and it tested whether the
 * vocabulary generalised: it reads the same `control.{sm,md,lg}.*` steps
 * decision 022 made per-product, and it needed one name the token layer did not
 * have — decision 023 added `text.error` and `border.error` for it.
 *
 * `ProductCard` and `RideCard` are the third and fourth, and they are two
 * rather than one on purpose. Decision 024 refused the merge on a structural
 * argument: a radio may not contain a button, so Market's container — a link
 * and an action, two tab stops — and Move's control — one option in an
 * exclusive choice, one tab stop — cannot be one component with a variant.
 * That refusal is what lets each of them name its own product's tokens, which a
 * shared card could not have reached under decision 007.
 *
 * Consumers import the token stylesheet once, and then the components:
 *
 *   import '@mizan/tokens/tokens.css'
 *   import { Button, Input } from '@mizan/components'
 *
 * A component brings its own CSS with it — Button.tsx imports Button.css — so
 * there is no way to render one without its styles. The *token* stylesheet is a
 * peer requirement rather than an import from inside this package, and that is
 * deliberate: a library that pulls in the whole token layer on the consumer's
 * behalf has decided for them which modes are on the page, and the mode
 * attributes are the application's to set.
 */
export { Button } from './Button'
export type { ButtonProps, ButtonSize, ButtonVariant } from './Button'

export { Dialog } from './Dialog'
export type { DialogProps } from './Dialog'

export { Input } from './Input'
export type { InputProps, InputSize, InputType, InputValueDirection } from './Input'

export { List, ListItem } from './List'
export type { ListProps, ListItemProps } from './List'

export { ProductCard } from './ProductCard'
export type { ProductCardProps, StockLevel } from './ProductCard'

export { RideCard, RideCardGroup } from './RideCard'
export type { RideCardProps, RideCardGroupProps, FareBasis } from './RideCard'
