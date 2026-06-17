import { describe, it, expect } from 'vitest';

describe('getContainerName()', () => {
  it('should return "mongostage-{slug}" format', async () => {
    const { getContainerName } = await import('../../src/lib/containers.js');
    expect(getContainerName('node-shell-claude')).toBe('mongostage-node-shell-claude');
  });

  it('should handle simple slugs', async () => {
    const { getContainerName } = await import('../../src/lib/containers.js');
    expect(getContainerName('shell')).toBe('mongostage-shell');
  });
});

describe('getSlugFromTag()', () => {
  it('should extract slug from full tag', async () => {
    const { getSlugFromTag } = await import('../../src/lib/containers.js');
    expect(getSlugFromTag('timatmongodb/mongostage:node-shell-claude')).toBe('node-shell-claude');
  });

  it('should handle base image tag', async () => {
    const { getSlugFromTag } = await import('../../src/lib/containers.js');
    expect(getSlugFromTag('timatmongodb/mongostage:base')).toBe('base');
  });
});

describe('isManagedContainer()', () => {
  it('should return true for containers with mongostage=true label', async () => {
    const { isManagedContainer } = await import('../../src/lib/containers.js');
    const container = {
      Labels: { 'mongostage': 'true', 'mongostage-slug': 'node-shell' },
      Id: 'abc123',
    } as unknown as import('dockerode').ContainerInfo;
    expect(isManagedContainer(container)).toBe(true);
  });

  it('should return false for containers without the label', async () => {
    const { isManagedContainer } = await import('../../src/lib/containers.js');
    const container = {
      Labels: { 'some-other': 'label' },
      Id: 'def456',
    } as unknown as import('dockerode').ContainerInfo;
    expect(isManagedContainer(container)).toBe(false);
  });

  it('should return false for containers with no labels', async () => {
    const { isManagedContainer } = await import('../../src/lib/containers.js');
    const container = {
      Labels: {},
      Id: 'ghi789',
    } as unknown as import('dockerode').ContainerInfo;
    expect(isManagedContainer(container)).toBe(false);
  });
});
