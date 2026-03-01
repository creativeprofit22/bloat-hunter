import { create } from 'zustand';
import type { ScannerType } from '../../main/scanners/types';

export type ActiveView = 'dashboard' | 'settings' | ScannerType;

interface UIStore {
  /** Currently active view in the main content area */
  activeView: ActiveView;

  /** Whether the sidebar is collapsed to icons only */
  sidebarCollapsed: boolean;

  /** Whether the preview panel is visible */
  previewVisible: boolean;

  /** Set of selected result item IDs */
  selectedIds: Set<string>;

  /** Set active view */
  setActiveView: (view: ActiveView) => void;

  /** Toggle sidebar collapsed state */
  toggleSidebar: () => void;

  /** Toggle preview panel visibility */
  togglePreview: () => void;

  /** Select a result item */
  selectItem: (id: string) => void;

  /** Deselect a result item */
  deselectItem: (id: string) => void;

  /** Toggle selection of a result item */
  toggleItem: (id: string) => void;

  /** Select multiple items */
  selectItems: (ids: string[]) => void;

  /** Clear all selections */
  clearSelection: () => void;

  /** Select all provided IDs (replace current selection) */
  selectAll: (ids: string[]) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  activeView: 'dashboard',
  sidebarCollapsed: false,
  previewVisible: false,
  selectedIds: new Set(),

  setActiveView: (view) => set({ activeView: view }),

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  togglePreview: () => set((state) => ({ previewVisible: !state.previewVisible })),

  selectItem: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      next.add(id);
      return { selectedIds: next };
    }),

  deselectItem: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      next.delete(id);
      return { selectedIds: next };
    }),

  toggleItem: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { selectedIds: next };
    }),

  selectItems: (ids) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      for (const id of ids) next.add(id);
      return { selectedIds: next };
    }),

  clearSelection: () => set({ selectedIds: new Set() }),

  selectAll: (ids) => set({ selectedIds: new Set(ids) }),
}));
