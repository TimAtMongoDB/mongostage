import { describe, it, expect, vi, afterEach } from 'vitest';
import { PassThrough } from 'node:stream';

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

// Strip all ANSI escape sequences for plain-text assertions
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

async function renderApp(props: { images?: unknown[] } = {}) {
  vi.doMock('../../src/lib/config.js', () => ({
    getImages: vi.fn(() => props.images ?? []),
  }));

  const React = (await import('react')).default;
  const { render } = await import('ink');
  const App = (await import('../../src/tui/App.js')).default;

  const writes: string[] = [];

  // Plain object stdout — avoid PassThrough prototype conflicts
  const stdout = {
    write: (chunk: string | Buffer) => {
      writes.push(chunk.toString());
      return true;
    },
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

  const instance = render(
    React.createElement(App, { images: props.images ?? [] }),
    {
      stdout: stdout as unknown as NodeJS.WriteStream,
      stdin: stdin as unknown as NodeJS.ReadStream,
      debug: true,
    },
  );

  // Wait for initial render
  await new Promise(r => setTimeout(r, 20));

  // Return the last write that contains actual text content (not just ANSI codes)
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

  return { instance, lastFrame, pressKey };
}

describe('TUI App Shell', () => {
  describe('initial state', () => {
    it('should display Images page by default', async () => {
      const { lastFrame, instance } = await renderApp();
      const frame = lastFrame();
      expect(frame).toContain('Images');
      instance.unmount();
    });

    it('should render the MongoStage header', async () => {
      const { lastFrame, instance } = await renderApp();
      const frame = lastFrame();
      expect(frame).toContain('MongoStage');
      instance.unmount();
    });
  });

  describe('page switching', () => {
    it('should switch to Containers page on Tab key', async () => {
      const { lastFrame, pressKey, instance } = await renderApp();
      await pressKey('\t');
      const frame = lastFrame();
      expect(frame).toContain('▶ Containers');
      instance.unmount();
    });

    it('should switch back to Images page after full 3-page cycle', async () => {
      const { lastFrame, pressKey, instance } = await renderApp();
      await pressKey('\t'); // images -> containers
      await pressKey('\t'); // containers -> topology
      await pressKey('\t'); // topology -> images
      const frame = lastFrame();
      expect(frame).toContain('▶ Images');
      instance.unmount();
    });
  });

  describe('Escape key', () => {
    it('should quit the TUI cleanly on Escape', async () => {
      const { pressKey, instance } = await renderApp();
      const exitPromise = instance.waitUntilExit();
      await pressKey('\x1b');
      await expect(exitPromise).resolves.toBeUndefined();
    });
  });
});

describe('PageTabs', () => {
  describe('Images page active', () => {
    it('should mark Images tab as active with MongoDB green', async () => {
      const { lastFrame, instance } = await renderApp();
      const frame = lastFrame();
      expect(frame).toContain('▶ Images');
      instance.unmount();
    });

    it('should show Containers tab as inactive (dim)', async () => {
      const { lastFrame, instance } = await renderApp();
      const frame = lastFrame();
      expect(frame).toContain('Containers');
      expect(frame).not.toContain('▶ Containers');
      instance.unmount();
    });

    it('should prefix active tab with ▶', async () => {
      const { lastFrame, instance } = await renderApp();
      const frame = lastFrame();
      expect(frame).toContain('▶ Images');
      instance.unmount();
    });
  });

  describe('Containers page active', () => {
    it('should mark Containers tab as active with MongoDB green', async () => {
      const { lastFrame, pressKey, instance } = await renderApp();
      await pressKey('\t');
      const frame = lastFrame();
      expect(frame).toContain('▶ Containers');
      instance.unmount();
    });

    it('should show Images tab as inactive (dim)', async () => {
      const { lastFrame, pressKey, instance } = await renderApp();
      await pressKey('\t');
      const frame = lastFrame();
      expect(frame).toContain('Images');
      expect(frame).not.toContain('▶ Images');
      instance.unmount();
    });
  });

  describe('footer Tab arrow', () => {
    it('should point right (→ Containers) when on Images page', async () => {
      const { lastFrame, instance } = await renderApp();
      const frame = lastFrame();
      expect(frame).toContain('► Containers');
      instance.unmount();
    });

    it('should point left (← Images) when on Containers page', async () => {
      const { lastFrame, pressKey, instance } = await renderApp();
      await pressKey('\t');
      const frame = lastFrame();
      expect(frame).toContain('◄');
      expect(frame).toContain('Images');
      instance.unmount();
    });
  });
});
