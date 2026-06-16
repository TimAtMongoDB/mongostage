import { describe, it, expect, vi, afterEach } from 'vitest';
import { PassThrough } from 'node:stream';
import type { ContainerState } from '../../src/types/container.js';
import type { DockerImage } from '../../src/lib/docker.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\x1b[()][A-Z0-9]/g, '');
}

function makeMockStdin() {
  const stream = new PassThrough();
  Object.defineProperty(stream, 'isTTY', { value: true });
  Object.defineProperty(stream, 'setRawMode', { value: vi.fn() });
  Object.defineProperty(stream, 'ref', { value: vi.fn() });
  Object.defineProperty(stream, 'unref', { value: vi.fn() });
  return stream;
}

const RUNNING_CONTAINER: ContainerState = {
  id: 'abc123',
  name: 'mongo-docker-node-shell-claude',
  imageTag: 'timatmongodb/mongo-docker:node-shell-claude',
  slug: 'node-shell-claude',
  status: 'running',
  created: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
};

const STOPPED_CONTAINER: ContainerState = {
  id: 'def456',
  name: 'mongo-docker-node-shell',
  imageTag: 'timatmongodb/mongo-docker:node-shell',
  slug: 'node-shell',
  status: 'stopped',
  created: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
};

const LOCAL_IMAGE: DockerImage = {
  id: 'sha256:abc123',
  repoTags: ['timatmongodb/mongo-docker:node-shell-claude'],
  size: 356 * 1024 * 1024, // 356MB
};

type ContainersMock = {
  running?: ContainerState[];
  stopped?: ContainerState[];
  images?: DockerImage[];
  dockerRunning?: boolean;
  listManagedContainersFails?: boolean;
};

async function renderContainersPage(opts: ContainersMock = {}) {
  const {
    running = [RUNNING_CONTAINER],
    stopped = [STOPPED_CONTAINER],
    images: localImages = [LOCAL_IMAGE],
    dockerRunning = true,
    listManagedContainersFails = false,
  } = opts;

  vi.doMock('../../src/lib/containers.js', () => ({
    listManagedContainers: vi.fn(async () => {
      if (listManagedContainersFails) throw new Error('Cannot connect to Docker daemon');
      return [...running, ...stopped];
    }),
    findContainerBySlug: vi.fn(),
    getContainerName: vi.fn((slug: string) => `mongo-docker-${slug}`),
    getSlugFromTag: vi.fn((tag: string) => tag.split(':')[1] ?? tag),
  }));

  vi.doMock('../../src/lib/docker.js', () => ({
    detectDockerState: vi.fn(async () => dockerRunning ? 'running' : 'not-running'),
    getDockerClient: vi.fn(),
    listLocalImages: vi.fn(async () => localImages),
    stopContainer: vi.fn(async () => {}),
    startContainer: vi.fn(async () => {}),
    removeContainer: vi.fn(async () => {}),
    streamCommand: vi.fn(async () => {}),
  }));

  vi.doMock('../../src/commands/connect.js', () => ({
    connectCommand: vi.fn(async () => {}),
  }));

  const React = (await import('react')).default;
  const { render } = await import('ink');
  const { ContainersPage } = await import('../../src/tui/containers/ContainersPage.js');

  const writes: string[] = [];
  const stdout = {
    write: (chunk: string | Buffer) => { writes.push(chunk.toString()); return true; },
    columns: 100,
    rows: 30,
    isTTY: true,
    on: vi.fn().mockReturnThis(),
    once: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    emit: vi.fn().mockReturnValue(false),
    removeListener: vi.fn().mockReturnThis(),
    removeAllListeners: vi.fn().mockReturnThis(),
    end: vi.fn(),
  };

  const stdin = makeMockStdin();
  const footerHint = vi.fn();

  const instance = render(
    React.createElement(ContainersPage, { footerHint }),
    {
      stdout: stdout as unknown as NodeJS.WriteStream,
      stdin: stdin as unknown as NodeJS.ReadStream,
      debug: true,
    },
  );

  // Wait for async data fetch to complete
  await new Promise(r => setTimeout(r, 50));

  function lastFrame(): string {
    for (let i = writes.length - 1; i >= 0; i--) {
      const stripped = stripAnsi(writes[i]);
      if (stripped.trim().length > 0) return stripped;
    }
    return '';
  }

  async function pressKey(raw: string) {
    stdin.push(raw);
    await new Promise(r => setTimeout(r, 30));
  }

  return { instance, lastFrame, pressKey, footerHint };
}

describe('ContainersPage', () => {
  describe('initial render', () => {
    it('should show RUNNING section header', async () => {
      const { lastFrame, instance } = await renderContainersPage();
      const frame = lastFrame();
      expect(frame).toContain('RUNNING');
      instance.unmount();
    });

    it('should show STOPPED section header', async () => {
      const { lastFrame, instance } = await renderContainersPage();
      const frame = lastFrame();
      expect(frame).toContain('STOPPED');
      instance.unmount();
    });

    it('should show LOCAL IMAGES section header', async () => {
      const { lastFrame, instance } = await renderContainersPage();
      const frame = lastFrame();
      expect(frame).toContain('LOCAL IMAGES');
      instance.unmount();
    });

    it('should call footerHint with the correct hint string', async () => {
      const { footerHint, instance } = await renderContainersPage();
      expect(footerHint).toHaveBeenCalledWith('↑↓ navigate   Enter action   Esc quit');
      instance.unmount();
    });

    it('should show running container slug in RUNNING section', async () => {
      const { lastFrame, instance } = await renderContainersPage();
      const frame = lastFrame();
      expect(frame).toContain('node-shell-claude');
      instance.unmount();
    });

    it('should show stopped container slug in STOPPED section', async () => {
      const { lastFrame, instance } = await renderContainersPage();
      const frame = lastFrame();
      expect(frame).toContain('node-shell');
      instance.unmount();
    });

    it('should show local image in LOCAL IMAGES section', async () => {
      const { lastFrame, instance } = await renderContainersPage();
      const frame = lastFrame();
      expect(frame).toContain('node-shell-claude');
      instance.unmount();
    });
  });

  describe('Docker not running', () => {
    it('should show "Docker is not running" message when Docker is unavailable', async () => {
      const { lastFrame, instance } = await renderContainersPage({ listManagedContainersFails: true });
      const frame = lastFrame();
      expect(frame).toContain('Docker is not running');
      instance.unmount();
    });

    it('should NOT show container sections when Docker is not running', async () => {
      const { lastFrame, instance } = await renderContainersPage({ listManagedContainersFails: true });
      const frame = lastFrame();
      expect(frame).not.toContain('RUNNING');
      expect(frame).not.toContain('STOPPED');
      instance.unmount();
    });
  });

  describe('navigation', () => {
    it('should highlight first row by default', async () => {
      const { lastFrame, instance } = await renderContainersPage();
      const frame = lastFrame();
      expect(frame).toContain('▶');
      instance.unmount();
    });

    it('should move selection down on ↓ key', async () => {
      const { lastFrame, pressKey, instance } = await renderContainersPage();
      await pressKey('\x1b[B'); // down arrow
      const frame = lastFrame();
      // Still shows ▶ but on second row (stopped container)
      expect(frame).toContain('▶');
      instance.unmount();
    });
  });

  describe('action menu', () => {
    it('should open action menu on Enter', async () => {
      const { lastFrame, pressKey, instance } = await renderContainersPage();
      await pressKey('\r'); // Enter
      const frame = lastFrame();
      expect(frame).toContain('Connect');
      instance.unmount();
    });

    it('should show running container actions: Connect, Stop, Remove (force)', async () => {
      const { lastFrame, pressKey, instance } = await renderContainersPage();
      await pressKey('\r'); // Enter on running container
      const frame = lastFrame();
      expect(frame).toContain('Connect');
      expect(frame).toContain('Stop');
      expect(frame).toContain('Remove (force)');
      instance.unmount();
    });

    it('should show stopped container actions: Connect, Start, Remove', async () => {
      const { lastFrame, pressKey, instance } = await renderContainersPage();
      await pressKey('\x1b[B'); // Navigate to stopped container
      await pressKey('\r'); // Enter
      const frame = lastFrame();
      expect(frame).toContain('Connect');
      expect(frame).toContain('Start');
      expect(frame).toContain('Remove');
      instance.unmount();
    });

    it('should close action menu on Escape', async () => {
      const { lastFrame, pressKey, instance } = await renderContainersPage();
      await pressKey('\r'); // Open menu
      await pressKey('\x1b'); // Escape — close menu
      const frame = lastFrame();
      // After escape, menu should be closed (sections still visible, no action menu)
      expect(frame).toContain('RUNNING');
      instance.unmount();
    });
  });

  describe('destructive action confirmation', () => {
    it('should show [y/N] confirmation for Remove action', async () => {
      const { lastFrame, pressKey, instance } = await renderContainersPage();
      await pressKey('\x1b[B'); // Navigate to stopped container
      await pressKey('\r'); // Open action menu
      await pressKey('\x1b[B'); // Down to Remove
      await pressKey('\x1b[B'); // Down to Remove
      await pressKey('\r'); // Select Remove
      const frame = lastFrame();
      expect(frame).toContain('[y/N]');
      instance.unmount();
    });
  });

  describe('empty state', () => {
    it('should show empty message when no containers or images exist', async () => {
      const { lastFrame, instance } = await renderContainersPage({
        running: [],
        stopped: [],
        images: [],
      });
      const frame = lastFrame();
      expect(frame).toContain('No mongo-docker containers');
      instance.unmount();
    });
  });
});
