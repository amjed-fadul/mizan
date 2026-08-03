# Mizan Labs — the brief

## The company

Mizan Labs is a small product company operating in the Gulf. It runs two consumer products in English and Arabic, web-first and mobile-first responsive. It is not a startup looking for a market and not an enterprise with a platform org — it is the awkward middle: enough product surface to have real system problems, not enough people to have solved them.

## The products

**Mizan Market** — grocery and everyday commerce. Customers browse categories, filter and sort, open product pages, build a cart with substitution preferences and a delivery slot, check out, and track an order from confirmed through preparing and out-for-delivery to delivered.

**Mizan Move** — ride booking. Riders set pickup and destination on a map, choose a ride type across Economy, Comfort, XL and Electric, see a fare estimate and ETA, confirm, then follow an active ride with driver, vehicle, trip status, contact and safety actions. Past trips carry receipts and routes.

The two products share a company, a brand, and nothing else that was ever written down.

## How it got here

Market shipped first. Move started eighteen months later, and its first engineer copied Market's stylesheet as a starting point — which is why some values in the two products still match exactly, some drifted a few hex values apart, and some are unrecognisable. Neither team did anything unreasonable. Each solved its own problems, on its own deadlines, without a shared owner.

Arabic was added to both products after launch, under time pressure, by translating strings. The layout was never revisited.

## The constraints

These are real and they shape every decision in this repo. They are not obstacles to be wished away in a later stage.

- **One design-system person.** No platform team, no design-system engineer. Roughly four to six hours a week.
- **No dedicated accessibility specialist.** Whatever accessibility guarantee exists must be built into components and enforced by scripts, because no one is available to review screens by hand.
- **Limited engineering capacity in both product teams.** Any migration has to be incremental and mostly mechanical. A rewrite is not available.
- **Figma Professional, not Enterprise.** No Variables REST write API and no official Code Connect. Both gaps have to be solved with plugins and open equivalents, or not at all.
- **Two products that must stay different.** Market and Move serve different moments and different densities. A system that makes them look identical has failed, even if it is perfectly consistent.
- **Arabic is not a locale checkbox.** It is a primary market. Right-to-left layout, Arabic-Indic numerals, currency placement, and mixed-direction content are core requirements, not a late-stage pass.

## What this brief is not

There are no fictional coworkers here, no invented stakeholder arguments, no imagined political fights. Those cannot be simulated honestly and this project does not pretend otherwise.

The mess is simulated. The constraints are real. The people are real — the designers who take part in research sessions, and the readers who respond in public.
