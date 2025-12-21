"""Bloat Hunter CLI - Main entry point."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import typer
from rich.console import Console

from bloat_hunter import __version__
from bloat_hunter.core.scanner import Scanner
from bloat_hunter.core.analyzer import Analyzer
from bloat_hunter.core.cleaner import Cleaner
from bloat_hunter.platform.detect import get_platform_info
from bloat_hunter.ui.console import create_console, print_banner
from bloat_hunter.ui.prompts import confirm_deletion, select_targets

app = typer.Typer(
    name="bloat-hunter",
    help="Hunt down bloat, caches, and space hogs on your disk.",
    no_args_is_help=True,
)
console = create_console()


@app.command()
def scan(
    path: Path = typer.Argument(
        Path("."),
        help="Directory to scan for bloat",
        exists=True,
        file_okay=False,
        dir_okay=True,
        resolve_path=True,
    ),
    deep: bool = typer.Option(
        False,
        "--deep",
        "-d",
        help="Perform deep scan (slower but finds more)",
    ),
    show_all: bool = typer.Option(
        False,
        "--all",
        "-a",
        help="Show all findings, not just top offenders",
    ),
) -> None:
    """Scan a directory for bloat and caches."""
    print_banner(console)

    platform_info = get_platform_info()
    console.print(f"[dim]Platform: {platform_info.name} ({platform_info.variant})[/dim]\n")

    scanner = Scanner(console=console)
    results = scanner.scan(path, deep=deep)

    analyzer = Analyzer(console=console)
    analyzer.display_results(results, show_all=show_all)


@app.command()
def clean(
    path: Path = typer.Argument(
        Path("."),
        help="Directory to clean",
        exists=True,
        file_okay=False,
        dir_okay=True,
        resolve_path=True,
    ),
    dry_run: bool = typer.Option(
        True,
        "--dry-run/--execute",
        help="Preview changes without deleting (default: dry-run)",
    ),
    trash: bool = typer.Option(
        True,
        "--trash/--permanent",
        help="Move to trash instead of permanent deletion (default: trash)",
    ),
    interactive: bool = typer.Option(
        True,
        "--interactive/--auto",
        "-i/-y",
        help="Interactively select what to delete (default: interactive)",
    ),
) -> None:
    """Clean up bloat and caches from a directory."""
    print_banner(console)

    scanner = Scanner(console=console)
    results = scanner.scan(path, deep=True)

    if not results.targets:
        console.print("[green]No bloat found! Your disk is clean.[/green]")
        raise typer.Exit(0)

    # Interactive selection or auto-select all
    if interactive:
        selected = select_targets(results.targets)
        if not selected:
            console.print("[yellow]No targets selected. Exiting.[/yellow]")
            raise typer.Exit(0)
    else:
        selected = results.targets

    # Show what will be deleted
    analyzer = Analyzer(console=console)
    analyzer.display_deletion_preview(selected)

    if dry_run:
        console.print("\n[yellow]Dry run mode - no files were deleted.[/yellow]")
        console.print("[dim]Use --execute to actually delete files.[/dim]")
        raise typer.Exit(0)

    # Confirm before deletion
    if not confirm_deletion(len(selected)):
        console.print("[yellow]Aborted.[/yellow]")
        raise typer.Exit(0)

    # Perform cleanup
    cleaner = Cleaner(console=console, use_trash=trash)
    cleaner.clean(selected)


@app.command()
def info() -> None:
    """Show system and platform information."""
    print_banner(console)

    platform_info = get_platform_info()

    console.print("[bold]System Information[/bold]\n")
    console.print(f"  Platform: {platform_info.name}")
    console.print(f"  Variant:  {platform_info.variant}")
    console.print(f"  Home:     {platform_info.home_dir}")

    if platform_info.is_wsl:
        console.print(f"  WSL:      Yes ({platform_info.wsl_distro})")
        console.print(f"  Windows:  {platform_info.windows_home}")

    console.print(f"\n[dim]Bloat Hunter v{__version__}[/dim]")


@app.callback()
def main(
    version: bool = typer.Option(
        False,
        "--version",
        "-v",
        help="Show version and exit",
        is_eager=True,
    ),
) -> None:
    """Bloat Hunter - Hunt down disk bloat across all platforms."""
    if version:
        console.print(f"Bloat Hunter v{__version__}")
        raise typer.Exit(0)


if __name__ == "__main__":
    app()
