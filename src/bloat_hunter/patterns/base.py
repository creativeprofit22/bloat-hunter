"""Base bloat pattern definition."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional
import re


@dataclass
class BloatPattern:
    """Definition of a bloat pattern to detect."""

    name: str
    category: str
    patterns: list[str]  # Directory/file name patterns
    description: str
    safe_level: str = "safe"  # safe, caution, dangerous
    min_size: int = 0  # Minimum size in bytes to report
    validator: Optional[Callable[[Path], bool]] = None  # Additional validation

    def matches(self, name: str, path: Path) -> bool:
        """Check if a path matches this pattern."""
        # Check name patterns
        for pattern in self.patterns:
            if pattern.startswith("re:"):
                # Regex pattern
                if re.match(pattern[3:], name):
                    if self.validator is None or self.validator(path):
                        return True
            elif pattern == name:
                # Exact match
                if self.validator is None or self.validator(path):
                    return True

        return False
