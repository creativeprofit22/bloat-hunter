"""Rich console utilities for output formatting."""

from __future__ import annotations

import platform

from rich.console import Console
from rich.panel import Panel
from rich.text import Text

from bloat_hunter import __version__


def create_console() -> Console:
    """Create a configured Rich console."""
    # Windows-specific console settings
    if platform.system() == "Windows":
        return Console(legacy_windows=True, emoji=False)
    return Console()


def print_banner(console: Console) -> None:
    """Print the Bloat Hunter banner."""
    banner_text = Text()
    banner_text.append("BLOAT ", style="bold red")
    banner_text.append("HUNTER", style="bold yellow")

    tagline = Text("Hunt down disk bloat across all platforms", style="dim italic")

    panel = Panel(
        Text.assemble(banner_text, "\n", tagline),
        border_style="blue",
        padding=(0, 2),
        subtitle=f"v{__version__}",
        subtitle_align="right",
    )

    console.print(panel)
    console.print()


def format_size(size_bytes: int) -> str:
    """Convert bytes to human-readable format."""
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} PB"


def print_success(console: Console, message: str) -> None:
    """Print a success message."""
    console.print(f"[green]{message}[/green]")


def print_warning(console: Console, message: str) -> None:
    """Print a warning message."""
    console.print(f"[yellow]{message}[/yellow]")


def print_error(console: Console, message: str) -> None:
    """Print an error message."""
    console.print(f"[red]{message}[/red]")
