import { readFileSync } from 'node:fs';

export type Platform = 'linux' | 'mac' | 'wsl2' | 'windows-native';

export function detectPlatform(): Platform {
  if (process.platform === 'darwin') return 'mac';

  if (process.platform === 'linux') {
    try {
      const procVersion = readFileSync('/proc/version', 'utf8');
      if (procVersion.toLowerCase().includes('microsoft')) return 'wsl2';
    } catch {
      // /proc/version unreadable — treat as plain linux
    }
    return 'linux';
  }

  if (process.platform === 'win32') return 'windows-native';

  return 'linux';
}

export function isWSL2(): boolean {
  return detectPlatform() === 'wsl2';
}

export function isMac(): boolean {
  return detectPlatform() === 'mac';
}

export function isLinux(): boolean {
  const p = detectPlatform();
  return p === 'linux' || p === 'wsl2';
}
