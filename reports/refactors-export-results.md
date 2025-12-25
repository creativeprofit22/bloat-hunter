# Refactor Report: Export Results

Generated: 2025-12-25
Feature: Export Results
Source: reports/fixes-export-results.md

## Scope
Files analyzed:
- src/bloat_hunter/core/exporter.py
- src/bloat_hunter/cli.py

## High Priority (Tech Debt / DRY)
| # | Location | Issue | Suggested Fix | Effort | Status |
|---|----------|-------|---------------|--------|--------|
| 1 | exporter.py:246 | Parameter `format` shadows built-in | Rename to `fmt` | S | ✅ Done |
| 2 | exporter.py:41,74,90,118 | Repeated `datetime.now(timezone.utc).isoformat()` in 4 functions | Extract to `_get_timestamp()` helper | S | ✅ Done |

## Medium Priority (Code Clarity)
| # | Location | Issue | Suggested Fix | Effort | Status |
|---|----------|-------|---------------|--------|--------|
| 1 | exporter.py:162,183 | Repeated `output_path.parent.mkdir(parents=True, exist_ok=True)` | Extract to `_ensure_parent_dir(path)` or call once in `export_result()` | S | ✅ Done |

## Low Priority (Nice-to-Have)
| # | Location | Issue | Suggested Fix | Effort |
|---|----------|-------|---------------|--------|
| 1 | exporter.py:128-129,147-148,167-168,238-239 | Long union type repeated 4 times | Create `AnyResult` type alias | S |

## Summary
- High: 2 refactors ✅ Done
- Medium: 1 refactor ✅ Done
- Low: 1 refactor (pending)
- Total: 4 refactors (3 complete, 1 pending)
