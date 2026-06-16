import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const MOCK_IMAGES = [
  { tag: 'timatmongodb/mongo-docker:base', components: ['base'], description: 'Base image', category: 'base' as const },
  { tag: 'timatmongodb/mongo-docker:node-shell-claude', components: ['base', 'shell', 'node', 'claude'], description: 'AI dev', category: 'ai' as const },
  { tag: 'timatmongodb/mongo-docker:server', components: ['base', 'server'], description: 'Server', category: 'server' as const },
];

vi.mock('../../src/lib/config.js', () => ({
  getImages: () => MOCK_IMAGES,
  filterImagesByCategory: (cat: string) => MOCK_IMAGES.filter(i => i.category === cat),
}));

describe('listCommand()', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should print all images when no filter is provided', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { listCommand } = await import('../../src/commands/list.js');
    await listCommand({});

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('mongo-docker:base');
    expect(output).toContain('mongo-docker:node-shell-claude');
    expect(output).toContain('mongo-docker:server');
  });

  it('should strip org prefix from tags in output', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { listCommand } = await import('../../src/commands/list.js');
    await listCommand({});

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).not.toContain('timatmongodb/');
    expect(output).toContain('mongo-docker:base');
  });

  it('should filter images by category when --filter is provided', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { listCommand } = await import('../../src/commands/list.js');
    await listCommand({ filter: 'ai' });

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('node-shell-claude');
    expect(output).not.toContain('mongo-docker:base');
    expect(output).not.toContain('mongo-docker:server');
  });

  it('should exit 1 for an invalid category', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit called'); });
    const { listCommand } = await import('../../src/commands/list.js');

    await expect(listCommand({ filter: 'invalid-xyz' })).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should show "no images found" when filter matches nothing', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { listCommand } = await import('../../src/commands/list.js');
    await listCommand({ filter: 'runtime' }); // MOCK_IMAGES has no runtime category

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('No images found for category: runtime');
  });

  it('should print a header row with TAG, COMPONENTS, CATEGORY', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { listCommand } = await import('../../src/commands/list.js');
    await listCommand({});

    const header = consoleSpy.mock.calls[0][0] as string;
    expect(header).toContain('TAG');
    expect(header).toContain('COMPONENTS');
    expect(header).toContain('CATEGORY');
  });
});
