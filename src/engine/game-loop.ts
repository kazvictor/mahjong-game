/**
 * A minimal requestAnimationFrame-driven game loop.
 *
 * Keeps the loop and the render step separate so the renderer can be swapped
 * or tested independently. The loop tracks elapsed time so the update step can
 * use a delta time rather than assuming a fixed frame rate.
 */
export class GameLoop {
  private rafId: number | null = null;
  private lastTime = 0;
  private readonly update: (deltaMs: number) => void;
  private readonly render: () => void;

  constructor(update: (deltaMs: number) => void, render: () => void) {
    this.update = update;
    this.render = render;
  }

  /** Start the loop. Safe to call multiple times; no-ops if already running. */
  start(): void {
    if (this.rafId !== null) {
      return;
    }
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  /** Stop the loop. Safe to call when not running. */
  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private readonly tick = (now: number): void => {
    const deltaMs = now - this.lastTime;
    this.lastTime = now;

    this.update(deltaMs);
    this.render();

    this.rafId = requestAnimationFrame(this.tick);
  };
}
