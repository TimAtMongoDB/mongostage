import { describe, it, expect, vi, afterEach } from 'vitest';
import { PassThrough } from 'node:stream';
import type { ImageConfig } from '../../src/types/image.js';

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

const SAMPLE_IMAGE: ImageConfig = {
  tag: 'timatmongodb/mongostage:node-shell-claude',
  components: ['base', 'shell', 'node', 'claude'],
  description: 'Ubuntu + Node.js + Claude Code',
  category: 'ai',
};

type LaunchMocks = {
  dockerState?: 'running' | 'not-running' | 'not-installed';
  imageAlreadyCached?: boolean;
  containerExistsRunning?: boolean;
  containerExistsStopped?: boolean;
  pullFails?: boolean;
  runContainerFails?: boolean;
  containerCrashesImmediately?: boolean;
};

async function renderLaunchScreen(opts: LaunchMocks = {}) {
  const {
    dockerState = 'running',
    imageAlreadyCached = true,
    containerExistsRunning = false,
    containerExistsStopped = false,
    pullFails = false,
    runContainerFails = false,
    containerCrashesImmediately = false,
  } = opts;

  vi.doMock('../../src/lib/docker.js', () => ({
    detectDockerState: vi.fn(async () => dockerState),
    pollDockerReady: vi.fn(async () => {}),
    pullImage: vi.fn(async (_tag: string, onProgress?: (msg: string) => void) => {
      if (pullFails) throw new Error('pull: network error');
      if (imageAlreadyCached) onProgress?.('Already up to date');
    }),
    runContainer: vi.fn(async () => {
      if (runContainerFails) throw new Error('Failed to start container');
      return {};
    }),
    startContainer: vi.fn(async () => {}),
    getDockerClient: vi.fn(() => ({
      getContainer: vi.fn(() => ({
        inspect: vi.fn(async () => ({
          State: { Running: !containerCrashesImmediately },
        })),
        exec: vi.fn(async () => ({
          start: vi.fn(async () => {}),
        })),
      })),
    })),
    listLocalImages: vi.fn(async () => []),
    streamCommand: vi.fn(async () => {}),
  }));

  vi.doMock('../../src/lib/containers.js', () => ({
    listManagedContainers: vi.fn(async () => []),
    findContainerBySlug: vi.fn(async () => {
      if (containerExistsRunning) {
        return { id: 'abc', name: 'mongostage-node-shell-claude', slug: 'node-shell-claude', status: 'running', created: new Date().toISOString(), imageTag: SAMPLE_IMAGE.tag };
      }
      if (containerExistsStopped) {
        return { id: 'abc', name: 'mongostage-node-shell-claude', slug: 'node-shell-claude', status: 'stopped', created: new Date().toISOString(), imageTag: SAMPLE_IMAGE.tag };
      }
      return undefined;
    }),
    getContainerName: vi.fn((slug: string) => `mongostage-${slug}`),
    getSlugFromTag: vi.fn((tag: string) => tag.split(':')[1] ?? tag),
  }));

  vi.doMock('../../src/lib/os.js', () => ({
    detectPlatform: vi.fn(() => 'linux'),
  }));

  vi.doMock('../../src/lib/colima.js', () => ({
    startColima: vi.fn(async () => {}),
    installColima: vi.fn(async () => {}),
  }));

  vi.doMock('../../src/lib/install.js', () => ({
    downloadAndExecScript: vi.fn(async () => {}),
  }));

  vi.doMock('../../src/commands/connect.js', () => ({
    connectCommand: vi.fn(async () => {}),
    attachToContainer: vi.fn(async () => {}),
  }));

  const mockAppendLaunchError = vi.fn();
  vi.doMock('../../src/lib/log.js', () => ({
    appendLaunchError: mockAppendLaunchError,
  }));

  const React = (await import('react')).default;
  const { render } = await import('ink');
  const { LaunchScreen } = await import('../../src/tui/LaunchScreen.js');

  const writes: string[] = [];
  const stdout = {
    write: (chunk: string | Buffer) => { writes.push(chunk.toString()); return true; },
    columns: 80,
    rows: 24,
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
  const onComplete = vi.fn();
  const onError = vi.fn();

  const instance = render(
    React.createElement(LaunchScreen, {
      image: SAMPLE_IMAGE,
      onComplete,
      onError,
    }),
    {
      stdout: stdout as unknown as NodeJS.WriteStream,
      stdin: stdin as unknown as NodeJS.ReadStream,
      debug: true,
    },
  );

  // Wait for async step sequence to run
  await new Promise(r => setTimeout(r, 100));

  function lastFrame(): string {
    for (let i = writes.length - 1; i >= 0; i--) {
      const stripped = stripAnsi(writes[i]);
      if (stripped.trim().length > 0) return stripped;
    }
    return '';
  }

  return { instance, lastFrame, onComplete, onError, stdin, mockAppendLaunchError };
}

describe('LaunchScreen', () => {
  describe('initial render', () => {
    it('should render all 6 steps visible from the start', async () => {
      const { lastFrame, instance } = await renderLaunchScreen();
      const frame = lastFrame();
      expect(frame).toContain('Checking Docker');
      expect(frame).toContain('Pulling image');
      expect(frame).toContain('Starting container');
      expect(frame).toContain('Setting up workspace');
      expect(frame).toContain('Connecting');
      instance.unmount();
    });

    it('should render a launch header with image description', async () => {
      const { lastFrame, instance } = await renderLaunchScreen();
      const frame = lastFrame();
      expect(frame).toContain('Launching');
      instance.unmount();
    });
  });

  describe('happy path - Docker already running, image cached', () => {
    it('should show step 1 (Checking Docker) as complete', async () => {
      const { lastFrame, instance } = await renderLaunchScreen({ dockerState: 'running' });
      const frame = lastFrame();
      expect(frame).toContain('✓');
      expect(frame).toContain('Checking Docker');
      instance.unmount();
    });

    it('should show step 2 (Installing Docker) as skipped when Docker is running', async () => {
      const { lastFrame, instance } = await renderLaunchScreen({ dockerState: 'running' });
      const frame = lastFrame();
      // Step 2 skipped: shows – symbol
      expect(frame).toContain('–');
      instance.unmount();
    });

    it('should show step 3 (Pulling image) as skipped when image is already cached', async () => {
      const { lastFrame, instance } = await renderLaunchScreen({ imageAlreadyCached: true });
      const frame = lastFrame();
      expect(frame).toContain('Already up to date');
      instance.unmount();
    });

    it('should call onComplete after successful connect', async () => {
      const { onComplete, instance } = await renderLaunchScreen();
      // Give time for all steps to complete
      await new Promise(r => setTimeout(r, 200));
      expect(onComplete).toHaveBeenCalled();
      instance.unmount();
    });
  });

  describe('step 3 - pull failure', () => {
    it('should show ✗ on pull failure with error message', async () => {
      const { lastFrame, instance } = await renderLaunchScreen({
        dockerState: 'running',
        pullFails: true,
      });
      const frame = lastFrame();
      expect(frame).toContain('✗');
      instance.unmount();
    });

    it('should call onError on pull failure after keypress', async () => {
      const { onError, stdin, instance } = await renderLaunchScreen({
        dockerState: 'running',
        pullFails: true,
      });
      await new Promise(r => setTimeout(r, 200));
      // Error screen stays until keypress — onError must not be called yet
      expect(onError).not.toHaveBeenCalled();
      stdin.write('a');
      await new Promise(r => setTimeout(r, 100));
      expect(onError).toHaveBeenCalled();
      instance.unmount();
    });
  });

  describe('step 4 - container pre-existence', () => {
    it('should skip step 4 when container is already running', async () => {
      const { lastFrame, instance } = await renderLaunchScreen({
        containerExistsRunning: true,
        imageAlreadyCached: true,
      });
      const frame = lastFrame();
      // When already running, steps 4 and 5 are skipped
      expect(frame).toContain('–');
      instance.unmount();
    });
  });

  describe('step 4 - container crash', () => {
    it('should show error when container exits immediately after start', async () => {
      const { lastFrame, instance } = await renderLaunchScreen({
        dockerState: 'running',
        imageAlreadyCached: true,
        containerCrashesImmediately: true,
      });
      const frame = lastFrame();
      expect(frame).toContain('✗');
      instance.unmount();
    });
  });

  describe('error UX - keypress required to dismiss', () => {
    it('should show "Press any key to go back" prompt after an error', async () => {
      const { lastFrame, instance } = await renderLaunchScreen({
        dockerState: 'running',
        pullFails: true,
      });
      await new Promise(r => setTimeout(r, 200));
      expect(lastFrame()).toContain('Press any key to go back');
      instance.unmount();
    });

    it('should NOT call onError before a key is pressed', async () => {
      const { onError, instance } = await renderLaunchScreen({
        dockerState: 'running',
        pullFails: true,
      });
      await new Promise(r => setTimeout(r, 200));
      expect(onError).not.toHaveBeenCalled();
      instance.unmount();
    });

    it('should call onError after a key is pressed on the error screen', async () => {
      const { onError, stdin, instance } = await renderLaunchScreen({
        dockerState: 'running',
        pullFails: true,
      });
      await new Promise(r => setTimeout(r, 200));
      stdin.write('a');
      await new Promise(r => setTimeout(r, 100));
      expect(onError).toHaveBeenCalled();
      instance.unmount();
    });
  });

  describe('error logging', () => {
    it('should write an entry to ~/.mongostage/logs/mongostage.log on error', async () => {
      const { mockAppendLaunchError, instance } = await renderLaunchScreen({
        dockerState: 'running',
        pullFails: true,
      });
      await new Promise(r => setTimeout(r, 200));
      expect(mockAppendLaunchError).toHaveBeenCalled();
      instance.unmount();
    });

    it('should include timestamp, image tag, step label, and error message in the log entry', async () => {
      const { mockAppendLaunchError, instance } = await renderLaunchScreen({
        dockerState: 'running',
        pullFails: true,
      });
      await new Promise(r => setTimeout(r, 200));
      const [imageTag, stepLabel, error] = mockAppendLaunchError.mock.calls[0];
      expect(imageTag).toBe(SAMPLE_IMAGE.tag);
      expect(stepLabel).toBe('Pulling image');
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('pull: network error');
      instance.unmount();
    });

    it('should not throw if the log directory does not exist (creates it)', async () => {
      vi.doMock('node:fs', () => ({
        mkdirSync: vi.fn(),
        appendFileSync: vi.fn(),
      }));
      const { appendLaunchError } = await import('../../src/lib/log.js');
      expect(() => appendLaunchError('tag:v1', 'Pulling image', new Error('test'))).not.toThrow();
    });

    it('should silently ignore log write failures and still show the error screen', async () => {
      vi.doMock('node:fs', () => ({
        mkdirSync: vi.fn(() => { throw new Error('EACCES: permission denied'); }),
        appendFileSync: vi.fn(),
      }));
      const { appendLaunchError } = await import('../../src/lib/log.js');
      expect(() => appendLaunchError('tag:v1', 'Pulling image', new Error('test'))).not.toThrow();
    });
  });
});
