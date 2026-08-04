import { useMode } from '../lib/mode'
import { s, ui } from '../lib/strings'
import type { Lang, Str } from '../lib/strings'
import { Run } from '../components/Run'
import { V0Pane } from './V0Pane'
import { RebuiltPane } from './RebuiltPane'
import { PRODUCTS } from './products'

const TEA = PRODUCTS.find((p) => p.id === 'tea-lipton')!

const V0_DEFECTS: Str[] = [
  {
    en: 'The fourth title is built by concatenation: name + " - " + size. Switch to RTL and watch the hyphen and the digits move.',
    ar: 'العنوان الرابع مبني بالدمج: الاسم + " - " + الحجم. بدّل إلى RTL وراقب الشرطة والأرقام وهي تنتقل.'
  },
  {
    en: 'A global letter-spacing of 0.01em reaches every Arabic title and severs the joins between letters.',
    ar: 'تباعد أحرف عام مقداره 0.01em يصل إلى كل عنوان عربي ويقطع الوصلات بين الحروف.'
  },
  {
    en: 'The discount badge paints dark red text onto a dark red fill from an inline style: 1.06:1.',
    ar: 'شارة الخصم ترسم نصًا أحمر داكنًا على تعبئة حمراء داكنة عبر نمط مضمّن: 1.06:1.'
  },
  {
    en: 'The filter chips and the quick-view overlay are plain divs, both carrying onClick in v0. They respond to a mouse, they are not in the tab order, Enter and Space do nothing, and a screen reader announces them as text. The chips are the only filtering mechanism on the screen.',
    ar: 'رقاقات التصفية وطبقة العرض السريع عناصر div مجردة، يحمل كلاهما حدث نقر في النسخة صفر. تستجيب للفأرة، وليست في ترتيب التنقل، ولا يفعل Enter وSpace شيئًا، ويقرأها قارئ الشاشة نصًا. والرقاقات هي وسيلة التصفية الوحيدة في الشاشة.'
  },
  {
    en: 'No alt text anywhere. The image is a div containing the word IMG.',
    ar: 'لا نص بديل في أي موضع. الصورة عنصر div يحتوي كلمة IMG.'
  },
  {
    en: 'Prices are "AED " concatenated onto toFixed(2), and the percentage is Math.round. There is no Intl call, so there is no place a numeral-system decision could be applied.',
    ar: 'الأسعار هي «AED » مدموجة مع toFixed(2)، والنسبة من Math.round. لا استدعاء لـIntl، فلا موضع يمكن تطبيق قرار نظام الأرقام فيه.'
  },
  {
    en: 'Four greys and two brand greens, each pair meaning one thing. One theme, and no concept of a product mode.',
    ar: 'أربعة رماديات وأخضران للعلامة، كل زوج يعني شيئًا واحدًا. سمة واحدة، ولا مفهوم لوضع المنتج أصلًا.'
  },
  {
    en: 'btn-cta is applied on three v0 screens and defined in no stylesheet. What renders is the base button and nothing else.',
    ar: 'الفئة btn-cta مستخدمة في ثلاث شاشات ولا تعريف لها في أي ملف أنماط. ما يُعرض هو الزر الأساسي فحسب.'
  },
  {
    en: 'Described rather than reproduced: the 72 physical direction properties the audit counted. This repository forbids the physical inline-axis properties outside legacy/, and importing the defect in order to demonstrate it would still be importing it.',
    ar: 'موصوف لا مُعاد إنتاجه: 72 خاصية اتجاه فيزيائية أحصاها التدقيق. يمنع هذا المستودع خصائص المحور الأفقي الفيزيائية خارج legacy/، واستيراد العيب لعرضه يبقى استيرادًا له.'
  }
]

const REBUILT_CHANGES: Str[] = [
  {
    en: 'The name and the size are separate elements, each isolated in a bdi. Nothing builds a mixed-direction string by concatenation.',
    ar: 'الاسم والحجم عنصران منفصلان، كل منهما معزول داخل bdi. لا شيء يبني نصًا ثنائي الاتجاه بالدمج.'
  },
  {
    en: 'One formatter, asking for ar-AE-u-nu-latn explicitly. Western digits in both locales, symbol form and placement from CLDR: AED 18.90 and 18.90 د.إ.',
    ar: 'منسّق واحد يطلب ar-AE-u-nu-latn صراحةً. أرقام غربية في اللغتين، وشكل الرمز وموضعه من CLDR: ‏AED 18.90 و18.90 د.إ.'
  },
  {
    en: 'Arabic typography is selected by :lang() on this subtree, never at the document root, because an English page contains Arabic runs and the reverse. Decision 013 calls for a script mode here and the token layer has two dimensions so far, so what is wired up is two separately named primitives swapped by a selector. The scoping is right; the mode is Stage 3.',
    ar: 'خصائص الخط العربي تُحدَّد بـ:lang()‎ على هذه الشجرة الفرعية، ولا تُطبَّق على جذر المستند أبدًا، لأن الصفحة الإنجليزية تحتوي نصوصًا عربية والعكس. ويقضي القرار 013 بوضع للكتابة هنا، وطبقة الرموز ما زالت ببعدين، فالقائم فعليًا رمزان أوّليان منفصلان يبدّل بينهما محدِّد. النطاق صحيح، والوضع عمل المرحلة الثالثة.'
  },
  {
    en: 'Every colour resolves from a token, so every pairing drawn here is one the build gate already checked in all four combinations.',
    ar: 'كل لون يُحلّ من رمز، فكل زوج مرسوم هنا سبق أن فحصته بوابة البناء في التركيبات الأربع.'
  },
  {
    en: 'Real button elements with aria-pressed, a visible focus ring, and alt text on every image. Nothing here is a div with onClick.',
    ar: 'أزرار حقيقية مع aria-pressed، وحلقة تركيز مرئية، ونص بديل لكل صورة. لا شيء هنا div بحدث نقر.'
  },
  {
    en: 'Low stock is a dot. The words beside it are text.primary, which is where their legibility comes from.',
    ar: 'الكمية المحدودة نقطة. والكلمات بجوارها text.primary، ومنها تأتي مقروئيتها.'
  },
  {
    en: 'The disabled button is text.secondary on surface.sunken — itself a declared pair — rather than half opacity, which would take a passing pairing below the floor.',
    ar: 'الزر المعطّل هو text.secondary على surface.sunken — وهو زوج مُعلَن بذاته — بدل نصف الشفافية التي كانت ستُنزل زوجًا مطابقًا تحت الحد.'
  },
  {
    en: 'Logical properties throughout, so the direction control is the only thing that moves.',
    ar: 'خصائص منطقية في كل موضع، فلا يتحرك سوى مفتاح الاتجاه.'
  }
]

function DefectList({ items, lang }: { items: Str[]; lang: Lang }) {
  return (
    <ul className="mz-defects mz-script">
      {items.map((item, index) => (
        <li key={index}>
          <Run text={s(item, lang)} ambient={lang} />
        </li>
      ))}
    </ul>
  )
}

/**
 * The one comparison worth pulling out of the panes: the same title, built two
 * ways. Everything else on this page can be argued about; this either reads or
 * it does not.
 */
function BidiCallout({ lang }: { lang: Lang }) {
  return (
    <div className="mz-bidi">
      <div className="mz-bidi__half">
        <h3 className="mz-h4">
          <Run text={s(ui.compare.v0Title, lang)} ambient={lang} />
        </h3>
        {/* Exactly what v0 does: one string, no isolation, dropped into a
            paragraph whose direction it does not control. */}
        <p className="mz-bidi__specimen">{TEA.name + ' - ' + TEA.size}</p>
      </div>
      <div className="mz-bidi__half">
        <h3 className="mz-h4">
          <Run text={s(ui.compare.rebuiltTitle, lang)} ambient={lang} />
        </h3>
        <p className="mz-bidi__specimen">
          <Run text={TEA.name} ambient={lang} />
          <span aria-hidden="true"> · </span>
          <Run text={TEA.size} ambient={lang} />
        </p>
      </div>
    </div>
  )
}

export function Comparison() {
  const { lang } = useMode()

  return (
    <section className="mz-section" aria-labelledby="mz-compare-title">
      <div className="mz-section__head">
        <p className="mz-eyebrow">
          <Run text="05" ambient="en" />
        </p>
        <h2 className="mz-h2" id="mz-compare-title">
          <Run text={s(ui.compare.title, lang)} ambient={lang} />
        </h2>
        <p className="mz-prose">
          <Run text={s(ui.compare.lede, lang)} ambient={lang} />
        </p>
      </div>

      <div className="mz-section__head">
        <h3 className="mz-h3">
          <Run text={s(ui.compare.bidiTitle, lang)} ambient={lang} />
        </h3>
        <p className="mz-prose">
          <Run text={s(ui.compare.bidiBody, lang)} ambient={lang} />
        </p>
      </div>

      <BidiCallout lang={lang} />

      <div className="mz-compare">
        <figure className="mz-exhibit">
          <figcaption className="mz-exhibit__caption">
            <h3 className="mz-h3">
              <Run text={s(ui.compare.v0Title, lang)} ambient={lang} />
            </h3>
            <p className="mz-prose">
              <Run text={s(ui.compare.v0Sub, lang)} ambient={lang} />
            </p>
            <p className="mz-eyebrow">
              <Run text={s(ui.compare.defectsTitle, lang)} ambient={lang} />
            </p>
            <DefectList items={V0_DEFECTS} lang={lang} />
          </figcaption>
          <div className="mz-exhibit__frame">
            <V0Pane />
          </div>
        </figure>

        <figure className="mz-exhibit">
          <figcaption className="mz-exhibit__caption">
            <h3 className="mz-h3">
              <Run text={s(ui.compare.rebuiltTitle, lang)} ambient={lang} />
            </h3>
            <p className="mz-prose">
              <Run text={s(ui.compare.rebuiltSub, lang)} ambient={lang} />
            </p>
            <p className="mz-prose">
              <Run text={s(ui.compare.productNote, lang)} ambient={lang} />
            </p>
            <p className="mz-eyebrow">
              <Run text={s(ui.compare.fixesTitle, lang)} ambient={lang} />
            </p>
            <DefectList items={REBUILT_CHANGES} lang={lang} />
          </figcaption>
          <div className="mz-exhibit__frame">
            <RebuiltPane />
          </div>
        </figure>
      </div>
    </section>
  )
}
