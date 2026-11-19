# Duty Radar

**Duty Radar** (German: *Pflichten-Radar*) is a browser-only prototype of an agentic-AI assistant for bureaucracy reduction. An agent team reads a slice of 25 to 35 federal norms, inventories their reporting and documentation duties in the six duty types of the federal project [PflichtenLichten](https://bmds.bund.de/themen/staatsmodernisierung/buerokratierueckbau/pflichtenlichten), finds duties that ask the same businesses for the same data, and prices every duty and every relief option with the federal method for compliance cost (Erfüllungsaufwand) of Destatis and the NKR. It drafts options (delete, merge, register retrieval, lower frequency or keep) that a person approves into a relief dossier, and shows how far the approved options get the slice towards the benchmarks of −⅓ for reporting duties and −½ for documentation duties.

Every number comes from a deterministic engine, and a fact auditor blocks any figure the model writes without a source. Nothing is sent anywhere: the outbox only offers downloads.

> **Status: Phase 0, planning.** There is no app in this repository yet. [PLAN.md](PLAN.md) describes the architecture, the screens, the law slice, the tests and the milestones.

## What it will offer

- **Three modes:** Simulation (scripted replays, offline, no key), Live (Claude with the presenter's own API key, kept for the browser session only) and Sovereign (an OpenAI-compatible endpoint, off until one is configured).
- **Two languages:** English by default, German one click away. Law texts, citations and draft amendment wording stay German in both.
- **Honest data:** public law texts from [gesetze-im-internet.de](https://www.gesetze-im-internet.de/) (consolidated, not the official version; the Federal Law Gazette is authoritative), public cost methods, and synthetic complaint signals and register availability, each labelled as such.

Live site, once deployed: <https://victorpflueger.github.io/dutyradar/>

## Not an official service

Duty Radar is a prototype. It is not an offer of the federal government, gives no legal advice and proposes only; a person decides.

## Author

Built by Victor Pflüger, on [Vici](https://victorpflueger.github.io/ViciDesign/), his design system.
