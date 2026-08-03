# machinery/metadata/

Structured JSON, one file per component: purpose, do's and don'ts, RTL behaviour, props, and the Figma-to-code mapping. This is the agents' knowledge base — written for humans first, read by machines second.

**What belongs here:** the machine-readable description of a component's contract. What it is for, when not to reach for it, what it guarantees about accessibility, how it behaves when direction flips, which properties are exposed and which are deliberately not.

**What does not belong here:** token values, colours, or Arabic copy. Metadata describes *behaviour and intent*, and references tokens by name rather than restating what they resolve to. Component visual specifics that only make sense for Mizan's brand belong in `content/`.

Also not here: prose documentation for people. Storybook and component guides carry that. Metadata is the structured layer underneath, and the two are generated from or kept honest against each other rather than maintained twice.

**Arrives Stage 4**, alongside the first components. It starts quietly as documentation and becomes the substrate the agents in Stage 5 depend on.
