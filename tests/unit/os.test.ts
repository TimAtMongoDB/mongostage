import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('detectPlatform()', () => {
  it('should return "wsl2" when /proc/version contains "Microsoft"', async () => {
    vi.doMock('node:fs', () => ({
      readFileSync: vi.fn().mockImplementation((path: string) => {
        if (path === '/proc/version') return 'Linux version 5.15.153.1-microsoft-standard-WSL2';
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }),
      existsSync: vi.fn().mockReturnValue(true),
    }));
    vi.resetModules();
    const { detectPlatform } = await import('../../src/lib/os.js');
    expect(detectPlatform()).toBe('wsl2');
  });

  it('should return "linux" when /proc/version does not contain "microsoft"', async () => {
    vi.doMock('node:fs', () => ({
      readFileSync: vi.fn().mockImplementation((path: string) => {
        if (path === '/proc/version') return 'Linux version 5.15.0-generic #1 SMP';
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }),
      existsSync: vi.fn().mockReturnValue(true),
    }));
    vi.resetModules();
    const { detectPlatform } = await import('../../src/lib/os.js');
    expect(detectPlatform()).toBe('linux');
  });

  it('should return "linux" when /proc/version is not readable', async () => {
    vi.doMock('node:fs', () => ({
      readFileSync: vi.fn().mockImplementation((_path: string) => {
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }),
      existsSync: vi.fn().mockReturnValue(false),
    }));
    vi.resetModules();
    const { detectPlatform } = await import('../../src/lib/os.js');
    const platform = detectPlatform();
    expect(['linux', 'mac', 'windows-native']).toContain(platform);
  });
});

describe('isWSL2()', () => {
  it('should return true when platform is wsl2', async () => {
    vi.doMock('node:fs', () => ({
      readFileSync: vi.fn().mockReturnValue('Linux version 5.15.153.1-microsoft-standard-WSL2'),
      existsSync: vi.fn().mockReturnValue(true),
    }));
    vi.resetModules();
    const { isWSL2 } = await import('../../src/lib/os.js');
    expect(isWSL2()).toBe(true);
  });

  it('should return false when platform is linux', async () => {
    vi.doMock('node:fs', () => ({
      readFileSync: vi.fn().mockReturnValue('Linux version 5.15.0-generic'),
      existsSync: vi.fn().mockReturnValue(true),
    }));
    vi.resetModules();
    const { isWSL2 } = await import('../../src/lib/os.js');
    expect(isWSL2()).toBe(false);
  });
});
