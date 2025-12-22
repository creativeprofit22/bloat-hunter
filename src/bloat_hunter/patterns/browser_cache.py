"""Browser, package manager, and app cache patterns for system cache scanning."""

from __future__ import annotations

from .base import BloatPattern


# ============================================================================
# Size Thresholds for Pattern Matching
# ============================================================================

MIN_SIZE_DEFAULT = 0  # No minimum
MIN_SIZE_LARGE_CACHE = 50 * 1024 * 1024  # 50 MB


# ============================================================================
# Browser Caches
# ============================================================================

BROWSER_CACHE_PATTERNS: list[BloatPattern] = [
    # --------------------------------------------------------------------------
    # Chrome/Chromium (all platforms)
    # --------------------------------------------------------------------------
    BloatPattern(
        name="Chrome Cache",
        category="Browser",
        patterns=["Cache", "Code Cache", "GPUCache", "ShaderCache", "GrShaderCache"],
        description="Chrome browser cache",
        safe_level="safe",
    ),
    BloatPattern(
        name="Chrome Media Cache",
        category="Browser",
        patterns=["Media Cache", "Service Worker"],
        description="Chrome media and service worker cache",
        safe_level="safe",
    ),
    BloatPattern(
        name="Chrome Storage",
        category="Browser",
        patterns=["IndexedDB", "Local Storage", "Session Storage"],
        description="Chrome local storage (safe if not important)",
        safe_level="caution",
    ),

    # --------------------------------------------------------------------------
    # Firefox
    # --------------------------------------------------------------------------
    BloatPattern(
        name="Firefox Cache",
        category="Browser",
        patterns=["cache2", "startupCache", "shader-cache"],
        description="Firefox browser cache",
        safe_level="safe",
    ),
    BloatPattern(
        name="Firefox Offline Cache",
        category="Browser",
        patterns=["OfflineCache"],
        description="Firefox offline cache",
        safe_level="safe",
    ),

    # --------------------------------------------------------------------------
    # Edge (Chromium-based)
    # --------------------------------------------------------------------------
    BloatPattern(
        name="Edge Cache",
        category="Browser",
        patterns=["Cache", "Code Cache", "GPUCache"],
        description="Microsoft Edge cache",
        safe_level="safe",
    ),

    # --------------------------------------------------------------------------
    # Safari (macOS)
    # --------------------------------------------------------------------------
    BloatPattern(
        name="Safari Cache",
        category="Browser",
        patterns=["re:com\\.apple\\.Safari.*"],
        description="Safari browser cache",
        safe_level="safe",
    ),
    BloatPattern(
        name="WebKit Cache",
        category="Browser",
        patterns=["re:com\\.apple\\.WebKit.*"],
        description="WebKit shared cache",
        safe_level="safe",
    ),
]


# ============================================================================
# Package Manager Caches
# ============================================================================

PACKAGE_MANAGER_PATTERNS: list[BloatPattern] = [
    # --------------------------------------------------------------------------
    # Node.js (npm, yarn, pnpm)
    # --------------------------------------------------------------------------
    BloatPattern(
        name="npm cache",
        category="Package Manager",
        patterns=["_cacache", "_npx", "_logs"],
        description="npm cache files",
        safe_level="safe",
    ),
    BloatPattern(
        name="yarn cache",
        category="Package Manager",
        patterns=["yarn", "re:v[0-9]+-tmp"],
        description="Yarn package cache",
        safe_level="safe",
    ),
    BloatPattern(
        name="pnpm store",
        category="Package Manager",
        patterns=["pnpm-store", "pnpm"],
        description="pnpm package store",
        safe_level="safe",
    ),

    # --------------------------------------------------------------------------
    # Python (pip, pipx)
    # --------------------------------------------------------------------------
    BloatPattern(
        name="pip cache",
        category="Package Manager",
        patterns=["pip", "wheels", "re:^http-v[0-9]+$"],
        description="pip download cache",
        safe_level="safe",
    ),
    BloatPattern(
        name="pipx cache",
        category="Package Manager",
        patterns=["pipx"],
        description="pipx cache",
        safe_level="safe",
    ),

    # --------------------------------------------------------------------------
    # Rust (Cargo)
    # --------------------------------------------------------------------------
    BloatPattern(
        name="Cargo registry",
        category="Package Manager",
        patterns=["registry"],
        description="Cargo package registry cache",
        safe_level="caution",
        min_size=MIN_SIZE_LARGE_CACHE,  # Only if > 50MB
    ),
    BloatPattern(
        name="Cargo git",
        category="Package Manager",
        patterns=["checkouts", "re:^db$"],
        description="Cargo git dependencies cache",
        safe_level="caution",
        min_size=MIN_SIZE_LARGE_CACHE,  # Only if > 50MB
    ),

    # --------------------------------------------------------------------------
    # Go
    # --------------------------------------------------------------------------
    BloatPattern(
        name="Go build cache",
        category="Package Manager",
        patterns=["go-build"],
        description="Go build cache",
        safe_level="safe",
    ),
    BloatPattern(
        name="Go mod cache",
        category="Package Manager",
        patterns=["re:^mod$"],
        description="Go module cache",
        safe_level="caution",
    ),

    # --------------------------------------------------------------------------
    # Java (Maven, Gradle)
    # --------------------------------------------------------------------------
    # Maven - detected via explicit ~/.m2/repository path in detect.py
    # No pattern needed as "repository" is too generic

    BloatPattern(
        name="Gradle caches",
        category="Package Manager",
        patterns=["re:^caches$", "modules-2", "build-cache-1"],
        description="Gradle build cache",
        safe_level="safe",
    ),

    # --------------------------------------------------------------------------
    # PHP (Composer)
    # --------------------------------------------------------------------------
    BloatPattern(
        name="Composer cache",
        category="Package Manager",
        patterns=["composer"],
        description="PHP Composer cache",
        safe_level="safe",
    ),

    # --------------------------------------------------------------------------
    # .NET (NuGet)
    # --------------------------------------------------------------------------
    BloatPattern(
        name="NuGet cache",
        category="Package Manager",
        patterns=["nuget", "NuGet"],
        description="NuGet package cache",
        safe_level="safe",
    ),

    # --------------------------------------------------------------------------
    # Ruby (Bundler)
    # --------------------------------------------------------------------------
    BloatPattern(
        name="Bundler cache",
        category="Package Manager",
        patterns=["bundler"],
        description="Ruby Bundler cache",
        safe_level="safe",
    ),
]


# ============================================================================
# Application Caches
# ============================================================================

APP_CACHE_PATTERNS: list[BloatPattern] = [
    # --------------------------------------------------------------------------
    # Development Tools
    # --------------------------------------------------------------------------

    # VS Code
    BloatPattern(
        name="VS Code Cache",
        category="App",
        patterns=["CachedData", "CachedExtensions", "CachedExtensionVSIXs"],
        description="VS Code cached data",
        safe_level="safe",
    ),
    BloatPattern(
        name="VS Code Crashpad",
        category="App",
        patterns=["Crashpad"],
        description="VS Code crash reports",
        safe_level="safe",
    ),

    # JetBrains IDEs
    BloatPattern(
        name="JetBrains Caches",
        category="App",
        patterns=[
            "re:^(IntelliJ|PyCharm|WebStorm|GoLand|CLion|Rider|PhpStorm|RubyMine|DataGrip|AndroidStudio).*",
            "re:^JetBrains$",
        ],
        description="JetBrains IDE caches",
        safe_level="safe",
    ),
    BloatPattern(
        name="JetBrains Local History",
        category="App",
        patterns=["LocalHistory"],
        description="JetBrains local history",
        safe_level="caution",
    ),

    # Docker
    BloatPattern(
        name="Docker buildx cache",
        category="App",
        patterns=["buildx"],
        description="Docker buildx cache",
        safe_level="caution",
    ),

    # --------------------------------------------------------------------------
    # Electron Apps (Generic)
    # --------------------------------------------------------------------------
    BloatPattern(
        name="Electron GPU Cache",
        category="App",
        patterns=["GPUCache", "gpu-process-preferences"],
        description="Electron app GPU cache",
        safe_level="safe",
    ),
    BloatPattern(
        name="Electron Blob Storage",
        category="App",
        patterns=["blob_storage"],
        description="Electron blob storage",
        safe_level="safe",
    ),

    # --------------------------------------------------------------------------
    # Communication Apps
    # --------------------------------------------------------------------------

    # Microsoft Teams
    BloatPattern(
        name="Teams Cache",
        category="App",
        patterns=["re:^Teams$", "re:^microsoft-teams$"],
        description="Microsoft Teams cache",
        safe_level="safe",
    ),

    # Slack
    BloatPattern(
        name="Slack Cache",
        category="App",
        patterns=["re:^[Ss]lack$"],
        description="Slack cache",
        safe_level="safe",
    ),

    # Discord
    BloatPattern(
        name="Discord Cache",
        category="App",
        patterns=["re:^[Dd]iscord$"],
        description="Discord cache",
        safe_level="safe",
    ),

    # Zoom
    BloatPattern(
        name="Zoom Cache",
        category="App",
        patterns=["re:^[Zz]oom$", "re:^zoom\\.us$"],
        description="Zoom cache",
        safe_level="safe",
    ),

    # --------------------------------------------------------------------------
    # Media Apps
    # --------------------------------------------------------------------------

    # Spotify
    BloatPattern(
        name="Spotify Cache",
        category="App",
        patterns=["re:^spotify$", "re:^Spotify$"],
        description="Spotify streaming cache",
        safe_level="safe",
    ),

    # --------------------------------------------------------------------------
    # System Caches
    # --------------------------------------------------------------------------

    # Thumbnails
    BloatPattern(
        name="Thumbnails",
        category="System",
        patterns=["thumbnails", "Thumbnails"],
        description="Image thumbnail cache",
        safe_level="safe",
    ),

    # Font cache
    BloatPattern(
        name="Font Cache",
        category="System",
        patterns=["fontconfig"],
        description="Font rendering cache",
        safe_level="safe",
    ),

    # --------------------------------------------------------------------------
    # GPU Caches
    # --------------------------------------------------------------------------

    # Mesa/GPU shaders
    BloatPattern(
        name="Mesa Shader Cache",
        category="System",
        patterns=["mesa_shader_cache", "mesa_shader_cache_db"],
        description="Mesa GPU shader cache",
        safe_level="safe",
    ),

    # NVIDIA
    BloatPattern(
        name="NVIDIA Cache",
        category="System",
        patterns=["nvidia", "GLCache", "ComputeCache"],
        description="NVIDIA GPU cache",
        safe_level="safe",
    ),

    # AMD
    BloatPattern(
        name="AMD Cache",
        category="System",
        patterns=["AMD", "VkCache"],
        description="AMD GPU cache",
        safe_level="safe",
    ),
]


def get_browser_cache_patterns() -> list[BloatPattern]:
    """Get all browser cache patterns."""
    return BROWSER_CACHE_PATTERNS


def get_system_cache_patterns() -> list[BloatPattern]:
    """Get all system cache patterns including browsers, package managers, apps."""
    return BROWSER_CACHE_PATTERNS + PACKAGE_MANAGER_PATTERNS + APP_CACHE_PATTERNS
