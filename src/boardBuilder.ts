/**
 * boardBuilder.ts — Board construction for the Mahjong solitaire UI.
 *
 * Produces a `SolitaireTile[]` and a `maxX` that can be handed to the `Game`
 * controller via `newGame()`. The layout is intentionally simple but
 * provably winnable:
 *
 *  - Tiles are arranged in isolated stacks (columns separated by a gap and
 *    rows by a gap), so the side-exposure rule never blocks a tile.
 *  - Each stack holds exactly two tiles (z = 0 bottom, z = 1 top). The top
 *    layer is a complete set of matching pairs, and the bottom layer is a
 *    complete set of matching pairs.
 *  - Removing all top pairs exposes the bottom pairs, which can then all be
 *    removed.
 *
 * Because the tile *values* are the only thing that matters for matching and
 * the positions are chosen so every tile is free (or only stack-blocked), the
 * board is guaranteed solvable by construction. The value pool is exactly the
 * 34 distinct suited/honor tiles (3 suits × 1-9 plus 7 honors); each value is
 * used exactly twice, forming one pair.
 */

import { Suit, type SolitaireTile } from './GameLogic';

/** A (suit, rank) value that forms one matching pair. */
interface TileValue {
  readonly suit: Suit;
  readonly rank: number;
}

/** A stack slot on the board grid. */
interface Slot {
  readonly x: number;
  readonly y: number;
}

/**
 * Build the board and its footprint.
 *
 * @returns the tile list (each tile carries its position and a stable id) and
 *          the maximum x coordinate, both ready for `Game.newGame`.
 */
export function buildTurtleBoard(): { tiles: SolitaireTile[]; maxX: number } {
  const values = buildValuePool();
  const bottomValues = values.slice(0, 17);
  const topValues = values.slice(17, 34);
  const slots = buildSlots();

  const tiles: SolitaireTile[] = [];
  let id = 1;

  for (let i = 0; i < slots.length; i += 1) {
    const slot = slots[i];

    const bottom = bottomValues[i % bottomValues.length];
    tiles.push({
      id: id++,
      suit: bottom.suit,
      rank: bottom.rank,
      x: slot.x,
      y: slot.y,
      z: 0,
      matched: false,
    });

    const top = topValues[i % topValues.length];
    tiles.push({
      id: id++,
      suit: top.suit,
      rank: top.rank,
      x: slot.x,
      y: slot.y,
      z: 1,
      matched: false,
    });
  }

  return { tiles, maxX: 10 };
}

/**
 * Build the 34 stack slots. Columns and rows are spaced apart (step of 2) so
 * no two tiles ever share an adjacent column at the same z, which keeps the
 * side-exposure rule from blocking any tile. Two corner slots are dropped to
 * reach exactly 34 slots (68 tiles = 34 pairs).
 */
function buildSlots(): Slot[] {
  const cols = [0, 2, 4, 6, 8, 10];
  const rows = [0, 1, 2, 3, 4, 5];
  const skip = new Set(['0,5', '10,0']);

  const slots: Slot[] = [];
  for (const y of rows) {
    for (const x of cols) {
      if (skip.has(`${x},${y}`)) {
        continue;
      }
      slots.push({ x, y });
    }
  }
  return slots;
}

/**
 * Build the 34 distinct suited/honor tile values (3 suits × ranks 1-9 plus 7
 * honor ranks), shuffled so that matching pairs are not placed adjacently.
 */
function buildValuePool(): TileValue[] {
  const values: TileValue[] = [];

  for (const suit of [Suit.Character, Suit.Bamboo, Suit.Dot]) {
    for (let rank = 1; rank <= 9; rank += 1) {
      values.push({ suit, rank });
    }
  }
  for (let rank = 1; rank <= 7; rank += 1) {
    values.push({ suit: Suit.Honor, rank });
  }

  // Fisher–Yates shuffle so identical pairs aren't spatially adjacent.
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }

  return values;
}
