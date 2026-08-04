# machinery/metadata/

Structured JSON, one file per component: purpose, do's and don'ts, RTL behaviour, props, and the Figma-to-code mapping. This is the agents' knowledge base — written for humans first, read by machines second.

**What belongs here:** the machine-readable description of a component's contract. What it is for, when not to reach for it, what it guarantees about accessibility, how it behaves when direction flips, which properties are exposed and which are deliberately not.

**What does not belong here:** token values, colours, or Arabic copy. Metadata describes *behaviour and intent*, and references tokens by name rather than restating what they resolve to. Component visual specifics that only make sense for Mizan's brand belong in `content/`.

Also not here: prose documentation for people. Storybook and component guides carry that. Metadata is the structured layer underneath, and the two are generated from or kept honest against each other rather than maintained twice.

---

## The one thing to know before editing anything in here

**`<component>.json` is build output.** Editing it is editing a display, exactly as editing `packages/tokens/` is. The next run of the generator overwrites the edit, and `check-contracts.mjs` reports it as `contract-stale` in the meantime.

There are two editing surfaces, and neither of them is this directory's top level:

| To change | Edit | Then |
|---|---|---|
| a prop's name, type, default, whether it is required, or its description | the component's own source and JSDoc | regenerate |
| what the component is for, when not to reach for it, what it refuses, its keywords | `authored/<component>.json` | regenerate |

```
npm run gen:contract -- --source packages/components/src/Button/Button.tsx
npm run gen:contract -- --all        # every contract, each from the source it records
npm run check:contracts              # every contract, against its component
```

## Contents

| Path | What it is |
|---|---|
| `component-contract.schema.json` | The shape every contract satisfies. Brand-agnostic: it names no component and no value. Each property carries `x-origin`, and that annotation is what decides which half of the pipeline may write it. |
| `authored/<component>.json` | The judgment half — the editing surface for everything not derivable from the source. |
| `<component>.json` | The contract. Generated. |

## The line between the two halves

Half of a contract is a fact about the component and half is a judgment about it, and the two halves live in different files so that neither can quietly become the other.

**Derived from the source**, and refused if authored: the component name, the props type and what it extends, and for every prop its name, type, required-ness, default, JSDoc summary and notes, `@deprecated` tag, and the members of its union where it has one. Also the stylesheet beside the component and the tokens it consumes, read from the custom properties it references. Every one of those is already stated somewhere a compiler or a browser reads, and a contract that restated them would be a second source for the same fact — always the one that ends up out of date.

**Authored, and never invented by the generator:** purpose, responsibilities, do and don't, `do_not_use_when` and `alternatives`, what content designers control, what nobody may customise, RTL behaviour, accessibility guarantees, `aiHints`, the deprecation policy, the Figma component name, per-prop guidance, and the reason for any token the component asks for and the system has not decided.

The two meet in one place and the meeting is structural: a prop's Figma property is *named* by a person and the mapping is *assembled* by the generator, so a prop cannot quietly stop having a Figma side by nobody mentioning it. A prop that mirrors nothing has to say so under `figma.unmapped`, with a reason, or generation fails.

**Arrives Stage 4**, alongside the first components. It starts quietly as documentation and becomes the substrate the agents in Stage 5 depend on.
