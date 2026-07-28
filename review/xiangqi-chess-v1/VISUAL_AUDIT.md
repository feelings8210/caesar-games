# Caesar Games — Xiangqi + Chess + Bilingual V1 Visual Audit

Captured in Playwright WebKit 2287 at iPad landscape `1180 × 820`.
The 16 states in `shots/` were reached in the running app and tiled into
`FINAL_CONTACT_SHEET.png`.

## States reviewed

1. Three-game Home — English
2. Three-game Home — Simplified Chinese
3. Xiangqi mode selection
4. Xiangqi 2 Players — opening board
5. Xiangqi capture
6. Xiangqi check
7. Xiangqi Vs Computer
8. Chess mode selection
9. Chess 2 Players — opening board
10. Chess capture
11. Chess Vs Computer
12. Chess check
13. Chess promotion chooser
14. Games Library containing Junqi, Xiangqi and Chess
15. Chess read-only replay
16. Offline Home with Continue

## Review verdict

- Home remains quiet and collection-like: three equal family game tiles, no
  arcade/dashboard treatment, and the CD mark, Love & Play and Since 2026 line
  are preserved.
- English and Chinese layouts retain the same rhythm with no clipping.
- Xiangqi is a warm, low-gloss tabletop object with readable palace lines,
  river, cannon/soldier spacing and tactile discs.
- All 16 Black Xiangqi faces point toward the top player in 2 Players. The
  board, river, coordinates and hit targets remain upright.
- Xiangqi capture/check states remain readable without neon effects.
- Chess uses warm ivory and restrained navy-gray squares. A fine dark stroke
  was added to the light pieces after the first review so they hold on ivory
  squares at iPad distance.
- Chess check is a restrained mineral-red ring. Promotion presents four clear
  human choices without silently selecting Queen.
- Games Library and Replay fit within the iPad landscape viewport with no
  clipped controls.
- Offline status is visible but subordinate; Continue remains the main action.
- All static boards and controls are valid before motion. No view depends on an
  entrance animation completing.

No remaining visual defect was found in the captured release states.
