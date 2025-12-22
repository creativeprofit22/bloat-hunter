"""Specialized scanner for system cache directories."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from rich.console import Console
from rich.progress import (
    Progress,
    SpinnerColumn,
    TextColumn,
    BarColumn,
    TaskProgressColumn,
)

from bloat_hunter.platform.detect import (
    get_platform_info,
    get_all_cache_paths,
    PlatformInfo,
)
from bloat_hunter.patterns import get_system_cache_patterns
from bloat_hunter.patterns.base import BloatPattern
from bloat_hunter.safety.protected import is_protected_path
from bloat_hunter.core.scanner import BloatTarget, format_size, get_directory_size


@dataclass
class CacheScanResult:
    """Results from a system cache scan."""

    platform_info: PlatformInfo
    targets: list[BloatTarget] = field(default_factory=list)
    total_size: int = 0
    scan_errors: list[str] = field(default_factory=list)
    categories_scanned: dict[str, int] = field(default_factory=dict)

    @property
    def total_size_human(self) -> str:
        return format_size(self.total_size)


class CacheScanner:
    """Scans system cache directories specifically."""

    def __init__(
        self,
        console: Optional[Console] = None,
        include_browsers: bool = True,
        include_package_managers: bool = True,
        include_apps: bool = True,
    ):
        self.console = console or Console()
        self.include_browsers = include_browsers
        self.include_package_managers = include_package_managers
        self.include_apps = include_apps
        self.patterns = get_system_cache_patterns()

    def scan(self, wsl_include_windows: bool = True) -> CacheScanResult:
        """
        Scan all system cache directories.

        Args:
            wsl_include_windows: If in WSL, also scan Windows cache directories

        Returns:
            CacheScanResult with detected cache targets
        """
        platform_info = get_platform_info()
        result = CacheScanResult(platform_info=platform_info)

        # Get categorized cache paths
        cache_paths = get_all_cache_paths()

        # Build list of paths to scan based on options
        paths_to_scan: list[tuple[str, Path]] = []

        # Always include system caches
        paths_to_scan.extend([("system", p) for p in cache_paths.get("system", [])])

        if self.include_browsers:
            paths_to_scan.extend(
                [("browser", p) for p in cache_paths.get("browser", [])]
            )

        if self.include_package_managers:
            paths_to_scan.extend(
                [("package_managers", p) for p in cache_paths.get("package_managers", [])]
            )

        if self.include_apps:
            paths_to_scan.extend([("apps", p) for p in cache_paths.get("apps", [])])

        # WSL Windows path filtering
        if platform_info.is_wsl and not wsl_include_windows:
            paths_to_scan = [
                (cat, p) for cat, p in paths_to_scan if not str(p).startswith("/mnt/")
            ]

        if not paths_to_scan:
            return result

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            console=self.console,
        ) as progress:
            task = progress.add_task(
                "Scanning system caches...", total=len(paths_to_scan)
            )

            for category, cache_path in paths_to_scan:
                progress.update(task, description=f"Scanning: {cache_path.name}")

                try:
                    self._scan_directory(cache_path, result, depth=0)
                    result.categories_scanned[category] = (
                        result.categories_scanned.get(category, 0) + 1
                    )
                except Exception as e:
                    result.scan_errors.append(f"{cache_path}: {e}")

                progress.advance(task)

        # Deduplicate targets (same path might be found from multiple cache roots)
        # Use dict for O(1) lookup instead of set iteration
        result.targets = list({t.path: t for t in result.targets}.values())

        # Sort by size descending
        result.targets.sort(key=lambda t: t.size_bytes, reverse=True)
        result.total_size = sum(t.size_bytes for t in result.targets)

        return result

    def _scan_directory(
        self,
        path: Path,
        result: CacheScanResult,
        depth: int = 0,
        max_depth: int = 3,
    ) -> None:
        """
        Recursively scan a directory for cache patterns.

        Args:
            path: Directory path to scan
            result: CacheScanResult to populate with targets
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
                        self._scan_directory(
                            entry_path, result, depth + 1, max_depth
                        )

        except (PermissionError, OSError) as e:
            result.scan_errors.append(f"{path}: {e}")

    def _match_against_patterns(self, path: Path) -> Optional[BloatPattern]:
        """Check if path matches any cache pattern."""
        name = path.name
        for pattern in self.patterns:
            if pattern.matches(name, path):
                return pattern
        return None

    def _create_target(
        self, path: Path, pattern: BloatPattern
    ) -> Optional[BloatTarget]:
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
        except (PermissionError, OSError):
            pass
        return None
