# Caesar Games v2.0.1 — AI Strength + Flip Motion Direction Hotfix

Date: 2026-07-28

Baseline: production v2.0.0, commit `36c341b`

## AI_AUDIT

The visible labels were not fake, but Standard was shallow: Chess used fixed
depth 2, Xiangqi used a 10×10 two-ply beam, and Junqi chose from a single
heuristic pass. v2.0.1 keeps Relaxed child-friendly and makes Standard
materially different in search, evaluation, determinism, and tactical safety.
No external engine was added.

## JUNQI_RELAXED_STRENGTH

One-ply legal choice with meaningful score noise. It values forward progress,
camps, public captures, and legal play but can miss tactics.

## JUNQI_STANDARD_STRENGTH

Deterministic observation-only scoring now adds a public remaining-piece
probability pool, expected capture outcomes, flag pressure, engineer pursuit of
known mines, camp/rail/mobility value, own-flag cover, and a filtered opponent
reply-pressure pass that penalizes exposed pieces.

## JUNQI_NO_CHEATING_TEST

PASS. Unknown enemy pieces expose no name, rank, static status, or identifying
ID. The new invariant test swaps concealed true identities while keeping public
state fixed and requires Standard to return the identical move. Diagnostics
also mark the observation-only decision path.

## XIANGQI_RELAXED_STRENGTH

One-ply evaluation with random selection from the six best legal candidates.

## XIANGQI_STANDARD_STRENGTH

PASS. Time-bounded iterative selective alpha-beta completes through depth 4 in
the ordinary opening measured here. Evaluation includes material, central
activity, soldier advancement, attack/defense maps, hanging-piece penalties,
General safety, and check pressure. Ordering prioritizes General capture,
MVV-LVA captures, checks, central activity, and advanced soldiers. The
authoritative engine continues to enforce cannon screens and horse-leg rules.

## CHESS_RELAXED_STRENGTH

One-ply material/activity evaluation with random selection from the seven best
legal candidates.

## CHESS_STANDARD_STRENGTH

PASS. Time-bounded iterative alpha-beta completes through depth 4 in the
ordinary opening measured here. Ordering prioritizes mate, captures using
MVV-LVA, checks, promotions, and castling. Evaluation adds material,
piece-square activity, pawn advancement, bishop pair, castled-king safety, and
check pressure. Deeper replies provide concrete hanging-piece and short tactic
avoidance. A forced-mate test requires Standard to convert mate in one.

Chess and Xiangqi searches run in a dedicated module worker and are cancelled
on navigation/game replacement.

## AI_RESPONSE_TIME

Five-sample compute medians on the release machine:

| Game | Relaxed | Standard |
|---|---:|---:|
| Chess | 4.5 ms | 826.2 ms |
| Xiangqi | 63.8 ms | 935.6 ms |
| Junqi | 0.7 ms | 10.1 ms |

Complete Standard reply measurements, including UI presentation:

| Browser | Xiangqi | Chess |
|---|---:|---:|
| Chromium | 1433.5 ms | 1735.0 ms |
| Playwright WebKit | 1140.0 ms | 1728.0 ms |

The WebKit/Chromium target is met in the measured ordinary positions. The
owner's physical iPad remains the final hardware confirmation.

## FLIP_MOTION_ROOT_CAUSE

Confirmed before editing. The flyer composed centering translate, 180-degree
face rotation, and travel translate on the same element. The rotation changed
the local transform axes, so every top-facing mid-animation vector was
inverted, followed by a snap to the already-committed destination.

The fix makes `.bv-piece` / `.bv-flyer` the movement shell and `.bv-face` the
orientation child. Only the shell translates in board/screen coordinates.

## FLIP_LEFT_RIGHT_TEST

PASS in Chromium and WebKit for Navy and Red, bottom-facing and top-facing.
All mid-animation `dx` signs match the logical direction.

## FLIP_UP_DOWN_TEST

PASS in Chromium and WebKit for Navy and Red, bottom-facing and top-facing.
The vertical cases cross rows 5↔6 (board halves); all mid-animation `dy` signs
match the logical direction.

## FLIP_TOP_SIDE_ROTATION_TEST

PASS. The moving shell matrix contains translation without rotation; the child
face matrix remains rotated 180 degrees. No opposite travel, arc, correction,
or snap-back was observed. Thirty-two path assertions pass.

Evidence:

- `MOTION_PATH_RESULTS.json`
- `WEBKIT_MID_navy_left.png`
- `WEBKIT_MID_red_down-cross-half.png`
- `PREFIX_REPRODUCTION.json`

## CHROMIUM_E2E

PASS:

- Junqi: 63 / 63
- Xiangqi, Chess, shared shell: 17 / 17
- Flip path gate: 16 / 16 Chromium assertions

## WEBKIT_E2E

PASS:

- Junqi: 63 / 63
- Xiangqi, Chess, shared shell: 17 / 17
- Flip path gate: 16 / 16 WebKit assertions

## NON_REGRESSION

PASS:

- Junqi rules/session/AI: 68 / 68
- Xiangqi/Chess rules and AI: 37 / 37
- Classic privacy, setup, active-player-bottom, combat, Last Move
- Flip neutral backs, owner-facing labels, rules, cross-half motion
- Xiangqi/Chess rules, orientation, Continue, records, replay
- Games library, six cross-game transitions, bilingual UI, sound state,
  persistence, stale-AI cancellation, and PWA cache installation

## OFFLINE_STATUS

PASS in WebKit. The test installed `caesar-games-v2.0.1`, stopped and confirmed
the local server unreachable, reloaded from cache, resumed the same Xiangqi
game at 483.80×537.55 with 32 pieces, and completed another legal move offline.

## BUILD_VERSION

`v2.0.1` / `caesar-games-v2.0.1`

## PRODUCTION_COMMIT

Release commit is the final `main` / `HEAD` reported in the task result.

## PAGES_STATUS

BLOCKED BY PUBLISHING GUARD. Production remains verified at v2.0.0. The local
v2.0.1 release commit is clean and ready. Exact owner command:

`git push origin main`

## KNOWN_REMAINING_ISSUES

- No known software blocker from the automated release gates.
- This environment rejected the external `git push`; Pages cannot deploy or be
  verified until the owner runs `git push origin main`.
- Search is intentionally bounded and local; it is stronger family-play AI,
  not a tournament engine.
- Physical iPad timing and feel require the short owner smoke test.

## READY_FOR_OWNER_SHORT_SMOKE_TEST

YES after the owner push and GitHub Pages serves v2.0.1.
