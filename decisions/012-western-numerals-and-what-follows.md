# Decision 012 — Western numerals in both locales, and the split between formatted and transcribed

**Date:** 2026-08-04
**Status:** accepted

## Context

`content/rules/rtl-arabic.md` carried two open questions from Stage 0: which numeral system Arabic uses, and how currency is formatted. The [Stage 1 audit](../audit/stage-1-v0-audit.md) supplied the evidence that made them answerable — and showed why they could not have been answered earlier.

## Problem

Does Arabic Mizan render `١٢٫٥٠` or `12.50`, and what does that imply for currency?

## Constraints

- The Gulf is genuinely mixed. Arabic-Indic digits are correct Arabic; Western digits are what most Gulf commercial interfaces actually use.
- The audit found every digit in v0 produced by `toFixed`, `Math.round` or raw interpolation across **21 sites in four formats**, with no `Intl` anywhere. There was no single place a decision could be applied even if one had been made.
- Prices, ETAs, quantities, licence plates and phone numbers are all "numbers" and may not want the same answer.

## Options

1. **Arabic-Indic in Arabic, Western in English.** The linguistically orthodox answer.
2. **Western in both.**
3. **Per-context**, decided case by case.

## Trade-offs

Option 1 is defensible and is what a naive reading of "localise properly" produces. Its costs are concrete: mixed-numeral columns become unscannable next to Latin brand names, which is the actual composition of a Gulf grocery catalogue; and the same product's price stops being comparable between the two language versions of the same page.

Option 2 is what most Gulf commercial software does, and it risks reading as under-localisation to someone who checks only the numerals.

Option 3 is not an option until there is a formatting boundary to apply it at. With 21 concatenation sites it is 21 decisions, which is to say none.

## Decision

**Western digits (`0123`) in both locales**, and — the part that matters more — **one formatting boundary**. No `toFixed`, no manual concatenation, no digits assembled inside a component.

The question also splits, as the audit suspected, into two categories that behave differently:

- **Formatted quantities** — prices, fares, ETAs, distances, counts. These go through the formatter and are subject to this decision.
- **Transcribed identifiers** — licence plates, phone numbers, IBANs, order references. These are **not formatted at all** and are reproduced glyph for glyph.

The test between them: *would changing the digits change what the number refers to, or only how it is written?* A price written in Arabic-Indic is the same price. A licence plate written in Arabic-Indic may be a different plate.

## Why

The numeral choice is the smaller half of this entry. The larger half is that **it is only safe to decide because the boundary exists.** With one formatter, reversing this decision is a one-line change. With 21 concatenation sites it would be a migration, and a decision that expensive to reverse should not be made on evidence this mixed.

That is the general shape worth remembering: *the reversibility of a decision is a property of the architecture underneath it, and improving that architecture is often more valuable than getting the decision right.*

On the choice itself — Western digits win on scannability in mixed catalogues, on cross-language comparability, and on matching what the market actually does. It is the weaker of the two arguments in this entry and the one most likely to be revisited.

**A concrete trap, recorded because it will bite:** CLDR's default numbering system for `ar` is `arab`. A bare `Intl.NumberFormat('ar-AE')` produces Arabic-Indic digits. The numbering system must be requested explicitly — `ar-AE-u-nu-latn` — in *either* direction, so this decision is not the absence of configuration but a specific configuration.

## Currency follows

Fixing the numeral system disentangles what looked like three coupled questions:

- **Decimal separator follows the numeral system, not the language.** Latin digits take `.`, never the Arabic decimal separator U+066B.
- **Placement is delegated to `Intl`**, not hand-placed. The audit found four hand-built currency formats; the symbol's side is a locale property and no human should be choosing it per call site.
- **Symbol form follows the locale** — `AED` in English, `د.إ` in Arabic. Always two minor units.

The result is `AED 12.50` and `12.50 د.إ` — **neither of the two candidates the original question offered.** That is the sign the question was badly posed rather than hard: it presented a choice between two whole strings when the string has three independent parts.

## Consequences

- One formatter, and using it is not optional. A `toFixed` in a component is a defect, and eventually a lint rule.
- The identifier category needs to be explicit in component APIs, because a plate and a price are both "a number with digits in it" and nothing about their types distinguishes them.
- The Arabic-Indic path must be kept working even though it is unused, or reversing this becomes a rewrite rather than a configuration change. The formatter takes the numbering system as a parameter; it is not hardcoded.
- This decision is deliberately cheap to reverse. That is a feature and it is doing real work, given how mixed the evidence is.

## What would make us revisit this?

Research with Arabic-reading participants in Stage 8 is the intended test, and it is the sort of question where a designer's instinct is worth less than one session of watching someone read a price. If participants read Western digits as untranslated rather than as normal, the argument inverts. The identifier split is much more robust and is unlikely to move regardless.
