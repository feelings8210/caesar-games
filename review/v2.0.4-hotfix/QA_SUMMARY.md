# Caesar Games v2.0.4 Hotfix QA

Generated: 2026-07-28  
Baseline: `main` at `02947a943df4889d16e0f2cf81a642426ef6d6ae` (v2.0.3)

## Release scope

- Xiangqi legal replies are filtered through the existing self-check and flying-General legality check.
- Zero legal replies now end immediately as `checkmate` when checked or `stalemate` (困毙) when not checked.
- Legacy in-progress Xiangqi saves with zero replies normalize on load, persist as terminal, and route directly to the result UI.
- Last Move clearly marks both From and To in Xiangqi and Chess, and the last stone in Gomoku, across human, AI, and resumed play.
- Xiangqi, Chess, Gomoku, and Junqi now provide confirmed bilingual resignation with terminal persistence and replay.
- AI timers/workers are cancelled before resignation is committed; terminal games cannot produce another AI move.

## Automated verification

| Gate | Result |
| --- | ---: |
| Junqi unit/rules | 69 / 69 |
| Xiangqi + Chess unit/rules | 46 / 46 |
| Gomoku unit/rules | 14 / 14 |
| Chromium rendered E2E | 101 / 101 |
| WebKit rendered E2E | 101 / 101 |
| Kid-friendly motion/sound (Chromium + WebKit) | 36 / 36 |
| Interruption/resume (Chromium + WebKit) | 16 / 16 |
| True WebKit cold-start offline gate | 1 / 1 |
| **Total** | **384 / 384** |

No runtime errors were reported by the browser, interruption/resume, or offline gates.

## Focused Xiangqi coverage

- Check with a legal General escape.
- Capture of the checking piece.
- Blocking a checking line.
- True checkmate without requiring General capture.
- Stalemate/困毙 with no legal move while not in check.
- Flying-General self-check rejection.
- Double-cannon mate regression.
- Legacy zero-reply save normalization and direct result-screen resume.

## Retained evidence

- `BROWSER_E2E.json`: Chromium and WebKit rendered matrices.
- `chromium-final.png`, `webkit-final.png`: final rendered browser states.
- `INTERRUPTION_RESUME.json`: eight interruption/resume scenarios per engine, including resignation while AI work is pending.
- `chromium-interruption-final.png`, `webkit-interruption-final.png`: interruption gate final states.
- `COLD_START_OFFLINE.json`: fully closed WebKit process, stopped/unreachable origin, fresh offline process.
- `webkit-online-preflight.png`, `webkit-cold-start-offline.png`: online preflight and true offline launch.
- `polish/POLISH_QA.json` and 36 phase screenshots: focused motion, capture, castle, reveal, and sound verification.

## Manual rendered verification

The local v2.0.4 build was opened through the in-app browser after automation. Xiangqi showed the gold From/To Last Move treatment, the active Resign control, and matching English and Simplified Chinese confirmation copy (`Resign` / `认输`).
