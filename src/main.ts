import './style.css';
import { GameRenderer } from './engine/renderer';
import { GameLoop } from './engine/game-loop';

/**
 * Application entry point.
 *
 * Bootstraps the canvas, wires up the game loop, and kicks off rendering.
 * The update step is intentionally a no-op for now; game state will be driven
 * by it in a later phase.
 */
function mount(): void {
  const canvas = document.getElementById('game-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Expected an element with id "game-canvas" of type canvas.');
  }

  const renderer = new GameRenderer(canvas);
  // `noUnusedParameters` ignores params prefixed with `_`, so the placeholder
  // update callback type-checks cleanly until real game state is wired in.
  const loop = new GameLoop(
    (_deltaMs: number) => {
      /* game state updates will run here */
    },
    () => renderer.render(),
  );

  loop.start();
}

mount();
