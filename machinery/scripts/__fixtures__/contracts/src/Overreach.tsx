/**
 * A fixture component whose authored half reaches across the line.
 *
 * There is nothing wrong with this file. The defect is in
 * `refused/authored/overreach.json`, which states a prop's type and a prop's
 * default — two facts this source already carries — and generation refuses it.
 */
export interface OverreachProps {
  /** How loud. */
  tone?: 'plain' | 'loud'

  /** The label. */
  label: string
}

export function Overreach({ tone = 'plain', label }: OverreachProps) {
  return null
}
