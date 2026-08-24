/**
 * GameLogic.ts — Pure domain logic for Mahjong solitaire.
 *
 * This module owns the *rules* of the game and the in-memory board model. It is
 * deliberately free of any rendering, DOM, or event handling concerns so it can
 * be unit-tested exhaustively and reused by the controller (Game.ts) and any
 * future save system.
 *
 * # Matching rules
 *   - A suited / honor tile matches another tile of the SAME suit AND rank.
 *   - FLOWERS are special: any Flower matches any other Flower.
 *   - SEASONS are special: any Season matches any other Season.
 *
 * # Free-tile rule
 *   A tile is "free" (selectable) only when both its left and right neighbours
 *   are absent — a simplified version of the classic solitaire exposure rule.
 *   With this model the top layer of a stack (z index) is always free, and a
 *   tile buried on both sides is blocked. The controller decides which free
 *   tiles to actually expose; see {@link isTileFree}.
 */

/** The suits in a standard Mahjong set. */
export enum Suit {
  Character = 'character',
  Bamboo = 'bamboo',
  Dot = 'dot',
  Honor = 'honor',
  Flower = 'flower',
  Season = 'season',
}

/** Whether a tile belongs to the suited ranks (1-9) or the honor class. */
export enum TileCategory {
  Suited = 'suited',
  Honor = 'honor',
  Special = 'special', // Flowers and Seasons
}

/**
 * A single tile placed on the board.
 *
 * @param suit     The tile's suit.
 * @param rank     For suited suits 1-9; for honors 1-4 (winds) / 5-7 (dragons);
 *                 for flowers/seasons the index (1-4). Used only for labels and
 *                 equality; matching ignores rank for special suits.
 * @param x,y,z    Board position. `z` is the layer/stack index (0 is the bottom
 *                 of a stack, larger z sits on top). Two tiles at the same
 *                 (x,y) but different z form a stack.
 * @param matched  Whether this tile has been removed (matched). A matched tile
 *                 is excluded from all matching/free-tile calculations.
 * @param id       Stable identity so two identical tiles can be told apart.
 */
export interface SolitaireTile {
  readonly id: number;
  readonly suit: Suit;
  readonly rank: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  matched: boolean;
}

/** Map a suit to its broad category. */
export function categorizeSuit(suit: Suit): TileCategory {
  switch (suit) {
    case Suit.Flower:
    case Suit.Season:
      return TileCategory.Special;
    case Suit.Honor:
      return TileCategory.Honor;
    default:
      return TileCategory.Suited;
  }
}

/**
 * Whether two tiles form a valid match.
 *
 * Special tiles (Flowers/Seasons) match any tile of the same special suit
 * regardless of rank. All other tiles must share both suit AND rank.
 */
export function tilesMatch(a: SolitaireTile, b: SolitaireTile): boolean {
  if (a.suit === Suit.Flower || a.suit === Suit.Season) {
    return a.suit === b.suit;
  }
  return a.suit === b.suit && a.rank === b.rank;
}

/**
 * True when the tile at (x, y, z) is free to select, i.e. neither its left nor
 * its right neighbour (same x/y row, adjacent column) is still on the board.
 *
 * Tiles at the far edges (x === 0 or x === maxX) always pass the side check,
 * which is the correct behaviour for a left-to-right exposed layout. When
 * `board` has a stack at (x,y,z+1) on top, this tile is NOT free regardless of
 * its side exposure — top-of-stack tiles must be cleared first.
 */
export function isTileFree(
  tile: SolitaireTile,
  board: ReadonlyMap<string, SolitaireTile>,
  maxX: number,
): boolean {
  if (tile.matched) {
    return false;
  }
  // A tile with another (unmatched) tile stacked on top is not free. A matched
  // tile has been removed, so it no longer blocks the tile beneath it.
  const above = board.get(positionKey(tile.x, tile.y, tile.z + 1));
  if (above && !above.matched) {
    return false;
  }
  // Left neighbour blocks (only if still on the board and unmatched).
  const left = tile.x > 0 ? board.get(positionKey(tile.x - 1, tile.y, tile.z)) : undefined;
  if (left && !left.matched) {
    return false;
  }
  // Right neighbour blocks (only if still on the board and unmatched).
  const right = tile.x < maxX ? board.get(positionKey(tile.x + 1, tile.y, tile.z)) : undefined;
  if (right && !right.matched) {
    return false;
  }
  return true;
}

/** Build the canonical map key for a board position. */
export function positionKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

/** Count how many tiles are still on the board (not matched). */
export function countRemaining(board: ReadonlyMap<string, SolitaireTile>): number {
  let n = 0;
  for (const tile of board.values()) {
    if (!tile.matched) {
      n += 1;
    }
  }
  return n;
}

/**
 * Find the first (lowest-index) free tile in the given row whose value can pair
 * with `tile`. Returns null when no free partner exists.
 */
export function findMatchingFreePartner(
  tile: SolitaireTile,
  board: ReadonlyMap<string, SolitaireTile>,
  maxX: number,
): SolitaireTile | null {
  for (const candidate of board.values()) {
    if (candidate === tile || candidate.matched) {
      continue;
    }
    if (tilesMatch(tile, candidate) && isTileFree(candidate, board, maxX)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Determine whether any valid move remains on the board.
 *
 * A move exists when there are two distinct, free, matching tiles. This is the
 * loss condition: when it returns false the player is stuck and must shuffle.
 */
export function hasAvailableMove(
  board: ReadonlyMap<string, SolitaireTile>,
  maxX: number,
): boolean {
  const free: SolitaireTile[] = [];
  for (const tile of board.values()) {
    if (!tile.matched && isTileFree(tile, board, maxX)) {
      free.push(tile);
    }
  }
  for (let i = 0; i < free.length; i += 1) {
    for (let j = i + 1; j < free.length; j += 1) {
      if (tilesMatch(free[i], free[j])) {
        return true;
      }
    }
  }
  return false;
}

/** True when every tile has been removed. */
export function isBoardWon(board: ReadonlyMap<string, SolitaireTile>): boolean {
  return countRemaining(board) === 0;
}

/**
 * Collect every tile that is currently free and exposed for selection.
 * Returns them sorted by (y, x, z) so callers get a stable, testable order.
 */
export function listFreeTiles(
  board: ReadonlyMap<string, SolitaireTile>,
  maxX: number,
): SolitaireTile[] {
  const free: SolitaireTile[] = [];
  for (const tile of board.values()) {
    if (!tile.matched && isTileFree(tile, board, maxX)) {
      free.push(tile);
    }
  }
  free.sort((a, b) => a.y - b.y || a.x - b.x || a.z - b.z);
  return free;
}
