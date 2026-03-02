import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/** Known Windows services that lock files the app may need to clean */
const CLEANABLE_SERVICES: Record<string, string[]> = {
  /** Windows Update service locks SoftwareDistribution folder */
  wuauserv: ['SoftwareDistribution'],
  /** BITS locks download cache */
  BITS: ['SoftwareDistribution'],
};

/**
 * Check if the current process has admin privileges.
 */
export async function isAdmin(): Promise<boolean> {
  if (process.platform !== 'win32') return false;
  try {
    await execAsync('net session', { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Stop a Windows service. Requires admin privileges.
 * Returns true if the service was stopped, false if it was already stopped.
 */
async function stopService(serviceName: string): Promise<boolean> {
  if (process.platform !== 'win32') return false;
  try {
    await execAsync(`net stop "${serviceName}"`, { timeout: 30000 });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Service already stopped — not an error
    if (message.includes('is not started') || message.includes('2182')) {
      return false;
    }
    throw new Error(`Failed to stop service ${serviceName}: ${message}`);
  }
}

/**
 * Start a Windows service. Requires admin privileges.
 */
async function startService(serviceName: string): Promise<boolean> {
  if (process.platform !== 'win32') return false;
  try {
    await execAsync(`net start "${serviceName}"`, { timeout: 30000 });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Service already running — not an error
    if (message.includes('already been started') || message.includes('2182')) {
      return false;
    }
    throw new Error(`Failed to start service ${serviceName}: ${message}`);
  }
}

/**
 * Check if a file path requires stopping a Windows service before cleaning.
 * Returns the service names that should be stopped, or empty array if none.
 */
function getBlockingServices(filePath: string): string[] {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  const services: string[] = [];

  for (const [service, patterns] of Object.entries(CLEANABLE_SERVICES)) {
    for (const pattern of patterns) {
      if (normalized.includes(pattern.toLowerCase())) {
        services.push(service);
        break;
      }
    }
  }

  return services;
}

/**
 * Stop all services that might lock files at the given paths,
 * execute the callback, then restart them.
 */
export async function withServicesStopped(
  paths: string[],
  fn: () => Promise<void>,
): Promise<string[]> {
  const servicesToStop = new Set<string>();
  for (const p of paths) {
    for (const svc of getBlockingServices(p)) {
      servicesToStop.add(svc);
    }
  }

  if (servicesToStop.size === 0) {
    await fn();
    return [];
  }

  const stoppedServices: string[] = [];

  try {
    // Stop required services
    for (const svc of servicesToStop) {
      const wasStopped = await stopService(svc);
      if (wasStopped) {
        stoppedServices.push(svc);
      }
    }

    await fn();
  } finally {
    // Always restart services we stopped
    for (const svc of stoppedServices) {
      try {
        await startService(svc);
      } catch {
        // Best effort — log but don't throw
      }
    }
  }

  return stoppedServices;
}
