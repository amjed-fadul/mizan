import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Combination, Product, Theme } from './tokens'
import type { Lang } from './strings'

export type Direction = 'ltr' | 'rtl'

export type ModeState = {
  theme: Theme
  product: Product
  direction: Direction
  lang: Lang
  combination: Combination
  setTheme: (theme: Theme) => void
  setProduct: (product: Product) => void
  setDirection: (direction: Direction) => void
  setLang: (lang: Lang) => void
}

const ModeContext = createContext<ModeState | null>(null)

export function ModeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')
  const [product, setProduct] = useState<Product>('market')
  const [direction, setDirection] = useState<Direction>('ltr')
  const [lang, setLangState] = useState<Lang>('en')

  // Three of the four dimensions are attributes on the root element and nothing
  // else. The token CSS keys off data-theme and data-product, so a mode switch
  // is an attribute write — no reload, no re-render of the stylesheet, no flash.
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.dataset.product = product
    root.dir = direction
    // The document language, for assistive technology and for hyphenation. The
    // Arabic *type* mode is not attached here: decision 013 scopes it to a
    // subtree, so it is selected by :lang() on elements that opt in, never at
    // the root. See lib/script.ts.
    root.lang = lang
  }, [theme, product, direction, lang])

  const value = useMemo<ModeState>(
    () => ({
      theme,
      product,
      direction,
      lang,
      combination: { theme, product },
      setTheme,
      setProduct,
      setDirection,
      // Choosing a language moves the direction with it, because that is the
      // pairing a reader expects. The direction control stays independent
      // afterwards: Latin text in an RTL container looks fine and proves
      // nothing, so the mismatch has to remain reachable on purpose.
      setLang: (next: Lang) => {
        setLangState(next)
        setDirection(next === 'ar' ? 'rtl' : 'ltr')
      }
    }),
    [theme, product, direction, lang]
  )

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>
}

export function useMode(): ModeState {
  const value = useContext(ModeContext)
  if (!value) throw new Error('useMode must be used inside ModeProvider')
  return value
}
