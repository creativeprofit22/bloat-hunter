import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { ScanResult } from '../../../main/scanners/types';
import { useSelection } from '../../hooks/useSelection';
import { ColumnHeader, type SortField, type SortDirection } from './ColumnHeader';
import { SelectionMenu } from './SelectionMenu';
import { ResultGroup } from './ResultGroup';
import { FileRow } from './FileRow';

/** Height of each row in pixels (for virtual scrolling) */
const ROW_HEIGHT = 40;
/** Extra rows to render above/below the visible window */
const OVERSCAN = 10;

function getFileName(filePath: string): string {
  const sep = filePath.includes('/') ? '/' : '\\';
  const parts = filePath.split(sep);
  return parts[parts.length - 1] || filePath;
}

const RISK_ORDER = { green: 0, yellow: 1, red: 2 } as const;

function sortResults(
  results: ScanResult[],
  field: SortField,
  direction: SortDirection,
): ScanResult[] {
  const sorted = [...results];
  const dir = direction === 'asc' ? 1 : -1;
  sorted.sort((a, b) => {
    switch (field) {
      case 'name':
        return dir * getFileName(a.path).localeCompare(getFileName(b.path));
      case 'size':
        return dir * (a.size - b.size);
      case 'modified':
        return dir * (a.modified - b.modified);
      case 'risk':
        return dir * (RISK_ORDER[a.risk] - RISK_ORDER[b.risk]);
      default:
        return 0;
    }
  });
  return sorted;
}

interface ContextMenuState {
  x: number;
  y: number;
  result: ScanResult;
}

interface ResultsTableProps {
  results: ScanResult[];
}

export function ResultsTable({ results }: ResultsTableProps) {
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    selectedIds,
    toggleItem,
    toggleGroup,
    isGroupSelected,
    isGroupIndeterminate,
    smartSelect,
    selectedCount,
    totalCount,
    hasDuplicateGroups,
  } = useSelection(results);

  // Track container height for virtual scrolling
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [contextMenu]);

  const handleSort = useCallback(
    (field: SortField) => {
      if (field === sortField) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDirection('asc');
      }
    },
    [sortField],
  );

  const handleContextMenu = useCallback((e: React.MouseEvent, result: ScanResult) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, result });
  }, []);

  const handleCopyPath = useCallback(() => {
    if (contextMenu) {
      navigator.clipboard.writeText(contextMenu.result.path);
      setContextMenu(null);
    }
  }, [contextMenu]);

  // Build grouped + sorted view
  const { groups, ungrouped } = useMemo(() => {
    const groupMap = new Map<string, ScanResult[]>();
    const ungroupedItems: ScanResult[] = [];
    for (const r of results) {
      if (r.groupId) {
        const group = groupMap.get(r.groupId) ?? [];
        group.push(r);
        groupMap.set(r.groupId, group);
      } else {
        ungroupedItems.push(r);
      }
    }
    // Split: groups with 2+ items remain grouped, singles go to ungrouped
    const realGroups: { groupId: string; items: ScanResult[] }[] = [];
    for (const [groupId, items] of groupMap) {
      if (items.length > 1) {
        realGroups.push({ groupId, items: sortResults(items, sortField, sortDirection) });
      } else {
        ungroupedItems.push(...items);
      }
    }
    return {
      groups: realGroups,
      ungrouped: sortResults(ungroupedItems, sortField, sortDirection),
    };
  }, [results, sortField, sortDirection]);

  // Virtual scrolling for ungrouped items
  const visibleStart = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const visibleEnd = Math.min(
    ungrouped.length,
    Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN,
  );
  const visibleUngrouped = ungrouped.slice(visibleStart, visibleEnd);
  // Approximate total height for the ungrouped section
  const ungroupedTotalHeight = ungrouped.length * ROW_HEIGHT;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return (
    <div className="results-table">
      {/* Toolbar */}
      <div className="results-table-toolbar">
        <SelectionMenu
          onSelect={smartSelect}
          hasDuplicateGroups={hasDuplicateGroups}
          selectedCount={selectedCount}
          totalCount={totalCount}
        />
      </div>

      {/* Column headers */}
      <div className="results-table-header">
        <div className="results-table-header-checkbox" />
        <div className="results-table-header-icon" />
        <ColumnHeader
          label="Name"
          field="name"
          currentSort={sortField}
          currentDirection={sortDirection}
          onSort={handleSort}
          className="results-table-col--name"
        />
        <ColumnHeader
          label="Size"
          field="size"
          currentSort={sortField}
          currentDirection={sortDirection}
          onSort={handleSort}
          className="results-table-col--size"
        />
        <ColumnHeader
          label="Modified"
          field="modified"
          currentSort={sortField}
          currentDirection={sortDirection}
          onSort={handleSort}
          className="results-table-col--date"
        />
        <ColumnHeader
          label="Risk"
          field="risk"
          currentSort={sortField}
          currentDirection={sortDirection}
          onSort={handleSort}
          className="results-table-col--risk"
        />
      </div>

      {/* Scrollable results area */}
      <div className="results-table-body" ref={containerRef} onScroll={handleScroll}>
        {/* Grouped results (duplicates) */}
        {groups.map((group) => (
          <ResultGroup
            key={group.groupId}
            groupId={group.groupId}
            items={group.items}
            selectedIds={selectedIds}
            isGroupSelected={isGroupSelected(group.groupId)}
            isGroupIndeterminate={isGroupIndeterminate(group.groupId)}
            onToggleItem={toggleItem}
            onToggleGroup={toggleGroup}
            onContextMenu={handleContextMenu}
          />
        ))}

        {/* Ungrouped results with virtual scrolling */}
        {ungrouped.length > 0 && (
          <div
            className="results-table-virtual"
            style={{ height: ungroupedTotalHeight, position: 'relative' }}
          >
            {visibleUngrouped.map((result, i) => (
              <div
                key={result.id}
                style={{
                  position: 'absolute',
                  top: (visibleStart + i) * ROW_HEIGHT,
                  left: 0,
                  right: 0,
                  height: ROW_HEIGHT,
                }}
              >
                <FileRow
                  result={result}
                  selected={selectedIds.has(result.id)}
                  onToggle={toggleItem}
                  onContextMenu={handleContextMenu}
                />
              </div>
            ))}
          </div>
        )}

        {results.length === 0 && (
          <div className="results-table-empty">
            <p>No results to display. Run a scan to find items.</p>
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="results-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button className="results-context-menu-item" onClick={handleCopyPath}>
            Copy Path
          </button>
          <button className="results-context-menu-item" onClick={() => setContextMenu(null)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}
