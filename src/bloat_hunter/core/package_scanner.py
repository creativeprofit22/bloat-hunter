"""Specialized scanner for package manager caches."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from pathlib import Path

from rich.console import Console
from rich.progress import (
    BarColumn,
    Progress,
    SpinnerColumn,
    TaskProgressColumn,
    TextColumn,
)

from bloat_hunter.core.scanner import BloatTarget, format_size, get_directory_size
from bloat_hunter.patterns.base import BloatPattern
from bloat_hunter.patterns.browser_cache import PACKAGE_MANAGER_PATTERNS
from bloat_hunter.platform.detect import (
    PlatformInfo,
    get_all_cache_paths,
    get_platform_info,
)
from bloat_hunter.safety.protected import is_protected_path

logger = logging.getLogger(__name__)

# Common filesystem errors to catch during scanning
FILESYSTEM_ERRORS = (PermissionError, OSError)


@dataclass
class PackageManagerConfig:
    """Configuration for which package managers to include in scans."""

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


# Maven pattern defined locally since "repository" is too generic to add globally.
# Detection relies on parent path being ".m2"
MAVEN_PATTERN = BloatPattern(
    name="Maven repository",
    category="Package Manager",
    patterns=["repository"],
    description="Maven local repository (.m2/repository)",
    safe_level="safe",
)

# Package manager groupings for filtering
PACKAGE_MANAGER_GROUPS: dict[str, list[str]] = {
    "npm": ["npm cache"],
    "yarn": ["yarn cache"],
    "pnpm": ["pnpm store"],
    "pip": ["pip cache", "pipx cache"],
    "cargo": ["Cargo registry", "Cargo git"],
    "go": ["Go build cache", "Go mod cache"],
    "gradle": ["Gradle caches"],
    "maven": ["Maven repository"],
    "composer": ["Composer cache"],
    "nuget": ["NuGet cache"],
    "bundler": ["Bundler cache"],
}


@dataclass
class PackageManagerStats:
    """Statistics for a single package manager."""

    name: str
    size_bytes: int = 0
    file_count: int = 0
    targets: list[BloatTarget] = field(default_factory=list)

    @property
    def size_human(self) -> str:
        return format_size(self.size_bytes)


@dataclass
class PackageScanResult:
    """Results from a package manager cache scan."""

    platform_info: PlatformInfo
    targets: list[BloatTarget] = field(default_factory=list)
    total_size: int = 0
    scan_errors: list[str] = field(default_factory=list)
    by_manager: dict[str, PackageManagerStats] = field(default_factory=dict)

    @property
    def total_size_human(self) -> str:
        return format_size(self.total_size)


def _get_manager_for_pattern(pattern_name: str) -> str | None:
    """Get the package manager group for a pattern name."""
    for manager, patterns in PACKAGE_MANAGER_GROUPS.items():
        if pattern_name in patterns:
            return manager
    return None


class PackageScanner:
    """Scans package manager cache directories specifically."""

    def __init__(
        self,
        console: Console | None = None,
        config: PackageManagerConfig | None = None,
    ):
        self.console = console or Console()
        if config is None:
            config = PackageManagerConfig()
        self._include = {
            "npm": config.npm,
            "yarn": config.yarn,
            "pnpm": config.pnpm,
            "pip": config.pip,
            "cargo": config.cargo,
            "go": config.go,
            "gradle": config.gradle,
            "maven": config.maven,
            "composer": config.composer,
            "nuget": config.nuget,
            "bundler": config.bundler,
        }
        self.patterns = self._filter_patterns()

    def _filter_patterns(self) -> list[BloatPattern]:
        """Filter patterns based on included package managers."""
        filtered: list[BloatPattern] = []
        for pattern in PACKAGE_MANAGER_PATTERNS:
            manager = _get_manager_for_pattern(pattern.name)
            if manager is None:
                logger.warning(
                    "Pattern %r has no manager mapping in PACKAGE_MANAGER_GROUPS; "
                    "it will be excluded from package cache scans",
                    pattern.name,
                )
                continue
            if self._include.get(manager, True):
                filtered.append(pattern)
        return filtered

    def _init_stats(self, platform_info: PlatformInfo) -> PackageScanResult:
        """Initialize scan result with empty per-manager stats."""
        result = PackageScanResult(platform_info=platform_info)
        for manager, include in self._include.items():
            if include:
                result.by_manager[manager] = PackageManagerStats(name=manager)
        return result

    def _collect_targets(
        self, result: PackageScanResult, paths_to_scan: list[Path]
    ) -> None:
        """Scan directories and collect targets with progress display."""
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            console=self.console,
        ) as progress:
            task = progress.add_task(
                "Scanning package caches...", total=len(paths_to_scan)
            )

            for cache_path in paths_to_scan:
                progress.update(task, description=f"Scanning: {cache_path.name}")

                try:
                    self._scan_directory(cache_path, result, depth=0)
                except FILESYSTEM_ERRORS as e:
                    result.scan_errors.append(f"{cache_path}: {e}")

                progress.advance(task)

    def _aggregate_stats(self, result: PackageScanResult) -> None:
        """Deduplicate targets and aggregate per-manager statistics."""
        # Deduplicate targets
        result.targets = list({t.path: t for t in result.targets}.values())

        # Sort by size descending
        result.targets.sort(key=lambda t: t.size_bytes, reverse=True)
        result.total_size = sum(t.size_bytes for t in result.targets)

        # Update per-manager stats
        for target in result.targets:
            manager_name = _get_manager_for_pattern(target.pattern.name)
            if manager_name is not None and manager_name in result.by_manager:
                stats = result.by_manager[manager_name]
                stats.size_bytes += target.size_bytes
                stats.file_count += target.file_count
                stats.targets.append(target)

        # Sort by_manager by size descending
        result.by_manager = dict(
            sorted(
                result.by_manager.items(),
                key=lambda x: x[1].size_bytes,
                reverse=True,
            )
        )

    def scan(self, wsl_include_windows: bool = True) -> PackageScanResult:
        """
        Scan all package manager cache directories.

        Args:
            wsl_include_windows: If in WSL, also scan Windows cache directories

        Returns:
            PackageScanResult with detected cache targets and per-manager breakdown
        """
        platform_info = get_platform_info()
        result = self._init_stats(platform_info)

        # Get package manager cache paths
        cache_paths = get_all_cache_paths()
        paths_to_scan = cache_paths.get("package_managers", [])

        # WSL Windows path filtering
        if platform_info.is_wsl and not wsl_include_windows:
            paths_to_scan = [p for p in paths_to_scan if not str(p).startswith("/mnt/")]

        if not paths_to_scan:
            return result

        self._collect_targets(result, paths_to_scan)
        self._aggregate_stats(result)

        return result

    def _scan_directory(
        self,
        path: Path,
        result: PackageScanResult,
        depth: int = 0,
        max_depth: int = 3,
    ) -> None:
        """
        Recursively scan a directory for package manager cache patterns.

        Args:
            path: Directory path to scan
            result: PackageScanResult to populate with targets
            depth: Current recursion depth (0 = root)
            max_depth: Maximum recursion depth
        """
        if is_protected_path(path, for_scanning=True):
            return

        # At depth=0, try to match the root itself first
        if depth == 0:
            matched = self._match_against_patterns(path)
            if matched:
                target = self._create_target(path, matched)
                if target:
                    result.targets.append(target)
                return

        # Don't recurse beyond max_depth
        if depth > max_depth:
            return

        # Scan subdirectories
        try:
            with os.scandir(path) as entries:
                for entry in entries:
                    if not entry.is_dir(follow_symlinks=False):
                        continue

                    entry_path = Path(entry.path)

                    if is_protected_path(entry_path, for_scanning=True):
                        continue

                    matched = self._match_against_patterns(entry_path)
                    if matched:
                        target = self._create_target(entry_path, matched)
                        if target:
                            result.targets.append(target)
                    else:
                        # Recurse deeper for nested caches
                        self._scan_directory(entry_path, result, depth + 1, max_depth)

        except FILESYSTEM_ERRORS as e:
            result.scan_errors.append(f"{path}: {e}")

    def _match_against_patterns(self, path: Path) -> BloatPattern | None:
        """Check if path matches any package manager cache pattern."""
        name = path.name

        # Special case for Maven: "repository" is too generic, so validate parent
        if (
            self._include.get("maven", True)
            and name == "repository"
            and path.parent.name == ".m2"
        ):
            return MAVEN_PATTERN

        for pattern in self.patterns:
            if pattern.matches(name, path):
                return pattern
        return None

    def _create_target(
        self, path: Path, pattern: BloatPattern
    ) -> BloatTarget | None:
        """
        Create a BloatTarget for a path matching a pattern.

        Args:
            path: Directory path to create target for
            pattern: The matched bloat pattern

        Returns:
            BloatTarget if size meets minimum threshold, None otherwise
        """
        try:
            size, count = get_directory_size(path)
            if size >= pattern.min_size:
                return BloatTarget(
                    path=path,
                    pattern=pattern,
                    size_bytes=size,
                    file_count=count,
                )
        except FILESYSTEM_ERRORS as e:
            logger.debug("Failed to get size for %s: %s", path, e)
        return None
