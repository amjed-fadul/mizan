import type { ReactNode } from 'react'
import '../styles/focus.css'
import './Navigation.css'

/** The properties Navigation exposes. */
export interface NavigationProps {
  /**
   * What this navigation is *for* — "Main", "Account", "Footer".
   *
   * Required, and it becomes `aria-label` on the `<nav>`. A page may hold more
   * than one navigation landmark, and a screen-reader user listing the
   * landmarks of a page hears "navigation, navigation, navigation" unless each
   * one says which it is.
   *
   * **Do not include the word "navigation".** The role already says that, so
   * `label="Main navigation"` is announced as "Main navigation navigation".
   *
   * A `string` rather than a `ReactNode`, because it becomes an attribute.
   */
  label: string

  /** The destinations, each a `NavigationItem`. */
  children: ReactNode

  /**
   * A rule between destinations.
   *
   * This is the replacement for v0's separator, which is a literal `|`
   * character sitting in the markup between the links. Two things are wrong
   * with that and only one of them is visual: a pipe is **content**, so it is
   * in the accessibility tree and read out, and it is a **neutral character**
   * in Unicode's bidirectional algorithm, so in an Arabic layout it reorders
   * with whatever surrounds it rather than staying put.
   *
   * Here the separator is a `border-inline-start` — a box decoration rather
   * than content, invisible to a screen reader, and on the inline axis, so it
   * moves to the other side of the item in Arabic with nothing naming a side.
   */
  separators?: boolean
}

/** The properties NavigationItem exposes. */
export interface NavigationItemProps {
  /** Where it goes. */
  href: string

  /**
   * This is the page the user is on.
   *
   * Sets `aria-current="page"`, which is the only thing that tells assistive
   * technology where in the site the user currently is. v0 has none: nothing in
   * any of its five copied navigation rows marks the current page, so the
   * answer to "where am I" is available only to somebody who can see which link
   * is a different colour — and in v0 not even that, because none of them is.
   *
   * The current item stays a **link**, not a span. It is still somewhere the
   * user can go — reloading a page is a real thing to want — and removing the
   * link would take it out of the tab order, which changes how many stops the
   * navigation has depending on which page you are on.
   */
  current?: boolean

  /** The label. */
  children: ReactNode
}

/**
 * The way around a product — a `<nav>` landmark holding a list of destinations.
 *
 * ## What v0 has instead
 *
 * A pipe-separated row of links, **copy-pasted into five screens**:
 *
 * ```tsx
 * <Link to="/">Home</Link> | <Link to="/market">Grocery</Link> |{' '}
 * <Link to="/market/cart">Cart</Link> | <Link to="/move">Mizan Move</Link>
 * ```
 *
 * Three defects, none of them cosmetic:
 *
 * - **No `<nav>` anywhere in the application.** Not one landmark, so a
 *   screen-reader user cannot jump to the navigation and cannot skip past it.
 * - **No `aria-current`, anywhere.** Nothing marks the current page, in any of
 *   the five copies.
 * - **The separator is a literal `|`.** It is content, so it is announced; and
 *   it is a Unicode-neutral character, so in an Arabic layout it reorders with
 *   its surroundings instead of staying between two things.
 *
 * ## Why this is one component when the cards were two
 *
 * [Decision 024](../../../../decisions/024-productcard-and-ridecard-stay-separate.md)
 * refused to merge `ProductCard` and `RideCard`, and set out the test for why.
 * Navigation is the same test producing the opposite answer, which is the point
 * of having a test rather than a preference:
 *
 * | | ProductCard vs RideCard | Market nav vs Move nav |
 * |---|---|---|
 * | What element is it? | container vs **control** | landmark, **both** |
 * | How many tab stops? | several vs **one** | one per destination, **both** |
 * | Does the other product have the concept? | **no** — no fares in Market | **yes** — both need a way around |
 *
 * Three matching answers, so one component. The links differ; the thing does
 * not.
 *
 * @example
 * ```tsx
 * <Navigation label="Main">
 *   <NavigationItem href="/market" current>Grocery</NavigationItem>
 *   <NavigationItem href="/market/cart">Cart</NavigationItem>
 *   <NavigationItem href="/move">Mizan Move</NavigationItem>
 * </Navigation>
 * ```
 */
export function Navigation({ label, children, separators = false }: NavigationProps) {
  const className = ['mz-nav', separators ? 'mz-nav--separators' : null]
    .filter(Boolean)
    .join(' ')

  return (
    <nav className={className} aria-label={label}>
      {/*
        A list inside the landmark, so the destinations are counted — "list, 4
        items" — and a user knows how much navigation there is before walking
        through it.

        role="list" is written for the same reason List does it, and it is the
        SECOND occurrence of that fix in this library: the stylesheet removes
        the markers, and WebKit is documented as dropping the implicit role when
        they go. The two live apart rather than in a shared helper because what
        is shared is one attribute and one declaration, and a module holding
        those would be harder to read than the two lines it replaced. The
        trigger for reconsidering is a third occurrence, and List.css and this
        file both say so.
      */}
      <ul className="mz-nav__list" role="list">
        {children}
      </ul>
    </nav>
  )
}

/** One destination in a {@link Navigation}. */
export function NavigationItem({ href, current = false, children }: NavigationItemProps) {
  return (
    <li className="mz-nav__item">
      <a
        className="mz-nav__link mz-focus-ring"
        href={href}
        /*
          `page`, not `true`. aria-current takes a token, and `page` is the one
          that means "this is the page you are on" — `true` is the generic
          fallback for a currency the vocabulary has no word for. A navigation
          always has the word.

          undefined rather than false, because aria-current="false" is a stated
          claim that this is NOT the current page, on every other item, which is
          noise on a landmark whose whole job is to say where one thing is.
        */
        aria-current={current ? 'page' : undefined}
      >
        {children}
      </a>
    </li>
  )
}
