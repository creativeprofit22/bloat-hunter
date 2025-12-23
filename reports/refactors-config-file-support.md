# Refactor Report: Config file support

Generated: 2025-12-22
Feature: Config file support
Source: reports/bugs-config-file-support.md

## Scope
Files analyzed:
- src/bloat_hunter/config.py
- src/bloat_hunter/cli.py

## High Priority (Tech Debt / DRY) - COMPLETE
| # | Location | Issue | Suggested Fix | Effort | Status |
|---|----------|-------|---------------|--------|--------|
| 1 | cli.py:48 + config.py:21 | `VALID_KEEP_STRATEGIES` defined in both files | Remove from cli.py, import from config.py | S | Done |
| 2 | cli.py:111-114, 139-142 | Dry run message duplicated in both branches of `_handle_cleanup_flow` | Extract to helper function or print once before the branch | S | Done |
| 3 | cli.py:178-181, 274-276, 334-339, 414-419 | Platform info print pattern repeated in 4+ commands | Extract `_print_platform_header()` helper | S | Done |

## Medium Priority (Code Clarity) - COMPLETE
| # | Location | Issue | Suggested Fix | Effort | Status |
|---|----------|-------|---------------|--------|--------|
| 1 | cli.py:119-241 | `_handle_cleanup_flow` is 82 lines with deep nesting and two parallel branches | Split into `_handle_targets_cleanup` and `_handle_duplicates_cleanup` | M | Done |
| 2 | config.py:164-180 | `_dict_to_config` has repetitive pattern for each section | Consider loop over section names + types mapping | S | Done |
| 3 | cli.py:65-96, 595, 598-602 | `config_show` and `config_path` have overlapping "show locations" code | Extract `_print_config_locations()` helper | S | Done |

## Low Priority (Nice-to-Have)
| # | Location | Issue | Suggested Fix | Effort |
|---|----------|-------|---------------|--------|
| 1 | config.py:231-274 | `DEFAULT_CONFIG_TEMPLATE` is a large string literal | Could generate from dataclass defaults, but current approach is readable | L |
| 2 | cli.py:38-45 | `State` class only holds config, could use module-level variable | Keep as-is; class allows future expansion | S |

## Summary
- High: 3 refactors (3 Small, 0 Medium, 0 Large) - **COMPLETE**
- Medium: 3 refactors (2 Small, 1 Medium) - **COMPLETE**
- Low: 2 refactors (1 Small, 1 Large) - skipped (no changes needed)
- Total: 8 refactors (6 complete, 2 skipped)
