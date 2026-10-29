# Sliding Cubes

A computational geometry playground built with Next.js 16 and React 19.

## Development

Use Node.js 24, then run these commands from `sliding-cubes/`:

```sh
npm ci
npm run dev
```

## Validation

```sh
npm test
npm run lint
npm run build
```

Google Fonts compilation requires access to `fonts.googleapis.com` and `fonts.gstatic.com` through the environment's configured proxy.

## Implemented milestone

- Playable 2D square reconfiguration on an expandable integer grid.
- Slides supported by two stationary neighbours and rotations around a pivot with an empty swept corner.
- Side connectivity of stationary modules checked before every move.
- Target overlay, legal destinations, support inspection, move explanations, move count, undo/redo, reset, and four curated levels.
- Keyboard access: Tab to squares/destinations, Enter or Space to select.

`src/geometry/rules.ts` contains the rendering-independent rules. Tests cover geometry, connectivity, reversibility, invalid moves, goals, and exhaustive small-level reachability. Breadth-first search in the tests only validates curated levels; it is not the constructive algorithm described in the proposal.

`src/components/Playground.tsx` owns interaction/history; `src/levels/levels.ts` defines puzzles.

## Next milestones

Consult the original papers to confirm the formal movement model before implementing their algorithms. The 3D viewer and in-place constraints, paper-based constructive solvers, validated hints, animated solution playback, and guided tutorial are not implemented yet. The first milestone makes no solver completeness or shortest-path claim.
