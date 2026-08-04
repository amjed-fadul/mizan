import { useMode } from '../lib/mode'
import { LANG_NAME, s, ui } from '../lib/strings'
import type { Lang } from '../lib/strings'
import { Run } from './Run'

type Option<T extends string> = { value: T; label: string; lang?: Lang }

function Segmented<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
  ambient
}: {
  /** Stable, script-independent id fragment. The visible legend is localised. */
  name: string
  legend: string
  options: Option<T>[]
  value: T
  onChange: (next: T) => void
  ambient: Lang
}) {
  return (
    <div className="mz-control">
      <span className="mz-control__label" id={`mz-control-${name}`}>
        <Run text={legend} ambient={ambient} />
      </span>
      <div className="mz-seg" role="group" aria-labelledby={`mz-control-${name}`}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            <Run text={option.label} ambient={option.lang ?? ambient} />
          </button>
        ))}
      </div>
    </div>
  )
}

export function Controls() {
  const mode = useMode()
  const lang = mode.lang

  return (
    <header className="mz-bar">
      <div className="mz-wrap mz-bar__inner">
        <div className="mz-bar__mark">
          <strong>
            <Run text={s(ui.brand, lang)} ambient={lang} />
          </strong>
          <span>
            <Run text={s(ui.stage, lang)} ambient={lang} />
          </span>
        </div>

        <Segmented
          name="theme"
          legend={s(ui.controls.theme, lang)}
          ambient={lang}
          value={mode.theme}
          onChange={mode.setTheme}
          options={[
            { value: 'light', label: s(ui.controls.light, lang) },
            { value: 'dark', label: s(ui.controls.dark, lang) }
          ]}
        />

        <Segmented
          name="product"
          legend={s(ui.controls.product, lang)}
          ambient={lang}
          value={mode.product}
          onChange={mode.setProduct}
          options={[
            { value: 'market', label: s(ui.controls.market, lang) },
            { value: 'move', label: s(ui.controls.move, lang) }
          ]}
        />

        <Segmented
          name="direction"
          legend={s(ui.controls.direction, lang)}
          ambient={lang}
          value={mode.direction}
          onChange={mode.setDirection}
          options={[
            { value: 'ltr', label: 'LTR', lang: 'en' },
            { value: 'rtl', label: 'RTL', lang: 'en' }
          ]}
        />

        <Segmented
          name="language"
          legend={s(ui.controls.language, lang)}
          ambient={lang}
          value={mode.lang}
          onChange={mode.setLang}
          options={[
            // Each language names itself in its own script, which is also the
            // smallest possible demonstration of a mixed-direction control.
            { value: 'en', label: LANG_NAME.en, lang: 'en' },
            { value: 'ar', label: LANG_NAME.ar, lang: 'ar' }
          ]}
        />
      </div>
    </header>
  )
}
