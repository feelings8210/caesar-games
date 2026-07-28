# Caesar Games v1.1.1 WebKit hotfix validation

Run date: 2026-07-28

## Sizing architecture

The game board no longer establishes size containment or asks WebKit to infer
an automatic width from a contained definite height. The gameplay mount has a
viewport-bounded width and the canonical `600 / 1010` aspect ratio; `.bv-board`
fills that already-resolved box.

## Automated results

| Gate | Result |
|---|---|
| Unit (`tests/rules.test.mjs`) | 66 / 66 |
| Chromium E2E | 62 / 62 |
| WebKit 2287 E2E | 62 / 62 |
| Chromium 1024×768 board | 407.03 × 685.16 |
| WebKit 1024×768 board | 407.03 × 685.16 |
| WebKit 1180×820 board | 434.59 × 731.56 |
| WebKit offline install/reload/resume/action | PASS |

At 1024×768, both engines produced the same board rectangle, a width/height
ratio of `0.59407`, viewport-sized document scroll bounds, 25 visible setup
faces, and three accessible 48px setup controls.

## WebKit journeys

- Vs Computer: setup, Quick Setup, Reset, Ready, gameplay.
- Classic: P1 setup, handoff, P2 setup, gameplay.
- Flip: 50 initial backs, reveal behavior, stable board orientation.

Every visible board phase asserts positive board width and height. Setup phases
assert 25 painted own pieces, and Flip asserts all 50 painted backs.

## Screenshot audit

The five PNGs in [`shots`](./shots/) were inspected at 1180×820. All show the
complete board, correct proportions and orientation, station-aligned pieces,
accessible controls, and no page overflow.

## Offline evidence

WebKit installed cache `caesar-games-v1.1.1` and saved a Vs Computer session.
The local server process was then terminated and a separate fetch confirmed
the origin was unreachable. The controlled page reloaded, resumed via
Continue, painted a `434.59 × 731.56` board, and completed one legal action.

Physical iPad execution remains the owner's single final device check and is
not represented as an automated pass.
