"""Configuration management for Bloat Hunter CLI."""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

# Conditional import for Python 3.10 compatibility
if sys.version_info >= (3, 11):
    import tomllib
else:
    import tomli as tomllib  # type: ignore[import-not-found]

from bloat_hunter.core.scanner import parse_size

# Type alias for keep strategy
KeepStrategy = Literal["first", "shortest", "oldest", "newest"]
VALID_KEEP_STRATEGIES: tuple[KeepStrategy, ...] = ("first", "shortest", "oldest", "newest")


@dataclass
class DefaultsConfig:
    """Default behavior options."""

    dry_run: bool = True
    trash: bool = True
    interactive: bool = True
    wsl_windows: bool = True


@dataclass
class PackagesConfig:
    """Package manager cache settings."""

    npm: bool = True
    yarn: bool = True
    pnpm: bool = True
    pip: bool = True
    cargo: bool = True
    go: bool = True
    gradle: bool = True
    maven: bool = True
    composer: bool = True
    nuget: bool = True
    bundler: bool = True


@dataclass
class CachesConfig:
    """Cache category settings."""

    browsers: bool = True
    package_managers: bool = True
    apps: bool = True


@dataclass
class DuplicatesConfig:
    """Duplicate detection settings."""

    min_size: str = "1MB"
    keep: KeepStrategy = "first"

    @property
    def min_size_bytes(self) -> int:
        """Convert min_size to bytes."""
        return parse_size(self.min_size)


@dataclass
class ScanConfig:
    """General scan settings."""

    show_all: bool = False
    deep: bool = False


@dataclass
class Config:
    """Root configuration container."""

    defaults: DefaultsConfig = field(default_factory=DefaultsConfig)
    packages: PackagesConfig = field(default_factory=PackagesConfig)
    caches: CachesConfig = field(default_factory=CachesConfig)
    duplicates: DuplicatesConfig = field(default_factory=DuplicatesConfig)
    scan: ScanConfig = field(default_factory=ScanConfig)

    # Metadata (not from TOML)
    _source: Path | None = field(default=None, repr=False)


def get_xdg_config_home() -> Path:
    """Get XDG config home, respecting environment variable."""
    xdg = os.environ.get("XDG_CONFIG_HOME")
    if xdg:
        return Path(xdg)
    return Path.home() / ".config"


def get_config_paths() -> tuple[Path, Path]:
    """
    Get config file paths in priority order.

    Returns:
        (xdg_path, cwd_path) - XDG is base, CWD overrides
    """
    xdg_path = get_xdg_config_home() / "bloat-hunter" / "config.toml"
    cwd_path = Path.cwd() / "bloathunter.toml"
    return xdg_path, cwd_path


def _load_toml(path: Path) -> dict[str, Any]:
    """Load and parse a TOML file."""
    with open(path, "rb") as f:
        result: dict[str, Any] = tomllib.load(f)
        return result


def _merge_dicts(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    """Deep merge two dictionaries, override takes precedence."""
    result = base.copy()
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _merge_dicts(result[key], value)
        else:
            result[key] = value
    return result


def _validate_config(data: dict[str, Any]) -> list[str]:
    """Validate TOML data and return list of errors."""
    errors: list[str] = []

    # Check keep strategy
    keep = data.get("duplicates", {}).get("keep")
    if keep and keep not in VALID_KEEP_STRATEGIES:
        errors.append(
            f"Invalid duplicates.keep: '{keep}' (use: first, shortest, oldest, newest)"
        )

    # Check min_size format
    min_size = data.get("duplicates", {}).get("min_size")
    if min_size:
        try:
            parse_size(min_size)
        except ValueError:
            errors.append(f"Invalid duplicates.min_size: '{min_size}' (use: 1KB, 10MB, 1GB)")

    return errors


def _dict_to_config(data: dict[str, Any], source: Path | None = None) -> Config:
    """Convert parsed TOML dict to Config dataclass."""
    return Config(
        defaults=DefaultsConfig(**data.get("defaults", {})),
        packages=PackagesConfig(**data.get("packages", {})),
        caches=CachesConfig(**data.get("caches", {})),
        duplicates=DuplicatesConfig(**data.get("duplicates", {})),
        scan=ScanConfig(**data.get("scan", {})),
        _source=source,
    )


def load_config() -> Config:
    """
    Load configuration with XDG + CWD override precedence.

    Priority (highest to lowest):
    1. ./bloathunter.toml (CWD override)
    2. ~/.config/bloat-hunter/config.toml (XDG base)
    3. Built-in defaults

    Returns:
        Merged Config instance
    """
    xdg_path, cwd_path = get_config_paths()

    merged_data: dict[str, Any] = {}
    active_source: Path | None = None

    # Load XDG config if exists
    if xdg_path.exists():
        merged_data = _load_toml(xdg_path)
        active_source = xdg_path

    # Merge CWD config if exists (overrides XDG)
    if cwd_path.exists():
        cwd_data = _load_toml(cwd_path)
        merged_data = _merge_dicts(merged_data, cwd_data)
        active_source = cwd_path

    return _dict_to_config(merged_data, active_source)


def load_config_from_file(path: Path) -> Config:
    """Load configuration from a specific file."""
    data = _load_toml(path)
    errors = _validate_config(data)
    if errors:
        raise ValueError(f"Config validation failed: {'; '.join(errors)}")
    return _dict_to_config(data, path)


# Default config template for `config init`
DEFAULT_CONFIG_TEMPLATE = """\
# Bloat Hunter Configuration
# Documentation: https://github.com/creativeprofit22/bloat-hunter

[defaults]
# Safety options - all safe by default
dry_run = true          # Preview changes without deleting
trash = true            # Move to trash instead of permanent delete
interactive = true      # Prompt before actions

# WSL-specific behavior
wsl_windows = true      # Include Windows directories when in WSL

[packages]
# Package manager caches to scan (bloat-hunter packages)
npm = true
yarn = true
pnpm = true
pip = true
cargo = true
go = true
gradle = true
maven = true
composer = true
nuget = true
bundler = true

[caches]
# Cache categories to scan (bloat-hunter caches)
browsers = true         # Chrome, Firefox, Edge, Safari
package_managers = true # npm, pip, cargo, etc.
apps = true             # VS Code, Slack, Discord, etc.

[duplicates]
# Duplicate file settings (bloat-hunter duplicates)
min_size = "1MB"        # Minimum size: 1KB, 10MB, 1GB, etc.
keep = "first"          # Which to keep: first, shortest, oldest, newest

[scan]
# General scan behavior (bloat-hunter scan)
show_all = false        # Show all vs top offenders
deep = false            # Deep scan (slower but thorough)
"""
