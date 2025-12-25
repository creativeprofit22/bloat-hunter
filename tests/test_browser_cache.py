"""Tests for the browser cache patterns module."""

from __future__ import annotations

from pathlib import Path

from bloat_hunter.patterns.browser_cache import (
    APP_CACHE_PATTERNS,
    BROWSER_CACHE_PATTERNS,
    PACKAGE_MANAGER_PATTERNS,
    get_browser_cache_patterns,
    get_system_cache_patterns,
)


class TestBrowserCachePatterns:
    """Tests for browser cache patterns."""

    def test_browser_patterns_not_empty(self):
        assert len(BROWSER_CACHE_PATTERNS) > 0

    def test_chrome_cache_pattern_exists(self):
        names = [p.name for p in BROWSER_CACHE_PATTERNS]
        assert "Chrome Cache" in names

    def test_firefox_cache_pattern_exists(self):
        names = [p.name for p in BROWSER_CACHE_PATTERNS]
        assert "Firefox Cache" in names

    def test_edge_cache_pattern_exists(self):
        names = [p.name for p in BROWSER_CACHE_PATTERNS]
        assert "Edge Cache" in names

    def test_all_patterns_have_safe_level(self):
        for pattern in BROWSER_CACHE_PATTERNS:
            assert pattern.safe_level in ("safe", "caution", "dangerous")

    def test_chrome_cache_matches_cache_dir(self, temp_dir: Path):
        cache_dir = temp_dir / "Cache"
        cache_dir.mkdir()

        chrome_pattern = next(
            p for p in BROWSER_CACHE_PATTERNS if p.name == "Chrome Cache"
        )
        assert chrome_pattern.matches("Cache", cache_dir)

    def test_chrome_cache_matches_code_cache(self, temp_dir: Path):
        cache_dir = temp_dir / "Code Cache"
        cache_dir.mkdir()

        chrome_pattern = next(
            p for p in BROWSER_CACHE_PATTERNS if p.name == "Chrome Cache"
        )
        assert chrome_pattern.matches("Code Cache", cache_dir)

    def test_firefox_cache_matches_cache2(self, temp_dir: Path):
        cache_dir = temp_dir / "cache2"
        cache_dir.mkdir()

        firefox_pattern = next(
            p for p in BROWSER_CACHE_PATTERNS if p.name == "Firefox Cache"
        )
        assert firefox_pattern.matches("cache2", cache_dir)


class TestPackageManagerPatterns:
    """Tests for package manager cache patterns."""

    def test_package_patterns_not_empty(self):
        assert len(PACKAGE_MANAGER_PATTERNS) > 0

    def test_npm_cache_pattern_exists(self):
        names = [p.name for p in PACKAGE_MANAGER_PATTERNS]
        assert "npm cache" in names

    def test_pip_cache_pattern_exists(self):
        names = [p.name for p in PACKAGE_MANAGER_PATTERNS]
        assert "pip cache" in names

    def test_cargo_patterns_exist(self):
        names = [p.name for p in PACKAGE_MANAGER_PATTERNS]
        assert "Cargo registry" in names or "Cargo git" in names

    def test_npm_cache_matches_cacache(self, temp_dir: Path):
        cache_dir = temp_dir / "_cacache"
        cache_dir.mkdir()

        npm_pattern = next(
            p for p in PACKAGE_MANAGER_PATTERNS if p.name == "npm cache"
        )
        assert npm_pattern.matches("_cacache", cache_dir)

    def test_pip_cache_matches_pip(self, temp_dir: Path):
        cache_dir = temp_dir / "pip"
        cache_dir.mkdir()

        pip_pattern = next(
            p for p in PACKAGE_MANAGER_PATTERNS if p.name == "pip cache"
        )
        assert pip_pattern.matches("pip", cache_dir)

    def test_cargo_registry_has_min_size(self):
        cargo_pattern = next(
            p for p in PACKAGE_MANAGER_PATTERNS if p.name == "Cargo registry"
        )
        # Cargo registry should have a min_size to avoid small directories
        assert cargo_pattern.min_size >= 50 * 1024 * 1024  # 50MB

    def test_maven_detected_via_explicit_path(self):
        # Maven pattern was removed (too generic "repository")
        # Now detected via explicit ~/.m2/repository path in detect.py
        maven_patterns = [
            p for p in PACKAGE_MANAGER_PATTERNS if p.name == "Maven repository"
        ]
        assert len(maven_patterns) == 0  # Pattern removed intentionally


class TestAppCachePatterns:
    """Tests for application cache patterns."""

    def test_app_patterns_not_empty(self):
        assert len(APP_CACHE_PATTERNS) > 0

    def test_vscode_cache_pattern_exists(self):
        names = [p.name for p in APP_CACHE_PATTERNS]
        assert "VS Code Cache" in names

    def test_thumbnails_pattern_exists(self):
        names = [p.name for p in APP_CACHE_PATTERNS]
        assert "Thumbnails" in names

    def test_vscode_matches_cacheddata(self, temp_dir: Path):
        cache_dir = temp_dir / "CachedData"
        cache_dir.mkdir()

        vscode_pattern = next(
            p for p in APP_CACHE_PATTERNS if p.name == "VS Code Cache"
        )
        assert vscode_pattern.matches("CachedData", cache_dir)

    def test_thumbnails_matches_thumbnails(self, temp_dir: Path):
        cache_dir = temp_dir / "thumbnails"
        cache_dir.mkdir()

        thumbs_pattern = next(
            p for p in APP_CACHE_PATTERNS if p.name == "Thumbnails"
        )
        assert thumbs_pattern.matches("thumbnails", cache_dir)


class TestGetFunctions:
    """Tests for get_* functions."""

    def test_get_browser_cache_patterns(self):
        patterns = get_browser_cache_patterns()
        assert patterns == BROWSER_CACHE_PATTERNS

    def test_get_system_cache_patterns_includes_all(self):
        patterns = get_system_cache_patterns()
        total = (
            len(BROWSER_CACHE_PATTERNS)
            + len(PACKAGE_MANAGER_PATTERNS)
            + len(APP_CACHE_PATTERNS)
        )
        assert len(patterns) == total

    def test_get_system_cache_patterns_categories(self):
        patterns = get_system_cache_patterns()
        categories = {p.category for p in patterns}

        assert "Browser" in categories
        assert "Package Manager" in categories
        assert "App" in categories


class TestPatternSafeLevels:
    """Tests for pattern safe levels."""

    def test_browser_caches_are_safe(self):
        for pattern in BROWSER_CACHE_PATTERNS:
            # Most browser caches should be safe
            assert pattern.safe_level in ("safe", "caution")

    def test_dangerous_patterns_flagged(self):
        all_patterns = get_system_cache_patterns()
        # No patterns should be marked as dangerous - these are caches
        for pattern in all_patterns:
            assert pattern.safe_level != "dangerous"

    def test_caution_patterns_have_reason(self):
        all_patterns = get_system_cache_patterns()
        caution_patterns = [p for p in all_patterns if p.safe_level == "caution"]

        # Caution patterns should be things like:
        # - Cargo registry (might need redownload)
        # - Maven repository (large redownload)
        # - Chrome Storage (user data)
        # - Docker buildx (build cache)
        caution_names = [p.name for p in caution_patterns]
        for name in caution_names:
            # These should be recognized patterns
            assert any(
                keyword in name.lower()
                for keyword in ["cargo", "maven", "go", "storage", "history", "docker", "buildx"]
            )
