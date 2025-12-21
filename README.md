# Bloat Hunter

**Hunt down disk bloat across all platforms.**

Bloat Hunter is a cross-platform CLI tool that finds and safely removes caches, build artifacts, and other space-wasting files from your disk.

## Features

- **Cross-Platform**: Works on Windows, macOS, Linux, and WSL
- **Smart Detection**: Finds node_modules, __pycache__, build artifacts, and more
- **Duplicate Finder**: Hash-based duplicate file detection with configurable keep strategies
- **Safe by Default**: Uses recycle bin, never deletes protected paths
- **Interactive**: Preview before deleting, select specific targets
- **Fast**: Efficient scanning with progress indicators, xxhash for duplicate detection

## Installation

```bash
# With pip
pip install bloat-hunter

# With pipx (recommended)
pipx install bloat-hunter
```

## Quick Start

```bash
# Scan current directory
bloat-hunter scan

# Scan a specific path
bloat-hunter scan /path/to/projects

# Deep scan (slower, finds more)
bloat-hunter scan --deep

# Clean up (dry-run by default)
bloat-hunter clean

# Actually delete (moves to trash)
bloat-hunter clean --execute

# Permanent deletion (use with caution)
bloat-hunter clean --execute --permanent
```

## Commands

### `scan`

Scan a directory for bloat and caches.

```bash
bloat-hunter scan [PATH] [OPTIONS]

Options:
  -d, --deep     Perform deep scan (slower but finds more)
  -a, --all      Show all findings, not just top offenders
```

### `clean`

Clean up bloat and caches from a directory.

```bash
bloat-hunter clean [PATH] [OPTIONS]

Options:
  --dry-run/--execute    Preview changes without deleting (default: dry-run)
  --trash/--permanent    Move to trash or permanently delete (default: trash)
  -i/-y                  Interactive selection or auto-select all
```

### `duplicates`

Find and remove duplicate files.

```bash
bloat-hunter duplicates [PATH] [OPTIONS]

Options:
  -s, --min-size TEXT    Minimum file size to consider (default: 1MB)
  --dry-run/--execute    Preview changes without deleting (default: dry-run)
  --trash/--permanent    Move to trash or permanently delete (default: trash)
  -k, --keep TEXT        Which file to keep: first, shortest, oldest, newest
  -a, --all              Show all duplicate groups (default: top 20)
  --interactive/--auto   Select groups to clean or auto-select all
```

Uses fast xxhash hashing with a two-phase approach: first groups files by size, then hashes only candidates.

### `info`

Show system and platform information.

```bash
bloat-hunter info
```

## What Gets Detected

| Category | Patterns | Safe Level |
|----------|----------|------------|
| Python | `__pycache__`, `.pytest_cache`, `.mypy_cache`, `.venv`, `.tox` | Safe |
| Node.js | `node_modules`, `.next`, `.nuxt`, `.parcel-cache` | Safe |
| Build | `build/`, `dist/`, `target/` (Rust) | Caution |
| IDE | `.idea/`, `.vscode/` | Caution |
| System | `.DS_Store`, `Thumbs.db` | Safe |

## Safety

Bloat Hunter is designed with safety in mind:

- **Protected Paths**: System directories, home folders, and credentials are never touched
- **Trash First**: Files go to recycle bin by default, not permanent deletion
- **Dry Run Default**: `clean` command previews changes unless you use `--execute`
- **Project Root Detection**: Won't delete directories containing `package.json`, `pyproject.toml`, etc.

## WSL Support

When running in WSL, Bloat Hunter:

- Detects your WSL distro automatically
- Can scan both Linux and Windows paths (`/mnt/c/Users/...`)
- Respects Windows system paths

## Development

```bash
# Clone the repo
git clone https://github.com/creativeprofit22/bloat-hunter.git
cd bloat-hunter

# Install in development mode
pip install -e ".[dev]"

# Run tests
pytest

# Run linting
ruff check src/
mypy src/
```

## License

This project is dual-licensed:

- **Free for personal/non-commercial use**: [PolyForm Noncommercial License 1.0.0](LICENSE)
- **Commercial use**: [Contact for commercial license](LICENSE-COMMERCIAL.md)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

Made with determination to hunt down every last byte of bloat.
