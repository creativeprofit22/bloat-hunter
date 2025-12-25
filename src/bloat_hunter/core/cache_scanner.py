"""Specialized scanner for system cache directories."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from rich.console import Console
from rich.progress import (
    BarColumn,
    Progress,
    SpinnerColumn,
    TaskProgressColumn,
    TextColumn,
)

from bloat_hunter.core.parallel import ParallelConfig, parallel_map
from bloat_hunter.core.scanner import BloatTarget, format_size, get_directory_size
from bloat_hunter.patterns import get_system_cache_patterns
from bloat_hunter.patterns.base import BloatPattern
from bloat_hunter.platform.detect import (
    PlatformInfo,
    get_all_cache_paths,
    get_platform_info,
)
from bloat_hunter.safety.protected import is_protected_path


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
        parallel_config: Optional[ParallelConfig] = None,
    ):
        self.console = console or Console()
        self.include_browsers = include_browsers
        self.include_package_managers = include_package_managers
        self.include_apps = include_apps
        self.patterns = get_system_cache_patterns()
        self.parallel_config = parallel_config or ParallelConfig()

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

        # Phase 1: Collect all matching paths
        matches: list[tuple[Path, BloatPattern]] = []

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
                    self._collect_matches(cache_path, matches, result, depth=0)
                    result.categories_scanned[category] = (
                        result.categories_scanned.get(category, 0) + 1
                    )
                except (PermissionError, OSError) as e:
                    result.scan_errors.append(f"{cache_path}: {e}")

                progress.advance(task)

        if not matches:
            return result

        # Phase 2: Calculate sizes in parallel
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            console=self.console,
        ) as progress:
            task = progress.add_task("Calculating sizes...", total=len(matches))

            def calc_target(item: tuple[Path, BloatPattern]) -> BloatTarget | None:
                """Create target with size calculation."""
                path, pattern = item
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

            for item, target, error in parallel_map(
                calc_target, matches, self.parallel_config
            ):
                path, _ = item
                progress.update(task, description=f"Sizing: {path.name[:40]}")

                if error is None and target is not None:
                    result.targets.append(target)

                progress.advance(task)

        # Deduplicate targets (same path might be found from multiple cache roots)
        # Use dict for O(1) lookup instead of set iteration
        result.targets = list({t.path: t for t in result.targets}.values())

        # Sort by size descending
        result.targets.sort(key=lambda t: t.size_bytes, reverse=True)
        result.total_size = sum(t.size_bytes for t in result.targets)

        return result

    def _collect_matches(
        self,
        path: Path,
        matches: list[tuple[Path, BloatPattern]],
        result: CacheScanResult,
        depth: int = 0,
        max_depth: int = 3,
    ) -> None:
        """
        Recursively collect matching cache directories without calculating sizes.

        Args:
            path: Directory path to scan
            matches: List to append (path, pattern) tuples to
            result: CacheScanResult for error tracking
            depth: Current recursion depth (0 = root)
            max_depth: Maximum recursion depth
        """
        if is_protected_path(path, for_scanning=True):
            return

        # At depth=0, try to match the root itself first
        if depth == 0:
            matched = self._match_against_patterns(path)
            if matched:
                matches.append((path, matched))
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
                        matches.append((entry_path, matched))
                    else:
                        # Recurse deeper for nested caches
                        self._collect_matches(
                            entry_path, matches, result, depth + 1, max_depth
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
