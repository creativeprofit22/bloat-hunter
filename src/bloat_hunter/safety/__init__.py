"""Safety mechanisms to prevent accidental deletion of important files."""

from __future__ import annotations

from .protected import is_protected_path, PROTECTED_PATTERNS

__all__ = ["is_protected_path", "PROTECTED_PATTERNS"]
