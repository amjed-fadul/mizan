import { langAttr } from '../lib/script'
import type { Lang } from '../lib/strings'

/**
 * One run of text, isolated and script-tagged.
 *
 * `<bdi>` is the isolation: content/rules/rtl-arabic.md §3 says a run of the
 * opposite direction is wrapped, never concatenated into a sentence and hoped
 * for. The class carries the optical size correction and the lang attribute
 * selects it — and langAttr emits the attribute only when the run differs from
 * the language already in force, so the correction is applied exactly once.
 *
 * Deliberately no `dir` attribute. §1: components never set direction. `bdi`
 * resolves the run's own direction from its first strong character, which is the
 * correct answer for a name we did not write and cannot predict.
 */
export function Run({
  text,
  ambient,
  className
}: {
  text: string
  ambient: Lang
  className?: string
}) {
  return (
    <bdi className={className ? `mz-run ${className}` : 'mz-run'} lang={langAttr(text, ambient)}>
      {text}
    </bdi>
  )
}
