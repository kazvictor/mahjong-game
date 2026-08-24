import { Suit, type Tile } from '../core/types';

/**
 * Canvas-based renderer for the Mahjong game.
 *
 * This first version draws a simple placeholder board so the dev server and
 * build pipeline can be verified end-to-end with actual visible output. Tile
 * art will be layered on top of this in later phases.
 */
export class GameRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly width: number;
  private readonly height: number;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (ctx === null) {
      throw new Error('Canvas 2D context is not available.');
    }
    this.ctx = ctx;
    this.width = canvas.width;
    this.height = canvas.height;
  }

  /** Render the current frame. */
  render(): void {
    const { ctx } = this;

    // Clear and paint a backdrop.
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = '#0f3d2e';
    ctx.fillRect(0, 0, this.width, this.height);

    // Draw a simple placeholder "table" so something visible renders.
    ctx.fillStyle = '#1c5a44';
    ctx.fillRect(40, 120, this.width - 80, this.height - 240);

    ctx.fillStyle = '#e8e4d8';
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Mahjong Game', this.width / 2, 80);
  }

  /** Draw a tile at a given position (placeholder square for now). */
  drawTile(tile: Tile, x: number, y: number, size = 48): void {
    const { ctx } = this;
    const color =
      tile.suit === Suit.Character
        ? '#d8b4fe'
        : tile.suit === Suit.Bamboo
          ? '#86efac'
          : tile.suit === Suit.Dot
            ? '#93c5fd'
            : '#fcd34d';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, size, size * 1.4);
    ctx.strokeStyle = '#333333';
    ctx.strokeRect(x, y, size, size * 1.4);
    ctx.fillStyle = color;
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(tile.rank), x + size / 2, y + (size * 1.4) / 2);
  }
}
