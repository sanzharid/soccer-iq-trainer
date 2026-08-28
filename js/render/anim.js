// Tiny tween helper: move players along (dx, dy) over durationMs, redrawing each frame.
export function animateScene(pitch, movers, durationMs, onDone) {
  const t0 = performance.now();
  function frame(now) {
    const t = Math.min(1, (now - t0) / durationMs);
    pitch.draw({
      players: movers.map(m => ({ ...m, x: m.x + m.dx * t, y: m.y + m.dy * t })),
    });
    if (t < 1) requestAnimationFrame(frame);
    else if (onDone) onDone();
  }
  requestAnimationFrame(frame);
}
