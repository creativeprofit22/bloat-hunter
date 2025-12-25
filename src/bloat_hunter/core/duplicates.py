"""Duplicate file detection module."""

from __future__ import annotations

import os
from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Literal, Optional, Protocol

from rich.console import Console
from rich.progress import BarColumn, Progress, SpinnerColumn, TaskProgressColumn, TextColumn

from bloat_hunter.core.parallel import ParallelConfig, parallel_map
from bloat_hunter.core.scanner import format_size
from bloat_hunter.safety.protected import is_protected_path

if TYPE_CHECKING:
    from rich.progress import TaskID


class Hasher(Protocol):
    """Protocol for hash objects (xxhash or hashlib)."""

    def update(self, data: bytes) -> None: ...
    def hexdigest(self) -> str: ...

# Default minimum file size (1 MB)
DEFAULT_MIN_SIZE = 1024 * 1024

# Chunk size for reading files (64KB)
CHUNK_SIZE = 65536

KeepStrategy = Literal["first", "shortest", "oldest", "newest"]


@dataclass
class DuplicateFile:
    """A single file that is part of a duplicate group."""

    path: Path
    size_bytes: int
    mtime: float

    @property
    def size_human(self) -> str:
        """Return human-readable size."""
        return format_size(self.size_bytes)


@dataclass
class DuplicateGroup:
    """A group of files with identical content."""

    hash_value: str
    size_bytes: int
    files: list[DuplicateFile] = field(default_factory=list)

    @property
    def duplicate_count(self) -> int:
        """Number of duplicate copies (excludes the original)."""
        return len(self.files) - 1

    @property
    def wasted_bytes(self) -> int:
        """Bytes wasted by duplicates."""
        return self.size_bytes * self.duplicate_count

    @property
    def wasted_human(self) -> str:
        """Return human-readable wasted size."""
        return format_size(self.wasted_bytes)

    @property
    def size_human(self) -> str:
        """Return human-readable file size."""
        return format_size(self.size_bytes)

    def get_keep_file(self, strategy: KeepStrategy) -> DuplicateFile:
        """Determine which file to keep based on strategy."""
        if not self.files:
            raise ValueError("Cannot get keep file from empty DuplicateGroup")
        if strategy == "shortest":
            return min(self.files, key=lambda f: len(str(f.path)))
        elif strategy == "oldest":
            return min(self.files, key=lambda f: f.mtime)
        elif strategy == "newest":
            return max(self.files, key=lambda f: f.mtime)
        else:  # "first" or default
            return self.files[0]

    def get_duplicates_to_remove(self, strategy: KeepStrategy) -> list[DuplicateFile]:
        """Get list of duplicate files to remove (all except the one to keep)."""
        keep = self.get_keep_file(strategy)
        return [f for f in self.files if f.path != keep.path]


@dataclass
class DuplicateResult:
    """Results from a duplicate file scan."""

    root_path: Path
    groups: list[DuplicateGroup] = field(default_factory=list)
    total_wasted: int = 0
    files_scanned: int = 0
    scan_errors: list[str] = field(default_factory=list)

    @property
    def total_wasted_human(self) -> str:
        """Return human-readable total wasted size."""
        return format_size(self.total_wasted)

    @property
    def total_duplicates(self) -> int:
        """Total number of duplicate files across all groups."""
        return sum(g.duplicate_count for g in self.groups)


def _get_hasher() -> Callable[[], Hasher]:
    """Get the best available hash function."""
    try:
        import xxhash

        return lambda: xxhash.xxh3_64()
    except ImportError:
        import hashlib

        return lambda: hashlib.blake2b(digest_size=8)


def hash_file(path: Path) -> Optional[str]:
    """
    Hash a file's contents.

    Args:
        path: Path to the file to hash

    Returns:
        Hex digest of the file, or None if file cannot be read.
    """
    hasher_factory = _get_hasher()
    hasher = hasher_factory()

    try:
        with open(path, "rb") as f:
            while chunk := f.read(CHUNK_SIZE):
                hasher.update(chunk)
        return hasher.hexdigest()
    except (PermissionError, OSError):
        return None


class DuplicateScanner:
    """Scans directories for duplicate files."""

    def __init__(
        self,
        console: Optional[Console] = None,
        min_size: int = DEFAULT_MIN_SIZE,
        parallel_config: Optional[ParallelConfig] = None,
    ):
        self.console = console or Console()
        self.min_size = min_size
        self.parallel_config = parallel_config or ParallelConfig()

    def scan(self, root: Path) -> DuplicateResult:
        """
        Scan a directory for duplicate files.

        Uses two-phase approach:
        1. Group files by size (fast)
        2. Hash only same-size files (expensive but fewer)

        Args:
            root: Directory to scan

        Returns:
            DuplicateResult with all duplicate groups
        """
        result = DuplicateResult(root_path=root)

        # Phase 1: Collect all files grouped by size
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=self.console,
        ) as progress:
            task = progress.add_task("Scanning files by size...", total=None)

            size_groups: dict[int, list[Path]] = defaultdict(list)
            self._collect_files_by_size(root, size_groups, result, progress, task)

        # Filter to only sizes with 2+ files
        candidate_groups = {
            size: paths for size, paths in size_groups.items() if len(paths) >= 2
        }

        if not candidate_groups:
            return result

        # Phase 2: Hash files with matching sizes (parallel)
        total_candidates = sum(len(paths) for paths in candidate_groups.values())

        # Flatten candidate groups into list of (size, path) tuples for parallel processing
        candidates: list[tuple[int, Path]] = []
        for size, paths in candidate_groups.items():
            for path in paths:
                candidates.append((size, path))

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            console=self.console,
        ) as progress:
            task = progress.add_task("Hashing candidates...", total=total_candidates)

            hash_groups: dict[str, DuplicateGroup] = {}

            # Hash files in parallel
            def hash_candidate(item: tuple[int, Path]) -> tuple[int, Path, str | None, float]:
                """Hash a single file and return metadata."""
                size, path = item
                file_hash = hash_file(path)
                try:
                    mtime = path.stat().st_mtime
                except OSError:
                    mtime = 0.0
                return (size, path, file_hash, mtime)

            for item, hash_result, error in parallel_map(
                hash_candidate, candidates, self.parallel_config
            ):
                size, path = item
                progress.update(task, description=f"Hashing: {path.name[:40]}")

                if error is not None or hash_result is None:
                    progress.advance(task)
                    continue

                _, _, file_hash, mtime = hash_result
                if file_hash is None:
                    progress.advance(task)
                    continue

                # Create composite key: size + hash
                key = f"{size}:{file_hash}"

                if key not in hash_groups:
                    hash_groups[key] = DuplicateGroup(
                        hash_value=file_hash,
                        size_bytes=size,
                    )

                hash_groups[key].files.append(
                    DuplicateFile(
                        path=path,
                        size_bytes=size,
                        mtime=mtime,
                    )
                )

                progress.advance(task)

        # Filter to only groups with actual duplicates
        result.groups = [group for group in hash_groups.values() if len(group.files) >= 2]

        # Sort by wasted space descending
        result.groups.sort(key=lambda g: g.wasted_bytes, reverse=True)

        # Calculate totals
        result.total_wasted = sum(g.wasted_bytes for g in result.groups)

        return result

    def _collect_files_by_size(
        self,
        path: Path,
        size_groups: dict[int, list[Path]],
        result: DuplicateResult,
        progress: Progress,
        task_id: TaskID,
    ) -> None:
        """Recursively collect files grouped by size."""
        if is_protected_path(path, for_scanning=True):
            return

        try:
            with os.scandir(path) as entries:
                for entry in entries:
                    try:
                        if entry.is_symlink():
                            continue

                        if entry.is_file(follow_symlinks=False):
                            stat = entry.stat(follow_symlinks=False)
                            size = stat.st_size

                            # Skip files below minimum size
                            if size >= self.min_size:
                                size_groups[size].append(Path(entry.path))
                                result.files_scanned += 1

                            progress.update(
                                task_id, description=f"Scanning: {entry.name[:40]}"
                            )

                        elif entry.is_dir(follow_symlinks=False):
                            self._collect_files_by_size(
                                Path(entry.path),
                                size_groups,
                                result,
                                progress,
                                task_id,
                            )

                    except (PermissionError, OSError):
                        continue

        except (PermissionError, OSError) as e:
            result.scan_errors.append(f"{path}: {e}")
