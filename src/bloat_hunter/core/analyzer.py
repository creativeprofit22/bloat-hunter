"""Analyzer for displaying scan results."""

from __future__ import annotations

from typing import Optional

from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from bloat_hunter.core.scanner import ScanResult, BloatTarget, format_size
from bloat_hunter.core.duplicates import DuplicateResult, DuplicateGroup, KeepStrategy


class Analyzer:
    """Analyzes and displays scan results."""

    def __init__(self, console: Optional[Console] = None):
        self.console = console or Console()

    def display_results(self, result: ScanResult, show_all: bool = False) -> None:
        """Display scan results in a formatted table."""
        if not result.targets:
            self.console.print("[green]No bloat found! Your disk is clean.[/green]")
            return

        # Summary panel
        summary = Panel(
            f"[bold]Total Bloat Found:[/bold] {result.total_size_human}\n"
            f"[bold]Targets:[/bold] {len(result.targets)} directories",
            title="Scan Summary",
            border_style="blue",
        )
        self.console.print(summary)
        self.console.print()

        # Results table
        table = Table(
            title="Bloat Targets",
            show_header=True,
            header_style="bold magenta",
        )
        table.add_column("#", style="dim", width=4)
        table.add_column("Size", justify="right", style="cyan", width=10)
        table.add_column("Category", style="yellow", width=12)
        table.add_column("Type", style="green", width=15)
        table.add_column("Path", style="white", overflow="ellipsis")

        # Show top 20 or all
        targets_to_show = result.targets if show_all else result.targets[:20]

        for i, target in enumerate(targets_to_show, 1):
            table.add_row(
                str(i),
                target.size_human,
                target.category,
                target.pattern.name,
                str(target.path),
            )

        self.console.print(table)

        if not show_all and len(result.targets) > 20:
            self.console.print(
                f"\n[dim]Showing top 20 of {len(result.targets)} targets. "
                f"Use --all to see everything.[/dim]"
            )

        # Show errors if any
        if result.scan_errors:
            self.console.print(f"\n[yellow]Skipped {len(result.scan_errors)} directories due to errors.[/yellow]")

    def display_deletion_preview(self, targets: list[BloatTarget]) -> None:
        """Display what will be deleted."""
        total_size = sum(t.size_bytes for t in targets)

        self.console.print("\n[bold]The following will be deleted:[/bold]\n")

        table = Table(show_header=True, header_style="bold red")
        table.add_column("Size", justify="right", style="cyan", width=10)
        table.add_column("Type", style="yellow", width=15)
        table.add_column("Path", style="white")

        for target in targets:
            table.add_row(
                target.size_human,
                target.pattern.name,
                str(target.path),
            )

        self.console.print(table)
        self.console.print(f"\n[bold]Total to be freed:[/bold] [cyan]{format_size(total_size)}[/cyan]")

    def display_duplicate_results(
        self, result: DuplicateResult, show_all: bool = False
    ) -> None:
        """Display duplicate scan results."""
        if not result.groups:
            self.console.print("[green]No duplicates found![/green]")
            return

        # Summary panel
        summary = Panel(
            f"[bold]Wasted Space:[/bold] {result.total_wasted_human}\n"
            f"[bold]Duplicate Groups:[/bold] {len(result.groups)}\n"
            f"[bold]Duplicate Files:[/bold] {result.total_duplicates}\n"
            f"[bold]Files Scanned:[/bold] {result.files_scanned}",
            title="Duplicate Scan Summary",
            border_style="blue",
        )
        self.console.print(summary)
        self.console.print()

        # Results table
        table = Table(
            title="Duplicate Groups",
            show_header=True,
            header_style="bold magenta",
        )
        table.add_column("#", style="dim", width=4)
        table.add_column("File Size", justify="right", style="cyan", width=10)
        table.add_column("Copies", justify="center", style="yellow", width=8)
        table.add_column("Wasted", justify="right", style="red", width=10)
        table.add_column("Hash", style="dim", width=16)

        # Show top 20 or all
        groups_to_show = result.groups if show_all else result.groups[:20]

        for i, group in enumerate(groups_to_show, 1):
            table.add_row(
                str(i),
                group.size_human,
                str(len(group.files)),
                group.wasted_human,
                group.hash_value[:16],
            )

        self.console.print(table)

        if not show_all and len(result.groups) > 20:
            self.console.print(
                f"\n[dim]Showing top 20 of {len(result.groups)} groups. "
                f"Use --all to see everything.[/dim]"
            )

        # Show errors if any
        if result.scan_errors:
            self.console.print(
                f"\n[yellow]Skipped {len(result.scan_errors)} directories due to errors.[/yellow]"
            )

    def display_duplicate_group(self, group: DuplicateGroup, index: int = 0) -> None:
        """Display a single duplicate group with all file paths."""
        self.console.print(
            f"\n[bold]Group {index}[/bold] - {group.size_human} x {len(group.files)} copies"
        )
        self.console.print(f"[dim]Hash: {group.hash_value}[/dim]")

        for i, file in enumerate(group.files, 1):
            self.console.print(f"  {i}. {file.path}")

    def display_duplicate_deletion_preview(
        self,
        groups: list[DuplicateGroup],
        strategy: KeepStrategy,
    ) -> None:
        """Show which files will be deleted and which kept."""
        total_to_delete = sum(g.duplicate_count for g in groups)
        total_size = sum(g.wasted_bytes for g in groups)

        self.console.print(f"\n[bold]Deletion Preview (keeping: {strategy})[/bold]\n")

        table = Table(show_header=True, header_style="bold red")
        table.add_column("Size", justify="right", style="cyan", width=10)
        table.add_column("Keep", style="green")
        table.add_column("Delete", style="red")

        for group in groups[:20]:  # Limit preview
            keep_file = group.get_keep_file(strategy)
            delete_files = group.get_duplicates_to_remove(strategy)

            table.add_row(
                group.size_human,
                str(keep_file.path),
                f"{len(delete_files)} file(s)",
            )

        self.console.print(table)

        if len(groups) > 20:
            self.console.print(f"\n[dim]... and {len(groups) - 20} more groups[/dim]")

        self.console.print(
            f"\n[bold]Total to delete:[/bold] {total_to_delete} files"
        )
        self.console.print(
            f"[bold]Space to free:[/bold] [cyan]{format_size(total_size)}[/cyan]"
        )
