"""Tests for duplicate file detection."""

from __future__ import annotations

from pathlib import Path

import pytest
from bloat_hunter.core.duplicates import (
    DuplicateFile,
    DuplicateGroup,
    DuplicateResult,
    DuplicateScanner,
    hash_file,
)
from bloat_hunter.core.scanner import parse_size


class TestHashFile:
    """Tests for hash_file function."""

    def test_hash_identical_files(self, temp_dir: Path):
        """Identical files should produce identical hashes."""
        content = b"test content for hashing"
        file1 = temp_dir / "file1.txt"
        file2 = temp_dir / "file2.txt"
        file1.write_bytes(content)
        file2.write_bytes(content)

        hash1 = hash_file(file1)
        hash2 = hash_file(file2)

        assert hash1 is not None
        assert hash2 is not None
        assert hash1 == hash2

    def test_hash_different_files(self, temp_dir: Path):
        """Different files should produce different hashes."""
        file1 = temp_dir / "file1.txt"
        file2 = temp_dir / "file2.txt"
        file1.write_bytes(b"content A")
        file2.write_bytes(b"content B")

        hash1 = hash_file(file1)
        hash2 = hash_file(file2)

        assert hash1 is not None
        assert hash2 is not None
        assert hash1 != hash2

    def test_hash_nonexistent_file(self, temp_dir: Path):
        """Nonexistent file should return None."""
        result = hash_file(temp_dir / "nonexistent.txt")
        assert result is None

    def test_hash_empty_file(self, temp_dir: Path):
        """Empty files should produce a hash."""
        file = temp_dir / "empty.txt"
        file.write_bytes(b"")

        result = hash_file(file)
        assert result is not None


class TestDuplicateGroup:
    """Tests for DuplicateGroup dataclass."""

    def test_duplicate_count(self):
        """duplicate_count should return n-1."""
        group = DuplicateGroup(
            hash_value="abc123",
            size_bytes=1000,
            files=[
                DuplicateFile(path=Path("/a.txt"), size_bytes=1000, mtime=1.0),
                DuplicateFile(path=Path("/b.txt"), size_bytes=1000, mtime=2.0),
                DuplicateFile(path=Path("/c.txt"), size_bytes=1000, mtime=3.0),
            ],
        )
        assert group.duplicate_count == 2

    def test_wasted_bytes(self):
        """wasted_bytes should be size * (count - 1)."""
        group = DuplicateGroup(
            hash_value="abc123",
            size_bytes=1000,
            files=[
                DuplicateFile(path=Path("/a.txt"), size_bytes=1000, mtime=1.0),
                DuplicateFile(path=Path("/b.txt"), size_bytes=1000, mtime=2.0),
            ],
        )
        assert group.wasted_bytes == 1000

    def test_keep_first_strategy(self):
        """keep=first should return the first file."""
        files = [
            DuplicateFile(path=Path("/first.txt"), size_bytes=1000, mtime=1.0),
            DuplicateFile(path=Path("/second.txt"), size_bytes=1000, mtime=2.0),
        ]
        group = DuplicateGroup(hash_value="abc", size_bytes=1000, files=files)

        keep = group.get_keep_file("first")
        assert keep.path == Path("/first.txt")

    def test_keep_shortest_strategy(self):
        """keep=shortest should return the file with shortest path."""
        files = [
            DuplicateFile(path=Path("/very/long/path/file.txt"), size_bytes=1000, mtime=1.0),
            DuplicateFile(path=Path("/short.txt"), size_bytes=1000, mtime=2.0),
        ]
        group = DuplicateGroup(hash_value="abc", size_bytes=1000, files=files)

        keep = group.get_keep_file("shortest")
        assert keep.path == Path("/short.txt")

    def test_keep_oldest_strategy(self):
        """keep=oldest should return the file with oldest mtime."""
        files = [
            DuplicateFile(path=Path("/new.txt"), size_bytes=1000, mtime=200.0),
            DuplicateFile(path=Path("/old.txt"), size_bytes=1000, mtime=100.0),
        ]
        group = DuplicateGroup(hash_value="abc", size_bytes=1000, files=files)

        keep = group.get_keep_file("oldest")
        assert keep.path == Path("/old.txt")

    def test_keep_newest_strategy(self):
        """keep=newest should return the file with newest mtime."""
        files = [
            DuplicateFile(path=Path("/old.txt"), size_bytes=1000, mtime=100.0),
            DuplicateFile(path=Path("/new.txt"), size_bytes=1000, mtime=200.0),
        ]
        group = DuplicateGroup(hash_value="abc", size_bytes=1000, files=files)

        keep = group.get_keep_file("newest")
        assert keep.path == Path("/new.txt")

    def test_get_duplicates_to_remove(self):
        """get_duplicates_to_remove should return all except the kept file."""
        files = [
            DuplicateFile(path=Path("/a.txt"), size_bytes=1000, mtime=1.0),
            DuplicateFile(path=Path("/b.txt"), size_bytes=1000, mtime=2.0),
            DuplicateFile(path=Path("/c.txt"), size_bytes=1000, mtime=3.0),
        ]
        group = DuplicateGroup(hash_value="abc", size_bytes=1000, files=files)

        to_remove = group.get_duplicates_to_remove("first")
        assert len(to_remove) == 2
        paths = [f.path for f in to_remove]
        assert Path("/a.txt") not in paths
        assert Path("/b.txt") in paths
        assert Path("/c.txt") in paths


class TestDuplicateScanner:
    """Tests for DuplicateScanner."""

    def test_finds_duplicates(self, duplicate_files_small: Path):
        """Scanner should find duplicate files."""
        scanner = DuplicateScanner(min_size=0)
        result = scanner.scan(duplicate_files_small)

        assert len(result.groups) == 1
        assert result.groups[0].duplicate_count == 2  # 3 files - 1 original
        assert result.total_duplicates == 2

    def test_ignores_unique_files(self, duplicate_files_small: Path):
        """Scanner should not report unique files as duplicates."""
        scanner = DuplicateScanner(min_size=0)
        result = scanner.scan(duplicate_files_small)

        # The unique file should not appear in any group
        all_paths = [
            str(f.path) for g in result.groups for f in g.files
        ]
        assert not any("unique" in p for p in all_paths)

    def test_respects_min_size(self, duplicate_files: Path):
        """Scanner should skip files below min_size."""
        # With default min_size (1MB), small duplicates should be ignored
        scanner = DuplicateScanner(min_size=1024 * 1024)
        result = scanner.scan(duplicate_files)

        # Should only find the large duplicates, not the small ones
        assert len(result.groups) == 1
        assert result.groups[0].size_bytes > 1024 * 1024

    def test_finds_all_with_min_size_zero(self, duplicate_files: Path):
        """Scanner with min_size=0 should find all duplicates."""
        scanner = DuplicateScanner(min_size=0)
        result = scanner.scan(duplicate_files)

        # Should find both large and small duplicate groups
        assert len(result.groups) == 2

    def test_calculates_wasted_space(self, duplicate_files_small: Path):
        """Scanner should correctly calculate wasted space."""
        scanner = DuplicateScanner(min_size=0)
        result = scanner.scan(duplicate_files_small)

        # Wasted = file_size * (copies - 1)
        content_size = len(b"duplicate content here")
        expected_wasted = content_size * 2  # 3 copies, 2 are "duplicates"
        assert result.total_wasted == expected_wasted

    def test_empty_directory(self, temp_dir: Path):
        """Scanner should handle empty directories."""
        scanner = DuplicateScanner(min_size=0)
        result = scanner.scan(temp_dir)

        assert len(result.groups) == 0
        assert result.total_wasted == 0
        assert result.files_scanned == 0

    def test_sorts_by_wasted_space(self, temp_dir: Path):
        """Results should be sorted by wasted space descending."""
        # Create two groups of duplicates with different sizes
        small_content = b"small"
        large_content = b"x" * 10000

        # Small duplicates
        (temp_dir / "small1.txt").write_bytes(small_content)
        (temp_dir / "small2.txt").write_bytes(small_content)

        # Large duplicates
        (temp_dir / "large1.bin").write_bytes(large_content)
        (temp_dir / "large2.bin").write_bytes(large_content)

        scanner = DuplicateScanner(min_size=0)
        result = scanner.scan(temp_dir)

        assert len(result.groups) == 2
        # Larger files should be first
        assert result.groups[0].size_bytes > result.groups[1].size_bytes


class TestParseSize:
    """Tests for parse_size utility."""

    def test_parse_bytes(self):
        """Should parse plain bytes."""
        assert parse_size("1024") == 1024
        assert parse_size("100B") == 100

    def test_parse_kilobytes(self):
        """Should parse kilobytes."""
        assert parse_size("1KB") == 1024
        assert parse_size("10kb") == 10240

    def test_parse_megabytes(self):
        """Should parse megabytes."""
        assert parse_size("1MB") == 1024 * 1024
        assert parse_size("5mb") == 5 * 1024 * 1024

    def test_parse_gigabytes(self):
        """Should parse gigabytes."""
        assert parse_size("1GB") == 1024 * 1024 * 1024

    def test_parse_terabytes(self):
        """Should parse terabytes."""
        assert parse_size("1TB") == 1024 * 1024 * 1024 * 1024

    def test_parse_decimal(self):
        """Should handle decimal values."""
        assert parse_size("1.5MB") == int(1.5 * 1024 * 1024)

    def test_parse_with_whitespace(self):
        """Should handle whitespace."""
        assert parse_size("  10MB  ") == 10 * 1024 * 1024

    def test_invalid_value(self):
        """Should raise ValueError for invalid input."""
        with pytest.raises(ValueError):
            parse_size("invalid")

    def test_invalid_unit(self):
        """Should treat invalid units as bytes."""
        # Without a recognized unit, it tries to parse as plain number
        with pytest.raises(ValueError):
            parse_size("10XB")


class TestDuplicateResult:
    """Tests for DuplicateResult dataclass."""

    def test_total_duplicates(self):
        """total_duplicates should sum across all groups."""
        groups = [
            DuplicateGroup(
                hash_value="a",
                size_bytes=100,
                files=[
                    DuplicateFile(path=Path("/a1"), size_bytes=100, mtime=1.0),
                    DuplicateFile(path=Path("/a2"), size_bytes=100, mtime=1.0),
                ],
            ),
            DuplicateGroup(
                hash_value="b",
                size_bytes=200,
                files=[
                    DuplicateFile(path=Path("/b1"), size_bytes=200, mtime=1.0),
                    DuplicateFile(path=Path("/b2"), size_bytes=200, mtime=1.0),
                    DuplicateFile(path=Path("/b3"), size_bytes=200, mtime=1.0),
                ],
            ),
        ]
        result = DuplicateResult(root_path=Path("/"), groups=groups)

        # Group 1: 2 files = 1 duplicate, Group 2: 3 files = 2 duplicates
        assert result.total_duplicates == 3
