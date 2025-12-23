# Bug Report: System Cache Scanning

Generated: 2025-12-21
Feature: System Cache Scanning

## Scope
Files analyzed:
- src/bloat_hunter/core/cache_scanner.py
- src/bloat_hunter/patterns/browser_cache.py
- src/bloat_hunter/platform/detect.py
- src/bloat_hunter/cli.py
- src/bloat_hunter/patterns/__init__.py
- src/bloat_hunter/safety/protected.py

## High Priority
| # | Location | Description | Impact |
|---|----------|-------------|--------|
| 1 | browser_cache.py:115 | pip cache pattern `"http"` is too generic | Could match any directory named "http" causing false positives; may flag unrelated directories as cache |
| 2 | browser_cache.py:139 | Cargo git pattern `"git"` is too generic | Will match any directory named "git" (e.g., project .git dirs if path filtering fails); high false positive risk |
| 3 | detect.py:213-214 | XDG env vars not validated for empty strings | `os.environ.get("XDG_CACHE_HOME", ...)` returns "" if env var is set but empty, `Path("")` creates path to cwd, causing scans in wrong location |

## Medium Priority
| # | Location | Description | Impact |
|---|----------|-------------|--------|
| 4 | cache_scanner.py:238-239 | `_scan_subdirectory` silently passes on errors without logging | Errors during recursive scanning are lost; inconsistent with `_scan_cache_root` which logs to `scan_errors` |
| 5 | browser_cache.py:165 | Maven pattern `"repository"` is generic | Could match any directory named "repository" outside ~/.m2 context |
| 6 | browser_cache.py:175 | Gradle patterns `"wrapper"`, `"daemon"` are generic | Could match directories with these names outside ~/.gradle context |
| 7 | detect.py:267 | Same XDG empty string issue in `_get_package_manager_cache_paths` | Scanning wrong location if XDG_CACHE_HOME="" |
| 8 | detect.py:303-304 | Same XDG empty string issue in `_get_app_cache_paths` | Scanning wrong location if XDG env vars are empty strings |
| 9 | safety/protected.py:172-175 | Generic names added to `_is_cache_subdirectory`: "pip", "wheels", "registry", "caches" | Reduces protection for legitimate directories with these names |

## Low Priority
| # | Location | Description | Impact |
|---|----------|-------------|--------|
| 10 | browser_cache.py:10-17 | `_is_chromium_cache` function defined but never used | Dead code, no runtime impact |
| 11 | browser_cache.py:334 | Slack pattern has redundant entry: `"re:^[Ss]lack$"` and `"Slack"` | The regex already covers "Slack"; minor inefficiency |
| 12 | cache_scanner.py:202-236 | `_scan_subdirectory` doesn't check `is_protected_path` on entries | Could recurse into protected subdirectories; mitigated by pattern matching only adding known caches |
| 13 | detect.py:51-61 | WSL Windows home detection picks first valid user dir | May pick wrong user on multi-user Windows systems |
| 14 | detect.py:321-335 | `get_all_cache_paths()` calls `get_platform_info()` 4 times | Performance inefficiency; redundant platform detection calls |
| 15 | browser_cache.py:246 | JetBrains pattern `"re:.*[Cc]aches$"` is overly broad | Could match non-JetBrains directories ending in "caches" |

## Summary
- High: 3 bugs
- Medium: 6 bugs
- Low: 6 bugs
- Total: 15 bugs
