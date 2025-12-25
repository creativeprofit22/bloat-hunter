# Fixes Report: Export Results

Generated: 2025-12-25
Feature: Export Results

## Scope
Files modified:
- src/bloat_hunter/core/exporter.py
- src/bloat_hunter/cli.py

## Medium Priority Fixes

| # | Location | Bug | Fix |
|---|----------|-----|-----|
| 1 | cli.py:182-193 | Misleading error message when format auto-detection fails | Added conditional logic to show specific error: "Invalid export format: X" when --format specified, or "Unrecognized file extension: .X" when auto-detection fails |

## Low Priority Fixes

| # | Location | Bug | Fix |
|---|----------|-----|-----|
| 1 | exporter.py:20-31 | Dead code `_serialize_path()` never called | Removed the function entirely |
| 2 | cli.py (multiple) | Parameter `format` shadows built-in | Renamed to `fmt` in: `_resolve_export_format`, `_handle_export`, `scan`, `duplicates`, `caches`, `packages` |

## Summary
- High: 0 fixed (0 found)
- Medium: 1 fixed
- Low: 2 fixed
- Total: 3 fixed
