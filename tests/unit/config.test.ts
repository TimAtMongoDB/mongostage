import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('getImages()', () => {
  it('should return an array of ImageConfig objects', async () => {
    const { getImages } = await import('../../src/lib/config.js');
    const images = getImages();
    expect(Array.isArray(images)).toBe(true);
    expect(images.length).toBeGreaterThan(0);
    expect(images[0]).toHaveProperty('tag');
    expect(images[0]).toHaveProperty('components');
    expect(images[0]).toHaveProperty('category');
  });
});

describe('getImageBySlug()', () => {
  it('should return the correct image for a short slug', async () => {
    const { getImageBySlug } = await import('../../src/lib/config.js');
    const image = getImageBySlug('node-shell-claude');
    expect(image).toBeDefined();
    expect(image?.tag).toContain('node-shell-claude');
  });

  it('should return the correct image for a full tag', async () => {
    const { getImageBySlug } = await import('../../src/lib/config.js');
    const image = getImageBySlug('timatmongodb/mongostage:node-shell-claude');
    expect(image).toBeDefined();
    expect(image?.tag).toBe('timatmongodb/mongostage:node-shell-claude');
  });

  it('should return undefined for an unknown slug', async () => {
    const { getImageBySlug } = await import('../../src/lib/config.js');
    const image = getImageBySlug('does-not-exist-xyz');
    expect(image).toBeUndefined();
  });
});

describe('resolveFullTag()', () => {
  it('should prepend org prefix to a short slug', async () => {
    const { resolveFullTag } = await import('../../src/lib/config.js');
    const tag = resolveFullTag('node-shell-claude');
    expect(tag).toBe('timatmongodb/mongostage:node-shell-claude');
  });

  it('should return full tags unchanged', async () => {
    const { resolveFullTag } = await import('../../src/lib/config.js');
    const tag = resolveFullTag('timatmongodb/mongostage:node-shell-claude');
    expect(tag).toBe('timatmongodb/mongostage:node-shell-claude');
  });
});

describe('filterImagesByCategory()', () => {
  it('should return only images matching the category', async () => {
    const { filterImagesByCategory } = await import('../../src/lib/config.js');
    const images = filterImagesByCategory('ai');
    expect(images.length).toBeGreaterThan(0);
    for (const img of images) {
      expect(img.category).toBe('ai');
    }
  });

  it('should return an empty array for unknown category', async () => {
    const { filterImagesByCategory } = await import('../../src/lib/config.js');
    const images = filterImagesByCategory('unknown-category-xyz');
    expect(images).toHaveLength(0);
  });
});

describe('getCliConfig()', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.MONGOSTAGE_CONFIG_DIR;
  });

  it('should return defaults when config directory does not exist', async () => {
    process.env.MONGOSTAGE_CONFIG_DIR = '/nonexistent-mongo-docker-test-dir-xyz';
    const { getCliConfig } = await import('../../src/lib/config.js');
    const config = getCliConfig();
    expect(config).toBeDefined();
    expect(config.defaultOrg).toBe('timatmongodb');
    expect(config.setupComplete).toBe(false);
  });
});
