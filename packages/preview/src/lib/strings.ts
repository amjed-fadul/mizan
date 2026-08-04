/**
 * The string catalogue for the preview chrome and the rebuilt screen.
 *
 * It exists because the alternative — English literals inline in JSX — is
 * exactly what the Stage 1 audit found in v0, and a preview that demonstrates
 * bidirectional correctness while hardcoding its own labels would be arguing
 * against itself. Nothing here is pluralised: Arabic has six plural categories
 * including a dual, and content/rules/rtl-arabic.md records that as blocked on a
 * content commitment rather than a code decision. Every countable phrase below
 * is therefore written to avoid needing one.
 */

export type Lang = 'en' | 'ar'
export type Str = { en: string; ar: string }

export function s(value: Str, lang: Lang): string {
  return value[lang]
}

export const LANG_NAME: Record<Lang, string> = { en: 'English', ar: 'العربية' }

export const ui = {
  brand: { en: 'Mizan', ar: 'ميزان' } satisfies Str,
  stage: {
    en: 'Stage 2 — the design token system',
    ar: 'المرحلة الثانية — نظام رموز التصميم'
  } satisfies Str,
  lede: {
    en: 'Every colour on this page resolves from a token. Change the theme, the product, the direction or the language and nothing reloads — the same names resolve to different values.',
    ar: 'كل لون في هذه الصفحة يأتي من رمز تصميم. غيّر السمة أو المنتج أو الاتجاه أو اللغة ولن تُعاد الصفحة — الأسماء نفسها تُحلّ إلى قيم مختلفة.'
  } satisfies Str,

  controls: {
    theme: { en: 'Theme', ar: 'السمة' } satisfies Str,
    light: { en: 'Light', ar: 'فاتحة' } satisfies Str,
    dark: { en: 'Dark', ar: 'داكنة' } satisfies Str,
    product: { en: 'Product', ar: 'المنتج' } satisfies Str,
    market: { en: 'Market', ar: 'ماركت' } satisfies Str,
    move: { en: 'Move', ar: 'موف' } satisfies Str,
    direction: { en: 'Direction', ar: 'الاتجاه' } satisfies Str,
    language: { en: 'Language', ar: 'اللغة' } satisfies Str,
    now: { en: 'Now showing', ar: 'المعروض الآن' } satisfies Str
  },

  gallery: {
    title: { en: 'The token gallery', ar: 'معرض الرموز' } satisfies Str,
    lede: {
      en: 'Every token in the system, grouped by layer, resolved in the mode combination currently on screen. A semantic token shows the chain it resolves through, because following a value back to its primitive should be reading rather than rebuilding.',
      ar: 'كل رمز في النظام، مجمّعًا حسب الطبقة، ومحسوبًا في تركيبة الأوضاع المعروضة الآن. يعرض الرمز الدلالي سلسلة الإحالة التي يمر بها، لأن تتبّع القيمة حتى أصلها ينبغي أن يكون قراءةً لا إعادة بناء.'
    } satisfies Str,
    layerPrimitive: { en: 'Primitive', ar: 'الطبقة الأولية' } satisfies Str,
    layerSemantic: { en: 'Semantic', ar: 'الطبقة الدلالية' } satisfies Str,
    layerProduct: { en: 'Product-namespaced', ar: 'مخصصة لمنتج واحد' } satisfies Str,
    layerPrimitiveNote: {
      en: 'Raw values. No component references these directly.',
      ar: 'قيم خام. لا يشير إليها أي مكوّن مباشرة.'
    } satisfies Str,
    layerSemanticNote: {
      en: 'One name per concept both products have, resolved per mode. Decision 007.',
      ar: 'اسم واحد لكل مفهوم يشترك فيه المنتجان، يُحلّ حسب الوضع. القرار 007.'
    } satisfies Str,
    layerProductNote: {
      en: 'Concepts only one product has. Namespaced, because there is nothing for the other product to resolve them to.',
      ar: 'مفاهيم يملكها منتج واحد فقط. مخصصة بالاسم، لأن المنتج الآخر لا يملك ما يُحلّها إليه.'
    } satisfies Str,
    variesTheme: { en: 'varies by theme', ar: 'يختلف حسب السمة' } satisfies Str,
    variesProduct: { en: 'varies by product', ar: 'يختلف حسب المنتج' } satisfies Str,
    plumbing: { en: 'plumbing, not vocabulary', ar: 'سباكة داخلية، لا مفردات' } satisfies Str,
    plumbingNote: {
      en: 'Two slot tokens the mode files use to express a dependency on both dimensions at once. No component may reference them.',
      ar: 'رمزان وسيطان تستخدمهما ملفات الأوضاع للتعبير عن اعتماد على البعدين معًا. لا يجوز لأي مكوّن الإشارة إليهما.'
    } satisfies Str,
    tokenCount: { en: 'tokens', ar: 'رمزًا' } satisfies Str,
    inPairs: { en: 'declared in pairs.json', ar: 'مُعلَن في pairs.json' } satisfies Str
  },

  pairs: {
    title: { en: 'Declared pairings', ar: 'الأزواج المُعلَنة' } satisfies Str,
    lede: {
      en: 'Every foreground and background combination the system intends to render is declared in content/tokens/pairs.json with the context it is used in. The build refuses to generate tokens when a declared pair falls below its threshold. The ratios here are computed from the same resolved values, in all four combinations at once.',
      ar: 'كل تركيبة مقدّمة وخلفية ينوي النظام عرضها مُعلَنة في content/tokens/pairs.json مع السياق الذي تُستخدم فيه. ويرفض البناء توليد الرموز إذا هبط زوج مُعلَن تحت حدّه. النسب هنا محسوبة من القيم نفسها، في التركيبات الأربع دفعة واحدة.'
    } satisfies Str,
    contextText: { en: 'text', ar: 'نص' } satisfies Str,
    contextLargeText: { en: 'large text', ar: 'نص كبير' } satisfies Str,
    contextUi: { en: 'ui', ar: 'عنصر واجهة' } satisfies Str,
    contextDecorative: { en: 'decorative', ar: 'زخرفي' } satisfies Str,
    on: { en: 'on', ar: 'على' } satisfies Str,
    needs: { en: 'needs', ar: 'يتطلب' } satisfies Str,
    notGated: { en: 'no threshold', ar: 'بلا حدّ' } satisfies Str,
    pass: { en: 'Pass', ar: 'مطابق' } satisfies Str,
    fail: { en: 'Fail', ar: 'غير مطابق' } satisfies Str,
    reported: { en: 'Reported', ar: 'مُبلَّغ عنه' } satisfies Str,
    excepted: { en: 'Excepted', ar: 'مُستثنى' } satisfies Str,
    current: { en: 'current', ar: 'الحالي' } satisfies Str,
    verdictNote: {
      en: 'The verdicts are stated in words, not in colour. Mizan has no success or danger semantic — commerce.discount means a saving and mobility.safety means a cancelled trip — and borrowing one of them to mean "fail" is the category error this whole page argues against.',
      ar: 'الأحكام مكتوبة بالكلمات لا بالألوان. لا يملك ميزان رمزًا دلاليًا للنجاح أو الخطر — فـ commerce.discount يعني توفيرًا وmobility.safety يعني رحلة ملغاة — واستعارة أحدهما ليعني «غير مطابق» هي بالضبط الخلط الذي تحاجج ضده هذه الصفحة كلها.'
    } satisfies Str
  },

  notes: {
    title: { en: 'Three things that are easy to miss', ar: 'ثلاثة أمور يسهل تفويتها' } satisfies Str,
    refusalTitle: {
      en: 'A refusal that survives the mode flip',
      ar: 'رفضٌ يصمد أمام تبديل الأوضاع'
    } satisfies Str,
    refusalBody: {
      en: 'commerce.discount and mobility.safety sat 4.21 ΔE00 apart in v0 and looked like one colour with two names. Decision 008 refused to merge them: one means "this costs less", the other "this cancels your trip". The dark theme honours that refusal by giving each its own red rather than letting both land on one. A refusal that only held in light was never a refusal.',
      ar: 'كان الفارق بين commerce.discount وmobility.safety في النسخة صفر 4.21 ΔE00، فبدَوا لونًا واحدًا باسمين. رفض القرار 008 دمجهما: أحدهما يعني «هذا أرخص»، والآخر «هذه رحلتك أُلغيت». والسمة الداكنة تحترم هذا الرفض فتمنح كلًّا منهما أحمره الخاص بدل أن يلتقيا عند لون واحد. الرفض الذي يصمد في الفاتحة وحدها لم يكن رفضًا قط.'
    } satisfies Str,
    refusalResult: {
      en: 'Distinct values in every combination checked:',
      ar: 'قيمتان مختلفتان في كل تركيبة فُحصت:'
    } satisfies Str,
    densityTitle: { en: 'One name, two densities', ar: 'اسم واحد، كثافتان' } satisfies Str,
    densityBody: {
      en: 'text.secondary is the one shared semantic that depends on both dimensions: the theme decides how light the neutral ramp runs, the product decides which step of it is taken. Market is browsed on a sofa and takes the heavier step; Move is read at a curb in one glance and takes the lighter one. A component references the one name and stays product-agnostic.',
      ar: 'رمز text.secondary هو الرمز الدلالي المشترك الوحيد الذي يعتمد على البعدين معًا: السمة تحدد مدى فتوح تدرّج الرمادي، والمنتج يحدد أي درجة منه تُؤخذ. ماركت يُتصفَّح على أريكة فيأخذ الدرجة الأثقل، وموف يُقرأ عند الرصيف بنظرة واحدة فيأخذ الأخف. والمكوّن يشير إلى الاسم الواحد ويبقى محايدًا تجاه المنتج.'
    } satisfies Str,
    amberTitle: { en: 'Indicator only, never text', ar: 'مؤشّر فقط، لا نص أبدًا' } satisfies Str,
    amberBody: {
      en: 'Amber cannot reach 4.5:1 without turning brown and leaving the warning register entirely. Decision 008 narrowed the role instead of darkening the value: these two tokens are a dot, a bar or a badge fill, and any words beside them take text.primary. They are checked at the 3.0 non-text threshold precisely because the text use is forbidden.',
      ar: 'لا يستطيع الكهرماني بلوغ 4.5:1 دون أن يتحول إلى بنّي ويغادر سجلّ التحذير كليًا. فضيّق القرار 008 الدور بدل أن يُعتّم القيمة: هذان الرمزان نقطة أو شريط أو تعبئة شارة، وأي كلمات بجوارهما تأخذ text.primary. ويُفحصان عند حدّ 3.0 غير النصي تحديدًا لأن الاستخدام النصي ممنوع.'
    } satisfies Str,
    inTheme: { en: 'Resolved in the theme currently on screen:', ar: 'محسوبة في السمة المعروضة الآن:' } satisfies Str,
    forbidden: { en: 'forbidden use', ar: 'استخدام ممنوع' } satisfies Str,
    permitted: { en: 'permitted use', ar: 'استخدام مسموح' } satisfies Str,
    lowStockLabel: { en: 'Low stock', ar: 'الكمية محدودة' } satisfies Str,
    surgeLabel: { en: 'Surge pricing', ar: 'تسعير الذروة' } satisfies Str
  },

  compare: {
    title: { en: 'The same screen, twice', ar: 'الشاشة نفسها، مرتين' } satisfies Str,
    lede: {
      en: 'The Mizan Market category screen. Same eight products, same content, same information, built twice. Switch the direction to RTL and read the fourth title in each pane.',
      ar: 'شاشة فئة ميزان ماركت. المنتجات الثمانية نفسها، والمحتوى نفسه، والمعلومات نفسها، مبنيّة مرتين. بدّل الاتجاه إلى RTL ثم اقرأ العنوان الرابع في كل لوح.'
    } satisfies Str,
    v0Title: { en: 'Mizan v0', ar: 'ميزان — النسخة صفر' } satisfies Str,
    v0Sub: {
      en: 'Reproduced from legacy/src/market/screens/CategoryScreen.tsx. Its own literal values, its own markup, nothing imported and nothing repaired.',
      ar: 'مُعاد إنتاجها من legacy/src/market/screens/CategoryScreen.tsx بقيمها الحرفية وبنيتها نفسها، دون استيراد ودون إصلاح.'
    } satisfies Str,
    rebuiltTitle: { en: 'Rebuilt on the token system', ar: 'مُعاد بناؤها على نظام الرموز' } satisfies Str,
    rebuiltSub: {
      en: 'Every colour from a token, logical properties throughout, mixed-direction runs isolated, one formatter, real buttons.',
      ar: 'كل لون من رمز، وخصائص منطقية في كل موضع، وعزل للنصوص ثنائية الاتجاه، ومنسّق واحد، وأزرار حقيقية.'
    } satisfies Str,
    productNote: {
      en: 'This is a Mizan Market screen, so it uses commerce.discount and commerce.stock.low — tokens Move has no counterpart for. Switch the product control and it renders in Move\'s brand: the same component code, no product branch anywhere in it. The commerce tokens keep resolving, because a namespaced token still takes a value in all four combinations; what it does not have is a second product\'s value.',
      ar: 'هذه شاشة من ميزان ماركت، فهي تستخدم commerce.discount وcommerce.stock.low — وهما رمزان لا نظير لهما في موف. بدّل مفتاح المنتج فتُعرض بعلامة موف: الشيفرة نفسها، ولا تفرّع على المنتج في أي موضع منها. وتبقى رموز commerce قابلة للحلّ، لأن الرمز المخصص بالاسم يأخذ قيمة في التركيبات الأربع؛ ما ينقصه هو قيمة منتج ثانٍ.'
    } satisfies Str,
    bidiTitle: { en: 'The fourth title', ar: 'العنوان الرابع' } satisfies Str,
    bidiBody: {
      en: 'v0 builds this title by concatenation: name + " - " + size. The hyphen and the digits are direction-neutral characters, so the bidirectional algorithm hands them to whichever direction the paragraph happens to have. Seven of the eight titles survive that and one does not, which is exactly why it passed review. The rebuilt pane never builds the string at all — the name and the size are separate elements, each isolated in a bdi, and the separator is markup rather than a character in a sentence.',
      ar: 'تبني النسخة صفر هذا العنوان بالدمج النصي: الاسم + " - " + الحجم. الشرطة والأرقام محارف محايدة الاتجاه، فتسلّمها خوارزمية الاتجاه إلى اتجاه الفقرة أيًا كان. سبعة من العناوين الثمانية تنجو من ذلك وواحد لا ينجو، وهذا تحديدًا سبب مروره في المراجعة. أما اللوح المُعاد بناؤه فلا يبني السلسلة أصلًا — الاسم والحجم عنصران منفصلان، كلٌّ معزول داخل bdi، والفاصل بينهما بنية لا محرف داخل جملة.'
    } satisfies Str,
    defectsTitle: { en: 'Visible in this pane', ar: 'ظاهر في هذا اللوح' } satisfies Str,
    fixesTitle: { en: 'Changed here', ar: 'ما تغيّر هنا' } satisfies Str
  },

  foot: {
    source: {
      en: 'Tokens are generated from content/tokens/ by machinery/scripts/build-tokens.mjs, which refuses to emit anything until the schema and contrast checks pass. This page reads the generated CSS and the declared pairings directly and keeps no copy of either, so it cannot describe a system other than the one it is styled by.',
      ar: 'تُولَّد الرموز من content/tokens/ عبر machinery/scripts/build-tokens.mjs، الذي يرفض إخراج أي شيء قبل نجاح فحصي المخطط والتباين. وتقرأ هذه الصفحة ملف CSS المُولَّد والأزواج المُعلَنة مباشرة ولا تحتفظ بنسخة من أيّهما، فلا تستطيع وصف نظام غير الذي يُنسّقها.'
    } satisfies Str,
    quarantine: {
      en: 'legacy/ is quarantined. The left-hand pane is transcribed from it and imports nothing from it; the directory is unchanged.',
      ar: 'مجلد legacy/ محجور. اللوح الأيسر منقول عنه ولا يستورد منه شيئًا، والمجلد نفسه لم يتغير.'
    } satisfies Str
  },

  screen: {
    home: { en: 'Home', ar: 'الرئيسية' } satisfies Str,
    grocery: { en: 'Grocery', ar: 'البقالة' } satisfies Str,
    cart: { en: 'Cart', ar: 'السلة' } satisfies Str,
    move: { en: 'Mizan Move', ar: 'ميزان موف' } satisfies Str,
    heading: { en: 'Grocery & Everyday', ar: 'البقالة والاحتياجات اليومية' } satisfies Str,
    subheading: {
      en: 'Delivered across Dubai and Sharjah, seven days a week.',
      ar: 'توصيل في دبي والشارقة، سبعة أيام في الأسبوع.'
    } satisfies Str,
    filterAll: { en: 'All', ar: 'الكل' } satisfies Str,
    filterDairy: { en: 'Dairy & Eggs', ar: 'الألبان والبيض' } satisfies Str,
    filterBakery: { en: 'Bakery', ar: 'المخبوزات' } satisfies Str,
    filterPantry: { en: 'Pantry', ar: 'المؤن' } satisfies Str,
    filterBeverages: { en: 'Beverages', ar: 'المشروبات' } satisfies Str,
    filterElectronics: { en: 'Electronics', ar: 'الإلكترونيات' } satisfies Str,
    filterLegend: { en: 'Category', ar: 'الفئة' } satisfies Str,
    sortByPrice: { en: 'Sort by price', ar: 'الترتيب حسب السعر' } satisfies Str,
    filter: { en: 'Filter', ar: 'تصفية' } satisfies Str,
    viewCart: { en: 'View cart', ar: 'عرض السلة' } satisfies Str,
    addAll: { en: 'Add all to cart', ar: 'أضف الكل إلى السلة' } satisfies Str,
    addToCart: { en: 'Add to cart', ar: 'أضف إلى السلة' } satisfies Str,
    loadMore: { en: 'Load more', ar: 'عرض المزيد' } satisfies Str,
    inStock: { en: 'In stock', ar: 'متوفر' } satisfies Str,
    lowStock: { en: 'Low stock', ar: 'الكمية محدودة' } satisfies Str,
    outOfStock: { en: 'Out of stock', ar: 'غير متوفر' } satisfies Str,
    deliveryToday: { en: 'Arrives today, 6 – 9 PM', ar: 'يصلك اليوم، 6 – 9 مساءً' } satisfies Str,
    deliveryTomorrow: { en: 'Arrives tomorrow', ar: 'يصلك غدًا' } satisfies Str,
    deliveryNone: { en: 'Not available for delivery', ar: 'غير متاح للتوصيل' } satisfies Str,
    perUnit: { en: 'per', ar: 'لكل' } satisfies Str,
    was: { en: 'Was', ar: 'كان' } satisfies Str,
    photoOf: { en: 'Product photo:', ar: 'صورة المنتج:' } satisfies Str
  }
} as const
