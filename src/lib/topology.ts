import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as net from 'node:net';

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PACKAGE_ROOT = join(__dirname, '../../');

export interface PortGroup {
  envVarPrefix: string;  // e.g. "MONGO_HOST_PORT" → MONGO_HOST_PORT_1, _2, ...
  count: number;         // how many consecutive ports are needed
  defaultStart: number;  // scan begins from this port
}

export interface TopologyPreset {
  id: string;
  name: string;
  description: string;
  composeFile: string;
  services: string[];
  portGroups: readonly PortGroup[];
}

export interface SpawnResult {
  connectionString: string;
}

export const TOPOLOGY_PRESETS: readonly TopologyPreset[] = Object.freeze([
  {
    id: 'standalone',
    name: 'Standalone',
    description: 'Single mongod, port assigned from 27017',
    composeFile: 'docker-compose/standalone.yml',
    services: ['mongo-1'],
    portGroups: [
      { envVarPrefix: 'MONGO_HOST_PORT', count: 1, defaultStart: 27017 },
    ],
  },
  {
    id: 'replica-set-3',
    name: 'Replica Set (3 nodes)',
    description: 'rs0 — 3 consecutive ports from 27017',
    composeFile: 'docker-compose/replica-set-3.yml',
    services: ['rs0-1', 'rs0-2', 'rs0-3'],
    portGroups: [
      { envVarPrefix: 'MONGO_HOST_PORT', count: 3, defaultStart: 27017 },
    ],
  },
  {
    id: 'sharded-2x3',
    name: 'Sharded Cluster (2×3)',
    description: '2 shards × 3 members + mongos, from 27017',
    composeFile: 'docker-compose/sharded-2x3.yml',
    services: ['mongos', 'cfg1', 'cfg2', 'cfg3', 'shard1-1', 'shard1-2', 'shard1-3', 'shard2-1', 'shard2-2', 'shard2-3'],
    portGroups: [
      { envVarPrefix: 'MONGO_HOST_PORT', count: 1, defaultStart: 27017 },
    ],
  },
  {
    id: 'standalone-search',
    name: 'Standalone + Atlas Search',
    description: 'mongod + mongot, ports from 27017 and 27028',
    composeFile: 'docker-compose/standalone-search.yml',
    services: ['mongo-1', 'search-mongot'],
    portGroups: [
      { envVarPrefix: 'MONGO_HOST_PORT', count: 1, defaultStart: 27017 },
      { envVarPrefix: 'MONGOT_HOST_PORT', count: 1, defaultStart: 27028 },
    ],
  },
  {
    id: 'replica-set-3-search',
    name: 'Replica Set + Atlas Search',
    description: 'rs0 (3 nodes) + mongot, from 27017',
    composeFile: 'docker-compose/replica-set-3-search.yml',
    services: ['rs0-1', 'rs0-2', 'rs0-3', 'search-mongot'],
    portGroups: [
      { envVarPrefix: 'MONGO_HOST_PORT', count: 3, defaultStart: 27017 },
      { envVarPrefix: 'MONGOT_HOST_PORT', count: 1, defaultStart: 27028 },
    ],
  },
]);

// ─── Port scanning ────────────────────────────────────────────────────────────

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '0.0.0.0');
  });
}

async function findConsecutivePorts(count: number, startFrom: number): Promise<number[]> {
  const MAX_PORT = 65000;
  let start = startFrom;

  while (start + count - 1 <= MAX_PORT) {
    const ports = Array.from({ length: count }, (_, i) => start + i);
    const available = await Promise.all(ports.map(isPortAvailable));
    if (available.every(Boolean)) return ports;
    // Jump past the first unavailable port in the block — any block that
    // includes it would fail, so skip ahead.
    const firstBlocked = available.findIndex(a => !a);
    start = start + firstBlocked + 1;
  }

  throw new Error(`No ${count} consecutive available ports found starting from ${startFrom}`);
}

async function resolvePortEnv(preset: TopologyPreset): Promise<Record<string, string>> {
  const env: Record<string, string> = {};
  for (const group of preset.portGroups) {
    const ports = await findConsecutivePorts(group.count, group.defaultStart);
    ports.forEach((port, i) => {
      env[`${group.envVarPrefix}_${i + 1}`] = String(port);
    });
  }
  return env;
}

function buildConnectionString(preset: TopologyPreset, env: Record<string, string>): string {
  const p1 = env['MONGO_HOST_PORT_1'] ?? '27017';
  const p2 = env['MONGO_HOST_PORT_2'] ?? '27018';
  const p3 = env['MONGO_HOST_PORT_3'] ?? '27019';

  switch (preset.id) {
    case 'replica-set-3':
    case 'replica-set-3-search':
      return `mongodb://rs0-1.localhost:${p1},rs0-2.localhost:${p2},rs0-3.localhost:${p3}/?replicaSet=rs0`;
    case 'standalone-search':
      return `mongodb://localhost:${p1}/?directConnection=true`;
    default:
      return `mongodb://localhost:${p1}/`;
  }
}

// ─── Compose detection / execution ───────────────────────────────────────────

interface ComposeCmd {
  cmd: string;
  baseArgs: string[];
}

let cachedComposeCmd: ComposeCmd | null = null;

async function detectComposeCommand(): Promise<ComposeCmd> {
  if (cachedComposeCmd) return cachedComposeCmd;

  const candidates: ComposeCmd[] = [
    { cmd: 'docker', baseArgs: ['compose'] },
    { cmd: 'docker-compose', baseArgs: [] },
  ];
  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate.cmd, [...candidate.baseArgs, 'version'], { timeout: 5000 });
      cachedComposeCmd = candidate;
      return candidate;
    } catch {
      // try next
    }
  }
  throw new Error('Docker Compose not found. Install Docker with Compose support (docker compose version).');
}

function summariseComposeError(code: number, stderr: string): string {
  // Port already in use — give actionable guidance
  const portMatch = stderr.match(/Bind for [^:]+:(\d+) failed: port is already allocated/);
  if (portMatch) {
    return `Port ${portMatch[1]} is already in use. Tear down this topology first (press d), or stop whatever is using that port.`;
  }

  if (stderr.includes('address already in use')) {
    return 'A required port is already in use. Tear down this topology first (press d), or check for conflicting containers.';
  }

  // Strip docker compose progress lines — keep only the meaningful error output
  const progressPattern = /^\s+\S.*\s(Creating|Created|Starting|Started|Stopping|Stopped|Removing|Removed|Pulling|Pulled|Building|Built)\s*$/;
  const meaningful = stderr
    .split('\n')
    .filter(line => line.trim() && !progressPattern.test(line))
    .join(' ')
    .trim();

  return `docker compose exited with code ${code}${meaningful ? ': ' + meaningful : ''}`;
}

async function runCompose(
  preset: TopologyPreset,
  subcommand: string[],
  extraEnv: Record<string, string> = {},
): Promise<void> {
  const compose = await detectComposeCommand();
  const composeFile = join(PACKAGE_ROOT, preset.composeFile);

  return new Promise((resolve, reject) => {
    const proc = spawn(
      compose.cmd,
      [...compose.baseArgs, '-f', composeFile, '-p', preset.id, ...subcommand],
      {
        stdio: 'pipe',
        env: { ...process.env, MONGOSTAGE_PACKAGE_ROOT: PACKAGE_ROOT, ...extraEnv },
      }
    );

    const stderr: string[] = [];
    proc.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk.toString()));

    proc.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(summariseComposeError(code ?? 1, stderr.join(''))));
      }
    });

    proc.on('error', err => reject(new Error(`Failed to run docker compose: ${err.message}`)));
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function spawnTopology(presetId: string): Promise<SpawnResult> {
  const preset = TOPOLOGY_PRESETS.find(p => p.id === presetId);
  if (!preset) throw new Error(`Unknown topology preset: "${presetId}"`);
  const portEnv = await resolvePortEnv(preset);
  await runCompose(preset, ['up', '-d', '--remove-orphans'], portEnv);
  return { connectionString: buildConnectionString(preset, portEnv) };
}

export async function teardownTopology(presetId: string): Promise<void> {
  const preset = TOPOLOGY_PRESETS.find(p => p.id === presetId);
  if (!preset) throw new Error(`Unknown topology preset: "${presetId}"`);
  await runCompose(preset, ['down', '--volumes']);
}

export async function getRunningTopologyIds(): Promise<string[]> {
  try {
    const compose = await detectComposeCommand();
    const { stdout } = await execFileAsync(
      compose.cmd,
      [...compose.baseArgs, 'ls', '--format', 'json'],
      { timeout: 5000 }
    );
    const projects: Array<{ Name: string; Status: string }> = JSON.parse(stdout.trim());
    const presetIds = new Set(TOPOLOGY_PRESETS.map(p => p.id));
    return projects
      .filter(p => presetIds.has(p.Name) && p.Status.includes('running'))
      .map(p => p.Name);
  } catch {
    return [];
  }
}
