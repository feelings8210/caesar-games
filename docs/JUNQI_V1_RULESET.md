# Caesar Games V1 — Junqi Ruleset

Authority for the rules engine, mode behaviour, concealment, coordinates and
the computer opponent's information boundary.

Variant: **Classic Concealed Junqi (暗棋)**. Opponent identities stay concealed
before *and after* combat. This is deliberately **not** 后明棋.

Rules version: `junqi-v1.1`

---

## 1. Modes

| Mode | Players | Concealment | Perspective |
|---|---|---|---|
| **Vs Computer** | 1 human + local AI | Human sees own army only | Human always at the bottom |
| **2 Players · Classic** | 2 humans, one iPad | Each sees own army only | Player to move always at the bottom |
| **2 Players · Flip (翻棋)** | 2 humans, one iPad | Face-down until turned over | Board never rotates |

---

## 2. Pieces (25 per army)

| Piece | Rank | Count | Notes |
|---|---|---|---|
| 司令 Field Marshal | 1 | 1 | When eliminated, that player's Flag position is disclosed |
| 军长 Corps Commander | 2 | 1 | |
| 师长 Division Commander | 3 | 2 | |
| 旅长 Brigade Commander | 4 | 2 | |
| 团长 Regiment Commander | 5 | 2 | |
| 营长 Battalion Commander | 6 | 2 | |
| 连长 Company Commander | 7 | 3 | |
| 排长 Platoon Commander | 8 | 3 | |
| 工兵 Engineer | 9 | 3 | Turns railway corners; disarms Mines |
| 地雷 Mine | 10 | 3 | Never moves |
| 炸弹 Bomb | 99 | 2 | Removes itself and whatever it meets |
| 军旗 Flag | 0 | 1 | Never moves; its capture ends the game |

Lower rank *number* wins. Equal ranks remove each other.

---

## 3. Board topology

Canonical board: 12 rows (0 = Red back line, 11 = Navy back line) × 5 columns.
Keys are `row-col`. **Canonical state never rotates.**

- **Campsites 行营** — `1-1 1-3 2-2 3-1 3-3` and `7-1 7-3 8-2 9-1 9-3`
- **Headquarters 大本营** — `0-1 0-3` and `11-1 11-3`
- **Railways 铁路** — every station on rows 1, 5, 6 and 10, plus columns 0 and 4
  between rows 1 and 10.
- **Roads 公路** — horizontal links on every row; vertical links inside each
  half; each campsite additionally joins its four diagonal corners.
- **Front line 前线** — the two halves are joined at columns **0, 2 and 4 only**.
  Columns 0 and 4 are railway bridges; column 2 is a road.

The movement graph is generated from this topology and the drawn board is
generated from the same graph, so the two cannot diverge.

---

## 4. Setup

1. 25 pieces fill the 25 non-camp stations of the player's own six rows.
2. **Campsites stay empty.**
3. **Flag** must sit in one of the player's two Headquarters.
4. **Mines** must sit in the player's back two rows (10–11 navy, 0–1 red).
5. **Bombs** may not stand on the front row (6 navy, 5 red).
6. Tap a piece, then tap another piece or an empty own station, to swap.
7. `Quick setup` generates a legal formation; `Reset` restores the formation
   this player started from; `Ready` locks it in.
8. An illegal arrangement is **refused and explained** — never silently
   corrected.

---

## 5. Movement

- **Road** — one step to any connected station.
- **Railway** — any distance in a straight line along the rails, provided every
  intervening station is empty.
- **Engineer 工兵** — may follow the rails around corners; intervening stations
  must still be empty.
- A piece standing in a **Campsite** cannot be attacked.
- A piece that enters a **Headquarters** can never leave.
- **Mines** and the **Flag** never move.

---

## 6. Combat

Resolution order:

1. **Flag captured** → attacker wins, game over.
2. **Bomb** involved → both pieces removed.
3. **Mine** defending → Engineer disarms it and takes the square; anyone else
   is destroyed and the Mine remains.
4. **Equal rank** → both removed.
5. Otherwise the higher rank wins.

**Concealment.** In Classic and Vs Computer, combat never turns a piece face
up. The loser leaves the board; the survivor stays concealed to the opponent.
The opponent sees only: their own piece gone, and an enemy piece occupying the
destination.

**Commander disclosure.** When a 司令 is eliminated, that player's 军旗 position
becomes disclosed to the opponent.

**Losing.** A player loses when their Flag is captured, or when they have no
legal move at the start of their turn.

---

## 7. Perspective & coordinates

- Canonical state is never rotated, mirrored or re-indexed.
- Classic renders `red_bottom` while Player 2 is acting (`row → 11-row`,
  `col → 4-col`); Vs Computer and Flip always render `navy_bottom`.
- Every station carries its **canonical** key, so a tap maps back to canonical
  coordinates with no arithmetic.
- Header, rails, buttons and overlays stay upright in every mode.

**Flip face orientation.** Rotation applies to the piece face only and is a
property of its **owner**, not of the square it stands on. Seat 1's army faces
the bottom player, seat 2's army is rotated 180°, wherever each piece stands.
Face-down pieces are identical and reveal nothing.

---

## 8. Computer opponent

- The AI receives a **sanitized observation**. An opponent piece it is not
  entitled to know carries no name, no rank and **no id** — piece ids encode
  the rank (`navy-司令-0`), so the id is replaced with an opaque token.
- Publicly known pieces (revealed, or a disclosed Flag) are passed through.
- Difficulty: `relaxed` (wider spread when choosing) and `standard`.
- Any pending AI turn is cancelled when its game is left, and its result is
  discarded if the session it belongs to is no longer current.

---

## 9. Rule decisions taken during the v1.1 audit

These were ambiguous or wrong in the previous build. Each is now explicit.

| Decision | Rationale |
|---|---|
| Front line joins at columns 0, 2, 4 only | v1.0.3 allowed a step from `5-1→6-1` and `5-3→6-3`, which the board never drew. Movement now matches the drawn topology. |
| Rows 0 and 11 are **not** railway | v1.0.3 marked `0-0 0-4 11-0 11-4` as railway, letting pieces make rail runs along the Headquarters rows. |
| A piece in a Headquarters cannot move | Standard Junqi; the previous doc was silent. Stated here so it can be argued with rather than discovered. |
| Flag capture resolves before the Bomb rule | A Bomb reaching the Flag destroys it either way, so it should end the game rather than read as a mutual loss. |
| No legal move = loss | Previously unimplemented, so a stuck game simply hung. |
| Mines cannot attack | Defensive guard; Mines are static, but the combat function no longer assumes its caller checked. |
