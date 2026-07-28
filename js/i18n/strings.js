/* Caesar Games — user-facing copy
 *
 * Every string the player can read lives here. Components must never
 * hard-code display text; they ask for a key.
 *
 * The next release adds 简体中文. That pass only needs to fill in the `zh`
 * dictionary below — no component changes. English stays the primary language
 * for this release and there is deliberately no language selector yet.
 *
 * Layout note: nothing may assume a fixed text length. Chinese renders roughly
 * 40-60% shorter than English, and some strings will grow. Buttons and rails
 * size to their content; do not reintroduce fixed widths.
 */

export const LOCALES = ['en', 'zh'];
export const DEFAULT_LOCALE = 'en';

const en = {
  /* brand */
  'brand.name': 'Caesar Games',
  'brand.tagline': 'Love & Play',
  'brand.mark': 'Caesar Games · Love & Play · Since 2026',
  'brand.game': 'Junqi',

  /* app bar */
  'bar.soundOn': 'Sound on',
  'bar.soundOff': 'Sound off',
  'bar.home': 'Home',

  /* home */
  'home.play': 'Play',
  'home.continue': 'Continue',
  'home.games': 'Games',
  'home.learn': 'Learn',
  'home.memory.one': '1 game saved on this iPad',
  'home.memory.many': '{n} games saved on this iPad',

  /* mode select */
  'mode.title': 'Choose a game',
  'mode.vsComputer': 'Vs Computer',
  'mode.vsComputer.desc': 'Play on your own against the iPad.',
  'mode.classic': '2 Players · Classic',
  'mode.classic.desc': 'Hidden armies. Pass the iPad between turns.',
  'mode.flip': '2 Players · Flip',
  'mode.flip.desc': 'Face-down pieces. Start straight away.',

  /* players */
  'players.title': 'Players',
  'players.p1': 'Player 1',
  'players.p2': 'Player 2',
  'players.you': 'You',
  'players.computer': 'Computer',
  'players.computerLabel': 'Computer',
  'players.relaxed': 'Relaxed',
  'players.standard': 'Standard',
  'players.start': 'Start',
  'players.sub.ai': 'You play the navy army at the bottom of the board.',
  'players.sub.two': 'Player 1 sets up first, then hands the iPad over.',

  /* setup */
  'setup.quick': 'Quick setup',
  'setup.reset': 'Reset',
  'setup.ready': 'Ready',
  'setup.arrange': '{name} — arrange your army',
  'setup.hint': 'Tap two of your pieces to swap them.',
  'setup.pickOwn': 'Tap one of your own pieces to pick it up.',
  'setup.ownOnly': 'You may only rearrange your own pieces.',

  /* play */
  'play.turn': "{name}'s turn",
  'play.thinking': '{name} is thinking…',
  'play.flipFirst': '{name} — turn over any piece',
  'play.hint.select': 'Tap one of your pieces to select it.',
  'play.hint.move': 'Tap a highlighted station to move.',
  'play.hint.flip': 'Turn over a piece, or move one of yours.',
  'play.hint.flipFirst': 'The first piece you turn over decides your army.',
  'play.replayMove': 'Replay last move',

  /* handoff */
  'handoff.title': 'Pass the iPad',
  'handoff.ready': "I'm ready",
  'handoff.toSetup': 'Arrange your army when you are ready.',
  'handoff.toPlay': 'The board is hidden until you tap below.',

  /* game end */
  'end.eyebrow': 'Result',
  'end.wins': '{name} wins',
  'end.detail': '{p1} vs {p2} · {n} moves',
  'end.byFlag': 'The Flag was captured.',
  'end.byImmobile': 'No legal moves remained.',
  'end.again': 'Play again',
  'end.record': 'View record',
  'end.home': 'Home',

  /* library */
  'library.title': 'Games',
  'library.empty': 'No games saved yet. Your matches will appear here.',
  'library.resume': 'Resume',
  'library.record': 'Record',
  'library.again': 'Play again',
  'library.delete': 'Delete',
  'library.inProgress': 'In progress',
  'library.won': '{name} won',
  'library.moves.one': '1 move',
  'library.moves.many': '{n} moves',
  'library.deleteTitle': 'Delete game',
  'library.deleteAsk': 'Delete the game between {p1} and {p2}?',
  'library.deleteConfirm': 'Delete',
  'library.deleteCancel': 'Keep',

  /* record & replay */
  'record.title': 'Record',
  'record.step': 'Move {n} / {total}',
  'record.moveCount': 'Move {n}',
  'record.back': 'Back',
  'record.forward': 'Forward',
  'record.play': 'Play',
  'record.pause': 'Pause',
  'record.noMoves': 'No moves were recorded.',
  'record.unavailable': 'This game was saved before board replay was available.',
  'record.unfinished': 'Unfinished',

  /* move descriptions — kept free of concealed identities */
  'move.moved': '{name} moved {from} → {to}',
  'move.took': '{name} took the station at {to}',
  'move.held': "{name}'s attack on {to} was held",
  'move.bothLost': 'Both pieces were lost at {to}',
  'move.flag': '{name} captured the Flag',
  'move.revealed': '{name} turned over the piece at {at}',

  /* rule refusals */
  'rule.mineStatic': 'Mines (地雷) never move.',
  'rule.flagStatic': 'The Flag (军旗) never moves.',
  'rule.hqLocked': 'A piece inside a Headquarters (大本营) may not move out.',
  'rule.ownPiece': 'That square holds your own piece.',
  'rule.campSafe': 'A piece inside a Campsite (行营) cannot be attacked.',
  'rule.railBlocked': 'The railway route is blocked.',
  'rule.noCorner': 'Only the Engineer (工兵) may turn corners on the railway.',
  'rule.notConnected': 'Those two stations are not connected.',
  'rule.alreadyThere': 'The piece is already there.',
  'rule.noSelection': 'No piece selected.',
  'rule.campEmpty': 'Campsites (行营) must stay empty during setup.',
  'rule.ownTerritory': 'Pieces must stay inside your own territory (rows {lo}–{hi}).',
  'rule.flagInHq': 'The Flag (军旗) must sit in a Headquarters (大本营).',
  'rule.minesBack': 'Mines (地雷) must sit in your back two rows.',
  'rule.bombFront': 'Bombs (炸弹) may not stand on the front line.',
  'rule.pieceCount': 'Expected 25 pieces, found {n}.',
  'rule.flagMissing': 'The Flag (军旗) is missing.',
  'rule.duplicate': 'The same piece appears twice on the board.',
  'rule.formationIllegal': 'This formation is not legal yet.',

  /* misc */
  'misc.noContinue': 'No game to continue.',
  'misc.vsSeparator': 'vs'
};

/* 简体中文 — populated in the next release. Keys intentionally left absent so
 * that lookup falls back to English rather than showing a raw key. */
const zh = {
  'brand.tagline': 'Love & Play',
  'brand.game': '陆战棋'
};

const DICTS = { en, zh };

let current = DEFAULT_LOCALE;

export function getLocale() { return current; }

export function setLocale(locale) {
  current = LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
  return current;
}

/**
 * Look up a string, interpolating {placeholders}.
 * Falls back to English, then to the key itself, so a missing translation
 * degrades to readable text rather than breaking the interface.
 */
export function t(key, vars) {
  const raw = DICTS[current]?.[key] ?? DICTS[DEFAULT_LOCALE][key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
}

/** Convenience for the one-vs-many strings above. */
export function plural(baseKey, n) {
  return t(n === 1 ? `${baseKey}.one` : `${baseKey}.many`, { n });
}

/** Apply translations to any element carrying data-i18n in the document. */
export function localizeDom(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of root.querySelectorAll('[data-i18n-placeholder]')) {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  }
  for (const el of root.querySelectorAll('[data-i18n-label]')) {
    el.setAttribute('aria-label', t(el.dataset.i18nLabel));
  }
  document.documentElement.lang = current === 'zh' ? 'zh-CN' : 'en';
}
