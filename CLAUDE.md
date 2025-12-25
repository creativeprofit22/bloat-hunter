# Bloat Hunter

Cross-platform disk cleanup CLI tool.

## Current Focus
Awaiting next task

## Feature Backlog
High Priority:
1. ~~Duplicate file detection~~ - DONE
2. ~~System cache scanning~~ - DONE
3. ~~Global package caches~~ - DONE (bloat-hunter packages command)

Medium Priority:
4. ~~Config file support~~ - DONE (bloat-hunter config init/show/path)
5. ~~Size thresholds CLI~~ - DONE (--min-size filter on scan/clean)
6. ~~Export results~~ - DONE (--output/-o and --format/-f on scan/duplicates/caches/packages)
7. Parallel scanning - concurrent.futures

Low Priority:
8. Windows native testing
9. Interactive TUI - full-screen mode
10. Watch mode - monitor for bloat

## Dev Commands
```bash
cd /mnt/e/bloat-hunter
uv run --extra dev pytest tests/ -v --no-cov -p no:capture
uv run mypy src/
uv run ruff check src/
bloat-hunter config show
```

## Last Session (2025-12-25)
Export results feature complete:
- Created `core/exporter.py` module with JSON/CSV export functions
- Added `--output/-o` and `--format/-f` flags to scan/duplicates/caches/packages commands
- Auto-detects format from file extension (.json/.csv)
- All 159 tests pass

## Next Steps
1. Pick next feature from backlog (Parallel scanning)
