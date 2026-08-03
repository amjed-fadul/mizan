# content/

Mizan's own material: token values, system rules, and the Arabic and RTL specifics that give this system its signature.

**What belongs here:** the values and rules that are true for Mizan and would be false for another company. Token JSON, the Arabic type scale and line-height compensation, the icon-mirroring rules, direction-safe semantic naming decisions, the commerce and mobility semantic layers.

**What does not belong here:** pipeline logic. No build scripts, no validators, no plugin code, no agent instructions. Nothing here should be reusable by a different brand — if it would be, it is machinery and belongs in [`machinery/`](../machinery/).

The two directions of the test: machinery must survive deleting `content/`; content must contain nothing another company would want to keep.

## Contents

| Path | Purpose | Arrives |
|---|---|---|
| `tokens/` | DTCG-format token JSON — the only editing surface | Stage 2 |
| `rules/` | RTL, Arabic, and system rules read by both humans and agents | Stage 2 |

Arabic is treated as the advanced stress test of a global-grade system, not a fork of it. The core system and the localization layer live here together for that reason.
