import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ImageRegistry } from '../../src/types/image.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const registry: ImageRegistry = JSON.parse(
  readFileSync(resolve(__dirname, '../../images.json'), 'utf8')
);

const VALID_CATEGORIES = ['base', 'shell', 'runtime', 'ai', 'server'] as const;

describe('images.json schema validation', () => {
  it('should have a components map with required fields', () => {
    expect(registry.components).toBeDefined();
    for (const [key, comp] of Object.entries(registry.components)) {
      expect(comp.label, `component ${key} missing label`).toBeDefined();
      expect(comp.description, `component ${key} missing description`).toBeDefined();
      expect(typeof comp.order, `component ${key} order must be number`).toBe('number');
    }
  });

  it('should have an images array', () => {
    expect(Array.isArray(registry.images)).toBe(true);
    expect(registry.images.length).toBeGreaterThan(0);
  });

  it('every image should have required fields', () => {
    for (const image of registry.images) {
      expect(image.tag, 'image missing tag').toBeDefined();
      expect(Array.isArray(image.components), `${image.tag} components must be array`).toBe(true);
      expect(image.description, `${image.tag} missing description`).toBeDefined();
      expect(VALID_CATEGORIES).toContain(image.category);
    }
  });

  it('every image tag should follow org/name:slug format', () => {
    for (const image of registry.images) {
      expect(image.tag).toMatch(/^[a-z0-9]+\/[a-z0-9-]+:[a-z0-9-]+$/);
    }
  });

  it('every component reference in images should exist in components map', () => {
    for (const image of registry.images) {
      for (const comp of image.components) {
        expect(
          registry.components[comp],
          `${image.tag} references unknown component: ${comp}`
        ).toBeDefined();
      }
    }
  });
});
