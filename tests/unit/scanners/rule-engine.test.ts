// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resolveEnvVars,
  matchesPattern,
  executeRule,
} from '../../../src/main/scanners/rule-engine';
import type { ScanRule } from '../../../src/main/scanners/types';

describe('resolveEnvVars', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves known environment variables', () => {
    process.env.TEMP = 'C:\\Users\\Test\\AppData\\Local\\Temp';
    const result = resolveEnvVars('%TEMP%\\test');
    expect(result).toBe('C:\\Users\\Test\\AppData\\Local\\Temp\\test');
  });

  it('resolves multiple variables', () => {
    process.env.HOMEDRIVE = 'C:';
    process.env.HOMEPATH = '\\Users\\Test';
    const result = resolveEnvVars('%HOMEDRIVE%%HOMEPATH%');
    expect(result).toBe('C:\\Users\\Test');
  });

  it('returns null for unresolved variables', () => {
    delete process.env.NONEXISTENT_VAR_12345;
    const result = resolveEnvVars('%NONEXISTENT_VAR_12345%\\test');
    expect(result).toBeNull();
  });

  it('returns the string unchanged when no variables present', () => {
    const result = resolveEnvVars('C:\\Windows\\Temp');
    expect(result).toBe('C:\\Windows\\Temp');
  });

  it('returns empty string for empty input', () => {
    const result = resolveEnvVars('');
    expect(result).toBe('');
  });
});

describe('matchesPattern', () => {
  it('matches wildcard * against anything', () => {
    expect(matchesPattern('anything.txt', '*')).toBe(true);
  });

  it('matches exact filename', () => {
    expect(matchesPattern('test.txt', 'test.txt')).toBe(true);
  });

  it('does not match different filename', () => {
    expect(matchesPattern('test.txt', 'other.txt')).toBe(false);
  });

  it('matches glob pattern with *', () => {
    expect(matchesPattern('test.log', '*.log')).toBe(true);
    expect(matchesPattern('test.txt', '*.log')).toBe(false);
  });

  it('matches glob pattern with ?', () => {
    expect(matchesPattern('test1.txt', 'test?.txt')).toBe(true);
    expect(matchesPattern('test12.txt', 'test?.txt')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(matchesPattern('TEST.LOG', '*.log')).toBe(true);
    expect(matchesPattern('test.LOG', '*.log')).toBe(true);
  });

  it('handles patterns with dots correctly', () => {
    expect(matchesPattern('file.backup.log', '*.log')).toBe(true);
  });

  it('matches complex patterns', () => {
    expect(matchesPattern('temp_12345.tmp', 'temp_*.tmp')).toBe(true);
    expect(matchesPattern('temp_12345.log', 'temp_*.tmp')).toBe(false);
  });
});

describe('executeRule', () => {
  it('yields nothing for rule with unresolvable env vars', async () => {
    delete process.env.NONEXISTENT_VAR_12345;
    const rule: ScanRule = {
      id: 'test-rule',
      name: 'Test Rule',
      description: 'Test',
      risk: 'green',
      paths: [
        {
          path: '%NONEXISTENT_VAR_12345%\\test',
          pattern: '*',
          search: 'files',
          recursive: false,
        },
      ],
    };

    const matches = [];
    for await (const match of executeRule(rule, () => false)) {
      matches.push(match);
    }
    expect(matches).toHaveLength(0);
  });

  it('yields nothing for non-existent base path', async () => {
    const rule: ScanRule = {
      id: 'test-rule',
      name: 'Test Rule',
      description: 'Test',
      risk: 'green',
      paths: [
        {
          path: '/absolutely/nonexistent/path/12345',
          pattern: '*',
          search: 'files',
          recursive: false,
        },
      ],
    };

    const matches = [];
    for await (const match of executeRule(rule, () => false)) {
      matches.push(match);
    }
    expect(matches).toHaveLength(0);
  });

  it('respects cancellation', async () => {
    const rule: ScanRule = {
      id: 'test-rule',
      name: 'Test Rule',
      description: 'Test',
      risk: 'green',
      paths: [
        {
          path: '/tmp',
          pattern: '*',
          search: 'files',
          recursive: true,
        },
      ],
    };

    const matches = [];
    for await (const match of executeRule(rule, () => true)) {
      matches.push(match);
    }
    expect(matches).toHaveLength(0);
  });
});
