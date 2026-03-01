import '@testing-library/jest-dom/vitest';

const noop = () => () => {};

// Mock electronAPI for renderer tests (only in jsdom environment)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'electronAPI', {
    value: {
      getAppVersion: () => Promise.resolve('1.0.0'),
      versions: {
        electron: '33.0.0',
        node: '20.0.0',
        chrome: '130.0.0',
      },
      startScan: () => Promise.resolve(),
      cancelScan: () => Promise.resolve(),
      generateThumbnail: () => Promise.resolve(null),
      startClean: () =>
        Promise.resolve({
          totalItems: 0,
          successCount: 0,
          failedCount: 0,
          bytesRecovered: 0,
          errors: [],
        }),
      isAdmin: () => Promise.resolve(false),
      loadSettings: () => Promise.resolve({}),
      saveSettings: () => Promise.resolve({}),
      setApiKey: () => Promise.resolve(),
      hasApiKey: () => Promise.resolve(false),
      aiConfigure: () => Promise.resolve(),
      aiAnalyze: () => Promise.resolve(null),
      aiExplainItem: () => Promise.resolve(''),
      aiTestConnection: () => Promise.resolve(false),
      onScanProgress: noop,
      onScanResult: noop,
      onScanError: noop,
      onScanCancelled: noop,
      onCleanProgress: noop,
    },
    writable: true,
  });
}
