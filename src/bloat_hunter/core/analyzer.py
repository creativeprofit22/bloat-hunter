"""Analyzer for displaying scan results."""

from __future__ import annotations

from typing import Optional

from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from bloat_hunter.core.scanner import ScanResult, BloatTarget, format_size


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
