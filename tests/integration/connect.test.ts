/**
 * Integration tests for connect-command — requires Docker running.
 * Run with: pnpm vitest run tests/integration
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const BIN = resolve(__dirname, '../../dist/index.js');

// Clean up test containers after each test
afterEach(async () => {
  const { findContainerBySlug, listManagedContainers } = await import('../../src/lib/containers.js');
  const { removeContainer, stopContainer } = await import('../../src/lib/docker.js');
  const containers = await listManagedContainers().catch(() => []);
  for (const c of containers.filter(c => c.slug.includes('test'))) {
    await stopContainer(c.id).catch(() => undefined);
    await removeContainer(c.id, true).catch(() => undefined);
  }
  void findContainerBySlug; // unused but typed
});

describe('connect command integration', () => {
  it.skip('should pull and attach to a running container — requires Docker', async () => {
    expect.fail('Not implemented — MDD skeleton. Run manually: mongo-docker connect node-shell-claude');
  });

  it.skip('should attach to existing running container without pulling again — requires Docker', async () => {
    expect.fail('Not implemented — MDD skeleton');
  });

  it.skip('--fresh should stop and remove existing container before creating new — requires Docker', async () => {
    expect.fail('Not implemented — MDD skeleton');
  });

  it('should print help and exit 0 with --help flag', () => {
    const result = spawnSync('node', [BIN, 'connect', '--help'], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('connect');
  });
});
