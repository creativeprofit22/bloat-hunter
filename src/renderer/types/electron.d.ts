export {};

declare global {
  interface Window {
    electronAPI: {
      getAppVersion: () => Promise<string>;
      versions: {
        electron: string;
        node: string;
        chrome: string;
      };

      // Scanner control
      startScan: (scannerType: string, config: unknown) => Promise<void>;
      cancelScan: (scannerType: string) => Promise<void>;

      // Preview / Thumbnails
      generateThumbnail: (
        filePath: string,
        maxSize: number,
      ) => Promise<{
        data: string;
        width: number;
        height: number;
        mime: string;
      } | null>;

      // Settings
      loadSettings: () => Promise<{
        scanPaths: string[];
        exclusions: string[];
        maxDepth: number;
        minSize: number;
        staleMonths: number;
        topN: number;
        aiProvider: 'claude' | 'openai' | 'ollama' | 'none';
        aiBaseUrl: string;
        aiModel: string;
        aiEnabled: boolean;
        defaultCleanAction: 'recycle' | 'delete' | 'move';
        quarantinePath: string;
      }>;
      saveSettings: (partial: unknown) => Promise<{
        scanPaths: string[];
        exclusions: string[];
        maxDepth: number;
        minSize: number;
        staleMonths: number;
        topN: number;
        aiProvider: 'claude' | 'openai' | 'ollama' | 'none';
        aiBaseUrl: string;
        aiModel: string;
        aiEnabled: boolean;
        defaultCleanAction: 'recycle' | 'delete' | 'move';
        quarantinePath: string;
      }>;
      setApiKey: (provider: string, apiKey: string) => Promise<void>;
      hasApiKey: (provider: string) => Promise<boolean>;

      // AI Advisory
      aiConfigure: (config: unknown) => Promise<void>;
      aiAnalyze: (results: unknown[]) => Promise<{
        summary: string;
        recommendations: Array<{
          category: string;
          action: string;
          reasoning: string;
          risk: 'green' | 'yellow' | 'red';
        }>;
        riskAssessment: string;
      } | null>;
      aiExplainItem: (result: unknown) => Promise<string | null>;
      aiTestConnection: () => Promise<{ ok: boolean; error?: string }>;

      // Cleaning actions
      startClean: (
        items: unknown[],
        action: string,
        moveTo?: string,
      ) => Promise<{
        totalItems: number;
        successCount: number;
        failedCount: number;
        bytesRecovered: number;
        errors: Array<{ path: string; message: string; code?: string }>;
      }>;
      isAdmin: () => Promise<boolean>;

      // Cleaning event listeners (return unsubscribe function)
      onCleanProgress: (callback: (data: unknown) => void) => () => void;

      // Scanner event listeners (return unsubscribe function)
      onScanProgress: (callback: (data: unknown) => void) => () => void;
      onScanResult: (callback: (data: unknown) => void) => () => void;
      onScanError: (callback: (data: unknown) => void) => () => void;
      onScanCancelled: (callback: (data: unknown) => void) => () => void;
    };
  }
}
