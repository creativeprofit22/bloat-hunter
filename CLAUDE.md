# Bloat Hunter

Cross-platform disk cleanup CLI tool.

## Current Focus
Feature complete - awaiting next task

## Pipeline State
Phase: build
Feature: Size thresholds CLI
Status: complete

## Feature Backlog
High Priority:
1. ~~Duplicate file detection~~ - DONE
2. ~~System cache scanning~~ - DONE
3. ~~Global package caches~~ - DONE (bloat-hunter packages command)

Medium Priority:
4. ~~Config file support~~ - DONE (bloat-hunter config init/show/path)
5. ~~Size thresholds CLI~~ - DONE (--min-size filter on scan/clean)
6. Export results - JSON/CSV output
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

## Last Session (2025-12-22)
Size thresholds CLI feature complete:
- Added `--min-size` option to `scan` and `clean` commands
- Updated Scanner class to accept min_size parameter
- Added min_size to ScanConfig for config file support
- Added tests for parse_size and min_size filtering
- All 158 tests passed

## Next Steps
1. Pick next feature from backlog (Export results or Parallel scanning)
