# Bug Report: Parallel Scanning

Generated: 2025-12-25
Feature: Parallel Scanning

## Scope
Files analyzed:
- src/bloat_hunter/core/parallel.py
- src/bloat_hunter/core/scanner.py
- src/bloat_hunter/core/duplicates.py
- src/bloat_hunter/core/cache_scanner.py
- src/bloat_hunter/core/package_scanner.py
- src/bloat_hunter/cli.py

## High Priority
| # | Location | Description | Impact |
|---|----------|-------------|--------|
| 1 | scanner.py:60-61 | `format_size` mutates `size_bytes` parameter with `/= 1024` causing type mismatch (int -> float). The function signature expects int but modifies it in-place | Mypy type error; potential float rounding issues in size display |
| 2 | cache_scanner.py:130 | Broad `except Exception` catches all errors including KeyboardInterrupt, SystemExit | User cannot Ctrl+C to cancel scan in phase 1; cleanup won't work properly |

## Medium Priority
| # | Location | Description | Impact |
|---|----------|-------------|--------|
| 1 | cache_scanner.py:249-273 | `_create_target` method is defined but never called after refactor to parallel | Dead code; minor memory/maintainability overhead |
| 2 | package_scanner.py:363-387 | `_create_target` method is defined but never called after refactor to parallel | Dead code; minor memory/maintainability overhead |
| 3 | duplicates.py:81 | `get_keep_file` returns `self.files[0]` without checking if files list is empty | Potential IndexError if called on empty DuplicateGroup (defensive check missing) |

## Low Priority
| # | Location | Description | Impact |
|---|----------|-------------|--------|
| 1 | parallel.py:54 | `len(items) <= 1` uses sequential mode for single item, but `parallel_map_ordered` at line 97 duplicates this check | Slight code duplication; both functions have same threshold logic |
| 2 | parallel.py:119 | `parallel_map_ordered` builds entire result dict then converts to list - could use pre-allocated list | Minor inefficiency for large item counts |
| 3 | scanner.py:175 | Long line exceeds 100 chars (175 chars total) - style issue only | Readability in narrow terminals |

## Summary
- High: 2 bugs
- Medium: 3 bugs
- Low: 3 bugs
- Total: 8 bugs
