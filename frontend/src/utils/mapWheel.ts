/** One conventional wheel notch (100 CSS px / 3 lines) is one configured step.
 * Touchpads contribute fractional steps; unusually large events are capped.
 * This deliberately has no dependency on the current map scale.
 */
export function wheelZoomDelta(event: Pick<WheelEvent, 'deltaY' | 'deltaMode'>, increment: number): number {
  const pixels = event.deltaY * (event.deltaMode === 1 ? 100 / 3 : event.deltaMode === 2 ? 100 : 1);
  if (!Number.isFinite(pixels) || pixels === 0) return 0;
  return -Math.max(-1, Math.min(1, pixels / 100)) * increment;
}
