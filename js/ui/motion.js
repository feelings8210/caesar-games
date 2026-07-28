/* Shared motion policy. State is never dependent on animation completion.
 * Reduced-motion keeps every transition visible but collapses its duration. */

export function prefersReducedMotion() {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch { return false; }
}

export function motionMs(normalMs, reducedMs = 1) {
  return prefersReducedMotion() ? reducedMs : normalMs;
}
