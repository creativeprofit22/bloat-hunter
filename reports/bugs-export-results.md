# Bug Report: Export Results

Generated: 2025-12-25
Feature: Export Results (1 of 1)

## Scope
Files analyzed:
- src/bloat_hunter/core/exporter.py
- src/bloat_hunter/cli.py

## High Priority
| # | Location | Description | Impact |
|---|----------|-------------|--------|

## Medium Priority
| # | Location | Description | Impact |
|---|----------|-------------|--------|
| 1 | cli.py:184 | Misleading error message when format auto-detection fails | User confusion: message says "Invalid export format" when user didn't specify a format - they just used an unrecognized extension like `--output results.txt` |

## Low Priority
| # | Location | Description | Impact |
|---|----------|-------------|--------|
| 1 | exporter.py:20-31 | Dead code: `_serialize_path()` function defined but never called | Code bloat, maintenance burden |
| 2 | cli.py:176,351,449,523,601 | Parameter `format` shadows built-in `format()` function | Minor code smell, could cause confusion if built-in needed |

## Summary
- High: 0 bugs
- Medium: 1 bugs
- Low: 2 bugs
- Total: 3 bugs
