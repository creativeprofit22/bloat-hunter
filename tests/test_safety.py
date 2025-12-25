"""Tests for safety mechanisms."""

from __future__ import annotations

from pathlib import Path

from bloat_hunter.safety.protected import is_protected_path


class TestIsProtectedPath:
    """Tests for is_protected_path function."""

    def test_root_is_protected(self):
        assert is_protected_path(Path("/")) is True

    def test_system_dirs_protected(self):
        assert is_protected_path(Path("/etc")) is True
        assert is_protected_path(Path("/usr")) is True
        assert is_protected_path(Path("/bin")) is True

    def test_ssh_is_protected(self, temp_dir: Path):
        ssh_dir = temp_dir / ".ssh"
        ssh_dir.mkdir()
        assert is_protected_path(ssh_dir) is True

    def test_gnupg_is_protected(self, temp_dir: Path):
        gnupg_dir = temp_dir / ".gnupg"
        gnupg_dir.mkdir()
        assert is_protected_path(gnupg_dir) is True

    def test_cache_not_protected(self, temp_dir: Path):
        cache_dir = temp_dir / ".cache"
        cache_dir.mkdir()
        assert is_protected_path(cache_dir) is False

    def test_node_modules_not_protected(self, temp_dir: Path):
        nm_dir = temp_dir / "project" / "node_modules"
        nm_dir.mkdir(parents=True)
        assert is_protected_path(nm_dir) is False

    def test_pycache_not_protected(self, temp_dir: Path):
        pycache = temp_dir / "project" / "__pycache__"
        pycache.mkdir(parents=True)
        assert is_protected_path(pycache) is False

    def test_project_root_protected(self, temp_dir: Path):
        # Create a project root (has pyproject.toml)
        project = temp_dir / "myproject"
        project.mkdir()
        (project / "pyproject.toml").write_text("[project]\nname='test'")

        # The project root itself should be protected
        assert is_protected_path(project) is True

        # But cache inside should not be
        cache = project / "__pycache__"
        cache.mkdir()
        assert is_protected_path(cache) is False
