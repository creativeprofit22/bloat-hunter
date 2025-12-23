# Refactor Report: Size Thresholds CLI

Generated: 2025-12-22
Feature: Size thresholds CLI
Source: reports/bugs-size-thresholds-cli.md

## Scope
Files analyzed:
- src/bloat_hunter/core/scanner.py
- src/bloat_hunter/cli.py
- src/bloat_hunter/config.py

## High Priority (Tech Debt / DRY)
| # | Location | Issue | Suggested Fix | Effort |
|---|----------|-------|---------------|--------|

## Medium Priority (Code Clarity)
| # | Location | Issue | Suggested Fix | Effort | Status |
|---|----------|-------|---------------|--------|--------|
| 1 | cli.py:276-281, 318-323, 388-393 | min_size parsing + error handling duplicated 3 times (scan, clean, duplicates) | Extract `_parse_min_size(min_size: str) -> int` helper that handles ValueError and prints error | S | ✅ Done |

## Low Priority (Nice-to-Have)
| # | Location | Issue | Suggested Fix | Effort |
|---|----------|-------|---------------|--------|
| 1 | cli.py:266-271, 308-313, 355-360 | MIN_SIZE_OPTION not a shared constant like DRY_RUN_OPTION | Keep as-is: defaults intentionally differ (0B for scan/clean, 1MB for duplicates) | - |
| 2 | config.py:67-73, 84-90 | min_size_bytes property duplicated in DuplicatesConfig and ScanConfig | Keep as-is: fallback values intentionally differ (1MB vs 0), extraction adds complexity for minimal gain | - |

## Summary
- High: 0 refactors
- Medium: 1 refactor (1 Small) ✅ Complete
- Low: 2 observations (recommended to keep as-is)
- Total: 0 remaining refactors
