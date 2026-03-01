// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const loadURL = vi.fn();
  const loadFile = vi.fn();
  const openDevTools = vi.fn();
  const onHeadersReceived = vi.fn();
  const setWindowOpenHandler = vi.fn();
  const onWillNavigate = vi.fn();
  const once = vi.fn();

  const BrowserWindowInstance = {
    loadURL,
    loadFile,
    once,
    webContents: {
      openDevTools,
      setWindowOpenHandler,
      on: onWillNavigate,
      session: {
        webRequest: { onHeadersReceived },
      },
    },
  };

  // Must use regular function (not arrow) so it's constructable with `new`
  const BrowserWindowMock = vi.fn(function () {
    return BrowserWindowInstance;
  });
  (BrowserWindowMock as unknown as Record<string, unknown>).getAllWindows = vi.fn(() => []);

  const readyCallbacks: Array<() => void> = [];
  const whenReady = vi.fn(() => ({
    then: (cb: () => void) => {
      readyCallbacks.push(cb);
      return { catch: vi.fn() };
    },
  }));

  const appOn = vi.fn();

  return {
    loadURL,
    loadFile,
    openDevTools,
    onHeadersReceived,
    setWindowOpenHandler,
    onWillNavigate,
    once,
    BrowserWindowMock,
    BrowserWindowInstance,
    whenReady,
    appOn,
    readyCallbacks,
  };
});

vi.mock('electron', () => ({
  app: {
    whenReady: mocks.whenReady,
    on: mocks.appOn,
    quit: vi.fn(),
  },
  BrowserWindow: mocks.BrowserWindowMock,
  ipcMain: { handle: vi.fn() },
}));

vi.mock('../../src/main/ipc', () => ({
  registerIpcHandlers: vi.fn(),
}));

describe('Main Process', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readyCallbacks.length = 0;
    delete process.env.VITE_DEV_SERVER_URL;
    vi.resetModules();
  });

  async function loadMain(devUrl?: string) {
    if (devUrl) process.env.VITE_DEV_SERVER_URL = devUrl;
    await import('../../src/main/index');
  }

  it('calls app.whenReady on startup', async () => {
    await loadMain();
    expect(mocks.whenReady).toHaveBeenCalled();
  });

  it('registers window-all-closed handler', async () => {
    await loadMain();
    expect(mocks.appOn).toHaveBeenCalledWith('window-all-closed', expect.any(Function));
  });

  it('creates BrowserWindow on ready', async () => {
    await loadMain();
    mocks.readyCallbacks.forEach((cb) => cb());
    expect(mocks.BrowserWindowMock).toHaveBeenCalled();
  });

  it('configures BrowserWindow with correct dimensions', async () => {
    await loadMain();
    mocks.readyCallbacks.forEach((cb) => cb());
    expect(mocks.BrowserWindowMock).toHaveBeenCalledWith(
      expect.objectContaining({ width: 1200, height: 800 }),
    );
  });

  it('creates window with show: false for graceful show', async () => {
    await loadMain();
    mocks.readyCallbacks.forEach((cb) => cb());
    expect(mocks.BrowserWindowMock).toHaveBeenCalledWith(expect.objectContaining({ show: false }));
  });

  it('registers ready-to-show handler', async () => {
    await loadMain();
    mocks.readyCallbacks.forEach((cb) => cb());
    expect(mocks.once).toHaveBeenCalledWith('ready-to-show', expect.any(Function));
  });

  it('enables contextIsolation in webPreferences', async () => {
    await loadMain();
    mocks.readyCallbacks.forEach((cb) => cb());
    expect(mocks.BrowserWindowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        webPreferences: expect.objectContaining({
          contextIsolation: true,
          nodeIntegration: false,
        }),
      }),
    );
  });

  it('disables spellcheck in webPreferences', async () => {
    await loadMain();
    mocks.readyCallbacks.forEach((cb) => cb());
    expect(mocks.BrowserWindowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        webPreferences: expect.objectContaining({
          spellcheck: false,
        }),
      }),
    );
  });

  it('loads Vite dev server URL in dev mode', async () => {
    await loadMain('http://localhost:5173');
    mocks.readyCallbacks.forEach((cb) => cb());
    expect(mocks.loadURL).toHaveBeenCalledWith('http://localhost:5173');
  });

  it('opens DevTools in dev mode', async () => {
    await loadMain('http://localhost:5173');
    mocks.readyCallbacks.forEach((cb) => cb());
    expect(mocks.openDevTools).toHaveBeenCalled();
  });

  it('loads file in production mode', async () => {
    await loadMain();
    mocks.readyCallbacks.forEach((cb) => cb());
    expect(mocks.loadFile).toHaveBeenCalled();
  });

  it('does not open DevTools in production mode', async () => {
    await loadMain();
    mocks.readyCallbacks.forEach((cb) => cb());
    expect(mocks.openDevTools).not.toHaveBeenCalled();
  });

  it('sets CSP headers in production mode', async () => {
    await loadMain();
    mocks.readyCallbacks.forEach((cb) => cb());
    expect(mocks.onHeadersReceived).toHaveBeenCalledWith(expect.any(Function));
  });

  it('blocks new windows in production mode', async () => {
    await loadMain();
    mocks.readyCallbacks.forEach((cb) => cb());
    expect(mocks.setWindowOpenHandler).toHaveBeenCalledWith(expect.any(Function));
  });

  it('blocks navigation in production mode', async () => {
    await loadMain();
    mocks.readyCallbacks.forEach((cb) => cb());
    expect(mocks.onWillNavigate).toHaveBeenCalledWith('will-navigate', expect.any(Function));
  });

  it('does not set CSP headers in dev mode', async () => {
    await loadMain('http://localhost:5173');
    mocks.readyCallbacks.forEach((cb) => cb());
    expect(mocks.onHeadersReceived).not.toHaveBeenCalled();
  });

  it('does not block windows in dev mode', async () => {
    await loadMain('http://localhost:5173');
    mocks.readyCallbacks.forEach((cb) => cb());
    expect(mocks.setWindowOpenHandler).not.toHaveBeenCalled();
  });
});
