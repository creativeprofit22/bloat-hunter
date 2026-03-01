import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '../../../src/renderer/store/ui-store';

describe('UIStore', () => {
  beforeEach(() => {
    useUIStore.setState({
      activeView: 'dashboard',
      sidebarCollapsed: false,
      previewVisible: false,
      selectedIds: new Set(),
    });
  });

  it('initializes with dashboard view', () => {
    expect(useUIStore.getState().activeView).toBe('dashboard');
  });

  it('setActiveView changes the active view', () => {
    useUIStore.getState().setActiveView('system-junk');
    expect(useUIStore.getState().activeView).toBe('system-junk');
  });

  it('toggleSidebar toggles collapsed state', () => {
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
  });

  it('togglePreview toggles preview visibility', () => {
    expect(useUIStore.getState().previewVisible).toBe(false);
    useUIStore.getState().togglePreview();
    expect(useUIStore.getState().previewVisible).toBe(true);
  });

  it('selectItem adds item to selection', () => {
    useUIStore.getState().selectItem('item-1');
    expect(useUIStore.getState().selectedIds.has('item-1')).toBe(true);
  });

  it('deselectItem removes item from selection', () => {
    useUIStore.getState().selectItem('item-1');
    useUIStore.getState().deselectItem('item-1');
    expect(useUIStore.getState().selectedIds.has('item-1')).toBe(false);
  });

  it('toggleItem toggles selection state', () => {
    useUIStore.getState().toggleItem('item-1');
    expect(useUIStore.getState().selectedIds.has('item-1')).toBe(true);
    useUIStore.getState().toggleItem('item-1');
    expect(useUIStore.getState().selectedIds.has('item-1')).toBe(false);
  });

  it('selectItems adds multiple items', () => {
    useUIStore.getState().selectItems(['a', 'b', 'c']);
    const ids = useUIStore.getState().selectedIds;
    expect(ids.size).toBe(3);
    expect(ids.has('a')).toBe(true);
    expect(ids.has('b')).toBe(true);
    expect(ids.has('c')).toBe(true);
  });

  it('selectItems preserves existing selections', () => {
    useUIStore.getState().selectItem('existing');
    useUIStore.getState().selectItems(['new']);
    const ids = useUIStore.getState().selectedIds;
    expect(ids.has('existing')).toBe(true);
    expect(ids.has('new')).toBe(true);
  });

  it('clearSelection removes all selections', () => {
    useUIStore.getState().selectItems(['a', 'b', 'c']);
    useUIStore.getState().clearSelection();
    expect(useUIStore.getState().selectedIds.size).toBe(0);
  });

  it('selectAll replaces current selection', () => {
    useUIStore.getState().selectItem('old');
    useUIStore.getState().selectAll(['new-1', 'new-2']);
    const ids = useUIStore.getState().selectedIds;
    expect(ids.size).toBe(2);
    expect(ids.has('old')).toBe(false);
    expect(ids.has('new-1')).toBe(true);
    expect(ids.has('new-2')).toBe(true);
  });
});
