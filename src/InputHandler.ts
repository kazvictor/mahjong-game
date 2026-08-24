/**
 * InputHandler.ts — Mouse and keyboard input for Mahjong solitaire.
 *
 * Responsibilities:
 *  - Translate mouse motion/click on the canvas into tile hover/select events.
 *  - Translate keyboard shortcuts (S / R / ESC) into game actions.
 *
 * The class is deliberately thin: it binds DOM listeners and forwards to
 * callbacks. The geometry is kept pure (see {@link pickTileAt}) so it can be
 * unit-tested without a DOM or a live canvas.
 *
 * Screen coordinates are resolved from the canvas using its CSS size and the
 * backing-store scale, so clicks line up with rendered tiles regardless of
 * devicePixelRatio or CSS scaling.
 */

/** A tile's axis-aligned screen rectangle, used for hit-testing. */
export interface TileHitArea {
  /** Stable tile id (used for hover deduplication). */
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Screen-space rectangle of the tile's rendered footprint. */
  readonly px: number;
  readonly py: number;
  readonly w: number;
  readonly h: number;
}

/** Actions the InputHandler can request. */
export type InputAction =
  | { readonly kind: 'tile-click'; readonly x: number; readonly y: number; readonly z: number }
  | { readonly kind: 'shuffle' }
  | { readonly kind: 'restart' }
  | { readonly kind: 'toggle-pause' };

/** Callbacks wired up by the UI layer. */
export interface InputCallbacks {
  /** Fired when a tile is clicked. */
  onAction: (action: InputAction) => void;
  /** Fired when the hovered tile changes (or becomes null). */
  onHover: (x: number | null, y: number | null, z: number | null) => void;
}

/** A single keydown mapped to an action, or null to ignore the key. */
export type KeyBinding = (event: KeyboardEvent, isPlaying: boolean) => InputAction | null;

/**
 * Pick the tile a screen point lands on, or null when no tile rectangle
 * contains the point.
 *
 * When several tile rectangles contain the same point (typical for stacked or
 * partially overlapping isometric tiles), the tile whose centre is nearest the
 * click point is chosen, with a higher `z` layer breaking ties. This matches
 * the visually-topmost tile under the cursor — i.e. the tile the user can
 * actually see and click.
 */
export function pickTileAt(
  mouseX: number,
  mouseY: number,
  areas: readonly TileHitArea[],
): TileHitArea | null {
  let best: TileHitArea | null = null;
  let bestDist = Infinity;

  for (const area of areas) {
    if (mouseX < area.px || mouseX > area.px + area.w) {
      continue;
    }
    if (mouseY < area.py || mouseY > area.py + area.h) {
      continue;
    }
    // Distance from the click point to this tile's centre.
    const cx = area.px + area.w / 2;
    const cy = area.py + area.h / 2;
    const dist = (mouseX - cx) * (mouseX - cx) + (mouseY - cy) * (mouseY - cy);
    const better =
      best === null ||
      dist < bestDist ||
      (dist === bestDist && area.z >= best.z);
    if (better) {
      best = area;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * Resolve the default keyboard bindings for the game.
 *
 *  - S → shuffle (only meaningful while playing)
 *  - R → restart (start a fresh game)
 *  - ESC → toggle pause/resume (only meaningful while playing)
 *
 * The returned binding is intentionally injectable so tests can substitute
 * their own key map.
 */
export function defaultKeyBinding(event: KeyboardEvent, isPlaying: boolean): InputAction | null {
  const key = event.key.toLowerCase();
  switch (key) {
    case 's':
      return isPlaying ? { kind: 'shuffle' } : null;
    case 'r':
      return { kind: 'restart' };
    case 'escape':
    case 'esc':
      return isPlaying ? { kind: 'toggle-pause' } : null;
    default:
      return null;
  }
}

/**
 * Binds mouse + keyboard listeners to a canvas and forwards meaningful events
 * to the provided callbacks. Call {@link destroy} to remove all listeners.
 */
export class InputHandler {
  private readonly areas: TileHitArea[] = [];
  private hoverId: number | null = null;
  private readonly onAction: InputCallbacks['onAction'];
  private readonly onHover: InputCallbacks['onHover'];
  private readonly getIsPlaying: () => boolean;
  private readonly keyBinding: KeyBinding;

  private readonly boundMouseMove = (event: MouseEvent): void => {
    this.handleMouseMove(event);
  };
  private readonly boundMouseClick = (event: MouseEvent): void => {
    this.handleMouseClick(event);
  };
  private readonly boundKeyDown = (event: KeyboardEvent): void => {
    this.handleKeyDown(event);
  };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    callbacks: InputCallbacks,
    options: { getIsPlaying?: () => boolean; keyBinding?: KeyBinding } = {},
  ) {
    this.onAction = callbacks.onAction;
    this.onHover = callbacks.onHover;
    this.getIsPlaying = options.getIsPlaying ?? (() => true);
    this.keyBinding = options.keyBinding ?? defaultKeyBinding;

    canvas.addEventListener('mousemove', this.boundMouseMove);
    canvas.addEventListener('click', this.boundMouseClick);
    window.addEventListener('keydown', this.boundKeyDown);
  }

  /**
   * Update the set of clickable tile rectangles. Called by the UI each frame
   * (or on state changes) so hover/click geometry stays in sync with the board.
   */
  setTileAreas(areas: readonly TileHitArea[]): void {
    this.areas.length = 0;
    this.areas.push(...areas);
  }

  /** Remove all DOM listeners. Safe to call once. */
  destroy(): void {
    this.canvas.removeEventListener('mousemove', this.boundMouseMove);
    this.canvas.removeEventListener('click', this.boundMouseClick);
    window.removeEventListener('keydown', this.boundKeyDown);
  }

  private handleMouseMove(event: MouseEvent): void {
    const hit = pickTileAt(this.toCanvasX(event), this.toCanvasY(event), this.areas);
    const id = hit?.id ?? null;
    if (id === this.hoverId) {
      return; // no change
    }
    this.hoverId = id;
    if (hit) {
      this.onHover(hit.x, hit.y, hit.z);
    } else {
      this.onHover(null, null, null);
    }
  }

  private handleMouseClick(event: MouseEvent): void {
    if (event.button !== 0) {
      return; // left click only
    }
    const hit = pickTileAt(this.toCanvasX(event), this.toCanvasY(event), this.areas);
    if (!hit) {
      return;
    }
    this.onAction({ kind: 'tile-click', x: hit.x, y: hit.y, z: hit.z });
  }

  /**
   * Convert a mouse event's viewport-space client coordinates into canvas
   * backing-store pixel coordinates. This accounts for:
   *  - The canvas's offset within the page (`getBoundingClientRect`).
   *  - Any CSS scaling vs. the backing store (`canvas.width / rect.width`).
   * Hit areas are stored in canvas pixels, so this keeps clicks aligned with
   * the rendered tiles regardless of layout or devicePixelRatio.
   */
  private toCanvasX(event: MouseEvent): number {
    const rect = this.canvas.getBoundingClientRect();
    return ((event.clientX - rect.left) / rect.width) * this.canvas.width;
  }

  private toCanvasY(event: MouseEvent): number {
    const rect = this.canvas.getBoundingClientRect();
    return ((event.clientY - rect.top) / rect.height) * this.canvas.height;
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.repeat) {
      return;
    }
    const target = event.target as HTMLElement | null;
    // Don't hijack typing into inputs/textareas.
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }
    const action = this.keyBinding(event, this.getIsPlaying());
    if (!action) {
      return;
    }
    event.preventDefault();
    this.onAction(action);
  }
}
