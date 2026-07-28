# State transition matrix — Caesar Games Junqi v1.1.0

## The lifecycle

One explicit state machine. `App.go(state, payload)` is the only function
allowed to change what is on screen. Entering a state tears down whatever the
previous state owned: pending AI turns, in-flight animations, selections and
overlays.

```
                         ┌──────────────┐
                         │     HOME     │◄────────────────────────┐
                         └──────┬───────┘                         │
                    Play        │        Games / Learn / Continue │
                         ┌──────▼───────┐                         │
                         │ MODE_SELECT  │                         │
                         └──────┬───────┘                         │
                         ┌──────▼───────┐                         │
                         │ PLAYER_SETUP │  names + difficulty     │
                         └──┬───┬───┬───┘                         │
              vs_computer   │   │   │   flip                      │
           ┌────────────────┘   │   └────────────────┐            │
           │            classic │                    │            │
    ┌──────▼──────┐    ┌────────▼─────────┐   ┌──────▼──────┐     │
    │ VS_AI_SETUP │    │ CLASSIC_P1_SETUP │   │  FLIP_PLAY  │     │
    └──────┬──────┘    └────────┬─────────┘   └──────┬──────┘     │
           │ Ready              │ Ready              │            │
    ┌──────▼──────┐    ┌────────▼─────────┐          │            │
    │ VS_AI_PLAY  │    │ CLASSIC_HANDOFF  │          │            │
    └──────┬──────┘    └────────┬─────────┘          │            │
           │           ┌────────▼─────────┐          │            │
           │           │ CLASSIC_P2_SETUP │          │            │
           │           └────────┬─────────┘          │            │
           │                    │ Ready → HANDOFF    │            │
           │           ┌────────▼─────────┐          │            │
           │           │  CLASSIC_PLAY    │◄─┐       │            │
           │           └────────┬─────────┘  │       │            │
           │                    └─ HANDOFF ──┘       │            │
           └────────────────────┬────────────────────┘            │
                         ┌──────▼───────┐                         │
                         │   GAME_END   │──── Home ───────────────┤
                         └──────┬───────┘                         │
                       Play again│  View record                   │
                                 ▼                                │
                    ┌────────────────────────┐                    │
                    │ GAME_LIBRARY → RECORD  │──── Home ──────────┘
                    │            → REPLAY    │
                    └────────────────────────┘
                              LEARN ◄──── Home
```

`RECORD` and `REPLAY` share a dialog; `REPLAY` is `RECORD` with the step
controls driving a reconstructed position.

---

## Guarantees enforced by the machine

| Guarantee | How |
|---|---|
| A new game never inherits the previous one | `startGame()` calls `leaveSession()` (save + `dispose()`) before constructing a new `GameSession` |
| A pending AI turn cannot write into another game | Every scheduled turn captures its session and a token; on firing it re-checks `session === this.session && !session.disposed && token === this._aiToken` |
| Leaving never loses work | `leaveSession()` persists the record before disposing |
| A finished game never blocks a new one | `GAME_END` is a state, not a modal trap; Home and Play again both leave it cleanly |
| Transient state never survives a reload | `GameSession.fromRecord()` deliberately does not restore `selected` or `pendingHandoff` |
| Motion cannot deadlock the game | Every animation is raced against a hard timeout |

---

## Verified transitions

All rows below are asserted by `tests/e2e.js` against the real UI. "New session"
means the resulting `gameId` differs and `history.length === 0`.

### Home → mode

| From | To | Result |
|---|---|---|
| Home | Vs Computer | PASS |
| Home | Classic | PASS |
| Home | Flip | PASS |

### Full 3×3 matrix, game with zero moves

| Leave | Start | Result |
|---|---|---|
| Vs Computer | Vs Computer / Classic / Flip | PASS / PASS / PASS |
| Classic | Vs Computer / Classic / Flip | PASS / PASS / PASS |
| Flip | Vs Computer / Classic / Flip | PASS / PASS / PASS |

### Full 3×3 matrix, after real play through the UI

| Leave (after a move) | Start | Result |
|---|---|---|
| Vs Computer | Vs Computer / Classic / Flip | PASS / PASS / PASS |
| Classic | Vs Computer / Classic / Flip | PASS / PASS / PASS |
| Flip | Vs Computer / Classic / Flip | PASS / PASS / PASS |

### Condition-specific

| Condition | Result |
|---|---|
| Leave **during AI thinking**, then start another mode | PASS — new board unchanged after the old timer's window elapses |
| Completed game → Home → another mode | PASS |
| Completed game → Play again | PASS — new `gameId` |
| After Games → Resume | PASS |
| After Games → Record → Replay → close | PASS |
| Classic resume mid-game | PASS — opens behind the privacy shield |
| Browser reload at every stage | PASS — round-trips through the record, transient state dropped |
| Double-tap a mode card | PASS — one game |
| Rapid Home/Play hammering (8×) | PASS — settles on a coherent screen |
| Rapid Ready / rapid handoff taps | PASS — advances exactly one step |
| Second move during the first animation | PASS — refused |

---

## The v1.0.3 defect, in state-machine terms

There was no state machine. Navigation was a set of independent click handlers
that each mutated `location.hash` and toggled CSS classes, and `JunqiBoard` was
a single long-lived object reused for every game.

The owner-reported failure had a much simpler cause than the architecture
suggested: `showNameSetupModal()` added an `.active` class to a dialog whose
markup carried an inline `style="display:none"`. Inline styles beat stylesheet
rules, so the dialog never appeared. The mode dialog closed, nothing opened,
and the player was left looking at Home — for **every** mode, on the **first**
attempt. The same inline attribute silently disabled the Games library and the
record/replay viewer.

`tests/e2e.js` now asserts that no `.dialog`, `.overlay`, `.handoff` or
`.screen` element carries an inline `display`, and that every dialog reached
through the UI has a non-zero box.
