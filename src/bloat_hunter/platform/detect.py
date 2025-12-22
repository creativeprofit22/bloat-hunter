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

    # Try exact username match first
    if windows_user:
        exact_match = Path(f"/mnt/c/Users/{windows_user}")
        if exact_match.exists():
            return True, distro, exact_match

    # Fallback: scan Users directory for a valid home
    users_dir = Path("/mnt/c/Users")
    if users_dir.exists():
        skip_dirs = {"Default", "Default User", "Public", "All Users"}
        # Prefer directories matching username (case-insensitive)
        for user_dir in sorted(users_dir.iterdir(), key=lambda d: d.name.lower()):
            if user_dir.is_dir() and user_dir.name not in skip_dirs:
                if windows_user and user_dir.name.lower() == windows_user.lower():
                    windows_home = user_dir
                    break
                elif windows_home is None:
                    windows_home = user_dir  # First valid as fallback

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


def get_system_cache_paths(info: Optional[PlatformInfo] = None) -> list[Path]:
    """Get system-level cache paths for the current platform."""
    if info is None:
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


def get_browser_cache_paths(info: Optional[PlatformInfo] = None) -> list[Path]:
    """Get browser-specific cache paths for the current platform."""
    if info is None:
        info = get_platform_info()
    paths: list[Path] = []

    if info.name == "Windows":
        local_app_data = os.environ.get("LOCALAPPDATA")
        app_data = os.environ.get("APPDATA")
        if local_app_data:
            lap = Path(local_app_data)
            paths.extend([
                # Chrome
                lap / "Google" / "Chrome" / "User Data" / "Default" / "Cache",
                lap / "Google" / "Chrome" / "User Data" / "Default" / "Code Cache",
                # Edge
                lap / "Microsoft" / "Edge" / "User Data" / "Default" / "Cache",
                lap / "Microsoft" / "Edge" / "User Data" / "Default" / "Code Cache",
            ])
        if app_data:
            paths.append(Path(app_data) / "Mozilla" / "Firefox" / "Profiles")

    elif info.name == "macOS":
        paths.extend([
            info.home_dir / "Library" / "Caches" / "Google" / "Chrome",
            info.home_dir / "Library" / "Caches" / "com.apple.Safari",
            info.home_dir / "Library" / "Caches" / "Firefox",
            info.home_dir / "Library" / "Caches" / "com.microsoft.Edge",
        ])

    elif info.name == "Linux":
        cache_home = Path(os.environ.get("XDG_CACHE_HOME") or (info.home_dir / ".cache"))
        config_home = Path(os.environ.get("XDG_CONFIG_HOME") or (info.home_dir / ".config"))
        paths.extend([
            cache_home / "google-chrome",
            cache_home / "chromium",
            cache_home / "mozilla" / "firefox",
            cache_home / "microsoft-edge",
            config_home / "google-chrome",
            config_home / "chromium",
            config_home / "microsoft-edge",
        ])

        # WSL: Also include Windows browser caches
        if info.is_wsl and info.windows_home:
            lap = info.windows_home / "AppData" / "Local"
            paths.extend([
                lap / "Google" / "Chrome" / "User Data" / "Default" / "Cache",
                lap / "Microsoft" / "Edge" / "User Data" / "Default" / "Cache",
            ])

    return [p for p in paths if p.exists()]


def _get_package_manager_cache_paths(info: PlatformInfo) -> list[Path]:
    """Get package manager cache locations."""
    paths: list[Path] = []

    # Cross-platform locations
    paths.extend([
        info.home_dir / ".npm",
        info.home_dir / ".yarn",
        info.home_dir / ".pnpm-store",
        info.home_dir / ".cargo" / "registry",
        info.home_dir / ".cargo" / "git",
        info.home_dir / ".m2" / "repository",
        info.home_dir / ".gradle" / "caches",
        info.home_dir / "go" / "pkg" / "mod" / "cache",
        info.home_dir / ".composer" / "cache",
        info.home_dir / ".nuget" / "packages",
        info.home_dir / ".bundle" / "cache",
    ])

    if info.name == "Windows":
        local_app_data = os.environ.get("LOCALAPPDATA")
        if local_app_data:
            lap = Path(local_app_data)
            paths.extend([
                lap / "pip" / "cache",
                lap / "npm-cache",
                lap / "yarn" / "Cache",
                lap / "pnpm" / "store",
                lap / "NuGet" / "Cache",
            ])
    else:
        cache_home = Path(os.environ.get("XDG_CACHE_HOME") or (info.home_dir / ".cache"))
        paths.extend([
            cache_home / "pip",
            cache_home / "go-build",
            cache_home / "composer",
        ])

    return [p for p in paths if p.exists()]


def _get_app_cache_paths(info: PlatformInfo) -> list[Path]:
    """Get application cache locations."""
    paths: list[Path] = []

    if info.name == "Windows":
        local_app_data = os.environ.get("LOCALAPPDATA")
        if local_app_data:
            lap = Path(local_app_data)
            paths.extend([
                lap / "Programs" / "Microsoft VS Code" / "Cache",
                lap / "Slack" / "Cache",
                lap / "discord" / "Cache",
                lap / "Microsoft" / "Teams" / "Cache",
                lap / "spotify" / "Data",
            ])

    elif info.name == "macOS":
        paths.extend([
            info.home_dir / "Library" / "Caches" / "com.microsoft.VSCode",
            info.home_dir / "Library" / "Caches" / "com.tinyspeck.slackmacgap",
            info.home_dir / "Library" / "Caches" / "com.hnc.Discord",
            info.home_dir / "Library" / "Caches" / "com.spotify.client",
            info.home_dir / "Library" / "Caches" / "com.microsoft.teams",
        ])

    elif info.name == "Linux":
        cache_home = Path(os.environ.get("XDG_CACHE_HOME") or (info.home_dir / ".cache"))
        config_home = Path(os.environ.get("XDG_CONFIG_HOME") or (info.home_dir / ".config"))
        paths.extend([
            config_home / "Code" / "Cache",
            config_home / "Code" / "CachedData",
            cache_home / "Slack",
            config_home / "discord" / "Cache",
            cache_home / "spotify",
            config_home / "Microsoft" / "Microsoft Teams" / "Cache",
            cache_home / "thumbnails",
            cache_home / "fontconfig",
            cache_home / "mesa_shader_cache",
            cache_home / "nvidia",
        ])

    return [p for p in paths if p.exists()]


def get_all_cache_paths() -> dict[str, list[Path]]:
    """
    Get all cache paths categorized by type.

    Returns:
        Dictionary with keys: system, browser, package_managers, apps
    """
    info = get_platform_info()

    return {
        "system": get_system_cache_paths(info),
        "browser": get_browser_cache_paths(info),
        "package_managers": _get_package_manager_cache_paths(info),
        "apps": _get_app_cache_paths(info),
    }
