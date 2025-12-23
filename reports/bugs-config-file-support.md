# Bug Report: Config file support

Generated: 2025-12-22
Feature: Config file support

## Scope
Files analyzed:
- src/bloat_hunter/config.py
- src/bloat_hunter/cli.py

## High Priority
| # | Location | Description | Impact |
|---|----------|-------------|--------|
| 1 | config.py:155-164 | `_dict_to_config` crashes on unknown TOML keys - if user adds unsupported key like `[defaults]\nfoo = true`, raises `TypeError: got unexpected keyword argument` | Crash on user config with typos or future keys |
| 2 | config.py:185-193 | `load_config` doesn't catch TOML parsing errors - malformed TOML syntax in XDG or CWD config causes unhandled exception | Crash with unhelpful tomllib error message |
| 3 | config.py:185-193 | `load_config` doesn't call `_validate_config` on loaded data - only `load_config_from_file` validates, so default location configs can have invalid values | Invalid config values like `keep = "bad"` slip through silently |

## Medium Priority
| # | Location | Description | Impact |
|---|----------|-------------|--------|
| 1 | config.py:68-70 | `min_size_bytes` property calls `parse_size` without try/catch - if invalid value wasn't caught by validation, accessing this property crashes | Runtime crash when accessing min_size_bytes |
| 2 | cli.py:507-509 | `config_init` doesn't handle permission errors on `mkdir` or `write_text` | Crash instead of helpful error when user lacks write permissions |

## Low Priority
| # | Location | Description | Impact |
|---|----------|-------------|--------|

## Summary
- High: 3 bugs
- Medium: 2 bugs
- Low: 0 bugs
- Total: 5 bugs
