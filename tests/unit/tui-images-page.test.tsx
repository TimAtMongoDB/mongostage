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

const SAMPLE_IMAGES: ImageConfig[] = [
  { tag: 'timatmongodb/mongostage:base', components: ['base'], description: 'Base Ubuntu image', category: 'base' },
  { tag: 'timatmongodb/mongostage:shell', components: ['base', 'shell'], description: 'Ubuntu + shell tools', category: 'shell' },
  { tag: 'timatmongodb/mongostage:node', components: ['base', 'shell', 'node'], description: 'Ubuntu + Node.js', category: 'runtime' },
  { tag: 'timatmongodb/mongostage:node-shell-claude', components: ['base', 'shell', 'node', 'claude'], description: 'Ubuntu + Node + Claude', category: 'ai' },
  { tag: 'timatmongodb/mongostage:server-node', components: ['base', 'shell', 'node', 'server'], description: 'Node.js server image', category: 'server' },
];

async function renderImagesPage(opts: {
  images?: ImageConfig[];
  mongoMount?: string;
  mongoWorkdir?: string;
} = {}) {
  const React = (await import('react')).default;
  const { render } = await import('ink');
  const { ImagesPage } = await import('../../src/tui/images/ImagesPage.js');

  const writes: string[] = [];
  const stdout = {
    write: (chunk: string | Buffer) => { writes.push(chunk.toString()); return true; },
    columns: 120,
    rows: 40,
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
  const onLaunch = vi.fn();
  const footerHint = vi.fn();

  if (opts.mongoMount) process.env['MONGO_MOUNT'] = opts.mongoMount;
  else delete process.env['MONGO_MOUNT'];
  if (opts.mongoWorkdir) process.env['MONGO_WORKDIR'] = opts.mongoWorkdir;
  else delete process.env['MONGO_WORKDIR'];

  const instance = render(
    React.createElement(ImagesPage, {
      images: opts.images ?? SAMPLE_IMAGES,
      onLaunch,
      footerHint,
    }),
    {
      stdout: stdout as unknown as NodeJS.WriteStream,
      stdin: stdin as unknown as NodeJS.ReadStream,
      debug: true,
    },
  );

  await new Promise(r => setTimeout(r, 20));

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

  async function typeChar(char: string) {
    stdin.push(char);
    await new Promise(r => setTimeout(r, 30));
  }

  return { instance, lastFrame, pressKey, typeChar, onLaunch, footerHint };
}

describe('ImagesPage', () => {
  describe('initial render', () => {
    it('should render all images by default (All filter active)', async () => {
      const { lastFrame, instance } = await renderImagesPage();
      const frame = lastFrame();
      // All filter active = shows all images including shell category
      expect(frame).toContain('base');
      expect(frame).toContain('shell');
      expect(frame).toContain('node');
      instance.unmount();
    });

    it('should show filter tabs: All, Base, Runtime, AI, Server', async () => {
      const { lastFrame, instance } = await renderImagesPage();
      const frame = lastFrame();
      expect(frame).toContain('All');
      expect(frame).toContain('Base');
      expect(frame).toContain('Runtime');
      expect(frame).toContain('AI');
      expect(frame).toContain('Server');
      instance.unmount();
    });

    it('should NOT show a Shell filter tab', async () => {
      const { lastFrame, instance } = await renderImagesPage();
      const frame = lastFrame();
      // The word 'shell' may appear in image names, but not as a standalone [ Shell ] filter tab
      expect(frame).not.toMatch(/\[ Shell \]/);
      instance.unmount();
    });

    it('should call footerHint with the correct hint string on mount', async () => {
      const { footerHint, instance } = await renderImagesPage();
      expect(footerHint).toHaveBeenCalledWith(
        '↑↓ navigate   ←→ filter   Enter launch   Esc quit',
      );
      instance.unmount();
    });

    it('should select the first image by default', async () => {
      const { lastFrame, instance } = await renderImagesPage();
      const frame = lastFrame();
      // First image (base) should have ▶ prefix
      expect(frame).toContain('▶');
      instance.unmount();
    });
  });

  describe('navigation', () => {
    it('should move selection down on ↓ key', async () => {
      const { lastFrame, pressKey, instance } = await renderImagesPage();
      await pressKey('\x1b[B'); // down arrow
      const frame = lastFrame();
      // Second image (shell) should now be selected
      expect(frame).toContain('▶');
      instance.unmount();
    });

    it('should move selection up on ↑ key', async () => {
      const { lastFrame, pressKey, instance } = await renderImagesPage();
      await pressKey('\x1b[B'); // down
      await pressKey('\x1b[A'); // up
      const frame = lastFrame();
      // Should be back to first image
      expect(frame).toContain('▶');
      expect(frame).toContain('base');
      instance.unmount();
    });

    it('should highlight selected image with ▶ prefix', async () => {
      const { lastFrame, instance } = await renderImagesPage();
      const frame = lastFrame();
      expect(frame).toContain('▶');
      instance.unmount();
    });
  });

  describe('filter tabs', () => {
    it('should activate Base filter on → key', async () => {
      const { lastFrame, pressKey, instance } = await renderImagesPage();
      await pressKey('\x1b[C'); // right arrow
      const frame = lastFrame();
      // Base filter active - only base images shown
      expect(frame).toContain('base');
      instance.unmount();
    });

    it('should cycle back to All on ← key from All filter', async () => {
      const { lastFrame, pressKey, instance } = await renderImagesPage();
      await pressKey('\x1b[D'); // left arrow from All wraps to Server
      const frame = lastFrame();
      expect(frame).toContain('server-node');
      instance.unmount();
    });

    it('should reset selection to index 0 when filter changes', async () => {
      const { lastFrame, pressKey, instance } = await renderImagesPage();
      await pressKey('\x1b[B'); // move down first
      await pressKey('\x1b[C'); // change filter
      const frame = lastFrame();
      // Selection index reset to 0 — ▶ should appear on first item
      expect(frame).toContain('▶');
      instance.unmount();
    });

    it('should show only ai-category images when AI filter is active', async () => {
      const { lastFrame, pressKey, instance } = await renderImagesPage();
      // Cycle to AI: All → Base → Runtime → AI (3 rights)
      await pressKey('\x1b[C');
      await pressKey('\x1b[C');
      await pressKey('\x1b[C');
      const frame = lastFrame();
      expect(frame).toContain('node-shell-claude');
      expect(frame).not.toContain('base\n');
      instance.unmount();
    });

    it('should show all images (including shell category) when All filter is active', async () => {
      const { lastFrame, instance } = await renderImagesPage();
      const frame = lastFrame();
      expect(frame).toContain('shell');
      instance.unmount();
    });

    it('should show "No images found" when filter has no matches', async () => {
      const { lastFrame, pressKey, instance } = await renderImagesPage({
        images: [{ tag: 'timatmongodb/mongostage:base', components: ['base'], description: 'Base', category: 'base' }],
      });
      // Cycle to Runtime — no runtime images exist
      await pressKey('\x1b[C'); // Base
      await pressKey('\x1b[C'); // Runtime
      const frame = lastFrame();
      expect(frame).toContain('No images found');
      instance.unmount();
    });
  });

  describe('text search', () => {
    it('should filter images in real-time as characters are typed', async () => {
      const { lastFrame, typeChar, instance } = await renderImagesPage();
      await typeChar('claude');
      const frame = lastFrame();
      expect(frame).toContain('node-shell-claude');
      // Other non-matching images should not appear
      expect(frame).not.toContain('▶ base');
      instance.unmount();
    });

    it('should be case-insensitive', async () => {
      const { lastFrame, typeChar, instance } = await renderImagesPage();
      await typeChar('C');
      await typeChar('l');
      await typeChar('a');
      await typeChar('u');
      await typeChar('d');
      await typeChar('e');
      const frame = lastFrame();
      expect(frame).toContain('node-shell-claude');
      instance.unmount();
    });

    it('should not treat arrow keys as search characters', async () => {
      const { lastFrame, pressKey, instance } = await renderImagesPage();
      await pressKey('\x1b[B'); // down arrow
      const frame = lastFrame();
      // All images should still be visible (arrow moved selection, not searched)
      expect(frame).toContain('base');
      expect(frame).toContain('shell');
      instance.unmount();
    });
  });

  describe('image detail panel', () => {
    it('should show tag slug in detail panel for selected image', async () => {
      const { lastFrame, instance } = await renderImagesPage();
      const frame = lastFrame();
      expect(frame).toContain('base'); // slug from timatmongodb/mongostage:base
      instance.unmount();
    });

    it('should show description in detail panel', async () => {
      const { lastFrame, instance } = await renderImagesPage();
      const frame = lastFrame();
      expect(frame).toContain('Base Ubuntu image');
      instance.unmount();
    });

    it('should show components list in detail panel', async () => {
      const { lastFrame, instance } = await renderImagesPage();
      const frame = lastFrame();
      expect(frame).toContain('base'); // component list
      instance.unmount();
    });

    it('should show full Docker Hub tag in detail panel', async () => {
      const { lastFrame, instance } = await renderImagesPage();
      const frame = lastFrame();
      expect(frame).toContain('timatmongodb/mongostage:base');
      instance.unmount();
    });
  });

  describe('MONGO_MOUNT env var', () => {
    it('should show Mount line when MONGO_MOUNT is set', async () => {
      const { lastFrame, instance } = await renderImagesPage({ mongoMount: '/home/user/myproject' });
      const frame = lastFrame();
      expect(frame).toContain('Mount');
      expect(frame).toContain('myproject');
      instance.unmount();
    });

    it('should hide Mount line when MONGO_MOUNT is not set', async () => {
      const { lastFrame, instance } = await renderImagesPage();
      const frame = lastFrame();
      expect(frame).not.toContain('Mount');
      instance.unmount();
    });
  });

  describe('Enter key', () => {
    it('should call onLaunch with the selected image on Enter', async () => {
      const { pressKey, onLaunch, instance } = await renderImagesPage();
      await pressKey('\r'); // Enter
      expect(onLaunch).toHaveBeenCalledWith(SAMPLE_IMAGES[0]);
      instance.unmount();
    });
  });
});
