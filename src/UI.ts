/**
 * UI.ts — DOM overlay + canvas rendering + controller wiring for Mahjong.
 *
 * The UI owns:
 *  - The DOM overlay (menu screen, HUD, win/loss screen, pause screen).
 *  - The canvas frame (drawing tiles on the backdrop).
 *  - Gluing the {@link Game} controller, the {@link InputHandler}, the board
 *    builder, and the HUD together.
 *
 * It deliberately does NOT own game rules or tile geometry — those live in the
 * controller and GameLogic. The UI observes `game.state` each tick and
 * re-renders the overlay/canvas accordingly. This keeps the UI a pure
 * presentation layer that the QA suite can drive via the DOM and canvas.
 *
 * Coordinate model:
 *  - Canvas is 960x640. Tiles are drawn in an isometric-ish projection where
 *    screen.x = tileX * TILE_W, screen.y = tileY * TILE_H - z * STACK_LIFT.
 *    The board builder spaces stacks every 2 grid units, so TILE_W/2 is the
 *    effective column pitch. This keeps the hit-test (axis-aligned rects) in
 *    sync with the render for a clean top-down feel.
 */

import { Suit, type SolitaireTile } from './GameLogic';
import { Game, type MatchResult } from './Game';
import { GameState } from './GameState';
import { buildTurtleBoard } from './boardBuilder';
import { InputHandler, type TileHitArea } from './InputHandler';

/** Tile size in pixels (width of the tile face). */
const TILE_W = 56;
/** Tile height in pixels (including the slight vertical face). */
const TILE_H = 68;
/** Vertical lift applied per stack layer (so stacked tiles show depth). */
const STACK_LIFT = 12;
/** Background color behind the board. */
const BACKDROP = '#0f3d2e';

/** Per-suit colors for the tile face. */
const SUIT_COLORS: Record<Suit, string> = {
  [Suit.Character]: '#d8b4fe',
  [Suit.Bamboo]: '#86efac',
  [Suit.Dot]: '#93c5fd',
  [Suit.Honor]: '#fcd34d',
  [Suit.Flower]: '#f9a8d4',
  [Suit.Season]: '#fca5a5',
};

/** Shorthand for a UI overlay callback with no arguments. */
export interface UIEvents {
  /** User clicked "Start Game" on the menu. */
  onStart: () => void;
  /** User clicked "Restart" (from win/loss or HUD). */
  onRestart: () => void;
  /** User clicked "Shuffle". */
  onShuffle: () => void;
}

/**
 * The visible UI container. Created once with the canvas + a controller and
 * driven by `update()` on each animation frame.
 */
export class UI {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly game: Game;
  private readonly input: InputHandler;
  private readonly events: UIEvents;

  // HUD element references (looked up once at mount).
  private readonly hudEl: HTMLElement;
  private readonly hudTilesEl: HTMLElement;
  private readonly hudTimerEl: HTMLElement;

  // Screen element references.
  private readonly menuEl: HTMLElement;
  private readonly endEl: HTMLElement;
  private readonly endTitleEl: HTMLElement;
  private readonly pauseEl: HTMLElement;

  private startedAt = 0;
  private timerText = '0:00';
  private destroyed = false;
  /** Position key of the tile currently under the cursor, or null when the
   * cursor is over no tile. Drives the hover highlight in {@link drawTile}. */
  private hoverPos: string | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    root: HTMLElement,
    game: Game,
    events: UIEvents,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('UI: canvas 2D context is unavailable.');
    }
    this.canvas = canvas;
    this.ctx = ctx;
    this.game = game;
    // Keep the event callbacks reachable from the DOM (buttons on the overlays).
    this.events = events;

    this.hudEl = getRequired(root, '.hud');
    this.hudTilesEl = getRequired(root, '.hud__tiles');
    this.hudTimerEl = getRequired(root, '.hud__timer');
    this.menuEl = getRequired(root, '.screen-menu');
    this.endEl = getRequired(root, '.screen-end');
    this.endTitleEl = getRequired(root, '.screen-end__title');
    this.pauseEl = getRequired(root, '.screen-pause');

    // Wire overlay buttons to the host's callbacks.
    root.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => {
      el.addEventListener('click', () => {
        const action = el.dataset.action;
        if (action === 'start' || action === 'restart') {
          this.events.onStart();
        } else if (action === 'restart-from-end') {
          this.events.onRestart();
        } else if (action === 'shuffle') {
          this.events.onShuffle();
        } else if (action === 'resume') {
          this.game.resume();
        }
      });
    });

    this.input = new InputHandler(canvas, {
      onAction: (action) => this.handleAction(action),
      onHover: (x, y, z) => this.handleHover(x, y, z),
    }, { getIsPlaying: () => this.isInGame() });

    // Initial state is the menu; the board is built on Start.
    this.render();
  }

  /** Advance the UI: refresh HUD, reconcile overlays with state, redraw. */
  update(): void {
    if (this.destroyed) {
      return;
    }
    this.setTimerText();
    this.syncOverlays();
    this.render();
  }

  /** Tear down listeners. */
  destroy(): void {
    this.destroyed = true;
    this.input.destroy();
  }

  /** Start a fresh game (menu Start, Restart, R). */
  startNewGame(): void {
    const { tiles, maxX } = buildTurtleBoard();
    this.game.newGame(tiles, maxX);
    this.startedAt = performance.now();
    this.timerText = '0:00';
    this.hoverPos = null;
  }

  /**
   * Return the on-screen center (canvas-relative CSS pixels) of a tile at the
   * given board position. Useful for hit-testing/tests and QA tooling.
   */
  screenCenterOf(x: number, y: number, z: number): { cx: number; cy: number } {
    const { px, py } = this.toScreen(x, y, z);
    return { cx: px + TILE_W / 2, cy: py + TILE_H / 2 };
  }

  /** Route an input action to the right controller call. */
  private handleAction(
    action: { readonly kind: string } & Record<string, unknown>,
  ): void {
    switch (action.kind) {
      case 'tile-click': {
        const { x, y, z } = action as { kind: 'tile-click'; x: number; y: number; z: number };
        if (this.game.state !== GameState.PLAYING) {
          return;
        }
        const result = this.game.select(x, y, z);
        this.reportMatch(result);
        break;
      }
      case 'shuffle':
        if (this.game.state === GameState.PLAYING) {
          this.game.shuffle();
        }
        break;
      case 'restart':
        this.startNewGame();
        break;
      case 'toggle-pause':
        this.togglePause();
        break;
      default:
        break;
    }
  }

  /** Reconcile the DOM overlays with the current game state. */
  private syncOverlays(): void {
    const state = this.game.state;

    // Menu screen (only from MENU).
    this.menuEl.classList.toggle('is-hidden', state !== GameState.MENU);

    // HUD visible whenever we're in a live game.
    this.hudEl.classList.toggle('is-hidden', !this.isInGame());
    this.hudTilesEl.textContent = String(this.game.remaining);
    this.hudTimerEl.textContent = this.timerText;

    // Pause overlay.
    this.pauseEl.classList.toggle('is-hidden', state !== GameState.PAUSED);

    // End screen (won or lost).
    const over = state === GameState.WON || state === GameState.LOST;
    this.endEl.classList.toggle('is-hidden', !over);
    if (state === GameState.WON) {
      this.endTitleEl.textContent = 'You Won!';
      this.endTitleEl.classList.add('is-win');
      this.endTitleEl.classList.remove('is-loss');
      const sub = this.endEl.querySelector<HTMLElement>('.screen-end__subtitle');
      if (sub) sub.textContent = `Board cleared in ${this.timerText}.`;
    } else if (state === GameState.LOST) {
      this.endTitleEl.textContent = 'No Moves Left';
      this.endTitleEl.classList.add('is-loss');
      this.endTitleEl.classList.remove('is-win');
      const sub = this.endEl.querySelector<HTMLElement>('.screen-end__subtitle');
      if (sub) sub.textContent = 'Shuffle to continue, or restart for a fresh board.';
    }
  }

  /** Is the current state one where the board is being played? */
  private isInGame(): boolean {
    const s = this.game.state;
    return s === GameState.PLAYING || s === GameState.PAUSED;
  }

  private togglePause(): void {
    this.game.togglePause();
  }

  /** Draw the backdrop + all visible tiles onto the canvas. */
  private render(): void {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = BACKDROP;
    ctx.fillRect(0, 0, w, h);

    // Draw the felt table area.
    ctx.fillStyle = '#1c5a44';
    ctx.fillRect(24, 40, w - 48, h - 160);

    if (!this.isInGame()) {
      return; // nothing on the board in menu / over / won screens
    }

    // Collect all tiles (unmatched) plus fading-out tiles.
    const tiles: SolitaireTile[] = [...this.game.boardView.values()];
    const removed = this.game.removedTiles;

    // Build hit areas for unmatched tiles only.
    const areas: TileHitArea[] = [];
    const positions = new Map<string, { px: number; py: number }>();
    for (const tile of tiles) {
      if (tile.matched) {
        continue;
      }
      const { px, py } = this.toScreen(tile.x, tile.y, tile.z);
      positions.set(positionKey(tile.x, tile.y, tile.z), { px, py });
      areas.push({ id: tile.id, x: tile.x, y: tile.y, z: tile.z, px, py, w: TILE_W, h: TILE_H });
    }
    this.input.setTileAreas(areas);

    // Fading-out tiles are drawn after the board so they layer on top.
    for (const tile of tiles) {
      if (tile.matched) {
        continue;
      }
      this.drawTile(tile, positions.get(positionKey(tile.x, tile.y, tile.z))!, this.game.isFree(tile));
    }
    for (const tile of removed) {
      const { px, py } = this.toScreen(tile.x, tile.y, tile.z);
      this.drawFadingTile(tile, px, py);
    }
  }

  /** Isometric-style screen position for a tile. */
  private toScreen(x: number, y: number, z: number): { px: number; py: number } {
    const px = 40 + x * (TILE_W / 2) - y * (TILE_W / 2) + (TILE_W / 2);
    const py = 90 + x * (TILE_H / 4) + y * (TILE_H / 4) - z * STACK_LIFT;
    return { px: px - TILE_W / 2, py: py - TILE_H / 2 };
  }

  /** Draw a single tile with its current state (selected / blocked / hovered). */
  private drawTile(
    tile: SolitaireTile,
    screen: { px: number; py: number },
    free: boolean,
  ): void {
    const { ctx } = this;
    const { px, py } = screen;
    const selected = this.game.selectedTile?.id === tile.id;
    const hovered = this.hoverPos === positionKey(tile.x, tile.y, tile.z);
    const color = SUIT_COLORS[tile.suit] ?? '#cccccc';

    // Tile face with a subtle 3D edge.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px, py, TILE_W, TILE_H);
    ctx.fillStyle = color;
    ctx.fillRect(px + 3, py + 3, TILE_W - 6, TILE_H - 6);

    // Blocked (not free): darken.
    if (!free) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(px + 3, py + 3, TILE_W - 6, TILE_H - 6);
    }

    // Selected: bright highlight border.
    if (selected) {
      ctx.strokeStyle = '#ffe14d';
      ctx.lineWidth = 3;
      ctx.strokeRect(px + 1, py + 1, TILE_W - 2, TILE_H - 2);
    } else if (hovered && free) {
      // Hovered: soft cyan outline so the player can see the tile under the
      // cursor before clicking. Only free tiles are clickable, so only they
      // get the affordance.
      ctx.strokeStyle = '#7dd3fc';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, py + 1, TILE_W - 2, TILE_H - 2);
    }

    // Suit + rank label.
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.label(tile), px + TILE_W / 2, py + TILE_H / 2 - 4);
  }

  /** Draw a tile mid fade-out (matched, fading). */
  private drawFadingTile(tile: SolitaireTile, px: number, py: number): void {
    const { ctx } = this;
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px, py, TILE_W, TILE_H);
    ctx.fillStyle = SUIT_COLORS[tile.suit] ?? '#cccccc';
    ctx.fillRect(px + 3, py + 3, TILE_W - 6, TILE_H - 6);
    ctx.globalAlpha = 1;
  }

  /** A short label for a tile (rank, or honor/season abbreviation). */
  private label(tile: SolitaireTile): string {
    if (tile.suit === Suit.Honor) {
      const names: Record<number, string> = { 1: 'E', 2: 'S', 3: 'W', 4: 'N', 5: 'R', 6: 'G', 7: 'B' };
      return names[tile.rank] ?? String(tile.rank);
    }
    if (tile.suit === Suit.Flower || tile.suit === Suit.Season) {
      return tile.suit === Suit.Flower ? 'F' : 'S';
    }
    return String(tile.rank);
  }

  /** Update the timer text based on elapsed time since the game started. */
  setTimerText(): void {
    const elapsed = (performance.now() - this.startedAt) / 1000;
    const minutes = Math.floor(elapsed / 60);
    const seconds = Math.floor(elapsed % 60);
    this.timerText = `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  /** Expose a match result to the console for QA/debug visibility. */
  private reportMatch(result: MatchResult): void {
    if (result.reason === 'matched') {
      // Matches are silent in the UI; the board update is what matters.
      void result;
    }
  }

  private handleHover(x: number | null, y: number | null, z: number | null): void {
    // Record the hovered tile so the renderer can highlight it. When the
    // cursor leaves any tile, x/y/z are null and the highlight clears. Hover
    // is only meaningful while a game is live; otherwise force-clear it.
    if (!this.isInGame() || x === null || y === null || z === null) {
      this.hoverPos = null;
      return;
    }
    this.hoverPos = positionKey(x, y, z);
  }
}

/** Get a required DOM node or throw with a clear message. */
function getRequired(root: HTMLElement, selector: string): HTMLElement {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) {
    throw new Error(`UI: required element "${selector}" not found under #app.`);
  }
  return el;
}

/** Canonical position key (same format as GameLogic.positionKey). */
function positionKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}
