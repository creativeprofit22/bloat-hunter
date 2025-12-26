# Refactor Report: Parallel Scanning

Generated: 2025-12-25
Feature: Parallel Scanning
Source: reports/bugs-parallel-scanning.md

## Scope
Files analyzed:
- src/bloat_hunter/core/parallel.py
- src/bloat_hunter/core/scanner.py
- src/bloat_hunter/core/duplicates.py
- src/bloat_hunter/core/cache_scanner.py
- src/bloat_hunter/core/package_scanner.py
- src/bloat_hunter/cli.py

## High Priority (Tech Debt / DRY) - COMPLETED 2025-12-25
| # | Location | Issue | Suggested Fix | Effort | Status |
|---|----------|-------|---------------|--------|--------|
| 1 | scanner.py:141-165 | `calc_target` inline function duplicated identically in both scanners | Extracted to shared function in scanner.py | S | ✅ Done |
| 2 | scanner.py:193-251 | `_collect_matches` method nearly identical between CacheScanner and PackageScanner | Extracted to `collect_pattern_matches` shared function | M | ✅ Done |
| 3 | scanner.py:168-190 | Pattern matching methods `_match_pattern` / `_match_against_patterns` have same structure | Consolidated into `match_patterns` utility function | S | ✅ Done |

## Medium Priority (Code Clarity)
| # | Location | Issue | Suggested Fix | Effort |
|---|----------|-------|---------------|--------|
| 1 | parallel.py:127-149 | `get_directory_sizes_parallel` function defined but never called in codebase | Remove if unused, or document intended use | S |
| 2 | duplicates.py:142-143 | `_get_hasher()` called on every `hash_file` invocation, recreates factory each time | Cache hasher factory at module level | S |
| 3 | scanner.py:194-198, duplicates.py:223-231, cache_scanner.py:148-162 | Inline functions (`calc_size`, `hash_candidate`, `calc_target`) defined inside methods | Extract as module-level or class methods for testability | M |

## Low Priority (Nice-to-Have)
| # | Location | Issue | Suggested Fix | Effort |
|---|----------|-------|---------------|--------|
| 1 | All scanner files | Progress bar setup duplicated (SpinnerColumn, TextColumn, BarColumn, etc.) | Create shared `create_progress()` helper | S |
| 2 | cache_scanner.py, package_scanner.py, scanner.py | Mix of `Optional[X]` and `X \| None` type annotation styles | Standardize on `X \| None` (modern Python 3.10+) | S |
| 3 | cli.py:610-681 | `packages` command has 11 boolean options for package managers | Consider accepting comma-separated list or config-based approach | L |

## Summary
- High: 3 refactors (2 Small, 1 Medium)
- Medium: 3 refactors (2 Small, 1 Medium)
- Low: 3 refactors (2 Small, 1 Large)
- Total: 9 refactors
