"""Parallel execution utilities for scanning operations."""

from __future__ import annotations

import os
from collections.abc import Callable, Iterator
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import TypeVar

T = TypeVar("T")
R = TypeVar("R")

# Default number of workers (use CPU count or fallback to 4)
DEFAULT_WORKERS = min(os.cpu_count() or 4, 8)

# Minimum items needed to benefit from parallel execution
MIN_PARALLEL_ITEMS = 2


@dataclass
class ParallelConfig:
    """Configuration for parallel execution."""

    enabled: bool = True
    max_workers: int = DEFAULT_WORKERS

    def __post_init__(self) -> None:
        if self.max_workers < 1:
            self.max_workers = 1
        elif self.max_workers > 32:
            self.max_workers = 32


def parallel_map(
    func: Callable[[T], R],
    items: list[T],
    config: ParallelConfig | None = None,
) -> Iterator[tuple[T, R | None, Exception | None]]:
    """
    Apply a function to items in parallel.

    Yields results as they complete, with error handling per item.

    Args:
        func: Function to apply to each item
        items: List of items to process
        config: Parallel execution configuration

    Yields:
        Tuple of (item, result, error) for each item.
        If successful, error is None. If failed, result is None.
    """
    if config is None:
        config = ParallelConfig()

    if not config.enabled or len(items) < MIN_PARALLEL_ITEMS:
        # Sequential fallback
        for item in items:
            try:
                result = func(item)
                yield (item, result, None)
            except Exception as e:
                yield (item, None, e)
        return

    with ThreadPoolExecutor(max_workers=config.max_workers) as executor:
        future_to_item = {executor.submit(func, item): item for item in items}

        for future in as_completed(future_to_item):
            item = future_to_item[future]
            try:
                result = future.result()
                yield (item, result, None)
            except Exception as e:
                yield (item, None, e)


def parallel_map_ordered(
    func: Callable[[T], R],
    items: list[T],
    config: ParallelConfig | None = None,
) -> list[tuple[T, R | None, Exception | None]]:
    """
    Apply a function to items in parallel, returning results in original order.

    Args:
        func: Function to apply to each item
        items: List of items to process
        config: Parallel execution configuration

    Returns:
        List of (item, result, error) tuples in the same order as input items.
    """
    if config is None:
        config = ParallelConfig()

    n = len(items)
    results: list[tuple[T, R | None, Exception | None] | None] = [None] * n

    if not config.enabled or n < MIN_PARALLEL_ITEMS:
        # Sequential fallback
        for i, item in enumerate(items):
            try:
                result = func(item)
                results[i] = (item, result, None)
            except Exception as e:
                results[i] = (item, None, e)
    else:
        with ThreadPoolExecutor(max_workers=config.max_workers) as executor:
            future_to_idx = {
                executor.submit(func, item): (i, item) for i, item in enumerate(items)
            }

            for future in as_completed(future_to_idx):
                idx, item = future_to_idx[future]
                try:
                    result = future.result()
                    results[idx] = (item, result, None)
                except Exception as e:
                    results[idx] = (item, None, e)

    return results  # type: ignore[return-value]
