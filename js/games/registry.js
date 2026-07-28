/* Caesar Games — shared game registry.
 *
 * The shell knows navigation and saved records. Each entry points at an
 * isolated rules adapter; Junqi keeps its recovered controller untouched.
 */

export const GAME_TYPES = Object.freeze({
  JUNQI: 'junqi',
  XIANGQI: 'xiangqi',
  CHESS: 'chess'
});

export const GAME_REGISTRY = Object.freeze({
  junqi: {
    id: 'junqi',
    titleKey: 'game.junqi.title',
    nativeKey: 'game.junqi.native',
    descKey: 'game.junqi.desc',
    rulesVersion: 'junqi-v1.1'
  },
  xiangqi: {
    id: 'xiangqi',
    titleKey: 'game.xiangqi.title',
    nativeKey: 'game.xiangqi.native',
    descKey: 'game.xiangqi.desc',
    rulesVersion: 'xiangqi-family-v1'
  },
  chess: {
    id: 'chess',
    titleKey: 'game.chess.title',
    nativeKey: 'game.chess.native',
    descKey: 'game.chess.desc',
    rulesVersion: 'chess.js-1.4.0'
  }
});

export function gameMeta(gameType) {
  return GAME_REGISTRY[gameType] || GAME_REGISTRY.junqi;
}
