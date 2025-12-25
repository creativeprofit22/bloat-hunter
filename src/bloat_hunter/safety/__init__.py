"""Safety mechanisms to prevent accidental deletion of important files."""

from __future__ import annotations

from .protected import PROTECTED, ProtectedConfig, is_protected_path

__all__ = ["is_protected_path", "PROTECTED", "ProtectedConfig"]
