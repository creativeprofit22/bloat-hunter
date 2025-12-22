"""Cross-platform detection for Windows, macOS, Linux, and WSL."""

from __future__ import annotations

import os
import platform
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass
class WindowsEnvPaths:
    """Windows environment paths (LOCALAPPDATA, APPDATA, etc.)."""

    local_app_data: Optional[Path] = None
    app_data: Optional[Path] = None

    @classmethod
    def from_environ(cls) -> "WindowsEnvPaths":
        """Create from current environment variables."""
        local = os.environ.get("LOCALAPPDATA")
        app = os.environ.get("APPDATA")
        return cls(
            local_app_data=Path(local) if local else None,
            app_data=Path(app) if app else None,
        )


@dataclass
class XdgPaths:
    """XDG Base Directory paths for Linux/Unix."""

    cache_home: Path
    config_home: Path

    @classmethod
    def from_environ(cls, home_dir: Path) -> "XdgPaths":
        """Create from current environment variables with home fallback."""
        return cls(
            cache_home=Path(os.environ.get("XDG_CACHE_HOME") or (home_dir / ".cache")),
            config_home=Path(os.environ.get("XDG_CONFIG_HOME") or (home_dir / ".config")),
        )


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
    """Get Linux distribution name from /etc/os-release."""
    try:
        # Parse /etc/os-release for distribution info
        if os.path.exists("/etc/os-release"):
            with open("/etc/os-release") as f:
                for line in f:
                    if line.startswith("PRETTY_NAME="):
                        return line.split("=")[1].strip().strip('"')
                    elif line.startswith("NAME="):
                        return line.split("=")[1].strip().strip('"')
    except Exception:
        pass

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


def _get_windows_system_cache_paths(win_paths: WindowsEnvPaths) -> list[Path]:
    """Get Windows system cache paths."""
    if not win_paths.local_app_data:
        return []
    lap = win_paths.local_app_data
    return [
        lap / "Temp",
        lap / "npm-cache",
        lap / "pip" / "cache",
    ]


def _get_macos_system_cache_paths(home_dir: Path) -> list[Path]:
    """Get macOS system cache paths."""
    return [
        home_dir / "Library" / "Caches",
        home_dir / ".npm",
        home_dir / ".cache",
    ]


def _get_linux_system_cache_paths(
    home_dir: Path,
    is_wsl: bool = False,
    windows_home: Optional[Path] = None,
) -> list[Path]:
    """Get Linux system cache paths, including WSL Windows paths if applicable."""
    paths = [
        home_dir / ".cache",
        home_dir / ".npm",
        home_dir / ".local" / "share" / "Trash",
    ]
    if is_wsl and windows_home:
        paths.append(windows_home / "AppData" / "Local" / "Temp")
    return paths


def get_system_cache_paths(info: Optional[PlatformInfo] = None) -> list[Path]:
    """Get system-level cache paths for the current platform."""
    if info is None:
        info = get_platform_info()

    if info.name == "Windows":
        paths = _get_windows_system_cache_paths(WindowsEnvPaths.from_environ())
    elif info.name == "macOS":
        paths = _get_macos_system_cache_paths(info.home_dir)
    elif info.name == "Linux":
        paths = _get_linux_system_cache_paths(
            info.home_dir,
            is_wsl=info.is_wsl,
            windows_home=info.windows_home,
        )
    else:
        paths = []

    return [p for p in paths if p.exists()]


def _get_windows_browser_cache_paths(win_paths: WindowsEnvPaths) -> list[Path]:
    """Get Windows browser cache paths."""
    paths: list[Path] = []
    if win_paths.local_app_data:
        lap = win_paths.local_app_data
        paths.extend([
            # Chrome
            lap / "Google" / "Chrome" / "User Data" / "Default" / "Cache",
            lap / "Google" / "Chrome" / "User Data" / "Default" / "Code Cache",
            # Edge
            lap / "Microsoft" / "Edge" / "User Data" / "Default" / "Cache",
            lap / "Microsoft" / "Edge" / "User Data" / "Default" / "Code Cache",
        ])
    if win_paths.app_data:
        paths.append(win_paths.app_data / "Mozilla" / "Firefox" / "Profiles")
    return paths


def _get_macos_browser_cache_paths(home_dir: Path) -> list[Path]:
    """Get macOS browser cache paths."""
    return [
        home_dir / "Library" / "Caches" / "Google" / "Chrome",
        home_dir / "Library" / "Caches" / "com.apple.Safari",
        home_dir / "Library" / "Caches" / "Firefox",
        home_dir / "Library" / "Caches" / "com.microsoft.Edge",
    ]


def _get_linux_browser_cache_paths(
    xdg: XdgPaths,
    is_wsl: bool = False,
    windows_home: Optional[Path] = None,
) -> list[Path]:
    """Get Linux browser cache paths, including WSL Windows paths if applicable."""
    paths = [
        xdg.cache_home / "google-chrome",
        xdg.cache_home / "chromium",
        xdg.cache_home / "mozilla" / "firefox",
        xdg.cache_home / "microsoft-edge",
        xdg.config_home / "google-chrome",
        xdg.config_home / "chromium",
        xdg.config_home / "microsoft-edge",
    ]
    if is_wsl and windows_home:
        lap = windows_home / "AppData" / "Local"
        paths.extend([
            lap / "Google" / "Chrome" / "User Data" / "Default" / "Cache",
            lap / "Microsoft" / "Edge" / "User Data" / "Default" / "Cache",
        ])
    return paths


def get_browser_cache_paths(info: Optional[PlatformInfo] = None) -> list[Path]:
    """Get browser-specific cache paths for the current platform."""
    if info is None:
        info = get_platform_info()

    if info.name == "Windows":
        paths = _get_windows_browser_cache_paths(WindowsEnvPaths.from_environ())
    elif info.name == "macOS":
        paths = _get_macos_browser_cache_paths(info.home_dir)
    elif info.name == "Linux":
        paths = _get_linux_browser_cache_paths(
            XdgPaths.from_environ(info.home_dir),
            is_wsl=info.is_wsl,
            windows_home=info.windows_home,
        )
    else:
        paths = []

    return [p for p in paths if p.exists()]


def _get_cross_platform_package_manager_paths(home_dir: Path) -> list[Path]:
    """Get cross-platform package manager cache locations."""
    return [
        home_dir / ".npm",
        home_dir / ".yarn",
        home_dir / ".pnpm-store",
        home_dir / ".cargo" / "registry",
        home_dir / ".cargo" / "git",
        home_dir / ".m2" / "repository",
        home_dir / ".gradle" / "caches",
        home_dir / "go" / "pkg" / "mod" / "cache",
        home_dir / ".composer" / "cache",
        home_dir / ".nuget" / "packages",
        home_dir / ".bundle" / "cache",
    ]


def _get_windows_package_manager_cache_paths(win_paths: WindowsEnvPaths) -> list[Path]:
    """Get Windows-specific package manager cache locations."""
    paths: list[Path] = []
    if win_paths.local_app_data:
        lap = win_paths.local_app_data
        paths.extend([
            lap / "pip" / "cache",
            lap / "npm-cache",
            lap / "yarn" / "Cache",
            lap / "pnpm" / "store",
            lap / "NuGet" / "Cache",
        ])
    return paths


def _get_linux_unix_package_manager_cache_paths(xdg: XdgPaths) -> list[Path]:
    """Get Linux/Unix-specific package manager cache locations."""
    return [
        xdg.cache_home / "pip",
        xdg.cache_home / "go-build",
        xdg.cache_home / "composer",
    ]


def _get_package_manager_cache_paths(info: PlatformInfo) -> list[Path]:
    """Get package manager cache locations."""
    # Start with cross-platform locations
    paths = _get_cross_platform_package_manager_paths(info.home_dir)

    # Add platform-specific locations
    if info.name == "Windows":
        paths.extend(_get_windows_package_manager_cache_paths(WindowsEnvPaths.from_environ()))
    else:
        paths.extend(_get_linux_unix_package_manager_cache_paths(XdgPaths.from_environ(info.home_dir)))

    return [p for p in paths if p.exists()]


def _get_app_cache_paths(info: PlatformInfo) -> list[Path]:
    """Get application cache locations."""
    paths: list[Path] = []

    if info.name == "Windows":
        win_paths = WindowsEnvPaths.from_environ()
        if win_paths.local_app_data:
            lap = win_paths.local_app_data
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
        xdg = XdgPaths.from_environ(info.home_dir)
        paths.extend([
            xdg.config_home / "Code" / "Cache",
            xdg.config_home / "Code" / "CachedData",
            xdg.cache_home / "Slack",
            xdg.config_home / "discord" / "Cache",
            xdg.cache_home / "spotify",
            xdg.config_home / "Microsoft" / "Microsoft Teams" / "Cache",
            xdg.cache_home / "thumbnails",
            xdg.cache_home / "fontconfig",
            xdg.cache_home / "mesa_shader_cache",
            xdg.cache_home / "nvidia",
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
