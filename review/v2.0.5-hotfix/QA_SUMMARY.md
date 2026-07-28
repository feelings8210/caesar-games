# Caesar Games v2.0.5 Focused Hotfix QA

Baseline: clean `main` at `285a14d648cc69a4b2596f054a53cd9f88b4f827`

- Focused Xiangqi + Chess rules/copy tests: **55 / 55**
- Focused Chromium changed-UI smoke: **7 / 7**
- Chromium runtime errors: **0**
- `git diff --check`: **PASS**

The focused gates cover legal bad strategy, next-turn check exposure, currently
active self-check rejection, flying-General rejection, checkmate, 困毙,
English/Chinese refusal copy, visible resignation, two-player draw
accept/decline/persistence/replay for Xiangqi and Chess, and absence of Offer
Draw in Vs Computer.

Per the urgent hotfix brief, full Chromium, WebKit, unrelated-game, and offline
cold-start certification were intentionally not run.
