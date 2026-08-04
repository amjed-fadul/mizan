/**
 * The eight products from legacy/src/market/screens/CategoryScreen.tsx.
 *
 * Transcribed, not imported. legacy/ is quarantined — it is the subject of the
 * Stage 1 audit and the Stage 6 migration, and both measure the distance between
 * it and what replaces it, so nothing here reaches into it and nothing there
 * changes. What is copied is the catalogue data, character for character,
 * because the two panes are only a comparison if the content is identical.
 *
 * Names, sizes and unit labels stay in the script the catalogue holds them in.
 * They are product attributes, not interface strings: `Apple iPhone 17 Pro` is
 * called that in an Arabic store too. That is precisely the condition the
 * isolation rules exist for, so localising them away would delete the problem
 * rather than solve it.
 */

export type StockLevel = 'in-stock' | 'low-stock' | 'out-of-stock'
export type DeliveryWindow = 'today' | 'tomorrow' | 'none'

export type CatalogueItem = {
  id: string
  name: string
  size: string
  price: number
  wasPrice?: number
  unit: number
  unitLabel: string
  stock: StockLevel
  delivery: DeliveryWindow
}

export const PRODUCTS: CatalogueItem[] = [
  {
    id: 'milk-2l',
    name: 'حليب طازج كامل الدسم',
    size: '2 لتر',
    price: 11.5,
    wasPrice: 13.0,
    unit: 5.75,
    unitLabel: 'لتر',
    stock: 'in-stock',
    delivery: 'today'
  },
  {
    id: 'bread-arabic',
    name: 'خبز عربي',
    size: '6 أرغفة',
    price: 4.25,
    unit: 0.71,
    unitLabel: 'رغيف',
    stock: 'low-stock',
    delivery: 'today'
  },
  {
    id: 'iphone-17-pro',
    name: 'Apple iPhone 17 Pro',
    size: '256GB',
    price: 4699.0,
    wasPrice: 4999.0,
    unit: 4699.0,
    unitLabel: 'unit',
    stock: 'in-stock',
    delivery: 'tomorrow'
  },
  {
    // The one the audit named. Its title is the mixed-direction case: an Arabic
    // noun phrase, a Latin brand, a digit group and a direction-neutral hyphen.
    id: 'tea-lipton',
    name: 'شاي أحمر Lipton',
    size: '100 كيس',
    price: 18.9,
    wasPrice: 22.0,
    unit: 0.19,
    unitLabel: 'كيس',
    stock: 'in-stock',
    delivery: 'tomorrow'
  },
  {
    id: 'nescafe-gold',
    name: 'Nescafé Gold',
    size: '200g',
    price: 42.0,
    unit: 21.0,
    unitLabel: '100g',
    stock: 'in-stock',
    delivery: 'tomorrow'
  },
  {
    id: 'rice-basmati',
    name: 'أرز بسمتي',
    size: '5 كجم',
    price: 34.75,
    wasPrice: 39.0,
    unit: 6.95,
    unitLabel: 'كجم',
    stock: 'low-stock',
    delivery: 'tomorrow'
  },
  {
    id: 'water-al-ain',
    name: 'Al Ain Water',
    size: '24 x 500ml',
    price: 9.95,
    unit: 0.41,
    unitLabel: 'bottle',
    stock: 'in-stock',
    delivery: 'today'
  },
  {
    id: 'olive-oil',
    name: 'زيت زيتون بكر ممتاز',
    size: '750 مل',
    price: 27.5,
    unit: 36.67,
    unitLabel: 'لتر',
    stock: 'out-of-stock',
    delivery: 'none'
  }
]

/** The filter chips, in the order v0 lists them. */
export const FILTER_IDS = [
  'all',
  'dairy',
  'bakery',
  'pantry',
  'beverages',
  'electronics'
] as const

export type FilterId = (typeof FILTER_IDS)[number]

/** v0's English labels, needed by the reproduction pane only. */
export const V0_FILTER_LABELS: Record<FilterId, string> = {
  all: 'All',
  dairy: 'Dairy & Eggs',
  bakery: 'Bakery',
  pantry: 'Pantry',
  beverages: 'Beverages',
  electronics: 'Electronics'
}

export const V0_STOCK_TEXT: Record<StockLevel, string> = {
  'in-stock': 'In stock',
  'low-stock': 'Low stock',
  'out-of-stock': 'Out of stock'
}

export const V0_DELIVERY_TEXT: Record<DeliveryWindow, string> = {
  today: 'Today, 6 - 9 PM',
  tomorrow: 'Tomorrow',
  none: 'Out of stock'
}
