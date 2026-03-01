import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  versions: {
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
  },

  // ── Scanner Control ──
  startScan: (scannerType: string, config: unknown) =>
    ipcRenderer.invoke('scanner:start', scannerType, config),
  cancelScan: (scannerType: string) => ipcRenderer.invoke('scanner:cancel', scannerType),

  // ── Preview / Thumbnails ──
  generateThumbnail: (filePath: string, maxSize: number) =>
    ipcRenderer.invoke('preview:thumbnail', filePath, maxSize),

  // ── Cleaning Actions ──
  startClean: (items: unknown[], action: string, moveTo?: string) =>
    ipcRenderer.invoke('clean:start', items, action, moveTo),
  isAdmin: () => ipcRenderer.invoke('clean:is-admin'),

  // ── Cleaning Events (renderer listens) ──
  onCleanProgress: (callback: (data: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on('clean:progress', handler);
    return () => ipcRenderer.removeListener('clean:progress', handler);
  },

  // ── Settings ──
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (partial: unknown) => ipcRenderer.invoke('settings:save', partial),
  setApiKey: (provider: string, apiKey: string) =>
    ipcRenderer.invoke('settings:set-api-key', provider, apiKey),
  hasApiKey: (provider: string) => ipcRenderer.invoke('settings:has-api-key', provider),

  // ── AI Advisory ──
  aiConfigure: (config: unknown) => ipcRenderer.invoke('ai:configure', config),
  aiAnalyze: (results: unknown[]) => ipcRenderer.invoke('ai:analyze', results),
  aiExplainItem: (result: unknown) => ipcRenderer.invoke('ai:explain-item', result),
  aiTestConnection: () => ipcRenderer.invoke('ai:test-connection'),

  // ── Scanner Events (renderer listens) ──
  onScanProgress: (callback: (data: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on('scanner:progress', handler);
    return () => ipcRenderer.removeListener('scanner:progress', handler);
  },
  onScanResult: (callback: (data: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on('scanner:result', handler);
    return () => ipcRenderer.removeListener('scanner:result', handler);
  },
  onScanError: (callback: (data: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on('scanner:error', handler);
    return () => ipcRenderer.removeListener('scanner:error', handler);
  },
  onScanCancelled: (callback: (data: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on('scanner:cancelled', handler);
    return () => ipcRenderer.removeListener('scanner:cancelled', handler);
  },
});
