"""Interactive prompts for user input."""

from __future__ import annotations

from typing import TYPE_CHECKING

import typer

if TYPE_CHECKING:
    from bloat_hunter.core.scanner import BloatTarget
    from bloat_hunter.core.duplicates import DuplicateGroup


def confirm_deletion(count: int) -> bool:
    """
    Prompt user to confirm deletion.

    Args:
        count: Number of items to be deleted

    Returns:
        True if user confirms, False otherwise
    """
    return typer.confirm(
        f"\nAre you sure you want to delete {count} item(s)?",
        default=False,
    )


def select_targets(targets: list["BloatTarget"]) -> list["BloatTarget"]:
    """
    Let user interactively select which targets to delete.

    Args:
        targets: List of detected bloat targets

    Returns:
        List of selected targets
    """
    try:
        from InquirerPy import inquirer
        from InquirerPy.base.control import Choice

        choices = [
            Choice(
                value=target,
                name=f"{target.size_human:>10} | {target.pattern.name:<15} | {target.path}",
            )
            for target in targets
        ]

        selected = inquirer.checkbox(
            message="Select targets to delete (Space to toggle, Enter to confirm):",
            choices=choices,
            cycle=True,
        ).execute()

        return selected or []

    except ImportError:
        # Fallback to simple yes/no for each
        typer.echo("\nInquirerPy not installed. Using simple prompts.\n")
        selected = []

        for target in targets:
            if typer.confirm(
                f"Delete {target.pattern.name} at {target.path} ({target.size_human})?",
                default=False,
            ):
                selected.append(target)

        return selected


def select_scan_path() -> str:
    """Let user select or enter a path to scan."""
    try:
        from InquirerPy import inquirer

        path = inquirer.filepath(
            message="Enter path to scan:",
            default=".",
            validate=lambda x: x != "",
        ).execute()

        return path

    except ImportError:
        return typer.prompt("Enter path to scan", default=".")


def select_duplicate_groups(groups: list["DuplicateGroup"]) -> list["DuplicateGroup"]:
    """
    Let user interactively select which duplicate groups to clean.

    Args:
        groups: List of detected duplicate groups

    Returns:
        List of selected groups
    """
    try:
        from InquirerPy import inquirer
        from InquirerPy.base.control import Choice

        choices = [
            Choice(
                value=group,
                name=(
                    f"{group.size_human:>10} x {len(group.files)} copies | "
                    f"Wasted: {group.wasted_human} | "
                    f"Hash: {group.hash_value[:12]}"
                ),
            )
            for group in groups
        ]

        selected = inquirer.checkbox(
            message="Select duplicate groups to clean (Space to toggle, Enter to confirm):",
            choices=choices,
            cycle=True,
        ).execute()

        return selected or []

    except ImportError:
        # Fallback to simple yes/no for each
        typer.echo("\nInquirerPy not installed. Using simple prompts.\n")
        selected = []

        for group in groups:
            if typer.confirm(
                f"Clean {len(group.files)} copies of {group.size_human} file ({group.wasted_human} wasted)?",
                default=False,
            ):
                selected.append(group)

        return selected
