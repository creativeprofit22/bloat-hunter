# Bug Report: Size Thresholds CLI

Generated: 2025-12-22
Feature: Size thresholds CLI

## Scope
Files analyzed:
- src/bloat_hunter/core/scanner.py
- src/bloat_hunter/cli.py
- src/bloat_hunter/config.py

## High Priority
| # | Location | Description | Impact |
|---|----------|-------------|--------|

## Medium Priority
| # | Location | Description | Impact |
|---|----------|-------------|--------|

## Low Priority
| # | Location | Description | Impact | Status |
|---|----------|-------------|--------|--------|
| 1 | scanner.py:88-89 | `parse_size()` accepts negative values (e.g., "-10MB" returns -10485760) | Negative min_size effectively disables filtering since all positive sizes pass the `>= negative` check. Not harmful but confusing UX if user accidentally uses negative value. | FIXED (b937471) |

## Summary
- High: 0 bugs
- Medium: 0 bugs
- Low: 1 bug (fixed)
- Total: 1 bug
