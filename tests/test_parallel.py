"""Tests for parallel execution utilities."""

from __future__ import annotations

import time
from pathlib import Path

import pytest

from bloat_hunter.core.parallel import (
    DEFAULT_WORKERS,
    ParallelConfig,
    get_directory_sizes_parallel,
    parallel_map,
    parallel_map_ordered,
)


class TestParallelConfig:
    """Tests for ParallelConfig dataclass."""

    def test_defaults(self) -> None:
        """Test default configuration values."""
        config = ParallelConfig()
        assert config.enabled is True
        assert config.max_workers == DEFAULT_WORKERS

    def test_custom_values(self) -> None:
        """Test custom configuration values."""
        config = ParallelConfig(enabled=False, max_workers=4)
        assert config.enabled is False
        assert config.max_workers == 4

    def test_min_workers_clamp(self) -> None:
        """Test that workers < 1 are clamped to 1."""
        config = ParallelConfig(max_workers=0)
        assert config.max_workers == 1

        config = ParallelConfig(max_workers=-5)
        assert config.max_workers == 1

    def test_max_workers_clamp(self) -> None:
        """Test that workers > 32 are clamped to 32."""
        config = ParallelConfig(max_workers=100)
        assert config.max_workers == 32


class TestParallelMap:
    """Tests for parallel_map function."""

    def test_empty_list(self) -> None:
        """Test with empty input list."""
        results = list(parallel_map(lambda x: x * 2, []))
        assert results == []

    def test_single_item_sequential(self) -> None:
        """Test that single item uses sequential execution."""
        results = list(parallel_map(lambda x: x * 2, [5]))
        assert len(results) == 1
        item, result, error = results[0]
        assert item == 5
        assert result == 10
        assert error is None

    def test_disabled_parallel(self) -> None:
        """Test sequential execution when parallel is disabled."""
        config = ParallelConfig(enabled=False)
        results = list(parallel_map(lambda x: x * 2, [1, 2, 3], config))

        # Should still work, just sequentially
        assert len(results) == 3
        values = {item: result for item, result, _ in results}
        assert values == {1: 2, 2: 4, 3: 6}

    def test_parallel_execution(self) -> None:
        """Test parallel execution with multiple items."""
        config = ParallelConfig(enabled=True, max_workers=4)
        results = list(parallel_map(lambda x: x ** 2, [1, 2, 3, 4, 5], config))

        assert len(results) == 5
        values = {item: result for item, result, _ in results}
        assert values == {1: 1, 2: 4, 3: 9, 4: 16, 5: 25}

    def test_error_handling(self) -> None:
        """Test that errors are captured per item."""
        def maybe_fail(x: int) -> int:
            if x == 3:
                raise ValueError("Three is unlucky")
            return x * 2

        results = list(parallel_map(maybe_fail, [1, 2, 3, 4]))

        # Should have 4 results
        assert len(results) == 4

        # Find the error result
        for item, result, error in results:
            if item == 3:
                assert result is None
                assert error is not None
                assert "Three is unlucky" in str(error)
            else:
                assert result == item * 2
                assert error is None

    def test_actually_parallel(self) -> None:
        """Test that execution is actually parallel (faster than sequential)."""
        def slow_task(x: int) -> int:
            time.sleep(0.05)  # 50ms per task
            return x

        items = list(range(8))
        config = ParallelConfig(enabled=True, max_workers=8)

        start = time.time()
        results = list(parallel_map(slow_task, items, config))
        parallel_time = time.time() - start

        # With 8 workers, 8 items taking 50ms each should complete in ~50-100ms
        # Sequential would take 8 * 50 = 400ms
        assert len(results) == 8
        assert parallel_time < 0.3  # Should be much faster than 400ms


class TestParallelMapOrdered:
    """Tests for parallel_map_ordered function."""

    def test_preserves_order(self) -> None:
        """Test that results are returned in original order."""
        def slow_varying(x: int) -> int:
            # Varying delays to ensure order could be scrambled
            time.sleep(0.01 * (5 - x))
            return x * 10

        items = [1, 2, 3, 4, 5]
        config = ParallelConfig(enabled=True, max_workers=5)

        results = parallel_map_ordered(slow_varying, items, config)

        # Results should be in same order as input
        assert len(results) == 5
        for i, (item, result, error) in enumerate(results):
            assert item == items[i]
            assert result == items[i] * 10
            assert error is None

    def test_empty_list(self) -> None:
        """Test with empty input list."""
        results = parallel_map_ordered(lambda x: x, [])
        assert results == []

    def test_error_in_order(self) -> None:
        """Test that errors are also in order."""
        def maybe_fail(x: int) -> int:
            if x == 2:
                raise ValueError("Two fails")
            return x

        results = parallel_map_ordered(maybe_fail, [1, 2, 3])

        assert len(results) == 3

        # Check order is preserved
        assert results[0] == (1, 1, None)
        assert results[1][0] == 2  # item
        assert results[1][1] is None  # result
        assert results[1][2] is not None  # error
        assert results[2] == (3, 3, None)


class TestGetDirectorySizesParallel:
    """Tests for get_directory_sizes_parallel function."""

    def test_empty_list(self) -> None:
        """Test with empty path list."""
        result = get_directory_sizes_parallel([], lambda p: (100, 10))
        assert result == {}

    def test_single_path(self, temp_dir: Path) -> None:
        """Test with single path."""
        (temp_dir / "file.txt").write_bytes(b"x" * 100)

        def size_func(p: Path) -> tuple[int, int]:
            return (100, 1)

        result = get_directory_sizes_parallel([temp_dir], size_func)
        assert temp_dir in result
        assert result[temp_dir] == (100, 1)

    def test_multiple_paths(self, temp_dir: Path) -> None:
        """Test with multiple paths."""
        dir1 = temp_dir / "dir1"
        dir2 = temp_dir / "dir2"
        dir1.mkdir()
        dir2.mkdir()

        sizes = {dir1: (100, 1), dir2: (200, 2)}

        def size_func(p: Path) -> tuple[int, int]:
            return sizes[p]

        result = get_directory_sizes_parallel([dir1, dir2], size_func)
        assert result == sizes

    def test_error_handling(self, temp_dir: Path) -> None:
        """Test that errors are handled gracefully."""
        dir1 = temp_dir / "dir1"
        dir2 = temp_dir / "dir2"
        dir1.mkdir()
        dir2.mkdir()

        def size_func(p: Path) -> tuple[int, int]:
            if p.name == "dir2":
                raise PermissionError("Cannot read")
            return (100, 1)

        result = get_directory_sizes_parallel([dir1, dir2], size_func)

        # dir2 should be omitted due to error
        assert dir1 in result
        assert dir2 not in result
        assert result[dir1] == (100, 1)
