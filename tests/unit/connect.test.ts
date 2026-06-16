import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/lib/docker.js', () => ({
  detectDockerState: vi.fn(),
  pullImage: vi.fn(),
  runContainer: vi.fn(),
  stopContainer: vi.fn(),
  startContainer: vi.fn(),
  removeContainer: vi.fn(),
  getDockerClient: vi.fn(),
}));

vi.mock('../../src/lib/containers.js', () => ({
  getContainerName: (slug: string) => `mongo-docker-${slug}`,
  getSlugFromTag: (tag: string) => tag.split(':')[1] ?? tag,
  findContainerBySlug: vi.fn(() => undefined),
}));

vi.mock('../../src/lib/config.js', () => ({
  getImages: vi.fn(() => [
    { tag: 'timatmongodb/mongo-docker:node-shell-claude', components: ['base', 'claude'], description: 'AI shell', category: 'ai' },
  ]),
  getImageBySlug: vi.fn((slug: string) =>
    slug === 'node-shell-claude' || slug === 'timatmongodb/mongo-docker:node-shell-claude'
      ? { tag: 'timatmongodb/mongo-docker:node-shell-claude', components: ['base', 'claude'], description: 'AI shell', category: 'ai' }
      : undefined
  ),
}));

vi.mock('../../src/lib/os.js', () => ({
  detectPlatform: vi.fn(() => 'linux'),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => ''),
}));

describe('connectCommand() — error paths', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    // Reset docker state mock to 'running' by default
    const { detectDockerState } = await import('../../src/lib/docker.js');
    vi.mocked(detectDockerState).mockResolvedValue('running');
    const { existsSync } = await import('node:fs');
    vi.mocked(existsSync).mockReturnValue(false);
    const { detectPlatform } = await import('../../src/lib/os.js');
    vi.mocked(detectPlatform).mockReturnValue('linux');
  });

  it('should exit 1 when Docker is not running', async () => {
    const { detectDockerState } = await import('../../src/lib/docker.js');
    vi.mocked(detectDockerState).mockResolvedValue('not-running');

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit called'); });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { connectCommand } = await import('../../src/commands/connect.js');
    await expect(connectCommand('node-shell-claude', {})).rejects.toThrow('process.exit called');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(consoleSpy.mock.calls.join('')).toContain('Docker is not running');
  });

  it('should exit 1 for an unknown image slug', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit called'); });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { connectCommand } = await import('../../src/commands/connect.js');
    await expect(connectCommand('totally-unknown-slug-xyz', {})).rejects.toThrow('process.exit called');

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit 1 when MONGO_MOUNT is a Windows path on WSL2', async () => {
    const { detectPlatform } = await import('../../src/lib/os.js');
    vi.mocked(detectPlatform).mockReturnValue('wsl2');

    const { existsSync, readFileSync } = await import('node:fs');
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('MONGO_MOUNT=C:\\Users\\demo\n');

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit called'); });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { connectCommand } = await import('../../src/commands/connect.js');
    await expect(connectCommand('node-shell-claude', {})).rejects.toThrow('process.exit called');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(consoleSpy.mock.calls.join('')).toContain('MONGO_MOUNT must be a WSL2 path');
  });

  it('should resolve full tag from a short slug', async () => {
    const { getImageBySlug } = await import('../../src/lib/config.js');
    // Mock to return a valid image for node-shell-claude
    const img = vi.mocked(getImageBySlug)('node-shell-claude');
    expect(img).toBeDefined();
    expect(img?.tag).toBe('timatmongodb/mongo-docker:node-shell-claude');
  });
});
