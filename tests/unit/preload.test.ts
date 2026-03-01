// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
}));

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: mocks.exposeInMainWorld },
  ipcRenderer: {
    invoke: mocks.invoke,
    on: mocks.on,
    removeListener: mocks.removeListener,
  },
}));

describe('Preload Script', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  async function loadPreload() {
    await import('../../src/preload/index');
  }

  function getExposedApi() {
    return mocks.exposeInMainWorld.mock.calls[0][1] as Record<string, unknown>;
  }

  it('exposes electronAPI to the main world', async () => {
    await loadPreload();
    expect(mocks.exposeInMainWorld).toHaveBeenCalledWith('electronAPI', expect.any(Object));
  });

  it('exposes exactly one API namespace', async () => {
    await loadPreload();
    expect(mocks.exposeInMainWorld).toHaveBeenCalledTimes(1);
  });

  it('electronAPI has getAppVersion method', async () => {
    await loadPreload();
    const api = getExposedApi();
    expect(typeof api.getAppVersion).toBe('function');
  });

  it('electronAPI has getPlatform method', async () => {
    await loadPreload();
    const api = getExposedApi();
    expect(typeof api.getPlatform).toBe('function');
  });

  it('electronAPI has versions object with expected keys', async () => {
    await loadPreload();
    const api = getExposedApi();
    const versions = api.versions as Record<string, unknown>;
    expect(versions).toHaveProperty('electron');
    expect(versions).toHaveProperty('node');
    expect(versions).toHaveProperty('chrome');
  });

  it('electronAPI has scanner control methods', async () => {
    await loadPreload();
    const api = getExposedApi();
    expect(typeof api.startScan).toBe('function');
    expect(typeof api.cancelScan).toBe('function');
  });

  it('electronAPI has preview methods', async () => {
    await loadPreload();
    const api = getExposedApi();
    expect(typeof api.generateThumbnail).toBe('function');
    expect(typeof api.getFileStat).toBe('function');
  });

  it('electronAPI has cleaning methods', async () => {
    await loadPreload();
    const api = getExposedApi();
    expect(typeof api.startClean).toBe('function');
    expect(typeof api.isAdmin).toBe('function');
  });

  it('electronAPI has settings methods', async () => {
    await loadPreload();
    const api = getExposedApi();
    expect(typeof api.loadSettings).toBe('function');
    expect(typeof api.saveSettings).toBe('function');
    expect(typeof api.setApiKey).toBe('function');
    expect(typeof api.hasApiKey).toBe('function');
  });

  it('electronAPI has AI methods', async () => {
    await loadPreload();
    const api = getExposedApi();
    expect(typeof api.aiConfigure).toBe('function');
    expect(typeof api.aiAnalyze).toBe('function');
    expect(typeof api.aiExplainItem).toBe('function');
    expect(typeof api.aiTestConnection).toBe('function');
  });

  it('electronAPI has event listener methods', async () => {
    await loadPreload();
    const api = getExposedApi();
    expect(typeof api.onScanProgress).toBe('function');
    expect(typeof api.onScanResult).toBe('function');
    expect(typeof api.onScanError).toBe('function');
    expect(typeof api.onScanCancelled).toBe('function');
    expect(typeof api.onCleanProgress).toBe('function');
  });

  it('getAppVersion invokes correct IPC channel', async () => {
    await loadPreload();
    const api = getExposedApi();
    (api.getAppVersion as () => void)();
    expect(mocks.invoke).toHaveBeenCalledWith('get-app-version');
  });

  it('getPlatform invokes correct IPC channel', async () => {
    await loadPreload();
    const api = getExposedApi();
    (api.getPlatform as () => void)();
    expect(mocks.invoke).toHaveBeenCalledWith('get-platform');
  });

  it('startScan invokes correct IPC channel with args', async () => {
    await loadPreload();
    const api = getExposedApi();
    const startScan = api.startScan as (type: string, config: unknown) => void;
    startScan('system-junk', { paths: [] });
    expect(mocks.invoke).toHaveBeenCalledWith('scanner:start', 'system-junk', { paths: [] });
  });

  it('cancelScan invokes correct IPC channel', async () => {
    await loadPreload();
    const api = getExposedApi();
    (api.cancelScan as (type: string) => void)('duplicates');
    expect(mocks.invoke).toHaveBeenCalledWith('scanner:cancel', 'duplicates');
  });

  it('event listeners register and return cleanup function', async () => {
    await loadPreload();
    const api = getExposedApi();
    const callback = vi.fn();
    const cleanup = (api.onScanProgress as (cb: (data: unknown) => void) => () => void)(callback);

    expect(mocks.on).toHaveBeenCalledWith('scanner:progress', expect.any(Function));
    expect(typeof cleanup).toBe('function');

    cleanup();
    expect(mocks.removeListener).toHaveBeenCalledWith('scanner:progress', expect.any(Function));
  });

  it('versions.node matches current process', async () => {
    await loadPreload();
    const api = getExposedApi();
    const versions = api.versions as Record<string, string>;
    expect(versions.node).toBe(process.versions.node);
  });
});
