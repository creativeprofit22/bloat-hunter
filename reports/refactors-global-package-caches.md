# Refactor Report: Global Package Caches

Generated: 2025-12-21
Feature: Global Package Caches
Source: reports/bugs-global-package-caches.md

## Scope
Files analyzed:
- src/bloat_hunter/core/package_scanner.py
- src/bloat_hunter/cli.py
- src/bloat_hunter/core/analyzer.py

## High Priority (Tech Debt / DRY) ✅ DONE
| # | Location | Issue | Suggested Fix | Effort | Status |
|---|----------|-------|---------------|--------|--------|
| 1 | cli.py:107-136, 204-229, 307-331, 398-422 | DRY violation: "select → preview → dry-run → confirm → clean" pattern repeated 4x | Extract to shared `_handle_cleanup_flow(targets, analyzer, cleaner, dry_run, interactive)` helper | M | ✅ Done |
| 2 | package_scanner.py:97-125 + cli.py:339-360 | 11 boolean package manager flags duplicated in init and CLI | Create `PackageManagerConfig` dataclass with all flags, pass single config object | M | ✅ Done |

## Medium Priority (Code Clarity) ✅ DONE
| # | Location | Issue | Suggested Fix | Effort | Status |
|---|----------|-------|---------------|--------|--------|
| 3 | analyzer.py:62-66, 143-147, 280-284 | "Showing top 20..." message duplicated 3 times | Extract `_print_truncation_notice(shown, total, item_type)` helper | S | ✅ Done |
| 4 | analyzer.py:69-72, 150-153, 287-290 | Scan errors message duplicated 3 times | Extract `_print_scan_errors(errors: list[str])` helper | S | ✅ Done |
| 5 | package_scanner.py:144-219 | `scan()` method is 75 lines with multiple concerns | Split into `_init_stats()`, `_collect_targets()`, `_aggregate_stats()` | M | ✅ Done |

## Low Priority (Nice-to-Have)
| # | Location | Issue | Suggested Fix | Effort | Status |
|---|----------|-------|---------------|--------|--------|
| 6 | cli.py:286-291 | `CacheScanResult` → `ScanResult` conversion suggests interface gap | Consider making `CacheScanResult` inherit from or match `ScanResult` interface | L | ⏸️ Deferred (requires cache_scanner.py) |
| 7 | package_scanner.py:189, 274, 316 | `(PermissionError, OSError)` exception tuple repeated 3 times | Define `FILESYSTEM_ERRORS = (PermissionError, OSError)` constant | S | ✅ Done |

## Summary
- High: 2 refactors (0 Small, 2 Medium, 0 Large)
- Medium: 3 refactors (2 Small, 1 Medium)
- Low: 2 refactors (1 Small, 1 Large)
- Total: 7 refactors
