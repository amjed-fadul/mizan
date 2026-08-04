/**
 * @mizan/components — Mizan's component library.
 *
 * One component so far. The library exists at all because decision 020 settled
 * that v0's four button implementations become one, and a consolidated
 * component needs somewhere to live that is neither the token build output nor
 * the preview app.
 *
 * Consumers import the token stylesheet once, and then the component:
 *
 *   import '@mizan/tokens/tokens.css'
 *   import { Button } from '@mizan/components'
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
