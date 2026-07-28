# Caesar Games — Xiangqi Family-Play V1 Rules

Rules version: `xiangqi-family-v1`

This document is the authority for the V1 rules engine. The ordinary movement,
check, checkmate, flying-general and stalemate rules follow the 2018 World
XiangQi Rules. Tournament repetition and chase adjudication is deliberately
simplified for a judge-free family game, as documented in section 8.

## 1. Board and sides

- The board has 9 files × 10 ranks, and pieces stand on intersections.
- Red moves first and begins at the bottom.
- Canonical row `0` is Black's back rank; row `9` is Red's. Rendering never
  mutates canonical coordinates.
- Each side begins with one General, two Advisors, two Elephants, two Horses,
  two Chariots, two Cannons and five Soldiers.

## 2. Piece movement

- **General 帥/將:** one orthogonal point, inside its 3×3 palace.
- **Advisor 仕/士:** one diagonal point, inside its palace.
- **Elephant 相/象:** exactly two diagonal points. The midpoint (“elephant
  eye”) must be empty, and it may not cross the river.
- **Horse 馬:** one orthogonal point followed by one diagonal point outward.
  A piece on the first orthogonal point (“horse leg”) blocks both moves through
  that leg.
- **Chariot 車:** any distance orthogonally through empty points.
- **Cannon 炮/砲:** slides like a Chariot when not capturing. To capture, it
  must jump over exactly one intervening piece (the screen) and land on the
  enemy piece. It may not jump for a non-capture.
- **Soldier 兵/卒:** one point forward before crossing the river. After
  crossing, it may move one point forward or sideways. It never moves backward.

## 3. Check and self-check

A General is in check when an opposing piece could capture it. A move is
illegal if it leaves the moving side's General in check. A checked player must
remove the threat by moving, capturing or interposing.

## 4. Flying General

The two Generals may not face along one open file with no intervening piece.
Opening that file is illegal because it exposes the moving General to check.
When the file is open, a General has the direct long-range capture against the
other General; this implements the standard “flying General” terminal meaning.

## 5. Winning

A player wins when the opponent has no legal move. This includes:

- checkmate: the opponent is checked and cannot escape;
- stalemate: the opponent is not checked but has no legal move.

Unlike Western Chess, Xiangqi stalemate is a loss, not a draw. A direct General
capture is also accepted as a terminal win; ordinary legal play normally ends
at checkmate first.

## 6. Modes and orientation

- **Vs Computer:** the human chooses Red or Black and is always rendered at the
  bottom. Red is the default.
- **2 Players:** Red is always at the bottom and Black is always at the top.
- In 2 Players, the character on every Black piece is rotated 180° to face the
  top player. Orientation follows the owner even after a piece crosses the
  river. Only the face rotates; the board, river, palace, coordinates and hit
  targets never rotate.

## 7. Computer opponent

Both levels search legal moves only and use local alpha-beta evaluation:
material, advancement/central activity, mobility and check pressure.

- **Relaxed:** one-ply evaluation with controlled randomness among good moves.
- **Standard:** selective two-ply search with capture-first ordering and a
  bounded beam, keeping ordinary iPad replies around or below one second.

The AI receives only the active game's serialized state. Before a result is
committed, the shell rechecks both `gameId` and `gameType`.

## 8. Repetition and perpetual play

Full WXF/AXF perpetual-check and perpetual-chase adjudication is a judge-like
rules system with many exception cases. Caesar Games V1 does **not** claim that
tournament adjudication.

The explicit family-play rule is:

> When the same position, including the side to move, occurs for the third
> time, the game is a draw.

This applies equally to quiet repetition, repeated checks and repeated chases.
It is deterministic, symmetric and testable, but intentionally more
conservative than tournament rules that may assign fault to one player.

## 9. Sources consulted

- World XiangQi Federation, *World XiangQi Rules* (2018).
- Asian Xiangqi Federation, AXF rules overview and repetition rules.
- GNU XBoard Xiangqi rules summary, used as a secondary cross-check for
  stalemate, flying General and perpetual-play semantics.
