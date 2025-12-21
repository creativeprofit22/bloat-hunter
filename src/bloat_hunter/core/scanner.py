"""Directory scanner for detecting bloat and caches."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn

from bloat_hunter.patterns import get_all_patterns, BloatPattern
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
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} PB"


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
                return int(value * multiplier)
            except ValueError:
                raise ValueError(f"Invalid size value: {size_str}") from None

    # No unit specified, assume bytes
    try:
        return int(float(size_str))
    except ValueError:
        raise ValueError(f"Invalid size string: {size_str}") from None


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


class Scanner:
    """Scans directories for bloat and caches."""

    def __init__(self, console: Optional[Console] = None):
        self.console = console or Console()
        self.patterns = get_all_patterns()

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

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            console=self.console,
        ) as progress:
            task = progress.add_task("Scanning for bloat...", total=None)

            self._scan_directory(root, result, progress, task, depth=0, max_depth=10 if deep else 5)

        # Sort by size descending
        result.targets.sort(key=lambda t: t.size_bytes, reverse=True)
        result.total_size = sum(t.size_bytes for t in result.targets)

        return result

    def _scan_directory(
        self,
        path: Path,
        result: ScanResult,
        progress: Progress,
        task_id: int,
        depth: int,
        max_depth: int,
    ) -> None:
        """Recursively scan a directory."""
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
                        # Found bloat - calculate size and add to results
                        size, count = get_directory_size(entry_path)
                        # Only add if size meets minimum threshold
                        if size > 0 and size >= matched_pattern.min_size:
                            target = BloatTarget(
                                path=entry_path,
                                pattern=matched_pattern,
                                size_bytes=size,
                                file_count=count,
                            )
                            result.targets.append(target)
                        # Don't recurse into matched directories
                    else:
                        # Recurse into subdirectory
                        self._scan_directory(
                            entry_path, result, progress, task_id, depth + 1, max_depth
                        )

        except (PermissionError, OSError) as e:
            result.scan_errors.append(f"{path}: {e}")

    def _match_pattern(self, path: Path) -> Optional[BloatPattern]:
        """Check if a path matches any bloat pattern."""
        name = path.name

        for pattern in self.patterns:
            if pattern.matches(name, path):
                return pattern

        return None
