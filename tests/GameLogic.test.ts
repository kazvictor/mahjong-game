import { describe, it, expect } from 'vitest';
import {
  Suit,
  TileCategory,
  categorizeSuit,
  tilesMatch,
  isTileFree,
  countRemaining,
  hasAvailableMove,
  isBoardWon,
  listFreeTiles,
  positionKey,
  findMatchingFreePartner,
  type SolitaireTile,
} from '../src/GameLogic';

let idCounter = 0;
function tile(
  suit: Suit,
  rank: number,
  x: number,
  y: number,
  z = 0,
  matched = false,
): SolitaireTile {
  idCounter += 1;
  return { id: idCounter, suit, rank, x, y, z, matched };
}

/** Build a board map keyed by positionKey. */
function boardMap(tiles: SolitaireTile[]): Map<string, SolitaireTile> {
  const map = new Map<string, SolitaireTile>();
  for (const t of tiles) {
    map.set(positionKey(t.x, t.y, t.z), t);
  }
  return map;
}

describe('categorizeSuit', () => {
  it('categorizes suited, honor, and special suits', () => {
    expect(categorizeSuit(Suit.Character)).toBe(TileCategory.Suited);
    expect(categorizeSuit(Suit.Bamboo)).toBe(TileCategory.Suited);
    expect(categorizeSuit(Suit.Dot)).toBe(TileCategory.Suited);
    expect(categorizeSuit(Suit.Honor)).toBe(TileCategory.Honor);
    expect(categorizeSuit(Suit.Flower)).toBe(TileCategory.Special);
    expect(categorizeSuit(Suit.Season)).toBe(TileCategory.Special);
  });
});

describe('tilesMatch', () => {
  it('matches same suit and rank', () => {
    const a = tile(Suit.Character, 5, 0, 0);
    const b = tile(Suit.Character, 5, 1, 0);
    expect(tilesMatch(a, b)).toBe(true);
  });

  it('does not match same suit, different rank', () => {
    const a = tile(Suit.Character, 5, 0, 0);
    const b = tile(Suit.Character, 6, 1, 0);
    expect(tilesMatch(a, b)).toBe(false);
  });

  it('does not match different suit, same rank', () => {
    const a = tile(Suit.Character, 5, 0, 0);
    const b = tile(Suit.Bamboo, 5, 1, 0);
    expect(tilesMatch(a, b)).toBe(false);
  });

  it('does not match honor vs suited of same rank', () => {
    const a = tile(Suit.Honor, 1, 0, 0);
    const b = tile(Suit.Dot, 1, 1, 0);
    expect(tilesMatch(a, b)).toBe(false);
  });

  it('matches any two flowers regardless of rank', () => {
    const f1 = tile(Suit.Flower, 1, 0, 0);
    const f2 = tile(Suit.Flower, 4, 1, 0);
    expect(tilesMatch(f1, f2)).toBe(true);
  });

  it('matches any two seasons regardless of rank', () => {
    const s1 = tile(Suit.Season, 2, 0, 0);
    const s2 = tile(Suit.Season, 3, 1, 0);
    expect(tilesMatch(s1, s2)).toBe(true);
  });

  it('does not match a flower with a season', () => {
    const f = tile(Suit.Flower, 1, 0, 0);
    const s = tile(Suit.Season, 1, 1, 0);
    expect(tilesMatch(f, s)).toBe(false);
  });

  it('does not match a flower with a suited tile', () => {
    const f = tile(Suit.Flower, 1, 0, 0);
    const c = tile(Suit.Character, 1, 1, 0);
    expect(tilesMatch(f, c)).toBe(false);
  });
});

describe('isTileFree', () => {
  it('returns false for a matched tile', () => {
    const t = tile(Suit.Dot, 3, 0, 0, 0, true);
    const board = boardMap([t]);
    expect(isTileFree(t, board, 2)).toBe(false);
  });

  it('is free at left edge with no neighbours', () => {
    const t = tile(Suit.Dot, 3, 0, 0);
    const board = boardMap([t]);
    expect(isTileFree(t, board, 2)).toBe(true);
  });

  it('is blocked by a left neighbour', () => {
    const left = tile(Suit.Dot, 1, 0, 0);
    const target = tile(Suit.Dot, 3, 1, 0);
    const board = boardMap([left, target]);
    expect(isTileFree(target, board, 2)).toBe(false);
  });

  it('is blocked by a right neighbour', () => {
    const right = tile(Suit.Dot, 1, 2, 0);
    const target = tile(Suit.Dot, 3, 1, 0);
    const board = boardMap([right, target]);
    expect(isTileFree(target, board, 2)).toBe(false);
  });

  it('is free with an empty right neighbour gap', () => {
    const right = tile(Suit.Dot, 1, 3, 0);
    const target = tile(Suit.Dot, 3, 1, 0);
    const board = boardMap([right, target]);
    expect(isTileFree(target, board, 4)).toBe(true);
  });

  it('is not free when a tile is stacked on top', () => {
    const bottom = tile(Suit.Dot, 3, 0, 0, 0);
    const top = tile(Suit.Dot, 7, 0, 0, 1);
    const board = boardMap([bottom, top]);
    expect(isTileFree(bottom, board, 2)).toBe(false);
    expect(isTileFree(top, board, 2)).toBe(true);
  });

  it('is free when neighbours are matched (removed)', () => {
    const left = tile(Suit.Dot, 1, 0, 0, 0, true);
    const right = tile(Suit.Dot, 2, 2, 0, 0, true);
    const target = tile(Suit.Dot, 3, 1, 0);
    const board = boardMap([left, right, target]);
    expect(isTileFree(target, board, 2)).toBe(true);
  });
});

describe('countRemaining', () => {
  it('counts only unmatched tiles', () => {
    const a = tile(Suit.Dot, 1, 0, 0);
    const b = tile(Suit.Dot, 2, 1, 0, 0, true);
    const c = tile(Suit.Dot, 3, 2, 0);
    expect(countRemaining(boardMap([a, b, c]))).toBe(2);
  });

  it('returns 0 for an empty board', () => {
    expect(countRemaining(boardMap([]))).toBe(0);
  });
});

describe('hasAvailableMove', () => {
  it('returns true when two free matching tiles exist', () => {
    const a = tile(Suit.Character, 4, 0, 0);
    const b = tile(Suit.Character, 4, 2, 0);
    expect(hasAvailableMove(boardMap([a, b]), 2)).toBe(true);
  });

  it('returns false when only one tile remains', () => {
    const a = tile(Suit.Character, 4, 0, 0);
    expect(hasAvailableMove(boardMap([a]), 2)).toBe(false);
  });

  it('returns false when free tiles do not match', () => {
    const a = tile(Suit.Character, 4, 0, 0);
    const b = tile(Suit.Character, 5, 2, 0);
    expect(hasAvailableMove(boardMap([a, b]), 2)).toBe(false);
  });

  it('ignores matched tiles', () => {
    const a = tile(Suit.Character, 4, 0, 0, 0, true);
    const b = tile(Suit.Character, 4, 2, 0);
    expect(hasAvailableMove(boardMap([a, b]), 2)).toBe(false);
  });

  it('ignores free tiles that are blocked (not actually free)', () => {
    // a and b match, but a is sandwiched between two tiles so a is blocked.
    const blockerL = tile(Suit.Bamboo, 1, 0, 0);
    const a = tile(Suit.Character, 4, 1, 0);
    const blockerR = tile(Suit.Bamboo, 2, 2, 0);
    const b = tile(Suit.Character, 4, 4, 0);
    const board = boardMap([blockerL, a, blockerR, b]);
    // a is blocked (left + right neighbours); only b is free.
    expect(isTileFree(a, board, 4)).toBe(false);
    expect(hasAvailableMove(board, 4)).toBe(false);
  });
});

describe('isBoardWon', () => {
  it('returns true when all tiles are matched', () => {
    const a = tile(Suit.Dot, 1, 0, 0, 0, true);
    const b = tile(Suit.Dot, 1, 1, 0, 0, true);
    expect(isBoardWon(boardMap([a, b]))).toBe(true);
  });

  it('returns false when any tile remains', () => {
    const a = tile(Suit.Dot, 1, 0, 0);
    const b = tile(Suit.Dot, 1, 1, 0, 0, true);
    expect(isBoardWon(boardMap([a, b]))).toBe(false);
  });
});

describe('findMatchingFreePartner', () => {
  it('finds a free matching partner', () => {
    const a = tile(Suit.Flower, 1, 0, 0);
    const b = tile(Suit.Flower, 3, 2, 0);
    const board = boardMap([a, b]);
    const partner = findMatchingFreePartner(a, board, 2);
    expect(partner).not.toBeNull();
    expect(partner!.id).toBe(b.id);
  });

  it('returns null when the only match is not free', () => {
    const a = tile(Suit.Character, 4, 1, 0);
    const blocked = tile(Suit.Character, 4, 0, 0);
    const blocker = tile(Suit.Dot, 1, 2, 0);
    const board = boardMap([a, blocked, blocker]);
    // blocked is between a and blocker → blocked is not free.
    expect(isTileFree(blocked, board, 2)).toBe(false);
    expect(findMatchingFreePartner(a, board, 2)).toBeNull();
  });
});

describe('listFreeTiles', () => {
  it('returns free tiles sorted by (y, x, z)', () => {
    // Tiles at x=0, 2, 4 are isolated (gaps at 1 and 3) so all are free.
    const a = tile(Suit.Dot, 1, 0, 0);
    const b = tile(Suit.Dot, 2, 2, 0);
    const c = tile(Suit.Dot, 3, 4, 0);
    const board = boardMap([a, b, c]);
    const ids = listFreeTiles(board, 4).map((t) => t.id);
    expect(ids).toEqual([a.id, b.id, c.id]);
  });

  it('sorts by y before x', () => {
    const a = tile(Suit.Dot, 1, 0, 1); // row 1
    const b = tile(Suit.Dot, 2, 0, 0); // row 0
    const ids = listFreeTiles(boardMap([a, b]), 0).map((t) => t.id);
    expect(ids).toEqual([b.id, a.id]);
  });

  it('excludes matched tiles', () => {
    const matched = tile(Suit.Dot, 1, 0, 0, 0, true);
    const free = tile(Suit.Dot, 2, 2, 0);
    const ids = listFreeTiles(boardMap([matched, free]), 2).map((t) => t.id);
    expect(ids).toEqual([free.id]);
  });
});
