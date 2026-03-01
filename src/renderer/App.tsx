import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './components/dashboard/Dashboard';
import { ResultsView } from './components/results/ResultsView';
import { SettingsView } from './components/settings/SettingsView';
import { ConfirmDialog } from './components/common/ConfirmDialog';
import { CleanProgress } from './components/common/CleanProgress';
import { useUIStore } from './store/ui-store';
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
  // Set up IPC event listeners at the app level
  useScanner();

  const cleaner = useCleaner();

  return (
    <AppLayout onClean={cleaner.requestClean}>
      <AppContent />

      <ConfirmDialog
        open={cleaner.phase === 'confirming'}
        itemCount={cleaner.items.length}
        totalBytes={cleaner.totalBytes}
        riskBreakdown={cleaner.riskBreakdown}
        defaultAction={cleaner.defaultAction}
        onConfirm={cleaner.confirmClean}
        onCancel={cleaner.cancelClean}
      />

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
