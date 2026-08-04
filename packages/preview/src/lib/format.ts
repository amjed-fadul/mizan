/**
 * The formatting boundary.
 *
 * content/rules/rtl-arabic.md §4: no number reaches a screen except through this
 * module. v0 produced digits with toFixed, Math.round and raw interpolation
 * across 21 call sites in four currency formats, with no Intl anywhere — which
 * is why the numeral system could not be decided there even if someone had
 * wanted to. Here it is one decision in one place.
 *
 * Decision 012: Western digits in both locales. CLDR's default numbering system
 * for `ar` is `arab`, so `new Intl.NumberFormat('ar-AE')` yields ١٢٫٥٠ — the
 * option we are not choosing. The numbering system is therefore requested
 * explicitly in the locale tag: `ar-AE-u-nu-latn`. An Intl call that leaves `nu`
 * to the locale has not made this decision, it has inherited one.
 */
import type { Lang } from './strings'

const LOCALE: Record<Lang, string> = {
  // Western digits are en-AE's default; stated as a tag for symmetry with `ar`,
  // so that neither locale is the one where the numeral system is implicit.
  en: 'en-AE-u-nu-latn',
  ar: 'ar-AE-u-nu-latn'
}

const CURRENCY = 'AED'

const currencyFormatters = new Map<Lang, Intl.NumberFormat>()

function currencyFormatter(lang: Lang): Intl.NumberFormat {
  let formatter = currencyFormatters.get(lang)
  if (!formatter) {
    formatter = new Intl.NumberFormat(LOCALE[lang], {
      style: 'currency',
      currency: CURRENCY,
      // Always the currency's own minor-unit count, including on round amounts:
      // a price column where some entries carry fractions cannot be scanned.
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
    currencyFormatters.set(lang, formatter)
  }
  return formatter
}

/**
 * `AED 12.50` in English, `12.50 د.إ` in Arabic. Symbol placement and symbol
 * form are chosen by Intl from CLDR, never concatenated by hand — concatenating
 * a symbol onto an amount is the same construction that scrambled v0's titles.
 */
export function formatCurrency(amount: number, lang: Lang): string {
  return currencyFormatter(lang).format(amount)
}

const percentFormatters = new Map<Lang, Intl.NumberFormat>()

function percentFormatter(lang: Lang): Intl.NumberFormat {
  let formatter = percentFormatters.get(lang)
  if (!formatter) {
    formatter = new Intl.NumberFormat(LOCALE[lang], {
      style: 'percent',
      maximumFractionDigits: 0
    })
    percentFormatters.set(lang, formatter)
  }
  return formatter
}

/** The saving on a reduced price, as a signed proportion of the original. */
export function formatDiscount(price: number, wasPrice: number, lang: Lang): string {
  return percentFormatter(lang).format(-(wasPrice - price) / wasPrice)
}

/** Plain quantities — the "5" in "5 left". Same numeral decision, same boundary. */
export function formatNumber(value: number, lang: Lang): string {
  return new Intl.NumberFormat(LOCALE[lang]).format(value)
}
