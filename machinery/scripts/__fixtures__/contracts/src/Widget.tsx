import type { MouseEvent, ReactNode } from 'react'
import './Widget.css'

/** The three appearances, behind a name, so the alias has to be followed. */
export type WidgetTone = 'plain' | 'loud' | 'quiet'

/**
 * A fixture component. It exists to be read, not to be rendered.
 *
 * Every form the contract reader claims to understand appears here once: an
 * inline string union, a union behind a local alias, a boolean with a default,
 * a required prop with none, a handler whose type contains an arrow, and a
 * deprecated prop carrying its replacement in the tag.
 */
export interface WidgetProps {
  /**
   * Which appearance to paint.
   *
   * A second paragraph, so that the summary and the notes are two things.
   */
  tone?: WidgetTone

  /** How much room it takes. */
  scale?: 'small' | 'large'

  /** Whether it is doing something. */
  busy?: boolean

  /**
   * The label.
   *
   * Required, and with no default, which is the pair the reader has to keep
   * apart from an optional prop that happens to have none.
   */
  label: ReactNode

  /**
   * The old name for the label.
   *
   * @deprecated Use label.
   */
  caption?: ReactNode

  /** A line of help beneath it. */
  hint?: string

  /** Called on activation. */
  onPress?: (event: MouseEvent<HTMLButtonElement>) => void
}

export function Widget({
  tone = 'plain',
  scale = 'small',
  busy = false,
  label,
  caption,
  hint,
  onPress
}: WidgetProps) {
  return null
}
