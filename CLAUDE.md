# Bloat Hunter

Cross-platform disk cleanup CLI tool.

## Current Focus
Section: Parallel Scanning
Files:
  - src/bloat_hunter/core/parallel.py
  - src/bloat_hunter/core/scanner.py
  - src/bloat_hunter/core/duplicates.py
  - src/bloat_hunter/core/cache_scanner.py
  - src/bloat_hunter/core/package_scanner.py
  - src/bloat_hunter/cli.py

## Pipeline State
Phase: debugging
Feature: Parallel Scanning
Tier: medium
Tier-Status: pending
Reports:
  - bugs: reports/bugs-parallel-scanning.md

## Feature Backlog
High Priority:
1. ~~Duplicate file detection~~ - DONE
2. ~~System cache scanning~~ - DONE
3. ~~Global package caches~~ - DONE (bloat-hunter packages command)

Medium Priority:
4. ~~Config file support~~ - DONE (bloat-hunter config init/show/path)
5. ~~Size thresholds CLI~~ - DONE (--min-size filter on scan/clean)
6. ~~Export results~~ - DONE (--output/-o and --format/-f on scan/duplicates/caches/packages)
7. ~~Parallel scanning~~ - DONE (--parallel/--no-parallel, --workers on all scan commands)

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
Fixed high priority bugs from parallel scanning bug hunt:
- scanner.py: Fixed format_size type mutation (use local float variable)
- cache_scanner.py: Changed broad `except Exception` to `(PermissionError, OSError)`
- Committed and pushed: 345ff67

## Next Steps
1. Fix medium priority bugs (dead code removal, empty list check)
2. Fix low priority bugs (code duplication, long line)
3. Windows native testing
