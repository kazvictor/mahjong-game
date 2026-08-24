import { describe, expect, it } from 'vitest';
import { Suit } from '../src/GameLogic';
import { buildTurtleBoard } from '../src/boardBuilder';

describe('buildTurtleBoard', () => {
  it('produces 68 tiles (34 pairs)', () => {
    const { tiles } = buildTurtleBoard();
    expect(tiles.length).toBe(68);
  });

  it('assigns unique, non-zero ids', () => {
    const { tiles } = buildTurtleBoard();
    const ids = new Set(tiles.map((t) => t.id));
    expect(ids.size).toBe(tiles.length);
    expect([...ids]).not.toContain(0);
  });

  it('builds every value as exactly one matching pair (2 copies)', () => {
    const { tiles } = buildTurtleBoard();
    const counts = new Map<string, number>();
    for (const t of tiles) {
      const key = t.suit === Suit.Flower || t.suit === Suit.Season ? t.suit : `${t.suit}:${t.rank}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const [key, count] of counts) {
      expect(count, `value ${key} should appear exactly twice`).toBe(2);
    }
  });

  it('covers all 34 distinct suited/honor values', () => {
    const { tiles } = buildTurtleBoard();
    const keys = new Set(
      tiles.map((t) => (t.suit === Suit.Flower || t.suit === Suit.Season ? t.suit : `${t.suit}:${t.rank}`)),
    );
    // 3 suits x 9 ranks = 27 suited + 7 honor = 34 distinct values.
    expect(keys.size).toBe(34);
  });

  it('places tiles in stacks where only the top (z=1) tile is side-free', () => {
    const { tiles } = buildTurtleBoard();
    const byPos = new Map(tiles.map((t) => [`${t.x},${t.y},${t.z}`, t]));

    for (const t of tiles) {
      // Column spacing is 2, so no tile has a side neighbour at the same z.
      const left = byPos.get(`${t.x - 1},${t.y},${t.z}`);
      const right = byPos.get(`${t.x + 1},${t.y},${t.z}`);
      expect(left, `tile ${t.id} should have no left neighbour`).toBeUndefined();
      expect(right, `tile ${t.id} should have no right neighbour`).toBeUndefined();

      // Every bottom tile has a tile directly on top (stack of exactly 2).
      const above = byPos.get(`${t.x},${t.y},${t.z + 1}`);
      if (t.z === 0) {
        expect(above, `bottom tile ${t.id} should have a tile above`).toBeDefined();
      } else {
        expect(above).toBeUndefined();
      }
    }
  });

  it('reports a maxX footprint usable by the controller', () => {
    const { maxX } = buildTurtleBoard();
    expect(maxX).toBeGreaterThanOrEqual(10);
  });
});
