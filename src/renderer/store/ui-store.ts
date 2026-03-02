import { create } from 'zustand';
import type { ScannerType } from '../../main/scanners/types';

export type ActiveView = 'dashboard' | 'settings' | ScannerType;

/** Plain object map — serializable and shallow-equal safe for Zustand v5 */
export type SelectionMap = Record<string, true>;

interface UIStore {
  /** Currently active view in the main content area */
  activeView: ActiveView;

  /** Whether the sidebar is collapsed to icons only */
  sidebarCollapsed: boolean;

  /** Whether the preview panel is visible */
  previewVisible: boolean;

  /** Selected result item IDs */
  selectedIds: SelectionMap;

  /** Set active view */
  setActiveView: (view: ActiveView) => void;

  /** Toggle sidebar collapsed state */
  toggleSidebar: () => void;

  /** Toggle preview panel visibility */
  togglePreview: () => void;

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
  selectedIds: {},

  setActiveView: (view) => set({ activeView: view }),

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  togglePreview: () => set((state) => ({ previewVisible: !state.previewVisible })),

  deselectItem: (id) =>
    set((state) => {
      const { [id]: _, ...rest } = state.selectedIds;
      return { selectedIds: rest };
    }),

  toggleItem: (id) =>
    set((state) => {
      if (id in state.selectedIds) {
        const { [id]: _, ...rest } = state.selectedIds;
        return { selectedIds: rest };
      }
      return { selectedIds: { ...state.selectedIds, [id]: true } };
    }),

  selectItems: (ids) =>
    set((state) => {
      const next = { ...state.selectedIds };
      for (const id of ids) next[id] = true;
      return { selectedIds: next };
    }),

  clearSelection: () => set({ selectedIds: {} }),

  selectAll: (ids) =>
    set({
      selectedIds: Object.fromEntries(ids.map((id) => [id, true as const])),
    }),
}));
