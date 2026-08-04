/**
 * The token model behind the gallery.
 *
 * It is parsed out of packages/tokens/css/tokens.css — the generated artefact
 * itself, imported a second time as text. That is deliberate: the gallery
 * describes the same bytes that are styling the page, so it cannot drift from
 * what the reader is looking at. The DTCG source in content/tokens/ is the
 * editing surface and is not read here; reading it would mean the preview
 * asserting a value the browser never received.
 *
 * Resolution is done statically rather than through getComputedStyle. Both give
 * the same answer, but doing the substitution here means the alias chain can be
 * shown — text.secondary -> text.secondary-market -> neutral.700 -> the literal —
 * which is the part a computed style has already thrown away.
 */
import tokensCss from '../../../tokens/css/tokens.css?raw'

export const THEMES = ['light', 'dark'] as const
export const PRODUCTS = ['market', 'move'] as const

export type Theme = (typeof THEMES)[number]
export type Product = (typeof PRODUCTS)[number]
export type Combination = { theme: Theme; product: Product }

export const COMBINATIONS: Combination[] = THEMES.flatMap((theme) =>
  PRODUCTS.map((product) => ({ theme, product }))
)

export function combinationKey(c: Combination): string {
  return `${c.theme}-${c.product}`
}

/* ------------------------------------------------------------------ parsing */

type Declarations = Record<string, string>

type Block = { selector: string; declarations: Declarations }

function parseBlocks(css: string): Block[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const blocks: Block[] = []
  const blockPattern = /([^{}]+)\{([^{}]*)\}/g
  let match: RegExpExecArray | null
  while ((match = blockPattern.exec(withoutComments)) !== null) {
    const selector = match[1].trim()
    const declarations: Declarations = {}
    for (const raw of match[2].split(';')) {
      const line = raw.trim()
      if (!line) continue
      const colon = line.indexOf(':')
      if (colon === -1) continue
      const name = line.slice(0, colon).trim()
      if (!name.startsWith('--')) continue
      declarations[name] = line.slice(colon + 1).trim()
    }
    blocks.push({ selector, declarations })
  }
  return blocks
}

const BLOCKS = parseBlocks(tokensCss)

const BASE: Declarations = BLOCKS.find((b) => b.selector === ':root')?.declarations ?? {}

const MODE_BLOCKS: Record<string, Declarations> = (() => {
  const out: Record<string, Declarations> = {}
  for (const block of BLOCKS) {
    const theme = /\[data-theme="([^"]+)"\]/.exec(block.selector)?.[1]
    const product = /\[data-product="([^"]+)"\]/.exec(block.selector)?.[1]
    if (!theme || !product) continue
    out[`${theme}-${product}`] = block.declarations
  }
  return out
})()

/** Every declaration in force for one mode combination: base, then the overrides. */
export function declarationsFor(c: Combination): Declarations {
  return { ...BASE, ...(MODE_BLOCKS[combinationKey(c)] ?? {}) }
}

/* --------------------------------------------------------------- resolution */

const VAR_ONLY = /^var\(\s*(--[a-z0-9-]+)\s*\)$/i

export type Resolution = {
  /** The value as declared, which may be an alias. */
  declared: string
  /** The literal the alias chain terminates in. */
  value: string
  /** Every custom property walked through, starting with the token itself. */
  chain: string[]
}

export function resolveToken(name: string, declarations: Declarations): Resolution {
  const chain: string[] = [name]
  let current = declarations[name]
  const declared = current ?? ''
  let guard = 0
  while (current !== undefined && guard++ < 16) {
    const alias = VAR_ONLY.exec(current)
    if (!alias) break
    chain.push(alias[1])
    current = declarations[alias[1]]
  }
  return { declared, value: current ?? '', chain }
}

/** Resolve by dotted DTCG path, the form content/tokens/pairs.json declares. */
export function cssNameForPath(path: string): string {
  return `--${path.replace(/\./g, '-')}`
}

export function resolvePath(path: string, c: Combination): Resolution {
  return resolveToken(cssNameForPath(path), declarationsFor(c))
}

/* ---------------------------------------------------------------- the model */

export type TokenKind = 'color' | 'dimension' | 'number' | 'fontFamily' | 'shadow' | 'other'
export type Layer = 'primitive' | 'semantic' | 'product'

export type TokenMeta = {
  name: string
  layer: Layer
  group: string
  kind: TokenKind
  /** True when the resolved value is not the same in all four combinations. */
  varies: boolean
  variesByTheme: boolean
  variesByProduct: boolean
  /**
   * The two slot tokens the mode files use to express a cross-dimension
   * dependency. Documented as plumbing in the source; nothing outside the mode
   * files may reference them.
   */
  plumbing: boolean
}

function kindOf(value: string): TokenKind {
  if (/^#[0-9a-f]{3,8}$/i.test(value)) return 'color'
  if (/#[0-9a-f]{3,8}/i.test(value) && value.includes('px')) return 'shadow'
  if (/^-?[\d.]+px$/.test(value)) return 'dimension'
  if (/^-?[\d.]+$/.test(value)) return 'number'
  if (value.includes(',')) return 'fontFamily'
  return 'other'
}

type GroupRule = { group: string; test: RegExp }

const PRIMITIVE_GROUPS: GroupRule[] = [
  { group: 'colour — neutral ramp', test: /^--neutral-/ },
  { group: 'colour — brand and status hues', test: /^--(green|blue|red|amber)-/ },
  { group: 'spacing', test: /^--space-/ },
  { group: 'radius', test: /^--radius-/ },
  { group: 'elevation', test: /^--shadow-/ },
  { group: 'typography — Latin', test: /^--(font-family-sans|font-size-(?!arabic)|font-weight-|line-height-(?!arabic)|letter-spacing-)/ },
  { group: 'typography — Arabic', test: /^--(font-family-arabic|font-size-arabic|line-height-arabic)/ }
]

const SEMANTIC_GROUPS: GroupRule[] = [
  { group: 'surface', test: /^--surface-/ },
  { group: 'text', test: /^--text-/ },
  { group: 'action', test: /^--action-/ },
  { group: 'border', test: /^--border-/ }
]

const PRODUCT_GROUPS: GroupRule[] = [
  { group: 'commerce — Mizan Market only', test: /^--commerce-/ },
  { group: 'mobility — Mizan Move only', test: /^--mobility-/ }
]

function classify(name: string, declared: string): { layer: Layer; group: string } {
  for (const rule of PRODUCT_GROUPS) {
    if (rule.test.test(name)) return { layer: 'product', group: rule.group }
  }
  if (declared.includes('var(')) {
    for (const rule of SEMANTIC_GROUPS) {
      if (rule.test.test(name)) return { layer: 'semantic', group: rule.group }
    }
    return { layer: 'semantic', group: 'other' }
  }
  for (const rule of PRIMITIVE_GROUPS) {
    if (rule.test.test(name)) return { layer: 'primitive', group: rule.group }
  }
  return { layer: 'primitive', group: 'other' }
}

const PLUMBING = new Set(['--text-secondary-market', '--text-secondary-move'])

export const TOKENS: TokenMeta[] = (() => {
  const names = new Set<string>()
  for (const c of COMBINATIONS) {
    for (const name of Object.keys(declarationsFor(c))) names.add(name)
  }

  const metas: TokenMeta[] = []
  for (const name of names) {
    const perCombination = COMBINATIONS.map((c) => resolveToken(name, declarationsFor(c)))
    const reference = perCombination[0]
    const values = perCombination.map((r) => r.value)
    const { layer, group } = classify(name, reference.declared)

    const valueIn = (theme: Theme, product: Product) =>
      resolveToken(name, declarationsFor({ theme, product })).value

    const variesByTheme = THEMES.some((theme) =>
      PRODUCTS.some((product) => valueIn(theme, product) !== valueIn(THEMES[0], product))
    )
    const variesByProduct = PRODUCTS.some((product) =>
      THEMES.some((theme) => valueIn(theme, product) !== valueIn(theme, PRODUCTS[0]))
    )

    metas.push({
      name,
      layer,
      group,
      kind: kindOf(reference.value),
      varies: new Set(values).size > 1,
      variesByTheme,
      variesByProduct,
      plumbing: PLUMBING.has(name)
    })
  }

  return metas
})()

const LAYER_ORDER: Layer[] = ['primitive', 'semantic', 'product']

const GROUP_ORDER: string[] = [
  ...PRIMITIVE_GROUPS.map((r) => r.group),
  ...SEMANTIC_GROUPS.map((r) => r.group),
  ...PRODUCT_GROUPS.map((r) => r.group),
  'other'
]

/** Natural sort so --space-50 precedes --space-100. */
function compareNames(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' })
}

export type TokenGroup = { layer: Layer; group: string; tokens: TokenMeta[] }

export const GROUPED_TOKENS: TokenGroup[] = (() => {
  const byKey = new Map<string, TokenGroup>()
  for (const token of TOKENS) {
    const key = `${token.layer}::${token.group}`
    let entry = byKey.get(key)
    if (!entry) {
      entry = { layer: token.layer, group: token.group, tokens: [] }
      byKey.set(key, entry)
    }
    entry.tokens.push(token)
  }
  const groups = [...byKey.values()]
  for (const g of groups) g.tokens.sort((a, b) => compareNames(a.name, b.name))
  groups.sort((a, b) => {
    const layer = LAYER_ORDER.indexOf(a.layer) - LAYER_ORDER.indexOf(b.layer)
    if (layer !== 0) return layer
    return GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group)
  })
  return groups
})()

export const TOKEN_COUNT = TOKENS.length
export const LAYER_COUNTS: Record<Layer, number> = {
  primitive: TOKENS.filter((t) => t.layer === 'primitive').length,
  semantic: TOKENS.filter((t) => t.layer === 'semantic').length,
  product: TOKENS.filter((t) => t.layer === 'product').length
}
