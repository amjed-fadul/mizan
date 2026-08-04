/**
 * @mizan/components — Mizan's component library.
 *
 * Two components. The library exists at all because decision 020 settled that
 * v0's four button implementations become one, and a consolidated component
 * needs somewhere to live that is neither the token build output nor the
 * preview app. Input is the second, and it is the test of whether the
 * vocabulary Button established generalises: it reads the same
 * `control.{sm,md,lg}.*` steps decision 022 made per-product, and it needed one
 * name the token layer did not have — decision 023 added `text.error` and
 * `border.error` for it.
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
export { Input } from './Input'
export type { InputProps, InputSize, InputType, InputValueDirection } from './Input'
