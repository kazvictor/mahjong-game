import { describe, it, expect } from 'vitest';
import { GameState, GameStateMachine, ACTIVE_PLAY_STATES } from '../src/GameState';

describe('GameStateMachine', () => {
  it('starts in MENU by default', () => {
    const m = new GameStateMachine();
    expect(m.current).toBe(GameState.MENU);
  });

  it('starts in a provided state', () => {
    const m = new GameStateMachine(GameState.PLAYING);
    expect(m.current).toBe(GameState.PLAYING);
  });

  it('allows MENU → PLAYING', () => {
    const m = new GameStateMachine(GameState.MENU);
    m.transition(GameState.PLAYING);
    expect(m.current).toBe(GameState.PLAYING);
  });

  it('allows PLAYING → PAUSED → PLAYING', () => {
    const m = new GameStateMachine(GameState.PLAYING);
    m.transition(GameState.PAUSED);
    expect(m.current).toBe(GameState.PAUSED);
    m.transition(GameState.PLAYING);
    expect(m.current).toBe(GameState.PLAYING);
  });

  it('allows PLAYING → WON and PLAYING → LOST', () => {
    const won = new GameStateMachine(GameState.PLAYING);
    won.transition(GameState.WON);
    expect(won.current).toBe(GameState.WON);

    const lost = new GameStateMachine(GameState.PLAYING);
    lost.transition(GameState.LOST);
    expect(lost.current).toBe(GameState.LOST);
  });

  it('rejects MENU → PAUSED', () => {
    const m = new GameStateMachine(GameState.MENU);
    expect(() => m.transition(GameState.PAUSED)).toThrow(/Illegal state transition/);
  });

  it('rejects MENU → WON (must play first)', () => {
    const m = new GameStateMachine(GameState.MENU);
    expect(() => m.transition(GameState.WON)).toThrow(/Illegal state transition/);
  });

  it('rejects PLAYING → MENU', () => {
    const m = new GameStateMachine(GameState.PLAYING);
    expect(() => m.transition(GameState.MENU)).toThrow(/Illegal state transition/);
  });

  it('rejects PAUSED → WON (must resume to playing first)', () => {
    const m = new GameStateMachine(GameState.PAUSED);
    expect(() => m.transition(GameState.WON)).toThrow(/Illegal state transition/);
  });

  it('rejects any transition out of WON', () => {
    const m = new GameStateMachine(GameState.WON);
    expect(() => m.transition(GameState.PLAYING)).toThrow(/Illegal state transition/);
    expect(() => m.transition(GameState.MENU)).toThrow(/Illegal state transition/);
  });

  it('rejects any transition out of LOST', () => {
    const m = new GameStateMachine(GameState.LOST);
    expect(() => m.transition(GameState.PLAYING)).toThrow(/Illegal state transition/);
    expect(() => m.transition(GameState.PAUSED)).toThrow(/Illegal state transition/);
  });

  it('transitioning to the same state is a no-op (does not throw)', () => {
    const m = new GameStateMachine(GameState.PLAYING);
    expect(() => m.transition(GameState.PLAYING)).not.toThrow();
    expect(m.current).toBe(GameState.PLAYING);
  });

  it('isPlaying reflects active play states', () => {
    expect(new GameStateMachine(GameState.PLAYING).isPlaying).toBe(true);
    expect(new GameStateMachine(GameState.PAUSED).isPlaying).toBe(true);
    expect(new GameStateMachine(GameState.MENU).isPlaying).toBe(false);
    expect(new GameStateMachine(GameState.WON).isPlaying).toBe(false);
    expect(new GameStateMachine(GameState.LOST).isPlaying).toBe(false);
  });

  it('isOver reflects terminal states', () => {
    expect(new GameStateMachine(GameState.WON).isOver).toBe(true);
    expect(new GameStateMachine(GameState.LOST).isOver).toBe(true);
    expect(new GameStateMachine(GameState.PLAYING).isOver).toBe(false);
    expect(new GameStateMachine(GameState.MENU).isOver).toBe(false);
  });

  it('ACTIVE_PLAY_STATES contains exactly PLAYING and PAUSED', () => {
    expect([...ACTIVE_PLAY_STATES].sort()).toEqual([GameState.PAUSED, GameState.PLAYING]);
  });
});
