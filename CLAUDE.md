# Bloat Hunter

Electron desktop app for finding and eliminating disk bloat on Windows. Declarative JSON cleanup rules with an optional AI advisory layer.

## Tech Stack
- **Runtime:** Electron 40 + React 19 + TypeScript 5.9
- **Bundling:** Vite 7 (renderer) + esbuild (main/preload)
- **Package Manager:** Bun
- **State:** Zustand · **Hashing:** xxhash-wasm · **Testing:** Vitest
- **Quality:** ESLint 9 + Prettier 3 · **Hooks:** Husky + lint-staged

## Commands
```bash
bun run dev          # Dev server + Electron
bun run build        # Production build
bun run typecheck    # tsc --noEmit
bun run lint         # ESLint (src/ tests/)
bun run lint:fix     # ESLint auto-fix
bun run format       # Prettier write
bun run format:check # Prettier check
bun run test         # Vitest run
bun run check        # Full CI gate (typecheck + lint + format + test)
bun run package:win  # Package for Windows (NSIS + portable)
```

## Project Structure
```
src/
├── main/
│   ├── index.ts              # App lifecycle, window management
│   ├── ipc.ts                # IPC handler registry
│   ├── ai/                   # AI advisory layer (optional)
│   ├── settings/             # Settings management
│   ├── cleaners/             # Delete, move, recycle-bin, service management
│   └── scanners/             # Worker-based file scanners
│       ├── types.ts          # Shared scanner interfaces
│       ├── base-scanner.ts   # Abstract base class
│       ├── worker-manager.ts # Worker thread lifecycle
│       ├── rule-engine.ts    # JSON rule parser + executor
│       ├── system-junk/      # Temp, cache, logs, WER, prefetch
│       ├── browser-cache/    # Chrome, Edge, Firefox, Brave, Opera
│       ├── duplicates/       # Hash-based duplicate detection
│       ├── big-files/        # Top N largest files
│       ├── empty-items/      # Empty dirs + zero-byte files
│       ├── stale-files/      # Files not accessed/modified in N months
│       ├── app-leftovers/    # Orphaned app data from uninstalled programs
│       └── registry/         # MRU lists, shell history, privacy cleanup
├── preload/
│   └── index.ts              # contextBridge API surface
└── renderer/
    ├── App.tsx               # Root component
    ├── components/
    │   ├── layout/           # Sidebar, Header, StatusBar, AppLayout
    │   ├── dashboard/        # ScanSummary, SpaceBreakdown, QuickActions
    │   ├── results/          # ResultsTable, ResultGroup, FileRow, SelectionMenu
    │   ├── preview/          # FileInfo, ImagePreview, CompareView
    │   ├── ai/               # AI advisory UI
    │   ├── settings/         # Settings panel
    │   └── common/           # ConfirmDialog, CleanProgress
    ├── hooks/                # useScanner, useSelection, usePreview, useCleaner
    ├── store/                # Zustand stores (scan, ui, settings)
    └── styles/               # CSS
tests/unit/                   # Mirrors source structure
```

## Architecture
- Scanners run in **Worker Threads** (never block main process)
- **IPC flow:** renderer → preload → main → worker → main → renderer
- JSON rule engine for declarative cleanup targets (no hardcoded paths)
- AI layer is optional — app works fully without any API key

## Organization Rules
- Scanners → `src/main/scanners/<type>/`, each extends BaseScanner
- Components → `src/renderer/components/<domain>/`
- Hooks → `src/renderer/hooks/`, Stores → `src/renderer/store/`
- Types → co-located with usage, shared types in `src/main/scanners/types.ts`
- No direct Node access in renderer — always go through preload
- IPC handlers in `src/main/ipc.ts`, exposed APIs in `src/preload/index.ts`

## Code Quality — Zero Tolerance

After editing ANY file, run:
```bash
bun run typecheck && bun run lint
```
Or full gate: `bun run check`

Fix ALL errors and warnings before continuing. No exceptions.

## Security
- `contextIsolation: true`, `nodeIntegration: false`
- Strict CSP in production (dev suppresses for Vite HMR)
- API keys stored via Electron safeStorage (encrypted at rest)

## Last Session (2026-03-01)
- Full 8-agent carrot verification complete — ALL findings resolved
- Fixed HIGH: process error handlers + Set→Record in Zustand store
- Fixed MEDIUM: sandbox enabled, React ErrorBoundary, WorkerMessage discriminated union, per-field selectors
- Fixed LOW: ESLint flat config + underscore ignore, IPC type guards, xxhash zero-pad
- Note: `as ScanRule[]` on JSON imports kept — `resolveJsonModule` infers `string` not literal unions, `satisfies` doesn't work
- Typecheck + lint + 115/115 tests pass clean
