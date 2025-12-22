"""Bloat Hunter CLI - Main entry point."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import typer
from rich.console import Console

from bloat_hunter import __version__
from bloat_hunter.core.scanner import Scanner, parse_size
from bloat_hunter.core.analyzer import Analyzer
from bloat_hunter.core.cleaner import Cleaner
from bloat_hunter.core.duplicates import DuplicateScanner, KeepStrategy
from bloat_hunter.platform.detect import get_platform_info
from bloat_hunter.ui.console import create_console, print_banner
from bloat_hunter.ui.prompts import confirm_deletion, select_targets, select_duplicate_groups

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
def duplicates(
    path: Path = typer.Argument(
        Path("."),
        help="Directory to scan for duplicates",
        exists=True,
        file_okay=False,
        dir_okay=True,
        resolve_path=True,
    ),
    min_size: str = typer.Option(
        "1MB",
        "--min-size",
        "-s",
        help="Minimum file size to consider (e.g., 1KB, 1MB, 10MB)",
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
    keep: str = typer.Option(
        "first",
        "--keep",
        "-k",
        help="Which file to keep: first, shortest, oldest, newest",
    ),
    show_all: bool = typer.Option(
        False,
        "--all",
        "-a",
        help="Show all duplicate groups (default: top 20)",
    ),
    interactive: bool = typer.Option(
        True,
        "--interactive/--auto",
        help="Interactively select which groups to clean",
    ),
) -> None:
    """Find and optionally remove duplicate files."""
    print_banner(console)

    # Validate keep strategy
    valid_strategies: list[KeepStrategy] = ["first", "shortest", "oldest", "newest"]
    if keep not in valid_strategies:
        console.print(f"[red]Invalid keep strategy: {keep}[/red]")
        console.print(f"[dim]Valid options: {', '.join(valid_strategies)}[/dim]")
        raise typer.Exit(1)

    keep_strategy: KeepStrategy = keep  # type: ignore[assignment]

    # Parse min_size
    try:
        min_size_bytes = parse_size(min_size)
    except ValueError as e:
        console.print(f"[red]Invalid min-size: {e}[/red]")
        raise typer.Exit(1)

    platform_info = get_platform_info()
    console.print(f"[dim]Platform: {platform_info.name} ({platform_info.variant})[/dim]")
    console.print(f"[dim]Minimum file size: {min_size}[/dim]\n")

    # Scan for duplicates
    scanner = DuplicateScanner(console=console, min_size=min_size_bytes)
    results = scanner.scan(path)

    # Display results
    analyzer = Analyzer(console=console)
    analyzer.display_duplicate_results(results, show_all=show_all)

    if not results.groups:
        raise typer.Exit(0)

    # Interactive selection or auto-select all
    if interactive:
        selected = select_duplicate_groups(results.groups)
        if not selected:
            console.print("[yellow]No groups selected. Exiting.[/yellow]")
            raise typer.Exit(0)
    else:
        selected = results.groups

    # Show what will be deleted
    analyzer.display_duplicate_deletion_preview(selected, keep_strategy)

    if dry_run:
        console.print("\n[yellow]Dry run mode - no files were deleted.[/yellow]")
        console.print("[dim]Use --execute to actually delete files.[/dim]")
        raise typer.Exit(0)

    # Confirm before deletion
    total_to_delete = sum(g.duplicate_count for g in selected)
    if not confirm_deletion(total_to_delete):
        console.print("[yellow]Aborted.[/yellow]")
        raise typer.Exit(0)

    # Perform cleanup
    cleaner = Cleaner(console=console, use_trash=trash)
    cleaner.clean_duplicates(selected, keep_strategy)


@app.command()
def caches(
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
        help="Interactively select what to delete (default: interactive)",
    ),
    browsers: bool = typer.Option(
        True,
        "--browsers/--no-browsers",
        help="Include browser caches (Chrome, Firefox, Edge, Safari)",
    ),
    packages: bool = typer.Option(
        True,
        "--packages/--no-packages",
        help="Include package manager caches (npm, pip, cargo, etc.)",
    ),
    apps: bool = typer.Option(
        True,
        "--apps/--no-apps",
        help="Include application caches (VS Code, Slack, Discord, etc.)",
    ),
    wsl_windows: bool = typer.Option(
        True,
        "--wsl-windows/--wsl-linux-only",
        help="When in WSL, also scan Windows cache directories",
    ),
    show_all: bool = typer.Option(
        False,
        "--all",
        "-a",
        help="Show all findings, not just top offenders",
    ),
) -> None:
    """Scan and clean system cache directories (browsers, package managers, apps)."""
    print_banner(console)

    platform_info = get_platform_info()
    console.print(f"[dim]Platform: {platform_info.name} ({platform_info.variant})[/dim]")

    if platform_info.is_wsl:
        wsl_status = "Included" if wsl_windows else "Excluded"
        console.print(f"[dim]WSL Windows caches: {wsl_status}[/dim]")

    console.print()

    # Import here to avoid circular imports
    from bloat_hunter.core.cache_scanner import CacheScanner
    from bloat_hunter.core.scanner import ScanResult

    scanner = CacheScanner(
        console=console,
        include_browsers=browsers,
        include_package_managers=packages,
        include_apps=apps,
    )

    results = scanner.scan(wsl_include_windows=wsl_windows)

    # Convert to standard ScanResult for display compatibility
    display_result = ScanResult(
        root_path=platform_info.home_dir,
        targets=results.targets,
        total_size=results.total_size,
        scan_errors=results.scan_errors,
    )

    analyzer = Analyzer(console=console)
    analyzer.display_results(display_result, show_all=show_all)

    # Show category breakdown
    if results.categories_scanned:
        console.print("\n[bold]Categories scanned:[/bold]")
        for cat, count in results.categories_scanned.items():
            cat_label = cat.replace("_", " ").title()
            console.print(f"  - {cat_label}: {count} locations")

    if not results.targets:
        console.print("[green]No cache bloat found![/green]")
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
