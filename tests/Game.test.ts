import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Game } from '../src/Game';
import { GameState } from '../src/GameState';
import { Suit, type SolitaireTile } from '../src/GameLogic';

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

describe('Game', () => {
  beforeEach(() => {
    idCounter = 0;
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts in MENU before newGame', () => {
    const g = new Game();
    expect(g.state).toBe(GameState.MENU);
    expect(g.remaining).toBe(0);
  });

  it('newGame moves to PLAYING and populates remaining', () => {
    const g = new Game();
    const tiles = [tile(Suit.Dot, 1, 0, 0), tile(Suit.Dot, 2, 2, 0)];
    g.newGame(tiles, 2);
    expect(g.state).toBe(GameState.PLAYING);
    expect(g.remaining).toBe(2);
  });

  it('assigns fresh ids when tiles share a default id of 0', () => {
    const g = new Game();
    const tiles = [
      { ...tile(Suit.Dot, 1, 0, 0), id: 0 },
      { ...tile(Suit.Dot, 2, 2, 0), id: 0 },
    ];
    g.newGame(tiles, 2);
    const ids = [...g.boardView.values()].map((t) => t.id);
    expect(ids[0]).not.toBe(ids[1]);
    expect(ids.every((id) => id > 0)).toBe(true);
  });

  it('selects a free tile on first click', () => {
    const g = new Game();
    const a = tile(Suit.Dot, 1, 0, 0);
    g.newGame([a, tile(Suit.Dot, 1, 2, 0)], 2);
    const res = g.select(0, 0, 0);
    expect(res.ok).toBe(true);
    expect(res.reason).toBe('selected');
    expect(g.selectedTile?.id).toBe(a.id);
    expect(g.remaining).toBe(2); // nothing removed yet
  });

  it('deselects when clicking the selected tile again', () => {
    const g = new Game();
    g.newGame([tile(Suit.Dot, 1, 0, 0), tile(Suit.Dot, 1, 2, 0)], 2);
    g.select(0, 0, 0);
    const res = g.select(0, 0, 0);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('selected');
    expect(g.selectedTile).toBeNull();
  });

  it('matches two free matching tiles and marks them removed', () => {
    const g = new Game();
    const a = tile(Suit.Dot, 1, 0, 0);
    const b = tile(Suit.Dot, 1, 2, 0);
    g.newGame([a, b], 2);
    g.select(0, 0, 0); // select a
    const res = g.select(2, 0, 0); // match b
    expect(res.ok).toBe(true);
    expect(res.reason).toBe('matched');
    expect(res.removed.map((t) => t.id).sort()).toEqual([a.id, b.id].sort());
    expect(g.remaining).toBe(0);
    expect(g.removedTiles).toHaveLength(2);
  });

  it('swaps selection when clicking a different non-matching free tile', () => {
    const g = new Game();
    const a = tile(Suit.Dot, 1, 0, 0);
    const b = tile(Suit.Dot, 2, 2, 0);
    g.newGame([a, b], 2);
    g.select(0, 0, 0); // select a
    const res = g.select(2, 0, 0); // click b (no match)
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('selected');
    expect(g.selectedTile?.id).toBe(b.id);
    expect(g.remaining).toBe(2);
  });

  it('matches flowers of different ranks', () => {
    const g = new Game();
    const f1 = tile(Suit.Flower, 1, 0, 0);
    const f2 = tile(Suit.Flower, 4, 2, 0);
    g.newGame([f1, f2], 2);
    g.select(0, 0, 0);
    const res = g.select(2, 0, 0);
    expect(res.ok).toBe(true);
    expect(res.reason).toBe('matched');
    expect(g.remaining).toBe(0);
  });

  it('does not match a flower with a season', () => {
    const g = new Game();
    const f = tile(Suit.Flower, 1, 0, 0);
    const s = tile(Suit.Season, 1, 2, 0);
    g.newGame([f, s], 2);
    g.select(0, 0, 0);
    const res = g.select(2, 0, 0);
    expect(res.ok).toBe(false);
    expect(g.remaining).toBe(2);
  });

  it('rejects selecting a blocked (buried) tile', () => {
    const g = new Game();
    const left = tile(Suit.Dot, 1, 0, 0);
    const target = tile(Suit.Dot, 9, 1, 0);
    const right = tile(Suit.Dot, 2, 2, 0);
    g.newGame([left, target, right], 2);
    const res = g.select(1, 0, 0); // target is sandwiched → blocked
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('not-free');
    expect(g.selectedTile).toBeNull();
  });

  it('detects WON when the last pair is matched', () => {
    const g = new Game();
    g.newGame([tile(Suit.Dot, 1, 0, 0), tile(Suit.Dot, 1, 2, 0)], 2);
    g.select(0, 0, 0);
    g.select(2, 0, 0);
    expect(g.remaining).toBe(0);
    // tick should promote the finished board to WON.
    const outcome = g.tick(16);
    expect(outcome).toBe('won');
    expect(g.state).toBe(GameState.WON);
    expect(g.won).toBe(true);
  });

  it('detects LOST when no moves remain', () => {
    const g = new Game();
    // Two free, non-matching tiles and nothing else → no valid move.
    g.newGame([tile(Suit.Dot, 1, 0, 0), tile(Suit.Dot, 2, 2, 0)], 2);
    const outcome = g.tick(16);
    expect(outcome).toBe('lost');
    expect(g.state).toBe(GameState.LOST);
    expect(g.lost).toBe(true);
  });

  it('tick returns none while moves remain', () => {
    const g = new Game();
    // A single free tile that matches nothing → no move, so this would be lost.
    // Use a layout with a real available move instead.
    g.newGame([tile(Suit.Dot, 1, 0, 0), tile(Suit.Dot, 1, 2, 0)], 2);
    expect(g.tick(16)).toBe('none');
  });

  it('fade-out removes matched tiles from removedTiles after fadeDurationMs', () => {
    const g = new Game({ fadeDurationMs: 100 });
    g.newGame([tile(Suit.Dot, 1, 0, 0), tile(Suit.Dot, 1, 2, 0)], 2);
    g.select(0, 0, 0);
    g.select(2, 0, 0);
    expect(g.removedTiles).toHaveLength(2);
    g.tick(60); // partial fade
    expect(g.removedTiles).toHaveLength(2);
    g.tick(60); // cumulative 120ms > 100ms → pruned
    expect(g.removedTiles).toHaveLength(0);
  });

  it('shuffle reassigns positions and keeps remaining count', () => {
    const g = new Game();
    const tiles = [
      tile(Suit.Dot, 1, 0, 0),
      tile(Suit.Dot, 2, 2, 0),
      tile(Suit.Character, 3, 4, 0),
    ];
    g.newGame(tiles, 4);
    const before = g.remaining;
    g.shuffle();
    expect(g.remaining).toBe(before);
    expect(g.state).toBe(GameState.PLAYING);
    expect(g.selectedTile).toBeNull();
  });

  it('shuffle keeps x/y footprint (slots preserved)', () => {
    const g = new Game();
    const tiles = [tile(Suit.Dot, 1, 0, 0), tile(Suit.Dot, 2, 2, 0)];
    g.newGame(tiles, 4);
    g.shuffle();
    const slots = [...g.boardView.values()].map((t) => `${t.x},${t.y}`).sort();
    expect(slots).toEqual(['0,0', '2,0']);
  });

  it('shuffle ignores matched tiles', () => {
    const g = new Game();
    const a = tile(Suit.Dot, 1, 0, 0);
    const b = tile(Suit.Dot, 1, 2, 0);
    g.newGame([a, b], 2);
    g.select(0, 0, 0);
    g.select(2, 0, 0); // both matched, remaining = 0
    g.shuffle();
    expect(g.remaining).toBe(0);
  });

  it('does not allow selection when not PLAYING', () => {
    const g = new Game();
    const a = tile(Suit.Dot, 1, 0, 0);
    g.newGame([a, tile(Suit.Dot, 1, 2, 0)], 2);
    // Force terminal state by winning, then attempt a select.
    g.select(0, 0, 0);
    g.select(2, 0, 0);
    g.tick(16); // -> WON
    const res = g.select(0, 0, 0);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('not-playing');
  });

  it('freeTiles returns exposed free tiles', () => {
    const g = new Game();
    g.newGame([tile(Suit.Dot, 1, 0, 0), tile(Suit.Dot, 1, 2, 0)], 2);
    const free = g.freeTiles();
    expect(free).toHaveLength(2);
  });
});
