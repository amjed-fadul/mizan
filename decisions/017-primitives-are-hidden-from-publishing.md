# Decision 017 — Primitives are hidden from publishing; only the semantic layer is a library

**Date:** 2026-08-04
**Status:** accepted — decided, not yet implemented

> **Implementation gap, stated so it is not mistaken for done.** The `primitive` collection is **not** hidden in the live Figma file. Checked on 2026-08-04: all three collections publish, so all 74 variables are reachable from any subscribing file, the 59 primitives among them. A designer in a consuming file can bind a card border to `primitive/neutral/700` today, instead of `border/default`, and that is the precise binding this entry exists to prevent. Everything from *Decision* onward describes a file that does not exist yet, in the present tense. The title does too. It is not renamed: a log whose entries get retitled to match what turned out to be true records outcomes rather than decisions, and [013](./013-script-is-a-mode-not-a-parallel-scale.md) has already made the case for leaving a falsified claim visible with the correction attached to it. This line is the correction. See [the amendment](#amendment-2026-08-04--the-decision-is-not-in-the-file-and-nothing-would-have-said-so) for what is being done about it, and who is meant to enforce it.

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

  > **This bullet is not a constraint. It is an enforcement model, filed as though it were a fact about the tooling, and that is how it escaped examination.** The first half is true — the plugin genuinely does not write publishing state. The second half — *set by hand, once, and survives* — asserts that a hand-set switch stays set, which nothing in this repository checks and nothing in Figma guarantees. It also quietly presumes the hand ever moved. It did not. The amendment below takes the question this bullet skipped.
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

## Amendment, 2026-08-04 — the decision is not in the file, and nothing would have said so

Two things were wrong here, and only one of them is the missing tick.

**The tick.** The `primitive` collection publishes. The library is 74 variables wide, not 15. The consequence bullet claiming otherwise is a description of an intention.

**The assumption underneath it.** This entry settled *what should be published* and never asked *who keeps it that way*. It believed it had — the Constraints bullet above says the state is set by hand once and survives — but that sentence is an enforcement model wearing a constraint's clothes, and it was never examined as one. Had it been, the missing tick would have been caught on the spot, because the first question to ask of any enforcement model is how it fails, and this one fails silently by construction. **The model's first test was the day it was written, and it failed then.** The interval so far is hours rather than months, which is the only reason this is an amendment and not an incident.

### Nothing can currently see this

The drift detector is blind to publishing visibility on both of its routes, and the two are blind in different ways.

- **The `--file-key` route.** Figma's REST payload carries `hiddenFromPublishing` on every collection — the detector's own fixtures under [`machinery/scripts/__fixtures__/figma/`](../machinery/scripts/__fixtures__/figma/) reproduce it faithfully, `false` on all four collections including `primitive`. `normaliseSnapshot` in [`check-drift.mjs`](../machinery/scripts/check-drift.mjs) then reads `name`, `modes` and `defaultModeId` and drops everything else. **The fact arrives and is discarded.** `aligned.json` is the fixture asserting a clean run, it states that primitives are published, and the clean run is the assertion — the repository's test data has been describing the real file more accurately than this decision entry did.
- **The bridge route**, which [015](./015-rung-2-has-a-plan-floor.md) establishes is the only route below Enterprise, and therefore the only one that runs here. `toRestPayload` in [`src/core/rest.ts`](../machinery/figma-plugin/src/core/rest.ts) never emits the field at all: `RestSourceCollection` has no slot for it, and the adapter never reads it off the collection. On the route that actually runs, the fact does not exist.

There is a third blindness, smaller and worth recording because it falsifies a consequence above. `createCollection` in [`src/figma-adapter.ts`](../machinery/figma-plugin/src/figma-adapter.ts) calls `figma.variables.createVariableCollection(name)` and sets nothing else, so **a collection this plugin creates is born published.** The consequence bullet claiming the switch "will not be undone by accident" holds only for a collection that already exists and is never recreated. Rebuild the file, or delete and re-sync one collection, and the switch silently returns to Figma's default with no run of anything reporting it.

So until something changes, **this decision is enforced by memory**. [016](./016-build-the-read-bridge-rather-than-adopt-figma-console-mcp.md) already ruled on that: *a rule that only holds while every future agent remembers it is not a control.* The same sentence was written about agents and applies unchanged to the maintainer. A control that cannot produce a finding is not a weaker control than one that can — it is not one.

### Three routes, and the choice between them is real

**A. A human ticks the box in Figma.** Costs nothing and takes ten seconds. Nothing detects it being unticked, nothing detects it never having been ticked, and the evidence for both is this entry. It is [015](./015-rung-2-has-a-plan-floor.md)'s weakness in its purest form: a step a person takes is a step a person can skip.

**B. The plugin sets `hiddenFromPublishing`.** Enforceable, and re-asserted on every sync, which closes the recreate hole too. `VariableCollection.hiddenFromPublishing` is writable from the Plugin API, so this is a small change in code and a large one in principle. It widens the plugin past the line its own [README](../machinery/figma-plugin/README.md) draws — *it has no opinion it could honestly base on the token JSON* — and the widening is not a technicality to be edited out. That line is why the sync is trustworthy: the plugin writes what the source says and nothing else, so anything in Figma that the source does not explain came from a hand. A plugin carrying one policy of its own has no principle left with which to refuse the second.

**C. The token layer declares it and the plugin projects it.** The honest form of B. Rule 1 holds, the source decides, the plugin stays a projection. What it costs is the first Figma-shaped concept inside `content/tokens/` — a platform-agnostic DTCG document acquiring a field that means nothing to CSS, to iOS, or to the next platform, and existing solely to steer one vendor's library dialog. `content/tokens/` has refused that consistently: no scopes, no code syntax, no `$extensions`. Paying that price buys enforcement against a failure we have no evidence of.

### The recommendation

**A for the setting. And a fourth thing all three routes ran together and hid: the reading.**

Every route above answers *who sets the flag*, and every one of them leaves *who notices it changed* unanswered — B and C included, because a plugin that re-asserts the flag every sync still says nothing about the weeks between syncs, and reports nothing when it silently repairs a hand-edit somebody should have been told about. Split the two questions and they have different best answers.

The setting stays human. The **reading** moves into the bridge: `toRestPayload` carries `hiddenFromPublishing` per collection, and `check-drift.mjs` compares it against a declared expectation. Reading a flag is not holding an opinion about it, and reading is the single thing [016](./016-build-the-read-bridge-rather-than-adopt-figma-console-mcp.md) built the bridge to do. This changes what the plugin *reports*, not what it *writes*, and the README line survives intact — which is the test of whether the boundary was principled or merely convenient.

The expectation it compares against is content, and it belongs in `content/` — but not in `content/tokens/`. That distinction is the load-bearing part of this recommendation and it deserves the challenge it invites, because it looks like filing a problem somewhere else and calling it solved. The defence is a test: **a consumer of the token files can ignore a separate `content/` declaration entirely and lose nothing, which is not true of a field inside the token documents themselves.** Rule 1 requires the source to decide; it does not require every decision to be a token.

What this recommendation costs, stated rather than glossed:

- **It does not tick the box.** The gap at the top of this entry is closed by hand, first, and none of this closes it.
- **Detection is not prevention, and this entry argued that prevention was the only control available.** That argument stands. A gate at sync time reports after the fact, and a consuming designer can bind to a primitive in the window between the flag moving and the next run. What detection buys is that the window closes rather than lasting forever.
- **The bridge widens.** `rest.ts` currently justifies the absent fields with *inventing them would be inventing facts* — reading a real flag off a real collection is not inventing, but that sentence has to be rewritten so the boundary stays legible, and every widening of the bridge is a step towards the general-purpose read surface [016](./016-build-the-read-bridge-rather-than-adopt-figma-console-mcp.md) declined.
- **It is more work than route A and less enforcement than route B**, which is the honest description of every middle option and not a reason on its own to take one.

**Route C stays on the table and is where this goes if it goes anywhere.** If the plugin ever must set the flag, C is how it does so without becoming a policy-holder. The trigger for paying its cost is below, and it is not "somebody found this annoying".

## What would make us revisit this?

**Somebody needing a primitive twice.** One request is a gap in the semantic layer and the remedy is to name the token. Two requests for the same primitive, or one request nobody can satisfy by naming anything, means the layer is missing a concept rather than a value, and the answer is a new semantic token — not a reopened palette.

**The publishing state being found changed.** If anybody ever opens the file and finds primitives published again, the hand-set switch is not durable enough and the plugin has to learn to set it — which means teaching it something the token JSON does not say, and inventing a convention in `content/tokens/` to say it. That is a real cost and it is deliberately not being paid today.

> This trigger presumed the switch had been set and was watching for it moving. It had not been set, so the trigger was watching a state that never existed. It is left standing because it becomes live the moment the box is ticked — but note what it could not have caught, which is the case that actually happened.

**Any second Figma-library fact needing somewhere to live.** Publishing visibility alone does not justify a new declaration format under `content/`, and route C is refused above partly on that arithmetic. Scopes, code syntax, or a decision about which collections a consuming file should see are the same shape of fact, and at two of them a one-off file becomes a format worth designing once — at which point route C is cheaper than the recommendation above rather than dearer, and this entry should say so instead of quietly accumulating a third home for Mizan content beside the one [018](./018-the-preview-reads-the-build-output.md) already named.

**The tick being made without the reading following it.** The recommendation above is two moves and only the first is free. If the box gets ticked and the detector still cannot see the flag by the time Stage 3 closes, the honest thing is to record that this entry is enforced by memory and say so in the status line — not to let a green build imply a check that does not exist. **A decision documented as governed and enforced by recollection is worse than an ungoverned one**, because it spends credibility the system has not earned.

**A consuming file being found bound to a primitive.** It would prove hiding is not the barrier this entry assumes. There is no way to detect this from here; it will arrive as somebody mentioning it.

**Figma changing what a hidden variable does.** The whole decision rests on hidden-but-resolvable. If a hidden primitive ever stopped resolving through an alias in a consuming file, every semantic variable in the library would break at once, and the answer would be option 3 or option 1 with a stated risk — not this.
