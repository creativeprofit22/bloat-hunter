"""Specialized scanner for system cache directories."""

from __future__ import annotations

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

from bloat_hunter.core.parallel import ParallelConfig, parallel_map
from bloat_hunter.core.scanner import (
    BloatTarget,
    calc_target,
    collect_pattern_matches,
    format_size,
    match_patterns,
)
from bloat_hunter.patterns import get_system_cache_patterns
from bloat_hunter.patterns.base import BloatPattern
from bloat_hunter.platform.detect import (
    PlatformInfo,
    get_all_cache_paths,
    get_platform_info,
)


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
        console: Console | None = None,
        include_browsers: bool = True,
        include_package_managers: bool = True,
        include_apps: bool = True,
        parallel_config: ParallelConfig | None = None,
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
        """Collect matching cache directories without calculating sizes."""
        collect_pattern_matches(
            path, matches, result.scan_errors,
            self._match_against_patterns, depth, max_depth
        )

    def _match_against_patterns(self, path: Path) -> BloatPattern | None:
        """Check if path matches any cache pattern."""
        return match_patterns(path, self.patterns)
