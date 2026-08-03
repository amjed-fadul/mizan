# machinery/agents/

Agent instruction files. One file per agent, describing its job, its inputs, the knowledge it reads, and the boundary of what it is allowed to decide.

**What belongs here:** instructions, scope, and rejection paths.

**What does not belong here:** Mizan's rules themselves. Agents read the RTL and Arabic rules from `content/rules/` — they do not carry their own copies. RTL is a rule layer, not an agent: correct behaviour must be unavoidable rather than invoked, and duplicating a rule into an agent file is how it quietly drifts out of date.

Also not here: judgment that should have been a script. If a deterministic check can decide it, it belongs in `machinery/scripts/` and the agent should not be asked.

## The rejection path requirement

**Every agent file must end by answering: what rejects this agent's output, and who decided the rule?**

The answer must terminate in a deterministic check or in a human. Never in another agent — not at the first hop, and not anywhere down the chain. An agent whose output is reviewed by another agent whose output is reviewed by a third has no rejection path at all; it has a rumour.

There is no boss agent. The loop is fixed, routing is by checklist, and the final gate is a person.

**Arrives Stage 5**, with the Prototyping Kit and Banna. Raqib follows in Stage 6, Rassam in Stage 7.
