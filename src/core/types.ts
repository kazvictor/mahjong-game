/**
 * Core domain types for the Mahjong game.
 *
 * These are the building blocks the rendering and game logic layers will
 * build on. They are deliberately framework-agnostic (plain TS), so the
 * same types can be reused by a future game engine, save system, or tests.
 */

/** The four suits plus the honor tiles used in a standard Mahjong set. */
export enum Suit {
  Character = 'character',
  Bamboo = 'bamboo',
  Dot = 'dot',
  Honor = 'honor',
}

/**
 * A single tile in a Mahjong set.
 *
 * @param suit   Which suit the tile belongs to.
 * @param rank   The tile number (1-9) for suited tiles; for honor tiles this
 *               is the index of the honor (e.g. 1-4 winds, 5-7 dragons).
 */
export interface Tile {
  readonly suit: Suit;
  readonly rank: number;
}

/** The set of tiles a player currently holds in their hand. */
export type Hand = Tile[];
