# Decision 016 — The variable read bridge is built read-only, not adopted from `figma-console-mcp`

**Date:** 2026-08-04
**Status:** accepted

## Context

[015](./015-rung-2-has-a-plan-floor.md) established that Figma's variables REST API is Enterprise-only in **both** directions. Below Enterprise no script can fetch the live variable table, so the drift detector works from a snapshot rather than a live read — and producing that snapshot has a human step. Somebody opens the file in the desktop app and runs the plugin.

That human step is the weakest part of the ladder, and it was worth one attempt to remove it. [`figma-console-mcp`](https://github.com/southleft/figma-console-mcp) (MIT, v1.39.1) was evaluated for exactly that. It bridges the Figma **Plugin API** over a localhost WebSocket to an MCP server, and through it an assistant can read variables with their values on any plan.

The identification is correct. That is the same mechanism this project reached for, arrived at independently, and it is the only mechanism there is below Enterprise.

Three facts decided what to do about it.

**The capability is already ours.** [`machinery/figma-plugin/src/figma-adapter.ts`](../machinery/figma-plugin/src/figma-adapter.ts) has `captureSnapshot()`, built on `getLocalVariableCollectionsAsync()` and `getLocalVariablesAsync()`. That is the call that produced the post-sync re-plan reading 74 variables and reporting zero changes. The tool would not unlock a capability the system lacks; it packages the same Plugin API behind a transport.

**It does not move the floor.** Its own documentation states that no mode supports headless CI. Every mode needs Figma Desktop running with its bridge plugin, or interactive OAuth. Its one standalone mode is read-only *and excludes variables*. So 015's finding — no unattended detection below Enterprise — is unchanged whether this is adopted or not.

**It exposes 114 tools, including create, rename, delete and update on variables.**

## Problem

Should the system take a dependency on `figma-console-mcp` to reach Figma's variables, or build the small read-only piece of it that Mizan actually needs?

## Constraints

- **Figma is a display, never a source** — rule 1. Nothing here may create a path that moves a Figma value into the token source.
- **The plugin's manifest declares `networkAccess.allowedDomains: ["none"]`.** Any bridge changes that, and the plugin's own README states the "does not use the network" claim as a property of the tool.
- The drift detector's usefulness rests on being able to say what caused a difference. This is the premise of the whole governance ladder, not a nice-to-have.
- Solo maintainer, four to six hours a week ([010](./010-contrast-is-a-token-layer-guarantee.md)).
- **Agents are consumers of this system, not contributors to it** ([006](./006-agents-are-consumers-of-the-contribution-flow.md)). Whatever is adopted has to be compatible with that, including for agents nobody has configured yet.
- The [Stage 7 extraction](../mizan-roadmap-v1.md) publishes this machinery to be forked. A dependency travels into the fork; a client-side configuration does not necessarily.

## Options

1. **Adopt it fully.** Install the MCP server, use it for the drift read, and accept its full tool surface.
2. **Adopt it and forbid the write tools by convention.** Same install, with a rule in `CLAUDE.md` and the agent instruction files saying the variable mutation tools are never to be called.
3. **Build our own read-only bridge** into the existing plugin: a localhost WebSocket that answers exactly one question — the current variable snapshot — and has no write vocabulary at all.
4. **Do nothing.** Keep 015's manual step. The person who is already in the file to run the sync exports the snapshot by hand.

## Trade-offs

**Option 1** is the cheapest by a wide margin — an install and a config entry, no code, no maintenance, and 113 tools of console and canvas access thrown in. What it costs is the one thing the system cannot pay: it puts a second write path to Figma variables into the hands of every assistant that can see the server. From that point on, a hand-edited variable and an agent-edited variable are the same event on the wire, and the detector reports both as drift with no way to say which.

**Option 2** looks like it fixes that, and it is the option that needs the most honesty. A rule that only holds while every future agent remembers it is not a control. This repository's own `CLAUDE.md` exists *because* agents do not reliably remember — its legacy quarantine section is three paragraphs of increasingly emphatic instruction not to tidy up code that any competent assistant would tidy up on reflex. Adding a fourth such section, this time guarding a capability that is one tool call away and locally reasonable in the moment, is not a control either.

There is a stronger version of option 2: most MCP hosts can deny named tools in configuration, and a deny list enforced by the host is genuinely different from a rule in a prompt. That version is worth stating fairly, and it still fails for this system, for two reasons. It lives in each consumer's client configuration rather than in this repository's machinery, so it is not something the repo can carry; and Stage 7 forks inherit the dependency without inheriting anybody's client config. A control that ships separately from the thing it controls arrives eventually or never.

**Option 3** costs real work and a real permission. Roughly a day: a WebSocket in the plugin, a small client on the Node side, and a message shape to keep in step with `Snapshot`. That is a transport this project now maintains, in a component that already carries more than its share. And it requires changing `manifest.json` from `allowedDomains: ["none"]` to permitting localhost — **a genuine widening of the plugin's permissions**, and one that makes the README's flat "it does not use the network" claim no longer true as written. That belongs in the open, not in a footnote. What it buys is that the write vocabulary does not exist to be called, by anyone, ever, including by a future maintainer who has forgotten why.

**Option 4** costs nothing and keeps the weakness 015 already named: a step a person takes is a step a person can skip. It remains the correct fallback if option 3 is never finished, and it is what runs until it is.

## Decision

We build a read-only WebSocket bridge into our own plugin. We do not adopt `figma-console-mcp`.

The bridge answers one question — the snapshot `captureSnapshot()` already produces — and has no create, update, rename or delete in its vocabulary, in the same sense that the plugin has no delete operation at all.

## Why

**This is not a judgment about the tool.** It appears well-built, it is MIT, and in local mode it keeps design data on localhost rather than routing it through a third party. If the question were quality, the answer would be different. The question is architectural.

**Mizan's governance model rests on one claim: there is one way in.** Figma is a display, nobody hand-edits variables, and the drift detector exists to catch the times somebody did. That claim is what makes a finding meaningful. A second write path does not merely add a risk of unwanted edits — it destroys the *attribution* of every finding the detector produces. Drift caused by an assistant becomes indistinguishable from drift caused by a person, and the detector cannot tell you which. **A governance tool that cannot attribute what it finds is substantially less useful**, because the remedy for the two cases is not the same: one is a conversation with a designer, the other is a broken rule in the automation.

This is [006](./006-agents-are-consumers-of-the-contribution-flow.md) applied one layer down. Agents consume the system and do not extend it. An agent with variable write access to the Figma file is a contributor to the display, holding an authority the model reserves for the sync pipeline — which is to say, for the token source.

**It is also the same refusal as [004](./004-generate-v0-rather-than-fork.md), for the same reason.** There the candidate was rejected on fit rather than quality: a well-engineered project whose shape was wrong for the job, where the work of making it fit exceeded the work of building what was needed. Here the shape mismatch is a tool surface that is 113 tools larger than the requirement, and the excess is not inert — it is precisely the capability the governance model forbids. Both entries land on the same principle: **adopt for capability you do not have; build when the capability is already yours and the dependency's shape is the problem.**

**Their bridge design is the right one, and reading it is free.** Plugin API over localhost WebSocket is the correct answer to the Enterprise gate, and having it confirmed by somebody who shipped it is worth more than the day of work it does not save. **Studying an approach and adopting a dependency are different acts**, and only the second one is being refused here.

## Consequences

- **The plugin's `networkAccess` widens from `["none"]` to localhost.** The claim "it does not use the network" in [`machinery/figma-plugin/README.md`](../machinery/figma-plugin/README.md) becomes false as written and must be replaced with the narrower true statement, at the point of use. The `reasoning` field in the manifest has to say what the socket is for and what it will not carry.
- The plugin gains a transport to maintain — a second export responsibility on top of the one [015](./015-rung-2-has-a-plan-floor.md) already gave it. The component carrying the most now carries more.
- The bridge's message shape becomes a fourth thing that has to agree with the projection rules, alongside the plugin, the detector and the proof sheet.
- **The floor does not move.** Figma Desktop still has to be open with the plugin running. This removes a copy-and-paste, not a person. Anybody reading this as unattended detection has misread it, and the health dashboard's tier label from 015 stands unchanged.
- Until the bridge exists, 015's manual step is what runs. This decision does not make the manual route obsolete; it makes it the fallback.
- **We give up 113 other tools we might have found uses for** — console output, canvas inspection, screenshots — and will have to solve any of those separately if they turn out to matter. That is a real cost and the argument above does not erase it.

### Amendment — the widening that shipped is narrower than the one accepted here

*Added while building the bridge, because the first consequence above claims a permission the plugin does not actually hold.*

That consequence states flatly that **the plugin's `networkAccess` widens from `["none"]` to localhost**. What shipped is `"allowedDomains": ["none"]` beside `"devAllowedDomains": ["ws://localhost:8791", "ws://127.0.0.1:8791"]`.

Figma's manifest has two domain lists, not one. `allowedDomains` governs the plugin as published. `devAllowedDomains` takes the same pattern rules but applies only when the plugin runs as a development plugin — imported from a manifest, which is the only way this plugin is ever run and the way its README already describes it. So production network access stays at `["none"]`, and the socket exists for a development plugin, to one port on the loopback interface, and nowhere else. If this plugin were ever published to the Community the bridge would stop working — by construction rather than by policy, which is the only way a constraint holds. Localhost in `allowedDomains` is permitted with a `reasoning` field; the point is that it was not needed.

This entry did not know that field existed. It treated `networkAccess` as a single list and accepted the wider permission on the assumption that there was no narrower one available. There was.

**This strengthens the argument above rather than softening it.** The case rested on one claim: the write vocabulary does not exist, so it cannot be called. The dev-only form adds a second limit of a different kind — the *transport* does not exist outside development either. One constraint governs what can be said on the socket and is enforced in the message list; the other governs whether the socket can be opened at all and is enforced by the manifest. Two constraints of different kinds are worth more than one constraint stated twice.

The cost is a constant in four places: `manifest.json`, the plugin's `BRIDGE_PORT`, the socket in `ui.html`, and the detector's own `BRIDGE_PORT`. A manifest cannot take a variable, and `ui.html` is loaded by Figma rather than bundled, so neither can import the number from anywhere. Changing the port means changing all four.

What keeps them equal is not discipline. `machinery/scripts/selftest.mjs` parses the number out of each of the four files and asserts they agree, so a port changed in three places fails the build rather than producing a bridge that silently never connects — which is the failure this would otherwise have, and the worst shape a failure can take, because a bridge that cannot connect looks exactly like a bridge nobody has switched on. That is rule 4 applied to a number: anything checkable gets a deterministic check, and duplication a script watches is cheaper here than the build step that would remove it.

**The floor does not move, and nothing here should be read as moving it.** Figma Desktop must still be open with the plugin running. This removes a copy-and-paste, not a person. [015](./015-rung-2-has-a-plan-floor.md)'s finding stands and the health dashboard's tier label is unchanged. A narrower permission is not a step towards unattended detection; it is the same capability held on tighter terms.

The README correction the first consequence called for is still required, and for a sharper reason than "false as written". The sentence there — that the plugin does not use the network, evidenced by `"allowedDomains": ["none"]` — is now *half* true, and a half-true claim is worse than a plainly false one because the half that holds invites a reader to accept the rest. It has been replaced with the narrower true statement at the point of use.

One revisit trigger below gets easier. *The bridge going unused* anticipated removing the transport and restoring `allowedDomains: ["none"]` rather than leaving a widened permission standing for a path nobody takes. There is no widened permission standing: `allowedDomains` never left `["none"]`. Removal is deleting one manifest field and the socket that reads it — a smaller act than the trigger was written to describe, and one with no permission story to walk back.

### Amendment 2 — the threat this entry reasoned about was only half of it

*Added after an adversarial review of the built bridge, which found the missing half and demonstrated it.*

Everything above reasons about **what our end can say**. The vocabulary has no write verb, so nothing on this side can change a Figma file — and that argument is sound and survives. What it never asks is **who else can speak**.

A WebSocket connection is not subject to CORS, and browsers treat `127.0.0.1` as a trustworthy origin. So while a read is open, any page the maintainer happens to have in a browser tab could connect to the port, greet first, and hand the detector a variable table it made up. It cannot *read* anything — the plugin's snapshot travels on the plugin's own socket — but it can plant findings, suppress real ones, or return a table so empty that every token is reported missing with the remedy "re-sync outward". With `--save-snapshot`, those bytes become a committed offline fixture that every later run trusts. This was reproduced, not theorised.

That is the same injury this entry was written to prevent, arriving from the other direction. 016 spent a day of work to protect the *attribution* of a finding, and an unauthenticated socket gives it away — a fabricated finding is worse than an unattributed one, because it is actionable.

The fix is the standard one for a localhost bridge: the server refuses any handshake carrying an `Origin` header that is not absent or exactly `null`. A plugin's UI is a sandboxed iframe with an opaque origin and sends `null`; an ordinary page sends its real origin and is refused. It costs two lines.

**It is a control against a page, not against a program.** Any process already running on the machine can still bind the port first or connect to it. That needs local code execution and is a materially smaller threat, but it is real, and neither this entry nor the README may imply the socket is authenticated. It is not. If that ever needs closing, the answer is a per-run secret the person pastes into the plugin, and the honest reason it is not here yet is that the threat did not seem worth the friction — which is a judgement, and is recorded as one so that it can be revisited rather than rediscovered.

**The general lesson, which is why this is an amendment and not a commit message.** This entry evaluated a dependency's *tool surface* and concluded that building the smaller thing was safer. That reasoning was about capability we would be granting ourselves. Building it introduced a listening socket — a capability we grant *anyone who can reach it* — and the original analysis had no category for that. **Refusing a dependency does not inherit its threat model; it replaces it with your own, which nobody has reviewed.** Adopting `figma-console-mcp` would have come with whatever hardening its author had already done and its users had already found. That is a real cost of building, it belongs beside the 113 tools given up, and this entry did not count it.

## What would make us revisit this?

**The write surface becoming removable at the source rather than at the caller.** If `figma-console-mcp` ships a variables-read distribution — a build or flag whose `tools/list` genuinely does not contain the variable mutation tools, so that a fork inherits the constraint along with the dependency — then the entire argument here evaporates and our bridge is redundant maintenance that should be deleted in its favour. The check is mechanical: read the advertised tool list of a release and look for the create, update, rename and delete entries. That is worth re-checking once a year, not once a week.

**The bridge going unused.** If two consecutive syncs run without the bridge being invoked, the day of work bought nothing, option 4 was the right answer, and the honest response is to remove the transport and restore `allowedDomains: ["none"]` rather than leave a widened permission standing for a path nobody takes.

**The floor moving.** 015's first trigger applies here unchanged. If `GET /v1/files/:key/variables/local` ever returns 200 on a non-Enterprise token, both this bridge and the adoption question stop mattering — CI reads the variables directly, and the transport gets deleted rather than maintained.
