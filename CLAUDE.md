# Bloat Hunter

Cross-platform disk cleanup CLI tool.

## Current Focus
Feature: Export Results
Files:
- src/bloat_hunter/core/exporter.py
- src/bloat_hunter/cli.py

## Pipeline State
Phase: refactoring
Feature: Export Results
Tier: low
Tier-Status: pending
Reports:
  - bugs: reports/bugs-export-results.md
  - fixes: reports/fixes-export-results.md
  - refactors: reports/refactors-export-results.md

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
Medium priority refactors complete for Export Results:
- Consolidated duplicate `mkdir` calls into `export_result()` dispatcher
- Removed redundant mkdir from `export_json()` and `export_csv()`
- High + Medium refactors now complete (3/4 total)

## Next Steps
1. Execute low priority refactors from refactor report
2. Parallel scanning feature
