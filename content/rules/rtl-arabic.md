# The RTL and Arabic rule layer

**Status: living document.** Rules are added here as they are decided, and this is the only place they are decided. When a new rule is settled it goes in this file — never into a single component, and never into an agent's instructions.

## Why this file exists rather than an agent

RTL correctness is not a review step and not a specialist's job. Every agent, script, check and human working on Mizan reads the same rules from here, which makes correct behaviour unavoidable rather than something that has to be invoked. An "RTL agent" would be a thing you could forget to call. A rule layer is not.

Arabic here is the advanced stress test of a global-grade system, not a fork of it. If a rule below only makes sense for Arabic, it is probably in the wrong place — the direction-neutral version of it belongs in the core.

## The coverage of this file is the ceiling on the coverage of the audit

The Stage 1 audit read every file in v0 and did not report the underline, transparency, line-breaking or text-expansion defects that were sitting in front of it — `text-decoration: underline`, `line-through` and `opacity: 0.5` are all in v0 today. It missed them because it audited Mizan against Mizan's own rules, and these rules did not contain them. An audit finds what some rule makes findable, and no more.

That is the whole reason this is a living document rather than a finished one. An unwritten rule is an unfindable defect.

## Sources

The rules here are ours, but they are not all discovered here. The largest external source is Ahmad Shadeed's [RTL Styling 101](https://rtlstyling.com/posts/rtl-styling/), the fullest public treatment of the subject, and several rules below exist because that guide names a failure we had not written down.

Everything taken from it was re-verified in a current browser before being adopted, because the guide dates from 2019–20 and parts of it have expired. Where its advice is no longer needed it has been dropped rather than repeated: the `box-shadow` fallback for underlines, physical fallbacks for logical `border-radius`, and the LTR/RTL stylesheet-doubling tools it recommends, which produce two physical stylesheets and contradict §1 outright. The guide also branches on `[dir="rtl"]` inside component selectors — reasonable in a codebase without logical properties, unnecessary in one with them, and forbidden by §1. Individual departures are noted where they arise.

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

**The logical corner radii need no fallback.** `border-start-start-radius` and its three siblings arrived later than logical margin and padding, which is why older advice pairs them with physical fallbacks and a PostCSS plugin. They have been Baseline widely available since September 2021 and the fallback is now the more dangerous half: a physical `border-radius` written underneath a logical one does not flip, so it quietly reinstates the defect it was added to hide, in exactly the browsers nobody is testing. What the failure looks like is a tab, chip or segmented control with its rounded end on the wrong side — square corners butted against the page edge and round ones against the neighbour they were meant to join.

### What `dir` does not reach

Setting the direction flips the box model and the text. It does not touch a property that names a physical axis, and those properties are what produce a half-flipped screen — which the audit already established reads as more broken than an unflipped one.

- **Transforms do not flip.** `translateX(6px)` moves six pixels rightward in both directions. An arrow that nudges forward on hover in English nudges backwards in Arabic, into the word it just came out of, and a panel that slides in from off-screen slides in from the wrong edge. A transform that means "forward" either takes its sign from the direction or is not used: animate `margin-inline-start` or `inset-inline-start` instead. See §5 for the one place a transform is allowed to encode direction, and for what it does to everything else on the element.
- **Background images do not flip, and `background-position` has no logical keywords.** This was checked rather than assumed: `background-position: inline-start 6px center` does not parse in a current engine — `left`, `right`, `top` and `bottom` are all there is. A search glyph painted as a background image on the right edge of a field stays on the right edge in Arabic, at the opposite end from the caret and the placeholder it belongs to, and any arrow drawn into the image points the way it was drawn. Directional affordances are elements or pseudo-elements placed with `inset-inline-*`. If something genuinely has to be a background image, it needs a per-direction asset chosen by the mirroring flag in §5, not a position that gets nudged.
- **Scrollbars flip, and their side is not yours to assume.** A scrolling container inside an RTL subtree puts its scrollbar on the left. Physical padding reserved for it then opens a gap on one side while content slides under the bar on the other. Reserve the space with `scrollbar-gutter: stable` and logical padding. The viewport's own scrollbar is a separate question that engines answer differently — Chromium keeps it on the right even with an RTL root — so no layout may depend on which side it lands.

Direction is set once, high up, via `dir` on a root element. Components never set `dir` themselves and never read it to branch their styling. A component that needs to know the direction to lay itself out is a component that has not been written with logical properties.

## 2. Typography

- **`letter-spacing` is `0` for Arabic. Always.** Arabic script is cursive and joined; letter-spacing breaks the joins and renders the text visibly wrong, not merely differently styled. A global `letter-spacing` applied to a whole page is therefore a defect, not a style choice. The audit found exactly that — a global `0.01em` reaching every Arabic product title, while two components had already noticed the problem and fixed it locally for Latin reasons. There is one tracking token in the system, `letter-spacing.none`, and no Arabic tracking token exists to be reached for.
- **Arabic needs more line-height than Latin at the same size.** Ascenders, descenders and diacritics occupy more vertical space. The Arabic scale compensates rather than inheriting Latin values: `line-height.arabic-tight` / `-normal` / `-relaxed` at 1.45 / 1.75 / 1.9 against Latin's 1.25 / 1.5 / 1.7. The size of that gap is itself the argument — Arabic body text needs roughly what Latin uses for long-form, so the two are offset by about a full step and no single shared value is anything but cramped Arabic or loose Latin.
- **The font stack must contain a real Arabic face**, not a Latin face with fallback. A Latin-only stack does not fail loudly; it silently hands Arabic rendering to whatever face each OS picks, so the same string is set differently on iOS, Android and Windows and nobody chose any of it. `font-family.arabic` is that face. Note that `system-ui` does not satisfy this rule: it is not an Arabic face, it is a promise that the OS will choose one.
- **The optical correction is a token, not an adjustment each designer makes by eye.** Arabic set at a Latin `font-size` reads as the smaller of the two. `font-size.arabic-scale` is `1.08`, and the value is bounded rather than chosen freely: the tightest step in the Latin scale is 12px to 13px, a ratio of 1.083, so a correction of 1.083 or more makes the Arabic rendering of one rung indistinguishable from the Latin rendering of the next and an eight-step scale becomes seven. If Arabic ever needs a larger correction, the 12/13 pair is what has to change first. Because line-height is a unitless ratio, the correction reaches leading on its own and must not be applied twice.

### Underlines, and why the browser's default is not the fix

Arabic carries dots below the baseline — ب, ي, ج all do — and a default underline is drawn straight through them. The reader does not see an underlined word. They see letters whose dots have fused with a line, and the dots are the entire difference between ب, ت and ث.

The known answer is `text-decoration-skip-ink`, and it has since been absorbed into the platform: `auto` is the initial value, every current engine implements it, so the property is already on and no rule is needed to switch it on. What it actually does under Arabic is worth looking at rather than assuming, because it does not solve this. Skip-ink interrupts the line wherever a glyph crosses it; on an Arabic string that fires several times per word, and a link arrives as four or five dashes with the dots sitting in the gaps between them. The collision has been traded for a broken line.

- **A link underline declares its offset and its thickness.** Pushing the line clear of the dots — `text-underline-offset` of roughly a quarter em at interface sizes — restores one continuous underline that touches nothing. Verified at 16px in a current browser: default renders as fragments, offset renders as a single line. This belongs in the token layer for the same reason the optical size correction does; an offset chosen per component is an offset that will differ per component.
- **Never `text-decoration-skip-ink: none`.** It restores the collision the default was added to prevent, and the result is worse than either alternative.
- **`line-through` is outside all of this.** Skip-ink applies to underlines and overlines only, so a strikethrough is drawn across whatever glyphs are there and there is no property that will move it. A struck-out "was" price therefore has a line through the letterforms and the digits, which means the strike cannot be the only thing carrying the meaning: the old price needs its own colour token and its own label as well. The amount inside it is a formatted quantity like any other and goes through the boundary in §4 — a struck price assembled by concatenation is struck through in whatever scrambled order the bidirectional algorithm produces.

### Text colour is opaque

**Never give text colour an alpha channel.** `color: rgba(...)` on Arabic produces visible dark patches along the joins between letters — the guide's "areas with a different colour between letters", and the reader's impression is of grubby marks or a font that has failed to load. The cause is mechanical rather than mysterious: Arabic is cursive, adjacent glyph outlines overlap where the letters connect, and a translucent fill painted glyph by glyph accumulates in the overlap. It reproduces today, in a current browser, in three different Arabic faces, and it is clearer in colour than in grey because the overlap comes out more saturated as well as darker.

**`opacity` does not cause this, and is still not how a disabled state is built.** The two are usually named together and they should not be. An element with `opacity` is composited once, already flattened, so the joins stay uniform — tested side by side against the `rgba` case, which fails in the same string at the same size. Separating them matters because it changes the fix: the rule is about the *colour*, and moving a disabled style from `rgba` to `opacity` would look like compliance while fixing nothing that needed fixing.

What is wrong with `opacity: 0.5` on a disabled control is a different thing entirely. It produces a rendered colour that no token declares, so the resulting foreground/background pairing cannot appear in `pairs.json` and sits outside the contrast guarantee of [decision 010](../../decisions/010-contrast-is-a-token-layer-guarantee.md). A disabled state is a declared pair of tokens. v0 carries `opacity: 0.5` on the disabled button in all three stylesheets, which is one unreviewable contrast ratio per product.

### Arabic does not break, and does not abbreviate

**Never `word-break: break-all`, and never `overflow-wrap: anywhere`, on anything that can hold Arabic.** Verified: ميزان broken across a line becomes م on one line and يزان on the next, and because the letters re-form according to their position, neither fragment is the shape it was — the reader is looking at two words that are not words, not at a word with a break in it. Latin loses a hyphen; Arabic loses the letterforms. There is no such thing as a word break in Arabic because there is no gap inside a word to break at.

- The only permitted emergency wrap is `overflow-wrap: break-word`, which breaks a word solely when it cannot fit on a line by itself. That is common for a URL or an order reference and rare for an Arabic word, which is the whole difference between it and `anywhere`.
- Hyphenation has nothing to do and should not be switched on hopefully. There is no Arabic hyphen.

**Arabic has no abbreviations.** "Saturday" shortens to "Sat"; السبت does not shorten, because its letters are joined and the first three of them are not a word. Any component API that shortens by character count — a three-letter weekday, a two-letter month, a `maxChars` prop — is untranslatable by construction rather than merely awkward, and what ships is a label that reads as a typing error. Short and long forms are two authored strings in the catalogue and the component selects a variant. It never takes a substring.

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

- **Wrap runs of opposite-direction content in `<bdi>`.** Without it, the bidirectional algorithm reorders neighbouring punctuation and digits in ways that look like a rendering bug and are actually correct behaviour applied to unmarked content. A phone number is the cheapest demonstration: `+971 50 123 4567` dropped unmarked into an Arabic sentence renders with its `+` at the far end of the number, so the reader meets the digits first and the plus afterwards. The value is right and the screen is wrong, and nobody can tell by looking whether the number was stored correctly.
- Never build a mixed-direction string by concatenation and hope. Isolate the parts.
- Test with a real mixed string, not with Latin text in an RTL container. The second one looks fine and proves nothing.

### `<bdi>` and `dir="auto"` are not two ways of doing the same thing

They overlap enough to look like alternatives. They are not, and the difference is the case this section did not previously cover.

For an inline run they are equivalent, and measurably so: `<bdi>` computes `unicode-bidi: isolate` and takes its direction from its content, and a `<span dir="auto">` computes exactly the same thing, because the HTML rendering rules now give an isolate to any element carrying a `dir` attribute. We keep `<bdi>` for reasons that survive that equivalence — it is an element rather than an attribute, so it cannot be stripped by a sanitiser or lost in a refactor that rewrites props, and it states in the markup that this run's direction is not the sentence's. Adopting `dir="auto"` alongside it would be a second mechanism for a job that already has one.

Where they genuinely differ is that **`<bdi>` isolates a run and `dir` sets the direction of a block** — and alignment, and the end an ellipsis is placed at, belong to the block. An English product title inside an RTL card truncates at its *beginning*: `...o the Mizan store for shopping`, with the start of the sentence thrown away and the end kept. Wrapping that title in `<bdi>` does not change it, because the block still runs right to left. Setting `dir` on the block does: the same string truncates as `Welcome to the Mizan store f...`. Both results were rendered and read off the screen, not reasoned about.

So the rule has two halves and neither replaces the other:

- **Runs inside a sentence are wrapped in `<bdi>`.** Unchanged.
- **A block whose entire content may be in either direction carries its own `dir`, set from data wherever the data knows.** The catalogue knows the language of a product title. The HTML specification is explicit that `dir="auto"` is a last resort, for when the direction is "truly unknown, and no better server-side heuristic can be applied" — and a design system with a string catalogue nearly always has a better heuristic than the browser does.
- **`dir="auto"` is for content whose direction genuinely cannot be known**: a search query, a review body, a customer's name, an address line somebody typed.

The reason to prefer the known value over the heuristic is that `dir="auto"` reads the first strong character and nothing else. `Lipton شاي أحمر` resolves to LTR, verified, because it opens with a Latin brand name — and this catalogue is full of Arabic titles that open with Latin brand names. The heuristic is right often enough to pass review and wrong exactly where our content lives.

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

### How a mirror is implemented

The flag says *whether*. It has never said *how*, and the two available answers are not interchangeable.

**`scaleX(-1)` is the default mechanism.** It costs no asset, it cannot drift from the original the way a separately drawn mirror can, and it leaves the layout box untouched, so hit area, focus ring and alignment are unaffected. It flips everything the element renders, which is the part that has to be checked:

- **Text and numerals inside the icon flip too**, and mirrored text is not text — it is a smear that a reader will stare at. Any icon carrying a glyph (a numbered marker, a badge with a count, a keyboard key, a currency mark) cannot use the transform.
- **Lighting flips.** A gradient, an inner shadow or an asymmetric stroke terminal encodes where the light comes from. Mirroring moves the light source, and next to icons that did not mirror, that one icon is now lit from the other side — visible as a set that has stopped looking like a set, even to someone who cannot say why.
- **It inverts every other transform on the same element.** Under `scaleX(-1)`, a `translateX(6px)` hover nudge moves the other way. That is composition working correctly, not a bug, but it means a mirrored icon that also animates must be authored as one composed transform rather than two independent declarations — and it is the reason §1 says a directional transform needs its sign derived rather than written.

**A separate asset is the other answer**, and it is required for the icons above and for any icon whose correct mirror is not its reflection — anything a designer would redraw rather than flip.

That makes the flag three-valued rather than boolean: *does not mirror*, *mirrors by transform*, *mirrors by asset*. The default is still *does not mirror*, and an icon whose flag says *mirrors by asset* without the asset existing is a build failure, not a fallback to the transform.

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
