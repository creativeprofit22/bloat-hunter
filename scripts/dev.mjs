import { spawn } from 'child_process';
import { createRequire } from 'module';
import { createServer } from 'vite';
import * as esbuild from 'esbuild';

const require = createRequire(import.meta.url);
const electronPath = require('electron');

/** @type {import('child_process').ChildProcess | null} */
let electronProcess = null;

function startElectron(url) {
  if (electronProcess) {
    electronProcess.kill();
    electronProcess = null;
  }

  electronProcess = spawn(electronPath, ['.'], {
    env: { ...process.env, VITE_DEV_SERVER_URL: url },
    stdio: 'inherit',
  });

  electronProcess.on('close', (code) => {
    if (code !== null) {
      process.exit(0);
    }
  });
}

async function main() {
  // 1. Start Vite dev server for renderer
  const server = await createServer({
    configFile: 'vite.config.ts',
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5173;
  const url = `http://localhost:${port}`;
  console.log(`\n  Renderer dev server running at ${url}\n`);

  // 2. Build preload with esbuild (watch mode)
  const preloadCtx = await esbuild.context({
    entryPoints: ['src/preload/index.ts'],
    bundle: true,
    platform: 'node',
    outfile: 'dist/preload/index.js',
    external: ['electron'],
    sourcemap: true,
  });
  await preloadCtx.watch();

  // 2b. Build scanner worker with esbuild (watch mode)
  const workerCtx = await esbuild.context({
    entryPoints: ['src/main/scanners/scanner-worker.ts'],
    bundle: true,
    platform: 'node',
    outfile: 'dist/main/scanner-worker.js',
    external: ['electron', 'xxhash-wasm'],
    sourcemap: true,
  });
  await workerCtx.watch();

  // 3. Build main process with esbuild (watch mode + restart electron)
  let isFirstBuild = true;
  const mainCtx = await esbuild.context({
    entryPoints: ['src/main/index.ts'],
    bundle: true,
    platform: 'node',
    outfile: 'dist/main/index.js',
    external: ['electron', 'sharp'],
    sourcemap: true,
    plugins: [
      {
        name: 'electron-restart',
        setup(build) {
          build.onEnd((result) => {
            if (result.errors.length === 0) {
              if (isFirstBuild) {
                isFirstBuild = false;
                console.log('  Main process built. Starting Electron...\n');
              } else {
                console.log('  Main process rebuilt. Restarting Electron...\n');
              }
              startElectron(url);
            }
          });
        },
      },
    ],
  });
  await mainCtx.watch();

  // Cleanup on exit
  const cleanup = () => {
    if (electronProcess) electronProcess.kill();
    mainCtx.dispose();
    workerCtx.dispose();
    preloadCtx.dispose();
    server.close();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

main().catch((err) => {
  console.error('Dev server failed to start:', err);
  process.exit(1);
});
