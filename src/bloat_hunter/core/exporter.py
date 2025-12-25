"""Export scan results to JSON and CSV formats."""

from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING, Any, Literal, TypeAlias

if TYPE_CHECKING:
    from bloat_hunter.core.cache_scanner import CacheScanResult
    from bloat_hunter.core.duplicates import DuplicateResult
    from bloat_hunter.core.package_scanner import PackageScanResult
    from bloat_hunter.core.scanner import BloatTarget, ScanResult

ExportFormat = Literal["json", "csv"]

# Type alias for any scan result type
AnyResult: TypeAlias = "ScanResult | DuplicateResult | CacheScanResult | PackageScanResult"


def _get_timestamp() -> str:
    """Return current UTC timestamp in ISO format."""
    return datetime.now(timezone.utc).isoformat()


def _target_to_dict(target: BloatTarget) -> dict[str, Any]:
    """Convert BloatTarget to serializable dict."""
    return {
        "path": str(target.path),
        "category": target.category,
        "pattern_name": target.pattern.name,
        "size_bytes": target.size_bytes,
        "size_human": target.size_human,
        "file_count": target.file_count,
    }


def _scan_result_to_dict(result: ScanResult) -> dict[str, Any]:
    """Convert ScanResult to serializable dict."""
    return {
        "type": "scan",
        "timestamp": _get_timestamp(),
        "root_path": str(result.root_path),
        "total_size_bytes": result.total_size,
        "total_size_human": result.total_size_human,
        "target_count": len(result.targets),
        "targets": [_target_to_dict(t) for t in result.targets],
        "scan_errors": result.scan_errors,
    }


def _duplicate_result_to_dict(result: DuplicateResult) -> dict[str, Any]:
    """Convert DuplicateResult to serializable dict."""
    groups = []
    for group in result.groups:
        groups.append({
            "hash_value": group.hash_value,
            "size_bytes": group.size_bytes,
            "size_human": group.size_human,
            "duplicate_count": group.duplicate_count,
            "wasted_bytes": group.wasted_bytes,
            "wasted_human": group.wasted_human,
            "files": [
                {
                    "path": str(f.path),
                    "size_bytes": f.size_bytes,
                    "mtime": f.mtime,
                }
                for f in group.files
            ],
        })

    return {
        "type": "duplicates",
        "timestamp": _get_timestamp(),
        "root_path": str(result.root_path),
        "files_scanned": result.files_scanned,
        "total_wasted_bytes": result.total_wasted,
        "total_wasted_human": result.total_wasted_human,
        "total_duplicates": result.total_duplicates,
        "group_count": len(result.groups),
        "groups": groups,
        "scan_errors": result.scan_errors,
    }


def _cache_result_to_dict(result: CacheScanResult) -> dict[str, Any]:
    """Convert CacheScanResult to serializable dict."""
    return {
        "type": "caches",
        "timestamp": _get_timestamp(),
        "platform": {
            "name": result.platform_info.name,
            "variant": result.platform_info.variant,
            "is_wsl": result.platform_info.is_wsl,
        },
        "total_size_bytes": result.total_size,
        "total_size_human": result.total_size_human,
        "target_count": len(result.targets),
        "categories_scanned": result.categories_scanned,
        "targets": [_target_to_dict(t) for t in result.targets],
        "scan_errors": result.scan_errors,
    }


def _package_result_to_dict(result: PackageScanResult) -> dict[str, Any]:
    """Convert PackageScanResult to serializable dict."""
    by_manager = {}
    for name, stats in result.by_manager.items():
        by_manager[name] = {
            "size_bytes": stats.size_bytes,
            "size_human": stats.size_human,
            "file_count": stats.file_count,
            "target_count": len(stats.targets),
        }

    return {
        "type": "packages",
        "timestamp": _get_timestamp(),
        "platform": {
            "name": result.platform_info.name,
            "variant": result.platform_info.variant,
            "is_wsl": result.platform_info.is_wsl,
        },
        "total_size_bytes": result.total_size,
        "total_size_human": result.total_size_human,
        "target_count": len(result.targets),
        "by_manager": by_manager,
        "targets": [_target_to_dict(t) for t in result.targets],
        "scan_errors": result.scan_errors,
    }


def result_to_dict(
    result: AnyResult,
) -> dict[str, Any]:
    """Convert any result type to a serializable dict."""
    # Import here to avoid circular imports
    from bloat_hunter.core.cache_scanner import CacheScanResult
    from bloat_hunter.core.duplicates import DuplicateResult
    from bloat_hunter.core.package_scanner import PackageScanResult

    if isinstance(result, DuplicateResult):
        return _duplicate_result_to_dict(result)
    elif isinstance(result, CacheScanResult):
        return _cache_result_to_dict(result)
    elif isinstance(result, PackageScanResult):
        return _package_result_to_dict(result)
    else:
        return _scan_result_to_dict(result)


def export_json(
    result: AnyResult,
    output_path: Path,
    *,
    indent: int = 2,
) -> None:
    """
    Export scan results to JSON file.

    Args:
        result: Scan result to export
        output_path: Path to write JSON file
        indent: JSON indentation level (default: 2)
    """
    data = result_to_dict(result)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=indent, ensure_ascii=False)


def export_csv(
    result: AnyResult,
    output_path: Path,
) -> None:
    """
    Export scan results to CSV file.

    For duplicate results, exports one row per file (grouped by hash).
    For other results, exports one row per target.

    Args:
        result: Scan result to export
        output_path: Path to write CSV file
    """
    from bloat_hunter.core.duplicates import DuplicateResult

    if isinstance(result, DuplicateResult):
        _export_duplicates_csv(result, output_path)
    else:
        _export_targets_csv(result, output_path)


def _export_targets_csv(
    result: ScanResult | CacheScanResult | PackageScanResult,
    output_path: Path,
) -> None:
    """Export target-based results to CSV."""
    fieldnames = [
        "path",
        "category",
        "pattern_name",
        "size_bytes",
        "size_human",
        "file_count",
    ]

    with open(output_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for target in result.targets:
            writer.writerow(_target_to_dict(target))


def _export_duplicates_csv(result: DuplicateResult, output_path: Path) -> None:
    """Export duplicate results to CSV (one row per file)."""
    fieldnames = [
        "group_hash",
        "group_size_bytes",
        "group_wasted_bytes",
        "duplicate_count",
        "file_path",
        "file_mtime",
    ]

    with open(output_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for group in result.groups:
            for file in group.files:
                writer.writerow({
                    "group_hash": group.hash_value,
                    "group_size_bytes": group.size_bytes,
                    "group_wasted_bytes": group.wasted_bytes,
                    "duplicate_count": group.duplicate_count,
                    "file_path": str(file.path),
                    "file_mtime": file.mtime,
                })


def export_result(
    result: AnyResult,
    output_path: Path,
    fmt: ExportFormat = "json",
) -> None:
    """
    Export scan results to file in specified format.

    Args:
        result: Scan result to export
        output_path: Path to write output file
        fmt: Output format ("json" or "csv")

    Raises:
        ValueError: If format is not supported
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if fmt == "json":
        export_json(result, output_path)
    elif fmt == "csv":
        export_csv(result, output_path)
    else:
        raise ValueError(f"Unsupported export format: {fmt}")
