"""UI components for console output and prompts."""

from __future__ import annotations

from .console import create_console, print_banner
from .prompts import confirm_deletion, select_targets

__all__ = ["create_console", "print_banner", "confirm_deletion", "select_targets"]
