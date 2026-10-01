/* Caesar Games — Hoops IQ, read history
 *
 * Every decision is logged on this device: skill tag, grade, time to decide.
 * The summary feeds the stats panel and weights Read & React rounds.
 */

const KEY = 'caesar_hoops_reads_v1';
const BEST = 'caesar_hoops_best_streak_v1';
const CAP = 800;

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

export function recordRead({ tag, level, grade, ms, mode }) {
  const log = load();
  log.push({ tag, level, grade, ms: Math.round(ms), mode, at: Date.now() });
  while (log.length > CAP) log.shift();
  try { localStorage.setItem(KEY, JSON.stringify(log)); } catch { /* private mode */ }
}

const rate = rows => (rows.length ? rows.filter(r => r.grade === 3).length / rows.length : null);

/** Per-tag counts, best-read rate, mean time on best reads, and recent trend. */
export function readSummary() {
  const log = load();
  const byTag = {};
  for (const r of log) (byTag[r.tag] ||= []).push(r);
  const tags = Object.fromEntries(Object.entries(byTag).map(([tag, rows]) => {
    const best = rows.filter(r => r.grade === 3);
    const half = Math.floor(rows.length / 2);
    return [tag, {
      n: rows.length,
      rate: rate(rows),
      avgMs: best.length ? best.reduce((s, r) => s + r.ms, 0) / best.length : null,
      // Recent half vs earlier half, once there is enough to compare.
      trend: rows.length >= 6 ? rate(rows.slice(half)) - rate(rows.slice(0, half)) : null
    }];
  }));
  return { total: log.length, rate: rate(log), tags };
}

export function tagAccuracy(tag) {
  const s = readSummary().tags[tag];
  return s && s.n >= 2 ? s.rate : null;
}

export function bestStreak() {
  try { return Number(localStorage.getItem(BEST)) || 0; } catch { return 0; }
}

export function saveBestStreak(n) {
  try { localStorage.setItem(BEST, String(n)); } catch { /* private mode */ }
}
