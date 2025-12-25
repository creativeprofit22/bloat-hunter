"""Cache-related bloat patterns."""

from __future__ import annotations

from .base import BloatPattern

CACHE_PATTERNS: list[BloatPattern] = [
    # Python
    BloatPattern(
        name="__pycache__",
        category="Python",
        patterns=["__pycache__"],
        description="Python bytecode cache",
        safe_level="safe",
    ),
    BloatPattern(
        name=".pytest_cache",
        category="Python",
        patterns=[".pytest_cache"],
        description="Pytest cache directory",
        safe_level="safe",
    ),
    BloatPattern(
        name=".mypy_cache",
        category="Python",
        patterns=[".mypy_cache"],
        description="Mypy type checker cache",
        safe_level="safe",
    ),
    BloatPattern(
        name=".ruff_cache",
        category="Python",
        patterns=[".ruff_cache"],
        description="Ruff linter cache",
        safe_level="safe",
    ),
    BloatPattern(
        name=".tox",
        category="Python",
        patterns=[".tox"],
        description="Tox test environments",
        safe_level="safe",
    ),
    BloatPattern(
        name=".nox",
        category="Python",
        patterns=[".nox"],
        description="Nox test environments",
        safe_level="safe",
    ),
    BloatPattern(
        name=".coverage",
        category="Python",
        patterns=["htmlcov", ".coverage"],
        description="Coverage reports",
        safe_level="safe",
    ),

    # Node.js
    BloatPattern(
        name="node_modules",
        category="Node.js",
        patterns=["node_modules"],
        description="Node.js dependencies (reinstallable with npm/yarn)",
        safe_level="safe",
        min_size=1024 * 1024,  # Only report if > 1MB
    ),
    BloatPattern(
        name=".next",
        category="Node.js",
        patterns=[".next"],
        description="Next.js build cache",
        safe_level="safe",
    ),
    BloatPattern(
        name=".nuxt",
        category="Node.js",
        patterns=[".nuxt"],
        description="Nuxt.js build cache",
        safe_level="safe",
    ),
    BloatPattern(
        name=".parcel-cache",
        category="Node.js",
        patterns=[".parcel-cache"],
        description="Parcel bundler cache",
        safe_level="safe",
    ),
    BloatPattern(
        name=".turbo",
        category="Node.js",
        patterns=[".turbo"],
        description="Turborepo cache",
        safe_level="safe",
    ),

    # Rust
    BloatPattern(
        name="target",
        category="Rust",
        patterns=["target"],
        description="Rust/Cargo build artifacts",
        safe_level="caution",
        min_size=10 * 1024 * 1024,  # Only if > 10MB
    ),

    # Java/Gradle
    BloatPattern(
        name=".gradle",
        category="Java",
        patterns=[".gradle"],
        description="Gradle build cache",
        safe_level="safe",
    ),
    BloatPattern(
        name="build",
        category="Build",
        patterns=["build"],
        description="Build output directory",
        safe_level="caution",
    ),

    # Generic
    BloatPattern(
        name=".cache",
        category="Generic",
        patterns=[".cache"],
        description="Generic cache directory",
        safe_level="safe",
    ),
    BloatPattern(
        name="tmp",
        category="Generic",
        patterns=["tmp", "temp", ".tmp"],
        description="Temporary files",
        safe_level="safe",
    ),
]
