import './style.css';
import { Game } from './Game';
import { GameState } from './GameState';
import { UI } from './UI';
import { GameLoop } from './engine/game-loop';

/**
 * Application entry point.
 *
 * Bootstraps the canvas, creates the game controller, mounts the UI (which
 * owns the DOM overlays and canvas rendering), and drives it from the game
 * loop. The controller's `tick` advances win/loss detection and fade-out
 * animations; `ui.update()` then reconciles the HUD/overlays and redraws.
 */
function mount(): void {
  const canvas = document.getElementById('game-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Expected an element with id "game-canvas" of type canvas.');
  }

  const app = document.getElementById('app');
  if (!app) {
    throw new Error('Expected an element with id "app".');
  }

  const game = new Game();
  const ui = new UI(canvas, app, game, {
    onStart: () => ui.startNewGame(),
    onRestart: () => ui.startNewGame(),
    onShuffle: () => {
      if (game.state === GameState.PLAYING) {
        game.shuffle();
      }
    },
  });

  const loop = new GameLoop(
    (deltaMs: number) => {
      game.tick(deltaMs);
      ui.update();
    },
    () => {
      /* ui.update() already redraws; keep the loop's render as a no-op so the
         controller's tick cadence is preserved. */
    },
  );

  loop.start();
}

mount();
