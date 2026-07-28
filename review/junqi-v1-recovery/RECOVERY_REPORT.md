# Caesar Games — Junqi V1 recovery report

**Build:** v1.1.0 · **Rules:** junqi-v1.1 · **Schema:** 3 · **Date:** 2026-07-28

Previous build v1.0.3 shipped with `KNOWN_REMAINING_ISSUES: NONE` and a
"37/37 PASSED" suite. Both were true statements about a suite that never
touched the user interface. This pass treated every prior claim as evidence to
check, not as authority.

---

## 1. The owner-reported failure

> Play → Vs Computer → play → Home → 2 Players Classic → app returns to Home.

**Reproduced** in a browser with real coordinate taps, then diagnosed.

The architecture was a red herring. `index.html` gave three dialogs an inline
`style="display:none"`:

```html
<div id="player-names-modal" class="mode-modal-backdrop" style="display: none;">
```

`showNameSetupModal()` only added an `.active` class. That class sets `opacity`
and `pointer-events`; it cannot override an inline `display`. So:

1. Tap **Play** → mode dialog opens (that one had no inline style, so it worked)
2. Tap **2 Players · Classic** → mode dialog closes, names dialog gets `.active`
   but stays `display:none`, occupying a 0×0 box
3. The player is looking at **Home**

This was never specific to "after Vs Computer" — it happened for **every mode
on the first attempt**. The same inline attribute silently disabled the **Games
library** and the **record/replay viewer**, which is why those features
appeared to exist but could never be opened.

**Fixed.** Visibility is class-driven only; no application code sets
`element.style.display`. `tests/e2e.js` asserts that no `.dialog`, `.overlay`,
`.handoff` or `.screen` carries an inline `display`, and that every dialog
reached through the UI has a non-zero box.

---

## 2. What else the audit found

Fourteen defects, listed in full in `REGRESSION_RESULTS.json`. The ones that
mattered most:

### Every game was played against an illegal army

`generateLegalSetup()` kept a bomb off the front row by swapping it with
`army[findIndex(p => p.name !== '炸弹')]`. For the **red** side the front row is
filled last, so that index always pointed at an already-placed piece. The same
piece object was written to two stations and one bomb was dropped.

Measured against the previous implementation:

```
OLD generateLegalSetup('navy') over 2000 formations:
   duplicated piece object : 0
OLD generateLegalSetup('red')  over 2000 formations:
   duplicated piece object : 2000
   wrong bomb count        : 2000
```

Red is the computer's army in Vs Computer and Player 2's army in Classic — so
**every game ever played** had a duplicated piece and a missing bomb on the
opposing side. The old suite tested that a formation was *generated*, never
that it was *correct*.

### Replay was a counter

Step Back, Step Forward and Play only incremented a text label. No position was
ever reconstructed. Records now store an opening board and rebuild positions
from the public history.

### Opening the app destroyed saved games

`JunqiBoard`'s constructor called `startNewGame('vs_computer')`, which called
`saveState()`. Every launch wrote a junk record. Against a 20-game cap, roughly
twenty launches would evict the owner's real games.

### The AI could read piece identities

`createAiObservation` redacted `name` and `rank` but passed `id` through — and
ids are of the form `navy-司令-0`. The boundary was one string away from being
decorative.

### Movement did not match the drawn board

Any orthogonally adjacent step was legal, so pieces crossed the front line at
columns 1 and 3 where the board draws no line. Rows 0 and 11 were marked as
railway, allowing rail runs along the Headquarters rows.

Movement now derives from an explicit adjacency graph, and the drawn board is
generated **from that same graph** — the two cannot diverge.

### Motion frequently did not run

The `transition` property and the target `transform` were assigned in the same
`requestAnimationFrame` callback, so the browser could coalesce them into a
jump with no interpolation. This is the concrete cause of "animations were
effectively not visible". Replaced with the Web Animations API, and every
animation is now raced against a hard timeout so presentation can never block
game logic.

---

## 3. What was rebuilt

| Area | Before | Now |
|---|---|---|
| Navigation | independent click handlers mutating `location.hash` | one state machine, 15 explicit states, `App.go()` the only entry point |
| Game state | one long-lived `JunqiBoard` reused for every game | `GameSession` per game, with identity and `dispose()` |
| AI boundary | `setTimeout` writing into whatever object existed | session + token check before any write; cancelled on leave |
| Rules | ad-hoc distance checks | explicit adjacency graph; board rendered from it |
| Privacy | scattered `isVisible` logic in the renderer | one `isPieceVisibleTo()`, asserted at DOM level |
| Persistence | single blob, junk on boot, setup baseline dropped | v3 library, write only on real play, full round-trip |
| Sound | oscillator ramps | noise transient + resonant body per cue |
| Icon | 1499×925 transparent PNG declared as square | square masters, aspect preserved by construction |

Retired: `js/board.js`, `js/hint.js`, `js/pass_ipad.js`, `js/engine/test.js`,
`css/style.css`, `css/learn.css`, `css/variables.css`, and the Xcode/native
build scripts (out of scope for this product).

---

## 4. Verification

| Suite | Result |
|---|---|
| `tests/rules.test.mjs` (node) | **66 / 66** — written from the ruleset, not from the code |
| `tests/e2e.js` (browser, real clicks) | **61 / 61** — asserts rendered state, not object state |
| Mode transition matrix | full 3×3 at zero moves and after real play, plus mid-AI, post-finish, post-rematch, post-resume |
| Failure injection | 11 scenarios |
| Visual audit | 18 real states captured and reviewed |
| Offline | verified by killing the server and relaunching: app booted from cache, resumed a saved game, played a move, AI replied, state persisted |

The unit tests have teeth: the duplicate-piece test was run against the old
implementation and fails on 2000/2000 red formations.

---

## 5. i18n readiness

All user-facing copy lives in `js/i18n/strings.js` behind `t(key, vars)`.
Components ask for keys; static markup carries `data-i18n`. A `zh` dictionary
is scaffolded and falls back to English per key, so a partial translation
degrades to readable text rather than raw keys.

The current release stays English-only, with no language selector, as
instructed. Layout is content-sized throughout — no fixed widths on buttons,
rails or dialogs — so shorter Chinese strings will not leave holes and longer
ones will not clip.

**I18N_READINESS: READY**

---

## 6. Known remaining issues

1. **Safari has not been exercised directly.** All automated runs used
   Chromium 150. The CSS avoids Chromium-only features and uses `-webkit-`
   prefixes for masks and backdrop filters, but this is an inference, not a
   measurement.
2. **Physical iPad behaviour is unverified** — touch accuracy, Home Screen icon
   rendering, real audio output, and a true offline launch from an installed
   PWA. This is what the owner's acceptance pass is for.

Neither is a known defect; both are honestly untested surfaces.

---

## 7. Owner acceptance pass

Roughly two minutes. Everything else has been verified here.

1. Open Caesar Games; confirm the footer reads **v1.1.0**
2. Play → Vs Computer → Ready → make one move (confirm the piece visibly travels and clicks)
3. Home → Play → 2 Players Classic → confirm it opens and your army is at the bottom
4. Home → Play → 2 Players Flip → turn over ~6 pieces → confirm the two armies face opposite ways
5. Confirm Games and Continue appear on Home
6. Turn off Wi-Fi, close and reopen the app, tap Continue, make one move
7. Confirm the Home Screen icon is the navy CD mark and is not stretched

If anything there fails, it is a real defect and the rest of this report should
be treated as suspect.
