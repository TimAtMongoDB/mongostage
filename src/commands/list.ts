import { getImages, filterImagesByCategory } from '../lib/config.js';
import type { ImageConfig } from '../types/image.js';

const VALID_CATEGORIES = ['base', 'shell', 'runtime', 'ai', 'server'] as const;
type ValidCategory = (typeof VALID_CATEGORIES)[number];

const COL_TAG = 44;
const COL_COMPONENTS = 40;
const COL_CATEGORY = 8;

function stripOrg(tag: string): string {
  const colonIdx = tag.lastIndexOf(':');
  if (colonIdx < 0) return tag;
  const slashIdx = tag.lastIndexOf('/', colonIdx);
  if (slashIdx < 0) return tag;
  return tag.slice(slashIdx + 1);
}

function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 3) + '...';
}

function pad(s: string, width: number): string {
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

function renderTable(images: ImageConfig[]): void {
  const header = pad('TAG', COL_TAG) + pad('COMPONENTS', COL_COMPONENTS) + 'CATEGORY';
  console.log(header);

  for (const img of images) {
    const tag = pad(truncate(stripOrg(img.tag), COL_TAG - 1), COL_TAG);
    const components = pad(truncate(img.components.join(', '), COL_COMPONENTS - 1), COL_COMPONENTS);
    console.log(`${tag}${components}${img.category}`);
  }
}

export async function listCommand(opts: { filter?: string; all?: boolean }): Promise<void> {
  if (opts.filter !== undefined) {
    if (!(VALID_CATEGORIES as readonly string[]).includes(opts.filter)) {
      console.error(
        `Invalid category: ${opts.filter}\nValid categories: ${VALID_CATEGORIES.join(', ')}`
      );
      process.exit(1);
    }

    const images = filterImagesByCategory(opts.filter);
    if (images.length === 0) {
      console.log(`No images found for category: ${opts.filter}`);
      return;
    }
    renderTable(images);
    return;
  }

  const images = getImages();
  renderTable(images);
}
