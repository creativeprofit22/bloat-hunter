"""Development environment bloat patterns."""

from __future__ import annotations

from pathlib import Path

from bloat_hunter.patterns import BloatPattern


def _is_venv(path: Path) -> bool:
    """Check if a directory is a Python virtual environment."""
    # Check for venv indicators
    indicators = [
        path / "pyvenv.cfg",
        path / "bin" / "activate",
        path / "Scripts" / "activate.bat",
        path / "lib" / "python3.10",  # or any python version
    ]
    return any(ind.exists() for ind in indicators[:3])


def _is_dist(path: Path) -> bool:
    """Check if this is a distribution directory."""
    # Check for common dist indicators
    parent_has_setup = (path.parent / "setup.py").exists()
    parent_has_pyproject = (path.parent / "pyproject.toml").exists()
    return parent_has_setup or parent_has_pyproject


DEV_PATTERNS: list[BloatPattern] = [
    # Python virtual environments
    BloatPattern(
        name=".venv",
        category="Python",
        patterns=[".venv", "venv", ".virtualenv", "virtualenv", "env"],
        description="Python virtual environment",
        safe_level="caution",
        validator=_is_venv,
    ),
    BloatPattern(
        name=".eggs",
        category="Python",
        patterns=[".eggs"],
        description="Python egg files",
        safe_level="safe",
    ),
    BloatPattern(
        name="*.egg-info",
        category="Python",
        patterns=["re:.*\\.egg-info$"],
        description="Python package metadata",
        safe_level="safe",
    ),
    BloatPattern(
        name="dist",
        category="Build",
        patterns=["dist"],
        description="Distribution files",
        safe_level="caution",
        validator=_is_dist,
    ),

    # IDE/Editor
    BloatPattern(
        name=".idea",
        category="IDE",
        patterns=[".idea"],
        description="JetBrains IDE settings",
        safe_level="caution",
    ),
    BloatPattern(
        name=".vscode",
        category="IDE",
        patterns=[".vscode"],
        description="VS Code settings",
        safe_level="caution",
    ),

    # Documentation builds
    BloatPattern(
        name="docs/_build",
        category="Docs",
        patterns=["_build"],
        description="Sphinx documentation build",
        safe_level="safe",
    ),
    BloatPattern(
        name="site",
        category="Docs",
        patterns=["site"],
        description="MkDocs build output",
        safe_level="caution",
    ),

    # Logs
    BloatPattern(
        name="logs",
        category="Logs",
        patterns=["logs", "log"],
        description="Log directories",
        safe_level="caution",
    ),

    # Vendor directories
    BloatPattern(
        name="vendor",
        category="Vendor",
        patterns=["vendor", "vendors"],
        description="Vendored dependencies",
        safe_level="caution",
    ),

    # Docker
    BloatPattern(
        name=".docker",
        category="Docker",
        patterns=[".docker"],
        description="Docker build cache",
        safe_level="safe",
    ),

    # Terraform
    BloatPattern(
        name=".terraform",
        category="IaC",
        patterns=[".terraform"],
        description="Terraform provider cache",
        safe_level="safe",
    ),
]
