import { useEffect } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './components/dashboard/Dashboard';
import { ResultsView } from './components/results/ResultsView';
import { SettingsView } from './components/settings/SettingsView';
import { ConfirmDialog } from './components/common/ConfirmDialog';
import { CleanProgress } from './components/common/CleanProgress';
import { useUIStore } from './store/ui-store';
import { useSettingsStore } from './store/settings-store';
import { useScanner } from './hooks/useScanner';
import { useCleaner } from './hooks/useCleaner';
import type { ScannerType } from '../main/scanners/types';

function AppContent() {
  const activeView = useUIStore((s) => s.activeView);

  if (activeView === 'dashboard') {
    return <Dashboard />;
  }

  if (activeView === 'settings') {
    return <SettingsView />;
  }

  return <ResultsView scannerType={activeView as ScannerType} />;
}

function App() {
  // Hydrate settings from main process on app startup so all components
  // read persisted values instead of Zustand defaults.
  useEffect(() => {
    let cancelled = false;
    window.electronAPI.loadSettings().then((settings) => {
      if (cancelled) return;
      const s = useSettingsStore.getState();
      s.setScanPaths(settings.scanPaths);
      s.setExclusions(settings.exclusions);
      s.setMaxDepth(settings.maxDepth);
      s.setMinSize(settings.minSize);
      s.setStaleMonths(settings.staleMonths);
      s.setTopN(settings.topN);
      s.setAIProvider(settings.aiProvider);
      s.setAIBaseUrl(settings.aiBaseUrl);
      s.setAIModel(settings.aiModel);
      s.setAIEnabled(settings.aiEnabled);
      s.setDefaultCleanAction(settings.defaultCleanAction);
      s.setQuarantinePath(settings.quarantinePath);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Set up IPC event listeners at the app level
  useScanner();

  const cleaner = useCleaner();

  return (
    <AppLayout onClean={cleaner.requestClean}>
      <AppContent />

      {cleaner.phase === 'confirming' && (
        <ConfirmDialog
          open
          itemCount={cleaner.items.length}
          totalBytes={cleaner.totalBytes}
          riskBreakdown={cleaner.riskBreakdown}
          defaultAction={cleaner.defaultAction}
          isAdmin={cleaner.isAdmin}
          quarantinePath={cleaner.quarantinePath}
          onConfirm={cleaner.confirmClean}
          onCancel={cleaner.cancelClean}
        />
      )}

      <CleanProgress
        open={cleaner.phase === 'cleaning' || cleaner.phase === 'done'}
        progress={cleaner.progress}
        result={cleaner.result}
        onClose={cleaner.dismissResults}
      />
    </AppLayout>
  );
}

export default App;
