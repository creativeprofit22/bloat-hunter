"""Bloat pattern definitions for different project types."""

from __future__ import annotations

from .base import BloatPattern
from .cache import CACHE_PATTERNS
from .dev import DEV_PATTERNS
from .system import SYSTEM_PATTERNS


def get_all_patterns() -> list[BloatPattern]:
    """Get all registered bloat patterns."""
    return CACHE_PATTERNS + DEV_PATTERNS + SYSTEM_PATTERNS


__all__ = ["BloatPattern", "get_all_patterns"]
