/**
 * Game.ts — Main game controller for Mahjong solitaire.
 *
 * Orchestrates the state machine (GameState.ts) and the pure rules (GameLogic.ts)
 * into a single object the UI/renderer drives. The controller owns the board,
 * handles tile selection and matching, tracks remaining tiles, and flips the
 * game into WON/LOST as appropriate. Fade-out animation is handled by the
 * renderer observing {@link Game.removedTiles}; this controller only marks a
 * tile matched and leaves the tile in the map so the renderer can animate it.
 *
 * The controller is intentionally dependency-free (no DOM/canvas) so it can be
 * unit-tested with a plain object acting as the board provider.
 */

import {
  type SolitaireTile,
  Suit,
  TileCategory,
  categorizeSuit,
  countRemaining,
  hasAvailableMove,
  isBoardWon,
  listFreeTiles,
  positionKey,
  tilesMatch,
} from './GameLogic';
import { ACTIVE_PLAY_STATES, GameState, GameStateMachine } from './GameState';

/** Result of attempting to match two tiles. */
export interface MatchResult {
  readonly ok: boolean;
  readonly removed: SolitaireTile[];
  readonly reason: 'selected' | 'matched' | 'no-match' | 'not-free' | 'not-playing';
}

/** What a {@link Game.tick} did at the end of its update pass. */
export type TurnOutcome = 'none' | 'won' | 'lost';

export interface GameOptions {
  /**
   * Milliseconds a matched tile remains listed (for fade-out) before it is
   * pruned from {@link Game.removedTiles}. Defaults to 250ms.
   */
  fadeDurationMs?: number;
}

/**
 * Main controller. Create one per board layout, call {@link Game.newGame} with a
 * fresh tile list to (re)start, and drive it with {@link Game.select}.
 */
export class Game {
  private readonly machine = new GameStateMachine(GameState.MENU);
  private board: ReadonlyMap<string, SolitaireTile> = new Map();
  private maxX = 0;
  private selected: SolitaireTile | null = null;
  private removedTiles_: SolitaireTile[] = [];
  private fadeMs: number;
  /** Tracks time remaining on fade-out so the renderer can animate removal. */
  private fadeTimers = new Map<number, number>();
  /** Monotonic id source for newly created tiles (used by shuffle). */
  private nextTileId = 1;

  constructor(options: GameOptions = {}) {
    this.fadeMs = options.fadeDurationMs ?? 250;
  }

  /** Current {@link GameState}. */
  get state(): GameState {
    return this.machine.current;
  }

  /** Currently selected (highlighted) tile, if any. */
  get selectedTile(): SolitaireTile | null {
    return this.selected;
  }

  /** Tiles currently mid fade-out (matched but not yet pruned). */
  get removedTiles(): readonly SolitaireTile[] {
    return this.removedTiles_;
  }

  /** Number of tiles still on the board (not matched). */
  get remaining(): number {
    return countRemaining(this.board);
  }

  /** True when the player has won. */
  get won(): boolean {
    return this.state === GameState.WON;
  }

  /** True when the player has lost (no moves remain). */
  get lost(): boolean {
    return this.state === GameState.LOST;
  }

  /**
   * (Re)start a game from a fresh tile list. Assigns stable ids, stores the
   * board, resets selection/removal, and moves the machine to PLAYING.
   *
   * @param tiles  The tiles to place on the board (positions already set).
   * @param maxX   Maximum x coordinate, used for the free-tile rule.
   */
  newGame(tiles: SolitaireTile[], maxX: number): void {
    const board = new Map<string, SolitaireTile>();
    for (const t of tiles) {
      const tile: SolitaireTile = { ...t, id: t.id === 0 ? this.nextTileId++ : t.id, matched: false };
      board.set(positionKey(tile.x, tile.y, tile.z), tile);
    }
    this.board = board;
    this.maxX = maxX;
    this.selected = null;
    this.removedTiles_ = [];
    this.fadeTimers.clear();
    this.transition(GameState.PLAYING);
  }

  /**
   * Core interaction: click a tile.
   *
   *  - First click on a free tile selects it.
   *  - Clicking the already-selected tile deselects it.
   *  - Clicking a different free tile that matches removes both (fade-out).
   *  - Clicking a free tile that does NOT match swaps the selection to it.
   *  - Clicking a blocked tile is ignored.
   */
  select(x: number, y: number, z: number): MatchResult {
    if (!ACTIVE_PLAY_STATES.has(this.machine.current) || this.machine.current !== GameState.PLAYING) {
      return { ok: false, removed: [], reason: 'not-playing' };
    }

    const tile = this.board.get(positionKey(x, y, z));
    if (!tile || tile.matched) {
      return { ok: false, removed: [], reason: 'not-free' };
    }
    if (!isFree(tile, this.board, this.maxX)) {
      return { ok: false, removed: [], reason: 'not-free' };
    }

    // Deselect if the same tile is clicked again.
    if (this.selected === tile) {
      this.selected = null;
      return { ok: false, removed: [], reason: 'selected' };
    }

    // No current selection → select.
    if (this.selected === null) {
      this.selected = tile;
      return { ok: true, removed: [], reason: 'selected' };
    }

    // A selection exists; does it match this newly clicked free tile?
    const first = this.selected;
    if (tilesMatch(first, tile)) {
      this.removePair(first, tile);
      return { ok: true, removed: [first, tile], reason: 'matched' };
    }

    // Different tile: swap the selection to it.
    this.selected = tile;
    return { ok: false, removed: [], reason: 'selected' };
  }

  /**
   * Shuffle the unmatched tiles into new random positions, preserving each
   * tile's x/y so the board footprint is unchanged. Re-assigns z to remove
   * stacked dead-ends and keeps tiles playable. Used when no moves remain.
   */
  shuffle(): void {
    const active = [...this.board.values()].filter((t) => !t.matched);
    // Gather the set of (x,y) slots currently occupied by unmatched tiles.
    const slots = new Set(active.map((t) => `${t.x},${t.y}`));
    // Fisher–Yates on the tile order.
    for (let i = active.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [active[i], active[j]] = [active[j], active[i]];
    }
    // Rebuild the board with the same slots, all at z=0.
    const rebuilt = new Map<string, SolitaireTile>();
    const slotKeys = [...slots];
    active.forEach((tile, idx) => {
      const [sx, sy] = slotKeys[idx].split(',').map(Number);
      const newTile: SolitaireTile = {
        ...tile,
        id: this.nextTileId++,
        x: sx,
        y: sy,
        z: 0,
        matched: false,
      };
      rebuilt.set(positionKey(sx, sy, 0), newTile);
    });
    this.board = rebuilt;
    this.selected = null;
  }

  /**
   * Advance per-frame game logic (called by the game loop).
   *  - Ages fade-out timers and prunes fully-faded removed tiles.
   *  - Detects win (board empty) and loss (no moves remain).
   * @returns what changed this tick.
   */
  tick(deltaMs: number): TurnOutcome {
    let outcome: TurnOutcome = 'none';

    if (this.machine.current === GameState.PLAYING) {
      // Win check takes priority over loss check.
      if (isBoardWon(this.board)) {
        this.transition(GameState.WON);
        outcome = 'won';
      } else if (!hasAvailableMove(this.board, this.maxX)) {
        this.transition(GameState.LOST);
        outcome = 'lost';
      }
    }

    this.advanceFades(deltaMs);
    return outcome;
  }

  /** Whether a given tile is free (delegates to the pure rule). */
  isFree(tile: SolitaireTile): boolean {
    return isFree(tile, this.board, this.maxX);
  }

  /** All currently free, exposed tiles, sorted stably. */
  freeTiles(): SolitaireTile[] {
    return listFreeTiles(this.board, this.maxX);
  }

  /** Direct access to the live board (read-only). */
  get boardView(): ReadonlyMap<string, SolitaireTile> {
    return this.board;
  }

  /** The maximum x coordinate of the current board. */
  get boardMaxX(): number {
    return this.maxX;
  }

  /**
   * Pause the game (PLAYING → PAUSED). No-op unless currently playing.
   * Pausing freezes input (the controller rejects `select` while paused).
   */
  pause(): void {
    if (this.machine.current === GameState.PLAYING) {
      this.transition(GameState.PAUSED);
    }
  }

  /**
   * Resume a paused game (PAUSED → PLAYING). No-op unless currently paused.
   */
  resume(): void {
    if (this.machine.current === GameState.PAUSED) {
      this.transition(GameState.PLAYING);
    }
  }

  /** Toggle between PLAYING and PAUSED. No-op in any other state. */
  togglePause(): void {
    if (this.machine.current === GameState.PLAYING) {
      this.pause();
    } else if (this.machine.current === GameState.PAUSED) {
      this.resume();
    }
  }

  /** Advance fade-out timers and drop removed tiles whose fade elapsed. */
  private advanceFades(deltaMs: number): void {
    if (this.fadeTimers.size === 0) {
      return;
    }
    for (const [id, remaining] of [...this.fadeTimers]) {
      const next = remaining - deltaMs;
      if (next <= 0) {
        this.fadeTimers.delete(id);
        this.removedTiles_ = this.removedTiles_.filter((t) => t.id !== id);
      } else {
        this.fadeTimers.set(id, next);
      }
    }
  }

  /** Mark two tiles matched, push them to fade-out, and clear selection. */
  private removePair(a: SolitaireTile, b: SolitaireTile): void {
    a.matched = true;
    b.matched = true;
    this.removedTiles_ = [...this.removedTiles_, a, b];
    this.fadeTimers.set(a.id, this.fadeMs);
    this.fadeTimers.set(b.id, this.fadeMs);
    this.selected = null;
  }

  /** Perform a validated state transition (throws on illegal moves). */
  private transition(next: GameState): void {
    this.machine.transition(next);
  }
}

/** Local alias to keep `select` readable. */
function isFree(tile: SolitaireTile, board: ReadonlyMap<string, SolitaireTile>, maxX: number): boolean {
  // Re-import to avoid a naming clash with the method; see listFreeTiles.
  return listFreeTiles(board, maxX).some((t) => t.id === tile.id);
}

// Re-export the pure helpers the UI will want from the controller's module.
export { categorizeSuit, countRemaining, positionKey, Suit, TileCategory };
