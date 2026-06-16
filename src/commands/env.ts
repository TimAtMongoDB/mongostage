import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline/promises';

const ENV_DIR = join(homedir(), '.mongo-docker');
const ENV_FILE = join(ENV_DIR, '.env');

function ensureEnvDir(): void {
  if (!existsSync(ENV_DIR)) {
    mkdirSync(ENV_DIR, { recursive: true });
  }
}

function readEnvLines(): string[] {
  if (!existsSync(ENV_FILE)) return [];
  const content = readFileSync(ENV_FILE, 'utf8');
  return content.split('\n');
}

function writeEnvLines(lines: string[]): void {
  ensureEnvDir();
  const content = lines.join('\n');
  writeFileSync(ENV_FILE, content, { encoding: 'utf8' });
  chmodSync(ENV_FILE, 0o600);
}

export async function envSetCommand(entry: string): Promise<void> {
  const eqIndex = entry.indexOf('=');
  if (eqIndex <= 0) {
    console.error('Invalid format. Use: mongo-docker env set KEY=VALUE');
    process.exit(1);
  }

  const key = entry.slice(0, eqIndex);
  const value = entry.slice(eqIndex + 1);
  const lines = readEnvLines();
  const keyPrefix = `${key}=`;
  const existingIdx = lines.findIndex(l => l.startsWith(keyPrefix));

  if (existingIdx >= 0) {
    lines[existingIdx] = `${key}=${value}`;
  } else {
    if (lines.length > 0 && lines[lines.length - 1] !== '') {
      lines.push(`${key}=${value}`);
    } else {
      lines.splice(lines.length > 0 ? lines.length - 1 : 0, 0, `${key}=${value}`);
    }
  }

  writeEnvLines(lines);
  console.log(`Set ${key}`);
}

export async function envListCommand(): Promise<void> {
  const lines = readEnvLines();
  const entries = lines.filter(l => l.trim() && !l.startsWith('#'));

  if (entries.length === 0) {
    console.log('No variables set. Use `mongo-docker env set KEY=VALUE`.');
    return;
  }

  for (const line of entries) {
    const eqIdx = line.indexOf('=');
    if (eqIdx > 0) {
      console.log(`${line.slice(0, eqIdx)}=****`);
    }
  }
}

export async function envRemoveCommand(key: string): Promise<void> {
  const lines = readEnvLines();
  const keyPrefix = `${key}=`;
  const idx = lines.findIndex(l => l.startsWith(keyPrefix));

  if (idx < 0) {
    console.error(`${key} not found.`);
    process.exit(1);
  }

  lines.splice(idx, 1);
  writeEnvLines(lines);
  console.log(`Removed ${key}`);
}

export async function envClearCommand(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question('Remove all env variables? [y/N] ');
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log('Cancelled.');
      return;
    }
    writeEnvLines([]);
    console.log('Cleared all env variables.');
  } finally {
    rl.close();
  }
}
