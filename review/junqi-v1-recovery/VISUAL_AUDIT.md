# Visual audit — Caesar Games Junqi v1.1.0

18 states captured from the running app at iPad landscape (1180×820) with
headless Chrome. Each was reached by driving the real UI — nothing here is a
mock-up. Sources in `shots/`, tiled into `FINAL_CONTACT_SHEET.png`.

Reviewed by eye, state by state, with fixes applied before this file was
finalised.

---

## Direction

| | |
|---|---|
| Page | cool mineral mist `#E8EDF3` |
| Surface | near-white `#FBFCFD` |
| Ink | deep navy `#12243F` |
| Opponent | muted mineral red `#8E4238` |
| Accent | restrained gold `#A8823F` — used only for the maker's line, legal-move markers, and the disclosed flag |

The board is the hero: it is the only element with a strong shadow and a
defined edge. Everything else is quiet — no cards around the board, no pills,
no gradients beyond the soft page wash and the piece material.

---

## States captured

| # | State | Verdict |
|---|---|---|
| 1 | Home | Clean. Mark, name, tagline, one game, one primary action. |
| 2 | Mode select | Three options, one line each. |
| 3 | Players & difficulty | Name fields plus Relaxed/Standard. No fake levels. |
| 4 | Vs Computer — setup | Own army face-up at the bottom, opponent concealed. |
| 5 | Vs Computer — play | Move counter and Replay in the right rail. |
| 6 | Classic — P1 setup | Camps visibly empty; Flag in HQ; mines in back rows. |
| 7 | Pass the iPad | Full-screen navy shield, one action. |
| 8 | Classic — P2 setup | **P2's army at the bottom**, board rotated, chrome upright. |
| 9 | Classic — P1 perspective | Navy at the bottom. |
| 10 | Classic — P2 perspective | Red at the bottom; the enemy piece that crossed the front line is still a concealed back. |
| 11 | Last move — mid travel | A piece genuinely in flight between origin and destination, lifted and shadowed. |
| 12 | Flip — all face down | 50 identical backs; camps empty. |
| 13 | Flip — both directions | Seat 1 upright, seat 2 rotated 180°, in **both** halves of the board. |
| 14 | Games library | Three games across three modes coexisting. |
| 15 | Match record | Readable move list; privacy-safe phrasing. |
| 16 | Replay stepped forward | Position reconstructed from history. |
| 17 | Game end | Result, names, move count, three actions. No confetti, trophies or XP. |
| 18 | Learn | Five cards, no clutter. |

---

## Issues found during review, and what was done

| Issue | Fix |
|---|---|
| The board barely separated from the page — it read as more background rather than as a board | Deepened the felt, added a defined edge and a stronger shadow |
| The railway network was almost invisible, so the board's most important feature did not read | Thicker sleepers, higher contrast, wider dash |
| The board was a narrow column with large dead margins | Widened the proportions to 600×1010 so a station is ~1.5× wider than tall, like a real Junqi tile |
| The right rail was empty during play, unbalancing the layout | Added a privacy-safe move counter above the Replay control |
| The Last Move frame showed the piece already arrived | The completion timers were removing the flyer; added a capture hold so the real animation can be frozen mid-travel |
| A Vs Computer record concealed the human's own army, which they had seen all game | Spectator visibility made explicit — Vs Computer shows the human's army, two-player records stay fully concealed |
| Entrance animations faded from `opacity: 0` with `fill: both`, so a throttled tab left dialogs invisible | Entrance motion is now transform-only with no fill mode: the resting state is always visible, and motion is pure enhancement |

---

## Checks applied to every state

- No clipped controls; nothing below the fold during play.
- No horizontal or vertical page scroll on the board screen.
- Board fits within the viewport at 1180×820, 1024×768 and 1366×1024.
- Stations are ≥ 40px; buttons ≥ 36px tall.
- No hover-only affordances.
- Chrome, rails and text stay upright in every mode, including rotated Classic.
- Concealed pieces render no text and no side class.
- Typography is consistent: one sans stack for UI, one CJK stack for pieces.

---

## App icon

`ICON_REVIEW_STRIP.png` — before, two alternates, and the selection, each under
an iOS-style rounded-square crop.

| | |
|---|---|
| Before | The 1499×925 mark forced into a square. Visibly stretched, transparent ground, no safe margin. |
| A — mist ground | Correct proportions, but low contrast at Home Screen size. |
| B — ivory ground | Warm and calm, slightly soft against a light wallpaper. |
| **Selected — navy ground** | Ivory mark on `#12243F`, mark width 54% of the canvas. Highest contrast, holds its silhouette at 60px, quiet and timeless. |

The mark is only ever scaled uniformly — `icon_strip.mjs` and `make_icons.mjs`
both derive the height from the source aspect ratio, so distortion is not
expressible. Exports: 1024, 512, 192, 180, 167, 152, 120, plus a maskable 512
with a 40% mark for safe-zone cropping.

---

## Not assessed here

Rendering on physical iPad hardware, and the Home Screen icon as iOS actually
draws it. Both need the owner's device.
