# Three-game transition matrix

Automated by `tests/e2e-open.js` in both Chromium and WebKit.

| From | To | Zero-move new game | Identity/type isolation |
|---|---|---:|---:|
| Junqi | Xiangqi | PASS | PASS |
| Junqi | Chess | PASS | PASS |
| Xiangqi | Junqi | PASS | PASS |
| Xiangqi | Chess | PASS | PASS |
| Chess | Junqi | PASS | PASS |
| Chess | Xiangqi | PASS | PASS |

Additional lifecycle gates:

- Unfinished Xiangqi → Home → Continue restores exact `gameId` and move count.
- Games → Resume uses the record's `gameType`.
- Unfinished records with moves expose a read-only Record/Replay view.
- Completed Chess → Rematch creates a new `gameId`.
- Completed Chess → Home → Xiangqi creates Xiangqi state only.
- Leaving while Xiangqi AI is pending, then starting Chess, cannot mutate the
  Chess session; both `gameId` and `gameType` are checked.
- The shared board mount rebuilds Junqi after returning from either open game.
  This is explicitly regression-tested because the visual audit found a
  detached-view lifecycle defect during development.
- WebKit offline install → server stop → reload → Continue restores Xiangqi and
  accepts another legal move from cache `caesar-games-v2.0.0`.
