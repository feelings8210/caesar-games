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

/** Cubic Hermite arc with an optional smooth upward bow. Start and end
 * velocities are units/second; the bow has zero slope at both ends. */
export function reviewShotWithVelocity(start, rim, startVelocity, endVelocity, elapsed, duration, bow = 0) {
  const valid = v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
  if (![start, rim, startVelocity, endVelocity].every(valid) || !Number.isFinite(elapsed) ||
      !Number.isFinite(duration) || duration <= 0 || !Number.isFinite(bow) || bow < 0)
    throw new Error('Invalid shot trajectory');
  const u = Math.max(0, Math.min(1, elapsed / duration)), u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  return start.map((value, i) => h00 * value + h10 * duration * startVelocity[i] + h01 * rim[i] +
    h11 * duration * endVelocity[i] + (i === 1 ? 16 * bow * u2 * (1 - u) ** 2 : 0));
}
