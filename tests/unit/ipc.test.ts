// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  handle: vi.fn(),
  getVersion: vi.fn(() => '1.0.0'),
  appOn: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: { handle: mocks.handle },
  app: { getVersion: mocks.getVersion, on: mocks.appOn },
}));

vi.mock('fs/promises', () => ({
  stat: vi.fn(),
}));

vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 100, height: 100 }),
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('test')),
  })),
}));

vi.mock('../../src/main/scanners/worker-manager', () => ({
  WorkerManager: class {
    startScan = vi.fn();
    cancelScan = vi.fn();
    terminateAll = vi.fn();
  },
}));

vi.mock('../../src/main/cleaners/cleaner', () => ({
  cleanItems: vi.fn(),
}));

vi.mock('../../src/main/cleaners/service-manager', () => ({
  isAdmin: vi.fn(() => false),
}));

vi.mock('../../src/main/ai/advisor', () => ({
  advisor: {
    configure: vi.fn(),
    analyze: vi.fn(),
    explainItem: vi.fn(),
    testConnection: vi.fn(),
  },
}));

vi.mock('../../src/main/settings/store', () => ({
  loadSettings: vi.fn(),
  updateSettings: vi.fn(),
}));

vi.mock('../../src/main/settings/secure-store', () => ({
  setApiKey: vi.fn(),
  getApiKey: vi.fn(),
  hasApiKey: vi.fn(),
}));

import { registerIpcHandlers } from '../../src/main/ipc';

describe('IPC Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers get-app-version handler', () => {
    registerIpcHandlers();
    expect(mocks.handle).toHaveBeenCalledWith('get-app-version', expect.any(Function));
  });

  it('registers scanner handlers', () => {
    registerIpcHandlers();
    expect(mocks.handle).toHaveBeenCalledWith('scanner:start', expect.any(Function));
    expect(mocks.handle).toHaveBeenCalledWith('scanner:cancel', expect.any(Function));
  });

  it('registers preview handlers', () => {
    registerIpcHandlers();
    expect(mocks.handle).toHaveBeenCalledWith('preview:thumbnail', expect.any(Function));
  });

  it('registers clean handlers', () => {
    registerIpcHandlers();
    expect(mocks.handle).toHaveBeenCalledWith('clean:start', expect.any(Function));
    expect(mocks.handle).toHaveBeenCalledWith('clean:is-admin', expect.any(Function));
  });

  it('registers settings handlers', () => {
    registerIpcHandlers();
    expect(mocks.handle).toHaveBeenCalledWith('settings:load', expect.any(Function));
    expect(mocks.handle).toHaveBeenCalledWith('settings:save', expect.any(Function));
    expect(mocks.handle).toHaveBeenCalledWith('settings:set-api-key', expect.any(Function));
    expect(mocks.handle).toHaveBeenCalledWith('settings:has-api-key', expect.any(Function));
  });

  it('registers AI handlers', () => {
    registerIpcHandlers();
    expect(mocks.handle).toHaveBeenCalledWith('ai:configure', expect.any(Function));
    expect(mocks.handle).toHaveBeenCalledWith('ai:analyze', expect.any(Function));
    expect(mocks.handle).toHaveBeenCalledWith('ai:explain-item', expect.any(Function));
    expect(mocks.handle).toHaveBeenCalledWith('ai:test-connection', expect.any(Function));
  });

  it('get-app-version handler returns app version', () => {
    registerIpcHandlers();
    const handler = mocks.handle.mock.calls.find(
      (call: unknown[]) => call[0] === 'get-app-version',
    )?.[1] as () => string;
    expect(handler()).toBe('1.0.0');
  });

  it('registers will-quit cleanup handler', () => {
    registerIpcHandlers();
    expect(mocks.appOn).toHaveBeenCalledWith('will-quit', expect.any(Function));
  });
});
