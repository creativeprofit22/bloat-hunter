# Bloat Hunter

<p align="center">
  <strong>Find and eliminate disk bloat on Windows.</strong><br>
  System junk, browser caches, duplicate files, stale data — all in one tool with a clean visual interface and optional AI advisory.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

---

## What is Bloat Hunter?

A desktop app that finds wasted disk space and helps you reclaim it safely. Combines the visual UX of Czkawka (grouped results, preview, smart selection) with the cleanup knowledge of BleachBit (system junk rules, browser caches). An optional AI advisory layer explains what's safe to delete and why.

**Built by [Douro Digital](https://wearedouro.agency)** — open source under the MIT license.

**Key principles:**

- **Safe by default** — files go to Recycle Bin unless you choose otherwise
- **Transparent** — every finding shows what it is, where it came from, and the risk level
- **No surprises** — confirmation dialogs before any destructive action
- **AI is optional** — the app works fully without any API key configured

---

## Features

| Scanner | What it finds |
|---|---|
| **System Junk** | Windows temp files, caches, logs, crash dumps, update leftovers |
| **Browser Cache** | Chrome, Edge, Firefox, Brave, Opera — cache, cookies, history, sessions |
| **Duplicate Files** | Fast hash-based detection (size grouping + partial hash + full hash) |
| **Big Files** | The largest files eating your disk space |
| **Empty Items** | Zero-byte files and empty directories |
| **Stale Files** | Files untouched for months or years |
| **App Leftovers** | Orphaned data from uninstalled programs |
| **Registry** | MRU lists, shell history, typed paths |

### AI Advisor (Optional)

Connect your own API key (Claude, OpenAI, or local Ollama) to get:

- **Scan analysis** — AI summary of what was found and what's safe to clean
- **Risk explanations** — hover any item for an AI-generated explanation
- **Smart recommendations** — prioritized cleanup advice based on your scan results

---

## Screenshots

> Screenshots will be added after the first release.

---

## Getting Started

```bash
git clone https://github.com/douro-digital/bloat-hunter.git
cd bloat-hunter
bun install
bun run dev
```

### Prerequisites

- [Bun](https://bun.sh) (package manager)
- Windows 10/11 (primary target — scanners use Windows-specific paths)

---

## Scripts

| Command | What it does |
|---|---|
| `bun run dev` | Start dev server with HMR + Electron |
| `bun run build` | Production build |
| `bun run check` | Full CI gate: typecheck + lint + format check + tests |
| `bun run test` | Run tests with Vitest |
| `bun run lint` | ESLint check |
| `bun run format` | Prettier format |
| `bun run package:win` | Package for Windows (NSIS installer + portable) |

---

## Architecture

```
renderer (React) → preload (contextBridge) → main (Node.js) → worker threads
```

- **Scanners** run in Worker Threads — never block the main process
- **JSON rule engine** for declarative cleanup targets — no hardcoded paths
- **IPC bridge** keeps renderer sandboxed with `contextIsolation: true`
- **Encrypted storage** for API keys using Electron's `safeStorage` (Windows DPAPI)
- **No native addons** — pure TypeScript + WASM (xxhash)

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Electron 40 |
| Renderer | React 19 + Vite 7 |
| Language | TypeScript 5.9 (strict) |
| State | Zustand |
| Hashing | xxhash-wasm (fast) + SHA-256 (fallback) |
| Thumbnails | Sharp |
| Bundler | esbuild (main/preload) + Vite (renderer) |
| Testing | Vitest |
| Quality | ESLint 9 + Prettier 3 + Husky |
| Packaging | electron-builder (NSIS + portable) |

---

## Security

- `contextIsolation: true`, `nodeIntegration: false`
- Strict Content Security Policy in production
- API keys encrypted at rest via Electron `safeStorage`
- No telemetry, no analytics, no data collection

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run `bun run check` to ensure all checks pass
5. Submit a pull request

---

## License

[MIT](LICENSE)

---

<p align="center">
  Built with care by <a href="https://wearedouro.agency"><strong>Douro Digital</strong></a>
</p>
