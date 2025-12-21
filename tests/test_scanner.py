"""Tests for the scanner module."""

from __future__ import annotations

from pathlib import Path

import pytest

from bloat_hunter.core.scanner import Scanner, get_directory_size, format_size


class TestFormatSize:
    """Tests for format_size function."""

    def test_bytes(self):
        assert format_size(500) == "500.0 B"

    def test_kilobytes(self):
        assert format_size(1024) == "1.0 KB"

    def test_megabytes(self):
        assert format_size(1024 * 1024) == "1.0 MB"

    def test_gigabytes(self):
        assert format_size(1024 * 1024 * 1024) == "1.0 GB"


class TestGetDirectorySize:
    """Tests for get_directory_size function."""

    def test_empty_directory(self, temp_dir: Path):
        size, count = get_directory_size(temp_dir)
        assert size == 0
        assert count == 0

    def test_directory_with_files(self, temp_dir: Path):
        # Create test files
        (temp_dir / "file1.txt").write_text("hello")
        (temp_dir / "file2.txt").write_text("world")

        size, count = get_directory_size(temp_dir)
        assert size == 10  # 5 + 5 bytes
        assert count == 2

    def test_nested_directory(self, temp_dir: Path):
        # Create nested structure
        subdir = temp_dir / "subdir"
        subdir.mkdir()
        (subdir / "file.txt").write_text("test")

        size, count = get_directory_size(temp_dir)
        assert size == 4
        assert count == 1


class TestScanner:
    """Tests for Scanner class."""

    def test_scan_empty_directory(self, temp_dir: Path):
        scanner = Scanner()
        result = scanner.scan(temp_dir)

        assert result.root_path == temp_dir
        assert len(result.targets) == 0
        assert result.total_size == 0

    def test_scan_finds_node_modules(self, mock_project: Path):
        scanner = Scanner()
        result = scanner.scan(mock_project)

        node_targets = [t for t in result.targets if t.pattern.name == "node_modules"]
        assert len(node_targets) == 1

    def test_scan_finds_pycache(self, mock_project: Path):
        scanner = Scanner()
        result = scanner.scan(mock_project)

        pycache_targets = [t for t in result.targets if t.pattern.name == "__pycache__"]
        assert len(pycache_targets) == 1

    def test_scan_results_sorted_by_size(self, mock_project: Path):
        scanner = Scanner()
        result = scanner.scan(mock_project)

        if len(result.targets) > 1:
            sizes = [t.size_bytes for t in result.targets]
            assert sizes == sorted(sizes, reverse=True)
