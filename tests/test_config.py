"""Tests for the configuration module."""

from __future__ import annotations

from pathlib import Path

import pytest

from bloat_hunter.config import (
    DEFAULT_CONFIG_TEMPLATE,
    VALID_KEEP_STRATEGIES,
    CachesConfig,
    Config,
    DefaultsConfig,
    DuplicatesConfig,
    PackagesConfig,
    ScanConfig,
    _dict_to_config,
    _merge_dicts,
    _validate_config,
    get_config_paths,
    get_xdg_config_home,
    load_config,
    load_config_from_file,
)


class TestDefaultsConfig:
    """Tests for DefaultsConfig dataclass."""

    def test_default_values(self):
        config = DefaultsConfig()
        assert config.dry_run is True
        assert config.trash is True
        assert config.interactive is True
        assert config.wsl_windows is True

    def test_custom_values(self):
        config = DefaultsConfig(dry_run=False, trash=False)
        assert config.dry_run is False
        assert config.trash is False
        assert config.interactive is True  # default


class TestPackagesConfig:
    """Tests for PackagesConfig dataclass."""

    def test_default_values(self):
        config = PackagesConfig()
        assert config.npm is True
        assert config.yarn is True
        assert config.pip is True
        assert config.cargo is True

    def test_custom_values(self):
        config = PackagesConfig(npm=False, pip=False)
        assert config.npm is False
        assert config.pip is False
        assert config.yarn is True  # default


class TestCachesConfig:
    """Tests for CachesConfig dataclass."""

    def test_default_values(self):
        config = CachesConfig()
        assert config.browsers is True
        assert config.package_managers is True
        assert config.apps is True


class TestDuplicatesConfig:
    """Tests for DuplicatesConfig dataclass."""

    def test_default_values(self):
        config = DuplicatesConfig()
        assert config.min_size == "1MB"
        assert config.keep == "first"

    def test_min_size_bytes_property(self):
        config = DuplicatesConfig(min_size="10MB")
        assert config.min_size_bytes == 10 * 1024 * 1024

    def test_keep_strategies(self):
        for strategy in VALID_KEEP_STRATEGIES:
            config = DuplicatesConfig(keep=strategy)
            assert config.keep == strategy


class TestScanConfig:
    """Tests for ScanConfig dataclass."""

    def test_default_values(self):
        config = ScanConfig()
        assert config.show_all is False
        assert config.deep is False
        assert config.min_size == "0B"

    def test_min_size_bytes_property(self):
        config = ScanConfig(min_size="10MB")
        assert config.min_size_bytes == 10 * 1024 * 1024

    def test_min_size_bytes_zero_default(self):
        config = ScanConfig()
        assert config.min_size_bytes == 0


class TestConfig:
    """Tests for Config root dataclass."""

    def test_default_values(self):
        config = Config()
        assert isinstance(config.defaults, DefaultsConfig)
        assert isinstance(config.packages, PackagesConfig)
        assert isinstance(config.caches, CachesConfig)
        assert isinstance(config.duplicates, DuplicatesConfig)
        assert isinstance(config.scan, ScanConfig)
        assert config._source is None


class TestMergeDicts:
    """Tests for _merge_dicts function."""

    def test_simple_merge(self):
        base = {"a": 1, "b": 2}
        override = {"b": 3, "c": 4}
        result = _merge_dicts(base, override)
        assert result == {"a": 1, "b": 3, "c": 4}

    def test_deep_merge(self):
        base = {"section": {"a": 1, "b": 2}}
        override = {"section": {"b": 3}}
        result = _merge_dicts(base, override)
        assert result == {"section": {"a": 1, "b": 3}}

    def test_base_unchanged(self):
        base = {"a": 1}
        override = {"a": 2}
        _merge_dicts(base, override)
        assert base == {"a": 1}  # Original unchanged


class TestValidateConfig:
    """Tests for _validate_config function."""

    def test_valid_config(self):
        data = {
            "defaults": {"dry_run": True},
            "duplicates": {"keep": "first", "min_size": "10MB"},
        }
        errors = _validate_config(data)
        assert errors == []

    def test_invalid_keep_strategy(self):
        data = {"duplicates": {"keep": "invalid"}}
        errors = _validate_config(data)
        assert len(errors) == 1
        assert "duplicates.keep" in errors[0]

    def test_invalid_min_size(self):
        data = {"duplicates": {"min_size": "invalid"}}
        errors = _validate_config(data)
        assert len(errors) == 1
        assert "duplicates.min_size" in errors[0]

    def test_invalid_scan_min_size(self):
        data = {"scan": {"min_size": "invalid"}}
        errors = _validate_config(data)
        assert len(errors) == 1
        assert "scan.min_size" in errors[0]

    def test_valid_scan_min_size(self):
        data = {"scan": {"min_size": "100MB"}}
        errors = _validate_config(data)
        assert errors == []


class TestDictToConfig:
    """Tests for _dict_to_config function."""

    def test_empty_dict(self):
        config = _dict_to_config({})
        assert config.defaults.dry_run is True  # Default
        assert config._source is None

    def test_partial_config(self):
        data = {"defaults": {"dry_run": False}}
        config = _dict_to_config(data)
        assert config.defaults.dry_run is False
        assert config.defaults.trash is True  # Default

    def test_with_source(self):
        path = Path("/test/config.toml")
        config = _dict_to_config({}, source=path)
        assert config._source == path


class TestGetConfigPaths:
    """Tests for get_config_paths function."""

    def test_returns_tuple(self):
        xdg, cwd = get_config_paths()
        assert isinstance(xdg, Path)
        assert isinstance(cwd, Path)

    def test_xdg_path_format(self):
        xdg, _ = get_config_paths()
        assert xdg.name == "config.toml"
        assert "bloat-hunter" in str(xdg)

    def test_cwd_path_format(self):
        _, cwd = get_config_paths()
        assert cwd.name == "bloathunter.toml"


class TestGetXdgConfigHome:
    """Tests for get_xdg_config_home function."""

    def test_default_path(self, monkeypatch):
        monkeypatch.delenv("XDG_CONFIG_HOME", raising=False)
        result = get_xdg_config_home()
        assert result == Path.home() / ".config"

    def test_custom_xdg(self, monkeypatch):
        monkeypatch.setenv("XDG_CONFIG_HOME", "/custom/config")
        result = get_xdg_config_home()
        assert result == Path("/custom/config")


class TestLoadConfig:
    """Tests for load_config function."""

    def test_no_config_files(self, monkeypatch, tmp_path):
        # Ensure no config files exist
        monkeypatch.chdir(tmp_path)
        monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path / "nonexistent"))
        config = load_config()
        assert config._source is None
        assert config.defaults.dry_run is True  # Default


class TestLoadConfigFromFile:
    """Tests for load_config_from_file function."""

    def test_load_valid_file(self, tmp_path):
        config_file = tmp_path / "test.toml"
        config_file.write_text("""
[defaults]
dry_run = false
trash = false
""")
        config = load_config_from_file(config_file)
        assert config.defaults.dry_run is False
        assert config.defaults.trash is False
        assert config._source == config_file

    def test_load_partial_file(self, tmp_path):
        config_file = tmp_path / "test.toml"
        config_file.write_text("""
[packages]
npm = false
""")
        config = load_config_from_file(config_file)
        assert config.packages.npm is False
        assert config.packages.pip is True  # Default

    def test_load_invalid_keep_strategy(self, tmp_path):
        config_file = tmp_path / "test.toml"
        config_file.write_text("""
[duplicates]
keep = "invalid"
""")
        with pytest.raises(ValueError, match="duplicates.keep"):
            load_config_from_file(config_file)


class TestDefaultConfigTemplate:
    """Tests for DEFAULT_CONFIG_TEMPLATE."""

    def test_template_is_valid_toml(self, tmp_path):
        # Write template and try to parse it
        config_file = tmp_path / "test.toml"
        config_file.write_text(DEFAULT_CONFIG_TEMPLATE)
        config = load_config_from_file(config_file)
        assert config.defaults.dry_run is True

    def test_template_has_all_sections(self):
        assert "[defaults]" in DEFAULT_CONFIG_TEMPLATE
        assert "[packages]" in DEFAULT_CONFIG_TEMPLATE
        assert "[caches]" in DEFAULT_CONFIG_TEMPLATE
        assert "[duplicates]" in DEFAULT_CONFIG_TEMPLATE
        assert "[scan]" in DEFAULT_CONFIG_TEMPLATE

    def test_template_has_comments(self):
        assert "#" in DEFAULT_CONFIG_TEMPLATE
