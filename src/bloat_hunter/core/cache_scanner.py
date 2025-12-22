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
                    self._scan_cache_root(cache_path, category, result)
                    result.categories_scanned[category] = (
                        result.categories_scanned.get(category, 0) + 1
                    )
                except Exception as e:
                    result.scan_errors.append(f"{cache_path}: {e}")

                progress.advance(task)

        # Deduplicate targets (same path might be found from multiple cache roots)
        seen_paths: set[Path] = set()
        unique_targets: list[BloatTarget] = []
        for target in result.targets:
            if target.path not in seen_paths:
                seen_paths.add(target.path)
                unique_targets.append(target)
        result.targets = unique_targets

        # Sort by size descending
        result.targets.sort(key=lambda t: t.size_bytes, reverse=True)
        result.total_size = sum(t.size_bytes for t in result.targets)

        return result

    def _scan_cache_root(
        self,
        root: Path,
        category: str,
        result: CacheScanResult,
    ) -> None:
        """Scan a cache root directory."""
        if is_protected_path(root, for_scanning=True):
            return

        # Try to match the root itself against patterns
        matched = self._match_against_patterns(root)
        if matched:
            size, count = get_directory_size(root)
            if size >= matched.min_size:
                result.targets.append(
                    BloatTarget(
                        path=root,
                        pattern=matched,
                        size_bytes=size,
                        file_count=count,
                    )
                )
            return

        # Otherwise, scan subdirectories
        try:
            with os.scandir(root) as entries:
                for entry in entries:
                    if not entry.is_dir(follow_symlinks=False):
                        continue

                    entry_path = Path(entry.path)

                    if is_protected_path(entry_path, for_scanning=True):
                        continue

                    matched = self._match_against_patterns(entry_path)
                    if matched:
                        size, count = get_directory_size(entry_path)
                        if size >= matched.min_size:
                            result.targets.append(
                                BloatTarget(
                                    path=entry_path,
                                    pattern=matched,
                                    size_bytes=size,
                                    file_count=count,
                                )
                            )
                    else:
                        # Recurse one more level for nested caches
                        self._scan_subdirectory(
                            entry_path, result, depth=1, max_depth=3
                        )

        except (PermissionError, OSError) as e:
            result.scan_errors.append(f"{root}: {e}")

    def _scan_subdirectory(
        self,
        path: Path,
        result: CacheScanResult,
        depth: int,
        max_depth: int,
    ) -> None:
        """Recursively scan subdirectories for cache patterns."""
        if depth > max_depth:
            return

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
                        size, count = get_directory_size(entry_path)
                        if size >= matched.min_size:
                            result.targets.append(
                                BloatTarget(
                                    path=entry_path,
                                    pattern=matched,
                                    size_bytes=size,
                                    file_count=count,
                                )
                            )
                    else:
                        self._scan_subdirectory(
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
