"""Cleaner for safe deletion of bloat targets."""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Optional

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, MofNCompleteColumn

from bloat_hunter.core.scanner import BloatTarget, format_size
from bloat_hunter.safety.protected import is_protected_path


class CleanerError(Exception):
    """Error during cleanup operation."""

    pass


class Cleaner:
    """Safely cleans up bloat targets."""

    def __init__(self, console: Optional[Console] = None, use_trash: bool = True):
        self.console = console or Console()
        self.use_trash = use_trash
        self._send2trash = self._load_send2trash() if use_trash else None

    def _load_send2trash(self):
        """Try to load send2trash for recycle bin support."""
        try:
            from send2trash import send2trash
            return send2trash
        except ImportError:
            self.console.print(
                "[yellow]Warning: send2trash not installed. "
                "Files will be permanently deleted.[/yellow]"
            )
            return None

    def clean(self, targets: list[BloatTarget]) -> tuple[int, int]:
        """
        Clean up the specified targets.

        Args:
            targets: List of bloat targets to delete

        Returns:
            Tuple of (success_count, failure_count)
        """
        success_count = 0
        failure_count = 0
        freed_bytes = 0

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            MofNCompleteColumn(),
            console=self.console,
        ) as progress:
            task = progress.add_task("Cleaning up...", total=len(targets))

            for target in targets:
                progress.update(task, description=f"Deleting: {target.path.name[:40]}")

                try:
                    self._delete_target(target)
                    success_count += 1
                    freed_bytes += target.size_bytes
                except Exception as e:
                    failure_count += 1
                    self.console.print(f"[red]Failed to delete {target.path}: {e}[/red]")

                progress.advance(task)

        # Summary
        self.console.print()
        if success_count > 0:
            self.console.print(
                f"[green]Successfully cleaned {success_count} targets, "
                f"freed {format_size(freed_bytes)}[/green]"
            )
        if failure_count > 0:
            self.console.print(f"[red]Failed to clean {failure_count} targets[/red]")

        return success_count, failure_count

    def _delete_target(self, target: BloatTarget) -> None:
        """Delete a single target safely."""
        path = target.path

        # Safety check
        if is_protected_path(path):
            raise CleanerError(f"Refusing to delete protected path: {path}")

        if not path.exists():
            return  # Already deleted

        # Use trash if available, otherwise permanent delete
        if self._send2trash:
            try:
                self._send2trash(str(path.absolute()))
                return
            except Exception:
                # Fall back to permanent deletion
                pass

        # Permanent deletion
        if path.is_dir():
            shutil.rmtree(path, ignore_errors=True)
        else:
            path.unlink(missing_ok=True)
