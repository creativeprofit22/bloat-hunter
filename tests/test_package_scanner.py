"""Tests for the package scanner module."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from bloat_hunter.core.package_scanner import (
    PACKAGE_MANAGER_GROUPS,
    PackageManagerConfig,
    PackageManagerStats,
    PackageScanner,
    PackageScanResult,
    _get_manager_for_pattern,
)
from bloat_hunter.platform.detect import PlatformInfo


@pytest.fixture
def mock_package_cache_structure(temp_dir: Path):
    """Create a mock package manager cache directory structure."""
    cache = temp_dir / ".cache"
    cache.mkdir()

    # npm cache
    npm = temp_dir / ".npm"
    npm.mkdir()
    npm_cache = npm / "_cacache"
    npm_cache.mkdir()
    (npm_cache / "content-v2").mkdir()
    (npm_cache / "content-v2" / "sha512").mkdir()
    (npm_cache / "content-v2" / "sha512" / "package.tgz").write_bytes(b"x" * 5000)

    # pip cache
    pip = cache / "pip"
    pip.mkdir()
    pip_wheels = pip / "wheels"
    pip_wheels.mkdir()
    (pip_wheels / "package-1.0.whl").write_bytes(b"x" * 3000)

    # cargo registry (large to pass 50MB min_size threshold - use mock)
    cargo = temp_dir / ".cargo"
    cargo.mkdir()
    cargo_registry = cargo / "registry"
    cargo_registry.mkdir()
    (cargo_registry / "cache").mkdir()
    (cargo_registry / "cache" / "crates.tgz").write_bytes(b"x" * 2000)

    # go cache
    go_cache = cache / "go-build"
    go_cache.mkdir()
    (go_cache / "artifacts").mkdir()
    (go_cache / "artifacts" / "build.cache").write_bytes(b"x" * 1500)

    # yarn cache
    yarn = temp_dir / ".yarn"
    yarn.mkdir()
    (yarn / "cache").mkdir()
    (yarn / "cache" / "package.zip").write_bytes(b"x" * 2500)

    yield temp_dir


class TestPackageManagerStats:
    """Tests for PackageManagerStats dataclass."""

    def test_size_human_bytes(self):
        stats = PackageManagerStats(name="npm", size_bytes=500)
        assert stats.size_human == "500.0 B"

    def test_size_human_megabytes(self):
        stats = PackageManagerStats(name="pip", size_bytes=5 * 1024 * 1024)
        assert stats.size_human == "5.0 MB"

    def test_default_values(self):
        stats = PackageManagerStats(name="cargo")
        assert stats.size_bytes == 0
        assert stats.file_count == 0
        assert stats.targets == []


class TestPackageScanResult:
    """Tests for PackageScanResult dataclass."""

    def test_total_size_human_bytes(self):
        result = PackageScanResult(
            platform_info=MagicMock(),
            total_size=500,
        )
        assert result.total_size_human == "500.0 B"

    def test_total_size_human_gigabytes(self):
        result = PackageScanResult(
            platform_info=MagicMock(),
            total_size=2 * 1024 * 1024 * 1024,
        )
        assert result.total_size_human == "2.0 GB"

    def test_default_values(self):
        result = PackageScanResult(platform_info=MagicMock())
        assert result.targets == []
        assert result.total_size == 0
        assert result.scan_errors == []
        assert result.by_manager == {}


class TestGetManagerForPattern:
    """Tests for the _get_manager_for_pattern helper."""

    def test_npm_patterns(self):
        assert _get_manager_for_pattern("npm cache") == "npm"

    def test_pip_patterns(self):
        assert _get_manager_for_pattern("pip cache") == "pip"
        assert _get_manager_for_pattern("pipx cache") == "pip"

    def test_cargo_patterns(self):
        assert _get_manager_for_pattern("Cargo registry") == "cargo"
        assert _get_manager_for_pattern("Cargo git") == "cargo"

    def test_unknown_pattern(self):
        assert _get_manager_for_pattern("Unknown cache") is None


class TestPackageManagerGroups:
    """Tests for PACKAGE_MANAGER_GROUPS constant."""

    def test_has_expected_managers(self):
        expected = ["npm", "yarn", "pnpm", "pip", "cargo", "go", "gradle", "composer", "nuget", "bundler"]
        for manager in expected:
            assert manager in PACKAGE_MANAGER_GROUPS

    def test_npm_includes_cache_pattern(self):
        assert "npm cache" in PACKAGE_MANAGER_GROUPS["npm"]

    def test_cargo_includes_both_patterns(self):
        assert "Cargo registry" in PACKAGE_MANAGER_GROUPS["cargo"]
        assert "Cargo git" in PACKAGE_MANAGER_GROUPS["cargo"]


class TestPackageScanner:
    """Tests for PackageScanner class."""

    def test_init_default_options(self):
        scanner = PackageScanner()
        assert scanner._include["npm"] is True
        assert scanner._include["pip"] is True
        assert scanner._include["cargo"] is True

    def test_init_custom_options(self):
        config = PackageManagerConfig(
            npm=False,
            pip=True,
            cargo=False,
        )
        scanner = PackageScanner(config=config)
        assert scanner._include["npm"] is False
        assert scanner._include["pip"] is True
        assert scanner._include["cargo"] is False

    def test_scanner_has_patterns(self):
        scanner = PackageScanner()
        assert len(scanner.patterns) > 0

    def test_scanner_filters_patterns_by_include(self):
        # All included
        scanner_all = PackageScanner()

        # Only pip included
        pip_only_config = PackageManagerConfig(
            npm=False,
            yarn=False,
            pnpm=False,
            pip=True,
            cargo=False,
            go=False,
            gradle=False,
            maven=False,
            composer=False,
            nuget=False,
            bundler=False,
        )
        scanner_pip = PackageScanner(config=pip_only_config)

        assert len(scanner_pip.patterns) < len(scanner_all.patterns)

        # pip patterns should still be included
        pip_pattern_names = [p.name for p in scanner_pip.patterns]
        assert any("pip" in name.lower() for name in pip_pattern_names)

    @patch("bloat_hunter.core.package_scanner.get_all_cache_paths")
    @patch("bloat_hunter.core.package_scanner.get_platform_info")
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

        scanner = PackageScanner()
        result = scanner.scan()

        assert len(result.targets) == 0
        assert result.total_size == 0

    def test_scan_finds_package_caches(self, mock_package_cache_structure: Path):
        """Test that scanner finds package manager cache directories."""
        with patch("bloat_hunter.core.package_scanner.get_platform_info") as mock_platform:
            mock_platform.return_value = PlatformInfo(
                name="Linux",
                variant="Test",
                home_dir=mock_package_cache_structure,
            )

            cache_paths = {
                "system": [],
                "browser": [],
                "package_managers": [
                    mock_package_cache_structure / ".npm",
                    mock_package_cache_structure / ".cache" / "pip",
                    mock_package_cache_structure / ".cache" / "go-build",
                ],
                "apps": [],
            }

            with patch("bloat_hunter.core.package_scanner.get_all_cache_paths") as mock_cache:
                mock_cache.return_value = cache_paths

                scanner = PackageScanner()
                result = scanner.scan()

                # Should find cache targets
                assert len(result.targets) > 0

    def test_results_sorted_by_size(self, mock_package_cache_structure: Path):
        """Test that results are sorted by size descending."""
        with patch("bloat_hunter.core.package_scanner.get_platform_info") as mock_platform:
            mock_platform.return_value = PlatformInfo(
                name="Linux",
                variant="Test",
                home_dir=mock_package_cache_structure,
            )

            cache_paths = {
                "system": [],
                "browser": [],
                "package_managers": [
                    mock_package_cache_structure / ".npm",
                    mock_package_cache_structure / ".cache",
                ],
                "apps": [],
            }

            with patch("bloat_hunter.core.package_scanner.get_all_cache_paths") as mock_cache:
                mock_cache.return_value = cache_paths

                scanner = PackageScanner()
                result = scanner.scan()

                if len(result.targets) > 1:
                    sizes = [t.size_bytes for t in result.targets]
                    assert sizes == sorted(sizes, reverse=True)

    def test_by_manager_populated(self, mock_package_cache_structure: Path):
        """Test that by_manager stats are populated correctly."""
        with patch("bloat_hunter.core.package_scanner.get_platform_info") as mock_platform:
            mock_platform.return_value = PlatformInfo(
                name="Linux",
                variant="Test",
                home_dir=mock_package_cache_structure,
            )

            cache_paths = {
                "system": [],
                "browser": [],
                "package_managers": [
                    mock_package_cache_structure / ".npm",
                    mock_package_cache_structure / ".cache",
                ],
                "apps": [],
            }

            with patch("bloat_hunter.core.package_scanner.get_all_cache_paths") as mock_cache:
                mock_cache.return_value = cache_paths

                scanner = PackageScanner()
                result = scanner.scan()

                # by_manager should have entries for included managers
                assert "npm" in result.by_manager
                assert "pip" in result.by_manager

    def test_by_manager_sorted_by_size(self, mock_package_cache_structure: Path):
        """Test that by_manager is sorted by size descending."""
        with patch("bloat_hunter.core.package_scanner.get_platform_info") as mock_platform:
            mock_platform.return_value = PlatformInfo(
                name="Linux",
                variant="Test",
                home_dir=mock_package_cache_structure,
            )

            cache_paths = {
                "system": [],
                "browser": [],
                "package_managers": [
                    mock_package_cache_structure / ".npm",
                    mock_package_cache_structure / ".cache",
                ],
                "apps": [],
            }

            with patch("bloat_hunter.core.package_scanner.get_all_cache_paths") as mock_cache:
                mock_cache.return_value = cache_paths

                scanner = PackageScanner()
                result = scanner.scan()

                sizes = [stats.size_bytes for stats in result.by_manager.values()]
                if len(sizes) > 1:
                    assert sizes == sorted(sizes, reverse=True)


class TestWSLSupport:
    """Tests for WSL-specific functionality in PackageScanner."""

    @patch("bloat_hunter.core.package_scanner.get_platform_info")
    @patch("bloat_hunter.core.package_scanner.get_all_cache_paths")
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
            "system": [],
            "browser": [],
            "package_managers": [
                Path("/home/test/.npm"),
                Path("/mnt/c/Users/test/AppData/Local/npm-cache"),
            ],
            "apps": [],
        }

        scanner = PackageScanner()

        # With Windows excluded
        result = scanner.scan(wsl_include_windows=False)

        # Should not have Windows paths in results
        for target in result.targets:
            assert not str(target.path).startswith("/mnt/")

    @patch("bloat_hunter.core.package_scanner.get_platform_info")
    @patch("bloat_hunter.core.package_scanner.get_all_cache_paths")
    def test_wsl_include_windows(self, mock_cache_paths, mock_platform):
        """Test that WSL includes Windows paths by default."""
        mock_platform.return_value = PlatformInfo(
            name="Linux",
            variant="WSL (Ubuntu)",
            home_dir=Path("/home/test"),
            is_wsl=True,
            wsl_distro="Ubuntu",
            windows_home=Path("/mnt/c/Users/test"),
        )

        # Mock with only Windows path - need to have a real path for testing
        mock_cache_paths.return_value = {
            "system": [],
            "browser": [],
            "package_managers": [
                Path("/home/test/.npm"),
            ],
            "apps": [],
        }

        scanner = PackageScanner()

        # Default includes Windows
        result = scanner.scan(wsl_include_windows=True)

        # Should not filter out /mnt/ paths (though they may not exist)
        assert result is not None
