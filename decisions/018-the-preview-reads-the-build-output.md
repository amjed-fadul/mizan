# Decision 018 — The Stage 2 preview is an application that reads the build output, and it keeps its own Mizan content

**Date:** 2026-08-04
**Status:** accepted

## Context

Stage 2 produced a token system: 77 tokens, two dimensions, four combinations, two deterministic gates. All of it is JSON and generated CSS, and none of it is visible. The stage needed an artifact that could be looked at, and rule 7 requires that artifact to justify itself — *what design-system capability does this prove?*

The question is not whether to show the tokens. It is what kind of thing does the showing, because that choice decides whether the artifact can be wrong.

## Problem

What form should the Stage 2 artifact take, given that the one thing it must never do is describe a token system other than the one it is built from?

## Constraints

- [Decision 002](./002-react-typescript-vite.md) fixed the stack: React, TypeScript, Vite.
- Rule 1: `content/tokens/` is the only editing surface, and CSS is a generated display. A preview that restates a value has created a second source.
- Rule 7: it proves a capability or it does not get built.
- The legacy quarantine. The comparison needs a v0 screen, and `legacy/` may not be imported from, refactored, or repaired.
- The no-physical-properties rule applies to the whole package, including the pane whose subject is v0's physical properties.

## Options

1. **Storybook**, or an equivalent off-the-shelf documentation tool.
2. **A static page** — markdown or hand-written HTML with the values written out.
3. **Screenshots** in the README.
4. **An application** that imports the generated CSS and the declared pairings and derives everything on screen from them.

## Trade-offs

Option 1 is the default answer and will probably be the right one at Stage 4, when there are components to put in stories. At Stage 2 it is a poor fit: there are no components, and Storybook's token story is an addon that reads a config someone maintains alongside the tokens. That is the second source rule 1 exists to prevent, arriving through a tool rather than through carelessness.

Options 2 and 3 fail the same way and more obviously. A screenshot of dark mode is a claim about dark mode; it is true on the day it is taken. The specific thing Stage 2 needs to demonstrate is that twelve declared pairings hold in **all four combinations**, which is exactly the class of fact a static artifact records once and then quietly stops being true about.

Option 4 costs the most to build and carries its own risk: an application is code, and code in a package that also contains the design system's public output can drift into being part of it. It also has to be maintained across every later stage or removed.

## Decision

**An application.** `packages/preview/` imports `packages/tokens/css/tokens.css` twice — once as the stylesheet that renders the page, once as text that the gallery parses — and reads `content/tokens/pairs.json` directly from the editing surface. It holds no token values of its own.

## Why

The capability this proves, stated as rule 7 demands:

**A design system's documentation can be incapable of describing a system other than itself.** Because the same file both styles the page and supplies the gallery's contents, a token that changes value changes the page and the description of the page in the same build. There is no step where someone updates the documentation, and therefore no state where they have not.

The contrast matrix is the sharper half. It recomputes the ratios in the browser from resolved values, and the arithmetic is aligned with `machinery/scripts/check-contrast.mjs` so a number read on screen and a number printed by the gate are the same number. That makes the gate's guarantee inspectable rather than merely asserted — a reader can see the twelve pairings in four combinations at once and check the two that are close.

The rest follows from what the mode flip makes visible. v0's category title is built by concatenation; flip to Arabic RTL and the `100` migrates to sit against `Lipton` while `كيس` is stranded. The rebuilt pane keeps them together because the name and the size are separate `bdi` runs and the separator is markup rather than a character inside a sentence. That is a two-second demonstration of why the bidi rules are rules, and it does not survive being a screenshot.

## The v0 pane is transcribed, not imported

The comparison needs the v0 category screen, and the eight products in it are transcribed from `legacy/src/market/screens/CategoryScreen.tsx` character for character rather than imported.

This is deliberate and it costs something real. Importing would guarantee the two panes show the same catalogue forever; transcription can drift from v0 silently and no check would catch it. The reason to pay that cost: `legacy/` is a fixed artifact and the subject of two exercises that measure the distance between it and what replaces it. An import edge from a live package into quarantined code makes v0 a dependency — something that gets updated when the thing depending on it needs updating, which is precisely how quarantines end. The drift risk is bounded because the catalogue is eight items and a fixture; a dependency edge is not bounded at all.

**A related deviation, captioned in the page itself rather than hidden:** the v0 pane *describes* its 72 physical direction properties rather than reproducing them, because the no-physical-properties rule applies to the whole package. Reproducing a defect in order to demonstrate it is still importing it. The bidi and letter-spacing failures — the more interesting half — reproduce exactly.

## The seam this opens: Mizan content outside `content/`

`packages/preview/src/lib/strings.ts` is 204 lines of Mizan's Arabic and English interface copy. `packages/preview/src/compare/products.ts` is the Market catalogue — Arabic product names, sizes, AED prices. By the plain reading of the directory table in `CLAUDE.md`, both are "Mizan's Arabic specifics" and both are living somewhere the table does not say content lives.

Naming that is the point of this section. The arguments for leaving it, weakest first:

- **Rule 2's actual test is unaffected.** The test is that `machinery/` still makes sense with `content/` deleted, and it does. Neither file is in `machinery/` and neither is reachable from it. This is true and it is also the least interesting defence, because it answers a rule nobody accused the preview of breaking.
- **`content/` is a data and rules surface, not a code one.** It holds DTCG JSON and markdown that agents read. `strings.ts` is a TypeScript module with a type and an accessor; moving it there would put the first executable file in a directory whose character is that it has none.
- **The test that would actually move them is whether a second artifact needs them,** and today none does. A string used in one place is a local; a string used in two is content. The catalogue is a fixture for one comparison, and the interface copy is the chrome of one page whose lifetime is Stage 2's.

That third argument is the load-bearing one and it should be read for what it is: a rule that fits the present arrangement, proposed by the arrangement. It is not wrong, but it was not applied in advance and would not have been discovered if the files had happened to sit somewhere else.

**So it is recorded as a debt with a trigger rather than argued away.** The interface copy is Mizan content in the wrong directory. It is tolerable while it has exactly one consumer, because a single copy cannot disagree with itself. The moment a second artifact needs any of these strings — the Stage 4 component documentation is the likely one — they move to `content/`, and the shape they move into has to be decided then, because JSON in `content/` and a typed accessor in `machinery/` is a different arrangement from what exists now and is probably the right one.

## Consequences

- **The preview must be rebuilt when tokens change, and it will show the change without being edited.** That is the whole benefit and it also means a token rename breaks the gallery loudly. Loudly is correct.
- **`packages/` now exists and was not in the repository's own directory law.** `CLAUDE.md`'s table and `README.md`'s map describe `machinery/` and `content/` and stop. Both gain a `packages/` row in the same change as this entry; a directory that no rule describes is a directory anything can be put in.
- **An application is a maintenance liability across seven remaining stages.** It either gets carried forward and updated, or it gets frozen as the Stage 2 exhibit and a new one is built. That call is not made here, but it is owed by Stage 4.
- **Two of Mizan's content files are outside `content/`**, on the terms above, with the trigger for moving them stated.
- **The v0 pane can drift from `legacy/`** and nothing will report it. Accepted, for the reason in the section above.

## What would make us revisit this?

The form is wrong if the preview ever needs a value that is not derivable from the build output — the first hardcoded hex or duplicated token value is the signal, because at that point the artifact can describe a system it is not, and the only argument for building it this way has gone.

The content seam is wrong the moment a second consumer appears, and that is a fact rather than a judgment: two copies of an Arabic string in this repository is the defect the Stage 1 audit spent a section on.
