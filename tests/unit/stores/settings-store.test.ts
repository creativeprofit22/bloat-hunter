import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from '../../../src/renderer/store/settings-store';

describe('SettingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      scanPaths: [],
      exclusions: [],
      maxDepth: 10,
      minSize: 0,
      staleMonths: 6,
      topN: 100,
      aiProvider: 'none',
      aiBaseUrl: '',
      aiModel: '',
      aiEnabled: false,
      defaultCleanAction: 'recycle',
      quarantinePath: '',
    });
  });

  it('initializes with sensible defaults', () => {
    const state = useSettingsStore.getState();
    expect(state.maxDepth).toBe(10);
    expect(state.staleMonths).toBe(6);
    expect(state.topN).toBe(100);
    expect(state.aiProvider).toBe('none');
    expect(state.aiEnabled).toBe(false);
    expect(state.defaultCleanAction).toBe('recycle');
  });

  it('setScanPaths updates scan paths', () => {
    useSettingsStore.getState().setScanPaths(['C:\\Users', 'D:\\Data']);
    expect(useSettingsStore.getState().scanPaths).toEqual(['C:\\Users', 'D:\\Data']);
  });

  it('setExclusions updates exclusions', () => {
    useSettingsStore.getState().setExclusions(['*.sys', 'node_modules']);
    expect(useSettingsStore.getState().exclusions).toEqual(['*.sys', 'node_modules']);
  });

  it('setMaxDepth updates max depth', () => {
    useSettingsStore.getState().setMaxDepth(5);
    expect(useSettingsStore.getState().maxDepth).toBe(5);
  });

  it('setMinSize updates min size', () => {
    useSettingsStore.getState().setMinSize(1024);
    expect(useSettingsStore.getState().minSize).toBe(1024);
  });

  it('setStaleMonths updates stale threshold', () => {
    useSettingsStore.getState().setStaleMonths(12);
    expect(useSettingsStore.getState().staleMonths).toBe(12);
  });

  it('setTopN updates top N count', () => {
    useSettingsStore.getState().setTopN(50);
    expect(useSettingsStore.getState().topN).toBe(50);
  });

  it('setAIProvider updates provider', () => {
    useSettingsStore.getState().setAIProvider('claude');
    expect(useSettingsStore.getState().aiProvider).toBe('claude');
  });

  it('setAIBaseUrl updates base URL', () => {
    useSettingsStore.getState().setAIBaseUrl('https://proxy.example.com');
    expect(useSettingsStore.getState().aiBaseUrl).toBe('https://proxy.example.com');
  });

  it('setAIModel updates model name', () => {
    useSettingsStore.getState().setAIModel('claude-haiku-4-5-20251001');
    expect(useSettingsStore.getState().aiModel).toBe('claude-haiku-4-5-20251001');
  });

  it('setAIEnabled toggles AI features', () => {
    useSettingsStore.getState().setAIEnabled(true);
    expect(useSettingsStore.getState().aiEnabled).toBe(true);
    useSettingsStore.getState().setAIEnabled(false);
    expect(useSettingsStore.getState().aiEnabled).toBe(false);
  });

  it('setDefaultCleanAction changes clean action', () => {
    useSettingsStore.getState().setDefaultCleanAction('delete');
    expect(useSettingsStore.getState().defaultCleanAction).toBe('delete');
    useSettingsStore.getState().setDefaultCleanAction('move');
    expect(useSettingsStore.getState().defaultCleanAction).toBe('move');
  });

  it('setQuarantinePath updates quarantine path', () => {
    useSettingsStore.getState().setQuarantinePath('D:\\Quarantine');
    expect(useSettingsStore.getState().quarantinePath).toBe('D:\\Quarantine');
  });
});
