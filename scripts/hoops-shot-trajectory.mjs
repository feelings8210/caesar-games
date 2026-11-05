/* Review-only, deterministic shot arc in game units (feet, y up).
 * Source mocap has no ball or release label. This geometry does not establish
 * hand contact, release velocity, a made shot, or animation acceptability. */
export function reviewShotPoint(start, rim, elapsed, duration, arcHeight) {
  const valid = v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
  if (!valid(start) || !valid(rim) || !Number.isFinite(elapsed) || !Number.isFinite(duration) || duration <= 0 ||
      !Number.isFinite(arcHeight) || arcHeight < 0) throw new Error('Invalid shot trajectory');
  const u = Math.max(0, Math.min(1, elapsed / duration));
  return [start[0] + (rim[0] - start[0]) * u,
    start[1] + (rim[1] - start[1]) * u + 4 * arcHeight * u * (1 - u),
    start[2] + (rim[2] - start[2]) * u];
}
