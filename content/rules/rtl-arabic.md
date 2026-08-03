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

- **`letter-spacing` is `0` for Arabic. Always.** Arabic script is cursive and joined; letter-spacing breaks the joins and renders the text visibly wrong, not merely differently styled. A global `letter-spacing` applied to a whole page is therefore a defect, not a style choice.
- **Arabic needs more line-height than Latin at the same size.** Ascenders, descenders and diacritics occupy more vertical space. The Arabic type scale compensates rather than inheriting Latin values.
- **The font stack must contain a real Arabic face**, not a Latin face with fallback. A Latin-only stack silently hands Arabic rendering to whatever the OS picks, which is inconsistent across platforms and usually wrong.
- Arabic and Latin at the same nominal `font-size` do not appear to be the same size. Optical size matching is a per-scale decision, recorded when the type scale is built.

## 3. Bidirectional content

Mixed-direction content is the normal case in this market, not the exception. A product title like `Apple iPhone 17 Pro` inside an Arabic layout, an address with an Arabic street name and a Latin building number, a phone number, a licence plate.

- **Wrap runs of opposite-direction content in `<bdi>`.** Without it, the bidirectional algorithm reorders neighbouring punctuation and digits in ways that look like a rendering bug and are actually correct behaviour applied to unmarked content.
- Never build a mixed-direction string by concatenation and hope. Isolate the parts.
- Test with a real mixed string, not with Latin text in an RTL container. The second one looks fine and proves nothing.

## 4. Icon mirroring

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

## 5. Surfaces the system does not own

A map is the clearest case. It is a third-party surface, it must not mirror, and the interface chrome around it must. The rule: **the container flips, the surface does not.** Controls, sheets, and overlays positioned against a map use logical properties like everything else; the map itself is direction-neutral and is treated as an opaque box.

Any surface in this category is declared explicitly rather than discovered.

---

## Open questions — decided later, recorded here

These are genuinely unsettled. They are listed so that nobody quietly settles them inside a component.

- **Arabic-Indic (`٠١٢٣`) versus Western (`0123`) numerals.** Regional usage is mixed and inconsistent, and the right answer plausibly differs by context — prices, ETAs, quantities, licence plates, phone numbers. Likely to become more than one decision.
- **Currency placement and format.** `AED 12.50` versus `١٢٫٥٠ د.إ` involves symbol position, decimal separator, and numeral system at once, and the three are not independent.
- **Whether the Arabic type scale is a mode of the Latin scale or a parallel scale.** This interacts directly with the token architecture and should not be settled before the token layers exist.
- **Date, time and duration formatting**, which has the same numeral problem plus calendar considerations.

When any of these is decided, it moves out of this section into the rules above and gets a Decision Log entry.
