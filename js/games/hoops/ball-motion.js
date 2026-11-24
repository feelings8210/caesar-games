/* Analytic made-basket fall, in court feet and seconds. No frame accumulation:
 * the ball remains continuous across floor contacts even after skipped frames. */
export function madeBallAt(seconds, rimHeight = 10.3, radius = 0.45) {
  const gravity = 32, restitution = 0.5;
  let time = Math.max(0, seconds), height = rimHeight, velocity = -3.5;
  let contacts = 0, duration = 0;
  for (let bounce = 0; bounce < 4; bounce++) {
    const contactAt = (velocity + Math.sqrt(velocity * velocity + 2 * gravity * (height - radius))) / gravity;
    if (time < contactAt) {
      return { height: Math.max(radius, height + velocity * time - gravity * time * time / 2),
        forward: (duration + time) * 1.2, contacts, settled: false };
    }
    time -= contactAt; duration += contactAt; contacts++;
    velocity = (gravity * contactAt - velocity) * restitution;
    height = radius;
  }
  return { height: radius, forward: duration * 1.2, contacts, settled: true };
}
