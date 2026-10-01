# Hoops IQ — design notes

Hoops IQ teaches basketball decision-making to trained players aged 12+.
It sits beside the tabletop games as a fifth tile and shares the app's
language switch, sound switch, palette and offline cache.

## Teaching model

Each level is one game moment, built on the freeze-frame (occlusion) method
used in sport-science decision training: the play runs, slows, and freezes
at the moment of the read; the player acts on the floor; the choice plays
out; then a coach card names

- **the clue** — the one visual cue that decides the read (ringed on court),
- **the why** — for the option the player actually chose,
- **the rule** — a short if/then line ("Overplayed? Go backdoor.").

Grades: 3 = best read, 1 = playable, 0 = wrong read. Stars: best read inside
60% of the decision window = 3, best read later = 2, playable = 1, else 0.
A level unlocks the next one at 1 star or more.

## Chapter 1 — Read the Defense

1. Backdoor (beat the overplay) · 2. Drive & kick (read the help) ·
3. Pick & roll: roll (big shows) · 4. Pick & roll: pull-up (big drops) ·
5. Switch mismatch · 6. 2-on-1 break · 7. Help-side defense ·
8. Closeout · 9. Box out · 10. Last possession (clock and score)

## Files

- `js/games/hoops/levels.js` — all content, bilingual; adding a level is data only.
- `js/games/hoops/court.js` — SVG half court (feet), beat runner, effects.
- `js/games/hoops/controller.js` — level flow, input (tap or drag), progress.
- `js/games/hoops/audio.js` — synthesized gym sounds on the shared sound engine.
- `css/hoops.css` — styles.
- `tests/hoops.test.mjs` — content integrity (`node tests/hoops.test.mjs`).
- `scripts/hoops-smoke.mjs` — plays every level in Chromium and captures screenshots.

Progress is stored per device in `localStorage` under `caesar_hoops_progress_v1`.

## 3D court (v2.2)

The court is a tabletop diorama rendered with three.js (vendored, minified,
`js/vendor/three/`): satin-metal figurines on team-coloured enamel bases —
silver offense, gunmetal defense, gold for "you" — with broadcast-style
tracking rings. Numbers, labels and calls are an HTML layer over the canvas.

- `js/games/hoops/runner.js` — shared beat runner (positions, ball flight,
  timing); both views subclass it.
- `js/games/hoops/court3d.js` — three.js view and camera director:
  broadcast → push-in on the freeze → high "decide" angle, auto-fitted to
  the screen's aspect.
- `js/games/hoops/court.js` — the SVG view, used when WebGL is unavailable
  or with `?hoops2d=1`.
- `tools/blender/build_hoops.py` — builds `assets/hoops/figurines.glb` and
  `hoop.glb` (`--preview`, `--style metal`, `--ar` render stills);
  `tools/blender/court_texture.py` draws `court_lines.png`.

Testing: `node scripts/hoops-smoke.mjs <outDir>` plays every level in
Chromium (software GL). `?hoopsDecide=N` stretches the decision window for
slow test browsers only; `HOOPS_2D=1` runs the SVG fallback.
