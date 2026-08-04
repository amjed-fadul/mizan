import type { ReactNode } from 'react'
import './List.css'

/** The properties List exposes. */
export interface ListProps {
  /**
   * The rows. Each one should be a `ListItem`; anything else is rendered as
   * given, which is how a separator or an empty-state message gets in.
   */
  children: ReactNode

  /**
   * Whether the order of the rows carries meaning — renders `<ol>` instead of
   * `<ul>`.
   *
   * The test is not "are they in an order", because everything on a screen is.
   * It is whether **the position is part of what the row means**: the steps of
   * a checkout, a ranked result, the legs of a trip. A cart is not ordered — a
   * user does not think of the third thing they added as third — and an `<ol>`
   * there tells a screen-reader user "item 3 of 7" about a number that means
   * nothing.
   */
  ordered?: boolean

  /**
   * A line between rows.
   *
   * Drawn with `border.default`, which is the token designed for exactly this —
   * its own description reads *"a card outline, a divider between list rows"* —
   * and which is declared `decorative` in `pairs.json`, so its 1.48:1 is
   * measured and reported and nothing gates it. That is correct for a divider
   * and would be wrong for anything that identified a control.
   */
  dividers?: boolean

  /**
   * An accessible name, when the list has no visible heading beside it.
   *
   * Prefer a visible heading and leave this alone. A name only assistive
   * technology can reach is a name a sighted user cannot use to say "the one
   * under Saved addresses", and it is the second-best answer in every case
   * except the one where there is genuinely nothing on screen to point at.
   *
   * A `string` rather than a `ReactNode`, because it becomes `aria-label` and
   * an attribute cannot hold an element.
   */
  label?: string
}

/** The properties ListItem exposes. */
export interface ListItemProps {
  /** The row's content. A `ProductCard`, a cart line, a sentence. */
  children: ReactNode
}

/**
 * A list of rows, with the list semantics the platform gives and CSS quietly
 * takes away.
 *
 * ## What v0 has instead
 *
 * Five mapped collections and **not one `<ul>`**. The cart lines, the product
 * grid and the filter row are all bare `<div>`s; the only semantic list in the
 * whole application is the developer index on the home screen. A screen-reader
 * user is told nothing about how many things there are or where they are among
 * them — no "list, 7 items", no "item 3 of 7".
 *
 * ## Why this is a component and not a `<ul>` somebody remembers to write
 *
 * Because of one line of CSS that every styled list needs and that silently
 * removes the semantics it was styling:
 *
 * ```css
 * ul { list-style: none }
 * ```
 *
 * — and the list stops being a list.
 *
 * WebKit is documented as dropping the implicit `list` role when list markers
 * are removed — the reasoning being that a list without markers was probably
 * not meant as one — so a list styled the way every design system styles it is
 * announced as a run of ordinary text. `role="list"` restores it and is inert
 * everywhere that never removed it.
 *
 * **Stated as received rather than as measured:** the preview this was
 * developed against is Chromium, which keeps the role either way, so the
 * behaviour this guards against could not be reproduced here. That is why the
 * attribute is written unconditionally rather than behind any engine test — it
 * costs nothing where it is unnecessary, and the failure it prevents is
 * invisible to everybody who cannot hear it.
 *
 * That is the whole argument for the component: one platform trap, fixed once,
 * where a pattern would be fixed by whoever remembered.
 *
 * @example A cart
 * ```tsx
 * <List dividers label="Your cart">
 *   {lines.map((line) => (
 *     <ListItem key={line.id}>
 *       <CartLine {...line} />
 *     </ListItem>
 *   ))}
 * </List>
 * ```
 *
 * @example Steps, where the position is part of the meaning
 * ```tsx
 * <List ordered>
 *   <ListItem>Choose a delivery window</ListItem>
 *   <ListItem>Confirm your address</ListItem>
 *   <ListItem>Pay</ListItem>
 * </List>
 * ```
 */
export function List({ children, ordered = false, dividers = false, label }: ListProps) {
  const className = ['mz-list', dividers ? 'mz-list--dividers' : null]
    .filter(Boolean)
    .join(' ')

  const Element = ordered ? 'ol' : 'ul'

  return (
    <Element
      className={className}
      /*
        Written unconditionally. `list-style: none` in the stylesheet is what
        makes it necessary, and the two belong together — a future edit that
        removes the CSS should have to look at this line and decide, rather than
        leaving an attribute nobody can explain.

        `role="list"` on an <ol> is deliberate too: the same marker-removal
        applies, and `list` is the correct role for an ordered list in ARIA.
        There is no separate `orderedlist` role — the ordering is carried by the
        element, which is why `ordered` changes the element rather than the role.
      */
      role="list"
      aria-label={label}
    >
      {children}
    </Element>
  )
}

/**
 * One row of a {@link List}.
 *
 * It exists so a call site cannot forget the `<li>`. A `<div>` inside a `<ul>`
 * is invalid, and the failure is the quiet kind: it usually looks right, and
 * the row stops being counted.
 */
export function ListItem({ children }: ListItemProps) {
  return <li className="mz-list__item">{children}</li>
}
