# Caesar Games — Kid-Friendly Motion + Sound Polish

Date: 2026-07-28
Build line: v2.0.1

## Outcome

Caesar Games now uses one restrained physical-tabletop feedback language across
Junqi, Xiangqi, and Chess. The Home screen and product layout were not
redesigned. No reward systems, confetti, arcade effects, network audio, or
third-party sound packs were added.

## Motion changes

- Selection lifts and settles in 105–110ms with modest scale and shadow.
- Legal destinations use one quiet 160ms entrance, never a loop.
- Piece travel is true screen interpolation with a 160–260ms Junqi range,
  215ms Xiangqi timing, and lighter 185ms Chess timing.
- Capture sound and response begin at contact. Targets remain intact during
  travel, pause briefly, compress, and fade in 175ms.
- Invalid moves use a 125ms, 3px resistance nudge.
- Quick Setup uses a coordinated 205ms FLIP-layout settle and ignores duplicate
  taps while settling.
- Junqi reveal is a 225ms lift/squeeze, midpoint face change, and settle. Owner
  orientation remains on the face child; the moving shell owns translation.
- Xiangqi General and Chess king checks retain a quiet ring and pulse only when
  check first appears.
- Castling animates king and rook together; the rook uses a small pass-by lift
  so their paths remain visually distinct.
- Promotion travels as a pawn and changes into the chosen piece only at the
  destination.
- Result and promotion cards have short restrained entrance transitions.
- JavaScript and CSS motion collapse to 1ms under `prefers-reduced-motion`
  while canonical state remains exact and visible.

## Sound changes

All cues are synthesized locally with Web Audio. A filtered noise strike and a
custom damped multi-harmonic material body replace pure-tone beep character.
The master level was reduced, and pitch, attack/decay, timbre, and gain receive
small bounded variation.

Changed or added cues:

- UI tap: very light material tick
- Select: crisp ceramic/wood pickup
- Move/place: rounded two-mode “tok”
- Capture: heavier low contact
- Mutual removal: restrained paired impact
- Invalid: dry low resistance
- Reveal: scrape/turn with a small settling contact
- Check: distinct quiet paired wood modes
- Pass/ready: soft handoff and paired confirmation
- Quick Setup: three coordinated settling contacts
- Victory: warm approximately one-second resolved material cadence

There is no loss buzzer. Board sounds fire at physical contact, not at input.
Cue instrumentation verifies exact counts, rejected-state intent, muted
attempts, and stale-session suppression. Sound remains decorative; every state
is visually complete with sound off.

## Real browser QA

The dedicated gate `scripts/kid-friendly-polish-gate.mjs` passed 36/36
assertions across Chromium and Playwright WebKit and captured 36 initial,
mid-motion, and final frames.

Covered:

- Junqi top-facing movement in all four screen directions
- Junqi top-owner reveal midpoint and final orientation
- Xiangqi normal travel and capture contact/removal
- Chess normal travel, capture contact/removal, and coherent castling
- Exact final canonical state and motion-layer cleanup
- Persistent mute across reload and game switch
- Muted visual completion
- Real reduced-motion browser contexts

Evidence is in `POLISH_QA.json` and the adjacent PNG frame sequences.

Additional release gates:

- Chromium rendered E2E: Junqi 64/64; shared/Xiangqi/Chess 21/21
- WebKit rendered E2E: Junqi 64/64; shared/Xiangqi/Chess 21/21
- Original Flip direction hotfix gate: 32/32
- Junqi rules/session/AI: 68/68
- Xiangqi/Chess rules/AI: 37/37
- WebKit offline install/resume/action: pass, including
  `caesar-games-v2.0.1` and the new motion module
- Syntax checks and `git diff --check`: pass

## Remaining physical check

No automated software blocker remains. The final subjective checks are cue
character and timing on the owner's physical iPad speakers/display.
