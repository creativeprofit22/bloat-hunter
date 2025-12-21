"""Protected path definitions to prevent accidental deletion."""

from __future__ import annotations

import os
import platform
from pathlib import Path
from typing import Set

# Paths that should NEVER be deleted
PROTECTED_PATTERNS: Set[str] = {
    # System directories
    "/",
    "/bin",
    "/boot",
    "/dev",
    "/etc",
    "/lib",
    "/lib64",
    "/opt",
    "/proc",
    "/root",
    "/run",
    "/sbin",
    "/srv",
    "/sys",
    "/tmp",
    "/usr",
    "/var",

    # Windows system
    "C:\\",
    "C:\\Windows",
    "C:\\Program Files",
    "C:\\Program Files (x86)",
    "C:\\ProgramData",

    # WSL mounts
    "/mnt/c/Windows",
    "/mnt/c/Program Files",
    "/mnt/c/Program Files (x86)",
    "/mnt/c/ProgramData",

    # macOS system
    "/System",
    "/Library",
    "/Applications",
    "/private",

    # User-critical directories
    "Documents",
    "Desktop",
    "Downloads",
    "Pictures",
    "Music",
    "Videos",
    ".ssh",
    ".gnupg",
    ".config",
}

# Directory names that should never be deleted regardless of path
PROTECTED_NAMES: Set[str] = {
    ".ssh",
    ".gnupg",
    ".gpg",
    ".aws",
    ".kube",
    ".docker",  # config, not cache
    "credentials",
    "secrets",
    ".password-store",
    ".local/share/keyrings",
}

# Files that indicate a directory is important
PROTECTED_INDICATORS: Set[str] = {
    ".git",  # Git repository root
    "package.json",  # Node.js project root
    "pyproject.toml",  # Python project root
    "Cargo.toml",  # Rust project root
    "go.mod",  # Go project root
    "pom.xml",  # Java Maven project
    "build.gradle",  # Java Gradle project
}


def is_protected_path(path: Path, for_scanning: bool = False) -> bool:
    """
    Check if a path is protected and should not be deleted.

    Args:
        path: Path to check
        for_scanning: If True, only check if path should be skipped during scanning
                      (system directories). If False, also check project roots.

    Returns:
        True if the path is protected
    """
    path_str = str(path.absolute())
    path_lower = path_str.lower()

    # Check absolute protected paths (always skip these)
    for protected in PROTECTED_PATTERNS:
        protected_lower = protected.lower()
        if path_lower == protected_lower or path_lower.startswith(protected_lower + os.sep):
            # Allow if we're looking at a subdirectory that's specifically a cache
            if not _is_cache_subdirectory(path):
                return True

    # Check protected names (always skip)
    if path.name in PROTECTED_NAMES:
        return True

    # Check if parent is home directory and this is a critical folder
    home = Path.home()
    if path.parent == home:
        critical_folders = {"Documents", "Desktop", "Downloads", "Pictures", "Music", "Videos"}
        if path.name in critical_folders:
            return True

    # Platform-specific checks
    system = platform.system()

    if system == "Windows":
        if _is_windows_protected(path):
            return True

    elif system == "Darwin":
        if _is_macos_protected(path):
            return True

    # Project root protection only applies to deletion, not scanning
    if not for_scanning:
        for indicator in PROTECTED_INDICATORS:
            if (path / indicator).exists():
                # This is a project root - don't delete it
                return True

    return False


def _is_cache_subdirectory(path: Path) -> bool:
    """Check if this is a cache directory that's safe to delete."""
    cache_names = {
        "__pycache__",
        ".pytest_cache",
        ".mypy_cache",
        ".ruff_cache",
        "node_modules",
        ".next",
        ".nuxt",
        ".cache",
        ".parcel-cache",
        ".tox",
        ".nox",
    }
    return path.name in cache_names


def _is_windows_protected(path: Path) -> bool:
    """Check Windows-specific protected paths."""
    path_str = str(path).upper()

    protected = [
        "C:\\WINDOWS",
        "C:\\PROGRAM FILES",
        "C:\\PROGRAMDATA",
        "C:\\USERS\\DEFAULT",
        "C:\\USERS\\PUBLIC",
        "C:\\$RECYCLE.BIN",
        "C:\\SYSTEM VOLUME INFORMATION",
    ]

    for p in protected:
        if path_str.startswith(p):
            return True

    return False


def _is_macos_protected(path: Path) -> bool:
    """Check macOS-specific protected paths."""
    path_str = str(path)

    protected = [
        "/System",
        "/Library",
        "/private",
        "/cores",
        "/Applications",
        str(Path.home() / "Library" / "Application Support"),
        str(Path.home() / "Library" / "Preferences"),
    ]

    for p in protected:
        if path_str.startswith(p):
            # Allow Library/Caches
            if "Caches" in path_str:
                return False
            return True

    return False


def get_protected_paths_for_platform() -> list[Path]:
    """Get a list of protected paths for the current platform."""
    system = platform.system()
    paths: list[Path] = []

    # Common protected paths
    home = Path.home()
    paths.extend([
        home / "Documents",
        home / "Desktop",
        home / "Downloads",
        home / ".ssh",
        home / ".gnupg",
    ])

    if system == "Windows":
        paths.extend([
            Path("C:/Windows"),
            Path("C:/Program Files"),
            Path("C:/Program Files (x86)"),
        ])
    elif system == "Darwin":
        paths.extend([
            Path("/System"),
            Path("/Library"),
            Path("/Applications"),
        ])
    elif system == "Linux":
        paths.extend([
            Path("/bin"),
            Path("/etc"),
            Path("/usr"),
            Path("/var"),
        ])

    return [p for p in paths if p.exists()]
