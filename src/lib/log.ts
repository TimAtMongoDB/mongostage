import { appendFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const LOG_DIR = join(homedir(), '.mongostage', 'logs');
const LOG_FILE = join(LOG_DIR, 'mongostage.log');

export function appendLaunchError(imageTag: string, stepLabel: string, error: unknown): void {
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    const message = error instanceof Error ? error.message : String(error);
    const entry = `[${new Date().toISOString()}] [${imageTag}] step "${stepLabel}" — ${message}\n`;
    appendFileSync(LOG_FILE, entry, { encoding: 'utf8' });
  } catch {
    // silently ignore — log failure must never surface to the user
  }
}
