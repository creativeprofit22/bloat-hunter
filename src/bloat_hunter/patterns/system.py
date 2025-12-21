"""System-level bloat patterns."""

from __future__ import annotations

from .base import BloatPattern


SYSTEM_PATTERNS: list[BloatPattern] = [
    # macOS
    BloatPattern(
        name=".DS_Store",
        category="System",
        patterns=[".DS_Store"],
        description="macOS folder metadata",
        safe_level="safe",
    ),
    BloatPattern(
        name="__MACOSX",
        category="System",
        patterns=["__MACOSX"],
        description="macOS resource fork data",
        safe_level="safe",
    ),

    # Windows
    BloatPattern(
        name="Thumbs.db",
        category="System",
        patterns=["Thumbs.db", "thumbs.db"],
        description="Windows thumbnail cache",
        safe_level="safe",
    ),
    BloatPattern(
        name="desktop.ini",
        category="System",
        patterns=["desktop.ini"],
        description="Windows folder settings",
        safe_level="safe",
    ),

    # Version control
    BloatPattern(
        name=".git",
        category="VCS",
        patterns=[".git"],
        description="Git repository (use 'git gc' to clean)",
        safe_level="dangerous",  # Never auto-delete
    ),
    BloatPattern(
        name=".svn",
        category="VCS",
        patterns=[".svn"],
        description="Subversion metadata",
        safe_level="dangerous",
    ),
    BloatPattern(
        name=".hg",
        category="VCS",
        patterns=[".hg"],
        description="Mercurial metadata",
        safe_level="dangerous",
    ),

    # Backup files
    BloatPattern(
        name="*.bak",
        category="Backup",
        patterns=["re:.*\\.bak$", "re:.*~$"],
        description="Backup files",
        safe_level="caution",
    ),

    # Crash dumps
    BloatPattern(
        name="crash",
        category="System",
        patterns=["CrashDumps", "crash_dumps", "dumps"],
        description="Crash dump files",
        safe_level="safe",
    ),
]
