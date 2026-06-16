import { streamCommand } from './docker.js';
import { PreflightError } from './errors.js';

export { PreflightError };

async function commandExists(cmd: string, args: string[] = ['--version']): Promise<boolean> {
  const { spawn } = await import('node:child_process');
  return new Promise(resolve => {
    const proc = spawn(cmd, args, { stdio: 'pipe' });
    proc.on('close', code => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

export async function isColimaInstalled(): Promise<boolean> {
  return commandExists('colima');
}

export async function isColimaRunning(): Promise<boolean> {
  const { spawn } = await import('node:child_process');
  return new Promise(resolve => {
    const proc = spawn('colima', ['status'], { stdio: 'pipe' });
    let output = '';
    proc.stdout?.on('data', (d: Buffer) => (output += d.toString()));
    proc.on('close', () => resolve(output.includes('colima is running')));
    proc.on('error', () => resolve(false));
  });
}

export async function installColima(onProgress?: (msg: string) => void): Promise<void> {
  const brewExists = await commandExists('brew', ['--version']);
  if (!brewExists) {
    throw new PreflightError(
      'Homebrew not found. Install Homebrew first: https://brew.sh'
    );
  }

  const colimaInstalled = await isColimaInstalled();
  if (!colimaInstalled) {
    onProgress?.('Installing Colima and Docker via Homebrew...');
    await streamCommand('brew', ['install', 'colima', 'docker']);
  }
}

export async function startColima(): Promise<void> {
  const running = await isColimaRunning();
  if (running) return;
  await streamCommand('colima', ['start']);
}
