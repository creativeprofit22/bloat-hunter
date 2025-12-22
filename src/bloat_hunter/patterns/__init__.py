"""Bloat pattern definitions for different project types."""

from __future__ import annotations

from .base import BloatPattern
from .cache import CACHE_PATTERNS
from .dev import DEV_PATTERNS
from .system import SYSTEM_PATTERNS
from .browser_cache import (
    BROWSER_CACHE_PATTERNS,
    PACKAGE_MANAGER_PATTERNS,
    APP_CACHE_PATTERNS,
    get_browser_cache_patterns,
    get_system_cache_patterns,
)


def get_all_patterns() -> list[BloatPattern]:
    """Get all registered bloat patterns."""
    return CACHE_PATTERNS + DEV_PATTERNS + SYSTEM_PATTERNS


def get_all_patterns_including_system_caches() -> list[BloatPattern]:
    """Get all patterns including comprehensive system cache patterns."""
    return (
        CACHE_PATTERNS
        + DEV_PATTERNS
        + SYSTEM_PATTERNS
        + BROWSER_CACHE_PATTERNS
        + PACKAGE_MANAGER_PATTERNS
        + APP_CACHE_PATTERNS
    )


__all__ = [
    "BloatPattern",
    "get_all_patterns",
    "get_all_patterns_including_system_caches",
    "get_browser_cache_patterns",
    "get_system_cache_patterns",
    "BROWSER_CACHE_PATTERNS",
    "PACKAGE_MANAGER_PATTERNS",
    "APP_CACHE_PATTERNS",
]
