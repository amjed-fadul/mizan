# machinery/scripts/

Deterministic checks and build scripts. The governance ladder starts here, and most of it never leaves.

**What belongs here:** anything that can be decided by a rule with no judgment attached. Schema validation, token build steps, drift detection between Figma and JSON, lint rules, contrast math, naming-pattern enforcement.

**What does not belong here:** judgment. If answering the question requires knowing whether a design is *good* — hierarchy, density, whether a component is being overused — it is not a script. That belongs to an agent, and the agent's output still gets rejected by something deterministic or by a human.

**Scripts for facts, agents for judgment.** A script that says "this hex is not in the token set" is a fact. A script that says "this layout is confusing" is a script pretending to be a designer.

Also not here: Mizan's values. A script may enforce that no raw hex appears in the semantic layer; it may not contain the list of Mizan hexes it is checking against. Those come from `content/`, passed in.

**Arrives Stage 2:** the first schema checks — semantic must reference primitive, no raw hex in the semantic layer, naming pattern conformance, contrast pairs pass WCAG.
