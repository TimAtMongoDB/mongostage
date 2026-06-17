import Dockerode from 'dockerode';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import type { RunContainerOpts } from '../types/container.js';

export type DockerState = 'running' | 'not-running' | 'not-installed';
export type DockerImage = { id: string; repoTags: string[]; size?: number };

let _client: Dockerode | null = null;

export function getDockerClient(): Dockerode {
  if (!_client) _client = new Dockerode();
  return _client;
}

export async function detectDockerState(): Promise<DockerState> {
  try {
    const docker = getDockerClient();
    await docker.ping();
    return 'running';
  } catch (err: unknown) {
    const code = err instanceof Error ? (err as NodeJS.ErrnoException).code : undefined;
    if (code === 'ENOENT' || code === 'ECONNREFUSED') {
      return await _checkDockerBinaryExists() ? 'not-running' : 'not-installed';
    }
    return 'not-running';
  }
}

async function _checkDockerBinaryExists(): Promise<boolean> {
  return new Promise(resolve => {
    const proc = spawn('docker', ['--version'], { stdio: 'pipe' });
    proc.on('error', () => resolve(false));
    proc.on('close', code => resolve(code === 0));
  });
}

export async function pollDockerReady(intervalMs: number, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const state = await detectDockerState();
    if (state === 'running') return;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`Docker did not become ready within ${timeoutMs}ms`);
}

export function streamCommand(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: 'inherit' });
    proc.on('error', err => reject(new Error(`Failed to run ${cmd}: ${err.message}`)));
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

export async function pullImage(
  tag: string,
  onProgress?: (msg: string) => void
): Promise<void> {
  const docker = getDockerClient();
  const images = await docker.listImages({ filters: JSON.stringify({ reference: [tag] }) });
  if (images.length > 0) {
    onProgress?.('Already up to date');
    return;
  }

  await new Promise<void>((resolve, reject) => {
    // Dockerode pull callback types differ from @types/dockerode — the stream is a Modem stream
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    docker.pull(tag, (err: Error | null, stream: any) => {
      if (err) return reject(new Error(`Failed to pull ${tag}: ${err.message}`));
      if (!stream) return reject(new Error(`Failed to pull ${tag}: no stream returned`));
      docker.modem.followProgress(
        stream,
        (err: Error | null) => (err ? reject(err) : resolve()),
        (event: { status?: string; progress?: string }) => {
          if (event.status) onProgress?.(`${event.status} ${event.progress ?? ''}`.trim());
        }
      );
    });
  });
}

function _parseEnvFile(envFile?: string): string[] {
  if (!envFile || !existsSync(envFile)) return [];
  try {
    return readFileSync(envFile, 'utf8')
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .map(line => line.trim());
  } catch (err) {
    const code = err instanceof Error ? (err as NodeJS.ErrnoException).code : undefined;
    if (code !== 'ENOENT') {
      console.error(`Warning: could not read env file (${code ?? 'unknown'}) — no env vars loaded`);
    }
    return [];
  }
}

export async function runContainer(opts: RunContainerOpts): Promise<Dockerode.Container> {
  const docker = getDockerClient();
  const { getContainerName } = await import('./containers.js');

  const binds: string[] = [];
  if (opts.mountHost && opts.mountTarget) {
    binds.push(`${opts.mountHost}:${opts.mountTarget}`);
  }

  const envVars = _parseEnvFile(opts.envFile);

  const container: Dockerode.Container = await (docker.createContainer({
    Image: opts.tag,
    name: opts.name,
    AttachStdin: !opts.detach,
    AttachStdout: !opts.detach,
    AttachStderr: !opts.detach,
    OpenStdin: !opts.detach,
    Tty: !opts.detach,
    WorkingDir: opts.workdir ?? '/home/mongo/demo',
    Env: envVars,
    Labels: {
      'mongostage': 'true',
      'mongostage-slug': opts.slug,
    },
    HostConfig: {
      Binds: binds,
      PortBindings: Object.fromEntries(
        (opts.ports ?? []).map(p => {
          const [host, cont] = p.split(':');
          return [`${cont}/tcp`, [{ HostPort: host }]];
        })
      ),
    },
  }) as Promise<Dockerode.Container>);

  if (opts.detach) {
    await container.start({});
  } else {
    // Dockerode attach returns a duplex Modem stream; NodeJS.ReadWriteStream is the closest type
    const stream = await container.attach({ stream: true, stdin: true, stdout: true, stderr: true }) as NodeJS.ReadWriteStream;
    process.stdin.pipe(stream);
    await container.start({});
    await container.wait();
    process.stdin.unpipe(stream);
  }

  return container;
}

export async function stopContainer(nameOrId: string): Promise<void> {
  try {
    const docker = getDockerClient();
    const container = docker.getContainer(nameOrId);
    await container.stop();
  } catch (err: unknown) {
    // Dockerode wraps HTTP errors; 304 (not modified = already stopped) and
    // ECONNRESET from a container that stops mid-request are expected non-errors
    if (err instanceof Error) {
      const statusCode = (err as NodeJS.ErrnoException & { statusCode?: number }).statusCode;
      if (statusCode === 304) return;
      if (err.message.includes('not running')) return;
    }
    throw err;
  }
}

export async function startContainer(nameOrId: string): Promise<void> {
  const docker = getDockerClient();
  const container = docker.getContainer(nameOrId);
  await container.start();
}

export async function removeContainer(nameOrId: string, force = false): Promise<void> {
  const docker = getDockerClient();
  const container = docker.getContainer(nameOrId);
  await container.remove({ force });
}

export async function listLocalImages(filter?: string): Promise<DockerImage[]> {
  const docker = getDockerClient();
  const filters = filter ? JSON.stringify({ reference: [filter] }) : undefined;
  const images = await docker.listImages({ filters });
  return images.map(img => ({ id: img.Id, repoTags: img.RepoTags ?? [], size: img.Size }));
}

export async function inspectContainer(nameOrId: string): Promise<Dockerode.ContainerInspectInfo> {
  const docker = getDockerClient();
  const container = docker.getContainer(nameOrId);
  return container.inspect();
}

export async function getContainerLogs(nameOrId: string, tail = 20): Promise<string> {
  return new Promise(resolve => {
    const chunks: string[] = [];
    const proc = spawn('docker', ['logs', '--tail', String(tail), nameOrId], { stdio: ['ignore', 'pipe', 'pipe'] });
    proc.stdout?.on('data', (chunk: Buffer) => chunks.push(chunk.toString()));
    proc.stderr?.on('data', (chunk: Buffer) => chunks.push(chunk.toString()));
    proc.on('close', () => resolve(chunks.join('').trim()));
    proc.on('error', () => resolve(''));
  });
}
