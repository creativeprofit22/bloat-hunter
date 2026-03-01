import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { StatusBar } from './StatusBar';
import { PreviewPanel } from '../preview/PreviewPanel';
import { useUIStore } from '../../store/ui-store';

interface AppLayoutProps {
  children: ReactNode;
  onClean?: () => void;
}

export function AppLayout({ children, onClean }: AppLayoutProps) {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const previewVisible = useUIStore((s) => s.previewVisible);

  const layoutClass = [
    'app-layout',
    sidebarCollapsed ? 'app-layout--sidebar-collapsed' : '',
    previewVisible ? 'app-layout--preview-visible' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={layoutClass}>
      <Header onClean={onClean} />
      <Sidebar />
      <main className="content-area">{children}</main>
      {previewVisible && <PreviewPanel />}
      <StatusBar />
    </div>
  );
}
