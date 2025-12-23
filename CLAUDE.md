# Bloat Hunter

Cross-platform disk cleanup CLI tool.

## Current Focus
Section: Size thresholds CLI
Files: src/bloat_hunter/core/scanner.py, src/bloat_hunter/cli.py, src/bloat_hunter/config.py

## Pipeline State
Phase: build
Feature: Size thresholds CLI
Reports:
  - bugs: reports/bugs-size-thresholds-cli.md
  - refactors: reports/refactors-size-thresholds-cli.md

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
Size thresholds CLI - refactoring complete:
- Extracted `_parse_min_size` helper in cli.py:65-71
- Replaced 3 duplicated blocks (scan, clean, duplicates commands)
- Low priority items skipped (intentional differences)

## Next Steps
1. Pick next feature from backlog (Export results or Parallel scanning)
