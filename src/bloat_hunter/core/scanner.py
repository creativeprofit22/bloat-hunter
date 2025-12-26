"""Directory scanner for detecting bloat and caches."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING

from rich.console import Console
from rich.progress import BarColumn, Progress, SpinnerColumn, TaskProgressColumn, TextColumn

if TYPE_CHECKING:
    from rich.progress import TaskID

from collections.abc import Callable

from bloat_hunter.core.parallel import ParallelConfig, parallel_map
from bloat_hunter.patterns import BloatPattern, get_all_patterns
from bloat_hunter.safety.protected import is_protected_path


@dataclass
class BloatTarget:
    """Represents a detected bloat target."""

    path: Path
    pattern: BloatPattern
    size_bytes: int
    file_count: int = 0

    @property
    def size_human(self) -> str:
        """Return human-readable size."""
        return format_size(self.size_bytes)

    @property
    def category(self) -> str:
        """Return the pattern category."""
        return self.pattern.category


@dataclass
class ScanResult:
    """Results from a directory scan."""

    root_path: Path
    targets: list[BloatTarget] = field(default_factory=list)
    total_size: int = 0
    scan_errors: list[str] = field(default_factory=list)

    @property
    def total_size_human(self) -> str:
        """Return human-readable total size."""
        return format_size(self.total_size)


def format_size(size_bytes: int) -> str:
    """Convert bytes to human-readable format."""
    size = float(size_bytes)
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} PB"


def parse_size(size_str: str) -> int:
    """
    Parse human-readable size string to bytes.

    Args:
        size_str: Size string like "1KB", "10MB", "1.5GB"

    Returns:
        Size in bytes

    Raises:
        ValueError: If the size string is invalid
    """
    size_str = size_str.strip().upper()

    # Check longer units first to avoid "KB" matching "B"
    units = [
        ("TB", 1024 * 1024 * 1024 * 1024),
        ("GB", 1024 * 1024 * 1024),
        ("MB", 1024 * 1024),
        ("KB", 1024),
        ("B", 1),
    ]

    for unit, multiplier in units:
        if size_str.endswith(unit):
            try:
                value = float(size_str[: -len(unit)])
            except ValueError:
                raise ValueError(f"Invalid size value: {size_str}") from None
            if value < 0:
                raise ValueError(f"Size cannot be negative: {size_str}")
            return int(value * multiplier)

    # No unit specified, assume bytes
    try:
        value = float(size_str)
    except ValueError:
        raise ValueError(f"Invalid size string: {size_str}") from None
    if value < 0:
        raise ValueError(f"Size cannot be negative: {size_str}")
    return int(value)


def get_directory_size(path: Path) -> tuple[int, int]:
    """
    Calculate directory size efficiently using os.scandir.

    Returns:
        Tuple of (total_bytes, file_count)
    """
    total_size = 0
    file_count = 0

    try:
        with os.scandir(path) as entries:
            for entry in entries:
                try:
                    if entry.is_symlink():
                        continue
                    if entry.is_file(follow_symlinks=False):
                        total_size += entry.stat(follow_symlinks=False).st_size
                        file_count += 1
                    elif entry.is_dir(follow_symlinks=False):
                        sub_size, sub_count = get_directory_size(Path(entry.path))
                        total_size += sub_size
                        file_count += sub_count
                except (PermissionError, OSError):
                    continue
    except (PermissionError, OSError):
        pass

    return total_size, file_count


def calc_target(item: tuple[Path, BloatPattern]) -> BloatTarget | None:
    """
    Create a BloatTarget with size calculation for a matched path.

    Shared utility for cache_scanner and package_scanner.

    Args:
        item: Tuple of (path, pattern) to calculate size for

    Returns:
        BloatTarget if size meets pattern minimum, None otherwise
    """
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


def calc_size(item: tuple[Path, BloatPattern]) -> tuple[Path, BloatPattern, int, int]:
    """
    Calculate size for a matched directory.

    Args:
        item: Tuple of (path, pattern) to calculate size for

    Returns:
        Tuple of (path, pattern, size_bytes, file_count)
    """
    path, pattern = item
    size, count = get_directory_size(path)
    return (path, pattern, size, count)


def match_patterns(
    path: Path,
    patterns: list[BloatPattern],
) -> BloatPattern | None:
    """
    Check if a path matches any pattern in the list.

    Shared utility for all scanners.

    Args:
        path: Directory path to check
        patterns: List of patterns to match against

    Returns:
        First matching pattern, or None if no match
    """
    name = path.name
    for pattern in patterns:
        if pattern.matches(name, path):
            return pattern
    return None


def collect_pattern_matches(
    path: Path,
    matches: list[tuple[Path, BloatPattern]],
    scan_errors: list[str],
    pattern_matcher: Callable[[Path], BloatPattern | None],
    depth: int = 0,
    max_depth: int = 3,
) -> None:
    """
    Recursively collect pattern matches from a directory tree.

    Shared utility for cache_scanner and package_scanner.

    Args:
        path: Directory path to scan
        matches: List to append (path, pattern) tuples to
        scan_errors: List to append error messages to
        pattern_matcher: Callback to match a path against patterns
        depth: Current recursion depth (0 = root)
        max_depth: Maximum recursion depth
    """
    if is_protected_path(path, for_scanning=True):
        return

    # At depth=0, try to match the root itself first
    if depth == 0:
        matched = pattern_matcher(path)
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

                matched = pattern_matcher(entry_path)
                if matched:
                    matches.append((entry_path, matched))
                else:
                    # Recurse deeper for nested caches
                    collect_pattern_matches(
                        entry_path, matches, scan_errors, pattern_matcher,
                        depth + 1, max_depth
                    )

    except (PermissionError, OSError) as e:
        scan_errors.append(f"{path}: {e}")


class Scanner:
    """Scans directories for bloat and caches."""

    def __init__(
        self,
        console: Console | None = None,
        min_size: int = 0,
        parallel_config: ParallelConfig | None = None,
    ):
        self.console = console or Console()
        self.patterns = get_all_patterns()
        self.min_size = min_size
        self.parallel_config = parallel_config or ParallelConfig()

    def scan(self, root: Path, deep: bool = False) -> ScanResult:
        """
        Scan a directory for bloat.

        Args:
            root: Directory to scan
            deep: If True, scan deeper into subdirectories

        Returns:
            ScanResult with all detected targets
        """
        result = ScanResult(root_path=root)
        matches: list[tuple[Path, BloatPattern]] = []

        # Phase 1: Find all matching directories
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=self.console,
        ) as progress:
            task = progress.add_task("Scanning for bloat...", total=None)
            max_depth = 10 if deep else 5
            self._collect_matches(
                root, matches, result, progress, task, depth=0, max_depth=max_depth
            )

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

            for item, size_result, error in parallel_map(
                calc_size, matches, self.parallel_config
            ):
                path, pattern = item
                progress.update(task, description=f"Sizing: {path.name[:40]}")

                if error is None and size_result is not None:
                    _, _, size, count = size_result
                    # Only add if size meets minimum thresholds (pattern + user)
                    if size > 0 and size >= pattern.min_size and size >= self.min_size:
                        target = BloatTarget(
                            path=path,
                            pattern=pattern,
                            size_bytes=size,
                            file_count=count,
                        )
                        result.targets.append(target)

                progress.advance(task)

        # Sort by size descending
        result.targets.sort(key=lambda t: t.size_bytes, reverse=True)
        result.total_size = sum(t.size_bytes for t in result.targets)

        return result

    def _collect_matches(
        self,
        path: Path,
        matches: list[tuple[Path, BloatPattern]],
        result: ScanResult,
        progress: Progress,
        task_id: TaskID,
        depth: int,
        max_depth: int,
    ) -> None:
        """Recursively collect matching directories without calculating sizes."""
        if depth > max_depth:
            return

        if is_protected_path(path, for_scanning=True):
            return

        try:
            with os.scandir(path) as entries:
                for entry in entries:
                    if not entry.is_dir(follow_symlinks=False):
                        continue

                    entry_path = Path(entry.path)
                    progress.update(task_id, description=f"Scanning: {entry_path.name[:40]}")

                    # Check if this directory matches any bloat pattern
                    matched_pattern = self._match_pattern(entry_path)

                    if matched_pattern:
                        # Found bloat - add to matches for later size calculation
                        matches.append((entry_path, matched_pattern))
                        # Don't recurse into matched directories
                    else:
                        # Recurse into subdirectory
                        self._collect_matches(
                            entry_path, matches, result, progress, task_id, depth + 1, max_depth
                        )

        except (PermissionError, OSError) as e:
            result.scan_errors.append(f"{path}: {e}")

    def _match_pattern(self, path: Path) -> BloatPattern | None:
        """Check if a path matches any bloat pattern."""
        return match_patterns(path, self.patterns)
