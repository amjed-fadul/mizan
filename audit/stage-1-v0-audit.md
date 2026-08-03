# Mizan v0 — design system audit

**Auditor:** Amjed Fadul
**Date:** <!-- fill in -->
**Scope:** `legacy/src` — Mizan Market and Mizan Move, five screens, three stylesheets
**Audience:** product and engineering leadership at Mizan Labs

> **Before you start:** do not open `legacy/GENERATION-NOTES.md`. It is the answer key. Read it after this document is written, to see what the audit missed.

---

## How to use this template

The headings below are the structure. Everything under them is yours — no findings are pre-filled, deliberately. Delete this section when the audit is written.

Two things worth holding onto while you write:

1. **The reader is not you.** This is written for people who have to fund and staff the work. Severity and cost matter more than elegance, and "what happens if we do nothing" is a question they will ask.
2. **Duplication is not automatically a defect.** Two values that are identical may carry different meanings and should stay separate. Two values that differ slightly may mean the same thing and should merge. Sorting those two cases apart *is* the audit — a list of duplicates is an inventory, not a diagnosis.

### Gathering the facts

Inventory is mechanical; diagnosis is not. Get the mechanical part done quickly:

```bash
grep -rhoE "#[0-9a-fA-F]{3,6}" legacy/src | sort | uniq -c | sort -rn
```

```bash
grep -rhoE "[0-9]+px" legacy/src | sort -n | uniq -c
```

```bash
grep -rhoE "\-\-[a-z0-9-]+:" legacy/src | sort -u
```

Then run the app and look at it, which the greps cannot do for you:

```bash
npm run dev --workspace legacy
```

---

## 1. Executive summary

*Three or four sentences. What state the system is in, what it is costing, and what you propose to do about it. Written so someone who reads only this section is not misled.*

## 2. Method and scope

*What you examined, what you did not, and why.*

## 3. Inventory

*The mechanical findings. Counts, not opinions.*

### 3.1 Colour
### 3.2 Spacing
### 3.3 Typography
### 3.4 Radii and elevation
### 3.5 Components

## 4. Findings

*Each finding: what it is, where it appears, what it costs, and how severe. Severity should reflect impact on users and on the teams' ability to ship — not how much it offends you.*

| # | Finding | Severity | Affected | Cost if unaddressed |
|---|---|---|---|---|
| | | | | |

## 5. Cross-cutting: Arabic and RTL

*This is the section only you can write. Treat it as its own assessment rather than a row in the table above — the failures here are structural, not cosmetic, and they compound.*

## 6. Cross-cutting: accessibility

*What is broken, what it affects, and what a guarantee would need to look like given that no specialist is available to review screens by hand.*

## 7. Recommendations

*Four separate lists. The last two are the ones that demonstrate judgment.*

### What to unify
### What to keep separate — and why
### What to deprecate
### What not to touch

## 8. Priorities and sequencing

*What happens first, and what it unblocks. Constrained by four to six hours a week and two product teams with limited engineering capacity — a plan that ignores that is not a plan.*

## 9. Open questions for Stage 2

*What the audit surfaced but cannot settle. These become Decision Log entries, not audit findings.*
