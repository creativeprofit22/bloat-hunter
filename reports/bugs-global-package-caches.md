# Bug Report: Global Package Caches

Generated: 2025-12-21
Feature: Global Package Caches

## Scope
Files analyzed:
- src/bloat_hunter/core/package_scanner.py
- src/bloat_hunter/cli.py
- src/bloat_hunter/core/analyzer.py

## High Priority ✅ FIXED
| # | Location | Description | Status |
|---|----------|-------------|--------|
| 1 | package_scanner.py:37 | `maven: []` empty list means Maven caches are never detected | ✅ Fixed: Added local `MAVEN_PATTERN` and `.m2/repository` path validation |
| 2 | package_scanner.py:119-121 | Patterns without a manager mapping are silently dropped | ✅ Fixed: Added `logger.warning()` in `_filter_patterns()` |

## Medium Priority ✅ FIXED
| # | Location | Description | Status |
|---|----------|-------------|--------|
| 3 | analyzer.py:261 | Manager derived from `pattern.name.split()[0].lower()` was fragile | ✅ Fixed: Uses `_get_manager_for_pattern()` |
| 4 | cli.py:186 | `raise typer.Exit(1)` without `from e` loses exception context | ✅ Fixed: Added `from e` |
| 5 | package_scanner.py:316-317 | Errors in `_create_target` silently passed without logging | ✅ Fixed: Added `logger.debug()` |
| 6 | cli.py:393-394 | `packages` command exits silently with code 0 when no targets found | ✅ Fixed: Already handled by `display_package_results`; clarified with comment |

## Low Priority ✅ FIXED
| # | Location | Description | Status |
|---|----------|-------------|--------|
| 7 | package_scanner.py:189-190 | Broad `except Exception` catches too much | ✅ Fixed: Narrowed to `(PermissionError, OSError)` |
| 8 | cli.py:180 | `# type: ignore[assignment]` for keep_strategy cast | ✅ Fixed: Uses `cast(KeepStrategy, keep)` |
| 9 | analyzer.py:233-248 | Managers with 0 size but included are not shown | ✅ Fixed: Shows managers with 0 size dimmed |

## Summary
- High: 2 bugs ✅ FIXED
- Medium: 4 bugs ✅ FIXED
- Low: 3 bugs ✅ FIXED
- Total: 9 bugs (all fixed)
