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


@pytest.fixture
def duplicate_files(temp_dir: Path):
    """Create a structure with duplicate files."""
    # Create identical large files (just over 1MB to exceed default min_size)
    content = b"x" * (1024 * 1024 + 100)
    (temp_dir / "original.bin").write_bytes(content)
    (temp_dir / "copy1.bin").write_bytes(content)

    subdir = temp_dir / "subdir"
    subdir.mkdir()
    (subdir / "copy2.bin").write_bytes(content)

    # Different file (same size but different content)
    (temp_dir / "different.bin").write_bytes(b"y" * (1024 * 1024 + 100))

    # Small identical files (below default min_size)
    (temp_dir / "small1.txt").write_text("small file")
    (temp_dir / "small2.txt").write_text("small file")

    yield temp_dir


@pytest.fixture
def duplicate_files_small(temp_dir: Path):
    """Create small duplicate files for testing with min_size=0."""
    content = b"duplicate content here"
    (temp_dir / "file1.txt").write_bytes(content)
    (temp_dir / "file2.txt").write_bytes(content)

    subdir = temp_dir / "nested"
    subdir.mkdir()
    (subdir / "file3.txt").write_bytes(content)

    # Unique file
    (temp_dir / "unique.txt").write_bytes(b"unique content")

    yield temp_dir
