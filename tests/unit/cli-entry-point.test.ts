import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const BIN = resolve(__dirname, '../../dist/index.js');

describe('createProgram()', () => {
  it('should export a createProgram function', async () => {
    const mod = await import('../../src/index.js');
    expect(typeof mod.createProgram).toBe('function');
  });

  it('should register the connect command', async () => {
    const { createProgram } = await import('../../src/index.js');
    const program = createProgram();
    const names = program.commands.map(c => c.name());
    expect(names).toContain('connect');
  });

  it('should register the list command', async () => {
    const { createProgram } = await import('../../src/index.js');
    const program = createProgram();
    const names = program.commands.map(c => c.name());
    expect(names).toContain('list');
  });

  it('should register the env command', async () => {
    const { createProgram } = await import('../../src/index.js');
    const program = createProgram();
    const names = program.commands.map(c => c.name());
    expect(names).toContain('env');
  });

  it('should register the setup command', async () => {
    const { createProgram } = await import('../../src/index.js');
    const program = createProgram();
    const names = program.commands.map(c => c.name());
    expect(names).toContain('setup');
  });

  it('should register the build command', async () => {
    const { createProgram } = await import('../../src/index.js');
    const program = createProgram();
    const names = program.commands.map(c => c.name());
    expect(names).toContain('build');
  });

  it('should set the program name to mongostage', async () => {
    const { createProgram } = await import('../../src/index.js');
    const program = createProgram();
    expect(program.name()).toBe('mongostage');
  });

  it('should exit with non-zero code for an unknown subcommand', () => {
    const result = spawnSync('node', [BIN, 'totally-unknown-xyz'], { encoding: 'utf8' });
    expect(result.status).not.toBe(0);
  });
});
