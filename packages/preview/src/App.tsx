import { useMode } from './lib/mode'
import { LANG_NAME, s, ui } from './lib/strings'
import { Run } from './components/Run'
import { Controls } from './components/Controls'
import { TokenGallery } from './components/TokenGallery'
import { ContrastMatrix } from './components/ContrastMatrix'
import { Deliberate } from './components/Deliberate'
import { Comparison } from './compare/Comparison'

function Hero() {
  const mode = useMode()
  const lang = mode.lang

  const readout = [
    mode.theme === 'light' ? s(ui.controls.light, lang) : s(ui.controls.dark, lang),
    mode.product === 'market' ? s(ui.controls.market, lang) : s(ui.controls.move, lang),
    mode.direction.toUpperCase(),
    LANG_NAME[lang]
  ].join(' · ')

  return (
    <div className="mz-hero mz-wrap">
      <p className="mz-eyebrow">
        <Run text="01" ambient="en" />
      </p>
      <h1 className="mz-h1">
        <Run text={s(ui.stage, lang)} ambient={lang} />
      </h1>
      <p className="mz-prose mz-prose--lead">
        <Run text={s(ui.lede, lang)} ambient={lang} />
      </p>
      <p className="mz-eyebrow">
        <Run text={s(ui.controls.now, lang)} ambient={lang} />
        {' — '}
        <bdi>{readout}</bdi>
      </p>
    </div>
  )
}

function Footer() {
  const { lang } = useMode()
  return (
    <footer className="mz-foot">
      <div className="mz-wrap mz-foot__inner">
        <p className="mz-prose">
          <Run text={s(ui.foot.source, lang)} ambient={lang} />
        </p>
        <p className="mz-prose">
          <Run text={s(ui.foot.quarantine, lang)} ambient={lang} />
        </p>
      </div>
    </footer>
  )
}

export function App() {
  return (
    <div className="mz-app mz-script">
      <Controls />
      <Hero />
      <main className="mz-wrap mz-main">
        <TokenGallery />
        <ContrastMatrix />
        <Deliberate />
        <Comparison />
      </main>
      <Footer />
    </div>
  )
}
