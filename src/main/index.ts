import { app, BrowserWindow, dialog } from 'electron';
import path from 'path';
import { registerIpcHandlers } from './ipc';

// Last-resort error handlers — prevent silent main-process crashes.
// Guard against duplicate registration when the module is re-imported in tests.
if (!process.listeners('uncaughtException').some((fn) => fn.name === '__bloatHunterUncaught')) {
  process.on('uncaughtException', function __bloatHunterUncaught(error) {
    console.error('Uncaught Exception:', error);
    dialog.showErrorBox('Unexpected Error', error.message ?? String(error));
  });
}
if (!process.listeners('unhandledRejection').some((fn) => fn.name === '__bloatHunterUnhandled')) {
  process.on('unhandledRejection', function __bloatHunterUnhandled(reason, promise) {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });
}

const isDev = !!process.env.VITE_DEV_SERVER_URL;

// Suppress Electron security warnings in dev mode — unsafe-eval and
// unsafe-inline are required by Vite's HMR and React Fast Refresh.
// Production builds use a strict CSP with no unsafe directives.
if (isDev) {
  process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
}

/**
 * Production Content Security Policy.
 *
 * - default-src 'self' — only load resources from the app itself
 * - script-src 'self' — no inline scripts or eval
 * - style-src 'self' 'unsafe-inline' — allow inline styles (React CSS-in-JS)
 * - img-src 'self' data: — allow data: URIs for base64 thumbnails
 * - font-src 'self' — only local fonts
 * - connect-src — allow AI API calls to Claude, OpenAI, and local Ollama
 * - object-src 'none' — block plugins
 * - base-uri 'self' — restrict <base> tag
 * - form-action 'self' — restrict form submissions
 */
const PRODUCTION_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://api.anthropic.com https://api.openai.com http://localhost:11434",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Bloat Hunter',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  // Show window when content is ready to avoid white flash
  win.once('ready-to-show', () => {
    win.show();
  });

  if (isDev) {
    // In dev mode, Vite's dev server handles its own headers.
    // We don't set a CSP here because Vite's React plugin requires
    // inline scripts for Fast Refresh, and HMR needs eval + WebSocket.
    win.loadURL(process.env.VITE_DEV_SERVER_URL!);
    win.webContents.openDevTools();
  } else {
    // In production, set a strict Content Security Policy
    win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [PRODUCTION_CSP],
        },
      });
    });

    // Block new window creation in production
    win.webContents.setWindowOpenHandler(() => {
      return { action: 'deny' };
    });

    // Disable navigation away from the app
    win.webContents.on('will-navigate', (event) => {
      event.preventDefault();
    });

    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
