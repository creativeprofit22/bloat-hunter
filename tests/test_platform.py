"""Tests for platform detection."""

from __future__ import annotations

import platform
from pathlib import Path

import pytest

from bloat_hunter.platform.detect import get_platform_info, PlatformInfo


class TestGetPlatformInfo:
    """Tests for get_platform_info function."""

    def test_returns_platform_info(self):
        info = get_platform_info()
        assert isinstance(info, PlatformInfo)

    def test_has_required_fields(self):
        info = get_platform_info()
        assert info.name in ["Windows", "macOS", "Linux"]
        assert info.variant is not None
        assert isinstance(info.home_dir, Path)

    def test_home_dir_exists(self):
        info = get_platform_info()
        assert info.home_dir.exists()

    def test_correct_platform_name(self):
        info = get_platform_info()
        system = platform.system()

        if system == "Windows":
            assert info.name == "Windows"
        elif system == "Darwin":
            assert info.name == "macOS"
        elif system == "Linux":
            assert info.name == "Linux"
