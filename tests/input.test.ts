import { describe, expect, it } from 'vitest';
import {
  defaultKeyBinding,
  pickTileAt,
  type TileHitArea,
} from '../src/InputHandler';

function area(partial: Partial<TileHitArea> & Pick<TileHitArea, 'id'>): TileHitArea {
  return {
    x: 0,
    y: 0,
    z: 0,
    px: 0,
    py: 0,
    w: 56,
    h: 68,
    ...partial,
  };
}

describe('pickTileAt', () => {
  const areas: TileHitArea[] = [
    area({ id: 1, x: 0, y: 0, z: 0, px: 10, py: 10 }),
    area({ id: 2, x: 0, y: 0, z: 1, px: 10, py: 10 }),
    area({ id: 3, x: 2, y: 0, z: 0, px: 200, py: 10 }),
  ];

  it('returns null when the point is not inside any tile', () => {
    expect(pickTileAt(0, 0, areas)).toBeNull();
  });

  it('picks the top-most (highest z) tile under the cursor', () => {
    // id 1 and id 2 overlap at (30, 30); id 2 has higher z.
    expect(pickTileAt(30, 30, areas)?.id).toBe(2);
  });

  it('returns the only tile that contains the point', () => {
    expect(pickTileAt(210, 20, areas)?.id).toBe(3);
  });

  it('handles an empty area list', () => {
    expect(pickTileAt(50, 50, [])).toBeNull();
  });
});

describe('defaultKeyBinding', () => {
  function key(k: string): KeyboardEvent {
    return { key: k } as KeyboardEvent;
  }

  it('maps S to shuffle while playing', () => {
    expect(defaultKeyBinding(key('s'), true)).toEqual({ kind: 'shuffle' });
    expect(defaultKeyBinding(key('S'), true)).toEqual({ kind: 'shuffle' });
  });

  it('does not shuffle while not playing', () => {
    expect(defaultKeyBinding(key('s'), false)).toBeNull();
  });

  it('maps R to restart regardless of playing state', () => {
    expect(defaultKeyBinding(key('r'), true)).toEqual({ kind: 'restart' });
    expect(defaultKeyBinding(key('r'), false)).toEqual({ kind: 'restart' });
  });

  it('maps ESC to toggle-pause while playing', () => {
    expect(defaultKeyBinding(key('Escape'), true)).toEqual({ kind: 'toggle-pause' });
  });

  it('ignores ESC while not playing', () => {
    expect(defaultKeyBinding(key('Escape'), false)).toBeNull();
  });

  it('ignores unrelated keys', () => {
    expect(defaultKeyBinding(key('a'), true)).toBeNull();
    expect(defaultKeyBinding(key(' '), true)).toBeNull();
  });
});
