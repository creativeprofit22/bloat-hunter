"""Pytest configuration and fixtures."""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest


@pytest.fixture
def temp_dir():
    """Create a temporary directory for testing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def mock_project(temp_dir: Path):
    """Create a mock project structure with bloat."""
    # Create project root
    project = temp_dir / "test-project"
    project.mkdir()

    # Create node_modules bloat (>1MB to exceed min_size threshold)
    node_modules = project / "node_modules"
    node_modules.mkdir()
    (node_modules / "lodash").mkdir()
    # Create a file larger than 1MB to exceed the min_size threshold
    (node_modules / "lodash" / "index.js").write_bytes(b"x" * (1024 * 1024 + 100))

    # Create __pycache__ bloat
    pycache = project / "__pycache__"
    pycache.mkdir()
    (pycache / "module.cpython-310.pyc").write_bytes(b"\x00" * 1000)

    # Create .pytest_cache
    pytest_cache = project / ".pytest_cache"
    pytest_cache.mkdir()
    (pytest_cache / "v" / "cache").mkdir(parents=True)
    (pytest_cache / "v" / "cache" / "data.json").write_text("{}")

    # Create actual source files (no pyproject.toml to avoid project root protection)
    (project / "main.py").write_text("print('hello')")

    yield project


@pytest.fixture
def protected_structure(temp_dir: Path):
    """Create a structure with protected paths."""
    # Create Documents folder (protected)
    docs = temp_dir / "Documents"
    docs.mkdir()
    (docs / "important.docx").write_text("important")

    # Create .ssh folder (protected)
    ssh = temp_dir / ".ssh"
    ssh.mkdir()
    (ssh / "id_rsa").write_text("private key")

    # Create cache folder (not protected)
    cache = temp_dir / ".cache"
    cache.mkdir()
    (cache / "temp.txt").write_text("temp")

    yield temp_dir
