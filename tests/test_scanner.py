"""Tests for the scanner module."""

from __future__ import annotations

from pathlib import Path

import pytest
from bloat_hunter.core.scanner import Scanner, format_size, get_directory_size, parse_size


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

    def test_scan_with_min_size_filters_small_targets(self, mock_project: Path):
        """Test that min_size parameter filters out small targets."""
        # First scan without filter to verify we find targets
        scanner_no_filter = Scanner()
        result_no_filter = scanner_no_filter.scan(mock_project)
        assert len(result_no_filter.targets) > 0

        # Now scan with a very large min_size filter
        scanner_with_filter = Scanner(min_size=1024 * 1024 * 1024)  # 1GB
        result_with_filter = scanner_with_filter.scan(mock_project)

        # Large filter should exclude small targets
        assert len(result_with_filter.targets) < len(result_no_filter.targets)

    def test_scan_min_size_zero_includes_all(self, mock_project: Path):
        """Test that min_size=0 includes all targets (default behavior)."""
        scanner = Scanner(min_size=0)
        result = scanner.scan(mock_project)

        # Should find at least the node_modules target
        assert len(result.targets) >= 1


class TestParseSize:
    """Tests for parse_size function."""

    def test_parse_bytes(self):
        assert parse_size("100") == 100
        assert parse_size("100B") == 100
        assert parse_size("100b") == 100

    def test_parse_kilobytes(self):
        assert parse_size("1KB") == 1024
        assert parse_size("1kb") == 1024
        assert parse_size("2KB") == 2048

    def test_parse_megabytes(self):
        assert parse_size("1MB") == 1024 * 1024
        assert parse_size("10MB") == 10 * 1024 * 1024

    def test_parse_gigabytes(self):
        assert parse_size("1GB") == 1024 * 1024 * 1024

    def test_parse_terabytes(self):
        assert parse_size("1TB") == 1024 * 1024 * 1024 * 1024

    def test_parse_decimal_values(self):
        assert parse_size("1.5MB") == int(1.5 * 1024 * 1024)
        assert parse_size("0.5GB") == int(0.5 * 1024 * 1024 * 1024)

    def test_parse_with_whitespace(self):
        assert parse_size("  10MB  ") == 10 * 1024 * 1024

    def test_parse_invalid_raises_value_error(self):
        with pytest.raises(ValueError):
            parse_size("invalid")
        with pytest.raises(ValueError):
            parse_size("MB10")
        with pytest.raises(ValueError):
            parse_size("")

    def test_parse_negative_raises_value_error(self):
        with pytest.raises(ValueError, match="cannot be negative"):
            parse_size("-10MB")
        with pytest.raises(ValueError, match="cannot be negative"):
            parse_size("-100")
        with pytest.raises(ValueError, match="cannot be negative"):
            parse_size("-1.5GB")
