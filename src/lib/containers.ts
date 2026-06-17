import type Dockerode from 'dockerode';
import type { ContainerState } from '../types/container.js';

const LABEL_KEY = 'mongostage';
const LABEL_SLUG = 'mongostage-slug';
const NAME_PREFIX = 'mongostage-';

export function getContainerName(slug: string): string {
  return `${NAME_PREFIX}${slug}`;
}

export function getSlugFromTag(fullTag: string): string {
  const colon = fullTag.lastIndexOf(':');
  return colon >= 0 ? fullTag.slice(colon + 1) : fullTag;
}

export function isManagedContainer(container: Dockerode.ContainerInfo): boolean {
  return container.Labels?.[LABEL_KEY] === 'true';
}

export async function listManagedContainers(): Promise<ContainerState[]> {
  const { getDockerClient } = await import('./docker.js');
  const docker = getDockerClient();
  const list = await docker.listContainers({
    all: true,
    filters: JSON.stringify({ label: [`${LABEL_KEY}=true`] }),
  });

  const running = list.filter(c => c.State === 'running');
  const stopped = list.filter(c => c.State !== 'running');

  return [...running, ...stopped].map(c => ({
    id: c.Id,
    name: c.Names[0]?.replace(/^\//, '') ?? '',
    imageTag: c.Image,
    slug: c.Labels?.[LABEL_SLUG] ?? getSlugFromTag(c.Image),
    status: c.State === 'running' ? 'running' : c.State === 'exited' ? 'exited' : 'stopped',
    created: new Date(c.Created * 1000).toISOString(),
  }));
}

export async function findContainerBySlug(slug: string): Promise<ContainerState | undefined> {
  const containers = await listManagedContainers();
  return containers.find(c => c.slug === slug);
}
