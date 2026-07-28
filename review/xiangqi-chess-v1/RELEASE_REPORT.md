# Caesar Games v2.0.0 — Xiangqi + Chess + Bilingual V1

Date: 2026-07-28

Schema: 4

Junqi rules: `junqi-v1.1`

Xiangqi rules: `xiangqi-family-v1`

Chess authority: `chess.js 1.4.0`

## Release gate results

| Gate | Result |
|---|---|
| Original Junqi unit suite | PASS — 66 / 66 |
| Xiangqi + Chess rules/AI suite | PASS — 33 / 33 |
| Original Junqi Chromium E2E | PASS — 62 / 62 |
| Original Junqi WebKit E2E | PASS — 62 / 62 |
| Xiangqi/Chess/shared Chromium E2E | PASS — 17 / 17 |
| Xiangqi/Chess/shared WebKit E2E | PASS — 17 / 17 |
| All six cross-game transitions | PASS |
| English / Simplified Chinese dictionary parity | PASS — 184 / 184 keys |
| Legacy Junqi persistence migration | PASS |
| Three-game Continue / Library / Record / Replay | PASS |
| AI `gameId` + `gameType` isolation | PASS |
| WebKit offline install/reload/resume/action | PASS |
| PWA cache | PASS — `caesar-games-v2.0.0` |
| WebKit iPad visual audit | PASS — 16 states |
| Third-party license audit | PASS |

## Board geometry

- Junqi WebKit and Chromium at 1180×820: `434.59 × 731.56`, 50 pieces.
- Xiangqi WebKit offline resume at 1180×820: `483.80 × 537.55`, 32 pieces.
- Chess E2E asserts positive 8×8 board geometry and 32 painted pieces in both
  engines.

## Dependency audit

`chess.js 1.4.0` was downloaded as the exact npm tarball, its package contents
and BSD-2-Clause license were inspected, npm `gitHead` and integrity metadata
were recorded, and only its ESM distribution plus license were vendored.
There are no runtime CDN requests or transitive runtime dependencies.

See `docs/THIRD_PARTY_LICENSES.md`.

## Xiangqi rule decision

V1 implements standard movement, check, flying General, checkmate and the
Xiangqi no-legal-move loss. Full tournament chase adjudication is not claimed.
The explicit family rule is a draw on the third occurrence of the same position
including side to move.

See `docs/XIANGQI_V1_RULESET.md`.

## Visual audit

`FINAL_CONTACT_SHEET.png` contains English/Chinese Home, mode selection,
Xiangqi 2 Players/Vs Computer/capture/check, Chess 2 Players/Vs
Computer/capture/check/promotion, the three-game library, replay and offline
Home. The final sheet was reviewed at full resolution.

## Owner physical pass

Only the seven short checks from the project brief remain appropriate on the
owner's physical iPad. No manual rule validation is requested.
