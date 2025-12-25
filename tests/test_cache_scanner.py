"""Tests for the cache scanner module."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from bloat_hunter.core.cache_scanner import CacheScanner, CacheScanResult
from bloat_hunter.platform.detect import PlatformInfo


@pytest.fixture
def mock_cache_structure(temp_dir: Path):
    """Create a mock cache directory structure."""
    # Create browser cache directories
    cache = temp_dir / ".cache"
    cache.mkdir()

    # Chrome-like cache
    chrome = cache / "google-chrome" / "Default"
    chrome.mkdir(parents=True)
    chrome_cache = chrome / "Cache"
    chrome_cache.mkdir()
    (chrome_cache / "data_0").write_bytes(b"x" * 1000)
    (chrome_cache / "data_1").write_bytes(b"x" * 1000)

    # Code Cache
    code_cache = chrome / "Code Cache"
    code_cache.mkdir()
    (code_cache / "js").mkdir()
    (code_cache / "js" / "data.bin").write_bytes(b"x" * 500)

    # pip cache
    pip = cache / "pip"
    pip.mkdir()
    (pip / "wheels").mkdir()
    (pip / "wheels" / "package.whl").write_bytes(b"x" * 2000)

    # thumbnails
    thumbnails = cache / "thumbnails"
    thumbnails.mkdir()
    (thumbnails / "normal").mkdir()
    (thumbnails / "normal" / "thumb.png").write_bytes(b"x" * 500)

    # fontconfig
    fontconfig = cache / "fontconfig"
    fontconfig.mkdir()
    (fontconfig / "cache.dat").write_bytes(b"x" * 200)

    yield temp_dir


@pytest.fixture
def mock_platform_info_linux():
    """Create a mock Linux platform info."""
    return PlatformInfo(
        name="Linux",
        variant="Ubuntu 22.04",
        home_dir=Path("/home/test"),
        is_wsl=False,
    )


@pytest.fixture
def mock_platform_info_wsl():
    """Create a mock WSL platform info."""
    return PlatformInfo(
        name="Linux",
        variant="WSL (Ubuntu)",
        home_dir=Path("/home/test"),
        is_wsl=True,
        wsl_distro="Ubuntu",
        windows_home=Path("/mnt/c/Users/test"),
    )


class TestCacheScanResult:
    """Tests for CacheScanResult dataclass."""

    def test_total_size_human_bytes(self):
        result = CacheScanResult(
            platform_info=MagicMock(),
            total_size=500,
        )
        assert result.total_size_human == "500.0 B"

    def test_total_size_human_megabytes(self):
        result = CacheScanResult(
            platform_info=MagicMock(),
            total_size=5 * 1024 * 1024,
        )
        assert result.total_size_human == "5.0 MB"


class TestCacheScanner:
    """Tests for CacheScanner class."""

    def test_init_default_options(self):
        scanner = CacheScanner()
        assert scanner.include_browsers is True
        assert scanner.include_package_managers is True
        assert scanner.include_apps is True

    def test_init_custom_options(self):
        scanner = CacheScanner(
            include_browsers=False,
            include_package_managers=True,
            include_apps=False,
        )
        assert scanner.include_browsers is False
        assert scanner.include_package_managers is True
        assert scanner.include_apps is False

    def test_scanner_has_patterns(self):
        scanner = CacheScanner()
        assert len(scanner.patterns) > 0

    @patch("bloat_hunter.core.cache_scanner.get_all_cache_paths")
    @patch("bloat_hunter.core.cache_scanner.get_platform_info")
    def test_scan_empty_paths(self, mock_get_platform, mock_get_cache_paths):
        """Test scanning when no cache paths exist."""
        mock_get_platform.return_value = PlatformInfo(
            name="Linux",
            variant="Test",
            home_dir=Path("/home/test"),
        )
        mock_get_cache_paths.return_value = {
            "system": [],
            "browser": [],
            "package_managers": [],
            "apps": [],
        }

        scanner = CacheScanner()
        result = scanner.scan()

        assert len(result.targets) == 0
        assert result.total_size == 0

    def test_scan_finds_cache_directories(self, mock_cache_structure: Path):
        """Test that scanner finds cache directories."""
        with patch("bloat_hunter.core.cache_scanner.get_platform_info") as mock_platform:
            mock_platform.return_value = PlatformInfo(
                name="Linux",
                variant="Test",
                home_dir=mock_cache_structure,
            )

            cache_paths = {
                "system": [mock_cache_structure / ".cache"],
                "browser": [],
                "package_managers": [],
                "apps": [],
            }

            with patch("bloat_hunter.core.cache_scanner.get_all_cache_paths") as mock_cache:
                mock_cache.return_value = cache_paths

                scanner = CacheScanner()
                result = scanner.scan()

                # Should find some cache targets
                assert len(result.targets) > 0

    def test_scan_respects_browser_option(self, mock_cache_structure: Path):
        """Test that scanner respects --no-browsers option."""
        with patch("bloat_hunter.core.cache_scanner.get_platform_info") as mock_platform:
            mock_platform.return_value = PlatformInfo(
                name="Linux",
                variant="Test",
                home_dir=mock_cache_structure,
            )

            # Only provide browser paths
            cache_paths = {
                "system": [],
                "browser": [mock_cache_structure / ".cache" / "google-chrome"],
                "package_managers": [],
                "apps": [],
            }

            with patch("bloat_hunter.core.cache_scanner.get_all_cache_paths") as mock_cache:
                mock_cache.return_value = cache_paths

                # With browsers excluded
                scanner = CacheScanner(include_browsers=False)
                result = scanner.scan()

                # Browser category should not be scanned
                assert "browser" not in result.categories_scanned

    def test_results_sorted_by_size(self, mock_cache_structure: Path):
        """Test that results are sorted by size descending."""
        with patch("bloat_hunter.core.cache_scanner.get_platform_info") as mock_platform:
            mock_platform.return_value = PlatformInfo(
                name="Linux",
                variant="Test",
                home_dir=mock_cache_structure,
            )

            cache_paths = {
                "system": [mock_cache_structure / ".cache"],
                "browser": [],
                "package_managers": [],
                "apps": [],
            }

            with patch("bloat_hunter.core.cache_scanner.get_all_cache_paths") as mock_cache:
                mock_cache.return_value = cache_paths

                scanner = CacheScanner()
                result = scanner.scan()

                if len(result.targets) > 1:
                    sizes = [t.size_bytes for t in result.targets]
                    assert sizes == sorted(sizes, reverse=True)

    def test_categories_tracked(self, mock_cache_structure: Path):
        """Test that scanned categories are tracked."""
        with patch("bloat_hunter.core.cache_scanner.get_platform_info") as mock_platform:
            mock_platform.return_value = PlatformInfo(
                name="Linux",
                variant="Test",
                home_dir=mock_cache_structure,
            )

            cache_paths = {
                "system": [mock_cache_structure / ".cache"],
                "browser": [],
                "package_managers": [],
                "apps": [],
            }

            with patch("bloat_hunter.core.cache_scanner.get_all_cache_paths") as mock_cache:
                mock_cache.return_value = cache_paths

                scanner = CacheScanner()
                result = scanner.scan()

                assert "system" in result.categories_scanned
                assert result.categories_scanned["system"] >= 1


class TestWSLSupport:
    """Tests for WSL-specific functionality."""

    @patch("bloat_hunter.core.cache_scanner.get_platform_info")
    @patch("bloat_hunter.core.cache_scanner.get_all_cache_paths")
    def test_wsl_exclude_windows(self, mock_cache_paths, mock_platform):
        """Test that WSL can exclude Windows paths."""
        mock_platform.return_value = PlatformInfo(
            name="Linux",
            variant="WSL (Ubuntu)",
            home_dir=Path("/home/test"),
            is_wsl=True,
            wsl_distro="Ubuntu",
            windows_home=Path("/mnt/c/Users/test"),
        )

        mock_cache_paths.return_value = {
            "system": [
                Path("/home/test/.cache"),
                Path("/mnt/c/Users/test/AppData/Local/Temp"),
            ],
            "browser": [],
            "package_managers": [],
            "apps": [],
        }

        scanner = CacheScanner()

        # With Windows excluded
        result = scanner.scan(wsl_include_windows=False)

        # Should not have Windows paths in errors (since they're filtered before scanning)
        for target in result.targets:
            assert not str(target.path).startswith("/mnt/")
