# Caesar Games V1 — Junqi Core Rules & Gameplay Semantics Authority

This document defines the canonical rules engine, mode behaviors, privacy rules, coordinate systems, combat mechanics, and AI information boundaries for **Caesar Games V1**.

---

## 1. V1 Game Modes

Caesar Games V1 implements exactly three locked game modes:

1. **Vs Computer — Classic Concealed Junqi (暗棋)**
   - Single-human player vs Local AI.
   - Human player controls Navy (bottom territory, rows 6–11).
   - Computer controls Red (top territory, rows 0–5).
   - Human completes pre-game setup phase before gameplay starts.
   - Computer formation is generated independently and remains concealed.
   - No Pass the iPad flow; human perspective remains static at bottom.

2. **2 Players — Classic Concealed Junqi (暗棋)**
   - Shared single-iPad local play for 2 human players.
   - Player 1 (Navy) and Player 2 (Red).
   - Pre-game setup phase for Player 1, followed by Pass iPad Privacy Shield, followed by Pre-game setup phase for Player 2.
   - During gameplay, the current active player is ALWAYS rendered at the **BOTTOM** of the board.
   - Opponent pieces remain visually concealed (face-down backs) before and after combat.
   - Full Pass the iPad privacy shield enforced between every turn.

3. **2 Players — Flip Mode (翻棋)**
   - Shared single-screen travel mode.
   - 50 pieces shuffled face down into non-camp board slots.
   - First piece revealed by Player 1 determines Player 1's army color.
   - Per turn: Player reveals 1 face-down piece OR moves 1 revealed piece.
   - Board perspective does NOT flip; board stays static.
   - Revealed piece text faces its owner (Player 1 pieces face bottom, Player 2 pieces face top).
   - Unrevealed pieces (`CD` backs) are orientation-neutral and identical.

---

## 2. Classic Concealed Junqi (暗棋) Semantics

### Piece Ranks & Ratios (25 Pieces per Army)

| Piece Name | Chinese | Rank Number | Count | Movement / Special Rules |
|---|---|---|---|---|
| Field Marshal | 司令 | 1 (Highest) | 1 | 1 step road / straight rail. If eliminated, Flag position is exposed. |
| Corps Commander | 军长 | 2 | 1 | 1 step road / straight rail. |
| Division Commander | 师长 | 3 | 2 | 1 step road / straight rail. |
| Brigade Commander | 旅长 | 4 | 2 | 1 step road / straight rail. |
| Regiment Commander | 团长 | 5 | 2 | 1 step road / straight rail. |
| Battalion Commander | 营长 | 6 | 2 | 1 step road / straight rail. |
| Company Commander | 连长 | 7 | 3 | 1 step road / straight rail. |
| Platoon Commander | 排长 | 8 | 3 | 1 step road / straight rail. |
| Engineer | 工兵 | 9 (Lowest officer) | 3 | Can turn corners on clear connected railways. Disarms Mines. |
| Mine | 地雷 | 10 (Defense) | 3 | Static (cannot move). Defeats all pieces except Engineer & Bomb. |
| Bomb | 炸弹 | 99 (Special) | 2 | Mutual destruction with any piece it collides with. |
| Flag | 军旗 | 0 (Objective) | 1 | Static (cannot move). Capture results in immediate game loss. |

---

## 3. Pre-Game Setup Rules & Placement Restrictions

1. **Territory Bounds**:
   - Navy setup slots: Rows 6–11 (excluding 5 Campsites at `7-1`, `7-3`, `8-2`, `9-1`, `9-3`).
   - Red setup slots: Rows 0–5 (excluding 5 Campsites at `1-1`, `1-3`, `2-2`, `3-1`, `3-3`).
2. **Flag Placement**: Must be placed in one of the two Headquarters (大本营) slots (`11-1` or `11-3` for Navy; `0-1` or `0-3` for Red).
3. **Mine Placement**: Must be placed in the back two rows (`10`, `11` for Navy; `0`, `1` for Red).
4. **Bomb Placement**: Cannot be placed on the front row (`6` for Navy; `5` for Red).
5. **Camp Placement**: Campsites (行营) must remain empty during setup.
6. **Touch-First Interaction**: Tap piece A → tap piece B (or empty setup slot) → swap pieces.
7. **Controls**:
   - `Quick Setup`: Generates a 100% legal formation automatically.
   - `Reset`: Restores initial setup formation of current session.
   - `Ready`: Locks setup formation and advances phase.

---

## 4. Combat Resolution & Concealment

- **Higher Rank Wins**: Lower rank number captures higher rank number (e.g. Rank 1 司令 defeats Rank 2 军长).
- **Equal Rank Mutual Destruction**: Both pieces are removed from the board.
- **Engineer vs Mine**: Engineer (工兵) disarms and captures Mine (地雷).
- **Other Piece vs Mine**: Mine defeats and removes attacking piece; Mine remains on board.
- **Bomb Collisions**: Bomb (炸弹) causes mutual destruction with any piece (both removed).
- **Flag Capture**: Capturing the opponent's Flag (军旗) wins the game immediately.
- **Concealment Rule**:
  - In Classic (暗棋), combat participation does NOT reveal surviving opponent pieces to face-up.
  - Surviving opponent piece remains visually concealed (hidden back) to the opponent.
  - **Commander / Flag Special Disclosure**: When a player's Field Marshal (司令) is eliminated in combat, that player's Flag (军旗) position becomes disclosed (`flagDisclosedToOpponent: true`) and is indicated to the opponent.

---

## 5. One-iPad Perspective & Canonical Coordinates

- **Canonical Board**: 12 rows (0–11) by 5 columns (0–4). Logical board state is saved strictly in canonical coordinates.
- **Perspective Transformation**:
  - Player 1 (Navy turn): Rendered with Navy at bottom (`renderedRow = canonicalRow`).
  - Player 2 (Red turn in Classic): Rendered with Red at bottom (`renderedRow = 11 - canonicalRow`, `renderedCol = 4 - canonicalCol`).
  - Header, menus, buttons, overlays, and status indicators remain 100% upright.
  - Touch coordinates map deterministically back to canonical coordinates (`canonicalRow = 11 - renderedRow`, `canonicalCol = 4 - renderedCol`).

---

## 6. AI Information Boundary & Difficulties

- **Information Boundary**: AI receives a filtered observation where unrevealed human pieces contain zero private identity fields (`name` and `rank` redacted).
- **Difficulty Levels**:
  - `relaxed` (Relaxed): Introduces evaluation noise / variance for casual play.
  - `standard` (Standard): Applies strategic evaluation depth and piece value weighting.
