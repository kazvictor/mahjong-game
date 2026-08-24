# Mahjong Game

A browser-based Mahjong game built with **vanilla TypeScript** and the **Canvas
API**. No framework dependencies — the game loop, tile logic, and renderer are
all hand-written against the standard web platform, giving full control over
performance and behavior.

## Status

This is the **Phase 1 scaffold**. It establishes the repository structure and
build system. The app currently boots a requestAnimationFrame game loop and
draws a placeholder board to the canvas so the pipeline is verifiable
end-to-end.

## Tech Stack

- **TypeScript** — strict mode, all game code
- **Vite** — dev server with HMR and production bundling
- **Canvas API** — rendering
- **Node.js** >= 18

## Project Structure

```
mahjong-game/
├── index.html          # HTML entry, hosts the <canvas>
├── public/             # Static assets served as-is
├── src/
│   ├── main.ts         # Bootstrap: canvas + game loop
│   ├── style.css       # Global styles
│   ├── core/           # Framework-agnostic domain logic (pure TS)
│   │   ├── types.ts    # Core types (Tile, Suit, Hand)
│   │   └── tiles.ts    # Tile-set construction and labels
│   └── engine/         # Rendering and loop infrastructure
│       ├── game-loop.ts # requestAnimationFrame loop
│       └── renderer.ts  # Canvas renderer
└── tests/              # Reserved for unit tests (runner TBD)
```

## Getting Started

Prerequisites: [Node.js](https://nodejs.org/) v18 or newer.

```bash
# Install dependencies
npm install

# Start the dev server (http://localhost:5173)
npm run dev

# Type-check only
npm run typecheck

# Production build (emits to dist/)
npm run build

# Preview the production build locally
npm run preview
```

## Scripts

| Script           | Description                                  |
| ---------------- | -------------------------------------------- |
| `npm run dev`    | Start the Vite dev server with HMR           |
| `npm run build`  | Type-check, then build the production bundle |
| `npm run preview`| Serve the production build locally           |
| `npm run typecheck` | Run `tsc --noEmit` only                  |

## Roadmap

- [x] Repository scaffold and build system
- [ ] Tile rendering with real tile art
- [ ] Tile wall / deal logic
- [ ] Hand evaluation and win detection
- [ ] Turn-based play UI
