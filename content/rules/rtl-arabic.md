# The RTL and Arabic rule layer

**Status: living document.** Rules are added here as they are decided, and this is the only place they are decided. When a new rule is settled it goes in this file — never into a single component, and never into an agent's instructions.

## Why this file exists rather than an agent

RTL correctness is not a review step and not a specialist's job. Every agent, script, check and human working on Mizan reads the same rules from here, which makes correct behaviour unavoidable rather than something that has to be invoked. An "RTL agent" would be a thing you could forget to call. A rule layer is not.

Arabic here is the advanced stress test of a global-grade system, not a fork of it. If a rule below only makes sense for Arabic, it is probably in the wrong place — the direction-neutral version of it belongs in the core.

---

## 1. Direction and layout

**Logical properties only. Never physical ones.** This is the single most-violated rule and the easiest to check for.

| Do not write | Write |
|---|---|
| `margin-left` / `margin-right` | `margin-inline-start` / `margin-inline-end` |
| `padding-left` / `padding-right` | `padding-inline-start` / `padding-inline-end` |
| `left` / `right` | `inset-inline-start` / `inset-inline-end` |
| `text-align: left` / `right` | `text-align: start` / `end` |
| `border-left` / `border-right` | `border-inline-start` / `border-inline-end` |
| `float: left` / `right` | `float: inline-start` / `inline-end` |
| `border-radius: 4px 0 0 4px` | `border-start-start-radius` etc., or logical shorthand |

Block-direction properties (`margin-top`, `padding-bottom`, `height`) are unaffected and stay as they are. The rule is about the *inline* axis only.

Direction is set once, high up, via `dir` on a root element. Components never set `dir` themselves and never read it to branch their styling. A component that needs to know the direction to lay itself out is a component that has not been written with logical properties.

## 2. Typography

- **`letter-spacing` is `0` for Arabic. Always.** Arabic script is cursive and joined; letter-spacing breaks the joins and renders the text visibly wrong, not merely differently styled. A global `letter-spacing` applied to a whole page is therefore a defect, not a style choice. The audit found exactly that — a global `0.01em` reaching every Arabic product title, while two components had already noticed the problem and fixed it locally for Latin reasons. There is one tracking token in the system, `letter-spacing.none`, and no Arabic tracking token exists to be reached for.
- **Arabic needs more line-height than Latin at the same size.** Ascenders, descenders and diacritics occupy more vertical space. The Arabic scale compensates rather than inheriting Latin values: `line-height.arabic-tight` / `-normal` / `-relaxed` at 1.45 / 1.75 / 1.9 against Latin's 1.25 / 1.5 / 1.7. The size of that gap is itself the argument — Arabic body text needs roughly what Latin uses for long-form, so the two are offset by about a full step and no single shared value is anything but cramped Arabic or loose Latin.
- **The font stack must contain a real Arabic face**, not a Latin face with fallback. A Latin-only stack does not fail loudly; it silently hands Arabic rendering to whatever face each OS picks, so the same string is set differently on iOS, Android and Windows and nobody chose any of it. `font-family.arabic` is that face. Note that `system-ui` does not satisfy this rule: it is not an Arabic face, it is a promise that the OS will choose one.
- **The optical correction is a token, not an adjustment each designer makes by eye.** Arabic set at a Latin `font-size` reads as the smaller of the two. `font-size.arabic-scale` is `1.08`, and the value is bounded rather than chosen freely: the tightest step in the Latin scale is 12px to 13px, a ratio of 1.083, so a correction of 1.083 or more makes the Arabic rendering of one rung indistinguishable from the Latin rendering of the next and an eight-step scale becomes seven. If Arabic ever needs a larger correction, the 12/13 pair is what has to change first. Because line-height is a unitless ratio, the correction reaches leading on its own and must not be applied twice.

### The Arabic scale is a mode of the Latin scale, not a parallel scale

This was open until the token layers existed. They do, so [decision 007](../../decisions/007-modes-for-shared-namespaces-for-unique.md) settles it, and its test is factual rather than stylistic: **does the other side have this concept at all?**

Run it on every Arabic typography token. `line-height.arabic-normal` has `line-height.normal`. `arabic-tight` and `arabic-relaxed` have theirs. `font-family.arabic` has `font-family.sans` — both are "the interface face for this script". `font-size.arabic-scale` is the correction against Latin, and Latin's counterpart is the identity, 1.0. Every one of them has a Latin counterpart, and there is nothing on the Arabic side resembling `mobility.eta` — no concept that only one script has. Under 007 that is a mode, and there is nothing to namespace.

Three consequences, stated because they are costs and not conveniences:

- **Script becomes a third mode dimension.** Combinations go from four (light/dark × Market/Move) to eight. Decision 007 cites Figma Professional's ten-mode ceiling as a constraint at four; at eight it is a live one, and any fourth dimension now has to displace something rather than be added.
- **Script mode is not applied where the other two are.** Light/dark and Market/Move are properties of a whole rendered page. Script is not. An Arabic page contains Latin runs and an English page contains Arabic ones — that is what §3 exists for — so the script mode is scoped to a subtree, selected by `:lang()` and set on the same element that sets the language. A script mode applied at the document root is wrong for precisely the content the bidi rules are about.
- **The two scales have to stay the same shape.** Three line-height steps on each side, not four and three. One size multiplier, not eight Arabic sizes shadowing eight Latin ones. Two scales with different shapes are two scales, and a mode has nothing left to resolve. This is also why the optical correction is a single multiplier: a parallel eight-step Arabic size scale would drift from the Latin one the first time either end was adjusted, and a multiplier cannot drift because there is only one of it.

A mode means one name resolving to different values, not to the same value. Nothing here says the two scripts should look identical — the opposite.

## 3. Bidirectional content

Mixed-direction content is the normal case in this market, not the exception. A product title like `Apple iPhone 17 Pro` inside an Arabic layout, an address with an Arabic street name and a Latin building number, a phone number, a licence plate.

- **Wrap runs of opposite-direction content in `<bdi>`.** Without it, the bidirectional algorithm reorders neighbouring punctuation and digits in ways that look like a rendering bug and are actually correct behaviour applied to unmarked content.
- Never build a mixed-direction string by concatenation and hope. Isolate the parts.
- Test with a real mixed string, not with Latin text in an RTL container. The second one looks fine and proves nothing.

## 4. Numbers, currency and the formatting boundary

Every digit on a screen is the output of a decision. In v0 none of them were: the audit found digits produced by `toFixed`, `Math.round` and raw interpolation across 21 call sites, in four currency formats, with no `Intl` anywhere. So the first rule is not about numerals at all.

**One formatting boundary.** No number reaches a screen except through the formatting module. A component never calls `toFixed`, never interpolates a raw number into a string, and never concatenates a symbol onto an amount. This is what makes every rule below a one-line change instead of a 21-site migration, and it is the reason the rest can be settled now rather than waiting for certainty. A decision that is cheap to reverse is safe to make early; a decision spread across 21 sites is neither.

### Numerals: Western `0123`, in both locales

Gulf digital and commercial usage is overwhelmingly Western digits — price tags, receipts, road signs, bank statements. Arabic-Indic digits in a UAE grocery price do not read as more Arabic, they read as from somewhere else. Two further reasons that hold independently of taste: digits sit directly against Latin brand names in this catalogue, and a column mixing two numeral systems cannot be scanned or aligned; and the digits are the part of a string that has to stay comparable across the two language versions, because a fare, an ETA or an order number gets read aloud, screenshotted and compared between them.

**Ask for the numeral system explicitly.** CLDR's default numbering system for `ar` is `arab`, so `new Intl.NumberFormat('ar-AE')` produces `١٢٫٥٠` — the option we are not choosing. The formatter requests `ar-AE-u-nu-latn`. An `Intl` call that leaves `nu` to the locale has not made this decision; it has inherited someone else's, in whichever direction that runtime's ICU data happens to point.

### This splits into two decisions, because two kinds of number are involved

- **Formatted quantities** — prices, fares, ETAs, distances, quantities, ratings, dates. These go through the formatter and take Western digits under the rule above.
- **Transcribed identifiers** — licence plates, phone numbers, order references, IBANs, flight numbers, promo codes. These are not formatted at all. They are reproduced glyph for glyph from the source of truth: never digit-shaped, never regrouped, never re-spaced. A plate has to read on screen the way it reads on the car, or it is a different plate to the person comparing the two. They are also the strings most likely to sit inside a sentence of the opposite direction, so they are wrapped in `<bdi>` without exception.

The test between them: **would changing the digits change what the number refers to, or only how it is written?** A quantity is written; an identifier is referred to. That distinction, not the locale, decides which path a number takes.

### Currency

`AED 12.50` versus `١٢٫٥٠ د.إ` looked like one question with three entangled parts. Fixing the numeral system disentangles them.

- **The decimal separator follows the numeral system, not the language.** Western digits take `.` (U+002E). The Arabic decimal separator `٫` (U+066B) belongs with Arabic-Indic digits; pairing it with Western digits is the incoherent combination that made this look harder than it is.
- **Symbol placement is never chosen by hand.** `Intl.NumberFormat` with `style: 'currency'` places it — before the amount in English, after it in Arabic. Placement is the one part that genuinely differs by language, and it is the part nobody should be writing by hand. Concatenating a symbol onto an amount is the same construction that produced the audit's scrambled product titles.
- **Symbol form follows the locale**: `AED` in English, `د.إ` in Arabic. CLDR's short form for each, not a hand-picked glyph.
- **Always the currency's own minor-unit count** — two for AED, including on round amounts. A price column where some entries carry fractions and some do not cannot be scanned down.
- A formatted amount inside a mixed-direction sentence is `<bdi>`-wrapped like any other opposite-direction run.

Which gives `AED 12.50` and `12.50 د.إ`. Neither of the two candidates the question started with; the third one is what the formatter produces once the numeral system is settled.

## 5. Icon mirroring

The question is not "is the layout RTL" but **"does this icon describe the interface or the world?"**

**Mirror** — icons whose meaning is tied to reading direction or interface flow: back and forward arrows, next and previous, undo and redo, indent and outdent, list bullets and numbering, progress direction, the "reply" arrow, page-turn affordances.

**Do not mirror** — icons that depict something in the physical world, or whose form carries the meaning:

- Logos and brand marks.
- Media transport controls. Play always points the same way; it refers to tape direction, not reading direction.
- Clocks and time. Clockwise is clockwise in every locale.
- **Maps and anything drawn on them.** A map is a depiction of physical space. Mirroring it produces a false map.
- Real-world objects: cars, keys, cups, buildings, people.
- **Turn-by-turn direction icons.** "Turn right" stays turn-right. It describes a physical manoeuvre, not an interface direction. This one catches almost everyone.
- Checkmarks, and most glyphs whose asymmetry is incidental rather than meaningful.

Every icon carries an explicit mirroring flag. The default is *do not mirror*, because a wrongly-mirrored real-world icon is a worse failure than an unmirrored arrow.

## 6. Surfaces the system does not own

Some surfaces are drawn by somebody else and only rendered by us: a map, an embedded payment or 3-D Secure page, an OS-drawn date picker or select popup, a video player with vendor chrome, a captcha, an ad slot. They sit inside our layout, they do not read our tokens, and they do not obey our direction.

**The map is the clearest case, and the audit found it is the one surface the system does not own — nowhere declared as such.** The failure mode is precise rather than vague. Under `dir="rtl"` the container and its overlay geometry mirror while the third-party surface does not, so the chrome ends up on the wrong side of a map that has not moved. The audit's example is the ETA chip, which stays in the corner the map no longer occupies. That is not a partial fix that gets better with more work; it is the inverse of correct, and it is worse than not flipping at all.

The rule: **the container flips, the surface does not.**

- Chrome around it — controls, sheets, overlays, attribution, the ETA chip — is ours. It uses logical properties like everything else and it mirrors.
- The surface itself is direction-neutral and is treated as an opaque box. A map is a depiction of physical space (§5), so mirroring it produces a false map.
- This is the one place a subtree may re-set `dir`. `dir="ltr"` on the embed keeps the bidirectional algorithm away from anything the vendor draws. §1 says components never set `dir` themselves; this is the declared exception to that, and it is declared here rather than decided inside the component that happens to hold the map.
- Third-party APIs almost always position in physical terms — `top`, `left`, `bottom-right`. Converting logical to physical is permitted **only in the adapter at that boundary**, and that adapter is the only place in the system allowed to contain a physical direction property. Everywhere else it is still a defect.

### Declaring one

A surface in this category is **declared before it is embedded**, not discovered when somebody flips the layout. Discovery is exactly what happened in v0: the map's behaviour under RTL was nobody's decision, so it had no owner, no test, and no way to be wrong on purpose.

A declaration names, at minimum:

- **The surface and its vendor**, so that changing vendor has a known blast radius instead of an unknown one.
- **That it does not mirror**, and that its chrome does. Both halves, because writing down only the first is what produces the inverted layout above.
- **Its coordinate space** — physical or logical — and which adapter converts. This is what makes the one permitted physical property findable.
- **How it receives language.** A third-party surface has its own locale setting and will not read ours. A map whose labels are still English after a language switch is not localised, and nothing in our string catalogue can reach it. If the declaration does not say how language is forwarded, it is not forwarded.
- **What it does not inherit** — tokens, focus styles, contrast guarantees. A foreground/background pairing rendered inside a surface we do not own cannot be declared in `pairs.json`, so it sits outside the guarantee in [decision 010](../../decisions/010-contrast-is-a-token-layer-guarantee.md). Saying so is the point: an undeclared third-party surface is an unchecked one in exactly the sense that an undeclared pairing is.

The exemption covers the surface and never the controls drawn on top of it. "The map is exempt" must not be allowed to become "the map screen is exempt" — that is how one declared box turns into an undeclared screen.

---

## Open questions — decided later, recorded here

These are genuinely unsettled. They are listed so that nobody quietly settles them inside a component.

Three items that were here have moved into the rules above. Numerals and currency are in §4 — the numeral question did split into two decisions, quantities and identifiers, and currency stopped being three entangled choices once the numeral system was fixed. The type-scale question is in §2, settled by decision 007 now that the token layers exist.

- **Date, time and duration formatting.** Part of this no longer needs deciding: digits are Western and the formatting goes through the one boundary, both from §4. What is left is open for reasons, not for want of attention.
  - *Calendar.* Gregorian is the working assumption for anything transactional — an order date, a trip receipt, a delivery window. Hijri is not one decision but two: Umm al-Qura, tabular and observation-based Hijri disagree about which day it is today, so "show the Hijri date" is a question about which authority we follow before it is a question about a format. Neither product currently needs it, and adopting it decoratively would commit us to an authority we have no reason to pick.
  - *Duration and relative time is the hard part, and it is not a formatting problem.* Arabic has six plural categories including a dual, so "2 minutes" is not "3 minutes" with a different number substituted into it. `Intl.PluralRules` and `Intl.RelativeTimeFormat` will make the selection, but only against message strings authored in all six forms — and no string catalogue exists yet. This is blocked on a content commitment, not on a code decision, and writing a rule now would produce one nobody could follow.
  - *12-hour versus 24-hour* is the smallest part and follows the locale unless a product argues otherwise. It is listed only so that it is not quietly settled inside a component.
- **Pluralisation and countable phrases, generally.** The same six-category problem is not confined to time: "3 items in cart", "2 stops", "5 left in stock". The audit found these built by English binary concatenation, which cannot express a dual and has nowhere to put a category. This gets settled when the string catalogue is designed, and it is recorded here now because the shape of that catalogue is determined by this constraint rather than adjusted for it afterwards.

When any of these is decided, it moves out of this section into the rules above and gets a Decision Log entry.
