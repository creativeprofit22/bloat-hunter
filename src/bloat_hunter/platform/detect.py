"""Cross-platform detection for Windows, macOS, Linux, and WSL."""

from __future__ import annotations

import os
import platform
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass
class PlatformInfo:
    """Information about the current platform."""

    name: str  # Windows, macOS, Linux
    variant: str  # e.g., "Ubuntu", "Arch", "WSL2"
    home_dir: Path
    is_wsl: bool = False
    wsl_distro: Optional[str] = None
    windows_home: Optional[Path] = None  # Windows home when in WSL


def _detect_wsl() -> tuple[bool, Optional[str], Optional[Path]]:
    """Detect if running in WSL and get distro info."""
    # Check for WSL indicators
    if not os.path.exists("/proc/version"):
        return False, None, None

    try:
        with open("/proc/version", "r") as f:
            version = f.read().lower()
            if "microsoft" not in version and "wsl" not in version:
                return False, None, None
    except Exception:
        return False, None, None

    # Get WSL distro name
    distro = os.environ.get("WSL_DISTRO_NAME", "Unknown")

    # Find Windows home directory
    windows_home = None
    windows_user = os.environ.get("LOGNAME") or os.environ.get("USER")

    # Try common Windows home paths via /mnt/c
    possible_homes = [
        Path(f"/mnt/c/Users/{windows_user}"),
        Path("/mnt/c/Users"),
    ]

    for home_path in possible_homes:
        if home_path.exists():
            if home_path.name == "Users":
                # List users and find the right one
                for user_dir in home_path.iterdir():
                    if user_dir.is_dir() and not user_dir.name.startswith(("Default", "Public", "All")):
                        windows_home = user_dir
                        break
            else:
                windows_home = home_path
            break

    return True, distro, windows_home


def _get_linux_distro() -> str:
    """Get Linux distribution name."""
    try:
        # Try /etc/os-release first
        if os.path.exists("/etc/os-release"):
            with open("/etc/os-release") as f:
                for line in f:
                    if line.startswith("PRETTY_NAME="):
                        return line.split("=")[1].strip().strip('"')
                    elif line.startswith("NAME="):
                        return line.split("=")[1].strip().strip('"')

        # Fallback to platform
        return platform.linux_distribution()[0] if hasattr(platform, 'linux_distribution') else "Linux"
    except Exception:
        return "Linux"


def get_platform_info() -> PlatformInfo:
    """Detect and return current platform information."""
    system = platform.system()
    home_dir = Path.home()

    if system == "Windows":
        return PlatformInfo(
            name="Windows",
            variant=platform.release(),  # e.g., "10", "11"
            home_dir=home_dir,
        )

    elif system == "Darwin":
        # macOS version
        mac_ver = platform.mac_ver()[0]
        return PlatformInfo(
            name="macOS",
            variant=f"macOS {mac_ver}",
            home_dir=home_dir,
        )

    elif system == "Linux":
        # Check for WSL
        is_wsl, distro, windows_home = _detect_wsl()

        if is_wsl:
            return PlatformInfo(
                name="Linux",
                variant=f"WSL ({distro})",
                home_dir=home_dir,
                is_wsl=True,
                wsl_distro=distro,
                windows_home=windows_home,
            )

        # Regular Linux
        distro_name = _get_linux_distro()
        return PlatformInfo(
            name="Linux",
            variant=distro_name,
            home_dir=home_dir,
        )

    else:
        # Unknown platform
        return PlatformInfo(
            name=system,
            variant="Unknown",
            home_dir=home_dir,
        )


def get_default_scan_paths() -> list[Path]:
    """Get default paths to scan based on platform."""
    info = get_platform_info()
    paths = [info.home_dir]

    if info.is_wsl and info.windows_home:
        # Include Windows home when in WSL
        paths.append(info.windows_home)

    return paths


def get_system_cache_paths() -> list[Path]:
    """Get system-level cache paths for the current platform."""
    info = get_platform_info()
    paths: list[Path] = []

    if info.name == "Windows":
        local_app_data = os.environ.get("LOCALAPPDATA")
        if local_app_data:
            paths.extend([
                Path(local_app_data) / "Temp",
                Path(local_app_data) / "npm-cache",
                Path(local_app_data) / "pip" / "cache",
            ])

    elif info.name == "macOS":
        paths.extend([
            info.home_dir / "Library" / "Caches",
            info.home_dir / ".npm",
            info.home_dir / ".cache",
        ])

    elif info.name == "Linux":
        paths.extend([
            info.home_dir / ".cache",
            info.home_dir / ".npm",
            info.home_dir / ".local" / "share" / "Trash",
        ])

        # WSL: Also check Windows temp
        if info.is_wsl and info.windows_home:
            paths.append(info.windows_home / "AppData" / "Local" / "Temp")

    return [p for p in paths if p.exists()]
