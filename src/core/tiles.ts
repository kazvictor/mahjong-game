import { Suit, type Tile } from './types';

/**
 * Helpers for working with Mahjong tiles.
 *
 * These are pure functions (no side effects), which makes them easy to test
 * in isolation. The suite/rank mapping below matches a standard set of 136
 * tiles used in most Mahjong variants.
 */

/** The four honor ranks mapped to display labels (East..Red Dragon). */
const HONOR_LABELS: Record<number, string> = {
  1: 'East Wind',
  2: 'South Wind',
  3: 'West Wind',
  4: 'North Wind',
  5: 'Red Dragon',
  6: 'Green Dragon',
  7: 'White Dragon',
};

/**
 * Build a standard 136-tile set: four copies of each suited tile (1-9 across
 * three suits) plus four copies of each of the seven honor tiles.
 */
export function buildStandardSet(): Tile[] {
  const tiles: Tile[] = [];
  const suited: Suit[] = [Suit.Character, Suit.Bamboo, Suit.Dot];

  for (const suit of suited) {
    for (let rank = 1; rank <= 9; rank += 1) {
      pushCopies(tiles, { suit, rank }, 4);
    }
  }

  for (let rank = 1; rank <= 7; rank += 1) {
    pushCopies(tiles, { suit: Suit.Honor, rank }, 4);
  }

  return tiles;
}

/** Return a human-readable label for a tile. */
export function tileLabel(tile: Tile): string {
  if (tile.suit === Suit.Honor) {
    return HONOR_LABELS[tile.rank] ?? `Honor ${tile.rank}`;
  }
  const suitLabel =
    tile.suit === Suit.Character
      ? 'Characters'
      : tile.suit === Suit.Bamboo
        ? 'Bamboo'
        : 'Dots';
  return `${tile.rank} of ${suitLabel}`;
}

/** Push `count` copies of `tile` onto `tiles`. */
function pushCopies(tiles: Tile[], tile: Tile, count: number): void {
  for (let i = 0; i < count; i += 1) {
    tiles.push(tile);
  }
}
