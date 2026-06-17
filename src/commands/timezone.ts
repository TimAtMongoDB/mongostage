import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import chalk from 'chalk';

const ENV_DIR = join(homedir(), '.mongostage');
const ENV_FILE = join(ENV_DIR, '.env');

function ensureEnvDir(): void {
  if (!existsSync(ENV_DIR)) {
    mkdirSync(ENV_DIR, { recursive: true });
  }
}

function readEnvLines(): string[] {
  if (!existsSync(ENV_FILE)) return [];
  return readFileSync(ENV_FILE, 'utf8').split('\n');
}

function writeEnvLines(lines: string[]): void {
  ensureEnvDir();
  writeFileSync(ENV_FILE, lines.join('\n'), { encoding: 'utf8' });
  chmodSync(ENV_FILE, 0o600);
}

export async function timezoneSetCommand(tz: string): Promise<void> {
  const validZones = Intl.supportedValuesOf('timeZone');
  if (!validZones.includes(tz)) {
    console.error(chalk.red(`Invalid timezone: "${tz}"`));
    console.error('Examples: America/New_York, Europe/London, Asia/Tokyo, UTC');
    process.exit(1);
  }

  const lines = readEnvLines();
  const idx = lines.findIndex(l => l.startsWith('TZ='));
  if (idx >= 0) {
    lines[idx] = `TZ=${tz}`;
  } else {
    if (lines.length > 0 && lines[lines.length - 1] !== '') {
      lines.push(`TZ=${tz}`);
    } else {
      lines.splice(lines.length > 0 ? lines.length - 1 : 0, 0, `TZ=${tz}`);
    }
  }
  writeEnvLines(lines);
  console.log(chalk.green(`Timezone set to ${tz}`));

  try {
    const { listManagedContainers } = await import('../lib/containers.js');
    const containers = await listManagedContainers();
    if (containers.length > 0) {
      console.log(
        chalk.yellow('Note: existing containers must be recreated (mongostage connect --fresh) to pick up the new timezone.')
      );
    }
  } catch {
    // Docker not running or unavailable — skip the rebuild warning
  }
}

export async function timezoneShowCommand(): Promise<void> {
  const lines = readEnvLines();
  const line = lines.find(l => l.startsWith('TZ='));
  if (line) {
    console.log(`Timezone: ${chalk.cyan(line.slice(3))}`);
  } else {
    console.log('Timezone not configured. Run `mongostage timezone set <tz>` to set one.');
    console.log('Examples: America/New_York, Europe/London, Asia/Tokyo, UTC');
  }
}
