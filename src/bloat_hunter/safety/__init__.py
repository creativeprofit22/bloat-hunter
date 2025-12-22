"""Safety mechanisms to prevent accidental deletion of important files."""

from __future__ import annotations

from .protected import is_protected_path, PROTECTED, ProtectedConfig

__all__ = ["is_protected_path", "PROTECTED", "ProtectedConfig"]
