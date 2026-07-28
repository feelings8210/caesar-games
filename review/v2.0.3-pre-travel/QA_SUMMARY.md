# Caesar Games v2.0.3 — Fast Pre-Travel Release Gate

Automated release status: **PASS**.

## Coverage

- Junqi rules/session/AI: 68/68
- Xiangqi + Chess rules/AI: 37/37
- Gomoku rules/AI: 13/13
- Chromium rendered E2E: Junqi/shared 70/70; open games/shared 26/26
- WebKit rendered E2E: Junqi/shared 70/70; open games/shared 26/26
- Focused motion, capture, sound-sync and reduced-motion assertions: 36/36
- Chromium interruption/reload scenarios: 7/7
- WebKit interruption/reload scenarios: 7/7
- Fully closed WebKit process, unreachable origin, fresh offline launch: PASS
- Runtime errors across final gates: 0

## Delivered

- Junqi, Xiangqi and Chess now use a more legible lift/travel/contact/settle
  cadence with canonical state committed before presentation.
- Captures retain the target through contact, then use a restrained 225 ms
  compression/fade.
- Persistent origin/destination memory is clearer without pulsing or covering
  the piece.
- Local synthesized cues use subtle block/disc/chess/stone material profiles;
  victory is a quiet set of settling knocks rather than an arcade fanfare.
- Board and piece surfaces use warmer grain, bevel, shadow and material depth
  while keeping the existing static architecture and offline footprint.
- Gomoku is fully integrated as documented Freestyle 15×15: Black first, first
  line of five or more wins, no captures or forbidden moves, full board draw.
- Gomoku supports 2 Players, Relaxed and Standard local AI, EN/ZH, Continue,
  Library, Record/Replay, persistence, interruption safety, PWA cache and
  offline play.

## Offline evidence

The final WebKit gate installed `caesar-games-v2.0.3`, saved four independent
games, fully terminated the browser process, confirmed the origin was
unreachable, and launched a fresh process. Home, Library, Continue, local AI,
sound and one further move in every game passed from cache.

- Junqi: 434.59×731.56, local AI replied
- Xiangqi: 483.80×537.55, history advanced offline
- Chess: 557.59×557.59, history advanced offline
- Gomoku: 557.59×557.59, history advanced offline

## Evidence files

- `BROWSER_E2E.json`
- `INTERRUPTION_RESUME.json`
- `COLD_START_OFFLINE.json`
- `chromium-final.png`
- `webkit-final.png`
- `chromium-interruption-final.png`
- `webkit-interruption-final.png`
- `webkit-online-preflight.png`
- `webkit-cold-start-offline.png`
- `../kid-friendly-polish/POLISH_QA.json`

Production baseline was independently verified at
`https://feelings8210.github.io/caesar-games/` and reported v2.0.2 before this
release. This report does not claim physical-iPad or airplane acceptance; the
owner should still perform the short physical travel smoke test.
