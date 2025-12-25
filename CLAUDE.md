# Bloat Hunter

Cross-platform disk cleanup CLI tool.

## Current Focus
Awaiting next task

## Pipeline State
Phase: build
Feature: Parallel Scanning
Status: complete

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
Parallel Scanning feature complete:
- Created core/parallel.py module with ThreadPoolExecutor wrapper
- Parallelized DuplicateScanner hashing phase (biggest performance win)
- Parallelized get_directory_size for batch operations
- Updated Scanner, CacheScanner, PackageScanner with two-phase approach:
  - Phase 1: Collect all matching directories (fast traversal)
  - Phase 2: Calculate sizes in parallel using ThreadPoolExecutor
- Added --parallel/--no-parallel and --workers CLI flags to all scan commands
- Created 17 new tests in test_parallel.py
- All 176 tests pass

## Next Steps
1. Windows native testing
2. Interactive TUI - full-screen mode
