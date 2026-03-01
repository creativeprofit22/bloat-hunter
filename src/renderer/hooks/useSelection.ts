import { useCallback, useMemo } from 'react';
import { useUIStore } from '../store/ui-store';
import type { ScanResult } from '../../main/scanners/types';

export type SmartSelectMode =
  | 'all'
  | 'none'
  | 'all-except-newest'
  | 'all-except-oldest'
  | 'all-except-biggest'
  | 'all-except-smallest';

interface DuplicateGroup {
  groupId: string;
  items: ScanResult[];
}

/**
 * Hook providing smart selection algorithms for scan results.
 * Handles individual toggle, group toggle, select all/none,
 * and duplicate-aware selections (e.g. "all except newest in each group").
 */
export function useSelection(results: ScanResult[]) {
  const selectedIds = useUIStore((s) => s.selectedIds);
  const toggleItem = useUIStore((s) => s.toggleItem);
  const selectAll = useUIStore((s) => s.selectAll);
  const clearSelection = useUIStore((s) => s.clearSelection);
  const selectItems = useUIStore((s) => s.selectItems);
  const deselectItem = useUIStore((s) => s.deselectItem);

  /** All result IDs */
  const allIds = useMemo(() => results.map((r) => r.id), [results]);

  /** Group duplicates by groupId */
  const duplicateGroups = useMemo(() => {
    const groups = new Map<string, ScanResult[]>();
    for (const r of results) {
      if (r.groupId) {
        const group = groups.get(r.groupId) ?? [];
        group.push(r);
        groups.set(r.groupId, group);
      }
    }
    const result: DuplicateGroup[] = [];
    for (const [groupId, items] of groups) {
      if (items.length > 1) {
        result.push({ groupId, items });
      }
    }
    return result;
  }, [results]);

  /** Toggle all items in a group */
  const toggleGroup = useCallback(
    (groupId: string) => {
      const groupItems = results.filter((r) => r.groupId === groupId);
      const groupIds = groupItems.map((r) => r.id);
      const allSelected = groupIds.every((id) => selectedIds.has(id));
      if (allSelected) {
        for (const id of groupIds) {
          deselectItem(id);
        }
      } else {
        selectItems(groupIds);
      }
    },
    [results, selectedIds, selectItems, deselectItem],
  );

  /** Check if all items in a group are selected */
  const isGroupSelected = useCallback(
    (groupId: string) => {
      const groupItems = results.filter((r) => r.groupId === groupId);
      return groupItems.length > 0 && groupItems.every((r) => selectedIds.has(r.id));
    },
    [results, selectedIds],
  );

  /** Check if some (but not all) items in a group are selected */
  const isGroupIndeterminate = useCallback(
    (groupId: string) => {
      const groupItems = results.filter((r) => r.groupId === groupId);
      const someSelected = groupItems.some((r) => selectedIds.has(r.id));
      const allSelected = groupItems.every((r) => selectedIds.has(r.id));
      return someSelected && !allSelected;
    },
    [results, selectedIds],
  );

  /** Apply a smart selection strategy */
  const smartSelect = useCallback(
    (mode: SmartSelectMode) => {
      switch (mode) {
        case 'all':
          selectAll(allIds);
          break;
        case 'none':
          clearSelection();
          break;
        case 'all-except-newest': {
          const idsToSelect: string[] = [];
          // For grouped duplicates: select all except the newest in each group
          const handledIds = new Set<string>();
          for (const group of duplicateGroups) {
            const sorted = [...group.items].sort((a, b) => b.modified - a.modified);
            // Keep the newest (sorted[0]), select the rest
            for (let i = 1; i < sorted.length; i++) {
              idsToSelect.push(sorted[i].id);
            }
            for (const item of group.items) {
              handledIds.add(item.id);
            }
          }
          // Non-grouped items: select all
          for (const r of results) {
            if (!handledIds.has(r.id)) {
              idsToSelect.push(r.id);
            }
          }
          selectAll(idsToSelect);
          break;
        }
        case 'all-except-oldest': {
          const idsToSelect: string[] = [];
          const handledIds = new Set<string>();
          for (const group of duplicateGroups) {
            const sorted = [...group.items].sort((a, b) => a.modified - b.modified);
            // Keep the oldest (sorted[0]), select the rest
            for (let i = 1; i < sorted.length; i++) {
              idsToSelect.push(sorted[i].id);
            }
            for (const item of group.items) {
              handledIds.add(item.id);
            }
          }
          for (const r of results) {
            if (!handledIds.has(r.id)) {
              idsToSelect.push(r.id);
            }
          }
          selectAll(idsToSelect);
          break;
        }
        case 'all-except-biggest': {
          const idsToSelect: string[] = [];
          const handledIds = new Set<string>();
          for (const group of duplicateGroups) {
            const sorted = [...group.items].sort((a, b) => b.size - a.size);
            // Keep the biggest (sorted[0]), select the rest
            for (let i = 1; i < sorted.length; i++) {
              idsToSelect.push(sorted[i].id);
            }
            for (const item of group.items) {
              handledIds.add(item.id);
            }
          }
          for (const r of results) {
            if (!handledIds.has(r.id)) {
              idsToSelect.push(r.id);
            }
          }
          selectAll(idsToSelect);
          break;
        }
        case 'all-except-smallest': {
          const idsToSelect: string[] = [];
          const handledIds = new Set<string>();
          for (const group of duplicateGroups) {
            const sorted = [...group.items].sort((a, b) => a.size - b.size);
            // Keep the smallest (sorted[0]), select the rest
            for (let i = 1; i < sorted.length; i++) {
              idsToSelect.push(sorted[i].id);
            }
            for (const item of group.items) {
              handledIds.add(item.id);
            }
          }
          for (const r of results) {
            if (!handledIds.has(r.id)) {
              idsToSelect.push(r.id);
            }
          }
          selectAll(idsToSelect);
          break;
        }
      }
    },
    [allIds, duplicateGroups, results, selectAll, clearSelection],
  );

  return {
    selectedIds,
    toggleItem,
    toggleGroup,
    isGroupSelected,
    isGroupIndeterminate,
    smartSelect,
    selectedCount: selectedIds.size,
    totalCount: results.length,
    hasDuplicateGroups: duplicateGroups.length > 0,
  };
}
