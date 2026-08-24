/**
 * GameState.ts — Finite state machine for the Mahjong solitaire game.
 *
 * The game lives in exactly one of the states below at any moment. Transitions
 * are validated against a fixed transition table so illegal jumps (e.g. a
 * WON game restarting as PAUSED) are impossible by construction. Keeping the
 * state machine tiny and pure makes it trivial to unit-test and safe for the
 * controller (Game.ts) and renderer to share.
 */

/** The set of states a game can be in. */
export enum GameState {
  /** Main menu / pre-game screen. */
  MENU = 'MENU',
  /** Actively accepting input and advancing turns. */
  PLAYING = 'PLAYING',
  /** Frozen mid-game (e.g. menu overlay opened). */
  PAUSED = 'PAUSED',
  /** Every tile has been matched — the player won. */
  WON = 'WON',
  /** No valid moves remain — the player lost. */
  LOST = 'LOST',
}

/** States that are terminal — once reached, no further transition is allowed. */
const TERMINAL_STATES: ReadonlySet<GameState> = new Set([GameState.WON, GameState.LOST]);

/** States that are "in a live game" (input is meaningful here). */
export const ACTIVE_PLAY_STATES: ReadonlySet<GameState> = new Set([
  GameState.PLAYING,
  GameState.PAUSED,
]);

/**
 * The transition table. `from` → allowed `to` states. Anything not listed here
 * is rejected by {@link GameStateMachine.transition}.
 */
const TRANSITIONS: Readonly<Record<GameState, ReadonlySet<GameState>>> = {
  [GameState.MENU]: new Set([GameState.PLAYING]),
  [GameState.PLAYING]: new Set([GameState.PAUSED, GameState.WON, GameState.LOST]),
  [GameState.PAUSED]: new Set([GameState.PLAYING]),
  [GameState.WON]: new Set(),
  [GameState.LOST]: new Set(),
};

/**
 * A small, dependency-free state machine.
 *
 * The machine only tracks *state* — it does not hold tile or game data. That
 * separation keeps the two concerns independently testable.
 */
export class GameStateMachine {
  private state: GameState;

  constructor(initial: GameState = GameState.MENU) {
    this.state = initial;
  }

  /** The current state. */
  get current(): GameState {
    return this.state;
  }

  /** True when the current state is one of {@link ACTIVE_PLAY_STATES}. */
  get isPlaying(): boolean {
    return ACTIVE_PLAY_STATES.has(this.state);
  }

  /** True when the game has concluded (won or lost). */
  get isOver(): boolean {
    return TERMINAL_STATES.has(this.state);
  }

  /**
   * Attempt a transition to `next`. Throws if the move is not permitted by the
   * transition table (including any transition out of a terminal state).
   *
   * @returns the newly entered state.
   * @throws {Error} if the transition is illegal.
   */
  transition(next: GameState): GameState {
    if (this.state === next) {
      // Staying put is always fine; it is a no-op rather than an error.
      return this.state;
    }
    const allowed = TRANSITIONS[this.state];
    if (!allowed.has(next)) {
      throw new Error(
        `Illegal state transition: ${this.state} → ${next}. ` +
          `Allowed from ${this.state}: ${[...allowed].join(', ') || '(none)'}.`,
      );
    }
    this.state = next;
    return this.state;
  }
}
