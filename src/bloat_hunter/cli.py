"""Bloat Hunter CLI - Main entry point."""

from __future__ import annotations

from pathlib import Path
from typing import cast

import typer
from rich.panel import Panel
from rich.table import Table

from bloat_hunter import __version__
from bloat_hunter.config import (
    DEFAULT_CONFIG_TEMPLATE,
    VALID_KEEP_STRATEGIES,
    Config,
    get_config_paths,
    load_config,
    load_config_from_file,
)
from bloat_hunter.core.analyzer import Analyzer
from bloat_hunter.core.cache_scanner import CacheScanner
from bloat_hunter.core.cleaner import Cleaner
from bloat_hunter.core.duplicates import DuplicateGroup, DuplicateScanner, KeepStrategy
from bloat_hunter.core.package_scanner import PackageManagerConfig, PackageScanner
from bloat_hunter.core.scanner import BloatTarget, Scanner, ScanResult, parse_size
from bloat_hunter.platform.detect import PlatformInfo, get_platform_info
from bloat_hunter.ui.console import create_console, print_banner
from bloat_hunter.ui.prompts import confirm_deletion, select_duplicate_groups, select_targets

app = typer.Typer(
    name="bloat-hunter",
    help="Hunt down bloat, caches, and space hogs on your disk.",
    no_args_is_help=True,
)
console = create_console()


class State:
    """Global state container for CLI."""

    def __init__(self) -> None:
        self.config: Config = Config()  # Default until loaded


state = State()


def _print_platform_header(wsl_windows: bool | None = None) -> PlatformInfo:
    """Print platform header and optionally WSL status. Returns platform_info for further use."""
    platform_info = get_platform_info()
    console.print(f"[dim]Platform: {platform_info.name} ({platform_info.variant})[/dim]")
    if wsl_windows is not None and platform_info.is_wsl:
        wsl_status = "Included" if wsl_windows else "Excluded"
        console.print(f"[dim]WSL Windows caches: {wsl_status}[/dim]")
    return platform_info


def _print_dry_run_notice() -> None:
    """Print dry run mode notice and instructions."""
    console.print("\n[yellow]Dry run mode - no files were deleted.[/yellow]")
    console.print("[dim]Use --execute to actually delete files.[/dim]")


def _parse_min_size(min_size: str) -> int:
    """Parse min_size string to bytes, exit with error on invalid input."""
    try:
        return parse_size(min_size)
    except ValueError as e:
        console.print(f"[red]Invalid min-size: {e}[/red]")
        raise typer.Exit(1) from e


def _print_config_locations(xdg_path: Path, cwd_path: Path, *, verbose: bool = False) -> None:
    """Print config file locations and their status.

    Args:
        xdg_path: Path to the global XDG config file.
        cwd_path: Path to the local CWD config file.
        verbose: If True, use detailed format with spacing (for config_path).
                 If False, use compact format (for config_show).
    """
    if verbose:
        console.print("[bold]Config file locations:[/bold]\n")

        # XDG location
        xdg_status = "[green]exists[/green]" if xdg_path.exists() else "[dim]not found[/dim]"
        console.print(f"  Global (XDG): {xdg_path}")
        console.print(f"                {xdg_status}\n")

        # CWD location
        cwd_status = (
            "[green]exists (overrides global)[/green]"
            if cwd_path.exists()
            else "[dim]not found[/dim]"
        )
        console.print(f"  Local (CWD):  {cwd_path}")
        console.print(f"                {cwd_status}")
    else:
        console.print("\n[bold]Config locations:[/bold]")
        xdg_status = "[green]exists[/green]" if xdg_path.exists() else "[dim]not found[/dim]"
        console.print(f"  Global: {xdg_path} ({xdg_status})")

        cwd_status = "[green]exists[/green]" if cwd_path.exists() else "[dim]not found[/dim]"
        console.print(f"  Local:  {cwd_path} ({cwd_status})")


# Shared CLI option defaults to avoid repetition (DRY principle)
DRY_RUN_OPTION = typer.Option(
    True,
    "--dry-run/--execute",
    help="Preview changes without deleting (default: dry-run)",
)

TRASH_OPTION = typer.Option(
    True,
    "--trash/--permanent",
    help="Move to trash instead of permanent deletion (default: trash)",
)

INTERACTIVE_OPTION = typer.Option(
    True,
    "--interactive/--auto",
    help="Interactively select what to delete (default: interactive)",
)


def _handle_targets_cleanup(
    targets: list[BloatTarget],
    analyzer: Analyzer,
    dry_run: bool,
    interactive: bool,
    trash: bool,
) -> None:
    """Handle cleanup flow for regular scan targets (clean, caches, packages).

    Args:
        targets: List of scan targets to clean.
        analyzer: Analyzer instance for displaying previews.
        dry_run: If True, only preview without deleting.
        interactive: If True, allow user to select items.
        trash: If True, move to trash instead of permanent deletion.

    Raises:
        typer.Exit: On completion, abortion, or when no items selected.
    """
    # Interactive selection or auto-select all
    if interactive:
        selected_targets = select_targets(targets)
        if not selected_targets:
            console.print("[yellow]No targets selected. Exiting.[/yellow]")
            raise typer.Exit(0)
    else:
        selected_targets = targets

    # Show what will be deleted
    analyzer.display_deletion_preview(selected_targets)

    if dry_run:
        _print_dry_run_notice()
        raise typer.Exit(0)

    # Confirm before deletion
    if not confirm_deletion(len(selected_targets)):
        console.print("[yellow]Aborted.[/yellow]")
        raise typer.Exit(0)

    # Perform cleanup
    cleaner = Cleaner(console=console, use_trash=trash)
    cleaner.clean(selected_targets)


def _handle_duplicates_cleanup(
    groups: list[DuplicateGroup],
    analyzer: Analyzer,
    dry_run: bool,
    interactive: bool,
    trash: bool,
    keep_strategy: KeepStrategy,
) -> None:
    """Handle cleanup flow for duplicate file groups.

    Args:
        groups: List of duplicate groups to clean.
        analyzer: Analyzer instance for displaying previews.
        dry_run: If True, only preview without deleting.
        interactive: If True, allow user to select items.
        trash: If True, move to trash instead of permanent deletion.
        keep_strategy: Strategy for keeping files in duplicate groups.

    Raises:
        typer.Exit: On completion, abortion, or when no items selected.
    """
    # Interactive selection or auto-select all
    if interactive:
        selected_groups = select_duplicate_groups(groups)
        if not selected_groups:
            console.print("[yellow]No groups selected. Exiting.[/yellow]")
            raise typer.Exit(0)
    else:
        selected_groups = groups

    # Show what will be deleted
    analyzer.display_duplicate_deletion_preview(selected_groups, keep_strategy)

    if dry_run:
        _print_dry_run_notice()
        raise typer.Exit(0)

    # Confirm before deletion
    total_to_delete = sum(g.duplicate_count for g in selected_groups)
    if not confirm_deletion(total_to_delete):
        console.print("[yellow]Aborted.[/yellow]")
        raise typer.Exit(0)

    # Perform cleanup
    cleaner = Cleaner(console=console, use_trash=trash)
    cleaner.clean_duplicates(selected_groups, keep_strategy)


def _handle_cleanup_flow(
    targets: list[BloatTarget] | None = None,
    groups: list[DuplicateGroup] | None = None,
    *,
    analyzer: Analyzer,
    dry_run: bool,
    interactive: bool,
    trash: bool,
    keep_strategy: KeepStrategy | None = None,
) -> None:
    """Dispatcher for cleanup flows - routes to targets or duplicates handler.

    Args:
        targets: List of scan targets for regular cleanup (clean, caches, packages).
        groups: List of duplicate groups for duplicate cleanup.
        analyzer: Analyzer instance for displaying previews.
        dry_run: If True, only preview without deleting.
        interactive: If True, allow user to select items.
        trash: If True, move to trash instead of permanent deletion.
        keep_strategy: Strategy for keeping files in duplicate groups (required for groups).

    Raises:
        typer.Exit: On completion, abortion, or when no items selected.
    """
    if groups is not None:
        assert keep_strategy is not None  # Required for duplicates
        _handle_duplicates_cleanup(groups, analyzer, dry_run, interactive, trash, keep_strategy)
    else:
        assert targets is not None  # Must have either targets or groups
        _handle_targets_cleanup(targets, analyzer, dry_run, interactive, trash)


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
    min_size: str = typer.Option(
        "0B",
        "--min-size",
        "-s",
        help="Minimum size to report (e.g., 1MB, 10MB, 100MB)",
    ),
) -> None:
    """Scan a directory for bloat and caches."""
    print_banner(console)

    min_size_bytes = _parse_min_size(min_size)

    _print_platform_header()
    if min_size_bytes > 0:
        console.print(f"[dim]Minimum size: {min_size}[/dim]")
    console.print()

    scanner = Scanner(console=console, min_size=min_size_bytes)
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
    dry_run: bool = DRY_RUN_OPTION,
    trash: bool = TRASH_OPTION,
    interactive: bool = INTERACTIVE_OPTION,
    min_size: str = typer.Option(
        "0B",
        "--min-size",
        "-s",
        help="Minimum size to report (e.g., 1MB, 10MB, 100MB)",
    ),
) -> None:
    """Clean up bloat and caches from a directory."""
    print_banner(console)

    min_size_bytes = _parse_min_size(min_size)

    if min_size_bytes > 0:
        console.print(f"[dim]Minimum size: {min_size}[/dim]")

    scanner = Scanner(console=console, min_size=min_size_bytes)
    results = scanner.scan(path, deep=True)

    if not results.targets:
        console.print("[green]No bloat found! Your disk is clean.[/green]")
        raise typer.Exit(0)

    analyzer = Analyzer(console=console)
    _handle_cleanup_flow(
        targets=results.targets,
        analyzer=analyzer,
        dry_run=dry_run,
        interactive=interactive,
        trash=trash,
    )


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
    dry_run: bool = DRY_RUN_OPTION,
    trash: bool = TRASH_OPTION,
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
    interactive: bool = INTERACTIVE_OPTION,
) -> None:
    """Find and optionally remove duplicate files."""
    print_banner(console)

    # Validate keep strategy
    if keep not in VALID_KEEP_STRATEGIES:
        console.print(f"[red]Invalid keep strategy: {keep}[/red]")
        console.print(f"[dim]Valid options: {', '.join(VALID_KEEP_STRATEGIES)}[/dim]")
        raise typer.Exit(1)

    keep_strategy = cast(KeepStrategy, keep)

    min_size_bytes = _parse_min_size(min_size)

    _print_platform_header()
    console.print(f"[dim]Minimum file size: {min_size}[/dim]")
    console.print()

    # Scan for duplicates
    scanner = DuplicateScanner(console=console, min_size=min_size_bytes)
    results = scanner.scan(path)

    # Display results
    analyzer = Analyzer(console=console)
    analyzer.display_duplicate_results(results, show_all=show_all)

    if not results.groups:
        raise typer.Exit(0)

    _handle_cleanup_flow(
        groups=results.groups,
        analyzer=analyzer,
        dry_run=dry_run,
        interactive=interactive,
        trash=trash,
        keep_strategy=keep_strategy,
    )


@app.command()
def caches(
    dry_run: bool = DRY_RUN_OPTION,
    trash: bool = TRASH_OPTION,
    interactive: bool = INTERACTIVE_OPTION,
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
    platform_info = _print_platform_header(wsl_windows=wsl_windows)
    console.print()

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

    _handle_cleanup_flow(
        targets=results.targets,
        analyzer=analyzer,
        dry_run=dry_run,
        interactive=interactive,
        trash=trash,
    )


@app.command()
def packages(
    dry_run: bool = DRY_RUN_OPTION,
    trash: bool = TRASH_OPTION,
    interactive: bool = INTERACTIVE_OPTION,
    npm: bool = typer.Option(True, "--npm/--no-npm", help="Include npm cache"),
    yarn: bool = typer.Option(True, "--yarn/--no-yarn", help="Include yarn cache"),
    pnpm: bool = typer.Option(True, "--pnpm/--no-pnpm", help="Include pnpm cache"),
    pip: bool = typer.Option(True, "--pip/--no-pip", help="Include pip/pipx cache"),
    cargo: bool = typer.Option(True, "--cargo/--no-cargo", help="Include Cargo cache"),
    go: bool = typer.Option(True, "--go/--no-go", help="Include Go cache"),
    gradle: bool = typer.Option(True, "--gradle/--no-gradle", help="Include Gradle cache"),
    maven: bool = typer.Option(True, "--maven/--no-maven", help="Include Maven cache"),
    composer: bool = typer.Option(True, "--composer/--no-composer", help="Include Composer cache"),
    nuget: bool = typer.Option(True, "--nuget/--no-nuget", help="Include NuGet cache"),
    bundler: bool = typer.Option(True, "--bundler/--no-bundler", help="Include Bundler cache"),
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
    """Scan and clean package manager caches (npm, pip, cargo, etc.)."""
    print_banner(console)
    _print_platform_header(wsl_windows=wsl_windows)
    console.print()

    config = PackageManagerConfig(
        npm=npm,
        yarn=yarn,
        pnpm=pnpm,
        pip=pip,
        cargo=cargo,
        go=go,
        gradle=gradle,
        maven=maven,
        composer=composer,
        nuget=nuget,
        bundler=bundler,
    )
    scanner = PackageScanner(console=console, config=config)

    results = scanner.scan(wsl_include_windows=wsl_windows)

    analyzer = Analyzer(console=console)
    analyzer.display_package_results(results, show_all=show_all)

    if not results.targets:
        # Note: display_package_results already printed feedback message
        raise typer.Exit(0)

    _handle_cleanup_flow(
        targets=results.targets,
        analyzer=analyzer,
        dry_run=dry_run,
        interactive=interactive,
        trash=trash,
    )


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


# Config subcommand group
config_app = typer.Typer(
    name="config",
    help="Manage Bloat Hunter configuration.",
    no_args_is_help=True,
)
app.add_typer(config_app)


@config_app.command("init")
def config_init(
    global_config: bool = typer.Option(
        True,
        "--global/--local",
        help="Create in XDG config (--global) or current directory (--local)",
    ),
    force: bool = typer.Option(
        False,
        "--force",
        "-f",
        help="Overwrite existing config file",
    ),
) -> None:
    """Generate a default configuration file with comments."""
    xdg_path, cwd_path = get_config_paths()
    target = xdg_path if global_config else cwd_path

    if target.exists() and not force:
        console.print(f"[yellow]Config already exists: {target}[/yellow]")
        console.print("[dim]Use --force to overwrite[/dim]")
        raise typer.Exit(1)

    # Ensure parent directory exists
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(DEFAULT_CONFIG_TEMPLATE)
    except OSError as e:
        console.print(f"[red]Permission denied: {target}[/red]")
        console.print(f"[dim]Check write permissions for {target.parent}[/dim]")
        raise typer.Exit(1) from e

    location = "global" if global_config else "local"
    console.print(f"[green]Created {location} config:[/green] {target}")


@config_app.command("show")
def config_show(
    resolved: bool = typer.Option(
        True,
        "--resolved/--raw",
        help="Show merged config (--resolved) or raw file (--raw)",
    ),
) -> None:
    """Display the active configuration and its source."""
    config = state.config
    xdg_path, cwd_path = get_config_paths()

    # Show source info
    source_text = str(config._source) if config._source else "[dim]defaults only[/dim]"
    console.print(
        Panel.fit(
            f"[bold]Active config:[/bold] {source_text}",
            title="Configuration Source",
        )
    )

    if resolved:
        # Show resolved values as table
        table = Table(title="Resolved Configuration", show_header=True)
        table.add_column("Section", style="cyan")
        table.add_column("Key", style="green")
        table.add_column("Value")

        for section_name in ["defaults", "packages", "caches", "duplicates", "scan"]:
            section = getattr(config, section_name)
            for key, value in vars(section).items():
                if not key.startswith("_"):
                    table.add_row(section_name, key, str(value))

        console.print(table)
    else:
        # Show raw file content
        if config._source and config._source.exists():
            console.print(config._source.read_text())
        else:
            console.print("[dim]No config file found[/dim]")

    # Show search locations
    _print_config_locations(xdg_path, cwd_path, verbose=False)


@config_app.command("path")
def config_path() -> None:
    """Show configuration file locations and status."""
    xdg_path, cwd_path = get_config_paths()
    _print_config_locations(xdg_path, cwd_path, verbose=True)


@app.callback()
def main(
    version: bool = typer.Option(
        False,
        "--version",
        "-v",
        help="Show version and exit",
        is_eager=True,
    ),
    config_file: Path | None = typer.Option(
        None,
        "--config",
        "-c",
        help="Path to config file (overrides default locations)",
        exists=True,
        readable=True,
    ),
) -> None:
    """Bloat Hunter - Hunt down disk bloat across all platforms."""
    if version:
        console.print(f"Bloat Hunter v{__version__}")
        raise typer.Exit(0)

    # Load config (custom file or default locations)
    if config_file:
        try:
            state.config = load_config_from_file(config_file)
        except ValueError as e:
            console.print(f"[red]Config error: {e}[/red]")
            raise typer.Exit(1) from e
    else:
        state.config = load_config()


if __name__ == "__main__":
    app()
