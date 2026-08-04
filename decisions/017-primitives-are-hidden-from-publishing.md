# Decision 017 — Primitives are hidden from publishing; only the semantic layer is a library

**Date:** 2026-08-04
**Status:** accepted

## Context

The Figma file was published as a library. That is Stage 3's ending condition, and it changed something the system had until then been able to leave alone.

Every previous decision about this file was made while it was private. A private file has exactly one consumer — the person who opened it — and that person is also the person running the sync, so nothing they bind to can surprise anybody. Publishing removes that. The 74 variables are now reachable from any file that subscribes, by people who have never read this repository.

The plugin has been explicit about not deciding this, in [`machinery/figma-plugin/README.md`](../machinery/figma-plugin/README.md):

> **It does not set scopes, code syntax, or publishing visibility.** Those are decisions about a Figma library, and the plugin has no opinion it could honestly base on the token JSON.

That was true and it was the right refusal: nothing in a DTCG document says which variables a designer should be allowed to pick. But it was a refusal to decide, and Figma has a default. **Publishing turned a non-decision into a default nobody chose**, and the default is "everything".

The shape of what is now exposed:

```
primitive   59 variables   Default
theme       12 variables   light, dark
product      3 variables   market, move
```

Fifty-nine of the seventy-four are primitives.

## Problem

Now that the file is a library, which variables should a consuming designer be able to bind to?

## Constraints

- **The semantic layer is the architecture.** [008](./008-the-colour-consolidation.md) consolidated 33 colours to a smaller set on one claim: a brand change is one edit, because everything downstream references rather than restates. That claim holds only while nothing binds to a primitive.
- **The drift detector cannot see a consuming file.** [`check-drift.mjs`](../machinery/scripts/check-drift.mjs) compares this file's *local* variables against the token source. A binding made in somebody else's file is invisible to it, on any plan, by both routes — the snapshot and the bridge ([015](./015-rung-2-has-a-plan-floor.md), [016](./016-build-the-read-bridge-rather-than-adopt-figma-console-mcp.md)). Whatever governs this has to work at publish time, because there is no detection after it.
- **The plugin does not set publishing state, and does not touch it on re-sync.** Whatever is decided here is set by hand, once, and survives.
- **Solo maintainer, four to six hours a week** ([010](./010-contrast-is-a-token-layer-guarantee.md)).

## Options

1. **Publish everything.** The current default. Every primitive is pickable in every consuming file.
2. **Hide the primitive collection from publishing.** Consumers see `theme` and `product` only. Alias chains still resolve — a semantic variable pointing at a hidden primitive works exactly as before — but nobody can bind to `neutral/700` directly.
3. **Publish everything, and use scopes** to keep primitives out of the pickers where they would be wrong.
4. **Unpublish.** Keep the file private and hand consumers nothing.

## Trade-offs

**Option 1** costs the thing the system was built to protect. A designer who binds a card border to `primitive/neutral/700` has made a decision the token source does not know about, in a file the detector cannot read, and it will not move when `border.default` moves. It will not look wrong on the day it is made — that is the whole difficulty. It looks wrong six months later when the neutral ramp shifts and one file did not follow.

**Option 2** costs discoverability, and the cost is real rather than notional. A designer inspecting `text/secondary` can see it resolves to something; with the primitive hidden they get a less useful answer about *what*. It also removes a legitimate escape hatch — the one-off illustration, the marketing frame, the case where a primitive genuinely is the right answer and the semantic layer has no name for it yet. Under this option that person has to ask, and asking is slower than taking.

That slowness is the point, but it is still a cost, and pretending otherwise would be dishonest. **The remedy for "the semantic layer has no name for this" is to name it in `content/tokens/` and re-sync** — which is exactly the contribution path Stage 6 has to build. Until that path exists, option 2 makes a real request slower with no fast route to satisfy it.

**Option 3** is the more precise instrument and it is worth stating fairly. Figma scopes control which pickers a variable appears in, so a primitive could be kept out of the colour picker while remaining inspectable. What it does not do is prevent a determined binding — a scope is a filter on a menu, not a permission. It also multiplies the hand-maintained state: 59 primitives, each with a scope set nothing checks, is a larger un-governed surface than one collection-level switch.

**Option 4** costs the stage. A library nobody can consume proves nothing, and Stage 3 ships a library.

## Decision

Primitives are hidden from publishing. The `theme` and `product` collections are published; the `primitive` collection is not.

A consuming file binds to semantics. It cannot bind to a raw value, because a raw value is not a decision anybody made about that use.

## Why

**A primitive is not a decision, and a library should only publish decisions.** `neutral.700` is a fact about a colour ramp. `text.secondary` is a decision about what secondary text should look like, taken once, with a contrast guarantee behind it ([010](./010-contrast-is-a-token-layer-guarantee.md)) and a reason in its `$description`. Publishing both invites a consumer to choose between a decision and a fact, and the fact is easier to find — it has the more obvious name and it looks the same on the day.

**This is the same argument as [016](./016-build-the-read-bridge-rather-than-adopt-figma-console-mcp.md), one layer out.** There the refusal was a second *write* path into Figma, because it destroys the attribution of every finding. Here it is a second *read* path out of the token system: a binding that reaches past the semantic layer produces a screen the source cannot explain and the detector cannot see. Both entries land on the same principle — **the value of a system that has one way in is entirely in the word "one"**.

**The control has to be at publish time because there is no control after it.** This is the uncomfortable part and it is why the answer is a switch rather than a convention. Every other rule in this repository is enforced by something: the gates enforce the token rules, the selftest enforces the plugin's claims, the drift detector enforces the display. A rule about what consuming files bind to has no enforcer at all, on any plan available here. What Figma offers instead is prevention, and prevention is the only kind of control this particular rule can have.

**A convention would not hold, for the reason [016](./016-build-the-read-bridge-rather-than-adopt-figma-console-mcp.md) already gave about agents and this repository's own `CLAUDE.md` demonstrates about assistants.** "Please bind to semantics" is a sentence in a document, addressed to people who have not read the document. The legacy quarantine in `CLAUDE.md` is three paragraphs of increasingly emphatic instruction not to tidy code that any competent person would tidy on reflex, and it exists because the polite version did not work.

## Consequences

- **Fifty-nine of seventy-four variables become invisible to consumers.** The published library is 15 variables wide. That is a smaller and better library, and it will look surprisingly small to anybody expecting a palette.
- **Alias chains still resolve.** A semantic variable referencing a hidden primitive renders correctly in a consuming file. Hiding controls what can be *picked*, not what can be *resolved* — this is the property the whole decision rests on, and it is the one thing here that must be confirmed in the file rather than assumed from documentation.
- **A new un-governed surface exists, and naming it is the point of this bullet.** Publishing visibility is hand-set, in Figma, and nothing checks it. It is the first piece of state in this system that is neither in `content/tokens/` nor verified by a gate. The plugin leaves it untouched on re-sync, so it will not be undone by accident — but it could be changed by hand and no run of anything would report it. **This decision creates exactly the kind of undetectable hand-edit that rung 2 exists to catch, and rung 2 cannot catch this one.**
- **The escape hatch closes before its replacement opens.** A designer who needs a value the semantic layer does not name now has to ask, and the contribution flow that answers such a request is Stage 6 work ([006](./006-agents-are-consumers-of-the-contribution-flow.md)). Between now and then the honest answer is "raise it with me", which does not scale and is not meant to.
- **`text.secondary-market` and `-move` remain published.** [007's Amendment](./007-modes-for-shared-namespaces-for-unique.md#amendment--the-cost-this-decision-did-not-anticipate) already records that the two-dimension slot tokens leak into the published CSS. They leak into the published library too, and this decision does not fix that — the slots live in the `theme` collection because that is what makes the cross-dimension chain resolve.

## What would make us revisit this?

**Somebody needing a primitive twice.** One request is a gap in the semantic layer and the remedy is to name the token. Two requests for the same primitive, or one request nobody can satisfy by naming anything, means the layer is missing a concept rather than a value, and the answer is a new semantic token — not a reopened palette.

**The publishing state being found changed.** If anybody ever opens the file and finds primitives published again, the hand-set switch is not durable enough and the plugin has to learn to set it — which means teaching it something the token JSON does not say, and inventing a convention in `content/tokens/` to say it. That is a real cost and it is deliberately not being paid today.

**A consuming file being found bound to a primitive.** It would prove hiding is not the barrier this entry assumes. There is no way to detect this from here; it will arrive as somebody mentioning it.

**Figma changing what a hidden variable does.** The whole decision rests on hidden-but-resolvable. If a hidden primitive ever stopped resolving through an alias in a consuming file, every semantic variable in the library would break at once, and the answer would be option 3 or option 1 with a stated risk — not this.
