/**
 * A fixture component the contract reader refuses.
 *
 * Its props type is outside the declared subset in three separate ways, and
 * each one is a thing a real props declaration does that this reader cannot
 * describe honestly. The point of the fixture is that it is *refused by name*
 * rather than half-read: a contract generated from the members it happened to
 * understand would look exactly like one generated from all of them.
 */
export interface SprawlProps {
  /** An index signature. There is no prop here to name. */
  [key: string]: unknown

  /** An inline object literal — an anonymous shape nothing else can name. */
  layout?: { inline: number; block: number }

  /** A call signature. */
  (value: string): void
}

export function Sprawl(props: SprawlProps) {
  return null
}
